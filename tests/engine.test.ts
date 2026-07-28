import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  HumanizeError,
  type HumanizeRequest,
  type ModelCall,
  MAX_INPUT_WORDS,
  humanize,
} from "@/lib/humanize/engine";

const BASE: HumanizeRequest = {
  text: "In today's fast-paced world, it is important to note that organizations must delve into the multifaceted landscape of digital transformation. Moreover, companies that leverage robust frameworks will foster seamless integration.",
  gradeId: "grade-8",
  toneId: "neutral",
  intensityId: "balanced",
  preserveFormatting: true,
  autoCorrect: false,
};

/** A fake model that records what it was asked and replays canned answers. */
function fakeModel(replies: string[]) {
  const calls: Array<{ system: string; user: string }> = [];
  let index = 0;

  const call: ModelCall = async (system, user) => {
    calls.push({ system, user });
    const reply = replies[Math.min(index, replies.length - 1)];
    index += 1;
    return reply;
  };

  return { call, calls, get count() { return index; } };
}

const SIMPLE_REWRITE =
  "Remote work changed how teams operate. Some of it stuck. The rest didn't, and most managers still can't say which is which.";

/** Measures at Flesch-Kincaid 5.5, inside the 5th-grade band of 3.8–6.2. */
const ON_TARGET_FOR_GRADE_5 =
  "The team rebuilt the deployment pipeline over three weeks. Nobody enjoyed it. The old system had failed twice in one month, so the work was necessary.";

describe("humanize — validation", () => {
  it("rejects empty input before calling the model", async () => {
    const model = fakeModel(["unused"]);
    await assert.rejects(
      () => humanize({ ...BASE, text: "   " }, model.call),
      (err: unknown) => err instanceof HumanizeError && err.status === 400,
    );
    assert.equal(model.count, 0);
  });

  it("rejects input over the word limit before calling the model", async () => {
    const model = fakeModel(["unused"]);
    const huge = "word ".repeat(MAX_INPUT_WORDS + 50);

    await assert.rejects(
      () => humanize({ ...BASE, text: huge }, model.call),
      (err: unknown) => err instanceof HumanizeError && err.status === 413,
    );
    assert.equal(model.count, 0);
  });
});

describe("humanize — single pass", () => {
  it("returns the rewrite with before and after analyses", async () => {
    const model = fakeModel([SIMPLE_REWRITE]);
    const result = await humanize(BASE, model.call);

    assert.equal(result.passes, 1);
    assert.equal(result.output, SIMPLE_REWRITE);
    assert.ok(result.before.wordCount > 0);
    assert.ok(result.after.wordCount > 0);
    assert.ok(
      result.after.patterns.score < result.before.patterns.score,
      "the cleaner rewrite should score lower than the flagged source",
    );
  });

  it("applies deterministic cleanup to the model output", async () => {
    const model = fakeModel([
      'Here is the rewritten version:\n\nThe plan failed — badly. He said “no” and left.',
    ]);
    const result = await humanize(BASE, model.call);

    assert.ok(!result.output.includes("—"), result.output);
    assert.ok(!result.output.includes("“"), result.output);
    assert.ok(!result.output.startsWith("Here is"), result.output);
    assert.ok(result.cleanup.length >= 2, result.cleanup.join("|"));
  });

  it("passes the grade profile into the system prompt", async () => {
    const model = fakeModel([SIMPLE_REWRITE]);
    await humanize({ ...BASE, gradeId: "grade-11" }, model.call);

    const { system } = model.calls[0];
    assert.match(system, /11th grade reading level/);
    assert.match(system, /Flesch-Kincaid grade of about 11/);
  });

  it("puts the analyzer's findings in the user prompt", async () => {
    const model = fakeModel([SIMPLE_REWRITE]);
    await humanize(BASE, model.call);

    const { user } = model.calls[0];
    assert.match(user, /delve into/, "flagged phrases should be named");
    assert.match(user, /<draft>/);
    assert.ok(user.includes(BASE.text), "the draft itself must be included");
  });

  it("forwards custom instructions", async () => {
    const model = fakeModel([SIMPLE_REWRITE]);
    await humanize(
      { ...BASE, customInstructions: "keep the phrase 'digital transformation' intact" },
      model.call,
    );
    assert.match(model.calls[0].user, /digital transformation' intact/);
  });
});

describe("humanize — auto-correction", () => {
  /* Deliberately over-complex, so pass one lands far above an 8th-grade target. */
  const TOO_ADVANCED =
    "The comprehensive institutional restructuring initiative necessitated unprecedented interdepartmental collaboration among numerous organizational stakeholders throughout the entirety of the preceding fiscal period, notwithstanding considerable methodological disagreements.";

  it("runs a second pass when the first misses the grade band", async () => {
    const model = fakeModel([TOO_ADVANCED, SIMPLE_REWRITE]);
    const result = await humanize({ ...BASE, autoCorrect: true }, model.call);

    assert.equal(model.count, 2);
    assert.equal(result.passes, 2);
    assert.equal(result.output, SIMPLE_REWRITE);
    assert.match(result.correctionReason ?? "", /corrective pass/i);
  });

  it("keeps the first pass when the correction scores no closer", async () => {
    // Second reply is even further from the target than the first.
    const worse = `${TOO_ADVANCED} ${TOO_ADVANCED}`;
    const model = fakeModel([TOO_ADVANCED, worse]);
    const result = await humanize({ ...BASE, autoCorrect: true }, model.call);

    assert.equal(model.count, 2);
    assert.equal(result.output, TOO_ADVANCED);
    assert.match(result.correctionReason ?? "", /no closer/i);
  });

  it("does not run a second pass when auto-correct is off", async () => {
    const model = fakeModel([TOO_ADVANCED, SIMPLE_REWRITE]);
    const result = await humanize({ ...BASE, autoCorrect: false }, model.call);

    assert.equal(model.count, 1);
    assert.equal(result.passes, 1);
    assert.equal(result.correctionReason, undefined);
  });

  it("does not run a second pass when the first already hits the band", async () => {
    const model = fakeModel([ON_TARGET_FOR_GRADE_5, "should never be used"]);
    const result = await humanize({ ...BASE, gradeId: "grade-5", autoCorrect: true }, model.call);

    assert.equal(model.count, 1);
    assert.equal(result.output, ON_TARGET_FOR_GRADE_5);
    assert.equal(result.correctionReason, undefined);
  });

  it("corrects upward when the rewrite lands below the target", async () => {
    // SIMPLE_REWRITE measures 1.8, far under the graduate target of 17.
    const model = fakeModel([SIMPLE_REWRITE, ON_TARGET_FOR_GRADE_5]);
    await humanize({ ...BASE, gradeId: "graduate", autoCorrect: true }, model.call);

    assert.equal(model.count, 2);
    assert.match(model.calls[1].user, /too simple/i);
  });

  it("tells the correction pass which direction to move", async () => {
    const model = fakeModel([TOO_ADVANCED, SIMPLE_REWRITE]);
    await humanize({ ...BASE, autoCorrect: true }, model.call);

    const correction = model.calls[1].user;
    assert.match(correction, /too advanced/i);
    assert.match(correction, /Flesch-Kincaid grade of/);
    assert.ok(correction.includes(TOO_ADVANCED), "must include the text to correct");
  });
});

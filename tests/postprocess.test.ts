import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { postProcess } from "@/lib/humanize/postprocess";

describe("postProcess — em dashes", () => {
  it("removes every em dash", () => {
    const { text } = postProcess(
      "The plan failed — badly. We tried again — twice — before giving up. It worked — finally.",
    );
    assert.ok(!text.includes("—"), text);
    assert.ok(!text.includes("–"), text);
  });

  it("converts a paired dash into commas or parentheses", () => {
    const { text } = postProcess("The plan — which nobody liked — went ahead.");
    assert.ok(/,\s*which nobody liked\s*,|\(which nobody liked\)/.test(text), text);
  });

  it("capitalizes the next word when it converts a dash to a period", () => {
    const { text } = postProcess(
      "The build broke — it always does. The test failed — they never pass. The deploy hung — we gave up. The log was empty — there was nothing.",
    );
    assert.ok(text.includes(". We gave up"), text);
    assert.ok(!/\.\s+[a-z]/.test(text), `lowercase after a period in: ${text}`);
  });

  it("does not pair dashes that sit in different sentences", () => {
    const { text } = postProcess("It broke — it always does. We fixed it — eventually.");
    assert.ok(!text.includes("("), text);
    assert.ok(text.includes("It broke, it always does."), text);
  });

  it("reports the count of dashes it replaced", () => {
    const { changes } = postProcess("one — two — three");
    assert.ok(changes.some((c) => /em dash/.test(c)), changes.join("|"));
  });

  it("leaves hyphenated words alone", () => {
    const { text } = postProcess("A well-known state-of-the-art result.");
    assert.equal(text, "A well-known state-of-the-art result.");
  });

  it("can be told to keep dashes", () => {
    const { text } = postProcess("kept — here", { stripDashes: false });
    assert.ok(text.includes("—"));
  });
});

describe("postProcess — typography", () => {
  it("straightens curly quotes and apostrophes", () => {
    const { text } = postProcess("He said “hello” and it’s fine.");
    assert.equal(text, 'He said "hello" and it\'s fine.');
  });

  it("expands the ellipsis character", () => {
    const { text } = postProcess("Wait… what?");
    assert.equal(text, "Wait... what?");
  });

  it("replaces non-breaking spaces", () => {
    const { text } = postProcess("one two");
    assert.equal(text, "one two");
  });
});

describe("postProcess — preambles", () => {
  it("strips a handoff line that ends in a colon", () => {
    const { text } = postProcess(
      "Here is the rewritten version:\n\nThe actual content starts here.",
    );
    assert.equal(text, "The actual content starts here.");
  });

  it("strips 'Sure, here's the rewrite:'", () => {
    const { text } = postProcess("Sure, here's the rewrite:\n\nReal text.");
    assert.equal(text, "Real text.");
  });

  it("does not eat prose that merely starts with 'Of course'", () => {
    const input = "Of course, the committee disagreed. That was expected.";
    const { text } = postProcess(input);
    assert.equal(text, input);
  });

  it("does not eat a first line that happens to contain a colon", () => {
    const input = "The rule was simple: nobody leaves early.\n\nThat held for a week.";
    const { text } = postProcess(input);
    assert.ok(text.startsWith("The rule was simple:"), text);
  });

  it("removes a wrapping code fence", () => {
    const { text } = postProcess("```\nThe content.\n```");
    assert.equal(text, "The content.");
  });
});

describe("postProcess — whitespace", () => {
  it("collapses runs of spaces and blank lines", () => {
    const { text } = postProcess("one  two   three\n\n\n\nfour");
    assert.equal(text, "one two three\n\nfour");
  });

  it("trims trailing whitespace on each line", () => {
    const { text } = postProcess("one   \ntwo\t\n");
    assert.equal(text, "one\ntwo");
  });

  it("preserves markdown list indentation", () => {
    const { text } = postProcess("Items:\n\n- one\n- two\n  - nested");
    assert.ok(text.includes("  - nested"), text);
  });
});

describe("postProcess — safety", () => {
  it("is a no-op on already-clean prose", () => {
    const input = "The deploy failed twice. Nobody knew why.\n\nThen it worked.";
    const { text, changes } = postProcess(input);
    assert.equal(text, input);
    assert.deepEqual(changes, []);
  });

  it("handles an empty string", () => {
    assert.equal(postProcess("").text, "");
  });

  it("does not drop content while rewriting punctuation", () => {
    const input = "Alpha — beta — gamma; delta “epsilon” zeta.";
    const { text } = postProcess(input);
    for (const word of ["Alpha", "beta", "gamma", "delta", "epsilon", "zeta"]) {
      assert.ok(text.includes(word), `${word} missing from ${text}`);
    }
  });
});

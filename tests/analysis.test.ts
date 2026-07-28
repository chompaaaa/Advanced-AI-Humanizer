import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { analyzeText } from "@/lib/analysis";
import { computeReadability } from "@/lib/analysis/readability";
import {
  countSyllables,
  splitParagraphs,
  splitSentences,
  splitWords,
  tokenize,
} from "@/lib/analysis/tokenize";

describe("splitSentences", () => {
  it("splits on terminal punctuation", () => {
    const s = splitSentences("The cat sat. The dog ran! Did it? Yes.");
    assert.equal(s.length, 4);
    assert.equal(s[0], "The cat sat.");
    assert.equal(s[2], "Did it?");
  });

  it("does not split on abbreviations", () => {
    const s = splitSentences("Dr. Smith met Mr. Jones at 4 p.m. They talked.");
    assert.equal(s.length, 2);
    assert.match(s[0], /Dr\. Smith met Mr\. Jones/);
  });

  it("does not split inside decimals", () => {
    const s = splitSentences("Revenue grew 3.5 percent last year. That is real.");
    assert.equal(s.length, 2);
    assert.match(s[0], /3\.5 percent/);
  });

  it("does not split on initials", () => {
    const s = splitSentences("J. R. R. Tolkien wrote it. He was a professor.");
    assert.equal(s.length, 2);
  });

  it("treats list items as separate sentences", () => {
    const s = splitSentences("Reasons:\n- First point\n- Second point\n- Third point");
    assert.equal(s.length, 4);
  });

  it("handles an empty string", () => {
    assert.deepEqual(splitSentences(""), []);
    assert.deepEqual(splitSentences("   \n  "), []);
  });

  it("keeps a sentence with no terminal punctuation", () => {
    const s = splitSentences("no punctuation at all here");
    assert.equal(s.length, 1);
  });
});

describe("splitWords", () => {
  it("keeps contractions and hyphenates as single words", () => {
    assert.deepEqual(splitWords("don't well-known it's"), ["don't", "well-known", "it's"]);
  });

  it("drops bare numbers and punctuation", () => {
    assert.deepEqual(splitWords("3 cats, 4 dogs!"), ["cats", "dogs"]);
  });

  // A Latin-only pattern returned zero words for these, which zeroed every
  // downstream metric and let such text slip past the API word-count cap.
  it("counts words in non-Latin scripts", () => {
    assert.equal(splitWords("это тест здесь сейчас").length, 4, "Cyrillic");
    assert.equal(splitWords("αυτο ειναι ενα τεστ").length, 4, "Greek");
    assert.equal(splitWords("هذا اختبار هنا").length, 3, "Arabic");
    assert.equal(splitWords("זה מבחן כאן").length, 3, "Hebrew");
  });

  it("still counts accented Latin as words", () => {
    assert.deepEqual(splitWords("café naïve Zoë"), ["café", "naïve", "Zoë"]);
  });
});

describe("control characters", () => {
  const SOH = String.fromCharCode(1);
  const NUL = String.fromCharCode(0);

  it("strips them instead of round-tripping them into stray periods", () => {
    const sentences = splitSentences(`Before${SOH}middle after. Second sentence.`);
    assert.equal(sentences.length, 2);
    assert.equal(sentences[0], "Beforemiddle after.");
    assert.ok(!sentences[0].includes("Before."), "no period invented mid-word");
  });

  it("does not let a NUL in the source create a sentence break", () => {
    assert.equal(splitSentences(`Keep${NUL}this together.`).length, 1);
  });

  it("keeps tabs and newlines, which are structural", () => {
    assert.equal(splitParagraphs("One.\n\nTwo.").length, 2);
    assert.equal(splitWords("a\tb").length, 2);
  });
});

describe("countSyllables", () => {
  const cases: Array<[string, number]> = [
    ["cat", 1],
    ["the", 1],
    ["table", 2],
    ["little", 2],
    ["running", 2],
    ["beautiful", 3],
    ["university", 5],
    ["queue", 1],
  ];

  for (const [word, expected] of cases) {
    it(`counts "${word}" as ${expected}`, () => {
      assert.equal(countSyllables(word), expected);
    });
  }

  it("never returns zero for a real word", () => {
    for (const w of ["a", "I", "rhythm", "strengths"]) {
      assert.ok(countSyllables(w) >= 1);
    }
  });
});

describe("splitParagraphs", () => {
  it("splits on blank lines", () => {
    assert.equal(splitParagraphs("One.\n\nTwo.\n\n\nThree.").length, 3);
  });
});

describe("computeReadability", () => {
  it("scores simple prose below complex prose", () => {
    const simple = computeReadability(
      tokenize("The dog ran. The cat sat. We went home. It was fun. I ate food."),
    );
    const complex = computeReadability(
      tokenize(
        "The multifaceted epistemological ramifications of institutional decentralization necessitate comprehensive interdisciplinary investigation across numerous methodological paradigms.",
      ),
    );

    assert.ok(
      simple.fleschKincaidGrade < complex.fleschKincaidGrade,
      `expected ${simple.fleschKincaidGrade} < ${complex.fleschKincaidGrade}`,
    );
    assert.ok(simple.fleschReadingEase > complex.fleschReadingEase);
  });

  it("returns zeroes for empty input rather than NaN", () => {
    const r = computeReadability(tokenize(""));
    for (const value of Object.values(r)) {
      assert.ok(Number.isFinite(value), "every readability field must be finite");
    }
    assert.equal(r.consensusGrade, 0);
  });

  it("never produces NaN on single-word input", () => {
    const r = computeReadability(tokenize("Hello"));
    for (const value of Object.values(r)) {
      assert.ok(Number.isFinite(value));
    }
  });

  // The formulas are unbounded; a 600-word run-on sentence scored grade 230.
  it("caps absurd grades at a reportable ceiling", () => {
    const runOn = `${"word ".repeat(600)}end.`;
    const r = computeReadability(tokenize(runOn));
    assert.ok(r.fleschKincaidGrade <= 30, `got ${r.fleschKincaidGrade}`);
    assert.ok(r.consensusGrade <= 30, `got ${r.consensusGrade}`);
    assert.ok(r.gunningFog <= 30 && r.smog <= 30 && r.automatedReadability <= 30);
  });
});

describe("contraction detection", () => {
  const contractionScore = (text: string) =>
    analyzeText(text).patterns.signals.find((s) => s.id === "contractions");

  const POSSESSIVES = `The company's quarterly results exceeded the board's expectations across every reporting segment. Management's approach was validated by the market's response over the following weeks. The industry's leaders broadly agreed with the analyst's assessment of the situation. The firm's strategy reflected the sector's direction and the region's steady growth. The client's feedback matched the vendor's own internal review of the rollout.`;

  const REAL = `The company didn't hit its numbers this quarter and nobody on the call pretended otherwise. We're not entirely sure why it went the way it did. They'd promised something better back in spring, and it's pretty clear now that wasn't ever going to happen. You can't plan a year around a forecast that soft. I've seen this before.`;

  // A permissive pattern counted every possessive, so formal prose with zero
  // contractions scored *more* conversational than genuinely chatty writing.
  it("does not count possessive apostrophes as contractions", () => {
    const signal = contractionScore(POSSESSIVES);
    assert.match(signal?.detail ?? "", /^0 contractions/, signal?.detail);
    assert.equal(signal?.score, 100, "no contractions should read as machine-like");
  });

  it("counts genuine contractions", () => {
    const signal = contractionScore(REAL);
    assert.ok((signal?.score ?? 100) < 20, `expected a low score, got ${signal?.score}`);
  });

  it("recognises each contraction family", () => {
    for (const sample of ["don't", "isn't", "won't", "I'm", "we're", "they've", "it'll", "he'd", "it's", "let's"]) {
      const padded = `${sample} ${"filler word here ".repeat(20)}`;
      const signal = contractionScore(padded);
      assert.match(signal?.detail ?? "", /^[1-9]/, `${sample} was not counted`);
    }
  });

  it("does not count a possessive proper noun", () => {
    const padded = `James's report and the team's notes. ${"filler word here ".repeat(20)}`;
    assert.match(contractionScore(padded)?.detail ?? "", /^0 contractions/);
  });
});

describe("language handling", () => {
  it("flags mostly non-Latin text instead of reporting a confident grade", () => {
    const ru = analyzeText("Это тест. Ещё один тест здесь. Третье предложение тоже тут.");
    assert.ok(ru.languageNote, "expected a language note for Russian");
    assert.ok(ru.wordCount > 0, "word count must still be accurate");
  });

  it("leaves English alone", () => {
    const en = analyzeText("The deploy failed twice today. Nobody knew why it happened.");
    assert.equal(en.languageNote, undefined);
  });

  it("leaves mostly-English text with some foreign words alone", () => {
    const mixed = analyzeText(
      "The report said это было хорошо and then moved on to other things entirely.",
    );
    assert.equal(mixed.languageNote, undefined);
  });
});

describe("analyzeText", () => {
  const machineLike = `In today's fast-paced world, it is important to note that artificial intelligence plays a crucial role in modern business. Moreover, organizations must delve into the multifaceted landscape of digital transformation. Furthermore, companies that leverage robust frameworks will foster seamless integration across departments. Additionally, this represents a testament to the pivotal nature of technological adoption. Ultimately, businesses navigating the complexities of this realm must embrace innovation, efficiency, and adaptability.

In today's fast-paced world, it is worth noting that data serves as a cornerstone of decision making. Moreover, organizations must delve into comprehensive analytics platforms. Furthermore, teams that harness the power of insights will foster meaningful outcomes across functions. Additionally, this underscores the pivotal role of information governance. Ultimately, enterprises navigating these intricate challenges must prioritize accuracy, transparency, and accountability.`;

  const humanLike = `I spent three weeks trying to get the deploy script working. It kept failing on the same line.

Turns out the problem wasn't the script at all. Our staging box had a stale copy of the config, and nobody had touched it since March. Once I noticed that, the fix took about four minutes. Four minutes, after three weeks.

I'm still annoyed about it. But at least now there's a check in CI that catches the same thing, so the next person won't lose their month to it.`;

  it("scores unedited model prose higher than human prose", () => {
    const machine = analyzeText(machineLike);
    const human = analyzeText(humanLike);

    assert.ok(
      machine.patterns.score > human.patterns.score + 15,
      `expected machine ${machine.patterns.score} >> human ${human.patterns.score}`,
    );
  });

  it("flags the machine sample as machine-like and the human one as not", () => {
    assert.equal(analyzeText(machineLike).patterns.band, "machine-like");
    assert.notEqual(analyzeText(humanLike).patterns.band, "machine-like");
  });

  it("surfaces the specific flagged phrases as evidence", () => {
    const lexicon = analyzeText(machineLike).patterns.signals.find((s) => s.id === "lexicon");
    assert.ok(lexicon);
    const phrases = lexicon.evidence.map((e) => e.text);
    assert.ok(phrases.includes("delve into"), `got ${phrases.join(", ")}`);
    assert.ok(phrases.includes("in today's fast-paced world"));
  });

  it("counts words, sentences and paragraphs", () => {
    const a = analyzeText("One two three. Four five.\n\nSix seven eight nine.");
    assert.equal(a.wordCount, 9);
    assert.equal(a.sentenceCount, 3);
    assert.equal(a.paragraphCount, 2);
  });

  it("handles empty input without throwing", () => {
    const a = analyzeText("");
    assert.equal(a.wordCount, 0);
    assert.equal(a.patterns.score, 0);
    assert.deepEqual(a.outliers, []);
  });

  it("keeps every signal score inside 0-100", () => {
    for (const sample of [machineLike, humanLike, "Short.", ""]) {
      for (const signal of analyzeText(sample).patterns.signals) {
        assert.ok(signal.score >= 0 && signal.score <= 100, `${signal.id} = ${signal.score}`);
      }
    }
  });

  it("reports sentences above the target grade as outliers", () => {
    const text =
      "It was fine. The comprehensive institutional restructuring initiative necessitated unprecedented interdepartmental collaboration among numerous organizational stakeholders throughout the entirety of the fiscal period. We left.";
    const outliers = analyzeText(text, 6).outliers;
    assert.ok(outliers.length >= 1);
    assert.match(outliers[0].sentence, /comprehensive institutional/);
  });
});

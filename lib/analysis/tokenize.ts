/**
 * Plain-JS tokenizing used by every metric in the analyzer.
 *
 * Everything here is deterministic and dependency-free so the whole analysis
 * pass can run in the browser on each keystroke without touching the network.
 */

/** Abbreviations whose trailing period must not end a sentence. */
const ABBREVIATIONS = [
  "mr",
  "mrs",
  "ms",
  "dr",
  "prof",
  "sr",
  "jr",
  "st",
  "mt",
  "rev",
  "hon",
  "gen",
  "col",
  "capt",
  "lt",
  "sgt",
  "vs",
  "etc",
  "inc",
  "ltd",
  "co",
  "corp",
  "dept",
  "est",
  "fig",
  "vol",
  "no",
  "pp",
  "ed",
  "eds",
  "al",
  "approx",
  "cf",
  "ca",
  "e.g",
  "i.e",
  "a.m",
  "p.m",
];

const SENTINEL = "";

/**
 * Replaces periods that are structurally part of a token (abbreviations,
 * decimals, initials, ellipses) with a sentinel so the splitter ignores them.
 */
function maskNonTerminalPeriods(text: string): string {
  let masked = text;

  // Decimal numbers: 3.14, 1,024.55
  masked = masked.replace(/(\d)\.(\d)/g, `$1${SENTINEL}$2`);

  // Dotted acronyms: U.S.A., i.e. handled below as an abbreviation.
  masked = masked.replace(/\b([A-Za-z])\.(?=[A-Za-z]\.)/g, `$1${SENTINEL}`);

  // Known abbreviations, longest first so "e.g" wins over "g".
  const sorted = [...ABBREVIATIONS].sort((a, b) => b.length - a.length);
  for (const abbr of sorted) {
    const escaped = abbr.replace(/\./g, "\\.");
    masked = masked.replace(
      new RegExp(`(^|[\\s("'\\[])(${escaped})\\.`, "gi"),
      `$1$2${SENTINEL}`,
    );
  }

  // Runs of two or more initials before a name: "J. R. R. Tolkien".
  // Requiring two keeps "...option B. The next step" splitting correctly.
  masked = masked.replace(/\b(?:[A-Z]\.[ \t]*){2,}(?=[A-Z])/g, (run) =>
    run.replace(/\./g, SENTINEL),
  );

  // A single initial directly after a masked title: "Mr. J. Smith".
  masked = masked.replace(
    new RegExp(`${SENTINEL}([ \\t]+[A-Z])\\.`, "g"),
    `${SENTINEL}$1${SENTINEL}`,
  );

  // Ellipses are one token, not three sentence ends.
  masked = masked.replace(/\.\.\./g, `${SENTINEL}${SENTINEL}${SENTINEL}`);

  return masked;
}

function unmask(text: string): string {
  return text.replace(new RegExp(SENTINEL, "g"), ".");
}

/**
 * Splits prose into sentences. Markdown headings, list markers and blank lines
 * act as hard boundaries so a bulleted list doesn't read as one long sentence.
 */
export function splitSentences(text: string): string[] {
  if (!text.trim()) return [];

  const blocks = text
    .split(/\n{2,}|\n(?=\s*(?:[-*+•]\s|\d+[.)]\s|#{1,6}\s|>\s))/)
    .map((b) => b.trim())
    .filter(Boolean);

  const sentences: string[] = [];

  for (const block of blocks) {
    // Strip leading markdown furniture so it isn't counted as sentence content.
    const body = block.replace(/^\s*(?:#{1,6}\s+|[-*+•]\s+|\d+[.)]\s+|>\s+)/, "");
    const masked = maskNonTerminalPeriods(body);

    const parts = masked
      .split(/(?<=[.!?…])["'”’)\]]*(?:\s+|$)/)
      .map((s) => unmask(s).trim())
      .filter(Boolean);

    if (parts.length === 0 && body.trim()) {
      sentences.push(body.trim());
    } else {
      sentences.push(...parts);
    }
  }

  return sentences;
}

/** Paragraphs, split on blank lines. */
export function splitParagraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/**
 * Word tokens. Keeps internal apostrophes and hyphens so "don't" and
 * "well-known" survive as single words.
 */
export function splitWords(text: string): string[] {
  const matches = text.match(/[A-Za-zÀ-ɏ]+(?:['’\-][A-Za-zÀ-ɏ]+)*/g);
  return matches ?? [];
}

const VOWEL_GROUP = /[aeiouy]+/g;

/**
 * Heuristic English syllable count. Not perfect on loanwords, but stable and
 * consistent, which is what the readability formulas actually need.
 */
export function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  if (w.length <= 3) return 1;

  let s = w;

  // In a consonant + "le" ending the final e carries its own syllable
  // ("ta-ble", "lit-tle"), so it must survive the silent-e strip below.
  const consonantLe = /[^aeiouy]le$/.test(s);
  if (!consonantLe) {
    s = s.replace(/e$/, "");
  }

  // Silent -es / -ed, except after a sibilant or dental where it is voiced
  // ("cases", "wanted" keep the syllable; "hoped" loses it).
  s = s.replace(/(?<![tds])(?:es|ed)$/, "");

  // A leading y is a consonant, not a vowel ("yellow").
  s = s.replace(/^y/, "");

  const groups = s.match(VOWEL_GROUP);
  return Math.max(1, groups ? groups.length : 0);
}

export function isComplexWord(word: string): boolean {
  const w = word.toLowerCase();
  // Gunning Fog: 3+ syllables, excluding easy suffix inflections.
  if (countSyllables(w) < 3) return false;
  if (/(?:es|ed|ing)$/.test(w) && countSyllables(w.replace(/(?:es|ed|ing)$/, "")) < 3) {
    return false;
  }
  return true;
}

export interface TokenizedText {
  raw: string;
  paragraphs: string[];
  sentences: string[];
  words: string[];
  syllables: number;
  complexWords: number;
  characters: number;
}

export function tokenize(text: string): TokenizedText {
  const sentences = splitSentences(text);
  const words = splitWords(text);

  let syllables = 0;
  let complexWords = 0;
  for (const word of words) {
    syllables += countSyllables(word);
    if (isComplexWord(word)) complexWords += 1;
  }

  return {
    raw: text,
    paragraphs: splitParagraphs(text),
    sentences,
    words,
    syllables,
    complexWords,
    characters: text.replace(/\s/g, "").length,
  };
}

/** Word count of a single sentence, used for the burstiness metrics. */
export function sentenceLengths(sentences: string[]): number[] {
  return sentences.map((s) => splitWords(s).length).filter((n) => n > 0);
}

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function stdev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance = values.reduce((acc, v) => acc + (v - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/** Clamps to a 0-100 range and rounds to one decimal. */
export function clamp100(value: number): number {
  return Math.round(Math.min(100, Math.max(0, value)) * 10) / 10;
}

/**
 * Maps a raw measurement onto a 0-100 score by linear interpolation between a
 * "clean" anchor and a "flagged" anchor. Anchors may be inverted (clean > flagged).
 */
export function scoreBetween(value: number, clean: number, flagged: number): number {
  if (clean === flagged) return 0;
  const t = (value - clean) / (flagged - clean);
  return clamp100(t * 100);
}

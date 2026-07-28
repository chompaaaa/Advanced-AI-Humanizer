import {
  AI_PHRASES,
  CONTRACTIONS,
  IRREGULAR_PARTICIPLES,
  STOCK_OPENERS,
  type LexiconEntry,
} from "./lexicon";
import {
  type TokenizedText,
  clamp100,
  mean,
  scoreBetween,
  sentenceLengths,
  splitWords,
  stdev,
} from "./tokenize";

export interface SignalEvidence {
  /** The exact text that triggered the signal. */
  text: string;
  /** How many times it appears. */
  count: number;
  /** Optional human-preferred replacement. */
  suggestion?: string;
}

export interface Signal {
  id: string;
  label: string;
  /** 0-100. Higher means more machine-like. */
  score: number;
  /** Contribution to the composite score. */
  weight: number;
  /** One-line explanation of what was measured. */
  detail: string;
  evidence: SignalEvidence[];
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function phraseRegex(phrase: string): RegExp {
  // Word boundaries only where the phrase edge is a word character, so
  // punctuation-adjacent phrases still match.
  const body = escapeRegExp(phrase);
  const left = /^\w/.test(phrase) ? "\\b" : "";
  const right = /\w$/.test(phrase) ? "\\b" : "";
  return new RegExp(`${left}${body}${right}`, "gi");
}

/**
 * Compiled once at module load rather than on every analysis. The analyzer
 * runs on a debounce as the user types, and rebuilding ~100 regexes per
 * keystroke is pure waste. Safe to share: `String.prototype.match` resets
 * `lastIndex`, so a global regex carries no state between calls.
 */
const COMPILED_PHRASES = AI_PHRASES.map((entry) => ({
  entry,
  regex: phraseRegex(entry.phrase),
}));

/** Sentence-length variation. Human prose swings; model prose clusters. */
function burstinessSignal(t: TokenizedText): Signal {
  const lengths = sentenceLengths(t.sentences);

  if (lengths.length < 4) {
    return {
      id: "burstiness",
      label: "Sentence rhythm",
      score: 0,
      weight: 0,
      detail: "Needs at least 4 sentences to measure rhythm.",
      evidence: [],
    };
  }

  const m = mean(lengths);
  const sd = stdev(lengths);
  const cv = m > 0 ? sd / m : 0;

  // Human editorial prose typically lands around CV 0.55-0.85.
  // Unedited model output clusters near 0.25-0.40.
  const score = scoreBetween(cv, 0.7, 0.22);

  const shortest = Math.min(...lengths);
  const longest = Math.max(...lengths);

  return {
    id: "burstiness",
    label: "Sentence rhythm",
    score,
    weight: 2.2,
    detail: `Sentence lengths vary by ${(cv * 100).toFixed(0)}% around a ${m.toFixed(
      0,
    )}-word average (range ${shortest}–${longest}). Human writing usually varies 55–85%.`,
    evidence: [],
  };
}

/** Paragraphs of near-identical length read as generated structure. */
function paragraphUniformitySignal(t: TokenizedText): Signal {
  const lengths = t.paragraphs.map((p) => splitWords(p).length).filter((n) => n > 8);

  if (lengths.length < 3) {
    return {
      id: "paragraph-uniformity",
      label: "Paragraph shape",
      score: 0,
      weight: 0,
      detail: "Needs at least 3 substantial paragraphs to measure.",
      evidence: [],
    };
  }

  const m = mean(lengths);
  const cv = m > 0 ? stdev(lengths) / m : 0;
  const score = scoreBetween(cv, 0.45, 0.08);

  return {
    id: "paragraph-uniformity",
    label: "Paragraph shape",
    score,
    weight: 1.2,
    detail: `Paragraph lengths vary by ${(cv * 100).toFixed(0)}% (${lengths.length} paragraphs, ${m.toFixed(
      0,
    )} words average). Near-identical paragraphs are a strong template tell.`,
    evidence: [],
  };
}

/** Density of the flagged phrase inventory. */
function lexiconSignal(t: TokenizedText): Signal {
  const wordCount = Math.max(1, t.words.length);
  const evidence: SignalEvidence[] = [];
  let weighted = 0;

  for (const { entry, regex } of COMPILED_PHRASES) {
    const matches = t.raw.match(regex);
    if (!matches) continue;
    weighted += matches.length * entry.weight;
    evidence.push({
      text: entry.phrase,
      count: matches.length,
      suggestion: entry.suggestion,
    });
  }

  const per1k = (weighted / wordCount) * 1000;
  const score = scoreBetween(per1k, 1, 22);

  evidence.sort((a, b) => b.count - a.count);

  return {
    id: "lexicon",
    label: "Flagged vocabulary",
    score,
    weight: 2.5,
    detail:
      evidence.length === 0
        ? "No flagged phrases found."
        : `${evidence.length} flagged phrase${evidence.length === 1 ? "" : "s"} at a weighted density of ${per1k.toFixed(1)} per 1,000 words.`,
    evidence: evidence.slice(0, 14),
  };
}

/** Share of sentences opening with a stock transition. */
function openerSignal(t: TokenizedText): Signal {
  if (t.sentences.length < 3) {
    return {
      id: "openers",
      label: "Sentence openers",
      score: 0,
      weight: 0,
      detail: "Needs at least 3 sentences to measure.",
      evidence: [],
    };
  }

  const counts = new Map<string, number>();
  let hits = 0;

  for (const sentence of t.sentences) {
    const normalized = sentence.trim().toLowerCase().replace(/^[^a-z]+/, "");
    const opener = STOCK_OPENERS.find(
      (o) => normalized.startsWith(`${o} `) || normalized.startsWith(`${o},`),
    );
    if (opener) {
      hits += 1;
      counts.set(opener, (counts.get(opener) ?? 0) + 1);
    }
  }

  const ratio = hits / t.sentences.length;
  const score = scoreBetween(ratio, 0.04, 0.3);

  const evidence = [...counts.entries()]
    .map(([text, count]) => ({ text, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  return {
    id: "openers",
    label: "Sentence openers",
    score,
    weight: 1.6,
    detail: `${hits} of ${t.sentences.length} sentences (${(ratio * 100).toFixed(0)}%) open with a stock transition.`,
    evidence,
  };
}

/** Em-dash, semicolon and smart-quote profile. */
function punctuationSignal(t: TokenizedText): Signal {
  const wordCount = Math.max(1, t.words.length);
  const emDashes = (t.raw.match(/—|\s--\s/g) ?? []).length;
  const semicolons = (t.raw.match(/;/g) ?? []).length;
  const curlyQuotes = (t.raw.match(/[“”‘’]/g) ?? []).length;

  const emPer1k = (emDashes / wordCount) * 1000;
  const semiPer1k = (semicolons / wordCount) * 1000;
  const curlyPer1k = (curlyQuotes / wordCount) * 1000;

  // Em-dashes are the single loudest surface tell in current model output.
  const emScore = scoreBetween(emPer1k, 0.6, 9);
  const semiScore = scoreBetween(semiPer1k, 0.4, 8);
  const curlyScore = scoreBetween(curlyPer1k, 1, 18);

  const score = clamp100(emScore * 0.55 + semiScore * 0.25 + curlyScore * 0.2);

  const evidence: SignalEvidence[] = [];
  if (emDashes > 0) evidence.push({ text: "em dash (—)", count: emDashes });
  if (semicolons > 0) evidence.push({ text: "semicolon (;)", count: semicolons });
  if (curlyQuotes > 0) evidence.push({ text: "curly quotes", count: curlyQuotes });

  return {
    id: "punctuation",
    label: "Punctuation profile",
    score,
    weight: 1.8,
    detail: `${emDashes} em dash${emDashes === 1 ? "" : "es"}, ${semicolons} semicolon${
      semicolons === 1 ? "" : "s"
    }, ${curlyQuotes} typographic quote${curlyQuotes === 1 ? "" : "s"} across ${wordCount} words.`,
    evidence,
  };
}

/** Contractions are common in human prose and scarce in default model output. */
function contractionSignal(t: TokenizedText): Signal {
  const wordCount = t.words.length;

  if (wordCount < 60) {
    return {
      id: "contractions",
      label: "Contractions",
      score: 0,
      weight: 0,
      detail: "Needs at least 60 words to measure.",
      evidence: [],
    };
  }

  const matches = t.raw.match(CONTRACTIONS) ?? [];
  const per100 = (matches.length / wordCount) * 100;

  // Inverted: more contractions is more human.
  const score = scoreBetween(per100, 2.2, 0);

  return {
    id: "contractions",
    label: "Contractions",
    score,
    weight: 1.3,
    detail: `${matches.length} contraction${matches.length === 1 ? "" : "s"} in ${wordCount} words (${per100.toFixed(
      1,
    )} per 100). Formal model output usually has almost none.`,
    evidence: [],
  };
}

/** "X, Y, and Z" triples and "not just X, but Y" parallelism. */
function parallelismSignal(t: TokenizedText): Signal {
  if (t.sentences.length < 3) {
    return {
      id: "parallelism",
      label: "Parallel constructions",
      score: 0,
      weight: 0,
      detail: "Needs at least 3 sentences to measure.",
      evidence: [],
    };
  }

  const tricolon = (t.raw.match(/\b[\w'-]+,\s+[\w'-]+,\s+(?:and|or)\s+[\w'-]+/gi) ?? []).length;
  const notJust = (
    t.raw.match(/\bnot (?:just|only)\b[^.!?]{2,60}?\bbut\b/gi) ?? []
  ).length;
  const isntJust = (t.raw.match(/\b(?:isn't|it's not|its not)\s+(?:just|only)\b/gi) ?? []).length;

  const total = tricolon + notJust * 2 + isntJust * 2;
  const per10Sentences = (total / t.sentences.length) * 10;
  const score = scoreBetween(per10Sentences, 0.5, 6);

  const evidence: SignalEvidence[] = [];
  if (tricolon > 0) {
    evidence.push({ text: "three-item list (X, Y, and Z)", count: tricolon });
  }
  if (notJust > 0) {
    evidence.push({ text: '"not just … but …"', count: notJust });
  }
  if (isntJust > 0) {
    evidence.push({ text: '"it\'s not just …"', count: isntJust });
  }

  return {
    id: "parallelism",
    label: "Parallel constructions",
    score,
    weight: 1.4,
    detail: `${total} parallel construction${total === 1 ? "" : "s"} across ${t.sentences.length} sentences.`,
    evidence,
  };
}

/** Rough passive-voice rate. */
function passiveSignal(t: TokenizedText): Signal {
  if (t.sentences.length < 3) {
    return {
      id: "passive",
      label: "Passive voice",
      score: 0,
      weight: 0,
      detail: "Needs at least 3 sentences to measure.",
      evidence: [],
    };
  }

  let passiveCount = 0;
  const beVerbs = /\b(?:am|is|are|was|were|be|been|being|get|gets|got)\b/i;

  for (const sentence of t.sentences) {
    const words = splitWords(sentence);
    for (let i = 0; i < words.length - 1; i += 1) {
      if (!beVerbs.test(words[i])) continue;
      // Allow one intervening adverb: "was quickly rewritten".
      for (let j = i + 1; j <= Math.min(i + 2, words.length - 1); j += 1) {
        const candidate = words[j].toLowerCase();
        const isParticiple =
          IRREGULAR_PARTICIPLES.has(candidate) ||
          (/ed$/.test(candidate) && candidate.length > 4);
        if (isParticiple) {
          passiveCount += 1;
          i = j;
          break;
        }
        if (!/ly$/.test(candidate)) break;
      }
    }
  }

  const ratio = passiveCount / t.sentences.length;
  const score = scoreBetween(ratio, 0.1, 0.55);

  return {
    id: "passive",
    label: "Passive voice",
    score,
    weight: 1.0,
    detail: `About ${(ratio * 100).toFixed(0)}% of sentences use a passive construction (${passiveCount} of ${t.sentences.length}).`,
    evidence: [],
  };
}

/**
 * Lexical repetition of content words. Model output tends to re-use its own
 * key nouns at a very even rate instead of varying or pronominalizing them.
 */
/** Hoisted to module scope: rebuilding this Set on every keystroke is waste. */
const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "if", "of", "to", "in", "on", "for",
  "with", "as", "by", "at", "from", "that", "this", "these", "those", "it",
  "its", "is", "are", "was", "were", "be", "been", "being", "have", "has",
  "had", "do", "does", "did", "will", "would", "can", "could", "should",
  "may", "might", "must", "not", "no", "so", "than", "then", "there", "their",
  "they", "them", "he", "she", "his", "her", "we", "our", "you", "your", "i",
  "my", "me", "us", "who", "which", "what", "when", "where", "how", "why",
  "all", "any", "each", "more", "most", "other", "some", "such", "only",
  "own", "same", "too", "very", "just", "also", "into", "about", "over",
  "up", "out", "one", "two", "because", "while", "through", "during",
]);

function repetitionSignal(t: TokenizedText): Signal {
  const content = t.words
    .map((w) => w.toLowerCase())
    .filter((w) => w.length > 3 && !STOPWORDS.has(w));

  if (content.length < 80) {
    return {
      id: "repetition",
      label: "Vocabulary variety",
      score: 0,
      weight: 0,
      detail: "Needs at least 80 content words to measure.",
      evidence: [],
    };
  }

  // Moving-average type-token ratio over a 50-word window is length-stable.
  const window = 50;
  const ratios: number[] = [];
  for (let i = 0; i + window <= content.length; i += 10) {
    const slice = content.slice(i, i + window);
    ratios.push(new Set(slice).size / window);
  }
  const mattr = mean(ratios);

  // Very high MATTR with very low variance across windows reads as generated.
  const consistency = ratios.length > 2 ? stdev(ratios) : 0.1;
  const uniformityScore = scoreBetween(consistency, 0.09, 0.02);
  const diversityScore = scoreBetween(mattr, 0.78, 0.92);
  const score = clamp100(uniformityScore * 0.6 + diversityScore * 0.4);

  return {
    id: "repetition",
    label: "Vocabulary variety",
    score,
    weight: 0.9,
    detail: `Type-token ratio of ${(mattr * 100).toFixed(0)}% varying by only ${(
      consistency * 100
    ).toFixed(1)} points between passages. Human writing is lumpier.`,
    evidence: [],
  };
}

export interface PatternReport {
  /** 0-100 composite. Higher means more machine-like patterning. */
  score: number;
  /** Bucketed reading of the composite. */
  band: "human-like" | "mixed" | "machine-like";
  signals: Signal[];
}

export function bandFor(score: number): PatternReport["band"] {
  if (score < 34) return "human-like";
  if (score < 62) return "mixed";
  return "machine-like";
}

export function computeSignals(t: TokenizedText): PatternReport {
  const signals = [
    burstinessSignal(t),
    lexiconSignal(t),
    punctuationSignal(t),
    openerSignal(t),
    parallelismSignal(t),
    contractionSignal(t),
    paragraphUniformitySignal(t),
    passiveSignal(t),
    repetitionSignal(t),
  ];

  const active = signals.filter((s) => s.weight > 0);
  const totalWeight = active.reduce((acc, s) => acc + s.weight, 0);

  // Weighted quadratic mean rather than a plain average. A passage can be
  // loudly machine-like on three dimensions and clean on four; averaging would
  // dilute the real evidence to nothing. Squaring lets strong signals dominate
  // while still being an identity on uniform input (all 50s still score 50).
  const energy = active.reduce((acc, s) => acc + s.weight * s.score ** 2, 0);
  const score = totalWeight === 0 ? 0 : clamp100(Math.sqrt(energy / totalWeight));

  return {
    score,
    band: bandFor(score),
    signals: signals.sort((a, b) => b.score * b.weight - a.score * a.weight),
  };
}

export type { LexiconEntry };

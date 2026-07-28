import { type ReadabilityScores, computeReadability, findGradeOutliers } from "./readability";
import { type PatternReport, computeSignals } from "./signals";
import { latinRatio, tokenize } from "./tokenize";

export interface TextAnalysis {
  wordCount: number;
  sentenceCount: number;
  paragraphCount: number;
  readability: ReadabilityScores;
  patterns: PatternReport;
  /** Sentences sitting well above the requested grade level. */
  outliers: ReturnType<typeof findGradeOutliers>;
  /**
   * Set when the text is mostly not Latin script. Every readability formula
   * here counts English syllables, and the phrase lexicon is English, so the
   * numbers stop meaning anything — better to say so than to report a
   * confident grade for Russian or Japanese prose.
   */
  languageNote?: string;
}

/** Below this share of Latin letters, the English-calibrated metrics don't apply. */
const LATIN_THRESHOLD = 0.65;

/**
 * Full deterministic analysis of a passage. Pure and side-effect free, so it
 * runs identically in the browser (live preview) and on the server (grading
 * the model's rewrite before returning it).
 */
export function analyzeText(text: string, targetGrade = 8): TextAnalysis {
  const t = tokenize(text);
  const latin = latinRatio(t.raw);

  return {
    wordCount: t.words.length,
    sentenceCount: t.sentences.length,
    paragraphCount: t.paragraphs.length,
    readability: computeReadability(t),
    patterns: computeSignals(t),
    outliers: findGradeOutliers(t, targetGrade),
    languageNote:
      t.words.length > 0 && latin < LATIN_THRESHOLD
        ? "This text is mostly outside the Latin alphabet. The reading-grade formulas and the flagged-phrase list are calibrated for English, so those numbers don't apply here. Word and sentence counts are still accurate."
        : undefined,
  };
}

export { bandFor } from "./signals";
export { gradeLabel } from "./readability";
export type { PatternReport, Signal, SignalEvidence } from "./signals";
export type { ReadabilityScores, SentenceOutlier } from "./readability";

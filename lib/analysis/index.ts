import { type ReadabilityScores, computeReadability, findGradeOutliers } from "./readability";
import { type PatternReport, computeSignals } from "./signals";
import { tokenize } from "./tokenize";

export interface TextAnalysis {
  wordCount: number;
  sentenceCount: number;
  paragraphCount: number;
  readability: ReadabilityScores;
  patterns: PatternReport;
  /** Sentences sitting well above the requested grade level. */
  outliers: ReturnType<typeof findGradeOutliers>;
}

/**
 * Full deterministic analysis of a passage. Pure and side-effect free, so it
 * runs identically in the browser (live preview) and on the server (grading
 * the model's rewrite before returning it).
 */
export function analyzeText(text: string, targetGrade = 8): TextAnalysis {
  const t = tokenize(text);

  return {
    wordCount: t.words.length,
    sentenceCount: t.sentences.length,
    paragraphCount: t.paragraphs.length,
    readability: computeReadability(t),
    patterns: computeSignals(t),
    outliers: findGradeOutliers(t, targetGrade),
  };
}

export { bandFor } from "./signals";
export { gradeLabel } from "./readability";
export type { PatternReport, Signal, SignalEvidence } from "./signals";
export type { ReadabilityScores, SentenceOutlier } from "./readability";

import {
  type TokenizedText,
  countSyllables,
  mean,
  sentenceLengths,
  splitWords,
} from "./tokenize";

export interface ReadabilityScores {
  /** Flesch-Kincaid Grade Level — the number the grade selector targets. */
  fleschKincaidGrade: number;
  /** Flesch Reading Ease, 0-100, higher is easier. */
  fleschReadingEase: number;
  /** Gunning Fog index. */
  gunningFog: number;
  /** SMOG grade, stable on shorter passages than Fog. */
  smog: number;
  /** Automated Readability Index (character based, so it cross-checks syllables). */
  automatedReadability: number;
  /** Mean of the four grade-level formulas — what the UI shows as "grade". */
  consensusGrade: number;
  avgSentenceLength: number;
  avgSyllablesPerWord: number;
  avgWordLength: number;
}

function round(value: number, places = 1): number {
  const f = 10 ** places;
  return Math.round(value * f) / f;
}

/**
 * Ceiling on reported grade level.
 *
 * The formulas are unbounded: a single 600-word run-on sentence yields a
 * Flesch-Kincaid grade of 230, which is arithmetically correct and completely
 * meaningless — the formulas were never calibrated up there. Capping keeps the
 * UI readable while still reading as "far past graduate".
 */
const MAX_REPORTED_GRADE = 30;

function grade(value: number): number {
  return round(Math.min(MAX_REPORTED_GRADE, Math.max(0, value)));
}

export function computeReadability(t: TokenizedText): ReadabilityScores {
  const wordCount = t.words.length;
  const lengths = sentenceLengths(t.sentences);
  const sentenceCount = Math.max(1, lengths.length);

  if (wordCount === 0) {
    return {
      fleschKincaidGrade: 0,
      fleschReadingEase: 0,
      gunningFog: 0,
      smog: 0,
      automatedReadability: 0,
      consensusGrade: 0,
      avgSentenceLength: 0,
      avgSyllablesPerWord: 0,
      avgWordLength: 0,
    };
  }

  const wordsPerSentence = wordCount / sentenceCount;
  const syllablesPerWord = t.syllables / wordCount;
  const charsPerWord = t.characters / wordCount;
  const complexRatio = t.complexWords / wordCount;

  const fleschKincaidGrade = 0.39 * wordsPerSentence + 11.8 * syllablesPerWord - 15.59;
  const fleschReadingEase = 206.835 - 1.015 * wordsPerSentence - 84.6 * syllablesPerWord;
  const gunningFog = 0.4 * (wordsPerSentence + 100 * complexRatio);

  // SMOG is defined on 30 sentences; scale the polysyllable count to that basis.
  const polysyllables = t.complexWords;
  const smog =
    1.0430 * Math.sqrt(polysyllables * (30 / sentenceCount)) + 3.1291;

  const automatedReadability = 4.71 * charsPerWord + 0.5 * wordsPerSentence - 21.43;

  const gradeFormulas = [fleschKincaidGrade, gunningFog, smog, automatedReadability].map(grade);

  return {
    fleschKincaidGrade: grade(fleschKincaidGrade),
    fleschReadingEase: round(Math.min(100, Math.max(0, fleschReadingEase))),
    gunningFog: grade(gunningFog),
    smog: grade(smog),
    automatedReadability: grade(automatedReadability),
    consensusGrade: round(mean(gradeFormulas)),
    avgSentenceLength: round(wordsPerSentence),
    avgSyllablesPerWord: round(syllablesPerWord, 2),
    avgWordLength: round(charsPerWord, 2),
  };
}

/** Human-friendly label for a Flesch-Kincaid style grade number. */
export function gradeLabel(grade: number): string {
  if (grade < 1) return "Kindergarten";
  if (grade <= 12) {
    const n = Math.round(grade);
    const suffix = n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th";
    return `${n}${suffix} grade`;
  }
  if (grade <= 16) return "College";
  return "Graduate";
}

/**
 * Sentences whose individual grade level sits far above the target — the
 * editor surfaces these as the concrete things to simplify.
 */
export interface SentenceOutlier {
  sentence: string;
  index: number;
  words: number;
  grade: number;
}

export function findGradeOutliers(
  t: TokenizedText,
  targetGrade: number,
  limit = 5,
): SentenceOutlier[] {
  const outliers: SentenceOutlier[] = [];

  t.sentences.forEach((sentence, index) => {
    const words = splitWords(sentence);
    if (words.length < 5) return;

    let syllables = 0;
    for (const w of words) {
      syllables += countSyllables(w);
    }
    const sentenceGrade = 0.39 * words.length + 11.8 * (syllables / words.length) - 15.59;

    if (sentenceGrade > targetGrade + 2.5) {
      outliers.push({
        sentence,
        index,
        words: words.length,
        grade: grade(sentenceGrade),
      });
    }
  });

  return outliers.sort((a, b) => b.grade - a.grade).slice(0, limit);
}

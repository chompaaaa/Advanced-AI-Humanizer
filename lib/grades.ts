/**
 * Reading-level profiles. Each one drives both the rewrite instructions sent
 * to the model and the pass/fail check the server runs on the result.
 */

export interface GradeProfile {
  id: string;
  label: string;
  short: string;
  /** Flesch-Kincaid grade the rewrite aims for. */
  targetGrade: number;
  /** Acceptable +/- band before the server triggers a corrective pass. */
  tolerance: number;
  /** Average words per sentence to aim for. */
  sentenceWords: [min: number, max: number];
  /** Hard ceiling — any sentence longer than this gets split. */
  maxSentenceWords: number;
  /** Vocabulary guidance handed to the model verbatim. */
  vocabulary: string;
  /** Syntax guidance handed to the model verbatim. */
  syntax: string;
  /** Shown under the selector in the UI. */
  description: string;
}

export const GRADE_PROFILES: GradeProfile[] = [
  {
    id: "grade-5",
    label: "5th grade",
    short: "G5",
    targetGrade: 5,
    tolerance: 1.2,
    sentenceWords: [8, 13],
    maxSentenceWords: 20,
    vocabulary:
      "Everyday words a 10-year-old uses. One- and two-syllable words almost exclusively. Replace any abstract noun with a concrete thing or action.",
    syntax:
      "Simple sentences. One idea each. Almost no subordinate clauses. No semicolons.",
    description: "Very short sentences, plain words, one idea at a time.",
  },
  {
    id: "grade-6",
    label: "6th grade",
    short: "G6",
    targetGrade: 6,
    tolerance: 1.2,
    sentenceWords: [10, 15],
    maxSentenceWords: 22,
    vocabulary:
      "Common everyday words. Explain any term a sixth grader wouldn't already know in the same sentence.",
    syntax:
      "Mostly simple sentences with occasional 'and'/'but' joins. Rare subordinate clauses.",
    description: "Plain and direct, with a little more sentence variety.",
  },
  {
    id: "grade-7",
    label: "7th grade",
    short: "G7",
    targetGrade: 7,
    tolerance: 1.3,
    sentenceWords: [11, 17],
    maxSentenceWords: 25,
    vocabulary:
      "Everyday words plus subject terms that a middle schooler meets in class. Define anything more technical.",
    syntax:
      "Mix simple and compound sentences. Occasional short subordinate clause. Semicolons only if genuinely needed.",
    description: "Middle-school reading with a natural mix of sentence shapes.",
  },
  {
    id: "grade-8",
    label: "8th grade",
    short: "G8",
    targetGrade: 8,
    tolerance: 1.3,
    sentenceWords: [12, 18],
    maxSentenceWords: 27,
    vocabulary:
      "Everyday words with some subject vocabulary. Prefer the shorter of two words that mean the same thing.",
    syntax:
      "Compound and lightly complex sentences. Vary openings. Keep clause stacking to two levels.",
    description: "The default for general writing — clear but not childish.",
  },
  {
    id: "grade-9",
    label: "9th grade",
    short: "G9",
    targetGrade: 9,
    tolerance: 1.4,
    sentenceWords: [13, 19],
    maxSentenceWords: 30,
    vocabulary:
      "Comfortable general vocabulary. Subject-specific terms are fine when the surrounding sentence makes them clear.",
    syntax:
      "Complex sentences allowed, but only one subordinate idea at a time. Occasional deliberate short sentence for emphasis.",
    description: "Early high school — fuller sentences, still very readable.",
  },
  {
    id: "grade-10",
    label: "10th grade",
    short: "G10",
    targetGrade: 10,
    tolerance: 1.4,
    sentenceWords: [14, 21],
    maxSentenceWords: 32,
    vocabulary:
      "General vocabulary with precise word choice. Abstract nouns are fine when they carry real meaning.",
    syntax:
      "Complex and compound-complex sentences, balanced against short ones so the rhythm still swings.",
    description: "High school — more nuance and longer arguments.",
  },
  {
    id: "grade-11",
    label: "11th grade",
    short: "G11",
    targetGrade: 11,
    tolerance: 1.5,
    sentenceWords: [15, 22],
    maxSentenceWords: 34,
    vocabulary:
      "Precise, sometimes formal vocabulary. Technical terms used naturally without stopping to define them.",
    syntax:
      "Varied complex syntax. Subordination, apposition and parenthetical asides are all available.",
    description: "Upper high school — analytical and fairly formal.",
  },
  {
    id: "grade-12",
    label: "12th grade",
    short: "G12",
    targetGrade: 12,
    tolerance: 1.5,
    sentenceWords: [16, 23],
    maxSentenceWords: 36,
    vocabulary:
      "Mature vocabulary. Choose the exact word rather than the simple one when precision matters.",
    syntax:
      "Full range of English syntax, still with deliberate rhythm changes so it doesn't drone.",
    description: "Senior year — confident, precise, still accessible.",
  },
  {
    id: "college",
    label: "College",
    short: "COL",
    targetGrade: 14,
    tolerance: 1.8,
    sentenceWords: [17, 25],
    maxSentenceWords: 40,
    vocabulary:
      "Academic register. Discipline vocabulary used without hedging. Avoid padding words that add no content.",
    syntax:
      "Sophisticated syntax with embedded clauses, but every sentence still resolves cleanly on one read.",
    description: "Undergraduate essay register.",
  },
  {
    id: "graduate",
    label: "Graduate",
    short: "GRAD",
    targetGrade: 17,
    tolerance: 2.2,
    sentenceWords: [18, 28],
    maxSentenceWords: 45,
    vocabulary:
      "Specialist vocabulary assumed. Dense noun phrases acceptable where they compress real meaning rather than decorate.",
    syntax:
      "Dense, tightly-argued syntax. Long sentences must earn their length by carrying a complete argument step.",
    description: "Graduate and professional writing.",
  },
];

export const DEFAULT_GRADE_ID = "grade-8";

export function getGradeProfile(id: string): GradeProfile {
  return GRADE_PROFILES.find((g) => g.id === id) ?? GRADE_PROFILES[3];
}

/* ------------------------------------------------------------------ */
/* Tone                                                               */
/* ------------------------------------------------------------------ */

export interface TonePreset {
  id: string;
  label: string;
  instruction: string;
}

export const TONE_PRESETS: TonePreset[] = [
  {
    id: "neutral",
    label: "Neutral",
    instruction:
      "Even, unshowy voice. State things plainly without selling them. No exclamation points.",
  },
  {
    id: "conversational",
    label: "Conversational",
    instruction:
      "Write like you're explaining it to someone across a table. Contractions throughout. Direct address ('you') is fine. Occasional sentence fragment for emphasis.",
  },
  {
    id: "academic",
    label: "Academic",
    instruction:
      "Measured, evidence-first voice. Third person. Claims are qualified where the evidence is thin. No rhetorical questions.",
  },
  {
    id: "persuasive",
    label: "Persuasive",
    instruction:
      "Take a clear position and argue it. Lead with the strongest point. Concede the real counterargument once, then answer it.",
  },
  {
    id: "narrative",
    label: "Narrative",
    instruction:
      "Move through the material as a sequence with a sense of time and consequence. Concrete detail over abstract summary.",
  },
  {
    id: "professional",
    label: "Professional",
    instruction:
      "Workplace-appropriate and efficient. Lead with the conclusion. No filler openings, no throat-clearing.",
  },
];

export function getTonePreset(id: string): TonePreset {
  return TONE_PRESETS.find((t) => t.id === id) ?? TONE_PRESETS[0];
}

/* ------------------------------------------------------------------ */
/* Rewrite strength                                                   */
/* ------------------------------------------------------------------ */

export interface IntensityPreset {
  id: string;
  label: string;
  instruction: string;
  description: string;
}

export const INTENSITY_PRESETS: IntensityPreset[] = [
  {
    id: "light",
    label: "Light",
    description: "Fixes the loudest tells, keeps most sentences intact.",
    instruction:
      "Make the smallest set of changes that removes the flagged patterns. Keep sentence order and most sentence boundaries as they are. Roughly 70% of the original wording should survive.",
  },
  {
    id: "balanced",
    label: "Balanced",
    description: "Rewrites sentence by sentence, keeps the structure.",
    instruction:
      "Rewrite sentence by sentence. Merge and split sentences freely to fix rhythm, but keep the paragraph structure and the order of ideas.",
  },
  {
    id: "deep",
    label: "Deep",
    description: "Rebuilds paragraphs from the ideas up.",
    instruction:
      "Rebuild each paragraph from its underlying ideas rather than editing the existing sentences. You may reorder sentences within a paragraph and change how ideas are grouped, as long as every fact and claim survives and the paragraph count stays the same.",
  },
];

export function getIntensityPreset(id: string): IntensityPreset {
  return INTENSITY_PRESETS.find((i) => i.id === id) ?? INTENSITY_PRESETS[1];
}

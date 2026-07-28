/**
 * Phrase and word inventories used by the pattern detectors.
 *
 * These are patterns that show up at unusually high rates in unedited
 * assistant output across Claude, GPT, Gemini and Grok. None of them are wrong
 * on their own — plenty of human writers use "however" — so every detector
 * scores by *density*, never by presence.
 */

export interface LexiconEntry {
  /** Matched case-insensitively as a whole phrase. */
  phrase: string;
  /** Relative contribution. Distinctive phrases weigh more than common ones. */
  weight: number;
  category: "vocabulary" | "framing" | "transition" | "hedge" | "closer";
  /** Shown in the UI as the suggested human alternative. */
  suggestion?: string;
}

export const AI_PHRASES: LexiconEntry[] = [
  // Vocabulary that is rare in human prose but common in model output.
  { phrase: "delve into", weight: 3, category: "vocabulary", suggestion: "look at, dig into" },
  { phrase: "delve", weight: 2.5, category: "vocabulary", suggestion: "explore" },
  { phrase: "tapestry", weight: 3, category: "vocabulary", suggestion: "mix, range" },
  { phrase: "a testament to", weight: 2.5, category: "framing", suggestion: "shows" },
  { phrase: "underscores", weight: 2, category: "vocabulary", suggestion: "shows, points to" },
  { phrase: "underscore", weight: 2, category: "vocabulary", suggestion: "highlight" },
  { phrase: "pivotal", weight: 2, category: "vocabulary", suggestion: "key, central" },
  { phrase: "realm of", weight: 2.5, category: "vocabulary", suggestion: "area of, field of" },
  { phrase: "landscape of", weight: 2.5, category: "vocabulary", suggestion: "state of" },
  { phrase: "multifaceted", weight: 2.5, category: "vocabulary", suggestion: "complex" },
  { phrase: "myriad", weight: 2, category: "vocabulary", suggestion: "many" },
  { phrase: "plethora", weight: 2.5, category: "vocabulary", suggestion: "lots of" },
  { phrase: "meticulous", weight: 2, category: "vocabulary", suggestion: "careful" },
  { phrase: "meticulously", weight: 2, category: "vocabulary", suggestion: "carefully" },
  { phrase: "intricate", weight: 1.5, category: "vocabulary", suggestion: "detailed" },
  { phrase: "cornerstone", weight: 2, category: "vocabulary", suggestion: "basis" },
  { phrase: "beacon", weight: 2.5, category: "vocabulary" },
  { phrase: "embark", weight: 2, category: "vocabulary", suggestion: "start" },
  { phrase: "harness the power", weight: 3, category: "framing", suggestion: "use" },
  { phrase: "harness", weight: 1.5, category: "vocabulary", suggestion: "use" },
  { phrase: "leverage", weight: 1.5, category: "vocabulary", suggestion: "use" },
  { phrase: "elevate", weight: 1.5, category: "vocabulary", suggestion: "improve" },
  { phrase: "resonate", weight: 1.5, category: "vocabulary", suggestion: "connect" },
  { phrase: "seamless", weight: 2, category: "vocabulary", suggestion: "smooth" },
  { phrase: "seamlessly", weight: 2, category: "vocabulary", suggestion: "smoothly" },
  { phrase: "robust", weight: 1.5, category: "vocabulary", suggestion: "strong, solid" },
  { phrase: "unprecedented", weight: 1.5, category: "vocabulary", suggestion: "new" },
  { phrase: "commendable", weight: 2, category: "vocabulary", suggestion: "good" },
  { phrase: "profound", weight: 1.5, category: "vocabulary", suggestion: "deep, big" },
  { phrase: "paradigm", weight: 2, category: "vocabulary", suggestion: "model, approach" },
  { phrase: "holistic", weight: 2, category: "vocabulary", suggestion: "whole, overall" },
  { phrase: "nuanced", weight: 1.5, category: "vocabulary", suggestion: "subtle" },
  { phrase: "invaluable", weight: 1.5, category: "vocabulary", suggestion: "very useful" },
  { phrase: "vibrant", weight: 1.5, category: "vocabulary", suggestion: "lively" },
  { phrase: "fostering", weight: 1.5, category: "vocabulary", suggestion: "building" },
  { phrase: "foster", weight: 1.5, category: "vocabulary", suggestion: "build, support" },
  { phrase: "garner", weight: 2, category: "vocabulary", suggestion: "get, collect" },
  { phrase: "bolster", weight: 2, category: "vocabulary", suggestion: "support, boost" },

  // Stock framings.
  { phrase: "in today's fast-paced world", weight: 4, category: "framing" },
  { phrase: "in today's world", weight: 3, category: "framing" },
  { phrase: "in the modern era", weight: 3, category: "framing" },
  { phrase: "in an era where", weight: 3, category: "framing" },
  { phrase: "it's important to note", weight: 3, category: "hedge", suggestion: "cut it" },
  { phrase: "it is important to note", weight: 3, category: "hedge", suggestion: "cut it" },
  { phrase: "it's worth noting", weight: 2.5, category: "hedge", suggestion: "cut it" },
  { phrase: "it is worth noting", weight: 2.5, category: "hedge", suggestion: "cut it" },
  { phrase: "it should be noted", weight: 2.5, category: "hedge", suggestion: "cut it" },
  { phrase: "navigate the complexities", weight: 4, category: "framing" },
  { phrase: "navigating the", weight: 2, category: "framing", suggestion: "dealing with" },
  { phrase: "when it comes to", weight: 2, category: "framing", suggestion: "for, with" },
  { phrase: "at its core", weight: 2, category: "framing", suggestion: "basically" },
  { phrase: "the world of", weight: 1.5, category: "framing" },
  { phrase: "plays a crucial role", weight: 3, category: "framing", suggestion: "matters" },
  { phrase: "plays a vital role", weight: 3, category: "framing", suggestion: "matters" },
  { phrase: "plays a significant role", weight: 3, category: "framing" },
  { phrase: "serves as a", weight: 2, category: "framing", suggestion: "is" },
  { phrase: "stands as a", weight: 2.5, category: "framing", suggestion: "is" },
  { phrase: "sheds light on", weight: 2.5, category: "framing", suggestion: "explains" },
  { phrase: "paves the way", weight: 2.5, category: "framing", suggestion: "leads to" },
  { phrase: "opens the door", weight: 2, category: "framing", suggestion: "allows" },
  { phrase: "a game changer", weight: 2.5, category: "framing" },
  { phrase: "the key takeaway", weight: 2, category: "closer" },
  { phrase: "dive deeper", weight: 2, category: "framing", suggestion: "look closer" },
  { phrase: "let's explore", weight: 2, category: "framing" },
  { phrase: "we will explore", weight: 2, category: "framing" },
  { phrase: "this article will", weight: 2, category: "framing" },

  // Transitions models over-produce.
  { phrase: "moreover", weight: 2, category: "transition", suggestion: "also, and" },
  { phrase: "furthermore", weight: 2, category: "transition", suggestion: "also" },
  { phrase: "additionally", weight: 1.5, category: "transition", suggestion: "also" },
  { phrase: "consequently", weight: 1.5, category: "transition", suggestion: "so" },
  { phrase: "subsequently", weight: 1.5, category: "transition", suggestion: "then" },
  { phrase: "nevertheless", weight: 1.5, category: "transition", suggestion: "still" },
  { phrase: "nonetheless", weight: 1.5, category: "transition", suggestion: "still" },
  { phrase: "in essence", weight: 2, category: "transition", suggestion: "basically" },
  { phrase: "notably", weight: 1.5, category: "transition" },
  { phrase: "arguably", weight: 1.5, category: "hedge" },

  // Closers.
  { phrase: "in conclusion", weight: 3, category: "closer", suggestion: "just end it" },
  { phrase: "to sum up", weight: 2, category: "closer" },
  { phrase: "in summary", weight: 2, category: "closer" },
  { phrase: "ultimately", weight: 1.5, category: "closer", suggestion: "in the end" },
  { phrase: "overall", weight: 1, category: "closer" },
  { phrase: "all in all", weight: 2, category: "closer" },
  { phrase: "at the end of the day", weight: 2, category: "closer" },
];

/** Sentence-initial transitions. High density reads as templated structure. */
export const STOCK_OPENERS = [
  "moreover",
  "furthermore",
  "additionally",
  "however",
  "therefore",
  "thus",
  "consequently",
  "subsequently",
  "nevertheless",
  "nonetheless",
  "in conclusion",
  "in summary",
  "overall",
  "ultimately",
  "firstly",
  "secondly",
  "thirdly",
  "finally",
  "in addition",
  "on the other hand",
  "as a result",
  "for instance",
  "for example",
  "notably",
  "importantly",
  "indeed",
];

/** Irregular past participles for the passive-voice detector. */
export const IRREGULAR_PARTICIPLES = new Set([
  "been", "born", "beaten", "become", "begun", "bent", "bound", "bitten", "blown",
  "broken", "brought", "built", "burnt", "bought", "caught", "chosen", "come",
  "cost", "cut", "dealt", "done", "drawn", "driven", "drunk", "eaten", "fallen",
  "fed", "felt", "fought", "found", "flown", "forgotten", "frozen", "given",
  "gone", "grown", "hung", "had", "heard", "hidden", "hit", "held", "hurt",
  "kept", "known", "laid", "led", "left", "lent", "let", "lain", "lost", "made",
  "meant", "met", "paid", "put", "read", "ridden", "rung", "risen", "run",
  "said", "seen", "sold", "sent", "set", "shaken", "shone", "shot", "shown",
  "shut", "sung", "sunk", "sat", "slept", "slid", "sown", "spoken", "spent",
  "spun", "split", "spread", "stood", "stolen", "stuck", "struck", "sworn",
  "swept", "swum", "taken", "taught", "torn", "told", "thought", "thrown",
  "understood", "woken", "worn", "won", "written",
]);

export const CONTRACTIONS =
  /\b(?:[a-z]+['’](?:s|t|re|ve|ll|d|m)|can['’]t|won['’]t|shan['’]t|ain['’]t)\b/gi;

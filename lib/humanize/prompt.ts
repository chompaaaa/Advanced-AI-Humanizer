import type { TextAnalysis } from "@/lib/analysis";
import {
  type GradeProfile,
  type IntensityPreset,
  type TonePreset,
} from "@/lib/grades";

export interface RewriteOptions {
  grade: GradeProfile;
  tone: TonePreset;
  intensity: IntensityPreset;
  /** Keep markdown headings, lists and emphasis exactly as they are. */
  preserveFormatting: boolean;
  /** Extra user-supplied direction, appended verbatim. */
  customInstructions?: string;
}

/**
 * Techniques that actually move the burstiness and lexicon metrics. These are
 * phrased as concrete editing operations rather than adjectives, because
 * "write more naturally" produces nothing measurable.
 */
const TECHNIQUE_BLOCK = `## How human prose differs, concretely

1. **Length swings.** Real writers follow a 30-word sentence with a 5-word one. Aim for a spread where the shortest sentence in each paragraph is under half the length of the longest. Never let three consecutive sentences land within a few words of each other.

2. **Varied openings.** Consecutive sentences should not all start with the subject. Rotate: start with a subject, then a prepositional phrase, then a subordinate clause, then a short subject again. Do not open sentences with "Moreover", "Furthermore", "Additionally", "Consequently", or "Ultimately".

3. **Concrete over abstract.** Replace abstract nouns with the thing they stand for. "Implementation challenges arose" becomes "the install kept failing".

4. **Commit to claims.** Delete hedges that carry no content: "it is important to note that", "it is worth mentioning", "arguably", "in many ways". If a claim needs qualifying, qualify it with the actual reason.

5. **Uneven emphasis.** Human writing spends three sentences on the point that matters and half a sentence on the one that doesn't. Do not give every idea equal airtime.

6. **Break the rule of three.** Two-item and four-item lists are more common in human writing than three-item ones. If the source has several "X, Y, and Z" triples, convert most of them.

7. **Plain punctuation.** No em dashes. Use a comma, a period, or parentheses instead. Semicolons only where a comma would genuinely mislead. Straight quotes and apostrophes only.

8. **Sentences may start with And, But, or So** where the flow calls for it. Fragments are allowed for emphasis, sparingly.`;

const PRESERVATION_BLOCK = `## Non-negotiable

- Every fact, number, date, name, quotation and citation must survive unchanged. Do not add facts that were not in the source. Do not remove any.
- Do not change what the text argues. If the source is wrong about something, it stays wrong.
- Keep the same language as the source.
- Keep the paragraph count the same.
- Stay within 10% of the original word count.
- Output only the rewritten text. No preamble, no explanation, no "Here is the rewritten version", no surrounding code fence, no commentary after.`;

export function buildSystemPrompt(options: RewriteOptions): string {
  const { grade, tone, intensity, preserveFormatting } = options;

  const contractionRule =
    tone.id === "academic"
      ? "Use contractions sparingly, as an academic writer would."
      : "Use contractions throughout, the way a person actually writes.";

  const formattingRule = preserveFormatting
    ? "Preserve markdown structure exactly: headings at the same levels, list items as list items, bold and italic where they were. Rewrite only the prose inside them."
    : "Return plain prose paragraphs separated by blank lines. Do not add markdown formatting.";

  return `You are a line editor. You rewrite drafts so they read like they were written by a person, at a specific reading level, without changing what they say.

## Target: ${grade.label} reading level

- Aim for a Flesch-Kincaid grade of about ${grade.targetGrade}.
- Average sentence length: ${grade.sentenceWords[0]}–${grade.sentenceWords[1]} words. This is an average across the piece, not a target for each sentence — the variation between sentences matters more than the average.
- No sentence longer than ${grade.maxSentenceWords} words.
- Vocabulary: ${grade.vocabulary}
- Syntax: ${grade.syntax}

## Voice: ${tone.label}

${tone.instruction}
${contractionRule}

## Rewrite depth: ${intensity.label}

${intensity.instruction}

${TECHNIQUE_BLOCK}

## Formatting

${formattingRule}

${PRESERVATION_BLOCK}`;
}

/**
 * Turns the deterministic analysis into a short, specific brief. Naming the
 * measured problems produces a far better rewrite than generic instructions.
 */
function buildFindingsBrief(analysis: TextAnalysis, grade: GradeProfile): string {
  const lines: string[] = [];

  const gradeDelta = analysis.readability.fleschKincaidGrade - grade.targetGrade;
  if (Math.abs(gradeDelta) > grade.tolerance) {
    lines.push(
      gradeDelta > 0
        ? `- Reading level is ${analysis.readability.fleschKincaidGrade.toFixed(1)}, about ${gradeDelta.toFixed(1)} grades too high. Shorten sentences and swap in plainer words.`
        : `- Reading level is ${analysis.readability.fleschKincaidGrade.toFixed(1)}, about ${Math.abs(gradeDelta).toFixed(1)} grades too low. Combine some short sentences and use more precise vocabulary.`,
    );
  }

  for (const signal of analysis.patterns.signals) {
    if (signal.weight === 0 || signal.score < 45) continue;

    switch (signal.id) {
      case "burstiness":
        lines.push(
          `- Sentence lengths are too uniform (${signal.detail.toLowerCase()}). Deliberately mix very short and long sentences.`,
        );
        break;
      case "lexicon": {
        const words = signal.evidence.slice(0, 10).map((e) => `"${e.text}"`).join(", ");
        if (words) lines.push(`- Replace these flagged phrases: ${words}.`);
        break;
      }
      case "punctuation": {
        const em = signal.evidence.find((e) => e.text.startsWith("em dash"));
        const semi = signal.evidence.find((e) => e.text.startsWith("semicolon"));
        const parts: string[] = [];
        if (em) parts.push(`${em.count} em dashes`);
        if (semi) parts.push(`${semi.count} semicolons`);
        if (parts.length) {
          lines.push(`- Remove the ${parts.join(" and ")}. Use commas, periods or parentheses.`);
        }
        break;
      }
      case "openers": {
        const openers = signal.evidence.map((e) => `"${e.text}"`).join(", ");
        lines.push(
          `- Too many sentences open with stock transitions${openers ? ` (${openers})` : ""}. Vary the openings.`,
        );
        break;
      }
      case "parallelism":
        lines.push(
          `- Break up the repeated parallel constructions (${signal.evidence
            .map((e) => e.text)
            .join(", ")}).`,
        );
        break;
      case "contractions":
        lines.push("- Almost no contractions. Add them where the voice allows.");
        break;
      case "paragraph-uniformity":
        lines.push("- Paragraphs are all the same length. Let some run long and some run short.");
        break;
      case "passive":
        lines.push("- Heavy passive voice. Name who is doing the action.");
        break;
      default:
        break;
    }
  }

  if (analysis.outliers.length > 0) {
    const list = analysis.outliers
      .slice(0, 3)
      .map((o) => `  - (grade ${o.grade}, ${o.words} words) "${truncate(o.sentence, 110)}"`)
      .join("\n");
    lines.push(`- These sentences are well above the target level and need simplifying:\n${list}`);
  }

  if (lines.length === 0) {
    return "The analyzer found no major issues. Rewrite for voice and rhythm while holding the reading level steady.";
  }

  return lines.join("\n");
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

export function buildUserPrompt(
  text: string,
  analysis: TextAnalysis,
  options: RewriteOptions,
): string {
  const brief = buildFindingsBrief(analysis, options.grade);
  const custom = options.customInstructions?.trim();

  return `An automated analyzer scanned the draft below. Its findings:

${brief}

${custom ? `Additional direction from the writer:\n${custom}\n\n` : ""}Rewrite the draft to a ${options.grade.label} reading level, fixing everything above. Output only the rewritten text.

<draft>
${text}
</draft>`;
}

/**
 * Follow-up prompt used when the first rewrite lands outside the grade band.
 * Correcting an existing draft converges faster than rewriting from scratch.
 */
export function buildCorrectionPrompt(
  rewritten: string,
  measuredGrade: number,
  grade: GradeProfile,
): string {
  const delta = measuredGrade - grade.targetGrade;
  const direction =
    delta > 0
      ? `too advanced by ${delta.toFixed(1)} grades. Shorten the longest sentences and replace multi-syllable words with plainer ones.`
      : `too simple by ${Math.abs(delta).toFixed(1)} grades. Combine some of the shortest sentences and use more precise vocabulary.`;

  return `That rewrite measured at a Flesch-Kincaid grade of ${measuredGrade.toFixed(
    1,
  )}. The target is ${grade.targetGrade}, so it is ${direction}

Keep everything else: same facts, same paragraph count, same voice, same varied sentence rhythm. Do not reintroduce em dashes, stock transitions or the flagged vocabulary. Output only the corrected text.

<text>
${rewritten}
</text>`;
}

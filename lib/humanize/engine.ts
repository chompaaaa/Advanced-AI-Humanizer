import Anthropic from "@anthropic-ai/sdk";

import { type TextAnalysis, analyzeText } from "@/lib/analysis";
import {
  type GradeProfile,
  getGradeProfile,
  getIntensityPreset,
  getTonePreset,
} from "@/lib/grades";
import { postProcess } from "./postprocess";
import {
  type RewriteOptions,
  buildCorrectionPrompt,
  buildSystemPrompt,
  buildUserPrompt,
} from "./prompt";

export const MODEL = "claude-opus-5";

/** Ceiling on rewrite length. Streaming keeps this safe from HTTP timeouts. */
const MAX_TOKENS = 32_000;

/** Requests over this many words are rejected before hitting the API. */
export const MAX_INPUT_WORDS = 4_000;

export interface HumanizeRequest {
  text: string;
  gradeId: string;
  toneId: string;
  intensityId: string;
  preserveFormatting: boolean;
  customInstructions?: string;
  /** Run a second corrective pass if the first lands outside the grade band. */
  autoCorrect: boolean;
}

/**
 * The single call into the model, isolated so tests can drive the whole
 * pipeline (analyze → prompt → clean up → re-score → correct) without network.
 */
export type ModelCall = (system: string, userPrompt: string) => Promise<string>;

export interface HumanizeResult {
  output: string;
  before: TextAnalysis;
  after: TextAnalysis;
  /** Deterministic cleanup operations applied to the model output. */
  cleanup: string[];
  /** How many model calls were made (1, or 2 when a correction ran). */
  passes: number;
  /** Set when a correction pass ran, describing why. */
  correctionReason?: string;
}

function resolveOptions(req: HumanizeRequest): RewriteOptions {
  return {
    grade: getGradeProfile(req.gradeId),
    tone: getTonePreset(req.toneId),
    intensity: getIntensityPreset(req.intensityId),
    preserveFormatting: req.preserveFormatting,
    customInstructions: req.customInstructions,
  };
}

function createClient(): Anthropic {
  // The SDK resolves ANTHROPIC_API_KEY, ANTHROPIC_AUTH_TOKEN, or a stored
  // `ant auth login` profile on its own — don't second-guess it here.
  return new Anthropic();
}

function anthropicCall(client: Anthropic): ModelCall {
  return async (system, userPrompt) => {
    // Streaming rather than a plain create: rewrites of long passages can run
    // past the SDK's non-streaming HTTP timeout at this max_tokens.
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      messages: [{ role: "user", content: userPrompt }],
    });

    const message = await stream.finalMessage();

    if (message.stop_reason === "refusal") {
      throw new HumanizeError(
        "The model declined this request. Try a different source text.",
        422,
      );
    }

    const text = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();

    if (!text) {
      throw new HumanizeError("The model returned an empty rewrite.", 502);
    }

    return text;
  };
}

export class HumanizeError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "HumanizeError";
    this.status = status;
  }
}

function isWithinBand(analysis: TextAnalysis, grade: GradeProfile): boolean {
  return (
    Math.abs(analysis.readability.fleschKincaidGrade - grade.targetGrade) <= grade.tolerance
  );
}

export async function humanize(
  req: HumanizeRequest,
  callModel?: ModelCall,
): Promise<HumanizeResult> {
  const text = req.text.trim();

  if (!text) {
    throw new HumanizeError("Nothing to rewrite.");
  }

  const options = resolveOptions(req);
  const before = analyzeText(text, options.grade.targetGrade);

  if (before.wordCount > MAX_INPUT_WORDS) {
    throw new HumanizeError(
      `That's ${before.wordCount.toLocaleString()} words. The limit is ${MAX_INPUT_WORDS.toLocaleString()} per run — split it into sections.`,
      413,
    );
  }

  const call = callModel ?? anthropicCall(createClient());
  const system = buildSystemPrompt(options);

  let raw = await call(system, buildUserPrompt(text, before, options));
  let processed = postProcess(raw);
  let after = analyzeText(processed.text, options.grade.targetGrade);
  let passes = 1;
  let correctionReason: string | undefined;

  if (req.autoCorrect && !isWithinBand(after, options.grade)) {
    const measured = after.readability.fleschKincaidGrade;
    correctionReason = `First pass measured grade ${measured.toFixed(1)} against a target of ${options.grade.targetGrade}. Ran a corrective pass.`;

    raw = await call(system, buildCorrectionPrompt(processed.text, measured, options.grade));

    const corrected = postProcess(raw);
    const correctedAnalysis = analyzeText(corrected.text, options.grade.targetGrade);
    passes = 2;

    // Only keep the correction if it actually moved closer to the target.
    const priorDelta = Math.abs(measured - options.grade.targetGrade);
    const newDelta = Math.abs(
      correctedAnalysis.readability.fleschKincaidGrade - options.grade.targetGrade,
    );

    if (newDelta < priorDelta) {
      processed = {
        text: corrected.text,
        // Both passes run the same cleanup, so the same line can appear twice.
        changes: [...new Set([...processed.changes, ...corrected.changes])],
      };
      after = correctedAnalysis;
    } else {
      correctionReason += " The corrected version scored no closer, so the first pass was kept.";
    }
  }

  return {
    output: processed.text,
    before,
    after,
    cleanup: processed.changes,
    passes,
    correctionReason,
  };
}

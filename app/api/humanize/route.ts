import { NextResponse } from "next/server";

import { HumanizeError, type HumanizeRequest, humanize } from "@/lib/humanize/engine";

export const runtime = "nodejs";
/** Rewrites of long passages can take a while; give the route room. */
export const maxDuration = 300;

/** Generous ceiling well above the 4,000-word limit, to bound the payload. */
const MAX_INPUT_CHARS = 120_000;

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  let body: Partial<HumanizeRequest>;

  try {
    body = await request.json();
  } catch {
    return bad("Request body must be JSON.");
  }

  if (typeof body.text !== "string" || !body.text.trim()) {
    return bad("Provide some text to rewrite.");
  }

  // Cheap length guard ahead of the word-count check, so an oversized payload
  // is rejected before it reaches the analyzer. 4,000 words is well under this.
  if (body.text.length > MAX_INPUT_CHARS) {
    return bad(
      `That's ${body.text.length.toLocaleString()} characters, over the ${MAX_INPUT_CHARS.toLocaleString()} limit. Split it into sections.`,
      413,
    );
  }

  const payload: HumanizeRequest = {
    text: body.text,
    gradeId: typeof body.gradeId === "string" ? body.gradeId : "grade-8",
    toneId: typeof body.toneId === "string" ? body.toneId : "neutral",
    intensityId: typeof body.intensityId === "string" ? body.intensityId : "balanced",
    preserveFormatting: body.preserveFormatting !== false,
    customInstructions:
      typeof body.customInstructions === "string"
        ? body.customInstructions.slice(0, 1_000)
        : undefined,
    autoCorrect: body.autoCorrect !== false,
  };

  try {
    const result = await humanize(payload);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof HumanizeError) {
      return bad(error.message, error.status);
    }

    // A missing key throws at request time with no HTTP status attached, so it
    // would otherwise fall through to a generic 500 and send the user to the
    // logs for what is really a one-line setup problem.
    const message = error instanceof Error ? error.message : "";
    if (/could not resolve authentication|apiKey|authToken/i.test(message)) {
      return bad(
        "No Anthropic credentials found. Set ANTHROPIC_API_KEY in .env.local, or run `ant auth login`.",
        401,
      );
    }

    // Surface the SDK's own status codes rather than collapsing everything to 500.
    const status =
      typeof error === "object" && error !== null && "status" in error
        ? Number((error as { status: unknown }).status)
        : NaN;

    if (status === 401) {
      return bad(
        "Anthropic rejected the credentials. Set ANTHROPIC_API_KEY in .env.local.",
        401,
      );
    }
    if (status === 429) {
      return bad("Rate limited by the Anthropic API. Wait a moment and retry.", 429);
    }

    console.error("[humanize] unexpected failure", error);
    return bad("The rewrite failed. Check the server logs.", 500);
  }
}

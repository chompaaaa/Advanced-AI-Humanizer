import { NextResponse } from "next/server";

import { HumanizeError, type HumanizeRequest, humanize } from "@/lib/humanize/engine";

export const runtime = "nodejs";
/** Rewrites of long passages can take a while; give the route room. */
export const maxDuration = 300;

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

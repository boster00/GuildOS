import { NextResponse } from "next/server";

/**
 * Make 24 CCC harness — previously called api.anthropic.com with ANTHROPIC_API_KEY.
 * GuildOS no longer wires Anthropic Console API keys; use Claude Code CLI
 * (`claude auth login --claudeai`) in a terminal for subscription-based Claude.
 */
export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const { action } = body;

  if (action === "runAll") {
    return NextResponse.json(
      {
        error:
          "Anthropic API key flows are disabled in this repo. Run Make 24 / Claude Code from your machine with `claude` (subscription login), or restore a dedicated integration if you add one later.",
        disabled: true,
      },
      { status: 501 }
    );
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

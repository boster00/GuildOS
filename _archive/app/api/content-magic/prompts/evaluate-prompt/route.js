// ARCHIVED: Original path was app/api/content-magic/prompts/evaluate-prompt/route.js

import { NextResponse } from "next/server";

/**
 * This endpoint is deprecated. Prompt evaluation is now provided by the GEO report
 * (ai-optimization-score API). Implement Prompts derives isSufficient (score >= 70)
 * and recommendations from article.assets.GEOReport.rationale.prompts.
 * Use POST /api/content-magic/ai-optimization-score to refresh the GEO report.
 */
export async function POST() {
  return NextResponse.json(
    {
      error: "Deprecated",
      message:
        "Prompt evaluation is now from the GEO report. Use POST /api/content-magic/ai-optimization-score to refresh scores and recommendations.",
    },
    { status: 410 }
  );
}

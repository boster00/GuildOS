import { NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";

/**
 * GET /api/test-production/env
 * Returns { nodeEnv, vercelEnv, isProduction, allowTestProduction, showDevItems } for the test-production page.
 * Auth required. In production, returns 404 unless ALLOW_TEST_PRODUCTION is set (so the page is not a general probe).
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isProduction = process.env.NODE_ENV === "production";
  const allowTestProduction =
    process.env.ALLOW_TEST_PRODUCTION === "true" || process.env.ALLOW_TEST_PRODUCTION === "1";

  if (isProduction && !allowTestProduction) {
    return NextResponse.json(null, { status: 404 });
  }

  const showDevItems =
    process.env.SHOW_DEV_SIDEBAR_ITEMS === "true" && process.env.NODE_ENV === "development";

  return NextResponse.json({
    nodeEnv: process.env.NODE_ENV ?? "development",
    vercelEnv: process.env.VERCEL_ENV ?? null,
    isProduction,
    allowTestProduction: isProduction ? allowTestProduction : true,
    showDevItems,
  });
}

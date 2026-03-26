import { NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/visibility_tracker/test/trigger-cron
 * Server-side calls GET /api/cron/trigger with CRON_SECRET and returns the response.
 * Auth required. Same env guard as test-production.
 */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isProduction = process.env.NODE_ENV === "production";
  const allowTestProduction =
    process.env.ALLOW_TEST_PRODUCTION === "true" ||
    process.env.ALLOW_TEST_PRODUCTION === "1";
  if (isProduction && !allowTestProduction) {
    return NextResponse.json(
      { error: "Not allowed in this environment" },
      { status: 404 }
    );
  }

  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    "http://localhost:3000";
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET not set" },
      { status: 500 }
    );
  }

  try {
    const res = await fetch(`${origin}/api/cron/trigger`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${cronSecret}`,
      },
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(
      { success: res.ok, status: res.status, ...data },
      { status: res.ok ? 200 : res.status }
    );
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e?.message || "Cron trigger failed" },
      { status: 500 }
    );
  }
}

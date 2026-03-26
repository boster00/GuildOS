import { NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";
import { createServiceRoleClient } from "@/libs/supabase/serviceRole";

export const dynamic = "force-dynamic";

/**
 * POST /api/test-production/set-reset-minutes
 * Body: { minutes: number } (default 10)
 * Sets the current user's profile.credits_reset_at to now + minutes.
 * For use on the test-production page to simulate the short reset cycle (RPC advances by 1 month).
 * Auth required. Same env guard as test-production page.
 */
export async function POST(req) {
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

  let body;
  try {
    body = await req.json().catch(() => ({}));
  } catch {
    body = {};
  }
  const minutes = typeof body.minutes === "number" ? body.minutes : Number(body.minutes);
  if (!Number.isFinite(minutes) || minutes < 1 || minutes > 60 * 24 * 31) {
    return NextResponse.json(
      { error: "minutes must be a number between 1 and 44640 (31 days)" },
      { status: 400 }
    );
  }

  const serviceSupabase = createServiceRoleClient();
  const newResetAt = new Date(Date.now() + minutes * 60 * 1000).toISOString();

  const { error } = await serviceSupabase
    .from("profiles")
    .update({ credits_reset_at: newResetAt })
    .eq("id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, credits_reset_at: newResetAt });
}

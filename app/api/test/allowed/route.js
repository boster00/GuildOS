import { NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";
import { requireTestStripeAuth } from "@/libs/testStripeGuard";

/**
 * GET /api/test/allowed
 * Returns { allowed: true } if auth + test-stripe allowed; 401/403 otherwise. Page uses this to show "Access denied" without rendering panels.
 */
export async function GET() {
  const supabase = await createClient();
  const guard = await requireTestStripeAuth(supabase);
  if (guard.response) return guard.response;
  return NextResponse.json({ allowed: true });
}

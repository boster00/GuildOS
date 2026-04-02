/**
 * Auth + dev guard for /api/test/* and /tests/stripe page.
 * Returns { user } or { response } so route handlers can return the response.
 * Dev-only routes return 404 (not 403) in production to reduce discoverability.
 */

import { NextResponse } from "next/server";

export function isTestStripeAllowed() {
  if (process.env.NODE_ENV !== "production") return true;
  return process.env.ALLOW_TEST_STRIPE_PAGE === "true" || process.env.ALLOW_TEST_STRIPE_PAGE === "1";
}

/**
 * Returns a 404 response if the request should be blocked (production or !isTestStripeAllowed in non-prod).
 * Use at the start of dev-only routes (sandbox-subscribe, sandbox-cancel, test-stripe APIs).
 * @returns {NextResponse | null} 404 response to return, or null if allowed
 */
export function getDevRouteBlockResponse() {
  if (process.env.NODE_ENV === "production") return NextResponse.json(null, { status: 404 });
  if (!isTestStripeAllowed()) return NextResponse.json(null, { status: 404 });
  return null;
}

/**
 * Use in dev-only API routes: first block in prod / when not allowed (404), then require auth (401).
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @returns {Promise<{ user: { id: string } } | { response: NextResponse }>}
 */
export async function requireDevRouteAuth(supabase) {
  const block = getDevRouteBlockResponse();
  if (block) return { response: block };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { user };
}

/**
 * Use in test API routes: get user and ensure test-stripe is allowed.
 * Returns 403 when !isTestStripeAllowed (legacy); prefer requireDevRouteAuth for new routes (returns 404).
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @returns {Promise<{ user: { id: string } } | { response: NextResponse }>}
 */
export async function requireTestStripeAuth(supabase) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!isTestStripeAllowed()) {
    return { response: NextResponse.json({ error: "Forbidden: test-stripe not allowed in this environment" }, { status: 403 }) };
  }
  return { user };
}

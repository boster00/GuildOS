/**
 * POST /api/webhook/signup
 *
 * Called by Supabase when a new row is inserted into auth.users (signup only, not login).
 * Grants free-tier signup credits via MOC; extend with onboarding emails etc. later.
 *
 * Verification: Authorization: Bearer <SIGNUP_WEBHOOK_SECRET> or header X-Webhook-Secret.
 * Payload: { type: "INSERT", schema: "auth", table: "users", record: { id, email, ... } }
 *
 * To create the webhook in Supabase:
 * - Dashboard: Database → Webhooks (or Integrations → Webhooks). Table auth.users, event Insert.
 *   URL: https://<your-app>/api/webhook/signup
 *   Add header: Authorization: Bearer <SIGNUP_WEBHOOK_SECRET> (or X-Webhook-Secret).
 * - If auth.users is not available in the UI, use a migration with AFTER INSERT ON auth.users
 *   trigger that calls net.http_post to this URL with the secret in a header.
 */

import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/libs/supabase/serviceRole";
import { grantSignup } from "@/libs/monkey/masterOfCoins/index.js";

export const dynamic = "force-dynamic";

export async function POST(req) {
  const secret =
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ||
    req.headers.get("x-webhook-secret") ||
    "";

  const expected = process.env.SIGNUP_WEBHOOK_SECRET;
  if (!expected) {
    return NextResponse.json(
      { error: "Server misconfigured" },
      { status: 500 }
    );
  }
  if (secret !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = await req.json();
  } catch (e) {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const record = body?.record;
  const userId = record?.id;
  if (!userId) {
    return NextResponse.json(
      { error: "Missing body.record.id" },
      { status: 400 }
    );
  }
  try {
    const supabase = createServiceRoleClient();
    const result = await grantSignup(supabase, { userId });
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error || "grantSignup failed" },
        { status: 500 }
      );
    }
    return NextResponse.json({ ok: true, granted: result.granted });
  } catch (err) {
    return NextResponse.json(
      { error: err?.message || "Internal error" },
      { status: 500 }
    );
  }
}

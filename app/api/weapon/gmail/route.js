/**
 * Gmail weapon API route — OAuth2 with GOOGLE_ID / GOOGLE_SECRET.
 *
 * GET  ?action=connect       → redirect to Google OAuth (Gmail scope)
 * GET  ?action=callback      → exchange code, save GOOGLE_GMAIL_REFRESH_TOKEN to profiles.env_vars
 * GET  ?action=status        → check credentials (no external call)
 * POST ?action=search        → search messages { query, limit? }
 * POST ?action=read          → read single message { messageId }
 * POST ?action=star          → star message(s) { messageId } or { messageIds: [] }
 * POST ?action=writeLabels   → modify labels { messageId, addLabelIds, removeLabelIds }
 * POST ?action=profile       → get Gmail profile
 * POST ?action=labels        → list labels
 */
import { requireUser } from "@/libs/council/auth/server";
import { getSiteUrl } from "@/libs/council/auth/urls";
import { database } from "@/libs/council/database";
import { publicTables } from "@/libs/council/publicTables";
import { getGoogleCredentials } from "@/libs/council/profileEnvVars";
import {
  checkCredentials,
  searchMessages,
  readMessage,
  writeMessageLabels,
  starMessage,
  starMessages,
  readProfile,
  searchLabels,
} from "@/libs/weapon/gmail";

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.readonly",
].join(" ");

function callbackUrl() {
  return `${getSiteUrl().replace(/\/$/, "")}/api/weapon/gmail?action=callback`;
}

export async function GET(request) {
  const action = new URL(request.url).searchParams.get("action");

  // ── connect: redirect to Google OAuth with Gmail scopes ──
  if (action === "connect") {
    const user = await requireUser();
    const creds = await getGoogleCredentials(user.id);
    if (!creds.clientId) {
      return new Response("Missing GOOGLE_ID in profiles.env_vars or process.env.", { status: 500 });
    }
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", creds.clientId);
    url.searchParams.set("redirect_uri", callbackUrl());
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", SCOPES);
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
    return Response.redirect(url.toString());
  }

  // ── callback: exchange code, store refresh token in profiles.env_vars ──
  if (action === "callback") {
    const user = await requireUser();
    const params = new URL(request.url).searchParams;
    const code = params.get("code");
    if (!code) return new Response("Missing code from Google.", { status: 400 });

    const creds = await getGoogleCredentials(user.id);
    if (!creds.clientId || !creds.clientSecret) {
      return new Response("Missing GOOGLE_ID or GOOGLE_SECRET.", { status: 500 });
    }

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
        redirect_uri: callbackUrl(),
        grant_type: "authorization_code",
        code,
      }),
    });
    const token = await tokenRes.json();
    if (!token.refresh_token) {
      return new Response(`OAuth failed: ${JSON.stringify(token)}`, { status: 500 });
    }

    // Save GOOGLE_GMAIL_REFRESH_TOKEN into profiles.env_vars
    const db = await database.init("server");
    const { data: profile } = await db
      .from(publicTables.profiles)
      .select("env_vars")
      .eq("id", user.id)
      .single();
    const updated = { ...(profile?.env_vars || {}), GOOGLE_GMAIL_REFRESH_TOKEN: token.refresh_token };
    await db.from(publicTables.profiles).update({ env_vars: updated }).eq("id", user.id);

    return new Response(
      "<html><body><h2>Gmail connected!</h2><p>GOOGLE_GMAIL_REFRESH_TOKEN saved to your profile. You can close this tab.</p></body></html>",
      { headers: { "Content-Type": "text/html" } },
    );
  }

  // ── status ──
  if (action === "status") {
    const user = await requireUser();
    const result = await checkCredentials(user.id);
    return Response.json(result);
  }

  return Response.json(
    { error: "Missing or invalid action", validGetActions: ["connect", "callback", "status"] },
    { status: 400 },
  );
}

export async function POST(request) {
  const action = new URL(request.url).searchParams.get("action");
  await requireUser();
  let body = {};
  try { body = await request.json(); } catch { /* no body */ }

  try {
    if (action === "search") {
      if (!body.query) return Response.json({ ok: false, error: "query is required" }, { status: 400 });
      const results = await searchMessages(body);
      return Response.json({ ok: true, messages: results, count: results.length });
    }

    if (action === "read") {
      const result = await readMessage(body);
      return Response.json({ ok: true, message: result });
    }

    if (action === "star") {
      if (body.messageIds) {
        const result = await starMessages(body);
        return Response.json({ ok: true, ...result });
      }
      const result = await starMessage(body);
      return Response.json({ ok: true, message: result });
    }

    if (action === "writeLabels") {
      const result = await writeMessageLabels(body);
      return Response.json({ ok: true, message: result });
    }

    if (action === "profile") {
      const result = await readProfile(body);
      return Response.json({ ok: true, profile: result });
    }

    if (action === "labels") {
      const result = await searchLabels(body);
      return Response.json({ ok: true, labels: result });
    }

    return Response.json(
      { error: "Missing or invalid action", validPostActions: ["search", "read", "star", "writeLabels", "profile", "labels"] },
      { status: 400 },
    );
  } catch (e) {
    return Response.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

/**
 * Zoho weapon API route — OAuth connect/callback, status, search.
 *
 * GET  ?action=connect   → redirect to Zoho OAuth (Books + CRM scopes)
 * GET  ?action=callback  → exchange code, store token, redirect to forge page
 * GET  ?action=status    → token status (no secrets exposed)
 * POST ?action=scrap     → delete OAuth tokens so the weapon can be re-forged
 * POST ?action=search    → search any Zoho module (Books or CRM)
 */
import { requireUser } from "@/libs/council/auth/server";
import { getZohoBooksAppCredentials } from "@/libs/council/profileEnvVars";
import { getSiteUrl } from "@/libs/council/auth/urls";
import {
  buildZohoOAuthAuthorizeUrl,
  exchangeZohoCode,
  fetchZohoOrganizationId,
  upsertZohoConnection,
  deleteZohoConnection,
  getZohoOAuthCallbackUrl,
  getZohoWeaponStatus,
  searchBooks,
  searchCrm,
  zohoErrorToJsonPayload,
} from "@/libs/weapon/zoho";

const FORGE_URL = () => `${getSiteUrl().replace(/\/$/, "")}/town/town-square/forge/zoho`;

export async function GET(request) {
  const action = new URL(request.url).searchParams.get("action");

  // ── connect: redirect to Zoho OAuth ──
  if (action === "connect") {
    const user = await requireUser();
    const region = new URL(request.url).searchParams.get("region") || "com";
    const { clientId } = await getZohoBooksAppCredentials(user.id);
    if (!clientId) {
      return new Response("Missing Zoho client_id — add ZOHO_BOOKS_CLIENT_ID to Council Hall Formulary.", { status: 500 });
    }
    const authUrl = buildZohoOAuthAuthorizeUrl({
      region,
      clientId,
      redirectUri: getZohoOAuthCallbackUrl(),
    });
    return Response.redirect(authUrl);
  }

  // ── callback: exchange code, save token ──
  if (action === "callback") {
    const user = await requireUser();
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const region = url.searchParams.get("state") || "com";
    if (!code) return Response.redirect(`${FORGE_URL()}?zoho=missing_code`);

    const { clientId, clientSecret } = await getZohoBooksAppCredentials(user.id);
    if (!clientId || !clientSecret) return Response.redirect(`${FORGE_URL()}?zoho=missing_app_credentials`);

    const exchanged = await exchangeZohoCode({
      code, region, clientId, clientSecret, redirectUri: getZohoOAuthCallbackUrl(),
    });
    if (!exchanged.ok) return Response.redirect(`${FORGE_URL()}?zoho=oauth_failed`);

    const token = exchanged.token;
    const expiresAt = new Date(Date.now() + (token.expires_in || 3600) * 1000).toISOString();
    const organizationId = await fetchZohoOrganizationId(token.access_token, region);

    const { error } = await upsertZohoConnection({
      user_id: user.id, region,
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      token_type: token.token_type,
      expires_at: expiresAt,
      organization_id: organizationId,
    });
    if (error) return Response.redirect(`${FORGE_URL()}?zoho=save_failed`);
    return Response.redirect(`${FORGE_URL()}?zoho=connected`);
  }

  // ── status ──
  if (action === "status") {
    const user = await requireUser();
    const status = await getZohoWeaponStatus(user.id);
    return Response.json(status);
  }

  return Response.json(
    { error: "Missing or invalid action", validGetActions: ["connect", "callback", "status"] },
    { status: 400 },
  );
}

export async function POST(request) {
  const action = new URL(request.url).searchParams.get("action");
  const user = await requireUser();
  let body = {};
  try { body = await request.json(); } catch { /* no body */ }

  // ── scrap: delete OAuth tokens so the weapon can be re-forged ──
  if (action === "scrap") {
    try {
      const { error } = await deleteZohoConnection(user.id);
      if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
      return Response.json({ ok: true, scrapped: true });
    } catch (e) {
      return Response.json({ ok: false, ...zohoErrorToJsonPayload(e) }, { status: 500 });
    }
  }

  // ── search: unified search across Books and CRM modules ──
  if (action === "search") {
    const moduleName = String(body.module ?? "").trim();
    const limit = Number(body.limit ?? 5);
    if (!moduleName) {
      return Response.json({ ok: false, error: "module is required" }, { status: 400 });
    }
    try {
      // Books modules are lowercase, CRM modules are PascalCase
      const isBooks = moduleName === moduleName.toLowerCase();
      const rows = isBooks
        ? await searchBooks(moduleName, limit, user.id)
        : await searchCrm(moduleName, limit, user.id);
      return Response.json({ ok: true, records: rows });
    } catch (e) {
      return Response.json({ ok: false, ...zohoErrorToJsonPayload(e) }, { status: 500 });
    }
  }

  return Response.json(
    { error: "Missing or invalid action", validPostActions: ["scrap", "search"] },
    { status: 400 },
  );
}

import { getZohoBooksAppCredentials } from "@/libs/council/profileEnvVars";
import { requireUser } from "@/libs/council/auth/server";
import { getSiteUrl } from "@/libs/council/auth/urls";
import {
  exchangeZohoAuthorizationCode,
  fetchZohoOrganizationId,
  upsertZohoConnection,
} from "@/libs/weapon/zoho";
import { getZohoOAuthCallbackUrl } from "./zohoApiPaths.js";

export async function handleZohoCallback(request) {
  const user = await requireUser();
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const region = url.searchParams.get("state") || "com";
  const callback = getZohoOAuthCallbackUrl();

  if (!code) {
    return Response.redirect(`${getSiteUrl()}/town/town-square/forge/zoho?zoho=missing_code`);
  }

  const { clientId, clientSecret } = await getZohoBooksAppCredentials(user.id);

  if (!clientId || !clientSecret) {
    return Response.redirect(`${getSiteUrl()}/town/town-square/forge/zoho?zoho=missing_app_credentials`);
  }

  const exchanged = await exchangeZohoAuthorizationCode({
    code,
    region,
    clientId,
    clientSecret,
    redirectUri: callback,
  });

  if (!exchanged.ok) {
    return Response.redirect(`${getSiteUrl()}/town/town-square/forge/zoho?zoho=oauth_failed`);
  }

  const token = exchanged.token;
  const expiresAt = new Date(Date.now() + (token.expires_in || 3600) * 1000).toISOString();

  const organizationId = await fetchZohoOrganizationId(token.access_token, region);

  const { error } = await upsertZohoConnection({
    user_id: user.id,
    region,
    access_token: token.access_token,
    refresh_token: token.refresh_token,
    token_type: token.token_type,
    expires_at: expiresAt,
    organization_id: organizationId,
  });

  if (error) {
    return Response.redirect(`${getSiteUrl()}/town/town-square/forge/zoho?zoho=save_failed`);
  }

  return Response.redirect(`${getSiteUrl()}/town/town-square/forge/zoho?zoho=connected`);
}

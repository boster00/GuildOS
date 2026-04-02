import { getZohoBooksAppCredentials } from "@/libs/council/profileEnvVars";
import { requireUser } from "@/libs/council/auth/server";
import { buildZohoOAuthAuthorizeUrl } from "@/libs/weapon/zoho";
import { getZohoOAuthCallbackUrl } from "./zohoApiPaths.js";

export async function handleZohoConnect(request) {
  const user = await requireUser();

  const region = request.nextUrl.searchParams.get("region") || "com";
  const { clientId } = await getZohoBooksAppCredentials(user.id);

  if (!clientId) {
    return new Response(
      "Missing Zoho Books client id — inscribe ZOHO_BOOKS_CLIENT_ID in the Council Hall Formulary, or set server env.",
      { status: 500 }
    );
  }

  const authUrl = buildZohoOAuthAuthorizeUrl({
    region,
    clientId,
    redirectUri: getZohoOAuthCallbackUrl(),
  });
  return Response.redirect(authUrl);
}

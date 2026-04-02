import { database } from "@/libs/council/database";
import { getSiteUrl } from "@/libs/council/auth/urls";

export async function GET(request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type");
  const next = requestUrl.searchParams.get("next") || "/opening";
  const safeNext = next.startsWith("/") ? next : "/opening";
  const redirectBase = getSiteUrl();
  const db = await database.init("server");

  if (code) {
    const { error } = await db.auth.exchangeCodeForSession(code);
    if (error) {
      return Response.redirect(`${redirectBase}/signin?error=auth_exchange_failed`);
    }
    return Response.redirect(`${redirectBase}${safeNext}`);
  }

  if (tokenHash && type) {
    const { error } = await db.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });
    if (error) {
      return Response.redirect(`${redirectBase}/signin?error=auth_verify_failed`);
    }
    return Response.redirect(`${redirectBase}${safeNext}`);
  }

  return Response.redirect(`${redirectBase}/signin?error=missing_auth_params`);
}

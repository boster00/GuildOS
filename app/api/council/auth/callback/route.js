import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabasePublicEnv } from "@/libs/council/auth/env";
import { getSiteUrl } from "@/libs/council/auth/urls";

/**
 * Auth callback. Must use NextResponse.redirect (not Response.redirect) AND
 * attach the Supabase auth cookies to that exact response — otherwise the
 * Set-Cookie headers from exchangeCodeForSession get dropped on the redirect
 * and mobile clients enter a /signin redirect loop after clicking the magic
 * link. (Desktop browsers sometimes survive via the next middleware-refresh
 * cycle, but mobile Safari does not.)
 */
export async function GET(request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type");
  const next = requestUrl.searchParams.get("next") || "/tavern";
  const safeNext = next.startsWith("/") ? next : "/tavern";
  const redirectBase = getSiteUrl();

  // Build the redirect we'll return — supabase will write Set-Cookie onto it.
  const successResponse = NextResponse.redirect(`${redirectBase}${safeNext}`);

  const { url, publishableKey } = getSupabasePublicEnv();
  const db = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) =>
          successResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  if (code) {
    const { error } = await db.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(`${redirectBase}/signin?error=auth_exchange_failed`);
    }
    return successResponse;
  }

  if (tokenHash && type) {
    const { error } = await db.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) {
      return NextResponse.redirect(`${redirectBase}/signin?error=auth_verify_failed`);
    }
    return successResponse;
  }

  return NextResponse.redirect(`${redirectBase}/signin?error=missing_auth_params`);
}

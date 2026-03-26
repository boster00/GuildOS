import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@libs-db/server";
import config from "@/config";

const NEXT_COOKIE = "guildos_auth_next";

export const dynamic = "force-dynamic";

// Called after hosted auth; exchanges code for session then redirects.
export async function GET(req) {
  const requestUrl = new URL(req.url);
  const code = requestUrl.searchParams.get("code");
  const nextParam = requestUrl.searchParams.get("next");

  if (code) {
    const sb = await createClient();
    await sb.auth.exchangeCodeForSession(code);
  }

  const cookieStore = await cookies();
  const fromCookie = cookieStore.get(NEXT_COOKIE)?.value;

  const rawNext =
    nextParam || (fromCookie ? decodeURIComponent(fromCookie) : null);

  const safeNext =
    rawNext &&
    rawNext.startsWith("/") &&
    !rawNext.startsWith("//") &&
    !rawNext.includes("://")
      ? rawNext
      : null;

  const destination =
    requestUrl.origin + (safeNext || config.auth.callbackUrl);

  const res = NextResponse.redirect(destination);
  if (fromCookie) {
    res.cookies.set(NEXT_COOKIE, "", { path: "/", maxAge: 0 });
  }

  return res;
}

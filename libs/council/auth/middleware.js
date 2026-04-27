import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { getSupabasePublicEnv } from "@/libs/council/auth/env";

export async function updateSession(request) {
  let response = NextResponse.next({ request });
  const { url, publishableKey } = getSupabasePublicEnv();

  const supabase = createServerClient(
    url,
    publishableKey,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, user };
}

const PUBLIC_PATH_PREFIXES = [
  "/signin",
  "/opening",
  "/api/council/auth",
  "/api/council/cron", // Vercel cron hits /api/council/cron/trigger unauthenticated; the route validates the CRON_SECRET bearer header instead.
  "/api/auth",
  "/api/telnyx",
  "/api/track",
  "/_next",
  "/favicon",
  "/images",
  "/demopages",
  "/blog",
  "/robots.txt",
  "/sitemap",
];

export function isProtectedPath(pathname) {
  for (const prefix of PUBLIC_PATH_PREFIXES) {
    if (pathname === prefix || pathname.startsWith(prefix + "/") || pathname.startsWith(prefix + ".")) {
      return false;
    }
  }
  return true;
}

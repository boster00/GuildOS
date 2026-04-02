import { NextResponse } from "next/server";
import { isProtectedPath, updateSession } from "@/libs/council/auth/middleware";

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  // Legacy Supabase email links: /api/auth/callback → council-owned route
  if (pathname === "/api/auth/callback") {
    const url = request.nextUrl.clone();
    url.pathname = "/api/council/auth/callback";
    return NextResponse.rewrite(url);
  }

  const { response, user } = await updateSession(request);

  if (isProtectedPath(pathname) && !user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/signin";
    redirectUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (pathname.startsWith("/signin") && user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/opening";
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

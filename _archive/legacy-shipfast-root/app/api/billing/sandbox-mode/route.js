import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const SANDBOX_COOKIE_NAME = "stripe_sandbox_mode";

/**
 * GET /api/billing/sandbox-mode
 * Returns { sandbox: boolean } - reads from cookie (set by toggle) or env fallback.
 * Only works in dev environment (NODE_ENV !== 'production').
 */
export async function GET() {
  // Only allow sandbox mode in development
  const isDev = process.env.NODE_ENV !== "production";
  
  if (!isDev) {
    return NextResponse.json({ sandbox: false });
  }

  const cookieStore = await cookies();
  const sandboxCookie = cookieStore.get(SANDBOX_COOKIE_NAME);
  
  // Check cookie first, then fall back to env var
  const sandbox = sandboxCookie?.value === "true" ||
    process.env.NEXT_PUBLIC_BILLING_SANDBOX === "true" ||
    process.env.NEXT_PUBLIC_BILLING_SANDBOX === "1";
  
  return NextResponse.json({ sandbox: Boolean(sandbox) });
}

/**
 * POST /api/billing/sandbox-mode
 * Toggles sandbox mode on/off via cookie. Only works in dev environment.
 * Body: { enabled: boolean }
 */
export async function POST(req) {
  // Only allow sandbox mode in development
  const isDev = process.env.NODE_ENV !== "production";
  
  if (!isDev) {
    return NextResponse.json({ error: "Sandbox mode only available in development" }, { status: 403 });
  }

  try {
    const { enabled } = await req.json();
    const cookieStore = await cookies();
    
    if (enabled === true) {
      cookieStore.set(SANDBOX_COOKIE_NAME, "true", {
        httpOnly: false, // Allow client-side access
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 365, // 1 year
        path: "/",
      });
    } else {
      cookieStore.delete(SANDBOX_COOKIE_NAME);
    }
    
    return NextResponse.json({ sandbox: Boolean(enabled) });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

import { cronRunOnce } from "@/libs/council/cron/runOnce.js";

export const maxDuration = 60;

/**
 * Vercel cron hits this endpoint unauthenticated (no user cookie). The
 * middleware whitelists `/api/council/cron`, so this route owns its own
 * auth: a bearer token that matches `process.env.CRON_SECRET`. Vercel
 * automatically attaches `Authorization: Bearer ${CRON_SECRET}` to cron
 * requests when the var is set in the project's env.
 *
 * Until 2026-04-27 the middleware was redirecting this path to /signin,
 * so the production cron silently 307'd for hours/days at a time and
 * Cat never got purrview nudges. The two fixes (whitelist + this guard)
 * land together.
 */
export async function GET(request) {
  const expected = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization") || "";
  const provided = authHeader.replace(/^Bearer\s+/i, "");

  if (!expected || provided !== expected) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await cronRunOnce();
    return Response.json({ ok: true, ...result });
  } catch (err) {
    return Response.json(
      { ok: false, error: err.message || String(err) },
      { status: 500 }
    );
  }
}

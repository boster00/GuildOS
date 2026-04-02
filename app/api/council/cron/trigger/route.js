import { cronRunOnce } from "@/libs/council/cron/runOnce.js";

export const maxDuration = 60;

export async function GET() {
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

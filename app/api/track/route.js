/**
 * Server-side tracking MVP beacon endpoint.
 * POST a single event or { events: [...] } batch. Public; CORS-open.
 * Writes to `boster-cbi.CDB.events_serverside_mvp`. Comparison vs GA4 export.
 */
import { ingestEvents } from "@/libs/tracking";

const ALLOWED_ORIGINS = [
  "https://www.bosterbio.com",
  "https://bosterbio.com",
  "https://www.bosterbio.com2026",
];

function corsHeaders(origin) {
  const allow = !origin || ALLOWED_ORIGINS.some((o) => origin === o || origin.endsWith(".bosterbio.com"))
    ? origin || "*"
    : "null";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export async function OPTIONS(request) {
  return new Response(null, { status: 204, headers: corsHeaders(request.headers.get("origin")) });
}

export async function POST(request) {
  const origin = request.headers.get("origin");
  const headers = corsHeaders(origin);

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }

  const events = Array.isArray(body) ? body : Array.isArray(body?.events) ? body.events : [body];
  if (events.length === 0 || events.length > 50) {
    return new Response(JSON.stringify({ error: "events must be 1..50 items" }), {
      status: 400,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }

  const ip =
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-real-ip") ||
    (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
    "";
  const userAgent = request.headers.get("user-agent") || "";

  try {
    const result = await ingestEvents(events, { ip, userAgent });
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }
}

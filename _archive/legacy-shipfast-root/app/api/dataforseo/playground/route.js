import { NextResponse } from "next/server";

function getDataForSeoAuth() {
  const login = process.env.DATAFORSEO_LOGIN;
  const password = process.env.DATAFORSEO_PASSWORD;
  if (!login || !password) return null;
  const auth = Buffer.from(`${login}:${password}`).toString("base64");
  return { auth };
}

/**
 * Deep-replace placeholder strings in a payload (array or object).
 * Replaces "{keyword}" with seedKeyword and "{url}" with seedUrl (or target with domain from url).
 */
function substitutePayload(payload, seedKeyword, seedUrl) {
  if (payload === null || payload === undefined) return payload;
  const urlForTarget = seedUrl ? (seedUrl.replace(/^https?:\/\//, "").replace(/\/$/, "") || seedUrl) : "";
  const str = JSON.stringify(payload);
  let out = str.replace(/\{keyword\}/g, seedKeyword || "");
  out = out.replace(/\{url\}/g, urlForTarget || "");
  return JSON.parse(out);
}

/**
 * POST /api/dataforseo/playground
 * Body: { endpoint, payload, seedKeyword?, seedUrl?, method? }
 * Calls DataForSEO with the given endpoint and payload (after substituting {keyword}/{url}).
 * Returns the raw DataForSEO JSON response (includes cost, tasks, etc.).
 */
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { endpoint, payload, seedKeyword = "", seedUrl = "", method = "POST" } = body;
    if (!endpoint || typeof endpoint !== "string") {
      return NextResponse.json({ error: "endpoint is required" }, { status: 400 });
    }
    const authInfo = getDataForSeoAuth();
    if (!authInfo) {
      return NextResponse.json(
        { error: "DataForSEO not configured. Set DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD." },
        { status: 503 }
      );
    }
    const substituted = substitutePayload(payload, seedKeyword, seedUrl);
    const url = `https://api.dataforseo.com${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
    const response = await fetch(url, {
      method: method || "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${authInfo.auth}`,
      },
      body: JSON.stringify(substituted),
    });
    const rawText = await response.text();
    if (!response.ok) {
      let errMsg = rawText;
      try {
        const errData = JSON.parse(rawText);
        errMsg = errData.error?.message || errData.message || rawText;
      } catch (_) {}
      return NextResponse.json(
        { error: `DataForSEO API error: ${errMsg}`, status: response.status },
        { status: 502 }
      );
    }
    let data;
    try {
      data = JSON.parse(rawText);
    } catch (_) {
      return NextResponse.json({ error: "Invalid JSON response from DataForSEO", raw: rawText.slice(0, 500) }, { status: 502 });
    }
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: e.message || "Playground request failed" }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';

const FA_CSS_URL = 'https://use.fontawesome.com/releases/v6.1.1/css/all.css';

/**
 * GET /api/test-shadow-dom-styling/proxy-fontawesome
 * Proxies Font Awesome all.css so the test page can fetch it same-origin and avoid CORS.
 * (Browser fetch() to fontawesome.com is blocked by CORS; <link> still works for loading.)
 */
export async function GET() {
  const res = await fetch(FA_CSS_URL);
  if (!res.ok) {
    return new NextResponse(null, { status: res.status });
  }
  const text = await res.text();
  return new NextResponse(text, {
    headers: {
      'Content-Type': 'text/css; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}

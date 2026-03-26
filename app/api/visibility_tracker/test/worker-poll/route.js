/**
 * Server proxy for visibility tracker worker poll.
 * Accepts JSON body from client and forwards to worker/poll with Bearer secret from env.
 * Test page must not receive or send the worker secret.
 */

import { NextResponse } from "next/server";

export async function POST(request) {
  const workerSecret =
    process.env.VT_WORKER_SECRET ||
    process.env.WORKER_SECRET ||
    process.env.CRON_SECRET;

  if (!workerSecret) {
    return NextResponse.json(
      { error: "Server misconfigured: worker secret not set" },
      { status: 500 }
    );
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    // empty body ok
  }

  const origin =
    request.nextUrl?.origin ||
    process.env.SITE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://localhost:3000";
  const url = `${origin}/api/visibility_tracker/worker/poll`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${workerSecret}`,
      },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json(
      { error: err?.message || "Proxy request failed" },
      { status: 500 }
    );
  }
}

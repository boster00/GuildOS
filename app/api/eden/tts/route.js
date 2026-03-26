import { NextResponse } from "next/server";
import { generateSpeech } from "@/libs/ai/eden/ttsGateway";

function generateRequestId() {
  return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : "tts-" + Date.now();
}

export async function POST(request) {
  const requestId = generateRequestId();
  if (!process.env.EDEN_AI_API_KEY) {
    return NextResponse.json(
      { ok: false, error: { code: "CONFIG", message: "Server configuration error", requestId } },
      { status: 500 }
    );
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: "VALIDATION_ERROR", message: "Invalid JSON", requestId } },
      { status: 400 }
    );
  }
  const { text, voice } = body || {};
  if (!text || typeof text !== "string" || !text.trim()) {
    return NextResponse.json(
      { ok: false, error: { code: "VALIDATION_ERROR", message: "text required", requestId } },
      { status: 400 }
    );
  }
  try {
    const out = await generateSpeech({ text: text.trim(), voice });
    return NextResponse.json({
      ok: true,
      data: out.data,
      requestId: out.requestId,
      latencyMs: out.latencyMs,
      rawPreview: out.rawPreview,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: err.code || "EDEN_API_ERROR",
          message: err.message || "TTS failed",
          requestId: err.requestId || requestId,
          raw: err.raw,
        },
      },
      { status: 500 }
    );
  }
}

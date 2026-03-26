import { NextResponse } from "next/server";
import { getModel } from "@/libs/ai/eden/modelRegistry";
import { sendChatPrompt } from "@/libs/ai/eden/chatGateway";
import { check, consume } from "@/libs/ai/eden/rateLimit";

function generateRequestId() {
  return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : "chat-" + Date.now();
}

const routePath = "/api/eden/chat";

export async function POST(request) {
  const requestId = generateRequestId();
  if (process.env.EDEN_RATE_LIMIT_ENABLED === "true") {
    const { allowed, code } = check(routePath);
    if (!allowed) {
      return NextResponse.json(
        { ok: false, error: { code, message: "Rate limit exceeded", requestId } },
        { status: 429 }
      );
    }
    consume(routePath);
  }
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
  const { prompt, modelIds, batchPrompts, temperature = 0.7, maxTokens = 2048, stream = false } = body;

  const prompts = batchPrompts && Array.isArray(batchPrompts) && batchPrompts.length > 0
    ? batchPrompts.filter((p) => typeof p === "string" && p.trim())
    : prompt !== undefined && typeof prompt === "string" && prompt.trim()
      ? [prompt.trim()]
      : null;

  if (!prompts || prompts.length === 0) {
    return NextResponse.json(
      { ok: false, error: { code: "VALIDATION_ERROR", message: "prompt or batchPrompts required", requestId } },
      { status: 400 }
    );
  }

  const ids = Array.isArray(modelIds) && modelIds.length > 0 ? modelIds : [];
  if (ids.length === 0) {
    return NextResponse.json(
      { ok: false, error: { code: "VALIDATION_ERROR", message: "modelIds array required", requestId } },
      { status: 400 }
    );
  }

  for (const id of ids) {
    if (!getModel(id)) {
      return NextResponse.json(
        { ok: false, error: { code: "VALIDATION_ERROR", message: `Unknown model: ${id}`, requestId } },
        { status: 400 }
      );
    }
  }

  const results = [];
  const batchRunId = batchPrompts && prompts.length > 1 ? generateRequestId() : null;

  for (const p of prompts) {
    const runStart = Date.now();
    const perModel = await Promise.all(
      ids.map(async (modelId) => {
        const start = Date.now();
        try {
          const out = await sendChatPrompt({
            prompt: p,
            model: modelId,
            temperature,
            maxTokens,
            stream: false,
          });
          return {
            modelId,
            text: out.data.text,
            usage: out.data.usage,
            latencyMs: Date.now() - start,
            rawPreview: out.rawPreview,
            requestId: out.requestId,
            cost: null,
          };
        } catch (err) {
          return {
            modelId,
            error: err.message || "Request failed",
            requestId: err.requestId || generateRequestId(),
            latencyMs: Date.now() - start,
          };
        }
      })
    );
    results.push({
      prompt: p,
      results: perModel,
      batchRunId: batchRunId || undefined,
    });
  }

  return NextResponse.json({
    ok: true,
    data: {
      results: results.length === 1 ? results[0].results : results,
      batchRunId,
    },
    requestId,
  });
}

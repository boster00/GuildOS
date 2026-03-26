import { NextResponse } from "next/server";
import { generateImageFromText, updateImageFromImage } from "@/libs/ai/eden/imageGateway";

function generateRequestId() {
  return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : "img-" + Date.now();
}

function devLog(step, data) {
  if (process.env.NODE_ENV === "development") {
  }
}

export async function POST(request) {
  const requestId = generateRequestId();
  devLog("Start", { requestId });

  if (!process.env.EDEN_AI_API_KEY) {
    devLog("ConfigError", { requestId });
    return NextResponse.json(
      { ok: false, error: { code: "CONFIG", message: "Server configuration error", requestId } },
      { status: 500 }
    );
  }
  let body;
  try {
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const mode = formData.get("mode") || "text";
      const prompt = formData.get("prompt") || "";
      const size = formData.get("size") || "1024x1024";
      const file = formData.get("image");
      body = { mode, prompt, size };
      if (file && file instanceof Blob) {
        const buf = await file.arrayBuffer();
        body.imageBase64 = Buffer.from(buf).toString("base64");
      }
      devLog("Payload", { mode, prompt: prompt?.slice(0, 80), size, hasImage: !!body.imageBase64 });
    } else {
      body = await request.json();
      devLog("Payload", {
        mode: body.mode,
        prompt: body.prompt?.slice(0, 80),
        size: body.size,
        hasImage: !!body.imageBase64,
      });
    }
  } catch (parseErr) {
    devLog("ParseError", { requestId, error: parseErr?.message });
    return NextResponse.json(
      { ok: false, error: { code: "VALIDATION_ERROR", message: "Invalid request body", requestId } },
      { status: 400 }
    );
  }
  const mode = body.mode || "text";
  try {
    devLog("CallGateway", { mode, promptLength: body.prompt?.length });
    if (mode === "image" && body.imageBase64) {
      const out = await updateImageFromImage({
        imageBase64: body.imageBase64,
        prompt: body.prompt || "",
        strength: body.strength,
      });
      devLog("Success", { requestId: out.requestId, latencyMs: out.latencyMs, hasUrl: !!out.data?.url });
      return NextResponse.json({
        ok: true,
        data: out.data,
        requestId: out.requestId,
        latencyMs: out.latencyMs,
        rawPreview: out.rawPreview,
      });
    }
    const out = await generateImageFromText({
      prompt: body.prompt || "",
      size: body.size || "1024x1024",
      style: body.style,
    });
    devLog("Success", { requestId: out.requestId, latencyMs: out.latencyMs, hasUrl: !!out.data?.url });
    return NextResponse.json({
      ok: true,
      data: out.data,
      requestId: out.requestId,
      latencyMs: out.latencyMs,
      rawPreview: out.rawPreview,
    });
  } catch (err) {
    const rawPreview = err.raw
      ? JSON.stringify(err.raw).slice(0, 1500) + (JSON.stringify(err.raw).length > 1500 ? "..." : "")
      : undefined;
    devLog("Error", {
      requestId: err.requestId || requestId,
      code: err.code,
      message: err.message,
      rawPreview,
    });
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: err.code || "EDEN_API_ERROR",
          message: err.message || "Image generation failed",
          requestId: err.requestId || requestId,
          raw: err.raw,
        },
      },
      { status: 500 }
    );
  }
}

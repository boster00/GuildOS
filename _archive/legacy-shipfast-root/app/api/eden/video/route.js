import { NextResponse } from "next/server";
import { createVideoJob } from "@/libs/ai/eden/videoGateway";

function generateRequestId() {
  return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : "video-" + Date.now();
}

function devLog(step, data) {
  if (process.env.NODE_ENV === "development") {
    
  }
}

export async function POST(request) {
  const requestId = generateRequestId();
  devLog("Start", { requestId });

  if (!process.env.EDEN_AI_API_KEY) {
    devLog("ConfigError", { requestId, hasKey: false });
    return NextResponse.json(
      { ok: false, error: { code: "CONFIG", message: "Server configuration error", requestId } },
      { status: 500 }
    );
  }
  devLog("Config", { requestId, hasKey: true });

  let body;
  try {
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) {
      devLog("ParseMultipart", { requestId, contentType: contentType?.slice(0, 50) });
      const formData = await request.formData();
      const formKeys = [...formData.keys()];
      devLog("FormDataKeys", { requestId, formKeys });
      const mode = formData.get("mode") || "text";
      const prompt = formData.get("prompt") || "";
      const file = formData.get("image");
      body = { mode, prompt };
      if (file && file instanceof Blob) {
        const buf = await file.arrayBuffer();
        body.imageBase64 = Buffer.from(buf).toString("base64");
        devLog("StartFrameParsed", {
          requestId,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          base64Len: body.imageBase64?.length,
        });
      } else {
        devLog("StartFrameMissing", { requestId, hasFile: !!file, fileType: typeof file });
      }
      devLog("Payload", { requestId, mode, prompt: prompt?.slice(0, 80), hasImage: !!body.imageBase64 });
    } else {
      const raw = await request.text();
      devLog("RawBody", { requestId, rawLength: raw?.length, rawPreview: raw?.slice(0, 500) });
      body = raw ? JSON.parse(raw) : {};
      devLog("Payload", { requestId, body, bodyKeys: body ? Object.keys(body) : [] });
    }
  } catch (parseErr) {
    devLog("ParseError", { requestId, error: parseErr?.message });
    return NextResponse.json(
      { ok: false, error: { code: "VALIDATION_ERROR", message: "Invalid request body", requestId } },
      { status: 400 }
    );
  }

  try {
    const gatewayPayload = {
      ...body,
      imageBase64: body.imageBase64 ? `[${body.imageBase64.length} chars]` : undefined,
    };
    devLog("CallGateway", { requestId, body: gatewayPayload });
    const result = await createVideoJob(body);
    devLog("GatewayResult", { requestId, result });
    const response = {
      ok: true,
      data: { jobId: result.jobId, requestId: result.requestId },
      requestId,
    };
    devLog("Response", { requestId, response });
    return NextResponse.json(response);
  } catch (err) {
    devLog("Error", {
      requestId: err.requestId || requestId,
      code: err.code,
      message: err.message,
      stack: err.stack,
    });
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: err.code || "EDEN_API_ERROR",
          message: err.message || "Video job creation failed",
          requestId: err.requestId || requestId,
        },
      },
      { status: 500 }
    );
  }
}

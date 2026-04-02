import { NextResponse } from "next/server";
import { getVideoJobStatus } from "@/libs/ai/eden/videoGateway";

function generateRequestId() {
  return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : "status-" + Date.now();
}

function devLog(step, data) {
  if (process.env.NODE_ENV === "development") {
    
  }
}

export async function GET(request) {
  const requestId = generateRequestId();
  devLog("Start", { requestId });

  if (!process.env.EDEN_AI_API_KEY) {
    devLog("ConfigError", { requestId, hasKey: false });
    return NextResponse.json(
      { ok: false, error: { code: "CONFIG", message: "Server configuration error", requestId } },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get("jobId");
  devLog("Params", { requestId, jobId, url: request.url });

  if (!jobId) {
    devLog("ValidationError", { requestId });
    return NextResponse.json(
      { ok: false, error: { code: "VALIDATION_ERROR", message: "jobId required", requestId } },
      { status: 400 }
    );
  }

  devLog("CallGateway", { requestId, jobId });
  const status = await getVideoJobStatus(jobId);
  devLog("GatewayResult", { requestId, jobId, status });

  const response = { ok: true, data: status, requestId };
  devLog("Response", { requestId, response });
  return NextResponse.json(response);
}

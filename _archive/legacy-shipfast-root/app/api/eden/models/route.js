import { NextResponse } from "next/server";
import { getModels, registryVersion, lastUpdated } from "@/libs/ai/eden/modelRegistry";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const modality = searchParams.get("modality") || undefined;
  const streaming = searchParams.get("streaming");
  const filters = { modality };
  if (streaming !== undefined) filters.streaming = streaming === "true";
  const list = getModels(filters);
  const requestId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : "models-" + Date.now();
  return NextResponse.json({
    ok: true,
    data: { models: list, registryVersion, lastUpdated },
    requestId,
  });
}

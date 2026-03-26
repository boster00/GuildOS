import { NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";
import { fetchRankingKeywords } from "@/libs/monkey/tools/dataForSeo";
import { finishExternalRequest } from "@/libs/monkey/tools/external_requests";

/**
 * Get default location code from environment variable
 * Falls back to 2840 (United States) if not set
 */
function getDefaultLocationCode() {
  const envCode = process.env.DATAFORSEO_DEFAULT_LOCATION;
  if (envCode) {
    const parsed = parseInt(envCode, 10);
    if (!isNaN(parsed)) {
      return parsed;
    }
  }
  return 2840; // Fallback to United States
}

export async function POST(request) {
  const externalRequestId = request.headers.get("x-external-request-id") ?? null;
  const startTime = Date.now();
  const supabase = await createClient();
  try {
    const body = await request.json();
    // location_code can be null for Worldwide, default from env if not provided
    const { urls, limit = 20, location_code } = body;
    const finalLocationCode = location_code !== undefined ? location_code : getDefaultLocationCode();
    if (!Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json(
        { error: "URLs array is required" },
        { status: 400 }
      );
    }

    // Use centralized DataForSEO function from monkey

    const result = await fetchRankingKeywords(urls, limit, finalLocationCode);

    if (!result.isToolVerified) {
      await finishExternalRequest(supabase, {
        externalRequestId,
        status: "failed",
        errorMessage: result.notes || "Failed to fetch ranking keywords",
        latencyMs: Date.now() - startTime,
      });
      return NextResponse.json(
        { error: result.notes || "Failed to fetch ranking keywords" },
        { status: 500 }
      );
    }

    await finishExternalRequest(supabase, {
      externalRequestId,
      status: "success",
      responsePreview: JSON.stringify(result),
      latencyMs: Date.now() - startTime,
    });

    
    
    return NextResponse.json({ 
      results: result.results,
      cost: result.cost,
      taskCosts: result.taskCosts,
    });
  } catch (error) {
    await finishExternalRequest(supabase, {
      externalRequestId,
      status: "failed",
      errorMessage: error?.message ?? String(error),
      latencyMs: Date.now() - startTime,
    });
    return NextResponse.json(
      { error: error.message || "Failed to fetch ranking keywords" },
      { status: 500 }
    );
  }
}


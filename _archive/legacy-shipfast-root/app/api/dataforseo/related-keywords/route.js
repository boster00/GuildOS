import { NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";
import { fetchKeywordCandidates, getLocationName } from "@/libs/monkey/tools/dataForSeo";
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
    const { keywords, depth = 0, limit = 100, location_code } = body;
    const finalLocationCode = location_code !== undefined ? location_code : getDefaultLocationCode();

    if (!Array.isArray(keywords) || keywords.length === 0) {
      return NextResponse.json(
        { error: "Keywords array is required" },
        { status: 400 }
      );
    }

    // Validate depth (0-4)
    const validDepth = Math.max(0, Math.min(4, parseInt(depth) || 0));
    // Validate limit (1-1000)
    const validLimit = Math.max(1, Math.min(1000, parseInt(limit) || 100));
    // Use monkey's fetchKeywordCandidates (same as playground) for consistent response format
    
    const result = await fetchKeywordCandidates(
      keywords,
      finalLocationCode,
      "en",
      validDepth,
      validLimit
    );

    await finishExternalRequest(supabase, {
      externalRequestId,
      status: "success",
      responsePreview: JSON.stringify(result),
      latencyMs: Date.now() - startTime,
    });
    
    

    // Return the candidates directly from fetchKeywordCandidates (monkey workflow)
    // Frontend should use the same transformation logic
    // Return format: { candidates: [...], region: "...", isToolVerified: true }
    return NextResponse.json({ 
      candidates: result.candidates || [],
      region: result.region || null,
      isToolVerified: result.isToolVerified,
      notes: result.notes,
    });
  } catch (error) {
    await finishExternalRequest(supabase, {
      externalRequestId,
      status: "failed",
      errorMessage: error?.message ?? String(error),
      latencyMs: Date.now() - startTime,
    });
    return NextResponse.json(
      { error: error.message || "Failed to fetch related keywords" },
      { status: 500 }
    );
  }
}


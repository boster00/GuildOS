import { NextResponse } from "next/server";
import { fetchSearchVolumes } from "@/libs/monkey/tools/dataForSeo";

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
  try {
    const body = await request.json();
    const { keywords, location_code = getDefaultLocationCode() } = body;

    if (!Array.isArray(keywords) || keywords.length === 0) {
      return NextResponse.json(
        { error: "Keywords array is required" },
        { status: 400 }
      );
    }

    // Use centralized DataForSEO function from monkey
    const result = await fetchSearchVolumes(keywords, location_code);
    if (!result.isToolVerified) {
      return NextResponse.json(
        { error: result.notes || "Failed to fetch search volumes" },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      results: result.results,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch search volumes" },
      { status: 500 }
    );
  }
}


import { NextResponse } from "next/server";
import { fetchKeywordPosition } from "@/libs/monkey/tools/dataForSeo";

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
    const { keyword, url, location_code = getDefaultLocationCode(), language_code = "en" } = body;

    if (!keyword || typeof keyword !== "string") {
      return NextResponse.json(
        { error: "Keyword is required" },
        { status: 400 }
      );
    }

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "URL is required" },
        { status: 400 }
      );
    }

    // Use centralized DataForSEO function from monkey
    const result = await fetchKeywordPosition(keyword, url, location_code, language_code);

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch keyword position" },
      { status: 500 }
    );
  }
}


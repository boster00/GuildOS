import { NextResponse } from "next/server";
import { initMonkey } from "@/libs/monkey";

export async function POST(request) {
  try {
    const body = await request.json();
    const { urls } = body;

    if (!Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json(
        { error: "URLs array is required" },
        { status: 400 }
      );
    }

    const monkey = await initMonkey();
    monkey.loadUserContext(body?.user_context ?? {});

    try {
      // Extract all URLs in a single request
      const results = await monkey.webExtract(urls);

      // Map Tavily results to our format
      const extractedPages = results.map((result) => ({
        url: result.url,
        content: result.raw_content || "",
        title: result.title || "",
        success: true,
      }));

      return NextResponse.json({ pages: extractedPages });
    } catch (err) {
      // Return error response with failed URLs
      const extractedPages = urls.map((url) => ({
        url,
        content: null,
        title: null,
        success: false,
        error: err.message,
      }));

      return NextResponse.json(
        { pages: extractedPages, error: err.message },
        { status: 500 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Failed to extract pages" },
      { status: 500 }
    );
  }
}
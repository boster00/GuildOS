import { NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";
import { initMonkey } from "@/libs/monkey";
import { finishExternalRequest } from "@/libs/monkey/tools/external_requests";

export async function POST(request) {
  const externalRequestId = request.headers.get("x-external-request-id") ?? null;
  const startTime = Date.now();
  const supabase = await createClient();
  try {
    const body = await request.json();
    const { query } = body;

    if (!query || typeof query !== "string") {
      return NextResponse.json(
        { error: "Query is required and must be a string" },
        { status: 400 }
      );
    }

    const monkey = await initMonkey();
    monkey.loadUserContext(body?.user_context ?? {});

    // Search using Tavily
    const { maxResults = 5 } = body;
    
    try {
      const searchResults = await monkey.webSearch(query, { maxResults });
      
      if (!searchResults || searchResults.length === 0) {
        await finishExternalRequest(supabase, {
          externalRequestId,
          status: "success",
          responsePreview: "[]",
          latencyMs: Date.now() - startTime,
        });
        return NextResponse.json(
          { error: "No results found" },
          { status: 404 }
        );
      }

      await finishExternalRequest(supabase, {
        externalRequestId,
        status: "success",
        responsePreview: JSON.stringify(searchResults),
        latencyMs: Date.now() - startTime,
      });

      // Return formatted results
      const results = searchResults.map(result => ({
        url: result.url,
        title: result.title || result.url,
        snippet: result.content || result.snippet || "",
        score: result.score || null,
      }));

      return NextResponse.json({
        results,
      });
    } catch (error) {
      await finishExternalRequest(supabase, {
        externalRequestId,
        status: "failed",
        errorMessage: error?.message ?? String(error),
        latencyMs: Date.now() - startTime,
      });
      return NextResponse.json(
        { error: error.message || "Failed to search. Please check your Tavily API key configuration." },
        { status: 500 }
      );
    }
  } catch (error) {
    await finishExternalRequest(supabase, {
      externalRequestId,
      status: "failed",
      errorMessage: error?.message ?? String(error),
      latencyMs: Date.now() - startTime,
    });
    return NextResponse.json(
      { error: error.message || "Failed to search" },
      { status: 500 }
    );
  }
}
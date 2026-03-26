import { NextResponse } from "next/server";
import { initMonkey } from "@/libs/monkey";
import { createClient } from "@/libs/supabase/server";
import { finishExternalRequest } from "@/libs/monkey/tools/external_requests";

export async function POST(request) {
  const externalRequestId = request.headers.get("x-external-request-id") ?? null;
  const startTime = Date.now();
  const supabase = await createClient();
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { message } = body;

    if (!message || !message.trim()) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    // Initialize Monkey
    const monkey = await initMonkey();
    monkey.loadUserContext({ ...(body?.user_context ?? {}), userId: user?.id });

    // Call AI with the message directly
    // When returnMetadata is false, monkey.AI returns just the output string
    const output = await monkey.AI(message, {
      vendor: "openai",
      model: "gpt-4o",
      returnMetadata: false,
    });

    // Ensure output is a string
    const messageText = typeof output === 'string' ? output : String(output);

    await finishExternalRequest(supabase, {
      externalRequestId,
      status: "success",
      responsePreview: messageText,
      latencyMs: Date.now() - startTime,
    });

    return NextResponse.json({ 
      message: messageText 
    });
  } catch (error) {
    await finishExternalRequest(supabase, {
      externalRequestId,
      status: "failed",
      errorMessage: error?.message ?? String(error),
      latencyMs: Date.now() - startTime,
    });
    // Initialize monkey for logging if not already done
    let monkey;
    try {
      monkey = await initMonkey();
      monkey.log("Error in suggest-research-prompts:", error);
    } catch (logError) {
      // Fallback to console if monkey initialization fails
    }
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

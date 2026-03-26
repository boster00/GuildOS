/**
 * API endpoint for running agents
 * Supports both streaming and non-streaming modes
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";
import { runAgent, createSessionId } from "@/libs/agents/runner";
import { clarificationQuestionsAgent } from "@/libs/agents/agents/clarificationQuestionsAgent";
import { log } from "@/libs/monkey/ui/logger";

// Map agent names to agent instances
const AGENTS: Record<string, any> = {
  clarification_questions: clarificationQuestionsAgent,
  // Add more agents here as we migrate
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      agentName,
      input,
      sessionId,
      campaignId,
      stream = false,
      useMemorySession = false, // For dev/testing
    } = body;

    if (!agentName) {
      return NextResponse.json(
        { error: "agentName is required" },
        { status: 400 }
      );
    }

    if (!input) {
      return NextResponse.json(
        { error: "input is required" },
        { status: 400 }
      );
    }

    // Authenticate user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get agent
    const agent = AGENTS[agentName];
    if (!agent) {
      return NextResponse.json(
        { error: `Unknown agent: ${agentName}` },
        { status: 400 }
      );
    }

    // Use provided sessionId or create new one
    const finalSessionId = sessionId || createSessionId();

    log(`[agents/run API] Running agent: ${agentName}, sessionId: ${finalSessionId}`);

    // Handle streaming
    if (stream) {
      const stream = await runAgent({
        agent,
        input,
        sessionId: finalSessionId,
        userId: user.id,
        campaignId,
        stream: true,
        useMemorySession,
      }) as AsyncIterable<any>;

      // Return SSE stream
      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of stream) {
              const data = JSON.stringify(chunk);
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            }
            controller.close();
          } catch (error: any) {
            controller.error(error);
          }
        },
      });

      return new Response(readable, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });
    }

    // Non-streaming mode
    const result = await runAgent({
      agent,
      input,
      sessionId: finalSessionId,
      userId: user.id,
      campaignId,
      stream: false,
      useMemorySession,
    });

    return NextResponse.json({
      ok: true,
      result,
    });
  } catch (error: any) {
    log(`[agents/run API] ❌ Error: ${error.message}`);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}

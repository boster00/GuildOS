/**
 * API endpoint for Open Agent Mode (Experimental)
 * 
 * Uses minimal constraints - agent decides:
 * - Which sections to include
 * - Content format for each section
 * - HTML structure and Tailwind classes
 */

import { NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";
import { runAgent, createSessionId } from "@/libs/agents";
import { openArticleAgent } from "@/libs/agents/agents/openArticleAgent";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { 
      model = "high",
      prompt,
      icp,
      offer,
      theme = "default",
    } = body;

    if (!prompt || !icp || !offer) {
      return NextResponse.json(
        { error: "prompt, icp, and offer are required" },
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

    // Create session ID
    const sessionId = createSessionId();

    // Build context for agent
    const agentContext = `
User Request: ${prompt}

Target Audience (ICP):
- Name: ${icp.name}
- Description: ${icp.description || "Not specified"}

Offer:
- Name: ${offer.name}
- Description: ${offer.description || "Not specified"}

Theme: ${theme}

Your task: Create a complete landing page that effectively communicates the value of this offer to the target audience. Use your judgment to select appropriate sections, formats, and content.
`;

    // Run agent without tools (simplified approach)
    const rawResult = await runAgent({
      agent: openArticleAgent,
      input: agentContext,
      sessionId,
      userId: user.id,
      agentType: "open_article",
      stream: false,
    });

    // Type guard: Since stream is false, result is AgentRunResult not AsyncIterable
    const result = rawResult as any;

    // Extract HTML from agent output
    let html = "";
    let sections = [];
    
    if (result.finalOutput) {
      // Parse agent output to extract HTML
      if (typeof result.finalOutput === "string") {
        html = result.finalOutput;
      } else if (result.finalOutput.html) {
        html = result.finalOutput.html;
      }
      
      if (result.finalOutput.sections) {
        sections = result.finalOutput.sections;
      }
    }

    return NextResponse.json({
      success: true,
      mode: "open_agent",
      sessionId: result.sessionId,
      article: {
        html,
        sections,
        metadata: {
          agentMode: "open",
          theme,
          toolCalls: result.metadata?.toolCalls?.length || 0,
        },
      },
      agentSteps: result.metadata?.steps || [],
      reasoning: result.metadata?.reasoning || [],
    });

  } catch (error: any) {

    return NextResponse.json(
      { error: error.message || "Failed to generate article" },
      { status: 500 }
    );
  }
}

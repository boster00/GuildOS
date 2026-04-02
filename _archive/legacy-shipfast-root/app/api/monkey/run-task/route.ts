/**
 * API route for running Monkey tasks
 */

import { NextResponse } from "next/server";
// Use explicit relative path to avoid conflict with libs/monkey.js
// The alias @/libs/monkey resolves to libs/monkey.js instead of libs/monkey/index.ts
// Explicitly import from index.ts file
import { runTask } from "../../../../libs/monkey/index";
import { createClient } from "@/libs/supabase/server";
import { logActionTrigger } from "../../../../libs/monkey/ui/logger";

export async function POST(request: Request) {
  try {
    // Parse request body safely
    let body: any;
    try {
      body = await request.json();
    } catch (parseError: any) {
      return NextResponse.json(
        { error: "Invalid JSON in request body", details: parseError.message },
        { status: 400 }
      );
    }

    // Authenticate user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized", details: authError?.message },
        { status: 401 }
      );
    }
    const { model, taskType, campaignContext, userInput, constraints, outputFormat, feedback } = body;

    // Validate required fields
    if (!taskType) {
      return NextResponse.json(
        { error: "taskType is required" },
        { status: 400 }
      );
    }
    // Check if this is a step continuation request
    const isStepContinuation = userInput?.runId && userInput?.stepIndex;
    if (isStepContinuation) {
    }

    // Get user API keys via database API
    let userApiKeys: Array<{ vendor: string; key: string }> | undefined;
    try {
      // Read user API keys from database
      const { data: apiKeys } = await supabase
        .from('user_api_keys')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true);
      if (apiKeys && apiKeys.length > 0) {
        userApiKeys = apiKeys.map((key: any) => ({
          vendor: key.vendor || key.provider || 'openai',
          key: key.api_key_encrypted || key.key || '',
        }));
      }
      
      // Add environment API keys
      const envKeys: Array<{ vendor: string; key: string }> = [];
      if (process.env.CHATGPT_API_KEY) {
        envKeys.push({ vendor: 'openai', key: process.env.CHATGPT_API_KEY });
      }
      if (process.env.PERPLEXITY_API_KEY) {
        envKeys.push({ vendor: 'perplexity', key: process.env.PERPLEXITY_API_KEY });
      }
      if (process.env.ANTHROPIC_API_KEY) {
        envKeys.push({ vendor: 'anthropic', key: process.env.ANTHROPIC_API_KEY });
      }
      if (envKeys.length > 0) {
        userApiKeys = [...(userApiKeys || []), ...envKeys];
      }
    } catch (e) {
      // Ignore - will use env keys only
    }

    const taskRequest = {
      model,
      taskType,
      campaignContext,
      userInput,
      constraints,
      outputFormat,
      feedback, // Part A: Include feedback if provided
    };
    // Log action trigger
    const mode = model === "agent" ? "agentic" : (model === "high" ? "high" : "mid");
    const actionName = taskType.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
    logActionTrigger(actionName, mode, taskType, {
      hasContext: !!campaignContext,
      hasFeedback: !!feedback,
      userInputLength: userInput?.query?.length || 0,
    });
    const startTime = Date.now();
    
    let result;
    try {
      result = await runTask(taskRequest, {
        userApiKeys,
      });
      const duration = Date.now() - startTime;
    } catch (runTaskError: any) {
      throw runTaskError; // Re-throw to be caught by outer catch
    }

    // Ensure result is always a valid response
    return NextResponse.json(
      result || { ok: false, error: "No result returned" },
      { 
        status: 200,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  } catch (error: any) {
    // Log full error details
    if (error?.cause) {
    }
    // Always return JSON, never HTML
    const errorResponse = {
      ok: false,
      error: error?.message || "Failed to run task",
      errorType: error?.name || "UnknownError",
      ...(process.env.NODE_ENV === "development" && {
        details: error?.stack,
        fullError: String(error),
        cause: error?.cause
      })
    };
    return NextResponse.json(
      errorResponse,
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  }
}


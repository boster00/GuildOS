/**
 * Agent Runner Service
 * Centralized service for running agents with session management and streaming
 */

import { run, Agent, Session } from "@openai/agents";
import { SupabaseSession } from "./session/supabaseSession";
import { MemorySession } from "./session/memorySession";
import { log } from "@/libs/monkey/ui/logger";

export interface RunAgentParams {
  agent: Agent;
  input: string;
  sessionId?: string;
  userId: string;
  campaignId?: string;
  agentType?: string; // Type of agent (e.g., "clarification_questions", "write_article")
  stream?: boolean;
  useMemorySession?: boolean; // For dev/testing
}

export interface AgentRunResult {
  finalOutput: string;
  runId?: string;
  sessionId: string;
  metadata?: {
    toolCalls?: Array<{ name: string; input?: any; result?: any; duration?: number }>;
    reasoning?: string[];
    steps?: number;
    [key: string]: any;
  };
}

/**
 * Run an agent with optional session and streaming
 */
export async function runAgent({
  agent,
  input,
  sessionId,
  userId,
  campaignId,
  agentType = "general",
  stream = false,
  useMemorySession = false,
}: RunAgentParams): Promise<AgentRunResult | AsyncIterable<any>> {
  log(`[runAgent] Starting agent run: ${agent.name}, sessionId: ${sessionId || "none"}, agentType: ${agentType}`);

  // Create or load session
  let session: Session;
  if (useMemorySession || !sessionId) {
    session = new MemorySession() as Session;
    log(`[runAgent] Using memory session (dev mode)`);
  } else {
    try {
      const supabaseSession = new SupabaseSession(sessionId, userId, campaignId, agentType);
      await supabaseSession.initialize();
      session = supabaseSession as Session;
      log(`[runAgent] Using Supabase session: ${sessionId} (type: ${agentType})`);
    } catch (error: any) {
      // Fallback to memory session if Supabase table doesn't exist
      if (error.message?.includes("does not exist") || error.message?.includes("Could not find the table")) {
        log(`[runAgent] ⚠️  Supabase table not found, falling back to memory session`);
        log(`[runAgent] 💡 Run migration: supabase/migrations/create_agent_sessions_table.sql`);
        session = new MemorySession() as Session;
      } else {
        throw error;
      }
    }
  }

  try {
    if (stream) {
      // Return stream for SSE
      const streamResult = await run(agent, input, { session, stream: true });
      return streamResult as AsyncIterable<any>;
    } else {
      // Return final result
      const result = await run(agent, input, { session, stream: false }) as any;
      
      // Extract tool calls and reasoning from result
      const toolCalls = result.toolCalls?.map((tc: any) => ({
        name: tc.name || tc.function?.name || "unknown",
        input: tc.input || tc.function?.arguments,
        result: tc.result,
        duration: tc.duration,
      })) || [];

      // Extract reasoning steps (if available in result)
      const reasoning: string[] = [];
      if (result.steps) {
        result.steps.forEach((step: any, idx: number) => {
          if (step.type === "reasoning" || step.reasoning) {
            reasoning.push(step.reasoning || step.content || `Step ${idx + 1}`);
          }
        });
      }

      return {
        finalOutput: result.finalOutput || "",
        runId: result.runId,
        sessionId: sessionId || "memory",
        metadata: {
          toolCalls,
          reasoning: reasoning.length > 0 ? reasoning : undefined,
          steps: result.steps?.length || 0,
          toolCallsCount: toolCalls.length,
        },
      };
    }
  } catch (error: any) {
    log(`[runAgent] ❌ Error running agent: ${error.message}`);
    throw new Error(`Agent run failed: ${error.message}`);
  }
}

/**
 * Create a new session ID
 */
export function createSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

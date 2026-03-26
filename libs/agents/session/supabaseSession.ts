/**
 * Supabase-backed session adapter for Agents SDK
 * Stores conversation history in Supabase for campaign persistence
 */

import { Session } from "@openai/agents";
import type { AgentInputItem } from "@openai/agents";
import { createClient } from "@/libs/supabase/server";

// Message type from Agents SDK (not exported, so we define it)
type Message = {
  role: "user" | "assistant" | "system";
  content: string;
  [key: string]: any;
};

export interface SupabaseSessionData {
  session_id: string;
  campaign_id?: string;
  user_id: string;
  messages: Message[];
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export class SupabaseSession implements Session {
  private sessionId: string;
  private userId: string;
  private campaignId?: string;
  private agentType: string;
  private messages: Message[] = [];
  private initialized: boolean = false;

  constructor(sessionId: string, userId: string, campaignId?: string, agentType: string = "general") {
    this.sessionId = sessionId;
    this.userId = userId;
    this.campaignId = campaignId;
    this.agentType = agentType;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("agent_sessions")
        .select("*")
        .eq("session_id", this.sessionId)
        .eq("user_id", this.userId)
        .single();

      if (error) {
        // PGRST116 = not found, which is OK for new sessions
        if (error.code === "PGRST116") {
          // Session doesn't exist yet, will be created on first save
          this.initialized = true;
          return;
        }
        
        // Check if table doesn't exist (schema cache error)
        if (error.message?.includes("Could not find the table") || 
            error.message?.includes("relation") ||
            error.code === "42P01") {
          throw new Error(
            `Database table 'agent_sessions' does not exist. ` +
            `Please run the migration: supabase/migrations/create_agent_sessions_table.sql ` +
            `in your Supabase Dashboard SQL Editor.`
          );
        }
        
        throw new Error(`Failed to load session: ${error.message}`);
      }

      if (data) {
        this.messages = (data.messages as Message[]) || [];
      } else {
        // Create new session
        const { error: insertError } = await supabase
          .from("agent_sessions")
          .insert({
            session_id: this.sessionId,
            user_id: this.userId,
            campaign_id: this.campaignId,
            agent_type: this.agentType,
            messages: [],
            metadata: {},
          });

        if (insertError) {
          throw new Error(`Failed to create session: ${insertError.message}`);
        }
      }

      this.initialized = true;
    } catch (error: any) {
      throw new Error(`Session initialization failed: ${error.message}`);
    }
  }

  async getMessages(): Promise<Message[]> {
    if (!this.initialized) {
      await this.initialize();
    }
    return this.messages;
  }

  async addMessage(message: Message): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    this.messages.push(message);

    try {
      const supabase = await createClient();
      const { error } = await supabase
        .from("agent_sessions")
        .update({
          messages: this.messages,
          updated_at: new Date().toISOString(),
        })
        .eq("session_id", this.sessionId)
        .eq("user_id", this.userId);

      if (error) {
        throw new Error(`Failed to save message: ${error.message}`);
      }
    } catch (error: any) {
      // Don't throw - allow session to continue even if persistence fails
    }
  }

  async clear(): Promise<void> {
    this.messages = [];

    try {
      const supabase = await createClient();
      const { error } = await supabase
        .from("agent_sessions")
        .update({
          messages: [],
          updated_at: new Date().toISOString(),
        })
        .eq("session_id", this.sessionId)
        .eq("user_id", this.userId);

      if (error) {
        throw new Error(`Failed to clear session: ${error.message}`);
      }
    } catch (error: any) {
    }
  }

  async getSessionId(): Promise<string> {
    return this.sessionId;
  }

  // Additional Session interface methods (aliases for compatibility)
  async getItems(limit?: number): Promise<AgentInputItem[]> {
    return this.messages as any as AgentInputItem[];
  }

  async addItems(items: AgentInputItem[]): Promise<void> {
    for (const item of items) {
      await this.addMessage(item as any);
    }
  }

  async popItem(): Promise<AgentInputItem | undefined> {
    const messages = await this.getMessages();
    return messages.pop() as any;
  }

  async clearSession(): Promise<void> {
    return this.clear();
  }
}

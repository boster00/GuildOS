/**
 * In-memory session for development/testing
 * Use SupabaseSession for production
 */

import { Session } from "@openai/agents";
import type { AgentInputItem } from "@openai/agents";

// Message type from Agents SDK (not exported, so we define it)
type Message = {
  role: "user" | "assistant" | "system";
  content: string;
  [key: string]: any;
};

export class MemorySession implements Session {
  private messages: Message[] = [];

  async getMessages(): Promise<Message[]> {
    return this.messages;
  }

  async addMessage(message: Message): Promise<void> {
    this.messages.push(message);
  }

  async clear(): Promise<void> {
    this.messages = [];
  }

  async getSessionId(): Promise<string> {
    return "memory";
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
    return this.messages.pop() as any;
  }

  async clearSession(): Promise<void> {
    return this.clear();
  }
}

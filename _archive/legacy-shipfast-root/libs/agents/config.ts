/**
 * Agents SDK Configuration
 * Feature flags and settings for gradual migration
 */

export const AGENTS_CONFIG = {
  // Feature flags for gradual migration
  useAgentsSDK: {
    clarificationQuestions: process.env.USE_AGENTS_SDK_CLARIFICATION === "true",
    writeArticle: process.env.USE_AGENTS_SDK_WRITE_ARTICLE === "true",
    // Add more flags as we migrate other steps
  },
  
  // Session settings
  defaultSessionType: process.env.AGENTS_SESSION_TYPE || "memory", // "memory" | "supabase"
  
  // Development mode
  devMode: process.env.NODE_ENV === "development",
};

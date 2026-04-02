/**
 * AI Model Configuration
 * 
 * Centralized configuration for AI models used throughout the application.
 * 
 * IMPORTANT: All model names must be defined in environment variables only.
 * No hardcoded model names are allowed in code (including comments).
 * 
 * Required environment variables:
 * - NEXT_PUBLIC_AI_MODEL_ADVANCED (client-side) or AI_MODEL_ADVANCED (server-side)
 * - NEXT_PUBLIC_AI_MODEL_LARGE_CONTEXT (client-side) or AI_MODEL_LARGE_CONTEXT (server-side)
 * - NEXT_PUBLIC_AI_MODEL_STANDARD (client-side) or AI_MODEL_STANDARD (server-side)
 * - AI_MODEL_IMAGE (server-side) - comma-separated list for image generation fallback chain
 * 
 * For monkey.js model tiers (backward compatible):
 * - MONKEY_MODEL_AGENT (defaults to AI_MODEL_ADVANCED if not set)
 * - MONKEY_MODEL_HIGH (defaults to AI_MODEL_ADVANCED if not set)
 * - MONKEY_MODEL_MID (defaults to AI_MODEL_STANDARD if not set)
 */

export const AI_MODELS = {
  // Advanced model for tasks requiring deep reasoning
  ADVANCED: process.env.NEXT_PUBLIC_AI_MODEL_ADVANCED || process.env.AI_MODEL_ADVANCED,
  
  // Large context model for huge prompts (competitor analysis, multiple pages, etc.)
  LARGE_CONTEXT: process.env.NEXT_PUBLIC_AI_MODEL_LARGE_CONTEXT || process.env.AI_MODEL_LARGE_CONTEXT,
  
  // Standard model for straightforward creative tasks
  STANDARD: process.env.NEXT_PUBLIC_AI_MODEL_STANDARD || process.env.AI_MODEL_STANDARD,
  
  // Image generation models (fallback chain)
  IMAGE: process.env.AI_MODEL_IMAGE ? process.env.AI_MODEL_IMAGE.split(',').map(m => m.trim()) : [],
};

// Helper function to get model based on task complexity
export function getModelForTask(taskType) {
  const advancedTasks = [
    'icp',               // ICP analysis with profitability insights
    'phase2-title',      // Phase 2 requires strategic analysis
    'outline',           // Full content generation
    'content-assistant', // Inline content editing
  ];
  
  return advancedTasks.includes(taskType) ? AI_MODELS.ADVANCED : AI_MODELS.STANDARD;
}

// Monkey.js model tiers (for backward compatibility)
// These map to the main models, but can be overridden with MONKEY_MODEL_* env vars
export const MONKEY_MODELS = {
  // TODO: remove AGENT tier — "agent" model tier is deprecated
  AGENT: process.env.MONKEY_MODEL_AGENT || AI_MODELS.ADVANCED,
  HIGH: process.env.MONKEY_MODEL_HIGH || AI_MODELS.ADVANCED,
  MID: process.env.MONKEY_MODEL_MID || AI_MODELS.STANDARD,
};

// Helper function to resolve monkey model tier ("agent", "high", "mid") to actual model name
export function resolveMonkeyModelTier(model) {
  if (model === "agent") {
    return MONKEY_MODELS.AGENT;
  } else if (model === "high") {
    return MONKEY_MODELS.HIGH;
  } else if (model === "mid") {
    return MONKEY_MODELS.MID;
  }
  // Not a tier, return as-is (direct model name)
  return model;
}

export default AI_MODELS;


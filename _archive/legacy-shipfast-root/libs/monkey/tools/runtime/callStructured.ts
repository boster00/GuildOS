/**
 * Structured JSON call with Ajv validation and repair
 */

import Ajv from "ajv";
import { callChatWrapper, CallChatOptions } from "./callChat";
import { resolveModel } from "./modelResolver";
import { getModelConfig } from "../../references/config";
import { MonkeyModel, MonkeyErrorCode, MonkeyError } from "../../references/types";
import { log, getSizeLimits, shouldLogFull } from "../../ui/logger";
import { getRepairPrompt } from "../../prompts/repair";
import { ChatMessage } from "./providers/openai";

const ajv = new Ajv({ allErrors: true, strict: false });

export interface StructuredCallResult<T = any> {
  ok: boolean;
  data?: T;
  error?: MonkeyError;
  credits?: number; // CJGEO credits consumed (1 credit = $0.10 USD)
  failedAttempts?: Array<{
    attempt: number;
    reason: string;
    error?: any;
    timestamp: number;
  }>;
  finalAttempt?: number;
}

export interface StructuredCallOptions extends CallChatOptions {
  stepName?: string;
  maxAttempts?: number;
}

/**
 * Parse JSON from text, extracting first JSON object/array if wrapped in markdown or prose
 */
function parseJsonFromText(text: string): any {
  // Try direct parse first
  try {
    return JSON.parse(text.trim());
  } catch {
    // Try to extract JSON from markdown code blocks
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1] || jsonMatch[0]);
      } catch {
        // Continue to next attempt
      }
    }
    
    // Try to find first complete JSON object/array
    let braceCount = 0;
    let bracketCount = 0;
    let startIdx = -1;
    
    for (let i = 0; i < text.length; i++) {
      if (text[i] === '{') {
        if (startIdx === -1) startIdx = i;
        braceCount++;
      } else if (text[i] === '}') {
        braceCount--;
        if (braceCount === 0 && startIdx !== -1) {
          try {
            return JSON.parse(text.substring(startIdx, i + 1));
          } catch {
            startIdx = -1;
          }
        }
      } else if (text[i] === '[') {
        if (startIdx === -1) startIdx = i;
        bracketCount++;
      } else if (text[i] === ']') {
        bracketCount--;
        if (bracketCount === 0 && startIdx !== -1) {
          try {
            return JSON.parse(text.substring(startIdx, i + 1));
          } catch {
            startIdx = -1;
          }
        }
      }
    }
    
    throw new Error("Could not extract valid JSON from text");
  }
}

/**
 * Estimate token count from character count
 * Rough estimate: 1 token ≈ 4 characters (conservative)
 * This is a safe approximation for English text
 */
function estimateTokens(charCount: number): number {
  // Conservative estimate: 1 token per 4 characters
  return Math.ceil(charCount / 4);
}

/**
 * Get context window limit for a model tier (in tokens)
 */
function getModelContextLimit(model: MonkeyModel): number {
  const config = getModelConfig();
  const resolved = resolveModel(model);
  
  // Check actual model ID to determine limits
  if (resolved.modelId.includes("gpt-4o")) {
    return 128000; // GPT-4o: 128k tokens
  } else if (resolved.modelId.includes("gpt-4")) {
    return 128000; // GPT-4 variants: typically 128k
  } else if (resolved.modelId.includes("gpt-3.5-turbo")) {
    return 16385; // GPT-3.5-turbo: ~16k tokens
  } else if (resolved.modelId.includes("o1")) {
    return 200000; // o1 models: 200k tokens
  }
  
  // Default conservative limits based on tier
  switch (model) {
    case "agent":
    case "high":
      return 128000; // Assume high-tier models have large context
    case "mid":
      return 16385; // Assume mid-tier models have smaller context
    default:
      return 16385; // Conservative default
  }
}

/**
 * Determine if model should be upgraded based on prompt size
 */
function shouldUpgradeModel(model: MonkeyModel, totalChars: number): { upgrade: boolean; reason?: string } {
  // Only upgrade mid-tier models (not high/agent which already have large context)
  if (model === "high" || model === "agent") {
    return { upgrade: false };
  }
  
  // Estimate tokens from characters
  const estimatedTokens = estimateTokens(totalChars);
  const modelLimit = getModelContextLimit(model);
  
  // Reserve 20% of context for output (conservative)
  const usableInputTokens = Math.floor(modelLimit * 0.8);
  
  if (estimatedTokens > usableInputTokens) {
    return {
      upgrade: true,
      reason: `Prompt size (${estimatedTokens} estimated tokens) exceeds ${model} model limit (${usableInputTokens} usable tokens). Upgrading to "high" tier.`,
    };
  }
  
  return { upgrade: false };
}

export async function callStructured<T = any>(
  model: MonkeyModel,
  messages: ChatMessage[],
  schema: any,
  options: StructuredCallOptions = {}
): Promise<StructuredCallResult<T>> {
  const { stepName = "unknown", maxAttempts = 2 } = options;
  const limits = getSizeLimits();
  const effectiveMaxAttempts = Math.min(maxAttempts, limits.maxRetriesJson);
  
  // Calculate total prompt size
  const totalPromptChars = messages.reduce((sum, msg) => sum + msg.content.length, 0);
  
  // Check if we need to upgrade model due to prompt size
  const upgradeCheck = shouldUpgradeModel(model, totalPromptChars);
  const effectiveModel = upgradeCheck.upgrade ? "high" : model;
  
  if (upgradeCheck.upgrade) {
    log(`[${stepName}] [callStructured] ⚠️ ${upgradeCheck.reason}`);
  }
  
  // Minimal logging - only essential info
  if (shouldLogFull()) {
    log(`[${stepName}] [callStructured] Starting structured call`);
    log(`[${stepName}] [callStructured] Model: ${model}${effectiveModel !== model ? ` -> ${effectiveModel} (upgraded)` : ""}, Max attempts: ${effectiveMaxAttempts}`);
    log(`[${stepName}] [callStructured] Prompt size: ${totalPromptChars} chars (~${estimateTokens(totalPromptChars)} tokens)`);
  }
  
  // Ensure schema allows additionalProperties
  const schemaWithExtra = {
    ...schema,
    additionalProperties: true,
  };
  
  const validate = ajv.compile(schemaWithExtra);
  
  let lastError: any = null;
  let lastText: string = "";
  const failedAttempts: Array<{ attempt: number; reason: string; error?: any; timestamp: number }> = [];
  
  // Check if we should use JSON mode and ensure messages contain "json"
  // Use effectiveModel (may be upgraded) for JSON mode detection
  const resolved = resolveModel(effectiveModel);
  const useJsonMode = resolved.provider === "openai" && 
    (resolved.modelId.includes("gpt-4") || resolved.modelId.includes("gpt-3.5-turbo"));
  
  // OpenAI requires the word "json" in at least one message when using JSON mode
  let messagesToUse = messages;
  if (useJsonMode) {
    const hasJsonWord = messages.some(msg => 
      msg.content.toLowerCase().includes("json")
    );
    
    if (!hasJsonWord) {
      // Add "json" to the last user message or system message
      messagesToUse = messages.map((msg, idx) => {
        if (idx === 0 && msg.role === "system") {
          return {
            ...msg,
            content: msg.content + "\n\nIMPORTANT: You must respond with valid JSON only.",
          };
        } else if (idx === messages.length - 1 && msg.role === "user") {
          return {
            ...msg,
            content: msg.content + "\n\nRemember: Output valid JSON only.",
          };
        }
        return msg;
      });
    }
  }
  
  for (let attempt = 1; attempt <= effectiveMaxAttempts; attempt++) {
    // Only log attempt number if retrying
    if (attempt > 1) {
      log(`[${stepName}] Retry attempt ${attempt}/${effectiveMaxAttempts}`);
    }
    
    try {
      // Use effectiveModel (may be upgraded from original model)
      const response = await callChatWrapper(effectiveModel, messagesToUse, {
        ...options,
        responseFormat: useJsonMode ? "json_object" : undefined,
      });
      lastText = response.text;
      
      if (shouldLogFull()) {
        log(`[${stepName}] [callStructured] [attempt ${attempt}] Response received (${lastText.length} chars)`);
      }
      
      // Check size limit
      if (lastText.length > limits.maxOutputCharsJson) {
        return {
          ok: false,
          error: {
            code: MonkeyErrorCode.OUTPUT_TOO_LARGE,
            message: `Output exceeds size limit (${lastText.length} > ${limits.maxOutputCharsJson})`,
            step: stepName,
          },
        };
      }
      
      // Parse JSON
      let parsed: any;
      try {
        parsed = parseJsonFromText(lastText);
        if (shouldLogFull()) {
          log(`[${stepName}] [callStructured] [attempt ${attempt}] ✅ JSON parsed: ${Array.isArray(parsed) ? `array[${parsed.length}]` : typeof parsed}`);
        }
      } catch (parseError: any) {
        log(`[${stepName}] ❌ JSON parse failed: ${parseError.message}`);
        lastError = parseError;
        
        failedAttempts.push({
          attempt,
          reason: "JSON parse failed",
          error: { message: parseError.message, preview: lastText.substring(0, 200) },
          timestamp: Date.now(),
        });
        
        if (attempt < effectiveMaxAttempts) {
          // Try repair
          const repairPrompt = getRepairPrompt(schema, parseError.message, lastText);
          messagesToUse = [
            ...messagesToUse.slice(0, -1), // Keep all but last user message
            { role: "user", content: repairPrompt },
          ];
          // Ensure "json" is still present for JSON mode
          if (useJsonMode && !repairPrompt.toLowerCase().includes("json")) {
            messagesToUse[messagesToUse.length - 1].content += "\n\nRemember: Output valid JSON only.";
          }
          continue;
        }
        
        return {
          ok: false,
          error: {
            code: MonkeyErrorCode.PARSE_FAILED,
            message: `Failed to parse JSON: ${parseError.message}`,
            step: stepName,
            details: { attempt, rawText: lastText.substring(0, 500) },
          },
          failedAttempts,
          finalAttempt: attempt,
        };
      }
      
      // Validate against schema
      if (shouldLogFull()) {
        log(`[${stepName}] [callStructured] [attempt ${attempt}] Validating against schema...`);
      }
      
      // If schema expects array but we got an object, try to wrap it
      if (schema?.type === "array" && !Array.isArray(parsed) && typeof parsed === "object" && parsed !== null) {
        log(`[${stepName}] [callStructured] [attempt ${attempt}] ⚠️ Schema expects array but got object - attempting to wrap in array`);
        const wrapped = [parsed];
        log(`[${stepName}] [callStructured] [attempt ${attempt}] Wrapped object into array: ${JSON.stringify(wrapped)}`);
        parsed = wrapped;
      }
      
      const valid = validate(parsed);
      if (!valid) {
        const validationErrors = validate.errors || [];
        
        if (shouldLogFull()) {
          log(`[${stepName}] [callStructured] [attempt ${attempt}] ❌ Validation failed with ${validationErrors.length} errors`);
          if (parsed && typeof parsed === "object") {
            log(`[${stepName}] [callStructured] [attempt ${attempt}] Parsed: ${Array.isArray(parsed) ? `array[${parsed.length}]` : `object{${Object.keys(parsed).join(", ")}}`}`);
          }
          validationErrors.slice(0, 5).forEach((e: any, idx: number) => {
            log(`[${stepName}] [callStructured] [attempt ${attempt}]   Error ${idx + 1}: ${e.instancePath || 'root'}: ${e.message}`);
          });
        }
        
        // Track failed validation attempt
        failedAttempts.push({
          attempt,
          reason: "Schema validation failed",
          error: {
            errors: validationErrors.slice(0, 5).map((e: any) => ({
              path: e.instancePath || 'root',
              message: e.message,
            })),
            totalErrors: validationErrors.length,
          },
          timestamp: Date.now(),
        });
        
        if (attempt < effectiveMaxAttempts) {
          // This is expected - we'll retry with repair prompt
          if (shouldLogFull()) {
            log(`[${stepName}] ⚠️ Validation failed, retrying...`);
          }
        } else {
          // Final attempt failed - this is a real error
          const keyErrors = validationErrors.slice(0, 2).map((e: any) => 
            `${e.instancePath || 'root'}: ${e.message}`
          );
          log(`[${stepName}] ❌ Schema validation failed: ${keyErrors.join("; ")}${validationErrors.length > 2 ? ` (+${validationErrors.length - 2} more)` : ""}`);
          
          if (shouldLogFull()) {
            log(`[${stepName}] Expected: ${schema?.type}, Got: ${typeof parsed}${Array.isArray(parsed) ? " (array)" : ""}`);
            if (schema?.type === "array" && !Array.isArray(parsed) && typeof parsed === "object" && parsed !== null) {
              log(`[${stepName}] ⚠️ Expected array but got single object`);
            }
            log(`[${stepName}] Full data:`, parsed);
          }
        }
        
        if (attempt < effectiveMaxAttempts) {
          // Try repair
          const repairPrompt = getRepairPrompt(
            schema,
            JSON.stringify(validationErrors, null, 2),
            JSON.stringify(parsed, null, 2)
          );
          messagesToUse = [
            ...messagesToUse.slice(0, -1),
            { role: "user", content: repairPrompt },
          ];
          // Ensure "json" is still present for JSON mode
          if (useJsonMode && !repairPrompt.toLowerCase().includes("json")) {
            messagesToUse[messagesToUse.length - 1].content += "\n\nRemember: Output valid JSON only.";
          }
          continue;
        }
        
        const parsedStr = JSON.stringify(parsed);
        return {
          ok: false,
          error: {
            code: MonkeyErrorCode.SCHEMA_INVALID,
            message: "Schema validation failed",
            step: stepName,
            details: { 
              attempt, 
              errors: validationErrors, 
              dataPreview: parsedStr.substring(0, 200),
            },
          },
          failedAttempts,
          finalAttempt: attempt,
        };
      }
      
      // Only log success if it was a retry
      if (attempt > 1) {
        log(`[${stepName}] ✓ Success on attempt ${attempt}`);
      }
      return {
        ok: true,
        data: parsed,
        credits: response.credits,
        failedAttempts: failedAttempts.length > 0 ? failedAttempts : undefined,
        finalAttempt: attempt,
      };
    } catch (error: any) {
      log(`[${stepName}] ❌ Attempt ${attempt} failed: ${error.message}`);
      lastError = error;
      
      // Track failed attempt
      failedAttempts.push({
        attempt,
        reason: "Provider call failed",
        error: { message: error.message, stack: error.stack?.substring(0, 200) },
        timestamp: Date.now(),
      });
      
      if (attempt === effectiveMaxAttempts) {
        return {
          ok: false,
          error: {
            code: MonkeyErrorCode.PROVIDER_ERROR,
            message: error.message || "Provider call failed",
            step: stepName,
            details: { attempt },
          },
          failedAttempts,
          finalAttempt: attempt,
        };
      }
    }
  }
  
  return {
    ok: false,
    error: {
      code: MonkeyErrorCode.REPAIR_EXHAUSTED,
      message: `Failed after ${effectiveMaxAttempts} attempts`,
      step: stepName,
      details: { lastError: lastError?.message, lastText: lastText.substring(0, 500) },
    },
  };
}

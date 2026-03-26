// ARCHIVED: Original path was libs/monkey/tools/runtime/callHtml.ts

/**
 * HTML generation with safety checks
 */

import { callChatWrapper, CallChatOptions } from "./callChat";
import { MonkeyModel, MonkeyErrorCode, MonkeyError } from "../../references/types";
import { log, getSizeLimits } from "../../ui/logger";
import { checkHtmlSafety } from "../htmlCheck";
import { ChatMessage } from "./providers/openai";
import { cleanHtmlMarkers } from "./sanitizeResponse";

export interface HtmlCallResult {
  ok: boolean;
  html?: string;
  credits?: number; // CJGEO credits consumed (1 credit = $0.10 USD)
  error?: MonkeyError;
}

export interface HtmlCallOptions extends CallChatOptions {
  stepName?: string;
  maxAttempts?: number;
}

export async function callHtml(
  model: MonkeyModel,
  messages: ChatMessage[],
  options: HtmlCallOptions = {}
): Promise<HtmlCallResult> {
  const { stepName = "html-generation", maxAttempts = 2 } = options;
  const limits = getSizeLimits();
  const effectiveMaxAttempts = Math.min(maxAttempts, limits.maxRetriesHtml);
  
  log(`[${stepName}] Starting HTML generation (max attempts: ${effectiveMaxAttempts})`);
  
  for (let attempt = 1; attempt <= effectiveMaxAttempts; attempt++) {
    log(`[${stepName}] Attempt ${attempt}/${effectiveMaxAttempts}`);
    
    try {
      const response = await callChatWrapper(model, messages, options);
      let html = response.text.trim();
      const responseCredits = response.credits || 0; // Credits from the API call
      
      // Remove markdown code blocks using centralized sanitization
      html = cleanHtmlMarkers(html);
      
      // Check size limit
      if (html.length > limits.maxOutputCharsHtml) {
        return {
          ok: false,
          error: {
            code: MonkeyErrorCode.OUTPUT_TOO_LARGE,
            message: `HTML output exceeds size limit (${html.length} > ${limits.maxOutputCharsHtml})`,
            step: stepName,
          },
        };
      }
      
      // Safety check
      const safetyCheck = checkHtmlSafety(html);
      if (!safetyCheck.ok) {
        log(`[${stepName}] HTML safety check failed:`, safetyCheck.issues);
        
        if (attempt < effectiveMaxAttempts) {
          // Try repair
          const repairPrompt = `Fix the following HTML to make it safe. Remove all <script> tags, inline event handlers (onclick, onload, etc.), and <style> tags. Preserve all semantic content and structure. Return only the fixed HTML with no explanations.

Unsafe HTML:
${html.substring(0, 5000)}

Fixed HTML:`;
          
          messages = [
            ...messages.slice(0, -1),
            { role: "user", content: repairPrompt },
          ];
          continue;
        }
        
        return {
          ok: false,
          error: {
            code: safetyCheck.issues?.some((i: string) => i.includes("parse")) 
              ? MonkeyErrorCode.HTML_PARSE_FAILED 
              : MonkeyErrorCode.HTML_UNSAFE,
            message: "HTML safety check failed",
            step: stepName,
            details: { attempt, issues: safetyCheck.issues },
          },
        };
      }
      
      log(`[${stepName}] HTML generation succeeded on attempt ${attempt}`);
      return {
        ok: true,
        html,
        credits: responseCredits,
      };
    } catch (error: any) {
      log(`[${stepName}] Attempt ${attempt} failed: ${error.message}`);
      
      if (attempt === effectiveMaxAttempts) {
        return {
          ok: false,
          error: {
            code: MonkeyErrorCode.PROVIDER_ERROR,
            message: error.message || "HTML generation failed",
            step: stepName,
            details: { attempt },
          },
        };
      }
    }
  }
  
  return {
    ok: false,
    error: {
      code: MonkeyErrorCode.REPAIR_EXHAUSTED,
      message: `HTML generation failed after ${effectiveMaxAttempts} attempts`,
      step: stepName,
    },
  };
}

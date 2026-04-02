/**
 * Sanitize AI response content by removing markdown code fences and other artifacts
 */

/**
 * Remove markdown code fence markers from HTML content
 * Handles: ```html, ```, and similar patterns
 */
export function cleanHtmlMarkers(html: string): string {
  if (!html || typeof html !== 'string') {
    return html;
  }
  
  return html
    .replace(/^```html\s*/i, '') // Remove opening ```html
    .replace(/^```\s*/i, '')      // Remove opening ```
    .replace(/\s*```$/i, '')      // Remove closing ```
    .trim();                       // Remove leading/trailing whitespace
}

/**
 * Remove JSON markers from text
 * Handles: ```json, ```, and similar patterns
 */
export function cleanJsonMarkers(text: string): string {
  if (!text || typeof text !== 'string') {
    return text;
  }
  
  return text
    .replace(/^```json\s*/i, '')  // Remove opening ```json
    .replace(/^```\s*/i, '')       // Remove opening ```
    .replace(/\s*```$/i, '')       // Remove closing ```
    .trim();
}

/**
 * General purpose sanitization for AI responses
 * Removes code fences, normalizes whitespace
 */
export function sanitizeAIResponse(raw: string, options?: {
  removeCodeFences?: boolean;
  normalizeWhitespace?: boolean;
}): string {
  if (!raw || typeof raw !== 'string') {
    return raw;
  }
  
  const {
    removeCodeFences = true,
    normalizeWhitespace = true,
  } = options || {};
  
  let result = raw;
  
  // Remove code fences
  if (removeCodeFences) {
    result = cleanHtmlMarkers(result);
    result = cleanJsonMarkers(result);
  }
  
  // Normalize whitespace
  if (normalizeWhitespace) {
    result = result.trim();
  }
  
  return result;
}

/**
 * Production-safe error message
 * Strips debug information in production
 */
export function sanitizeErrorMessage(error: any): string {
  if (process.env.NODE_ENV === 'production') {
    // Return generic message in production
    return 'An error occurred. Please try again.';
  }
  
  // Return detailed message in development
  if (error?.message) {
    return error.message;
  }
  
  if (typeof error === 'string') {
    return error;
  }
  
  return 'Unknown error occurred';
}

/**
 * Strip debug JSON from output in production
 */
export function stripDebugOutput(content: string): string {
  if (process.env.NODE_ENV !== 'production') {
    return content; // Keep debug info in development
  }
  
  // Remove common debug patterns in production
  return content
    .replace(/\[DEBUG\][\s\S]*?\[\/DEBUG\]/g, '')
    .replace(/console\.log\(.*?\);?/g, '')
    .replace(/JSON\.stringify\(.*?\)/g, '');
}

/**
 * Development-only console log
 * Automatically suppressed in production builds
 * 
 * Usage:
 *   import { devLog } from '@/libs/monkey/tools/runtime/sanitizeResponse';
 *   devLog('[Component] Debug info:', data);
 */
export function devLog(...args: any[]): void {
  if (process.env.NODE_ENV !== 'production') {
  }
}

/**
 * Development-only console error
 * Always logs errors, but with additional context in development
 */
export function devError(message: string, error?: any): void {
  if (process.env.NODE_ENV === 'production') {
  } else {
  }
}

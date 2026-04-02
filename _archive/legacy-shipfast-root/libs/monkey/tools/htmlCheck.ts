/**
 * HTML safety and parseability checks
 */

export interface HtmlCheckResult {
  ok: boolean;
  issues?: string[];
}

/**
 * Basic HTML safety check without heavy dependencies
 * Checks for scripts, inline handlers, and basic parseability
 */
export function checkHtmlSafety(html: string): HtmlCheckResult {
  const issues: string[] = [];
  
  if (!html || typeof html !== "string") {
    return { ok: false, issues: ["HTML is not a valid string"] };
  }
  
  // Check for script tags
  if (/<script[\s>]/i.test(html)) {
    issues.push("Contains <script> tags");
  }
  
  // Check for inline event handlers
  const eventHandlerPattern = /\s(on\w+)\s*=/i;
  if (eventHandlerPattern.test(html)) {
    issues.push("Contains inline event handlers (onclick, onload, etc.)");
  }
  
  // Check for style tags (disallow by default per requirements)
  if (/<style[\s>]/i.test(html)) {
    issues.push("Contains <style> tags");
  }
  
  // Basic parseability: check for balanced tags
  const openTags = (html.match(/<[^/!?][^>]*>/g) || []).length;
  const closeTags = (html.match(/<\/[^>]+>/g) || []).length;
  
  // Allow some imbalance for self-closing tags, but flag significant issues
  if (Math.abs(openTags - closeTags) > openTags * 0.5 && openTags > 5) {
    issues.push("Unbalanced HTML tags detected (potential parse error)");
  }
  
  // Check for basic HTML structure
  if (!html.includes("<") && html.length > 100) {
    issues.push("Does not appear to be valid HTML");
  }
  
  return {
    ok: issues.length === 0,
    issues: issues.length > 0 ? issues : undefined,
  };
}

/**
 * Validate competitor candidates using LLM classifier
 */

import { callStructured } from "../tools/runtime/callStructured";
import { competitorValidationSchema } from "../references/marketingPageSchemas";
import { CompetitorValidationResult } from "../references/marketingTypes";
import { FetchedPage } from "../tools/competitorFetch";
import { MarketingPageType } from "../references/pageTypes/registry";
import { log, shouldLogFull } from "../ui/logger";
import { ChatMessage } from "../tools/runtime/providers/openai";

export async function validateCompetitor(
  model: "agent" | "high" | "mid",
  page: FetchedPage,
  pageType: MarketingPageType,
  campaignContext: any
): Promise<CompetitorValidationResult | null> {
  const systemPrompt = `You are a competitor validation classifier. Your job is to determine if a fetched web page is a relevant competitor landing page that targets the same audience and intent as the specified page type.

CRITICAL RULES:
- A page is a relevant competitor if it offers a similar service/product to the same target audience
- Reject pages that are: blog posts, news articles, directories, tools, or informational content
- Reject pages that target a different audience or serve a different intent
- Accept pages that are: service landing pages, product pages, pricing pages, or conversion-focused pages
- Confidence should reflect how certain you are (0.65+ to accept)`;

  const userPrompt = `PAGE TYPE: ${pageType}
PAGE URL: ${page.url}
PAGE TITLE: ${page.title || "N/A"}
H1: ${page.h1 || "N/A"}
META DESCRIPTION: ${page.metaDescription || "N/A"}

HEADINGS FOUND:
${page.headings.slice(0, 10).map((h, i) => `${i + 1}. ${h}`).join("\n")}

FIRST 500 CHARS OF CONTENT:
${page.extractedText.substring(0, 500)}...

CAMPAIGN CONTEXT (for reference):
${JSON.stringify(campaignContext || {}, null, 2).substring(0, 500)}...

TASK: Classify whether this page is a relevant competitor landing page for the specified page type.

Output JSON with:
- isRelevantCompetitorPage: boolean
- confidence: number 0-1
- matchedSignals: array of strings (what signals indicate it's a competitor)
- rejectReasons: array of strings (if rejected, why)
- pageArchetype: one of "service_landing", "pricing", "directory", "blog", "tool", "unknown"`;

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  const result = await callStructured(
    model,
    messages,
    competitorValidationSchema,
    { stepName: "competitorValidate", maxAttempts: 2 }
  );

  if (!result.ok || !result.data) {
    if (shouldLogFull()) log(`[competitorValidate] Failed to validate ${page.url}: ${result.error?.message}`);
    return null;
  }

  const validation = result.data as CompetitorValidationResult;

  // Add extracted data
  validation.url = page.url;
  validation.extractedText = page.extractedText;
  validation.headings = page.headings;
  validation.evidenceSnippet = page.extractedText.substring(0, 300);

  return validation;
}

/**
 * Quick heuristic filters (before LLM validation)
 */
export function quickHeuristicFilter(page: FetchedPage): { passed: boolean; reason?: string } {
  // Too little text
  if (page.extractedText.length < 200) {
    return { passed: false, reason: `Insufficient content (${page.extractedText.length} chars < 200 minimum)` };
  }

  // Check for blog indicators
  const blogIndicators = ["blog", "post", "article", "author:", "published", "date:"];
  const lowerText = page.extractedText.toLowerCase();
  const lowerTitle = (page.title || "").toLowerCase();

  const foundIndicators = blogIndicators.filter((indicator) => lowerText.includes(indicator) || lowerTitle.includes(indicator));
  if (foundIndicators.length > 0) {
    // But allow if it's clearly a landing page despite having "blog" in URL
    const landingPageIndicators = ["get started", "contact us", "request quote", "get quote", "book demo"];
    const hasLandingPageIndicators = landingPageIndicators.some((indicator) => lowerText.includes(indicator));
    
    if (!hasLandingPageIndicators) {
      return { 
        passed: false, 
        reason: `Blog/article indicators found (${foundIndicators.join(", ")}) without landing page indicators` 
      };
    }
  }

  return { passed: true };
}

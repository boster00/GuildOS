/**
 * Fetch competitor pages as HTML/markdown via Tavily (primary) or HTTP (fallback)
 */

import { log } from "../ui/logger";
import { initMonkey } from "../../monkey";

export interface FetchedPageHtml {
  url: string;
  title?: string;
  htmlContent: string; // Full HTML content
  markdownContent?: string; // Markdown if available
  success: boolean;
  error?: string;
}

/**
 * Fetch page HTML/markdown using Tavily via monkey.webExtract
 */
async function fetchViaTavilyHtml(url: string): Promise<FetchedPageHtml | null> {
  log(`[fetchCompetitorPageHtml] Attempting Tavily fetch via monkey.webExtract for: ${url}`);
  
  try {
    const monkey = await initMonkey();
    const results = await monkey.webExtract([url]);
    
    if (!results || results.length === 0) {
      log(`[fetchCompetitorPageHtml] monkey.webExtract returned no results for ${url}`);
      return null;
    }

    const result = results[0];
    const rawContent = result.raw_content || result.content || "";
    
    if (!rawContent || rawContent.length < 200) {
      log(`[fetchCompetitorPageHtml] Tavily content too short (${rawContent.length} chars) for ${url}`);
      return null;
    }

    // Check if raw_content is HTML (contains HTML tags)
    const isHtml = /<[a-z][\s\S]*>/i.test(rawContent);
    
    log(`[fetchCompetitorPageHtml] ✅ Tavily fetch successful: title="${result.title || 'N/A'}", contentLength=${rawContent.length}, isHtml=${isHtml}`);

    return {
      url,
      title: result.title,
      htmlContent: rawContent, // Keep as HTML/markdown
      markdownContent: isHtml ? undefined : rawContent, // If not HTML, treat as markdown
      success: true,
    };
  } catch (error: any) {
    log(`[fetchCompetitorPageHtml] Tavily fetch error: ${error.message}`);
    return null;
  }
}

/**
 * Fetch page HTML via direct HTTP
 */
async function fetchViaHttpHtml(url: string): Promise<FetchedPageHtml | null> {
  log(`[fetchCompetitorPageHtml] Attempting direct HTTP fetch for: ${url}`);
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      log(`[fetchCompetitorPageHtml] HTTP fetch failed: ${response.status} ${response.statusText}`);
      return {
        url,
        htmlContent: "",
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) {
      log(`[fetchCompetitorPageHtml] Content type is not HTML: ${contentType}`);
      return {
        url,
        htmlContent: "",
        success: false,
        error: `Content type is not HTML: ${contentType}`,
      };
    }

    const html = await response.text();
    
    if (!html || html.length < 200) {
      log(`[fetchCompetitorPageHtml] HTML content too short (${html.length} chars)`);
      return {
        url,
        htmlContent: "",
        success: false,
        error: "Content too short",
      };
    }

    // Extract title
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : undefined;

    log(`[fetchCompetitorPageHtml] ✅ HTTP fetch successful: title="${title || 'N/A'}", htmlLength=${html.length}`);

    return {
      url,
      title,
      htmlContent: html,
      success: true,
    };
  } catch (error: any) {
    if (error.name === "AbortError") {
      log(`[fetchCompetitorPageHtml] HTTP fetch timeout for ${url}`);
      return {
        url,
        htmlContent: "",
        success: false,
        error: "Request timeout",
      };
    }
    log(`[fetchCompetitorPageHtml] HTTP fetch error: ${error.message}`);
    return {
      url,
      htmlContent: "",
      success: false,
      error: error.message,
    };
  }
}

/**
 * Fetch competitor page as HTML/markdown
 * Tries Tavily first (faster, more reliable), falls back to direct HTTP fetch
 */
export async function fetchCompetitorPageHtml(url: string): Promise<FetchedPageHtml | null> {
  log(`[fetchCompetitorPageHtml] Fetching HTML for: ${url}`);
  
  // Try Tavily first
  const tavilyResult = await fetchViaTavilyHtml(url);
  if (tavilyResult && tavilyResult.success) {
    return tavilyResult;
  }
  
  log(`[fetchCompetitorPageHtml] Tavily fetch failed, falling back to direct HTTP fetch...`);
  
  // Fallback to direct HTTP fetch
  const httpResult = await fetchViaHttpHtml(url);
  return httpResult;
}

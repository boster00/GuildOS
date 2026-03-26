/**
 * Fetch competitor pages via Tavily (primary, through monkey.webExtract) or HTTP (fallback)
 */

import { log, shouldLogFull } from "../ui/logger";
import { initMonkey } from "../../monkey";

export interface FetchedPage {
  url: string;
  title?: string;
  headings: string[];
  extractedText: string;
  metaDescription?: string;
  h1?: string;
}

/**
 * Fetch page content using Tavily via monkey.webExtract (faster and more reliable)
 */
async function fetchViaTavily(url: string): Promise<FetchedPage | null> {
  log(`[competitorFetch] Attempting Tavily fetch via monkey.webExtract for: ${url}`);
  
  try {
    const monkey = await initMonkey();
    const results = await monkey.webExtract([url]);
    
    if (!results || results.length === 0) {
      log(`[competitorFetch] monkey.webExtract returned no results for ${url}`);
      return null;
    }

    const result = results[0];
    const rawContent = result.raw_content || result.content || "";
    
    if (!rawContent || rawContent.length < 200) {
      log(`[competitorFetch] Tavily content too short (${rawContent.length} chars) for ${url}`);
      return null;
    }

    // Extract headings from raw content (Tavily may not provide structured headings)
    const headings: string[] = [];
    const h1Matches = rawContent.match(/<h1[^>]*>([\s\S]*?)<\/h1>/gi) || [];
    const h2Matches = rawContent.match(/<h2[^>]*>([\s\S]*?)<\/h2>/gi) || [];
    const h3Matches = rawContent.match(/<h3[^>]*>([\s\S]*?)<\/h3>/gi) || [];
    
    [...h1Matches, ...h2Matches, ...h3Matches].forEach((match) => {
      const text = match.replace(/<[^>]+>/g, "").trim();
      if (text && text.length > 0) {
        headings.push(text);
      }
    });

    // Extract text content (remove HTML tags)
    const extractedText = rawContent
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const h1 = h1Matches.length > 0 ? h1Matches[0].replace(/<[^>]+>/g, "").trim() : undefined;

    log(`[competitorFetch] ✅ Tavily fetch successful via monkey.webExtract: title="${result.title || 'N/A'}", textLength=${extractedText.length}, headings=${headings.length}`);

    return {
      url,
      title: result.title,
      headings: [...new Set(headings)], // Deduplicate
      extractedText: extractedText.length > 5000 ? extractedText.substring(0, 5000) + "..." : extractedText,
      metaDescription: result.meta_description,
      h1,
    };
  } catch (error: any) {
    log(`[competitorFetch] Tavily fetch error via monkey.webExtract: ${error.message}`);
    return null;
  }
}

/**
 * Fetch and extract readable content from a URL
 * Tries Tavily first (faster, more reliable), falls back to direct HTTP fetch
 */
export async function fetchCompetitorPage(url: string): Promise<FetchedPage | null> {
  log(`[competitorFetch] Fetching: ${url}`);
  
  // Try Tavily first (faster and more reliable)
  const tavilyResult = await fetchViaTavily(url);
  if (tavilyResult) {
    return tavilyResult;
  }
  
  log(`[competitorFetch] Tavily fetch failed, falling back to direct HTTP fetch...`);
  
  // Fallback to direct HTTP fetch
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout (increased from 10s)

    log(`[competitorFetch] Sending request with headers...`);
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Cache-Control": "max-age=0",
      },
      redirect: "follow",
    });

    clearTimeout(timeoutId);

    log(`[competitorFetch] Response status: ${response.status} ${response.statusText}`);
    log(`[competitorFetch] Response headers: Content-Type=${response.headers.get("content-type") || "N/A"}, Content-Length=${response.headers.get("content-length") || "N/A"}`);

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "Unable to read error body");
      log(`[competitorFetch] ❌ HTTP Error ${response.status} ${response.statusText} for ${url}`);
      log(`[competitorFetch]   Error body preview: ${errorBody.substring(0, 200)}`);
      return null;
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) {
      log(`[competitorFetch] ❌ Non-HTML content type: ${contentType} for ${url}`);
      return null;
    }

    log(`[competitorFetch] Reading response body...`);
    const html = await response.text();
    log(`[competitorFetch] Received ${html.length} bytes of HTML`);

    if (html.length < 500) {
      log(`[competitorFetch] ❌ HTML too short (${html.length} bytes) - likely an error page or redirect`);
      log(`[competitorFetch]   HTML preview: ${html.substring(0, 200)}`);
      return null;
    }

    log(`[competitorFetch] Extracting readable content...`);
    const extracted = extractReadableContent(html, url);

    log(`[competitorFetch] Extracted: title="${extracted.title || 'N/A'}", h1="${extracted.h1 || 'N/A'}", headings=${extracted.headings.length}, textLength=${extracted.extractedText.length}`);

    if (extracted.extractedText.length < 200) {
      log(`[competitorFetch] ❌ Too little text from ${url} (${extracted.extractedText.length} chars < 200 minimum)`);
      log(`[competitorFetch]   This might be a JavaScript-rendered page or requires authentication`);
      log(`[competitorFetch]   HTML preview (first 500 chars): ${html.substring(0, 500)}`);
      return null;
    }

    log(`[competitorFetch] ✅ Successfully fetched and extracted content from ${url}`);
    return {
      url,
      title: extracted.title,
      headings: extracted.headings,
      extractedText: extracted.extractedText,
      metaDescription: extracted.metaDescription,
      h1: extracted.h1,
    };
  } catch (error: any) {
    // Determine error type
    let errorType = "Unknown error";
    let errorDetails = error.message || String(error);
    
    if (error.name === "AbortError") {
      errorType = "Timeout (15s exceeded)";
    } else if (error.message?.includes("fetch failed")) {
      errorType = "Network error (DNS/connection failed)";
    } else if (error.message?.includes("CORS")) {
      errorType = "CORS error (cross-origin blocked)";
    } else if (error.code === "ENOTFOUND" || error.code === "ECONNREFUSED") {
      errorType = `Network error (${error.code})`;
    }
    
    log(`[competitorFetch] ❌ Error fetching ${url}: ${errorType}`);
    log(`[competitorFetch]   Error details: ${errorDetails}`);
    if (error.stack) {
      log(`[competitorFetch]   Stack: ${error.stack.substring(0, 300)}`);
    }
    return null;
  }
}

/**
 * Extract readable content from HTML
 */
function extractReadableContent(html: string, url: string): {
  title: string;
  headings: string[];
  extractedText: string;
  metaDescription?: string;
  h1?: string;
} {
  // Remove scripts and styles
  let cleanHtml = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");

  // Extract title
  const titleMatch = cleanHtml.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? sanitizeText(titleMatch[1]) : "";

  // Extract meta description
  const metaMatch = cleanHtml.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
  const metaDescription = metaMatch ? sanitizeText(metaMatch[1]) : undefined;

  // Extract headings
  const h1Matches = cleanHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/gi) || [];
  const h2Matches = cleanHtml.match(/<h2[^>]*>([\s\S]*?)<\/h2>/gi) || [];
  const h3Matches = cleanHtml.match(/<h3[^>]*>([\s\S]*?)<\/h3>/gi) || [];

  const headings: string[] = [];
  const h1 = h1Matches.length > 0 ? sanitizeText(h1Matches[0].replace(/<[^>]+>/g, "")) : undefined;

  [...h1Matches, ...h2Matches, ...h3Matches].forEach((match) => {
    const text = sanitizeText(match.replace(/<[^>]+>/g, ""));
    if (text && text.length > 0) {
      headings.push(text);
    }
  });

  // Extract body text (limit to ~5000 chars for processing)
  const bodyMatch = cleanHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (!bodyMatch) {
    return { title, headings, extractedText: "", metaDescription, h1 };
  }

  let bodyText = bodyMatch[1]
    .replace(/<[^>]+>/g, " ") // Remove all tags
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim();

  // Limit size
  if (bodyText.length > 5000) {
    bodyText = bodyText.substring(0, 5000) + "...";
  }

  return {
    title,
    headings: [...new Set(headings)], // Deduplicate
    extractedText: bodyText,
    metaDescription,
    h1,
  };
}

function sanitizeText(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

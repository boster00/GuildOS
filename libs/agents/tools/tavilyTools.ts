/**
 * Tavily Tools for Agents SDK
 * Wraps existing monkey.webSearch and monkey.webExtract for use with Agents SDK
 */

import { tool } from "@openai/agents";
import { z } from "zod";
import { initMonkey } from "@/libs/monkey";

/**
 * Search for competitor pages using Tavily
 * Wraps monkey.webSearch()
 */
export const searchCompetitorsTool = tool({
  name: "search_competitors",
  description: "Search for competitor pages using Tavily web search. Returns URLs and snippets of relevant competitor pages.",
  parameters: z.object({
    query: z.string().describe("Search query to find competitor pages"),
    maxResults: z.number().default(5).describe("Maximum number of results to return (default: 5)"),
  }),
  execute: async ({ query, maxResults }) => {
    const monkey = await initMonkey();
    const results = await monkey.webSearch(query, { maxResults });
    return results;
  },
});

/**
 * Extract full content from a URL using Tavily
 * Wraps monkey.webExtract()
 */
export const extractPageContentTool = tool({
  name: "extract_page_content",
  description: "Extract full page content from a URL using Tavily. Returns the page content as markdown/text.",
  parameters: z.object({
    url: z.string().describe("URL of the page to extract content from"),
  }),
  execute: async ({ url }) => {
    const monkey = await initMonkey();
    const content = await monkey.webExtract([url]);
    // webExtract returns an array, return the first result
    return content[0] || null;
  },
});

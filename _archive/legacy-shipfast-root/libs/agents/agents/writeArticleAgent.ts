/**
 * Write Article Agent
 * Uses Agents SDK to write a full landing page article
 * Can perform competitor research, section planning, and content writing
 */

import { Agent, tool } from "@openai/agents";
import { z } from "zod";
import { writeSection } from "@/libs/monkey/actions/writeSection";
import { renderSection, renderFullPage } from "@/libs/monkey/tools/renderers";
import { getPageTypeConfig, MarketingPageType } from "@/libs/monkey/references/pageTypes/registry";
import { log } from "@/libs/monkey/ui/logger";

// Tool to write a section
const writeSectionTool = tool({
  name: "write_section",
  description: "Write a content section for the landing page using best practices and context.",
  parameters: z.object({
    sectionType: z.string().describe("The type of section to write"),
    format: z.string().nullable().optional().describe("Output format (html, markdown, etc.)"),
    context: z.object({
      icp: z.any().nullable().optional(),
      offer: z.any().nullable().optional(),
      talkPoints: z.any().nullable().optional(),
      hookPoints: z.any().nullable().optional(),
      offerType: z.string().nullable().optional(),
    }),
  }),
  execute: async ({ sectionType, format, context }) => {
    log(`[writeArticleAgent] [writeSectionTool] Writing section: ${sectionType}`);
    
    try {
      const sectionContent = await writeSection("agent", {
        sectionType: sectionType as any,
        format: format || "html",
        icp: context.icp,
        offer: context.offer,
        talkPoints: context.talkPoints || {
          uniqueSellingPoints: [],
          transactionalFacts: [],
        },
        hookPoints: context.hookPoints || {},
        offerType: (context.offerType as any) || "transactional",
      });

      const html = await renderSection(sectionContent);

      return {
        sectionType,
        content: sectionContent,
        html,
      };
    } catch (error: any) {
      log(`[writeArticleAgent] [writeSectionTool] ❌ Error: ${error.message}`);
      throw error;
    }
  },
});

// Tool to render full page
const renderPageTool = tool({
  name: "render_full_page",
  description: "Render all sections into a complete HTML page.",
  parameters: z.object({
    sections: z.array(z.object({
      type: z.string(),
      html: z.string(),
      content: z.any().nullable().optional(),
    })),
    pageType: z.string().nullable().optional(),
    title: z.string().nullable().optional(),
  }),
  execute: async ({ sections, pageType, title }) => {
    log(`[writeArticleAgent] [renderPageTool] Rendering full page with ${sections.length} sections`);
    
    try {
      const fullPageHtml = await renderFullPage(
        sections.map(s => ({
          sectionType: s.type,
          format: s.content.format || "text_block",
          content: s.content.content,
          notes: s.content.notes,
        }))
      );

      return {
        html: fullPageHtml,
        sectionsCount: sections.length,
      };
    } catch (error: any) {
      log(`[writeArticleAgent] [renderPageTool] ❌ Error: ${error.message}`);
      throw error;
    }
  },
});

// Create the agent
export const writeArticleAgent = new Agent({
  name: "WriteArticleAgent",
  instructions: `You are an expert landing page writer. Your task is to create a complete, high-quality landing page.

**CRITICAL: You MUST use the tools provided. Do not just describe what you would write - actually call the tools.**

**Process:**
1. Read the context carefully (ICP, offer, clarification answers, required sections)
2. For EACH required section listed, you MUST call the write_section tool
3. After writing all sections, collect all section results
4. Call the render_full_page tool with all sections to create the final HTML
5. Return the final HTML in your response

**Tool Usage:**
- write_section: Call this for EVERY section type mentioned in the "Required Sections" list
  - Pass the exact sectionType (e.g., "HERO_VALUE_PROP", "BENEFITS_LIST_OR_CARDS")
  - Pass format: "html"
  - Pass the full context object with icp, offer, talkPoints, hookPoints, offerType
- render_full_page: Call this ONCE after all sections are written
  - Pass all section results (with type, html, and content)
  - Pass pageType and title

**Output Format:**
After calling all tools, return a JSON object:
{
  "html": "<full HTML from render_full_page>",
  "sections": [{"type": "...", "html": "..."}, ...]
}

**Important:** Do not skip any sections. Write all sections listed, then render the full page.`,
  tools: [writeSectionTool, renderPageTool],
});

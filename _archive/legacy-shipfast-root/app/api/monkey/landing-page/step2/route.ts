/**
 * API endpoint for Step 2: Competitor Benchmark
 * New structure: 4 tools
 * 1. Tavily keyword to competitor URLs
 * 2. Tavily competitor URLs to full pages HTML/markdown
 * 3. Extract section outlines (headers + ~25 words preview)
 * 4. AI evaluate section outlines against content wall
 */

import { NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";
import { fetchSerpCompetitors } from "@/libs/monkey/tools/dataForSeo";
import { fetchCompetitorPageHtml } from "@/libs/monkey/tools/fetchCompetitorPageHtml";
import { extractSectionOutlines } from "@/libs/monkey/tools/extractSectionOutlines";
import { evaluateSectionOutlines } from "@/libs/monkey/actions/evaluateSectionOutlines";
import { log } from "@/libs/monkey/ui/logger";
import { MarketingPageType, getPageTypeConfig, SectionType } from "@/libs/monkey/references/pageTypes/registry";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { 
      model = "high", 
      step1Output, 
      competitorUrls, 
      pageType = "BASE_UNIVERSAL",
      maxCompetitors = 5
    } = body;

    if (!step1Output) {
      return NextResponse.json(
        { error: "step1Output is required" },
        { status: 400 }
      );
    }

    // Authenticate user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Extract step1Output components
    const { icp, offer } = step1Output;
    log(`[step2 API] Starting Step 2 for ICP: ${icp?.name}, Offer: ${offer?.name || "none"}`);

    // Initialize step result structure
    const stepResult: {
      stepId: string;
      stepName: string;
      status: "running" | "done" | "error";
      payload: any;
      tools: any[];
      output: any;
      error: any;
    } = {
      stepId: "step2_competitor_benchmark",
      stepName: "Competitor Benchmark",
      status: "running",
      payload: { model, competitorUrls, pageType, maxCompetitors },
      tools: [],
      output: null,
      error: null,
    };

    try {
      const MAX_COMPETITORS = 5; // Process up to 5 competitors (limit enforced throughout)

      // Tool 1: Collect Competitor URLs via Tavily
      log(`[step2 API] Tool 1: Collecting competitor URLs via Tavily...`);
      
      let tool1Result;
      let candidateUrls: string[] = [];
      
      try {
        if (competitorUrls && competitorUrls.length > 0) {
          // Use provided URLs
          candidateUrls = competitorUrls.slice(0, MAX_COMPETITORS);
          tool1Result = {
            toolId: "tool1_collect_urls",
            toolName: "Collect Competitor URLs (Tavily)",
            input: { source: "userProvided", urls: competitorUrls },
            output: { urls: candidateUrls, source: "userProvided" },
            outputRaw: JSON.stringify({ urls: candidateUrls, source: "userProvided" }, null, 2),
            error: null,
          };
          log(`[step2 API] Tool 1 completed: Using ${candidateUrls.length} provided URLs`);
        } else {
          // Discover via SERP (Tavily)
          let searchQuery = offer?.name || icp?.name || "service";
          
          const serpResult = await fetchSerpCompetitors(searchQuery);
          
          if (serpResult.items && serpResult.items.length > 0) {
            candidateUrls = serpResult.items.map(item => item.url).slice(0, MAX_COMPETITORS);
            tool1Result = {
              toolId: "tool1_collect_urls",
              toolName: "Collect Competitor URLs (Tavily)",
              input: { source: "serp", query: searchQuery },
              output: { urls: candidateUrls, source: "serp", serpResult },
              outputRaw: JSON.stringify({ urls: candidateUrls, source: "serp", serpResult }, null, 2),
              error: null,
            };
            log(`[step2 API] Tool 1 completed: Found ${candidateUrls.length} URLs via Tavily SERP`);
          } else {
            tool1Result = {
              toolId: "tool1_collect_urls",
              toolName: "Collect Competitor URLs (Tavily)",
              input: { source: "serp", query: searchQuery },
              output: { urls: [], source: "serp", serpResult },
              outputRaw: JSON.stringify({ urls: [], source: "serp", serpResult }, null, 2),
              error: null,
            };
            log(`[step2 API] Tool 1 completed: No URLs found via SERP`);
          }
        }
      } catch (error: any) {
        tool1Result = {
          toolId: "tool1_collect_urls",
          toolName: "Collect Competitor URLs (Tavily)",
          input: { competitorUrls, maxCompetitors: MAX_COMPETITORS },
          output: null,
          outputRaw: null,
          error: { message: error.message, stack: error.stack },
        };
        log(`[step2 API] Tool 1 failed: ${error.message}`);
      }
      stepResult.tools.push(tool1Result);

      // Tool 2: Fetch Full Pages as HTML/Markdown via Tavily
      log(`[step2 API] Tool 2: Fetching full pages as HTML/markdown via Tavily...`);
      
      const fetchedPages: Array<{ url: string; title?: string; htmlContent: string; markdownContent?: string; success: boolean; error?: string }> = [];
      const skippedUrls: Array<{ url: string; reason: string }> = [];
      
      let tool2Result;
      try {
        // Limit to MAX_COMPETITORS
        const urlsToProcess = candidateUrls.slice(0, MAX_COMPETITORS);
        
        for (let i = 0; i < urlsToProcess.length; i++) {
          const url = urlsToProcess[i];
          log(`[step2 API] Fetching HTML for ${i + 1}/${urlsToProcess.length}: ${url}`);
          
          const fetchedPage = await fetchCompetitorPageHtml(url);
          
          if (fetchedPage && fetchedPage.success && fetchedPage.htmlContent && fetchedPage.htmlContent.length >= 200) {
            fetchedPages.push(fetchedPage);
            log(`[step2 API] ✓ Fetched HTML for ${url} (${fetchedPage.htmlContent.length} chars)`);
          } else {
            skippedUrls.push({
              url,
              reason: fetchedPage?.error || "Failed to fetch or content too short",
            });
            log(`[step2 API] ✗ Skipped ${url}: ${fetchedPage?.error || "content too short"}`);
          }
        }

        tool2Result = {
          toolId: "tool2_fetch_html",
          toolName: "Fetch Full Pages as HTML/Markdown (Tavily)",
          input: { urls: candidateUrls, maxCompetitors: MAX_COMPETITORS },
          output: {
            fetched: fetchedPages.map(p => ({ url: p.url, title: p.title, contentLength: p.htmlContent.length })),
            skipped: skippedUrls,
            total: candidateUrls.length,
            fetchedCount: fetchedPages.length,
          },
          outputRaw: JSON.stringify({
            fetched: fetchedPages.map(p => ({ url: p.url, title: p.title, contentLength: p.htmlContent.length })),
            skipped: skippedUrls,
            total: candidateUrls.length,
            fetchedCount: fetchedPages.length,
          }, null, 2),
          error: null,
        };
        log(`[step2 API] Tool 2 completed: Fetched ${fetchedPages.length} pages, skipped ${skippedUrls.length}`);
      } catch (error: any) {
        tool2Result = {
          toolId: "tool2_fetch_html",
          toolName: "Fetch Full Pages as HTML/Markdown (Tavily)",
          input: { urls: candidateUrls, maxCompetitors: MAX_COMPETITORS },
          output: null,
          outputRaw: null,
          error: { message: error.message, stack: error.stack },
        };
        log(`[step2 API] Tool 2 failed: ${error.message}`);
      }
      stepResult.tools.push(tool2Result);

      // Tool 3: Extract Section Outlines
      log(`[step2 API] Tool 3: Extracting section outlines from ${fetchedPages.length} pages...`);
      
      const competitorOutlines: Array<{ url: string; title: string; sections: Array<{ heading: string; level: number; preview: string; position: number }> }> = [];
      
      let tool3Result;
      try {
        for (const page of fetchedPages) {
          const outline = extractSectionOutlines(
            page.url,
            page.title || "",
            page.htmlContent,
            page.markdownContent
          );
          competitorOutlines.push(outline);
          log(`[step2 API] Extracted ${outline.sections.length} sections from ${page.url}`);
        }

        tool3Result = {
          toolId: "tool3_extract_outlines",
          toolName: "Extract Section Outlines",
          input: { pagesCount: fetchedPages.length },
          output: {
            outlines: competitorOutlines.map(o => ({
              url: o.url,
              title: o.title,
              sectionCount: o.sections.length,
              sections: o.sections.map(s => ({ heading: s.heading, level: s.level, preview: s.preview.substring(0, 50) + "..." })),
            })),
            totalSections: competitorOutlines.reduce((sum, o) => sum + o.sections.length, 0),
          },
          outputRaw: JSON.stringify({
            outlines: competitorOutlines.map(o => ({
              url: o.url,
              title: o.title,
              sectionCount: o.sections.length,
              sections: o.sections.map(s => ({ heading: s.heading, level: s.level, preview: s.preview.substring(0, 50) + "..." })),
            })),
            totalSections: competitorOutlines.reduce((sum, o) => sum + o.sections.length, 0),
          }, null, 2),
          error: null,
        };
        log(`[step2 API] Tool 3 completed: Extracted outlines from ${competitorOutlines.length} pages`);
      } catch (error: any) {
        tool3Result = {
          toolId: "tool3_extract_outlines",
          toolName: "Extract Section Outlines",
          input: { pagesCount: fetchedPages.length },
          output: null,
          outputRaw: null,
          error: { message: error.message, stack: error.stack },
        };
        log(`[step2 API] Tool 3 failed: ${error.message}`);
      }
      stepResult.tools.push(tool3Result);

      // Tool 4: Evaluate Section Outlines Against Content Wall
      log(`[step2 API] Tool 4: Evaluating section outlines against content wall...`);
      
      let tool4Result;
      let evaluationResult: any = null;
      
      try {
        // Get available section types from page type config
        const pageConfig = getPageTypeConfig(pageType as MarketingPageType);
        const availableSectionTypes: SectionType[] = [
          ...pageConfig.recommended_sections,
          ...pageConfig.optional_sections,
        ];

        if (competitorOutlines.length > 0 && availableSectionTypes.length > 0) {
          // Pass HTML content along with outlines for example extraction
          const outlinesWithContent = competitorOutlines.map((outline, idx) => {
            const fetchedPage = fetchedPages[idx];
            return {
              ...outline,
              htmlContent: fetchedPage?.htmlContent,
            };
          });

          evaluationResult = await evaluateSectionOutlines(
            model,
            outlinesWithContent,
            pageType as MarketingPageType,
            availableSectionTypes
          );

          tool4Result = {
            toolId: "tool4_evaluate_outlines",
            toolName: "Evaluate Section Outlines (AI)",
            input: {
              competitorOutlinesCount: competitorOutlines.length,
              availableSectionTypesCount: availableSectionTypes.length,
            },
            output: {
              sectionCoverage: Object.keys(evaluationResult.sectionCoverage).length,
              finalOutlineCount: evaluationResult.finalOutline.length,
              sectionCoverageSummary: Object.entries(evaluationResult.sectionCoverage).map(([type, data]: [string, any]) => ({
                sectionType: type,
                count: data.count,
                competitorCount: data.competitors.length,
                examples: data.examples || [],
              })),
            },
            outputRaw: JSON.stringify({
              sectionCoverage: Object.keys(evaluationResult.sectionCoverage).length,
              finalOutlineCount: evaluationResult.finalOutline.length,
              sectionCoverageSummary: Object.entries(evaluationResult.sectionCoverage).map(([type, data]: [string, any]) => ({
                sectionType: type,
                count: data.count,
                competitorCount: data.competitors.length,
                examples: data.examples || [],
              })),
            }, null, 2),
            error: null,
          };
          log(`[step2 API] Tool 4 completed: Found ${evaluationResult.finalOutline.length} sections in final outline`);
        } else {
          tool4Result = {
            toolId: "tool4_evaluate_outlines",
            toolName: "Evaluate Section Outlines (AI)",
            input: {
              competitorOutlinesCount: competitorOutlines.length,
              availableSectionTypesCount: availableSectionTypes.length,
            },
            output: null,
            outputRaw: null,
            error: { message: "No competitor outlines or no available section types" },
          };
          log(`[step2 API] Tool 4 skipped: No competitor outlines or section types`);
        }
      } catch (error: any) {
        tool4Result = {
          toolId: "tool4_evaluate_outlines",
          toolName: "Evaluate Section Outlines (AI)",
          input: {
            competitorOutlinesCount: competitorOutlines.length,
          },
          output: null,
          outputRaw: null,
          error: { message: error.message, stack: error.stack },
        };
        log(`[step2 API] Tool 4 failed: ${error.message}`);
      }
      stepResult.tools.push(tool4Result);

      // Determine quality
      const analyzedCount = competitorOutlines.length;
      const quality = analyzedCount >= 5 ? "HIGH" : analyzedCount >= 3 ? "MED" : "LOW";

      // Compile final output
      stepResult.output = {
        competitorOutlines: competitorOutlines,
        sectionCoverage: evaluationResult?.sectionCoverage || {},
        finalOutline: evaluationResult?.finalOutline || [],
        skipped: skippedUrls,
        quality,
        totalCandidates: candidateUrls.length,
        totalAnalyzed: analyzedCount,
      };
      stepResult.status = "done";

      log(`[step2 API] Step 2 completed: Analyzed ${analyzedCount} competitors (quality: ${quality})`);

      return NextResponse.json({
        ok: true,
        tools: stepResult.tools,
        output: stepResult.output,
      });
    } catch (error: any) {
      log(`[step2 API] Step 2 failed: ${error.message}`);
      stepResult.status = "error";
      stepResult.error = { message: error.message, stack: error.stack };

      return NextResponse.json({
        ok: false,
        tools: stepResult.tools,
        output: null,
        error: error.message,
      });
    }
  } catch (error: any) {

    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}

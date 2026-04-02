/**
 * API endpoint for Step 4: Write Sections and Render HTML
 * 
 * Process:
 * 1. Write Section Content (for each chosen section)
 * 2. Review Pitfalls (polish all sections)
 * 3. Render HTML (assemble final page)
 */

import { NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";
import { writeSection } from "@/libs/monkey/actions/writeSection";
import { reviewArticle } from "@/libs/monkey/actions/reviewArticle";
import { renderSection, renderFullPage } from "@/libs/monkey/tools/renderers";
import { getSectionTemplate } from "@/libs/monkey/references/pageTypes/registry";
import { log } from "@/libs/monkey/ui/logger";
import { SectionContent } from "@/libs/monkey/references/marketingTypes";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { 
      model = "high", 
      step1Output,
      step2Output,
      step3Output,
      includeComments = false,
    } = body;

    if (!step1Output) {
      return NextResponse.json(
        { error: "step1Output is required" },
        { status: 400 }
      );
    }

    if (!step3Output || !step3Output.chosenSections) {
      return NextResponse.json(
        { error: "step3Output with chosenSections is required" },
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

    const { icp, offer, offerTypeAnalysis, talkPoints, hookPoints } = step1Output;
    const { sectionCoverage } = step2Output || {};
    const { chosenSections } = step3Output;

    log(`[step4 API] Starting Step 4: Writing ${chosenSections.length} sections`);

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
      stepId: "step4_write",
      stepName: "Write Sections and Render HTML",
      status: "running",
      payload: { model, sectionCount: chosenSections.length, includeComments },
      tools: [],
      output: null,
      error: null,
    };

    try {
      const writtenSections: SectionContent[] = [];
      const sectionErrors: Array<{ sectionType: string; error: string }> = [];

      // Tool 1: Write Each Section
      log(`[step4 API] Tool 1: Writing ${chosenSections.length} sections...`);

      for (let i = 0; i < chosenSections.length; i++) {
        const sectionConfig = chosenSections[i];
        const sectionType = sectionConfig.sectionType;
        const format = sectionConfig.format;

        try {
          log(`[step4 API] Writing section ${i + 1}/${chosenSections.length}: ${sectionType} (format: ${format})`);

          // Get competitor examples for this section type (including actual text examples)
          const sectionCoverageData = sectionCoverage?.[sectionType];
          const competitorExamples = sectionCoverageData?.competitors || [];
          const exampleTexts = sectionCoverageData?.examples || [];

          // Combine competitor examples with actual text examples
          const enrichedCompetitorExamples = competitorExamples.map((c: any) => {
            // Find matching example text by URL
            const exampleText = exampleTexts?.find((ex: any) => ex.competitor_url === c.url);
            return {
              url: c.url,
              heading: c.heading,
              preview: c.preview,
              exampleWriting: exampleText?.example_writing || "",
              briefReasoning: exampleText?.brief_reasoning || "",
            };
          });

          // Write the section
          const sectionContent = await writeSection(model, {
            sectionType,
            format,
            competitorExamples: enrichedCompetitorExamples,
            icp,
            offer,
            talkPoints,
            hookPoints,
            offerType: offerTypeAnalysis?.offerType || "transactional",
          });

          writtenSections.push(sectionContent);
          log(`[step4 API] ✓ Section ${i + 1} written: ${sectionType}`);
        } catch (error: any) {
          log(`[step4 API] ✗ Failed to write section ${sectionType}: ${error.message}`);
          sectionErrors.push({
            sectionType,
            error: error.message,
          });
        }
      }

      const writeSectionsResult = {
        toolId: "tool1_write_sections",
        toolName: "Write Sections",
        input: { sectionCount: chosenSections.length },
        output: {
          written: writtenSections.length,
          failed: sectionErrors.length,
          sections: writtenSections.map(s => ({
            sectionType: s.sectionType,
            format: s.format,
            hasContent: !!s.content,
          })),
        },
        outputRaw: JSON.stringify({
          written: writtenSections.length,
          failed: sectionErrors.length,
          sections: writtenSections.map(s => ({
            sectionType: s.sectionType,
            format: s.format,
            hasContent: !!s.content,
          })),
        }, null, 2),
        error: sectionErrors.length > 0 ? { errors: sectionErrors } : null,
      };
      stepResult.tools.push(writeSectionsResult);

      // Tool 2: Review Pitfalls
      log(`[step4 API] Tool 2: Reviewing pitfalls...`);

      let reviewResult;
      let articleReview: any = null;

      try {
        // Render sections to HTML for review
        const htmlSections = writtenSections.map(section => ({
          sectionType: section.sectionType,
          format: section.format,
          content: section.content,
          html: renderSection(section),
        }));

        const fullPageHtml = renderFullPage(writtenSections);

        articleReview = await reviewArticle(model, {
          fullHtml: fullPageHtml,
          sections: htmlSections,
          icp,
          offer,
        });

        reviewResult = {
          toolId: "tool2_review_pitfalls",
          toolName: "Review Pitfalls",
          input: { sectionCount: writtenSections.length },
          output: {
            overallQuality: articleReview.overallQuality,
            issuesCount: articleReview.issues.length,
            strengthsCount: articleReview.strengths.length,
            recommendationsCount: articleReview.recommendations.length,
          },
          outputRaw: JSON.stringify({
            overallQuality: articleReview.overallQuality,
            issuesCount: articleReview.issues.length,
            strengthsCount: articleReview.strengths.length,
            recommendationsCount: articleReview.recommendations.length,
          }, null, 2),
          error: null,
        };
        log(`[step4 API] ✓ Review completed: ${articleReview.overallQuality}`);
      } catch (error: any) {
        reviewResult = {
          toolId: "tool2_review_pitfalls",
          toolName: "Review Pitfalls",
          input: { sectionCount: writtenSections.length },
          output: null,
          outputRaw: null,
          error: { message: error.message, stack: error.stack },
        };
        log(`[step4 API] ✗ Failed to review: ${error.message}`);
      }
      stepResult.tools.push(reviewResult);

      // Tool 3: Render HTML
      log(`[step4 API] Tool 3: Rendering HTML...`);

      let renderResult;
      let fullPageHtml = "";

      try {
        const htmlSections = writtenSections.map(section => ({
          sectionType: section.sectionType,
          html: renderSection(section),
        }));

        fullPageHtml = renderFullPage(writtenSections);

        renderResult = {
          toolId: "tool3_render_html",
          toolName: "Render HTML",
          input: { sectionCount: writtenSections.length },
          output: {
            htmlSectionsCount: htmlSections.length,
            fullPageLength: fullPageHtml.length,
            sectionTypes: htmlSections.map(h => h.sectionType),
          },
          outputRaw: JSON.stringify({
            htmlSectionsCount: htmlSections.length,
            fullPageLength: fullPageHtml.length,
            sectionTypes: htmlSections.map(h => h.sectionType),
          }, null, 2),
          error: null,
        };
        log(`[step4 API] ✓ Rendered ${htmlSections.length} sections to HTML`);
      } catch (error: any) {
        renderResult = {
          toolId: "tool3_render_html",
          toolName: "Render HTML",
          input: { sectionCount: writtenSections.length },
          output: null,
          outputRaw: null,
          error: { message: error.message, stack: error.stack },
        };
        log(`[step4 API] ✗ Failed to render HTML: ${error.message}`);
      }
      stepResult.tools.push(renderResult);

      // Compile final output
      stepResult.output = {
        sections: writtenSections,
        html: fullPageHtml,
        htmlSections: writtenSections.map(section => ({
          sectionType: section.sectionType,
          format: section.format,
          html: renderSection(section),
        })),
        review: articleReview,
        errors: sectionErrors,
        totalSections: writtenSections.length,
        successfulSections: writtenSections.length - sectionErrors.length,
      };
      stepResult.status = "done";

      log(`[step4 API] Step 4 completed: ${writtenSections.length} sections written, HTML rendered`);

      return NextResponse.json({
        ok: true,
        tools: stepResult.tools,
        output: stepResult.output,
      });
    } catch (error: any) {
      log(`[step4 API] Step 4 failed: ${error.message}`);
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

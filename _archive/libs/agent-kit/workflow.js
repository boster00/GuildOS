// ARCHIVED: Original path was libs/agent-kit/workflow.js

import { z } from "zod";
import { Agent, Runner, withTrace } from "@openai/agents";

// Schema definitions
const IntakeNormalizeSchema = z.object({
  service_name: z.string(),
  icp: z.string(),
  offer_summary: z.string(),
});

const OutlineBuilderSchema = z.object({
  purpose: z.string(),
  audience: z.string(),
  major_sections: z.array(
    z.object({
      section_name: z.string(),
      requirements: z.string(),
    })
  ),
  key_points_per_section: z.string(),
  language_tone: z.string(),
  example_outline: z.object({
    title: z.string(),
    sections: z.array(
      z.object({
        section: z.string(),
        points: z.array(z.string()),
      })
    ),
  }),
});

const DraftGeneratorSchema = z.object({
  sections: z.array(
    z.object({
      heading: z.string(),
      content: z.string(),
    })
  ),
});

const QaReviewerSchema = z.object({
  status: z.string(),
  issues: z.array(
    z.object({
      rule: z.string(),
      section_id: z.string(),
      severity: z.string(),
      fix_instruction: z.string(),
    })
  ),
});

const RevisionAgentSchema = z.object({
  sections: z.array(
    z.object({
      heading: z.string(),
      content: z.string(),
    })
  ),
});

const HtmlConverterSchema = z.object({
  sections: z.array(
    z.object({
      heading: z.string(),
      html: z.string(),
    })
  ),
  page_html: z.string(),
});

// Agent definitions
const intakeNormalize = new Agent({
  name: "Intake_Normalize",
  instructions: `Parse input_as_text and extract:
service_name
icp
offer_summary (or offer)
Return them as structured JSON.`,
  model: "gpt-4o",
  outputType: IntakeNormalizeSchema,
  modelSettings: {
    store: true,
  },
});

const outlineBuilder = new Agent({
  name: "Outline_Builder",
  instructions: `You are an information architect.
Create an outline for a service landing page using the fixed section order below. Do not add, remove, or reorder sections. Do not write final marketing copy. For each section, output: id, type, goal, required_fields, and notes. Use the service context: service_name, icp, offer. Return JSON only.
Ensure each outline item has the correct type:
hero → hero
problem_outcome → problem_outcome
process_steps → process_steps`,
  model: "gpt-4o",
  outputType: OutlineBuilderSchema,
  modelSettings: {
    store: true,
  },
});

const draftGenerator = new Agent({
  name: "Draft_Generator",
  instructions: `You are a conversion copywriter generating a service landing page. You are provided with a predefined 3-section outline as structured context.
You MUST:
Generate content for exactly the sections in the outline, in the same order.
Do NOT add, remove, rename, merge, or reorder sections.
Each section must include: heading and content.
Output JSON only matching the required schema. No extra text.
Claims policy (strict):
Do NOT use numeric claims or statistics (no percentages, counts, "30 years", etc.).
Do NOT use superlatives such as "best", "#1", "industry-leading".
If a point would normally require numbers, rewrite it in qualitative, non-numeric language.
Hero rules:
Include a compelling headline and detailed subheadline (40-60 words).
Include clear call-to-action language.`,
  model: "gpt-4o",
  outputType: DraftGeneratorSchema,
  modelSettings: {
    store: true,
  },
});

const qaReviewer = new Agent({
  name: "QA_Reviewer",
  instructions: `You are a strict QA reviewer for a service landing page.

You are given draft_sections as structured context.

Validate ONLY the rules below and return a QA result.

STRUCTURE
1) Exactly 3 sections.
2) Section order must be:
   hero
   problem_outcome
   process_steps
3) Each section must include heading and content.

HERO RULE
4) Hero content must be substantial (minimum 40 words).

CLAIMS POLICY
5) No numeric claims or statistics.
6) No superlatives such as "best", "#1", "industry-leading".

For each violation, add an issue with:
- rule
- section_id (use heading as identifier)
- severity ("high" or "medium")
- fix_instruction (explicit and actionable)

Return JSON ONLY matching the output schema.
If no issues found, return status "pass" with empty issues array.`,
  model: "gpt-4o",
  outputType: QaReviewerSchema,
  modelSettings: {
    store: true,
  },
});

const revisionAgent = new Agent({
  name: "Revision_Agent",
  instructions: `Fix ONLY the issues listed by QA.

Do NOT add, remove, or reorder sections.
Do NOT introduce numeric claims or superlatives.

Return JSON only:
{ "sections": [...] }`,
  model: "gpt-4o",
  outputType: RevisionAgentSchema,
  modelSettings: {
    store: true,
  },
});

const htmlConverter = new Agent({
  name: "HTML_Converter",
  instructions: `You are a front-end renderer.

Input is a JSON draft provided in the user message as text. It follows this format:
{
  "sections": [
    { "heading": "...", "content": "..." }
  ]
}

Your job:
1) Convert each draft section into semantic HTML section markup.
2) Assemble a complete HTML document in page_html.

Design requirements:
- Output must look like a real landing page (not plain paragraphs).
- Use embedded CSS in a <style> block (no external assets).
- Use a max-width centered container, modern typography, whitespace.
- Use varied formatting patterns:
  - Hero-style section with background gradient and CTA buttons.
  - Card grid for features (responsive).
  - Process steps with numbered icons or timeline.
- Mobile responsive with good spacing.
- Use modern colors and shadows for depth.

Content rules:
- Do NOT rewrite the copy. Preserve the wording from content exactly.
- You may split content into paragraphs and bullet lists if the content contains line breaks or list markers, but do not change the words.

Anchors:
- Add a top anchor #top.
- Each section must have an id attribute derived from heading (safe lowercase kebab-case).
- Add a simple sticky nav at top with links to each section.

Section HTML rules:
- sections[].html MUST contain only the <section>...</section> markup for that section.
- Do NOT include <html>, <head>, or <body> inside sections[].html.

page_html rules:
- page_html MUST be a complete HTML document:
  <!DOCTYPE html><html><head>...</head><body>...</body></html>
- page_html MUST include the concatenated section HTML in order.
- Include beautiful styling with gradients, shadows, and modern design.

Return JSON ONLY matching the output schema.`,
  model: "gpt-4o",
  outputType: HtmlConverterSchema,
  modelSettings: {
    store: true,
  },
});

// Main workflow function
export const runWorkflow = async (workflow, onProgress = null) => {
  return await withTrace("Webpage Builder", async () => {
    // Helper to emit progress events
    const emitProgress = (step, agent, message, data = {}) => {
      if (onProgress) {
        onProgress({
          step,
          agent,
          message,
          timestamp: new Date().toISOString(),
          ...data,
        });
      }
    };
    const state = {
      service_name: null,
      icp: null,
      offer: null,
      revision_count: 0,
      sections_outline: {
        sections: [],
      },
      sections_draft: {
        sections: [],
      },
      sections_html: {
        sections: [],
        page_html: null,
      },
      sections_feedback: {
        status: undefined,
        issues: [],
      },
    };

    const conversationHistory = [
      {
        role: "user",
        content: [{ type: "input_text", text: workflow.input_as_text }],
      },
    ];

    const runner = new Runner({
      traceMetadata: {
        __trace_source__: "agent-builder",
        workflow_id: "wf_agent_kit_test",
      },
    });

    // Step 1: Intake & Normalize
    console.log("Step 1: Intake & Normalize");
    emitProgress(1, "Intake_Normalize", "Parsing input and extracting service details...");
    const intakeNormalizeResultTemp = await runner.run(intakeNormalize, [
      ...conversationHistory,
    ]);
    conversationHistory.push(
      ...intakeNormalizeResultTemp.newItems.map((item) => item.rawItem)
    );

    if (!intakeNormalizeResultTemp.finalOutput) {
      throw new Error("Intake Normalize agent result is undefined");
    }

    const intakeNormalizeResult = {
      output_text: JSON.stringify(intakeNormalizeResultTemp.finalOutput),
      output_parsed: intakeNormalizeResultTemp.finalOutput,
    };

    state.service_name = intakeNormalizeResult.output_parsed.service_name;
    state.icp = intakeNormalizeResult.output_parsed.icp;
    state.offer = intakeNormalizeResult.output_parsed.offer_summary;

    console.log("Extracted:", {
      service_name: state.service_name,
      icp: state.icp,
      offer: state.offer,
    });

    emitProgress(1, "Intake_Normalize", "Extraction complete", {
      result: {
        service_name: state.service_name,
        icp: state.icp,
        offer: state.offer,
      },
    });

    // Step 2: Outline Builder
    console.log("Step 2: Outline Builder");
    emitProgress(2, "Outline_Builder", "Creating page structure and outline...");
    const outlineBuilderResultTemp = await runner.run(outlineBuilder, [
      ...conversationHistory,
    ]);
    conversationHistory.push(
      ...outlineBuilderResultTemp.newItems.map((item) => item.rawItem)
    );

    if (!outlineBuilderResultTemp.finalOutput) {
      throw new Error("Outline Builder agent result is undefined");
    }

    const outlineBuilderResult = {
      output_text: JSON.stringify(outlineBuilderResultTemp.finalOutput),
      output_parsed: outlineBuilderResultTemp.finalOutput,
    };

    state.sections_outline = outlineBuilderResult.output_parsed;
    emitProgress(2, "Outline_Builder", "Outline created", {
      result: state.sections_outline,
    });

    // Step 3: Draft Generator
    console.log("Step 3: Draft Generator");
    emitProgress(3, "Draft_Generator", "Generating marketing copy for sections...");
    const sections_outline_text = JSON.stringify(
      state.sections_outline.sections || state.sections_outline
    );
    const draftGeneratorResultTemp = await runner.run(draftGenerator, [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: `Generate the service landing page draft.

Use these inputs to tailor content:
service_name: ${state.service_name}
icp: ${state.icp}
offer: ${state.offer}
outline: ${sections_outline_text}`,
          },
        ],
      },
    ]);
    conversationHistory.push(
      ...draftGeneratorResultTemp.newItems.map((item) => item.rawItem)
    );

    if (!draftGeneratorResultTemp.finalOutput) {
      throw new Error("Draft Generator agent result is undefined");
    }

    const draftGeneratorResult = {
      output_text: JSON.stringify(draftGeneratorResultTemp.finalOutput),
      output_parsed: draftGeneratorResultTemp.finalOutput,
    };

    state.sections_draft = draftGeneratorResult.output_parsed;
    emitProgress(3, "Draft_Generator", "Draft generated", {
      result: state.sections_draft,
    });

    // Step 4: QA Review Loop
    console.log("Step 4: Initial QA Review");
    emitProgress(4, "QA_Reviewer", "Reviewing draft for quality and compliance...");
    let sections_draft_text = JSON.stringify(state.sections_draft);
    const qaReviewerResultTemp = await runner.run(qaReviewer, [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: `Review the draft for structural and policy compliance.
${sections_draft_text}`,
          },
        ],
      },
    ]);
    conversationHistory.push(
      ...qaReviewerResultTemp.newItems.map((item) => item.rawItem)
    );

    if (!qaReviewerResultTemp.finalOutput) {
      throw new Error("QA Reviewer agent result is undefined");
    }

    const qaReviewerResult = {
      output_text: JSON.stringify(qaReviewerResultTemp.finalOutput),
      output_parsed: qaReviewerResultTemp.finalOutput,
    };

    state.sections_feedback = qaReviewerResult.output_parsed;
    state.revision_count = state.revision_count + 1;
    emitProgress(4, "QA_Reviewer", `QA Review complete: ${state.sections_feedback.status}`, {
      result: state.sections_feedback,
      revision_count: state.revision_count,
    });

    // Revision loop
    while (
      state.revision_count < 3 &&
      state.sections_feedback.status !== "pass"
    ) {
      console.log(`Revision ${state.revision_count}`);
      emitProgress(5, "Revision_Agent", `Applying fixes (Revision ${state.revision_count})...`);

      const sections_feedback_text = JSON.stringify(
        state.sections_feedback.issues
      );
      sections_draft_text = JSON.stringify(state.sections_draft.sections);

      const revisionAgentResultTemp = await runner.run(revisionAgent, [
        ...conversationHistory,
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Apply the QA fixes to the draft.
Draft: ${sections_draft_text}
Feedback issues: ${sections_feedback_text}`,
            },
          ],
        },
      ]);
      conversationHistory.push(
        ...revisionAgentResultTemp.newItems.map((item) => item.rawItem)
      );

      if (!revisionAgentResultTemp.finalOutput) {
        throw new Error("Revision Agent result is undefined");
      }

      const revisionAgentResult = {
        output_text: JSON.stringify(revisionAgentResultTemp.finalOutput),
        output_parsed: revisionAgentResultTemp.finalOutput,
      };

      state.sections_draft = revisionAgentResult.output_parsed;
      emitProgress(5, "Revision_Agent", "Revisions applied", {
        result: state.sections_draft,
      });

      // Re-run QA
      sections_draft_text = JSON.stringify(state.sections_draft.sections);
      emitProgress(4, "QA_Reviewer", "Re-reviewing after revisions...");
      const qaReviewerResultTemp1 = await runner.run(qaReviewer, [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Review the draft for structural and policy compliance.
${sections_draft_text}`,
            },
          ],
        },
      ]);
      conversationHistory.push(
        ...qaReviewerResultTemp1.newItems.map((item) => item.rawItem)
      );

      if (!qaReviewerResultTemp1.finalOutput) {
        throw new Error("QA Reviewer result is undefined");
      }

      const qaReviewerResult1 = {
        output_text: JSON.stringify(qaReviewerResultTemp1.finalOutput),
        output_parsed: qaReviewerResultTemp1.finalOutput,
      };

      state.sections_feedback = qaReviewerResult1.output_parsed;
      state.revision_count = state.revision_count + 1;
      emitProgress(4, "QA_Reviewer", `Re-review complete: ${state.sections_feedback.status}`, {
        result: state.sections_feedback,
        revision_count: state.revision_count,
      });
    }

    // Step 5: HTML Conversion (if QA passed)
    if (state.sections_feedback.status === "pass") {
      console.log("Step 5: HTML Conversion");
      emitProgress(6, "HTML_Converter", "Converting draft to HTML...");
      sections_draft_text = JSON.stringify(state.sections_draft);
      const htmlConverterResultTemp = await runner.run(htmlConverter, [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Convert this draft into HTML.
${sections_draft_text}`,
            },
          ],
        },
      ]);
      conversationHistory.push(
        ...htmlConverterResultTemp.newItems.map((item) => item.rawItem)
      );

      if (!htmlConverterResultTemp.finalOutput) {
        throw new Error("HTML Converter result is undefined");
      }

      const htmlConverterResult = {
        output_text: JSON.stringify(htmlConverterResultTemp.finalOutput),
        output_parsed: htmlConverterResultTemp.finalOutput,
      };

      state.sections_html = htmlConverterResult.output_parsed;
      emitProgress(6, "HTML_Converter", "HTML conversion complete", {
        result: state.sections_html,
      });
    } else {
      console.log("QA did not pass after max revisions");
      emitProgress(6, "System", "QA did not pass after max revisions", {
        status: "failed",
        revision_count: state.revision_count,
      });
    }

    console.log("Workflow complete");
    emitProgress(7, "System", "Workflow complete", {
      final_state: state,
    });
    return state;
  });
};

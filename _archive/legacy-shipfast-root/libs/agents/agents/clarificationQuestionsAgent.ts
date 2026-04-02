/**
 * Clarification Questions Agent
 * Migrated from generateClarificationQuestions action
 * Uses Agents SDK for better orchestration and streaming
 */

import { Agent, tool } from "@openai/agents";
import { z } from "zod";
import { classifyLandingPageTopic } from "@/libs/monkey/actions/classifyLandingPageTopic";
import { log } from "@/libs/monkey/ui/logger";

// Tool to extract page definition
const extractPageDefinition = tool({
  name: "extract_page_definition",
  description: "Extract known facts and missing fields from Step 1 output (ICP and Offer data).",
  parameters: z.object({
    step1Output: z.object({
      icp: z.object({
        name: z.string().nullable().optional(),
        description: z.string().nullable().optional(),
      }).nullable().optional(),
      offer: z.object({
        name: z.string().nullable().optional(),
        description: z.string().nullable().optional(),
      }).nullable().optional(),
    }),
  }),
  execute: async ({ step1Output }) => {
    try {
      const pageDefinition = await classifyLandingPageTopic("agent", step1Output as any);
      
      const result = {
        topicSummary: pageDefinition.topicSummary,
        knownFacts: pageDefinition.knownFacts,
        missingFieldsRanked: pageDefinition.missingFieldsRanked,
        schema: pageDefinition.schema,
      };
      
      return result;
    } catch (error: any) {
      throw error;
    }
  },
});

// Create the agent
export const clarificationQuestionsAgent = new Agent({
  name: "ClarificationQuestionsAgent",
  instructions: `You are a landing page clarifying-question generator.

**What the user has already provided:**
Review the known_facts from the page definition - acknowledge these in your response.

**Your task:**
Generate EXACTLY 2 strategic questions for the top 2 missing fields (from missing_fields_ranked).

**Process:**
1. Use extract_page_definition tool to analyze the Step 1 output
2. Review the known facts (what user already provided) and missing fields
3. Generate EXACTLY 2 questions - one for each of the top 2 missing fields
4. Do NOT generate more than 2 questions

**HARD CONSTRAINTS:**

1. **Grounding**: Each question must map to exactly one UNKNOWN schema field from missing_fields_ranked (top 2 only).

2. **Non-Leading**: Questions must be NON-LEADING:
   - Do NOT mention a specific differentiator, mechanism, certification, metric, or niche concern unless it appears in known_facts.
   - Ask open-endedly (e.g., "What quality concerns matter most?" NOT "How do you ensure lot-to-lot consistency?").
   - Do NOT presuppose specific claims, features, or mechanisms.

3. **Page-Definition Over Tactical**: Prefer "page-definition" questions over tactical implementation:
   - Do NOT ask about form field details unless primary_CTA is KNOWN and explicitly form-based.
   - Focus on what the page should communicate, not how to implement it.

4. **Plain Language**: Ask questions in plain language suitable for a business intake form.

**Output Format:**
Return a JSON array with EXACTLY 2 question objects:
[
  { "field": "<schema_field_name>", "question": "<question text>" },
  { "field": "<schema_field_name>", "question": "<question text>" }
]

CRITICAL: Generate EXACTLY 2 questions, no more, no less.`,
  tools: [extractPageDefinition],
});

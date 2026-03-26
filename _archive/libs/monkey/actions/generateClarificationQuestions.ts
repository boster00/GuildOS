// ARCHIVED: Original path was libs/monkey/actions/generateClarificationQuestions.ts

/**
 * Generate clarification questions before starting competitor research
 * Page Definition First approach: adaptive, non-leading, grounded questions
 */

import { callStructured } from "../tools/runtime/callStructured";
import { log } from "../ui/logger";
import { classifyLandingPageTopic, PageDefinition, SchemaField } from "./classifyLandingPageTopic";

export interface ClarificationQuestion {
  questionId: string;
  question: string;
  group: "Core" | "Audience" | "Differentiation" | "Funnel" | "Other"; // Group for display
  missingField: SchemaField; // The missing_field this question maps to
  options?: string[]; // Optional: predefined options if applicable
  required: boolean;
}

export interface ClarificationQuestionsResult {
  questions: ClarificationQuestion[];
  contextSummary: string; // Summary of what we already know from Step 1
  digestedInfo: {
    topicSummary: string;
    knownFacts: string[];
    missingFieldsRanked: SchemaField[];
  };
}

const clarificationQuestionsSchema = {
  type: "array",
  items: {
    type: "object",
    additionalProperties: true,
    properties: {
      field: { type: "string" },
      question: { type: "string" }
    },
    required: ["field", "question"]
  }
};

/**
 * Validates that a question doesn't contain terms not in known_facts when field is "differentiators"
 * Returns true if question is valid, false if it should be rejected
 */
function validateQuestionAgainstKnownFacts(
  question: string,
  field: string,
  knownFacts: string[]
): boolean {
  // Only validate differentiators field for over-anchoring
  if (field !== "differentiators") {
    return true; // All other fields pass validation
  }

  // If no known facts, be more lenient (allow the question)
  if (knownFacts.length === 0) {
    return true;
  }

  // Extract key terms from known facts (simple approach)
  const knownText = knownFacts.join(" ").toLowerCase();
  const questionLower = question.toLowerCase();
  
  // Check for over-specific technical jargon or industry-specific terms
  // that aren't mentioned in known facts
  const suspiciousPatterns = [
    /\b\w+[- ]to[- ]\w+\b/i,  // Pattern like "X-to-X" (lot-to-lot, batch-to-batch, etc.)
    /\bcertified\s+\w+/i,      // "certified [something]" unless mentioned
    /\bcompliant\s+with\s+\w+/i, // "compliant with [standard]" unless mentioned
  ];

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(question)) {
      const match = question.match(pattern);
      if (match && !knownText.includes(match[0].toLowerCase())) {
        // Reject if the specific term isn't in known facts
        return false;
      }
    }
  }

  // For other patterns, be more lenient - only reject if clearly unrelated
  return true;
}

/**
 * Maps schema field to display group
 */
function getGroupForField(field: SchemaField): "Core" | "Audience" | "Differentiation" | "Funnel" | "Other" {
  const coreFields: SchemaField[] = ["primary_audience", "offer_scope", "deliverables"];
  const audienceFields: SchemaField[] = ["primary_use_case"];
  const differentiationFields: SchemaField[] = ["differentiators", "proof_assets_available"];
  const funnelFields: SchemaField[] = ["primary_CTA", "post_CTA_flow", "traffic_source_intent"];
  
  if (coreFields.includes(field)) return "Core";
  if (audienceFields.includes(field)) return "Audience";
  if (differentiationFields.includes(field)) return "Differentiation";
  if (funnelFields.includes(field)) return "Funnel";
  return "Other";
}

export async function generateClarificationQuestions(
  model: "agent" | "high" | "mid",
  step1Output: {
    icp?: any;
    offer?: any;
    offerTypeAnalysis?: {
      offerType?: "transactional" | "preaching";
      reasoning?: string;
    };
    talkPoints?: {
      uniqueSellingPoints?: Array<{ point: string; category: string }>;
      transactionalFacts?: Array<{ point: string; source: string }>;
    };
    hookPoints?: {
      painPoints?: Array<{ point: string; reasoning: string }>;
      identity?: Array<{ point: string; reasoning: string }>;
      useScenarios?: Array<{ point: string; reasoning: string }>;
      selected?: { type: string; reasoning: string };
    };
  }
): Promise<ClarificationQuestionsResult> {
  // Logging removed for cleaner workflow

  // STEP 1: Extract known facts and missing fields
  let pageDefinition: PageDefinition;
  try {
    pageDefinition = await classifyLandingPageTopic(model, step1Output);
    // Logging removed for cleaner workflow
  } catch (error: any) {
    throw new Error(`Failed to extract page definition: ${error.message}`);
  }

  // If no missing fields, return empty questions
  if (pageDefinition.missingFieldsRanked.length === 0) {
    return {
      questions: [],
      contextSummary: pageDefinition.topicSummary,
      digestedInfo: {
        topicSummary: pageDefinition.topicSummary,
        knownFacts: pageDefinition.knownFacts,
        missingFieldsRanked: [],
      },
    };
  }

  // Limit to top 2 missing fields + 1 open-ended question = max 3 questions
  const topMissingFields = pageDefinition.missingFieldsRanked.slice(0, 2);
  const numQuestionsToGenerate = Math.min(2, topMissingFields.length); // Max 2 specific questions

  const systemPrompt = `You are a landing page clarification assistant.

**What the user has already provided:**
${pageDefinition.knownFacts.length > 0 
  ? pageDefinition.knownFacts.map(fact => `✓ ${fact}`).join("\n")
  : "- No specific details yet"}

**What we still need to know (top ${numQuestionsToGenerate} priorities):**
${topMissingFields.map((field, idx) => `${idx + 1}. ${field}`).join('\n')}

**Your task:**
Generate EXACTLY ${numQuestionsToGenerate} focused, non-leading questions to fill these gaps.

**Rules:**
1. Each question maps to ONE missing field above
2. Be open-ended - don't assume specific features/claims not mentioned by the user
3. Use plain business language
4. Focus on strategic info, not implementation details

**Output format:**
Return ONLY a JSON array with ${numQuestionsToGenerate} question objects:
[
  { "field": "missing_field_name", "question": "Your question here?" },
  { "field": "missing_field_name", "question": "Your question here?" }
]

CRITICAL: Respond with ONLY valid JSON (an array). No markdown, no extra text.`;

  const userPrompt = `Project: ${pageDefinition.topicSummary}

Generate ${numQuestionsToGenerate} strategic questions for the top ${numQuestionsToGenerate} missing fields listed above.

Return ONLY a JSON array with ${numQuestionsToGenerate} question objects. No markdown, no explanations.`;

  const messages = [
    { role: "system" as const, content: systemPrompt },
    { role: "user" as const, content: userPrompt },
  ];

  // Logging removed for cleaner workflow

  try {
    const result = await callStructured(
      model,
      messages,
      clarificationQuestionsSchema,
      { 
        stepName: "generateClarificationQuestions", 
        maxAttempts: 3, // Increase attempts
        temperature: 0.7, // Add some creativity to avoid single-answer pattern
      }
    );

    // Logging removed for cleaner workflow

    if (!result.ok || !result.data) {
      throw new Error("Failed to generate clarification questions: no result");
    }

    const questionsArray = result.data;

    if (!Array.isArray(questionsArray)) {
      throw new Error("Invalid questions format: expected array");
    }

    // Validate and transform questions - LIMIT TO TOP 2
    const validatedQuestions: ClarificationQuestion[] = [];
    const topFields = pageDefinition.missingFieldsRanked.slice(0, 2); // Only top 2 fields
    
    for (const q of questionsArray) {
      if (!q.field || !q.question) {
        continue;
      }

      // CRITICAL: Only accept questions for the top 2 missing fields
      if (!topFields.includes(q.field)) {
        continue;
      }

      // Validate question doesn't over-anchor (especially for differentiators)
      if (!validateQuestionAgainstKnownFacts(q.question, q.field, pageDefinition.knownFacts)) {
        continue;
      }

      // Only add if we haven't reached 2 questions yet
      if (validatedQuestions.length < 2) {
        validatedQuestions.push({
          questionId: `question_${validatedQuestions.length + 1}`,
          question: q.question,
          group: getGroupForField(q.field),
          missingField: q.field,
          required: true,
          // Note: inputType and options will be inferred in the API endpoint
        });
      }
    }

    // If all questions were filtered but we have missing fields, include them anyway
    if (validatedQuestions.length === 0 && pageDefinition.missingFieldsRanked.length > 0 && questionsArray.length > 0) {
      
      // Include questions even if validation failed (but log the issue)
      for (const q of questionsArray) {
        if (q.field && q.question && pageDefinition.missingFieldsRanked.includes(q.field)) {
          validatedQuestions.push({
            questionId: `question_${validatedQuestions.length + 1}`,
            question: q.question,
            group: getGroupForField(q.field),
            missingField: q.field,
            required: true,
          });
        }
      }
    }

    // Always add an open-ended question at the end
    validatedQuestions.push({
      questionId: `question_open_ended`,
      question: "Is there anything else you'd like to highlight or include on the page?",
      group: "Other",
      missingField: "brand_tone", // Map to a generic field
      required: false, // This one is optional
    });

    return {
      contextSummary: pageDefinition.topicSummary,
      digestedInfo: {
        topicSummary: pageDefinition.topicSummary,
        knownFacts: pageDefinition.knownFacts,
        missingFieldsRanked: pageDefinition.missingFieldsRanked,
      },
      questions: validatedQuestions,
    };
  } catch (error: any) {
    throw new Error(`Failed to generate clarification questions: ${error.message}`);
  }
}

// ARCHIVED: Original path was libs/monkey/actions/inferQuestionType.ts

/**
 * Infer question type and generate options for clarification questions
 * Similar to Cursor's planning mode - provides options for questions that can be answered in a few ways
 */

import { callStructured } from "../tools/runtime/callStructured";
import { log } from "../ui/logger";

export type QuestionInputType = 
  | "multiple_choice"  // Question with predefined options + "Other" field
  | "text"             // Free-form text input
  | "textarea"         // Longer text input
  | "number"            // Numeric input
  | "boolean"           // Yes/No question
  | "date"              // Date input
  | "email"             // Email input
  | "url";              // URL input

export interface QuestionTypeInference {
  inputType: QuestionInputType;
  options?: string[];  // Predefined options (for multiple_choice)
  placeholder?: string;
  helpText?: string;
  required: boolean;
}

const questionTypeInferenceSchema = {
  type: "object",
  additionalProperties: true,
  properties: {
    inputType: {
      type: "string",
      enum: ["multiple_choice", "text", "textarea", "number", "boolean", "date", "email", "url"]
    },
    options: {
      type: "array",
      items: { type: "string" }
    },
    placeholder: { type: "string" },
    helpText: { type: "string" },
    required: { type: "boolean" }
  },
  required: ["inputType", "required"]
};

/**
 * Infer the question type and generate options if applicable
 */
export async function inferQuestionType(
  model: "agent" | "high" | "mid",
  question: string,
  field: string,
  context?: {
    knownFacts?: string[];
    topicSummary?: string;
  }
): Promise<QuestionTypeInference> {
  // Logging removed for cleaner workflow

  const systemPrompt = `You are a question type inference system. Analyze a clarification question and determine:
1. The best input type (multiple_choice, text, textarea, number, boolean, date, email, url)
2. If multiple_choice, generate 3-5 common options plus "Other" option
3. A helpful placeholder or help text if needed

**Guidelines:**
- Use "multiple_choice" if the question can be answered with 3-5 common options (e.g., "What is the primary use case?" → ["Research & Development", "Clinical Trials", "Quality Control", "Other"])
- Use "text" for short answers (names, titles, single phrases)
- Use "textarea" for longer explanations or descriptions
- Use "number" for numeric values (turnaround time, quantity, etc.)
- Use "boolean" for yes/no questions
- Use "date", "email", "url" for specific data types
- Always include "Other" as the last option for multiple_choice questions
- Make options specific and actionable, not generic

**Context:**
${context?.topicSummary ? `Topic: ${context.topicSummary}` : ""}
${context?.knownFacts?.length ? `Known facts: ${context.knownFacts.join(", ")}` : ""}

Return a JSON object with inputType, options (if multiple_choice), placeholder, helpText, and required.`;

  const userPrompt = `Question: "${question}"
Field: "${field}"

Determine the best input type and generate options if applicable.`;

  const result = await callStructured(
    model,
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
    questionTypeInferenceSchema,
    { stepName: "inferQuestionType", maxAttempts: 2 }
  );

  if (!result.ok || !result.data) {
    return {
      inputType: "text",
      required: true,
      placeholder: "Enter your answer..."
    };
  }

  const inference = result.data as QuestionTypeInference;

  // Ensure "Other" is included for multiple_choice
  if (inference.inputType === "multiple_choice" && inference.options) {
    if (!inference.options.includes("Other")) {
      inference.options.push("Other");
    }
  }

  // Logging removed for cleaner workflow

  return inference;
}

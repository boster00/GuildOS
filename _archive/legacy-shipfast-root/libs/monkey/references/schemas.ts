/**
 * JSON Schemas for validation
 * Only includes schemas used by active pipelines
 */

export const triageTaskSchema = {
  type: "object",
  additionalProperties: true,
  properties: {
    inferredTaskType: {
      type: "string",
      enum: [
        "WRITE_ARTICLE_LANDING",
        "WRITE_ARTICLE_DECISION_GUIDE",
        "WRITE_ARTICLE_MARKETING",
      ],
    },
    confidence: {
      type: "number",
      minimum: 0,
      maximum: 100,
    },
    reasoning: {
      type: "string",
    },
  },
  required: ["inferredTaskType", "confidence", "reasoning"],
};

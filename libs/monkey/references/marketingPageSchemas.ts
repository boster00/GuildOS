/**
 * JSON Schemas for Marketing Page Pipeline
 * All schemas allow additionalProperties for flexibility
 */

export const competitorValidationSchema = {
  type: "object",
  additionalProperties: true,
  properties: {
    isRelevantCompetitorPage: { type: "boolean" },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    matchedSignals: { type: "array", items: { type: "string" } },
    rejectReasons: { type: "array", items: { type: "string" } },
    pageArchetype: {
      type: "string",
      enum: ["service_landing", "pricing", "directory", "blog", "tool", "unknown"],
    },
  },
  required: ["isRelevantCompetitorPage", "confidence", "pageArchetype"],
};

export const competitorBlockMappingSchema = {
  type: "object",
  additionalProperties: true,
  properties: {
    blockId: { type: "string" },
    heading: { type: "string" },
    snippet: { type: "string" },
    sectionType: { 
      type: ["string", "null"],
      // Allow null or a string value
    },
    confidence: { type: "number", minimum: 0, maximum: 1 },
  },
  required: ["blockId", "heading", "snippet"],
  // sectionType and confidence are optional
};

export const competitorCoverageSchema = {
  type: "object",
  additionalProperties: true,
  properties: {
    coverageBySectionType: { type: "object", additionalProperties: true },
    commonOrderingPatterns: { type: "array", items: { type: "string" } },
    archetypeCounts: { type: "object", additionalProperties: { type: "number" } },
  },
  required: ["coverageBySectionType"],
};

export const icpModelSchema = {
  type: "object",
  additionalProperties: true,
  properties: {
    roles: { type: "array", items: { type: "string" } },
    pains: { type: "array", items: { type: "string" } },
    decisionCriteria: { type: "array", items: { type: "string" } },
    objections: { type: "array", items: { type: "string" } },
    languageTokens: { type: "array", items: { type: "string" } },
  },
  required: ["roles", "pains", "decisionCriteria", "objections", "languageTokens"],
};

export const claimBankSchema = {
  type: "object",
  additionalProperties: true,
  properties: {
    allowedFacts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: true,
        properties: {
          category: { type: "string" },
          fact: { type: "string" },
          source: { type: "string" },
        },
        required: ["category", "fact", "source"],
      },
    },
    bannedPatterns: { type: "array", items: { type: "string" } },
    uspAngles: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: true,
        properties: {
          angle: { type: "string" },
          recommendedSection: { type: "string" },
          recommendedFormat: { type: "string" },
        },
        required: ["angle"],
      },
    },
  },
  required: ["allowedFacts", "bannedPatterns", "uspAngles"],
};

export const chosenSectionSchema = {
  type: "object",
  additionalProperties: true,
  properties: {
    sectionType: { type: "string" },
    format: { type: "string" },
    rationale: {
      type: "object",
      additionalProperties: true,
      properties: {
        registryReason: { type: "string" },
        competitorEvidenceRefs: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: true,
            properties: {
              url: { type: "string" },
              blockId: { type: "string" },
            },
          },
        },
        icpOfferReason: { type: "string" },
        riskNotes: { type: "string" },
      },
      required: ["registryReason"],
    },
  },
  required: ["sectionType", "format", "rationale"],
};

export const sectionContentSchema = {
  type: "object",
  additionalProperties: true,
  properties: {
    sectionType: { type: "string" },
    format: { type: "string" },
    content: { type: "object", additionalProperties: true },
    notes: { type: "object", additionalProperties: true },
  },
  required: ["sectionType", "format", "content"],
};

export const intentModelSchema = {
  type: "object",
  additionalProperties: true,
  properties: {
    pageGoal: {
      type: "string",
      enum: ["quote_request", "demo", "purchase", "download", "trial", "book_call", "register", "subscribe", "watch", "browse"],
    },
    primaryCTA: {
      type: "object",
      additionalProperties: true,
      properties: {
        label: { type: "string" },
        action: { type: "string" },
      },
      required: ["label", "action"],
    },
    icpModel: icpModelSchema,
    uspAngles: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: true,
        properties: {
          usp: { type: "string" },
          bestPresentation: { type: "string" },
          notes: { type: "string" },
        },
        required: ["usp"],
      },
    },
    claimBank: claimBankSchema,
    competitorQueryHints: {
      type: "object",
      additionalProperties: true,
      properties: {
        seedQueries: { type: "array", items: { type: "string" } },
        keywords: { type: "array", items: { type: "string" } },
      },
      required: ["seedQueries", "keywords"],
    },
  },
  required: ["pageGoal", "primaryCTA", "icpModel", "uspAngles", "claimBank", "competitorQueryHints"],
};

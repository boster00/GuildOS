/**
 * Step 1: Extract Known Facts + Missing Fields (Page Definition First)
 * No inference, no forced buckets, just explicit facts and structured unknowns
 */

import { callStructured } from "../tools/runtime/callStructured";
import { log } from "../ui/logger";

export type SchemaField = 
  | "primary_audience"
  | "primary_use_case"
  | "offer_type"
  | "offer_scope"
  | "deliverables"
  | "constraints"
  | "differentiators"
  | "proof_assets_available"
  | "primary_CTA"
  | "post_CTA_flow"
  | "traffic_source_intent"
  | "brand_tone";

export interface SchemaFieldStatus {
  status: "KNOWN" | "UNKNOWN";
  value?: string; // Only present if status is "KNOWN"
}

export interface PageDefinition {
  topicSummary: string;
  knownFacts: string[]; // Atomic facts explicitly stated (no inference)
  schema: {
    primary_audience: SchemaFieldStatus;
    primary_use_case: SchemaFieldStatus;
    offer_type: SchemaFieldStatus;
    offer_scope: SchemaFieldStatus;
    deliverables: SchemaFieldStatus;
    constraints: SchemaFieldStatus;
    differentiators: SchemaFieldStatus;
    proof_assets_available: SchemaFieldStatus;
    primary_CTA: SchemaFieldStatus;
    post_CTA_flow: SchemaFieldStatus;
    traffic_source_intent: SchemaFieldStatus;
    brand_tone: SchemaFieldStatus;
  };
  missingFieldsRanked: SchemaField[]; // UNKNOWN fields ranked by importance
}

const pageDefinitionSchema = {
  type: "object",
  additionalProperties: true,
  properties: {
    topicSummary: { type: "string" },
    topic_summary: { type: "string" }, // Accept both formats
    knownFacts: {
      type: "array",
      items: { type: "string" }
    },
    known_facts: { // Accept both formats
      type: "array",
      items: { type: "string" }
    },
    schema: {
      type: "object",
      additionalProperties: true,
      properties: {
        primary_audience: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["KNOWN", "UNKNOWN"] },
            value: { type: "string" }
          },
          required: ["status"]
        },
        primary_use_case: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["KNOWN", "UNKNOWN"] },
            value: { type: "string" }
          },
          required: ["status"]
        },
        offer_type: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["KNOWN", "UNKNOWN"] },
            value: { type: "string" }
          },
          required: ["status"]
        },
        offer_scope: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["KNOWN", "UNKNOWN"] },
            value: { type: "string" }
          },
          required: ["status"]
        },
        deliverables: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["KNOWN", "UNKNOWN"] },
            value: { type: "string" }
          },
          required: ["status"]
        },
        constraints: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["KNOWN", "UNKNOWN"] },
            value: { type: "string" }
          },
          required: ["status"]
        },
        differentiators: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["KNOWN", "UNKNOWN"] },
            value: { type: "string" }
          },
          required: ["status"]
        },
        proof_assets_available: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["KNOWN", "UNKNOWN"] },
            value: { type: "string" }
          },
          required: ["status"]
        },
        primary_CTA: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["KNOWN", "UNKNOWN"] },
            value: { type: "string" }
          },
          required: ["status"]
        },
        post_CTA_flow: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["KNOWN", "UNKNOWN"] },
            value: { type: "string" }
          },
          required: ["status"]
        },
        traffic_source_intent: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["KNOWN", "UNKNOWN"] },
            value: { type: "string" }
          },
          required: ["status"]
        },
        brand_tone: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["KNOWN", "UNKNOWN"] },
            value: { type: "string" }
          },
          required: ["status"]
        }
      },
      required: [
        "primary_audience", "primary_use_case", "offer_type", "offer_scope",
        "deliverables", "constraints", "differentiators", "proof_assets_available",
        "primary_CTA", "post_CTA_flow", "traffic_source_intent", "brand_tone"
      ]
    },
    missingFieldsRanked: {
      type: "array",
      items: {
        type: "string",
      }
    },
    missing_fields_ranked: { // Accept both formats
      type: "array",
      items: {
        type: "string",
        enum: [
          "primary_audience",
          "primary_use_case",
          "offer_type",
          "offer_scope",
          "deliverables",
          "constraints",
          "differentiators",
          "proof_assets_available",
          "primary_CTA",
          "post_CTA_flow",
          "traffic_source_intent",
          "brand_tone"
        ]
      }
    }
  },
  required: ["topicSummary", "knownFacts", "schema", "missingFieldsRanked"]
};

export async function classifyLandingPageTopic(
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
): Promise<PageDefinition> {
  // Logging removed for cleaner workflow

  // Extract all available information from Step 1
  const icp = step1Output.icp || {};
  const offer = step1Output.offer || {};
  const offerTypeAnalysis = step1Output.offerTypeAnalysis || {};
  const talkPoints = step1Output.talkPoints || {};
  const hookPoints = step1Output.hookPoints || {};

  // Build comprehensive context
  const icpName = icp.name || "Not specified";
  const icpDescription = icp.icpDesc || icp.description || "Not specified";
  const offerName = offer.name || "Not specified";
  const offerDescription = offer.description || "Not specified";
  const usps = talkPoints.uniqueSellingPoints?.map((usp: any) => usp.point).join(", ") || "None identified";
  
  // Additional ICP fields
  const whoTheyAre = icp.whoTheyAre || "";
  const whatTheyWant = icp.whatTheyWant || "";
  const companyHelp = icp.companyHelp || "";

  const systemPrompt = `You are an intake classifier for landing page projects.

**Input**: A short user description of what they want a landing page for, plus any context they provided.

**Goal**: Extract ONLY what is explicitly known, and identify the highest-impact unknowns required to draft a strong landing page.

**Output Requirements:**

Return VALID JSON ONLY with:

1. **topic_summary**: 1 sentence summary of the landing page topic (no marketing fluff)

2. **known_facts**: Array of atomic facts EXPLICITLY stated by the user (NO inference, NO assumptions)
   - Only include facts directly mentioned in the input
   - Format as short, factual statements
   - Example: ["Target audience: [specific role/industry]", "Service: [service name]", "Key benefit: [specific claim with numbers]"]

3. **schema**: Object with fields below. Each field value must be either:
   - "KNOWN" and include a \`value\` pulled directly from known_facts, OR
   - "UNKNOWN"

**Schema Fields (fixed):**
1) primary_audience
2) primary_use_case
3) offer_type (service/product/software/hybrid)
4) offer_scope (what's included/excluded)
5) deliverables (what customer receives)
6) constraints (geo, compliance/regulatory, timeline/turnaround, pricing model if stated)
7) differentiators (only if explicitly stated)
8) proof_assets_available (testimonials, case studies, portfolio, metrics, logos)
9) primary_CTA (request quote, book call, form submit, purchase, etc.)
10) post_CTA_flow (what happens after CTA)
11) traffic_source_intent (paid search, SEO, referral, outbound, retargeting, unknown)
12) brand_tone (if stated)

4. **missing_fields_ranked**: An array of schema field names that are UNKNOWN, ranked by importance for writing the landing page.

**Ranking Priority Rule:**
primary_audience → primary_use_case → offer_scope → deliverables → constraints → differentiators → proof_assets_available → primary_CTA → post_CTA_flow → traffic_source_intent → brand_tone

**Critical Rules:**

- Do NOT invent facts.
- Do NOT guess the industry or add domain traits.
- If user provided partial info for a field, keep it KNOWN with what you have.
- For each schema field, if ANY part of it is mentioned in known_facts, mark as KNOWN with the value extracted.
- missing_fields_ranked should only include fields marked as UNKNOWN in the schema.

**JSON only, no commentary.**

CRITICAL: You MUST respond with ONLY valid JSON. Do not include any text before or after the JSON. Do not use markdown code blocks.`;

  const userPrompt = `Analyze the following landing page context and classify it:

**ICP Data:**
- Name: ${icpName}
- Description: ${icpDescription}
- Who They Are: ${whoTheyAre}
- What They Want: ${whatTheyWant}
- Company Help: ${companyHelp}

**Offer Data:**
- Name: ${offerName}
- Description: ${offerDescription}

**Analysis from Step 1:**
- Offer Type Analysis: ${offerTypeAnalysis.offerType || "unknown"} (${offerTypeAnalysis.reasoning || "N/A"})
- Unique Selling Points: ${usps}
- Selected Hook: ${hookPoints.selected?.type || "N/A"}

Classify this landing page topic and return ONLY valid JSON matching the schema.`;

  const messages = [
    { role: "system" as const, content: systemPrompt },
    { role: "user" as const, content: userPrompt },
  ];

  try {
    const result = await callStructured(
      model,
      messages,
      pageDefinitionSchema,
      { stepName: "classifyLandingPageTopic", maxAttempts: 2 }
    );

    if (!result.ok || !result.data) {
      throw new Error("Failed to classify landing page topic: no result");
    }

    const artifact = result.data;

    // Build schema object with proper typing
    const schema = artifact.schema || {};
    const buildFieldStatus = (field: any): SchemaFieldStatus => {
      if (field?.status === "KNOWN" && field.value) {
        return { status: "KNOWN", value: field.value };
      }
      return { status: "UNKNOWN" };
    };

    // Logging removed for cleaner workflow

    return {
      topicSummary: artifact.topicSummary || "Landing page project",
      knownFacts: Array.isArray(artifact.knownFacts) ? artifact.knownFacts : [],
      schema: {
        primary_audience: buildFieldStatus(schema.primary_audience),
        primary_use_case: buildFieldStatus(schema.primary_use_case),
        offer_type: buildFieldStatus(schema.offer_type),
        offer_scope: buildFieldStatus(schema.offer_scope),
        deliverables: buildFieldStatus(schema.deliverables),
        constraints: buildFieldStatus(schema.constraints),
        differentiators: buildFieldStatus(schema.differentiators),
        proof_assets_available: buildFieldStatus(schema.proof_assets_available),
        primary_CTA: buildFieldStatus(schema.primary_CTA),
        post_CTA_flow: buildFieldStatus(schema.post_CTA_flow),
        traffic_source_intent: buildFieldStatus(schema.traffic_source_intent),
        brand_tone: buildFieldStatus(schema.brand_tone),
      },
      missingFieldsRanked: Array.isArray(artifact.missingFieldsRanked) 
        ? artifact.missingFieldsRanked.filter((f: string) => 
            ["primary_audience", "primary_use_case", "offer_type", "offer_scope",
             "deliverables", "constraints", "differentiators", "proof_assets_available",
             "primary_CTA", "post_CTA_flow", "traffic_source_intent", "brand_tone"].includes(f)
          )
        : [],
    };
  } catch (error: any) {
    throw new Error(`Failed to classify landing page topic: ${error.message}`);
  }
}

/**
 * Write a single content section using competitor examples and best practices
 */

import { callStructured } from "../tools/runtime/callStructured";
import { SectionType, getSectionTemplate } from "../references/pageTypes/registry";
import { SectionContent } from "../references/marketingTypes";
import { log } from "../ui/logger";

export interface WriteSectionInput {
  sectionType: SectionType;
  format: string;
  competitorExamples?: Array<{
    url: string;
    heading: string;
    preview: string;
    exampleWriting?: string; // Actual text from competitor page
    briefReasoning?: string; // Brief reasoning for why this matches
  }>;
  icp: any;
  offer: any;
  talkPoints: {
    uniqueSellingPoints: Array<{ point: string; category: string }>;
    transactionalFacts: Array<{ point: string; source: string }>;
  };
  hookPoints: {
    painPoint?: { statement: string; specificity: number; uniqueness: number };
    identity?: { statement: string; specificity: number; uniqueness: number };
    useScenario?: { statement: string; specificity: number; uniqueness: number };
  };
  offerType: "transactional" | "preaching";
  previousSections?: string; // Context of previously written sections to avoid repetition
  usedTalkPoints?: Set<string>; // Track which talk points have been used
  theme?: "default" | "minimalist"; // Theme for content generation
}

const writeSectionSchema = {
  type: "object",
  additionalProperties: true,
  properties: {
    content: { type: "object", additionalProperties: true }, // Format-specific, passthrough
    notes: { type: "string" },
  },
  required: ["content"],
};

/**
 * Write a single section using competitor examples and best practices
 */
export async function writeSection(
  model: "agent" | "high" | "mid",
  input: WriteSectionInput
): Promise<SectionContent> {
  log(`[writeSection] Writing section: ${input.sectionType} (format: ${input.format})`);

  const template = getSectionTemplate(input.sectionType);
  if (!template) {
    throw new Error(`No template found for section type: ${input.sectionType}`);
  }

  // Build competitor examples context with actual text
  let competitorContext = "";
  if (input.competitorExamples && input.competitorExamples.length > 0) {
    competitorContext = `\n\nCompetitor Examples (for inspiration, do not copy directly - use these as reference for structure, tone, and approach):\n${input.competitorExamples.map((ex, idx) => {
      let exampleText = `${idx + 1}. From ${ex.url}:\n   Heading: "${ex.heading}"\n   Preview: "${ex.preview}"`;
      if (ex.exampleWriting) {
        exampleText += `\n   Actual Text Example:\n   "${ex.exampleWriting}"`;
      }
      if (ex.briefReasoning) {
        exampleText += `\n   Why this matches: ${ex.briefReasoning}`;
      }
      return exampleText;
    }).join("\n\n")}`;
  }

  // Build guidance context from template
  const inclusionRules = template.inclusion_rules?.join("\n- ") || "No specific inclusion rules defined.";
  const boundaries = template.boundaries?.join("\n- ") || "No specific boundaries defined.";
  const antiPatterns = template.anti_patterns?.join("\n- ") || "No specific anti-patterns defined.";

  // Build talk points context with tracking
  const usedTalkPointsSet = input.usedTalkPoints || new Set<string>();
  
  // Filter out already-used talk points
  const availableUSPs = input.talkPoints.uniqueSellingPoints.filter(
    usp => !usedTalkPointsSet.has(usp.point)
  );
  const availableTransactionalFacts = input.talkPoints.transactionalFacts.filter(
    tf => !usedTalkPointsSet.has(tf.point)
  );
  
  const usps = availableUSPs.map(usp => `- ${usp.point} (${usp.category})`).join("\n");
  const transactionalFacts = availableTransactionalFacts.map(tf => `- ${tf.point}`).join("\n");
  
  // Track which talk points are being used in this section
  availableUSPs.forEach(usp => usedTalkPointsSet.add(usp.point));
  availableTransactionalFacts.forEach(tf => usedTalkPointsSet.add(tf.point));

  // Build hook points context
  const hookPoint = input.hookPoints.painPoint || input.hookPoints.identity || input.hookPoints.useScenario;
  const hookContext = hookPoint ? `\n\nHook Point: "${hookPoint.statement}"` : "";

  const themeGuidance = input.theme === "minimalist"
    ? `DESIGN THEME: MINIMALIST
- Use simple, outlined icons (→, ✓, •) instead of emojis
- Focus on clarity and professionalism
- Avoid decorative language
- Use concrete, specific descriptions
- Keep it clean and direct`
    : `DESIGN THEME: DEFAULT
- Use expressive emojis and icons
- Be engaging and dynamic
- Use varied, colorful language`;

  const systemPrompt = `You are writing a landing page section for a ${input.offerType} offer.

${themeGuidance}

Section Type: ${input.sectionType}
Format: ${input.format}
Purpose: ${template.purpose}

Inclusion Rules (when to include this content):
- ${inclusionRules}

Boundaries (what this section MUST NOT do):
- ${boundaries}

Anti-Patterns (avoid these):
- ${antiPatterns}

CRITICAL: You MUST respond with ONLY valid JSON. Do not include any text before or after the JSON. Do not use markdown code blocks.

The content structure depends on the format. Return a JSON object with:
- "content": The format-specific content structure
- "notes": Optional notes about the section (if needed)

Format-specific content structures:

text_block / text_block_prose / narrative_block:
{
  "content": {
    "heading": "Section Title",
    "subheading": "Optional subtitle",
    "paragraphs": ["First paragraph text...", "Second paragraph text..."],
    "bullets": ["Optional bullet 1", "Optional bullet 2"]
  }
}

IMPORTANT: For paragraph content, target 80-120 words per paragraph for optimal readability. Paragraphs shorter than 60 words may feel incomplete; paragraphs longer than 150 words may lose reader attention.

quote_block / testimonial_block:
{
  "content": {
    "heading": "What Our Clients Say",
    "quotes": [
      {
        "text": "The quote text here",
        "author": "Author Name",
        "role": "Position",
        "company": "Company Name"
      }
    ]
  }
}

stats_strip / metrics_bar:
{
  "content": {
    "heading": "By The Numbers",
    "stats": [
      { "value": "24/7", "label": "Support Available", "icon": "⚡" },
      { "value": "10,000+", "label": "Happy Customers", "icon": "✓" }
    ]
  }
}

two_column_split / two_column_text:
{
  "content": {
    "heading": "Section Title",
    "leftColumn": {
      "title": "Left Title",
      "text": "Left content...",
      "bullets": ["Point 1", "Point 2"]
    },
    "rightColumn": {
      "title": "Right Title",
      "text": "Right content...",
      "bullets": ["Point 1", "Point 2"]
    }
  }
}

checklist_block / requirements_list:
{
  "content": {
    "heading": "What You Get",
    "subheading": "Optional description",
    "items": ["Item 1", "Item 2", "Item 3"]
  }
}

card_grid / card_grid_icon:
{
  "content": {
    "heading": "Benefits",
    "cards": [
      { "title": "Fast Delivery", "description": "Get results in 5-10 days", "icon": "🚀" }
    ]
  }
}`;

  // Build previous sections context to avoid repetition (ENHANCED CONTEXT)
  let previousSectionsContext = "";
  if (input.previousSections && input.previousSections.trim().length > 0) {
    previousSectionsContext = `\n\n=== PREVIOUSLY WRITTEN SECTIONS (DO NOT REPEAT) ===
${input.previousSections}

=== THIS SECTION'S UNIQUE ROLE ===
Purpose: ${template.purpose}
Your job: ${template.boundaries?.join("; ") || "Add unique value"}

=== CRITICAL ANTI-REPETITION RULES ===
1. CONTENT UNIQUENESS:
   - Do NOT restate points already made in previous sections
   - Do NOT use similar examples or analogies
   - Do NOT repeat the same benefits/features (even with different wording)
   - Find a COMPLETELY NEW angle that previous sections haven't covered

2. MESSAGING UNIQUENESS:
   - If previous sections focused on speed, focus on quality or reliability
   - If previous sections were benefit-focused, be outcome-focused
   - If previous sections were aspirational, be concrete and tactical
   - Complement, don't echo

3. STRUCTURAL VARIETY:
   - If previous sections used cards/icons, use narrative or lists
   - If previous sections were short/punchy, be detailed/explanatory
   - If previous sections had 3 items, use 4-5 or 2
   - Vary rhythm and density

4. TALK POINT DISCIPLINE:
   - Only use talk points that haven't been covered yet
   - If a USP was mentioned before, skip it entirely (don't rephrase)
   - Focus on the unique aspects of this section's purpose`;
  }

  const userPrompt = `Write the "${input.sectionType}" section using format "${input.format}".

ICP Context:
- Name: ${input.icp.name}
- Description: ${input.icp.description || "N/A"}
- Roles: ${input.icp.roles?.join(", ") || "N/A"}
- Top Pains: ${input.icp.top_pains?.join(", ") || "N/A"}

Offer Context:
- Name: ${input.offer.name}
- Description: ${input.offer.description || "N/A"}

Unique Selling Points (for this section):
${usps || "None allocated to this section"}

Transactional Facts (for this section):
${transactionalFacts || "None allocated to this section"}${hookContext}${competitorContext}${previousSectionsContext}

Instructions:
1. Use the competitor examples (especially the actual text examples) as inspiration for:
   - Structure and organization
   - Tone and style  
   - Level of detail
   - How benefits are presented
   But write ORIGINAL content tailored to this specific offer and ICP.
2. Follow the inclusion rules, respect the boundaries, and avoid anti-patterns.
3. Ensure all allocated USPs and transactional facts are naturally incorporated.
4. Make content scannable (use bullets, short paragraphs, clear headings).
5. Write content that matches the format requirements (${input.format}).
6. Be specific and outcome-oriented.
7. CRITICAL: Review previously written sections and ensure THIS section adds new value without repetition.

IMPORTANT: When competitor examples include actual text, study how they structure their content, what details they include, and how they present benefits. Use this as a reference for creating similar-quality content, but write original text that matches this offer's unique value proposition.

Return ONLY valid JSON matching the schema.`;

  const messages = [
    { role: "system" as const, content: systemPrompt },
    { role: "user" as const, content: userPrompt },
  ];

  try {
    const result = await callStructured(
      model,
      messages,
      writeSectionSchema,
      { stepName: "writeSection", maxAttempts: 2 }
    );

    if (!result.ok || !result.data) {
      throw new Error("Failed to write section: no result");
    }

    const artifact = result.data;

    log(`[writeSection] ✅ Section written: ${input.sectionType}`);

    return {
      sectionType: input.sectionType,
      format: input.format,
      content: artifact.content,
      notes: artifact.notes ? {
        whyThisSection: artifact.notes,
      } : undefined,
    };
  } catch (error: any) {
    log(`[writeSection] ❌ Error: ${error.message}`);
    throw new Error(`Failed to write section: ${error.message}`);
  }
}

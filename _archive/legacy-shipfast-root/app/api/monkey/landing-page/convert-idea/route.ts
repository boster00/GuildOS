import { NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";
import { callStructured } from "@/libs/monkey/tools/runtime/callStructured";

const log = (...args: any[]) => {
  if (process.env.NODE_ENV === "development") {
  }
};

// Helper to generate instructional content prompt with competitor examples
// This matches the function in generate-prompt/route.ts
function generateContentPrompt(
  category: string, 
  insight: string, 
  icp: any, 
  offer: any,
  researchData?: any
): string {
  const offerName = offer?.name || "our service";
  const icpName = icp?.name || "customers";
  
  // Extract the topic from the insight
  let topic = insight;
  
  // For section names or direct ideas, use them as the topic
  if (category === "Common Section" || category === "Content Idea") {
    topic = insight;
  } else {
    // Extract topic from insight text
    topic = insight
      .replace(/^\d+%\s+of\s+competitors?\s+/i, "")
      .replace(/^most\s+providers?\s+/i, "")
      .replace(/^many\s+services?\s+/i, "")
      .replace(/\s+emphasize|highlight|focus on/i, "")
      .trim();
  }
  
  // Try to find competitor examples from research data
  let competitorExamples: string[] = [];
  if (researchData?.contentSections) {
    // Look for matching section in contentSections
    const sectionKey = Object.keys(researchData.contentSections).find(
      key => key.toLowerCase().includes(topic.toLowerCase()) || 
             topic.toLowerCase().includes(key.toLowerCase())
    );
    
    if (sectionKey && researchData.contentSections[sectionKey]?.examples) {
      competitorExamples = researchData.contentSections[sectionKey].examples
        .slice(0, 2) // Take first 2 examples
        .map((ex: any) => ex.content || ex.text || "")
        .filter((ex: string) => ex.length > 0);
    }
  }
  
  // If no examples found, try to extract from contentPatterns (backward compatibility)
  if (competitorExamples.length === 0 && researchData?.contentPatterns) {
    const patternKey = Object.keys(researchData.contentPatterns).find(
      key => key.toLowerCase().includes(topic.toLowerCase()) || 
             topic.toLowerCase().includes(key.toLowerCase())
    );
    
    if (patternKey && Array.isArray(researchData.contentPatterns[patternKey])) {
      competitorExamples = researchData.contentPatterns[patternKey]
        .slice(0, 2)
        .map((p: string) => `Competitors mention: ${p}`);
    }
  }
  
  // Build the instructional prompt
  let prompt = `Write a section about ${topic} to help convince ${icpName} that ${offerName} excels in this area. `;
  
  if (competitorExamples.length > 0) {
    prompt += `Some examples from competitors are:\n`;
    competitorExamples.forEach((ex, idx) => {
      prompt += `Example ${idx + 1}: ${ex}\n`;
    });
    prompt += `\nUse these as inspiration but write original content that highlights ${offerName}'s specific capabilities and benefits.`;
  } else {
    prompt += `Focus on specific benefits, features, or capabilities that make ${offerName} stand out.`;
  }
  
  return prompt;
}

// Format-specific schemas with strict validation
const formatSchemas = {
  paragraph: {
    type: "object",
    additionalProperties: false,
    properties: {
      heading: { type: "string" },
      content: {
        type: "object",
        additionalProperties: false,
        properties: {
          paragraphs: {
            type: "array",
            items: { type: "string" },
            minItems: 2,
            maxItems: 3
          }
        },
        required: ["paragraphs"]
      }
    },
    required: ["heading", "content"]
  },
  paragraph_picture: {
    type: "object",
    additionalProperties: false,
    properties: {
      heading: { type: "string" },
      content: {
        type: "object",
        additionalProperties: false,
        properties: {
          paragraphs: {
            type: "array",
            items: { type: "string" },
            minItems: 2,
            maxItems: 3
          },
          imageDescription: { type: "string" }
        },
        required: ["paragraphs", "imageDescription"]
      }
    },
    required: ["heading", "content"]
  },
  cards: {
    type: "object",
    additionalProperties: false,
    properties: {
      heading: { type: "string" },
      content: {
        type: "object",
        additionalProperties: false,
        properties: {
          cards: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                icon: { type: "string" },
                title: { type: "string" },
                description: { type: "string" }
              },
              required: ["icon", "title", "description"]
            },
            minItems: 3,
            maxItems: 4
          }
        },
        required: ["cards"]
      }
    },
    required: ["heading", "content"]
  },
  table: {
    type: "object",
    additionalProperties: false,
    properties: {
      heading: { type: "string" },
      content: {
        type: "object",
        additionalProperties: false,
        properties: {
          headers: {
            type: "array",
            items: { type: "string" },
            minItems: 2
          },
          rows: {
            type: "array",
            items: {
              type: "array",
              items: { type: "string" }
            },
            minItems: 1
          }
        },
        required: ["headers", "rows"]
      }
    },
    required: ["heading", "content"]
  },
  list: {
    type: "object",
    additionalProperties: false,
    properties: {
      heading: { type: "string" },
      content: {
        type: "object",
        additionalProperties: false,
        properties: {
          items: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                title: { type: "string" },
                description: { type: "string" }
              },
              required: ["title", "description"]
            },
            minItems: 3,
            maxItems: 6
          }
        },
        required: ["items"]
      }
    },
    required: ["heading", "content"]
  }
};

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { 
      category, 
      idea, 
      sources, 
      icp, 
      offer, 
      theme = "default", 
      format = "paragraph",
      prompt: providedPrompt, // User-provided prompt (optional)
      researchData // Full research data for competitor examples
    } = body;

    if (!category || !idea) {
      return NextResponse.json(
        { error: "Missing required fields: category, idea" },
        { status: 400 }
      );
    }

    log(`Converting idea to section: ${category} - ${idea} (format: ${format})`);

    // Use provided prompt if available, otherwise generate from idea with competitor examples
    // The idea is the key content we need to expand on
    const contentPrompt = providedPrompt || generateContentPrompt(category, idea, icp, offer, researchData);
    
    // Determine section title from idea (not category)
    let sectionTitle = idea;
    if (category === "Common Section") {
      sectionTitle = idea;
    } else if (category && category !== "Content Idea") {
      // Use category as title if it's more specific than "Content Idea"
      sectionTitle = category;
    }

    // Build format-specific instructions
    const formatInstructions = {
      paragraph: "Write 2 CONCISE paragraphs (2-3 sentences each) directly explaining the key points. No introduction needed - start with the feature/benefit immediately.",
      paragraph_picture: "Write 2 CONCISE paragraphs (2-3 sentences each) with a suggestion for a relevant image. Include imageDescription field. No introduction needed.",
      cards: "Create 3-4 cards with icon, title, and brief description (1-2 sentences each). Return as {cards: [{icon, title, description}]}",
      table: "Create a concise comparison table with headers and rows. Return as {headers: [], rows: [[]]}",
      list: "Create a numbered list with 3-5 concise items. Each item should have a short title and 1-2 sentence description. Return as {items: [{title, description}]}"
    };

    const instruction = formatInstructions[format as keyof typeof formatInstructions] || formatInstructions.paragraph;
    const schema = formatSchemas[format as keyof typeof formatSchemas] || formatSchemas.paragraph;

    // Generate content using AI
    const systemPrompt = `You are a content writer creating a section that will be INSERTED into an EXISTING landing page article.

**IMPORTANT CONTEXT:**
- This section will be part of a larger article, NOT a standalone piece
- The article already has introduction, context, and background
- This section should be CONCISE and DIRECT - no introductory phrases
- Target Audience: ${icp?.name || "Target audience"} - ${icp?.description || ""}
- Our Offer: ${offer?.name || "Product/Service"} - ${offer?.description || ""}

**CRITICAL RULES:**
1. NO introduction, context-setting, or background - jump straight to the point
2. NO phrases like "Our service is..." or "We are..." - start with the feature/benefit directly
3. Be CONCISE - maximum 2-3 sentences per paragraph, 2-3 paragraphs total
4. Write ONLY about OUR service/product - what WE provide, how WE help
5. NEVER mention competitors, competitor analysis, industry trends, or "X% of providers"
6. Focus on SPECIFIC facts, features, or benefits - avoid generic statements
7. Assume the reader already knows the context from previous sections

**Theme: ${theme}**
${theme === "minimalist" ? "Use clean, professional language. Be extremely concise. No fluff." : "Use engaging, persuasive language but keep it brief and focused."}

**Format: ${format}**
${instruction}

**DO NOT START WITH:**
- "Our IHC/IF service is..."
- "We understand that..."
- "Whether you are..."
- "With our..."
- Any introductory phrases

**INSTEAD START WITH:**
- Direct feature/benefit: "Sample Types: FFPE, frozen sections, and cell lines"
- Specific capability: "3000+ validated antibodies"
- Concrete fact: "5-10 day turnaround"

**EXACT OUTPUT FORMAT REQUIRED:**
${format === "paragraph" ? `{
  "heading": "Section Title",
  "content": {
    "paragraphs": ["First paragraph text", "Second paragraph text", "Third paragraph text (optional)"]
  }
}` : format === "paragraph_picture" ? `{
  "heading": "Section Title",
  "content": {
    "paragraphs": ["First paragraph text", "Second paragraph text", "Third paragraph text (optional)"],
    "imageDescription": "Description of the image to display"
  }
}` : format === "cards" ? `{
  "heading": "Section Title",
  "content": {
    "cards": [
      {"icon": "🔬", "title": "Card Title", "description": "Card description"},
      {"icon": "⚡", "title": "Card Title", "description": "Card description"},
      {"icon": "✅", "title": "Card Title", "description": "Card description"}
    ]
  }
}` : format === "table" ? `{
  "heading": "Section Title",
  "content": {
    "headers": ["Header 1", "Header 2", "Header 3"],
    "rows": [
      ["Row 1 Col 1", "Row 1 Col 2", "Row 1 Col 3"],
      ["Row 2 Col 1", "Row 2 Col 2", "Row 2 Col 3"]
    ]
  }
}` : `{
  "heading": "Section Title",
  "content": {
    "items": [
      {"title": "Step 1", "description": "Step description"},
      {"title": "Step 2", "description": "Step description"}
    ]
  }
}`}

**Content Guidelines:**
- Start with the value/benefit to the customer
- Explain our specific capabilities and approach
- Use concrete details, numbers, or features about OUR offer
- Make content scannable and easy to read
- Keep focus on "you" (customer) and "we/our" (our service)

**Forbidden phrases:**
- "In the competitive landscape..."
- "X% of competitors/providers..."
- "Industry trends show..."
- "Most services..."
- Any reference to what others do

**CRITICAL: Return ONLY the JSON object matching the exact format above. No extra fields, no variations.`;

    // Use the content prompt as the primary instruction
    // This is what the user edited/approved in the UI
    const userPrompt = `Create a CONCISE section titled "${sectionTitle}" that will be inserted into an existing article.

Topic: ${contentPrompt}

Requirements:
- Be direct and to-the-point (no introduction needed)
- Maximum 2-3 paragraphs (or format-equivalent for ${format})
- Focus on specific facts, features, or benefits
- Skip general context-setting language
- Start immediately with the key information

${providedPrompt ? `Use this as the primary focus: ${providedPrompt}` : 'Focus on the customer benefit and our specific capabilities. Do not mention competitors or industry trends.'}`;

    const result = await callStructured(
      "high",
      [
        { role: "system" as const, content: systemPrompt },
        { role: "user" as const, content: userPrompt },
      ],
      schema,
      { stepName: "convertIdea", maxAttempts: 3 }
    );

    if (!result.ok || !result.data) {
      log(`Failed to generate section: ${result.error || "Unknown error"}`);
      throw new Error(`Failed to generate section content: ${result.error || "Invalid response"}`);
    }

    let sectionData = result.data;

    // Normalize any common variations in response format
    if (sectionData.content) {
      // Handle paragraph format variations
      if (format === "paragraph" || format === "paragraph_picture") {
        if (!Array.isArray(sectionData.content.paragraphs)) {
          // Convert paragraph1, paragraph2, etc. to array
          const paragraphs: string[] = [];
          let idx = 1;
          while (sectionData.content[`paragraph${idx}`]) {
            paragraphs.push(sectionData.content[`paragraph${idx}`]);
            idx++;
          }
          // Or if there's a single paragraph field
          if (paragraphs.length === 0 && sectionData.content.paragraph) {
            paragraphs.push(sectionData.content.paragraph);
          }
          // Or if content is directly a string/object
          if (paragraphs.length === 0) {
            const contentStr = typeof sectionData.content === 'string' 
              ? sectionData.content 
              : JSON.stringify(sectionData.content);
            paragraphs.push(contentStr);
          }
          sectionData.content = { ...sectionData.content, paragraphs };
          log(`Normalized paragraph format: ${paragraphs.length} paragraphs`);
        }
      }
    }

    // Validate the normalized data matches schema
    if (!sectionData.heading || !sectionData.content) {
      log(`❌ Invalid response structure:`, JSON.stringify(sectionData, null, 2));
      throw new Error("Invalid response: missing heading or content");
    }

    // Validate format-specific requirements
    if (format === "paragraph" || format === "paragraph_picture") {
      if (!Array.isArray(sectionData.content.paragraphs) || sectionData.content.paragraphs.length === 0) {
        log(`❌ Invalid paragraph format:`, JSON.stringify(sectionData.content, null, 2));
        throw new Error(`Invalid response: paragraphs must be a non-empty array for ${format} format`);
      }
    } else if (format === "cards") {
      if (!Array.isArray(sectionData.content.cards) || sectionData.content.cards.length === 0) {
        log(`❌ Invalid cards format:`, JSON.stringify(sectionData.content, null, 2));
        throw new Error(`Invalid response: cards must be a non-empty array for cards format`);
      }
    } else if (format === "table") {
      if (!Array.isArray(sectionData.content.headers) || !Array.isArray(sectionData.content.rows)) {
        log(`❌ Invalid table format:`, JSON.stringify(sectionData.content, null, 2));
        throw new Error(`Invalid response: table must have headers and rows arrays`);
      }
    } else if (format === "list") {
      if (!Array.isArray(sectionData.content.items) || sectionData.content.items.length === 0) {
        log(`❌ Invalid list format:`, JSON.stringify(sectionData.content, null, 2));
        throw new Error(`Invalid response: items must be a non-empty array for list format`);
      }
    }

    log(`✅ Validated response structure for ${format} format`);

    // Generate HTML based on format
    const html = generateHtmlForFormat(format, sectionData, theme);

    log(`✅ Section generated successfully`);

    return NextResponse.json({
      success: true,
      section: {
        category,
        idea,
        sources,
        title: sectionTitle,
        format,
        content: sectionData.content,
        heading: sectionData.heading,
        html,
        suggestedFormats: ["paragraph", "paragraph_picture", "cards", "table", "list"],
      },
    });
  } catch (error: any) {
    log(`Error:`, error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// Helper to escape HTML for security
function escapeHtml(text: string): string {
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

// Helper function to generate HTML based on format
function generateHtmlForFormat(format: string, data: any, theme: string): string {
  const isMinimalist = theme === "minimalist";
  const baseClasses = isMinimalist 
    ? "bg-white text-gray-900 p-8" 
    : "bg-gradient-to-br from-blue-50 to-white p-8 rounded-lg";

  switch (format) {
    case "paragraph":
      return `
<section class="${baseClasses}">
  <h2 class="text-3xl font-bold mb-6 ${isMinimalist ? 'text-gray-900' : 'text-blue-900'}">${escapeHtml(data.heading)}</h2>
  ${Array.isArray(data.content.paragraphs) 
    ? data.content.paragraphs.map((p: string) => 
        `<p class="text-lg leading-relaxed mb-4 ${isMinimalist ? 'text-gray-700' : 'text-gray-800'}">${escapeHtml(p)}</p>`
      ).join('')
    : `<p class="text-lg leading-relaxed ${isMinimalist ? 'text-gray-700' : 'text-gray-800'}">${escapeHtml(data.content.paragraphs?.[0] || JSON.stringify(data.content))}</p>`
  }
</section>`;

    case "paragraph_picture":
      return `
<section class="${baseClasses}">
  <div class="grid md:grid-cols-2 gap-8 items-center">
    <div>
      <h2 class="text-3xl font-bold mb-6 ${isMinimalist ? 'text-gray-900' : 'text-blue-900'}">${escapeHtml(data.heading)}</h2>
      ${Array.isArray(data.content.paragraphs) 
        ? data.content.paragraphs.map((p: string) => 
            `<p class="text-lg leading-relaxed mb-4 ${isMinimalist ? 'text-gray-700' : 'text-gray-800'}">${escapeHtml(p)}</p>`
          ).join('')
        : ''}
    </div>
    <div class="bg-gray-200 rounded-lg h-64 flex items-center justify-center">
      <span class="text-gray-500">${escapeHtml(data.content.imageDescription || 'Image placeholder')}</span>
    </div>
  </div>
</section>`;

    case "cards":
      return `
<section class="${baseClasses}">
  <h2 class="text-3xl font-bold mb-8 text-center ${isMinimalist ? 'text-gray-900' : 'text-blue-900'}">${escapeHtml(data.heading)}</h2>
  <div class="grid md:grid-cols-3 gap-6">
    ${Array.isArray(data.content.cards) 
      ? data.content.cards.map((card: any) => `
        <div class="p-6 ${isMinimalist ? 'border border-gray-200' : 'bg-white shadow-lg'} rounded-lg">
          <div class="text-4xl mb-4">${card.icon || '📌'}</div>
          <h3 class="text-xl font-bold mb-2 ${isMinimalist ? 'text-gray-900' : 'text-blue-800'}">${escapeHtml(card.title)}</h3>
          <p class="${isMinimalist ? 'text-gray-600' : 'text-gray-700'}">${escapeHtml(card.description)}</p>
        </div>
      `).join('')
      : ''}
  </div>
</section>`;

    case "table":
      return `
<section class="${baseClasses}">
  <h2 class="text-3xl font-bold mb-6 ${isMinimalist ? 'text-gray-900' : 'text-blue-900'}">${escapeHtml(data.heading)}</h2>
  <div class="overflow-x-auto">
    <table class="w-full ${isMinimalist ? 'border border-gray-200' : 'shadow-lg'}">
      <thead class="${isMinimalist ? 'bg-gray-100' : 'bg-blue-600 text-white'}">
        <tr>
          ${Array.isArray(data.content.headers) 
            ? data.content.headers.map((h: string) => `<th class="px-6 py-3 text-left">${escapeHtml(h)}</th>`).join('')
            : ''}
        </tr>
      </thead>
      <tbody>
        ${Array.isArray(data.content.rows) 
          ? data.content.rows.map((row: string[], idx: number) => `
            <tr class="${idx % 2 === 0 ? (isMinimalist ? 'bg-white' : 'bg-gray-50') : 'bg-white'}">
              ${Array.isArray(row) ? row.map(cell => `<td class="px-6 py-4 border-t ${isMinimalist ? 'border-gray-200' : 'border-gray-300'}">${escapeHtml(cell)}</td>`).join('') : ''}
            </tr>
          `).join('')
          : ''}
      </tbody>
    </table>
  </div>
</section>`;

    case "list":
      return `
<section class="${baseClasses}">
  <h2 class="text-3xl font-bold mb-8 ${isMinimalist ? 'text-gray-900' : 'text-blue-900'}">${escapeHtml(data.heading)}</h2>
  <div class="space-y-6">
    ${Array.isArray(data.content.items) 
      ? data.content.items.map((item: any, idx: number) => `
        <div class="flex gap-4">
          <div class="flex-shrink-0 w-10 h-10 ${isMinimalist ? 'bg-gray-900 text-white' : 'bg-blue-600 text-white'} rounded-full flex items-center justify-center font-bold">
            ${idx + 1}
          </div>
          <div class="flex-1">
            <h3 class="text-xl font-bold mb-2 ${isMinimalist ? 'text-gray-900' : 'text-blue-800'}">${escapeHtml(item.title)}</h3>
            <p class="${isMinimalist ? 'text-gray-600' : 'text-gray-700'}">${escapeHtml(item.description)}</p>
          </div>
        </div>
      `).join('')
      : ''}
  </div>
</section>`;

    default:
      return `<section class="${baseClasses}"><h2>${data.heading}</h2><pre>${JSON.stringify(data.content, null, 2)}</pre></section>`;
  }
}

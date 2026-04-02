import { NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";
import { initMonkey } from "@/libs/monkey";
import { finishExternalRequest } from "@/libs/monkey/tools/external_requests";

export async function POST(request) {
  const externalRequestId = request.headers.get("x-external-request-id") ?? null;
  const startTime = Date.now();
  const supabase = await createClient();
  try {
    const body = await request.json();
    const { pages, assetType, pageType, icp_id, topicGranularity } = body;

    if (!Array.isArray(pages) || pages.length === 0) {
      return NextResponse.json(
        { error: "Pages array is required" },
        { status: 400 }
      );
    }

    if (!assetType || !["keywords", "key_topics"].includes(assetType)) {
      return NextResponse.json(
        { error: "Invalid assetType. Must be 'keywords' or 'key_topics'" },
        { status: 400 }
      );
    }

    // Fetch ICP details if icp_id provided
    let icpContext = "";
    if (icp_id) {
      try {
        const { data: icp, error: icpError } = await supabase
          .from("icps")
          .select("*")
          .eq("id", icp_id)
          .single();

        if (!icpError && icp) {
          // Build ICP context string
          icpContext = `\n## Target Audience (ICP) Context:\n`;
          Object.entries(icp).forEach(([key, value]) => {
            // Skip system fields and empty values
            if (!value || key === 'id' || key === 'user_id' || key === 'created_at' || key === 'updated_at') {
              return;
            }
            const label = key
              .split('_')
              .map(word => word.charAt(0).toUpperCase() + word.slice(1))
              .join(' ');
            icpContext += `- ${label}: ${value}\n`;
          });
        }
      } catch (err) {
        // Continue without ICP context
      }
    }

    const monkey = await initMonkey();
    monkey.loadUserContext(body?.user_context ?? {});

    let result;
    if (assetType === "keywords") {
      result = await generateKeywordAssets(pages, monkey, pageType, icpContext);
    } else if (assetType === "key_topics") {
      result = await generateTopicAssets(pages, monkey, pageType, icpContext, topicGranularity);
    } else {
      throw new Error("Invalid assetType");
    }

    await finishExternalRequest(supabase, {
      externalRequestId,
      status: "success",
      responsePreview: JSON.stringify(result).slice(0, 500),
      latencyMs: Date.now() - startTime,
    });

    return result;
  } catch (error) {
    await finishExternalRequest(supabase, {
      externalRequestId,
      status: "failed",
      errorMessage: error?.message ?? String(error),
      latencyMs: Date.now() - startTime,
    });
    return NextResponse.json(
      { error: error.message || "Failed to benchmark competitors" },
      { status: 500 }
    );
  }
}

async function generateKeywordAssets(pages, monkey, pageType, icpContext, remaining = null) {
  try {
    // Combine all page contents
    const combinedContent = pages
      .map(p => p.content || "")
      .join("\n\n---\n\n");

    const pageTypeContext = pageType ? `\nPage Type: ${pageType}\n` : "";

    // Use AI to extract keywords
    const prompt = `You are analyzing competitor pages to extract keywords that resonate with a specific target audience.

${icpContext}${pageTypeContext}

Your task: Analyze the following competitor page contents and extract the most important and frequently mentioned keywords that are relevant to the ICP. For each keyword, provide:
1. The keyword itself
2. Your estimate of how many times it appears (low-high range, e.g., 3-7 times)

Return a JSON array like: [{"keyword": "keyword phrase", "occurrence_range": {"low": 3, "high": 7}}, ...]

Guidelines:
- Only include keywords that are 1-3 words and semantically relevant to the content
- Prioritize keywords that appear across multiple pages
- Focus on keywords that align with the ICP's interests, pain points, and goals
- Exclude generic or irrelevant terms

Content:
${combinedContent.substring(0, 8000)} ${combinedContent.length > 8000 ? "..." : ""}`;

    const response = await monkey.AI(prompt, {
      vendor: "openai",
      model: "gpt-4o",
      forceJson: true,
    });

    let keywords = [];
    try {
      keywords = JSON.parse(response);
      // Ensure all keywords have search_volume field
      keywords = keywords.map(k => ({
        ...k,
        search_volume: k.search_volume || null,
      }));
    } catch (e) {
      keywords = [];
    }

    return NextResponse.json({
      assets: { keywords },
      ...(remaining != null && { remaining }),
    });
  } catch (error) {
    throw error;
  }
}

async function generateTopicAssets(pages, monkey, pageType, icpContext, topicGranularity = 12, remaining = null) {
  try {
    // Store page URLs for mapping topics to competitors
    const pageUrls = pages.map(p => p.url || '').filter(url => url);
    
    // Combine all page contents with page markers
    const pageContents = pages.map((p, index) => ({
      url: p.url || '',
      title: p.title || `Page ${index + 1}`,
      content: p.content || "",
      index
    }));

    const combinedContent = pageContents
      .map((p, index) => `[PAGE ${index + 1}: ${p.url || `Page ${index + 1}`}]\n${p.content}`)
      .join("\n\n---\n\n");

    const pageTypeContext = pageType ? `\nPage Type: ${pageType}\n` : "";

    // Use AI to extract key topics and map them to pages
    const targetCount = topicGranularity || 12;
    const minCount = Math.max(5, Math.floor(targetCount * 0.5));
    const maxCount = Math.min(50, Math.ceil(targetCount * 1.3));
    
    const prompt = `You are analyzing competitor pages to extract key topics with SPECIFIC, actionable strategies.

${icpContext}${pageTypeContext}

Your task: Analyze competitor content and identify topics with SPECIFIC implementation details, not generic labels.

CRITICAL: Topics must be SPECIFIC and include the "HOW" or a concrete detail:
❌ BAD: "Establish credibility" (too generic, applies to anything)
❌ BAD: "Demonstrate expertise" (vague, no specific approach)
✅ GOOD: "Establish credibility through CLIA-certified laboratory standards"
✅ GOOD: "Demonstrate expertise with HER2/PDL1 biomarker development case studies"
✅ GOOD: "Address turnaround time concerns with pre-validated protocols"

Return a JSON array like: [
  {
    "topic": "Specific topic with concrete detail from competitor approach", 
    "pages": [0, 1],
    "strategy": "2-3 sentence commentary on HOW competitors implement this and WHY it works"
  }
]

Where:
- "topic": A specific, actionable heading (7-15 words) that includes a concrete tactic/detail
- "pages": Page indices (0-based) where this appears
- "strategy": Strategic commentary on the competitor's approach and its effectiveness

Guidelines:
- Extract approximately ${targetCount} highly specific topics (target: ${targetCount}, range: ${minCount}-${maxCount})
- Aim to generate close to the target count of ${targetCount} topics
- Each topic MUST include a concrete detail or specific approach (not just a generic goal)
- Anchor topics to specific tactics, facts, or proof points mentioned by competitors
- Avoid redundancy - if two competitors do similar things differently, capture BOTH specific approaches as separate topics
- The strategy field should explain the psychological/rhetorical reason this works
- Make topics specific enough that they couldn't apply to a completely different product/service
- Prioritize topics with unique competitive angles or specific proof points
- Extract more topics (up to ${maxCount}) when there are many distinct and valuable details worth capturing

Examples of specificity:
- Instead of "Pricing transparency" → "Display per-test pricing with volume discount calculator"
- Instead of "Customer support" → "Offer dedicated PhD-level technical support for assay troubleshooting"
- Instead of "Quality assurance" → "Guarantee results with ISO 15189 accredited quality management"

Content:
${combinedContent.substring(0, 8000)} ${combinedContent.length > 8000 ? "..." : ""}`;

    const response = await monkey.AI(prompt, {
      vendor: "openai",
      model: "gpt-4o",
      forceJson: true,
    });
    let topicsData = [];
    try {
      const parsed = JSON.parse(response);
      // Ensure it's an array
      if (Array.isArray(parsed)) {
        topicsData = parsed.filter(t => t && typeof t === 'object' && t.topic);
      }
    } catch (e) {
      // Fallback: if response is just an array of strings, convert to new format
      try {
        const fallbackTopics = JSON.parse(response);
        if (Array.isArray(fallbackTopics) && fallbackTopics.length > 0 && typeof fallbackTopics[0] === 'string') {
          // Old format - assign all topics to all pages as fallback
          topicsData = fallbackTopics.map(topic => ({
            topic,
            pages: pageContents.map((_, i) => i),
            strategy: '' // No strategy in old format
          }));
        }
      } catch (e2) {
        topicsData = [];
      }
    }

    // PHASE 1: Deep Analysis - Extract concrete examples with strategic insights
    const enrichmentPrompt = `You are a content strategist analyzing competitor content. For each specific topic below, extract 3-5 concrete examples that demonstrate HOW competitors implement this approach.

${icpContext}${pageTypeContext}

TOPICS WITH STRATEGY CONTEXT:
${topicsData.map((t, i) => `${i + 1}. ${t.topic}
   Strategy Commentary: ${t.strategy || 'Not provided'}
   Pages: ${t.pages?.map(p => pageContents[p]?.url || p).join(', ') || 'Unknown'}`).join('\n\n')}

For EACH topic, extract 3-5 concrete examples showing:
1. snippet: Exact competitor text (100-300 chars) demonstrating this specific approach
2. source: The page URL
3. strategyInsight: WHY this specific implementation works (psychology, proof type, clarity, urgency)
4. writingInstruction: HOW to adapt this approach for your content (what to preserve, what to customize)
5. context: WHERE this fits (e.g., "hero section", "benefits list", "objection handling", "trust signals")
6. keyTactics: Array of 2-5 short, specific phrases that are ICP-relevant (e.g., ["GLP certified", "Leica automated platform", "24-hour turnaround", "ISO 15189 accredited", "PhD-level support"])

CRITICAL for keyTactics:
- Extract SHORT phrases (2-5 words) that make sense to the ICP out of context
- Focus on specific certifications, technologies, timelines, proof points, or differentiators
- These should be "power phrases" that immediately signal value or credibility
- Examples: "same-day results", "FDA-cleared", "cGMP facility", "dedicated project manager", "no minimum order"

Competitor page contents:
${pageContents.map((p, i) => `[PAGE ${i}: ${p.url}]
${p.content.substring(0, 2000)}${p.content.length > 2000 ? '...' : ''}`).join('\n\n---\n\n')}

Return ONLY valid JSON:
{
  "topics": [
    {
      "label": "exact topic name from above",
      "overallStrategy": "the strategy commentary provided for this topic",
      "examples": [
        {
          "snippet": "exact competitor text showing this approach",
          "source": "URL",
          "strategyInsight": "why this specific implementation works",
          "writingInstruction": "how to adapt this tactic",
          "context": "where to use this",
          "keyTactics": ["short phrase 1", "short phrase 2", "specific detail 3"]
        }
      ]
    }
  ]
}

CRITICAL:
- Focus on examples that demonstrate the SPECIFIC approach in the topic name
- Snippets should show concrete implementation, not generic statements
- Strategy insights should connect to the specific tactic mentioned in the topic
- Include the overallStrategy from the topic analysis
- Return ONLY the JSON, no markdown`;

    let enrichmentData = [];
    try {
      const enrichmentResponse = await monkey.AI(enrichmentPrompt, {
        vendor: "openai",
        model: "gpt-4o",
        forceJson: true,
      });

      const parsed = JSON.parse(enrichmentResponse);
      enrichmentData = parsed.topics || [];
    } catch (e) {
      // Continue with basic topics if enrichment fails
      enrichmentData = [];
    }

    // Map page indices to URLs and create enriched topics
    const enrichedTopics = topicsData.map(item => {
      const enrichment = enrichmentData.find(t => 
        t.label === item.topic || 
        t.label?.toLowerCase() === item.topic?.toLowerCase()
      );
      
      const competitors = item.pages
        ? item.pages
            .filter(pageIndex => pageIndex >= 0 && pageIndex < pageContents.length)
            .map(pageIndex => ({
              url: pageContents[pageIndex].url,
              title: pageContents[pageIndex].title
            }))
        : [];

      return {
        label: item.topic,
        // NEW: Strategy commentary from initial topic analysis
        strategy: item.strategy || enrichment?.overallStrategy || '',
        // Backward compatibility fields
        exampleText: enrichment?.examples?.[0]?.snippet || '',
        sourceUrl: enrichment?.examples?.[0]?.source || (competitors[0]?.url || ''),
        // NEW: Full enriched competitor examples with specific implementation details
        competitorExamples: enrichment?.examples || [],
        // Keep competitor list for reference
        competitors: competitors
      };
    });

    // Also return flat array for backward compatibility
    const topics = enrichedTopics.map(t => t.label);
    return NextResponse.json({ 
      assets: { 
        topics: enrichedTopics, // NEW: Use enriched format with competitorExamples
        key_topics: topics, // Backward compatibility
        key_topics_with_competitors: enrichedTopics.map(t => ({
          topic: t.label,
          competitors: t.competitors
        }))
      },
      ...(remaining != null && { remaining }),
    });
  } catch (error) {
    throw error;
  }
}
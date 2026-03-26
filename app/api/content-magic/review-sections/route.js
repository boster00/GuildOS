import { NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";
import { initMonkey } from "@/libs/monkey";

export async function POST(request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const requestBody = await request.json();
      const {
      sections, // Array of { heading: string, content: string }
      articleTitle,
      mainKeyword,
      originalVision,
      icpId
    } = requestBody;

    if (!sections || !Array.isArray(sections) || sections.length === 0) {
      return NextResponse.json(
        { error: "sections array is required" },
        { status: 400 }
      );
    }
    // Fetch ICP details from database if ICP ID is provided
    let icpData = null;
    let icpContext = "";
    
    if (icpId) {
      const { data: icp, error: icpError } = await supabase
        .from("icps")
        .select("*")
        .eq("id", icpId)
        .eq("user_id", user.id)
        .single();

      if (!icpError && icp) {
        icpData = icp;
        // Build comprehensive ICP context
        icpContext = `\n## Target Audience (ICP):\n`;
        Object.entries(icp).forEach(([key, value]) => {
          if (!value || 
              typeof value !== 'string' || 
              value.trim().length === 0 ||
              ['id', 'user_id', 'created_at', 'updated_at'].includes(key)) {
            return;
          }
          const label = key
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
          icpContext += `- **${label}**: ${value}\n`;
        });
      } else {
      }
    }

    // Build sections JSON for AI
    const sectionsJson = {};
    sections.forEach(section => {
      sectionsJson[section.heading] = section.content || '';
    });
    const prompt = `You are an expert content strategist evaluating an article. Evaluate the whole article and each section.

**Article Context:**
- Title: ${articleTitle || "Untitled"}
- Main Keyword: ${mainKeyword || "Not specified"}
- Original Vision: ${originalVision || "Not specified"}

${icpContext}

**Article Content (organized by sections):**
${JSON.stringify(sectionsJson, null, 2)}

**Your Task:**
1. Evaluate the whole article against:
   - Original vision alignment
   - ICP fit
   - Estimated ICP's current journey stage (awareness/research/decision/post-purchase)
   - Estimated ICP's familiarity with the offer

2. For EACH section (using the exact section header text as the key), provide:
   - **completed**: Boolean - true if the section is good as-is and needs no changes, false if it needs improvement
   - **evaluation**: Brief 10-15 words (max 20) explaining why the section is good (if completed is true) OR what needs improvement (if completed is false)
   - **instructions**: Specific, ready-to-use instructions that can be put in the instructions box to improve this section (only if completed is false)

**Output Format:**
Return a JSON object where:
- Keys are the exact section header text (as provided in the input)
- Each value is an object with:
  {
    "completed": true/false,
    "evaluation": "Brief evaluation (only if completed is false)",
    "instructions": "Ready-to-use instructions for improvement (only if completed is false)"
  }

**Important Rules:**
- If a section is good as-is, set completed: true and provide evaluation explaining WHY it's good (e.g., "Well-structured, addresses ICP needs, clear value proposition")
- If a section needs changes, set completed: false and provide both evaluation (what's wrong) and instructions (how to fix)
- Use the EXACT section header text as keys (case-sensitive, preserve original formatting)
- Be specific and actionable in instructions
- Focus on ICP needs and journey stage
- Always provide evaluation field, even for completed sections

Example:
{
  "Introduction": {
    "completed": false,
    "evaluation": "Too technical, needs more outcome-focused language",
    "instructions": "Rewrite this section to focus on outcomes and benefits rather than technical details. Make it more accessible to readers who are new to the topic."
  },
  "Benefits": {
    "completed": true,
    "evaluation": "Clear value proposition, well-structured, addresses ICP pain points effectively"
  },
  "Conclusion": {
    "completed": false,
    "evaluation": "Good structure but could be more concise",
    "instructions": "Make this section more concise while keeping all key benefits. Remove redundant explanations."
  }
}

Now evaluate all sections and return the JSON:`;
    const monkey = await initMonkey();
    monkey.loadUserContext({ ...(body?.user_context ?? {}), userId: user?.id });

    const aiResponse = await monkey.AI(prompt, {
      vendor: "openai",
      model: "gpt-4o",
      forceJson: true,
      temperature: 0.7,
    });
    

    // Parse the response
    let reviewData = null;
    try {
      reviewData = typeof aiResponse === 'string' ? JSON.parse(aiResponse) : aiResponse;
      
      
    } catch (e) {
      throw new Error(`Failed to parse AI response: ${e.message}`);
    }

    if (!reviewData || typeof reviewData !== 'object') {
      throw new Error("AI response is not a valid object");
    }
    return NextResponse.json(reviewData, { status: 200 });

  } catch (error) {
    return NextResponse.json(
      { 
        error: "Failed to review sections", 
        details: error.message 
      },
      { status: 500 }
    );
  }
}


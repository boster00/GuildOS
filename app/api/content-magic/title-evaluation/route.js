import { initMonkey } from "@/libs/monkey";
import { createClient } from "@/libs/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const {
      keyword,
      icpId,
    } = await request.json();

    // Validation
    if (!keyword || !keyword.trim()) {
      return NextResponse.json(
        { error: "Keyword is required" },
        { status: 400 }
      );
    }

    // Initialize monkey
    const monkey = await initMonkey();
    monkey.loadUserContext({ ...(body?.user_context ?? {}), userId: user?.id });

    // Fetch ICP data
    let icpData = null;
    if (icpId) {
      const { data: icp } = await supabase
        .from("icps")
        .select("*")
        .eq("id", icpId)
        .eq("user_id", user.id)
        .single();
      
      icpData = icp;
    }

    // Build context string for AI
    let contextString = "";
    
    if (icpData) {
      contextString += `\n## Target Audience (ICP):\n`;
      
      // Dynamically iterate through all ICP attributes
      Object.entries(icpData).forEach(([key, value]) => {
        // Skip system fields and empty values
        if (!value || key === 'id' || key === 'user_id' || key === 'created_at' || key === 'updated_at') {
          return;
        }
        
        // Convert snake_case to readable format
        const label = key
          .split('_')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
        
        contextString += `- ${label}: ${value}\n`;
      });
    }


    // Build the AI prompt
    const systemPrompt = `You are an expert content strategist and brand advisor. Your role is to evaluate content titles for alignment with the target audience's needs, goals, and intent, while providing encouraging, constructive feedback.

${contextString}

## Your Task:
Evaluate the provided title and:
1. Assess how well it aligns with the ICP and their intent
2. Provide encouraging feedback on what works (if anything)
3. Give constructive feedback on areas of misalignment
4. Suggest alternative titles for INSPIRATION ONLY - these are ideas to spark creativity, not definitive replacements
5. If the title is clearly misaligned with the ICP profile, strongly recommend reconsidering it
6. Maintain a supportive, collaborative tone while being honest about fit

Return your response as JSON with this format:
{
  "alignmentScore": 1-10 rating of how well the title aligns with ICP and intent,
  "analysis": "Your assessment of the title's alignment with the ICP and their intent. Include what works, what doesn't, and WHY. If score is low (< 6), clearly recommend reconsidering the title.",
  "feedback": "Constructive, encouraging feedback on the title and any concerns",
  "shouldConsiderChanging": true/false - strongly recommend change if true,
  "inspirationalAlternatives": [
    {
      "title": "Alternative Title 1 (for inspiration)",
      "rationale": "Why this alternative might resonate better with the ICP"
    }
  ]
}`;

    const userPrompt = `Please evaluate this title for alignment with our ICP and their intent:

Current Title: "${keyword}"

Is this title a good fit for our audience and their goals? What feedback would you provide?`;

    // Call AI using monkey
    const aiResponse = await monkey.AI(
      `${systemPrompt}\n\nUser request:\n${userPrompt}`,
      {
        vendor: "openai",
        model: "gpt-4o",
        forceJson: true
      }
    );
    // Parse the response (monkey.AI with forceJson extracts JSON automatically)
    let parsedResponse = { 
      alignmentScore: 0,
      analysis: "", 
      feedback: "",
      shouldConsiderChanging: false,
      inspirationalAlternatives: [] 
    };

    try {
      if (typeof aiResponse === 'string') {
        parsedResponse = JSON.parse(aiResponse);
      } else {
        parsedResponse = aiResponse;
      }
    } catch (e) {
      parsedResponse = { 
        alignmentScore: 0,
        analysis: aiResponse, 
        feedback: "",
        shouldConsiderChanging: false,
        inspirationalAlternatives: [] 
      };
    }
    return NextResponse.json(parsedResponse, { status: 200 });

  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}
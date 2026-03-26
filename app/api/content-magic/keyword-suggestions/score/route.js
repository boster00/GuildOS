import { NextResponse } from "next/server";
import { initMonkey } from "@/libs/monkey";
import { AI_MODELS } from "@/config/ai-models";

/**
 * Score keyword placement suggestions for quality
 */
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { suggestions } = body;

    if (!suggestions || !Array.isArray(suggestions) || suggestions.length === 0) {
      return NextResponse.json(
        { error: "suggestions array is required" },
        { status: 400 }
      );
    }
    
    const monkey = await initMonkey();
    monkey.loadUserContext(body?.user_context ?? {});
    const scoredSuggestions = [];
    
    // Score each suggestion
    for (const suggestion of suggestions) {
      const { fromText = "", toText, context = "", keyword } = suggestion;
      
      if (!toText) {
        scoredSuggestions.push({
          ...suggestion,
          scores: {
            readability: 0.5,
            semanticDrift: 0.5,
            keywordAwkwardness: 0.5,
            explanation: "Missing data for scoring",
          },
        });
        continue;
      }
      
      const prompt = `You are evaluating a text replacement for keyword placement quality.

Original text: "${fromText || "(new insertion)"}"
Replacement text: "${toText}"
Surrounding context: "${context}"
Keyword being added: "${keyword}"

Rate this replacement on three dimensions (0.0 to 1.0 scale):

1. readability: Grammar, fluency, and natural flow
   - 1.0 = Perfect grammar, reads smoothly
   - 0.5 = Acceptable but slightly awkward
   - 0.0 = Grammatically incorrect or very awkward

2. semanticDrift: How much the meaning changes
   - 0.0 = Meaning preserved perfectly
   - 0.5 = Slight meaning shift
   - 1.0 = Significant meaning change

3. keywordAwkwardness: How naturally the keyword fits
   - 0.0 = Keyword integrates seamlessly
   - 0.5 = Keyword feels somewhat forced
   - 1.0 = Obvious keyword stuffing

Return JSON:
{
  "readability": 0.0-1.0,
  "semanticDrift": 0.0-1.0,
  "keywordAwkwardness": 0.0-1.0,
  "explanation": "Brief explanation (1-2 sentences)"
}

Return ONLY valid JSON, no markdown, no extra text.`;

      try {
        const response = await monkey.AI(prompt, {
          vendor: "openai",
          model: AI_MODELS.ADVANCED,
          forceJson: true,
        });
        
        let scores = {
          readability: 0.7,
          semanticDrift: 0.2,
          keywordAwkwardness: 0.2,
          explanation: "Unable to score",
        };
        
        try {
          const parsed = JSON.parse(response);
          scores = {
            readability: parsed.readability || 0.7,
            semanticDrift: parsed.semanticDrift || 0.2,
            keywordAwkwardness: parsed.keywordAwkwardness || 0.2,
            explanation: parsed.explanation || "",
          };
        } catch (e) {
        }
        
        scoredSuggestions.push({
          ...suggestion,
          scores,
        });
      } catch (error) {
        scoredSuggestions.push({
          ...suggestion,
          scores: {
            readability: 0.7,
            semanticDrift: 0.3,
            keywordAwkwardness: 0.3,
            explanation: `Scoring error: ${error.message}`,
          },
        });
      }
    }
    
    return NextResponse.json({
      suggestions: scoredSuggestions,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Failed to score suggestions" },
      { status: 500 }
    );
  }
}

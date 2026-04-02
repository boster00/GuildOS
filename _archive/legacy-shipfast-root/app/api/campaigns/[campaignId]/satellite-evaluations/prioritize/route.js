import { NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";
import { initMonkey } from "@/libs/monkey";

export async function POST(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { campaignId } = params;
    const body = await request.json().catch(() => ({}));
    const { evaluations } = body;

    if (!evaluations || !Array.isArray(evaluations)) {
      return NextResponse.json(
        { error: "evaluations array is required" },
        { status: 400 }
      );
    }

    const monkey = await initMonkey();
    monkey.loadUserContext({ ...(body?.user_context ?? {}), userId: user?.id });

    // Build prompt for priority assignment
    const prompt = `You are a content strategist prioritizing satellite article topics.

Given these topic evaluations, assign priority (high, medium, low) based on:
1. Relevance to the pillar page and campaign goals
2. Search volume (higher = better)
3. Difficulty (lower = better, but balance with opportunity)
4. Strategy type alignment with campaign objectives

## Evaluations:
${evaluations.map((e, i) => `
${i + 1}. ${e.title}
   - Keyword: ${e.seedKeyword}
   - Type: ${e.strategyType}
   - Search Volume: ${e.searchVolume || "unknown"}
   - Difficulty: ${e.difficulty || "unknown"}
`).join("\n")}

Return ONLY a JSON array with the same order, each object having:
- id: (same as input)
- priority: "high" | "medium" | "low"

Example:
[
  { "id": "...", "priority": "high" },
  { "id": "...", "priority": "medium" }
]`;

    const response = await monkey.AI(prompt, {
      model: "gpt-4o-mini",
      temperature: 0.3,
    });

    // Parse response
    let priorities = [];
    try {
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        priorities = JSON.parse(jsonMatch[0]);
      } else {
        priorities = JSON.parse(response);
      }
    } catch (e) {
      // Fallback: assign medium to all
      priorities = evaluations.map(e => ({ id: e.id, priority: "medium" }));
    }

    // Merge priorities back into evaluations
    const priorityMap = {};
    priorities.forEach(p => {
      priorityMap[p.id] = p.priority;
    });

    const updatedEvaluations = evaluations.map(evaluation => ({
      ...evaluation,
      priority: priorityMap[evaluation.id] || evaluation.priority || "medium",
    }));

    // Update in database
    const { data: campaign } = await supabase
      .from("campaigns")
      .select("satellites")
      .eq("id", campaignId)
      .eq("user_id", user.id)
      .single();

    const satellites = campaign?.satellites || {
      evaluations: [],
      plannedSatellites: [],
      schedule: { cadence: "weekly", startDate: null }
    };

    const existing = satellites.evaluations || [];
    const updated = existing.map(existingEval => {
      const updatedEval = updatedEvaluations.find(e => e.id === existingEval.id);
      return updatedEval || existingEval;
    });

    await supabase
      .from("campaigns")
      .update({ 
        satellites: {
          ...satellites,
          evaluations: updated
        }
      })
      .eq("id", campaignId)
      .eq("user_id", user.id);

    return NextResponse.json({ evaluations: updatedEvaluations });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}


import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const body = await request.json();
    const { topics = [] } = body || {};

    

    const suggestions = topics.map((topic, idx) => {
      const topicId = topic?.id || `topic-${idx}`;
      const label = topic?.label || topic?.topic || "";
      const action = label ? "augment_existing_section" : "none";

      return {
        topicId,
        action,
        reasoning:
          action === "none"
            ? "Already appears covered; no change."
            : `Add or refine coverage for "${label}".`,
        targetSectionHeading: action === "augment_existing_section" ? "Existing relevant section" : undefined,
        suggestedChangeSummary:
          action === "augment_existing_section"
            ? `Strengthen coverage for "${label}" with 1–2 concise bullets.`
            : undefined,
        newSectionTitle: action === "create_new_section" ? label || "New Section" : undefined,
        suggestedPlacementAfterHeading: action === "create_new_section" ? "Place after the closest related section" : undefined,
        newSectionOutline:
          action === "create_new_section"
            ? "- Brief intro\n- 2–3 bullets covering key points\n- CTA or next-step sentence"
            : undefined,
      };
    });

    

    return NextResponse.json({ suggestions });
  } catch (error) {
    return NextResponse.json({ error: "Failed to generate topic suggestions" }, { status: 500 });
  }
}


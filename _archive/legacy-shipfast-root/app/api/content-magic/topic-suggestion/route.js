import { NextResponse } from "next/server";

// Simple helper to choose a conservative default action
function decideAction(topicLabel = "") {
  // Default to "augment_existing_section" if we have any topic text, otherwise none
  if (topicLabel.trim().length > 0) {
    return "augment_existing_section";
  }
  return "none";
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { topic } = body || {};
    const topicId = topic?.id || "topic-unknown";
    const label = topic?.label || topic?.topic || "";

    const action = decideAction(label);

    const suggestion = {
      topicId,
      action,
      reasoning:
        action === "none"
          ? "This topic appears already covered; no changes needed."
          : "Add or refine this topic within an existing relevant section.",
      targetSectionHeading: action === "augment_existing_section" ? "Existing relevant section" : undefined,
      suggestedChangeSummary:
        action === "augment_existing_section"
          ? `Strengthen coverage for "${label}" with 1–2 concise bullets.`
          : undefined,
      newSectionTitle: action === "create_new_section" ? label || "New Section" : undefined,
      suggestedPlacementAfterHeading: action === "create_new_section" ? "Place after the closest related section" : undefined,
      newSectionOutline:
        action === "create_new_section"
          ? "- Brief intro\n- 2–3 bullets covering the key points\n- CTA or next-step sentence"
          : undefined,
    };
    return NextResponse.json(suggestion);
  } catch (error) {
    return NextResponse.json({ error: "Failed to generate topic suggestion" }, { status: 500 });
  }
}


import { NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";
import { meterSpend } from "@/libs/monkey/tools/metering";
import { sendChatPrompt } from "@/libs/ai/eden/chatGateway";
import { getModel } from "@/libs/ai/eden/modelRegistry";

// Credit cost per model (minimum 2 — premium feature)
const MODEL_CREDITS = {
  "openai-gpt-4o-mini": 2,
  "openai-gpt-4o": 3,
  "anthropic-claude-sonnet": 4,
  "anthropic-claude-haiku": 2,
  "google-gemini-15-pro": 3,
  "mistral-large": 3,
  "meta-llama-3-70b": 2,
};

function getModelCost(modelId) {
  return MODEL_CREDITS[modelId] ?? 2;
}

/** Strip HTML tags to produce plain text for AI evaluation. */
function stripHtml(html) {
  if (!html) return "";
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Build auto-criteria from article context when user didn't provide custom criteria. */
function buildAutoCriteria(assets, context) {
  const parts = [];
  const keyword = assets?.main_keyword;
  if (keyword) parts.push(`Target keyword: "${keyword}"`);
  const icp = context?.icp;
  if (icp) {
    const name = icp.name || icp.title || "";
    const desc = icp.description || icp.desc || "";
    if (name || desc) parts.push(`Target audience: ${[name, desc].filter(Boolean).join(" — ")}`);
  }
  const offer = context?.offer;
  if (offer) {
    const name = offer.name || offer.title || "";
    const desc = offer.description || offer.desc || "";
    if (name || desc) parts.push(`Offer: ${[name, desc].filter(Boolean).join(" — ")}`);
  }
  if (parts.length === 0) return "Evaluate the article for quality, clarity, and effectiveness.";
  return parts.join("\n");
}

function randomUUID() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { articleId, modelIds, criteria } = body;

    // --- Validation ---
    if (!articleId || !Array.isArray(modelIds) || modelIds.length === 0) {
      return NextResponse.json(
        { error: "articleId and at least one modelId are required" },
        { status: 400 }
      );
    }

    // Validate all model IDs are known
    const unknownModels = modelIds.filter((id) => !getModel(id));
    if (unknownModels.length > 0) {
      return NextResponse.json(
        { error: `Unknown model(s): ${unknownModels.join(", ")}` },
        { status: 400 }
      );
    }

    // --- Auth ---
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // --- Fetch article ---
    const { data: article, error: articleError } = await supabase
      .from("content_magic_articles")
      .select("content_html, assets, context")
      .eq("id", articleId)
      .eq("user_id", user.id)
      .single();

    if (articleError || !article) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    // --- Build prompt content ---
    const plainText = stripHtml(article.content_html || "");
    if (!plainText) {
      return NextResponse.json(
        { error: "Article has no content to evaluate. Please write or adopt a draft first." },
        { status: 422 }
      );
    }

    const effectiveCriteria =
      criteria && criteria.trim()
        ? criteria.trim()
        : buildAutoCriteria(article.assets, article.context);

    const evaluationPrompt = `Evaluate this article against the following goal and criteria:

${effectiveCriteria}

---
ARTICLE:
${plainText.slice(0, 12000)}
---

Provide structured feedback covering:
1. How well the article meets the stated goal (score out of 10 with reasoning)
2. Key strengths (what works well)
3. Specific improvements with concrete examples or rewrites
4. Any missing sections or topics that should be added

Be direct and actionable. Focus on content quality, not formatting preferences.`;

    // --- Credit calculation ---
    const totalCost = modelIds.reduce((sum, id) => sum + getModelCost(id), 0);

    // --- Quota check (soft check via profiles) ---
    const { data: profile } = await supabase
      .from("profiles")
      .select("credits_remaining, payg_wallet")
      .eq("id", user.id)
      .single();

    const availableCredits =
      (Number(profile?.credits_remaining) || 0) + (Number(profile?.payg_wallet) || 0);

    if (availableCredits < totalCost) {
      return NextResponse.json(
        {
          error: `Insufficient credits. This evaluation requires ${totalCost} credits but you have ${Math.floor(availableCredits)} available.`,
          code: "QUOTA_EXCEEDED",
          required: totalCost,
          available: Math.floor(availableCredits),
        },
        { status: 402 }
      );
    }

    // --- Run evaluations in parallel ---
    const modelEvalPromises = modelIds.map(async (modelId) => {
      try {
        const result = await sendChatPrompt({
          prompt: evaluationPrompt,
          model: modelId,
          temperature: 0.4,
          maxTokens: 1500,
        });
        return { modelId, ok: true, text: result.data.text };
      } catch (err) {
        return { modelId, ok: false, error: err.message || "Model request failed" };
      }
    });

    const settled = await Promise.allSettled(modelEvalPromises);
    const modelOutcomes = settled.map((s) =>
      s.status === "fulfilled" ? s.value : { modelId: "unknown", ok: false, error: "Unexpected error" }
    );

    // --- Meter only successful calls ---
    const successfulCost = modelOutcomes
      .filter((o) => o.ok)
      .reduce((sum, o) => sum + getModelCost(o.modelId), 0);

    if (successfulCost > 0) {
      await meterSpend(supabase, {
        userId: user.id,
        action: "get_second_opinions",
        cost: successfulCost,
        idempotencyKey: randomUUID(),
        meta: { articleId, modelIds, successfulModels: modelOutcomes.filter((o) => o.ok).map((o) => o.modelId) },
      });
    }

    // --- Build response ---
    const results = {};
    for (const outcome of modelOutcomes) {
      if (outcome.ok) {
        results[outcome.modelId] = { text: outcome.text };
      } else {
        results[outcome.modelId] = { error: outcome.error };
      }
    }

    return NextResponse.json({
      ok: true,
      results,
      creditsCharged: successfulCost,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

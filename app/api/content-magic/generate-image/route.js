import { createClient } from "@/libs/supabase/server";
import { NextResponse } from "next/server";
import { initMonkey } from "@/libs/monkey";
import { finishExternalRequest } from "@/libs/monkey/tools/external_requests";

export async function POST(request) {
  const externalRequestId = request.headers.get("x-external-request-id") ?? null;
  const startTime = Date.now();
  const supabase = await createClient();
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const requestBody = await request.json();
    const { prompt, size, quality, responseFormat } = requestBody;

    // Validation
    if (!prompt || !prompt.trim()) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      );
    }

    // Initialize monkey and generate image
    const monkey = await initMonkey();
    monkey.loadUserContext({ ...(requestBody?.user_context ?? {}), userId: user?.id });

    const result = await monkey.generateImage(prompt.trim(), {
      size: size,
      quality: quality,
      responseFormat: responseFormat,
      userId: user.id,
    });

    await finishExternalRequest(supabase, {
      externalRequestId,
      status: "success",
      responsePreview: JSON.stringify({ images: result.images }),
      latencyMs: Date.now() - startTime,
    });

    const creditsUsed = result.credits ?? 0;
    const plan = monkey.planContext;
    const { data: creditsRow } = await supabase.from("user_credits").select("monthly_credits_used, monthly_usage_reset_at").eq("user_id", user.id).maybeSingle();
    const quota = plan?.limits?.monthlyCreditQuota ?? 50;
    const used = parseFloat(creditsRow?.monthly_credits_used) ?? 0;
    const remaining = quota === 0 ? null : Math.max(0, quota - used);
    const resetAt = creditsRow?.monthly_usage_reset_at ?? "";

    const headers = {
      "X-Credits-Used": String(creditsUsed),
      "X-Credits-Remaining": remaining === null ? "unlimited" : String(remaining),
      "X-Quota-Reset": resetAt ?? "",
    };

    return NextResponse.json(
      { 
        images: result.images,
        requestId: result.requestId,
        model: result.model,
        openaiRequestId: result.openaiRequestId,
      },
      { status: 200, headers }
    );

  } catch (error) {
    await finishExternalRequest(supabase, {
      externalRequestId,
      status: "failed",
      errorMessage: error?.message ?? String(error),
      latencyMs: Date.now() - startTime,
    });
    const errorMessage = error.message || "Internal server error";
    const statusCode = error.message?.includes("Unauthorized") ? 401 
      : error.message?.includes("API key") ? 500
      : error.message?.includes("OpenAI API error") ? 502
      : 500;
    
    return NextResponse.json(
      { 
        error: errorMessage.includes("Internal server error") ? "Failed to generate image" : errorMessage,
        details: error.message,
      },
      { status: statusCode }
    );
  }
}

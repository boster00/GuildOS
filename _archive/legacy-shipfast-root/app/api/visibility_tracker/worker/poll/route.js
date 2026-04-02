import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/libs/supabase/serviceRole";
import { fetchSerp } from "@/libs/visibility_tracker/providers/serpProvider";
import {
  runPrompt,
  extractMentions,
  extractCitations,
  hashResponse,
} from "@/libs/visibility_tracker/providers/aiProvider";
import { finalizeRun } from "@/libs/visibility_tracker/db";

const MAX_EXECUTION_MS = 50000;

async function processSerpJob(supabase, job) {
  const { data: keyword, error: kwError } = await supabase
    .from("vt_keywords")
    .select(
      `
      *,
      vt_projects (
        id,
        domain,
        brand_terms
      )
    `
    )
    .eq("id", job.entity_id)
    .single();

  if (kwError || !keyword) {
    throw new Error(`Keyword not found: ${kwError?.message}`);
  }

  const project = keyword.vt_projects;
  const domain = project?.domain;
  if (!domain) {
    throw new Error("Project domain not found");
  }

  const location = job.metadata?.location || "US";
  const device = job.metadata?.device || "desktop";
  const serpResult = await fetchSerp({
    keyword: keyword.keyword,
    domain,
    location,
    device,
  });

  const { error: insertError } = await supabase.from("vt_serp_results").insert({
    run_id: job.run_id,
    keyword_id: job.entity_id,
    engine: job.metadata?.engine || "google",
    location,
    device,
    rank: serpResult.rank,
    best_url: serpResult.bestUrl,
    serp_features: serpResult.features,
    raw: serpResult.raw,
  });

  if (insertError) {
    throw insertError;
  }
}

async function processAiJob(supabase, job) {
  const { data: prompt, error: promptError } = await supabase
    .from("vt_prompts")
    .select(
      `
      *,
      vt_projects (
        id,
        domain,
        brand_terms
      )
    `
    )
    .eq("id", job.entity_id)
    .single();

  if (promptError || !prompt) {
    throw new Error(`Prompt not found: ${promptError?.message}`);
  }

  const project = prompt.vt_projects;
  const model = job.metadata?.model || "chatgpt";
  const domain = project?.domain;
  const brandTerms = project?.brand_terms || [];

  if (!domain) {
    throw new Error("Project domain not found");
  }
  const aiResult = await runPrompt({
    model,
    promptText: prompt.prompt_text,
  });

  const { mentionsBrand, mentionsDomain } = extractMentions({
    responseText: aiResult.text,
    brandTerms,
    domain,
  });

  const citationData = extractCitations({
    responseText: aiResult.text,
    rawJson: aiResult.rawJson,
    domain,
  });

  const { error: insertError } = await supabase.from("vt_ai_results").insert({
    run_id: job.run_id,
    prompt_id: job.entity_id,
    model,
    response_text: aiResult.text,
    response_json: aiResult.rawJson,
    mentions_brand: mentionsBrand,
    mentions_domain: mentionsDomain,
    citations: citationData.domainCitations,
    response_hash: hashResponse(aiResult.text),
  });

  if (insertError) {
    throw insertError;
  }
}

export async function POST(request) {
  const startTime = Date.now();
  try {
    const authHeader = request.headers.get("authorization");
    const workerSecret =
      process.env.VT_WORKER_SECRET ||
      process.env.WORKER_SECRET ||
      process.env.CRON_SECRET;

    if (!workerSecret) {
      return NextResponse.json(
        { error: "Server misconfigured: worker secret not set" },
        { status: 500 }
      );
    }

    if (authHeader !== `Bearer ${workerSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createServiceRoleClient();
    let body = {};
    try {
      body = await request.json();
    } catch {
      // empty body ok
    }

    const { workerId = "worker-1", batchSize = 2 } = body;
    const { data: jobs, error: claimError } = await supabase.rpc(
      "claim_vt_jobs",
      {
        p_worker_id: workerId,
        p_batch_size: batchSize,
      }
    );

    if (claimError) {
      return NextResponse.json(
        { error: claimError.message },
        { status: 500 }
      );
    }

    if (!jobs || jobs.length === 0) {
      return NextResponse.json({
        success: true,
        jobsProcessed: 0,
        results: [],
      });
    }
    const results = [];
    const runIds = new Set();

    for (const job of jobs) {
      const elapsed = Date.now() - startTime;
      if (elapsed > MAX_EXECUTION_MS) {
        
        const remaining = jobs.slice(results.length).map((j) => j.id);
        if (remaining.length > 0) {
          await supabase
            .from("vt_jobs")
            .update({ status: "queued", worker_id: null, locked_at: null })
            .in("id", remaining);
        }
        break;
      }

      runIds.add(job.run_id);

      try {
        

        await supabase
          .from("vt_jobs")
          .update({ status: "processing" })
          .eq("id", job.id);

        if (job.job_type === "serp_keyword") {
          await processSerpJob(supabase, job);
        } else if (job.job_type === "ai_prompt") {
          await processAiJob(supabase, job);
        }

        await supabase
          .from("vt_jobs")
          .update({ status: "completed", done_at: new Date().toISOString() })
          .eq("id", job.id);
        results.push({ jobId: job.id, success: true });
      } catch (error) {
        const newAttempts = (job.attempts || 0) + 1;
        const maxRetries = job.max_retries ?? 3;
        const shouldRetry = newAttempts < maxRetries;

        await supabase
          .from("vt_jobs")
          .update({
            status: shouldRetry ? "queued" : "failed",
            attempts: newAttempts,
            error: error?.message,
            worker_id: shouldRetry ? null : job.worker_id,
            locked_at: shouldRetry ? null : job.locked_at,
          })
          .eq("id", job.id);

        
        results.push({
          jobId: job.id,
          success: false,
          error: error?.message,
        });
      }
    }

    for (const runId of runIds) {
      try {
        const { data: pendingJobs } = await supabase
          .from("vt_jobs")
          .select("id")
          .eq("run_id", runId)
          .in("status", ["queued", "assigned", "processing"])
          .limit(1);

        if (!pendingJobs || pendingJobs.length === 0) {
          await finalizeRun(supabase, runId);
        }
      } catch (finalizeError) {
      }
    }

    const totalElapsed = Date.now() - startTime;
    return NextResponse.json({
      success: true,
      jobsProcessed: results.length,
      results,
      elapsedMs: totalElapsed,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || "Worker poll failed" },
      { status: 500 }
    );
  }
}

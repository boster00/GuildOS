'use server';

import cron from '@/libs/cron/class';

/**
 * POST /api/cron/results
 * 
 * Worker endpoint to submit job results
 * Updates vt_jobs; if completed, inserts vt_ai_results
 * 
 * Request body:
 * {
 *   id: uuid (required) - The vt_jobs.id to update
 *   status: text (required) - 'completed' | 'failed' | 'queued'
 *   json: object (required) - { result: string, model: string }
 *   WORKER_SECRET: string (optional) - Authentication secret
 * }
 * 
 * Response:
 * {
 *   success: true,
 *   id: uuid,
 *   status: text,
 *   movedToHistory: boolean,
 *   timestamp: ISO string,
 *   duration_ms: number
 * }
 */
export async function POST(request) {
  const startTime = Date.now();

  try {
    // ============================================
    // 1. PARSE REQUEST BODY
    // ============================================
    let body;
    try {
      body = await request.json();
    } catch (e) {
      return Response.json(
        {
          error: '[app/api/cron/results/route.js:POST] Invalid JSON in request body',
          details: e.message,
        },
        { status: 400 }
      );
    }

    const { id, status, json, WORKER_SECRET } = body;
    // ============================================
    // 2. VALIDATE REQUIRED PARAMETERS
    // ============================================
    if (!id) {
      return Response.json(
        {
          error: '[app/api/cron/results/route.js:POST] Missing required parameter: id',
        },
        { status: 400 }
      );
    }

    if (!status || !['completed', 'failed', 'queued', 'error'].includes(status)) {
      return Response.json(
        {
          error: '[app/api/cron/results/route.js:POST] Invalid status: must be completed, failed, queued, or error',
        },
        { status: 400 }
      );
    }

    if (!json || typeof json !== 'object') {
      return Response.json(
        {
          error: '[app/api/cron/results/route.js:POST] Missing or invalid json object',
        },
        { status: 400 }
      );
    }

    if (!json.result || !json.model) {
      return Response.json(
        {
          error: '[app/api/cron/results/route.js:POST] json must contain result and model fields',
        },
        { status: 400 }
      );
    }

    // ============================================
    // 3. OPTIONAL: VERIFY WORKER SECRET
    // ============================================
    const workerSecret = request.headers.get('x-worker-secret') || WORKER_SECRET;
    const expectedWorkerSecret = process.env.WORKER_SECRET || process.env.CRON_SECRET;

    if (expectedWorkerSecret && workerSecret !== expectedWorkerSecret) {
      return Response.json(
        {
          error: '[app/api/cron/results/route.js:POST] Unauthorized: Invalid WORKER_SECRET',
        },
        { status: 401 }
      );
    }

    // ============================================
    // 4. INITIALIZE CRON
    // ============================================
    await cron.init();

    // ============================================
    // 5. UPDATE vt_jobs AND (if completed) INSERT vt_ai_results
    // ============================================
    const now = new Date().toISOString();
    const { data: existingJob, error: fetchErr } = await cron.supabase
      .from('vt_jobs')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchErr || !existingJob) {
      return Response.json(
        {
          success: false,
          error: '[app/api/cron/results/route.js:POST] Job not found: ' + (fetchErr?.message || ''),
          duration_ms: Date.now() - startTime,
        },
        { status: 404 }
      );
    }

    const { data: updatedJob, error: updateError } = await cron.supabase
      .from('vt_jobs')
      .update({
        status: status === 'completed' ? 'completed' : status === 'failed' || status === 'error' ? 'failed' : status,
        done_at: status === 'completed' || status === 'failed' || status === 'error' ? now : existingJob.done_at,
        metadata: { ...(existingJob.metadata || {}), ...json },
        ...(status === 'failed' || status === 'error' ? { error: json?.result || json?.finalError || 'Unknown error' } : {}),
      })
      .eq('id', id)
      .select('*')
      .single();

    if (updateError || !updatedJob) {
      return Response.json(
        {
          success: false,
          error: '[app/api/cron/results/route.js:POST] Failed to update job: ' + (updateError?.message || ''),
          duration_ms: Date.now() - startTime,
        },
        { status: 500 }
      );
    }

    let movedToHistory = false;
    if (status === 'completed' && updatedJob.job_type === 'ai_prompt') {
      const { error: aiErr } = await cron.supabase
        .from('vt_ai_results')
        .insert({
          run_id: updatedJob.run_id,
          prompt_id: updatedJob.entity_id,
          model: json.model || 'chatgpt',
          response_text: json.result || '',
          response_json: json,
        });
      if (!aiErr) movedToHistory = true;
    }

    // ============================================
    // 7. RETURN SUCCESS RESPONSE
    // ============================================
    const duration = Date.now() - startTime;

    return Response.json(
      {
        success: true,
        id: updatedJob.id,
        status: updatedJob.status,
        movedToHistory: movedToHistory,
        timestamp: new Date().toISOString(),
        duration_ms: duration,
      },
      { status: 200 }
    );
  } catch (error) {
    const duration = Date.now() - startTime;
    return Response.json(
      {
        success: false,
        error: '[app/api/cron/results/route.js:POST] ' + error.message,
        duration_ms: duration,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/cron/results?id=...
 * 
 * Check job status
 */
export async function GET(request) {
  const startTime = Date.now();

  try {
    const id = request.nextUrl.searchParams.get('id');

    if (!id) {
      return Response.json(
        {
          error: '[app/api/cron/results/route.js:GET] Missing query parameter: id',
        },
        { status: 400 }
      );
    }

    await cron.init();

    const job = await cron.getJob(id);

    if (!job) {
      return Response.json(
        {
          error: '[app/api/cron/results/route.js:GET] Job not found',
          id,
        },
        { status: 404 }
      );
    }

    const duration = Date.now() - startTime;

    return Response.json(
      {
        success: true,
        job: {
          id: job.id,
          task_id: job.task_id ?? job.entity_id,
          status: job.status,
          worker_id: job.worker_id,
          retry_count: job.retry_count ?? job.attempts,
          max_retries: job.max_retries,
          created_at: job.created_at,
          worker_started_at: job.worker_started_at ?? job.locked_at,
          json: job.json ?? job.metadata,
        },
        timestamp: new Date().toISOString(),
        duration_ms: duration,
      },
      { status: 200 }
    );
  } catch (error) {
    const duration = Date.now() - startTime;
    return Response.json(
      {
        success: false,
        error: '[app/api/cron/results/route.js:GET] ' + error.message,
        duration_ms: duration,
      },
      { status: 500 }
    );
  }
}
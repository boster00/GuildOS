'use server';

import cron from '@/libs/cron/class';

/**
 * POST /api/cron/jobs/assign
 * 
 * Worker endpoint to request job assignments
 * Called by: Local worker, remote workers, or any job consumer
 * 
 * Request body:
 * {
 *   worker_id: string (required) - Unique identifier for the worker
 *   batch_size: number (optional, default: 10) - Number of jobs to fetch
 *   WORKER_SECRET: string (optional) - Authentication secret
 * }
 * 
 * Response:
 * {
 *   success: boolean,
 *   jobs: [
 *     {
 *       id: uuid,
 *       task_id: uuid,
 *       user_id: uuid,
 *       worker_id: string,
 *       status: 'assigned',
 *       job_type: 'prompt',
 *       task: { ...full prompt/task object },
 *       created_at: timestamp,
 *       worker_started_at: timestamp,
 *       retry_count: number,
 *       max_retries: number,
 *       json: {}
 *     }
 *   ],
 *   count: number,
 *   timestamp: ISO string
 * }
 * 
 * Security: Can use WORKER_SECRET header or body for auth
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
          error: '[app/api/cron/jobs/assign/route.js:POST] Invalid JSON in request body',
          details: e.message,
        },
        { status: 400 }
      );
    }

    const { worker_id, batch_size = 10, WORKER_SECRET } = body;

    // ============================================
    // 2. VALIDATE REQUIRED PARAMETERS
    // ============================================
    if (!worker_id) {
      return Response.json(
        {
          error: '[app/api/cron/jobs/assign/route.js:POST] Missing required parameter: worker_id',
        },
        { status: 400 }
      );
    }

    if (typeof batch_size !== 'number' || batch_size < 1 || batch_size > 100) {
      return Response.json(
        {
          error: '[app/api/cron/jobs/assign/route.js:POST] Invalid batch_size: must be 1-100',
        },
        { status: 400 }
      );
    }

    // ============================================
    // 3. OPTIONAL: VERIFY WORKER SECRET
    // ============================================
    const workerSecret = request.headers.get('x-worker-secret') || WORKER_SECRET;
    const expectedWorkerSecret = process.env.WORKER_SECRET || process.env.CRON_SECRET;

    // Only validate if a secret is configured
    if (expectedWorkerSecret && workerSecret !== expectedWorkerSecret) {
      return Response.json(
        {
          error: '[app/api/cron/jobs/assign/route.js:POST] Unauthorized: Invalid WORKER_SECRET',
        },
        { status: 401 }
      );
    }

    // ============================================
    // 4. INITIALIZE CRON AND GET JOBS
    // ============================================
    await cron.init();

    const jobs = await cron.getJobsForWorker(worker_id, batch_size);
    const duration = Date.now() - startTime;

    // ============================================
    // 5. RETURN RESPONSE
    // ============================================
    return Response.json(
      {
        success: true,
        jobs,
        count: jobs.length,
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
        error: '[app/api/cron/jobs/assign/route.js:POST] ' + error.message,
        duration_ms: duration,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/cron/jobs/assign
 * 
 * Test endpoint to get job assignment info
 * Returns worker stats without assigning jobs
 */
export async function GET(request) {
  const startTime = Date.now();

  try {
    const worker_id = request.nextUrl.searchParams.get('worker_id');

    if (!worker_id) {
      return Response.json(
        {
          error: '[app/api/cron/jobs/assign/route.js:GET] Missing query parameter: worker_id',
        },
        { status: 400 }
      );
    }

    await cron.init();

    // Get job stats for this worker
    const assignedJobs = await cron.getJobsByStatus('assigned');
    const processingJobs = await cron.getJobsByStatus('processing');
    const workerAssignedJobs = assignedJobs.filter(j => j.worker_id === worker_id);
    const workerProcessingJobs = processingJobs.filter(j => j.worker_id === worker_id);

    const duration = Date.now() - startTime;

    return Response.json(
      {
        success: true,
        worker_id,
        stats: {
          assigned_jobs: workerAssignedJobs.length,
          processing_jobs: workerProcessingJobs.length,
          pending_jobs: workerAssignedJobs.length + workerProcessingJobs.length,
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
        error: '[app/api/cron/jobs/assign/route.js:GET] ' + error.message,
        duration_ms: duration,
      },
      { status: 500 }
    );
  }
}
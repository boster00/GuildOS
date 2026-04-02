'use server';

import cron from '@/libs/cron/class';

/**
 * GET /api/cron/trigger
 * 
 * Private endpoint called ONLY by Vercel's cron scheduler
 * Orchestrates the entire cron workflow:
 * 1. Schedule new jobs
 * 2. Requeue stuck jobs
 * 3. Archive completed jobs
 * 4. Trigger local worker (if enabled)
 * 
 * Security: Requires CRON_SECRET header
 */
export async function GET(request) {
  const startTime = Date.now();
  
  try {
    // ============================================
    // 1. VERIFY CRON SECRET
    // Accept x-cron-secret header or Authorization: Bearer (Vercel cron)
    // ============================================
    const authHeader = request.headers.get('authorization');
    const headerSecret = request.headers.get('x-cron-secret');
    const cronSecret = authHeader?.replace(/^Bearer\s+/i, '').trim() || headerSecret;
    const expectedSecret = process.env.CRON_SECRET;

    if (!expectedSecret) {

      return Response.json(
        { error: '[app/api/cron/trigger/route.js:GET] Server misconfigured: CRON_SECRET not set' },
        { status: 500 }
      );
    }

    if (cronSecret !== expectedSecret) {

      return Response.json(
        { error: '[app/api/cron/trigger/route.js:GET] Unauthorized: Invalid CRON_SECRET' },
        { status: 401 }
      );
    }

    // ============================================
    // 2. INITIALIZE CRON
    // ============================================
    await cron.init();
    cron.log('='.repeat(60));
    cron.log('CRON TRIGGER STARTED');
    cron.log('='.repeat(60));

    // ============================================
    // 3. SCHEDULE NEW JOBS (unified: VT schedule with source=db)
    // ============================================
    cron.log('Step 1: Scheduling new jobs (VT schedule db)...');
    const { schedule: vtSchedule } = await import('@/libs/visibility_tracker/scheduler/schedule');
    const vtScheduleResult = await vtSchedule(cron.supabase, { source: 'db' }, null);
    const scheduleResult = vtScheduleResult.success
      ? { success: true, added: vtScheduleResult.jobs_created ?? 0 }
      : { success: false, error: vtScheduleResult.error || vtScheduleResult.message };
    if (!scheduleResult.success) {
      throw new Error(`Failed to schedule jobs: ${scheduleResult.error}`);
    }
    cron.log(`✓ Scheduled ${scheduleResult.added} new jobs`);

    // ============================================
    // 3b. TRIGGER VT WORKER (so scheduled jobs get processed)
    // ============================================
    let vtWorkerTriggered = false;
    if (scheduleResult.added > 0) {
      cron.log('Step 1b: Triggering VT worker...');
      const origin = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) || 'http://localhost:3000';
      const workerSecret = process.env.VT_WORKER_SECRET || process.env.WORKER_SECRET || process.env.CRON_SECRET;
      if (workerSecret) {
        try {
          const vtRes = await fetch(`${origin}/api/visibility_tracker/worker/poll`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${workerSecret}` },
            body: JSON.stringify({ workerId: 'cron-trigger', batchSize: 10 }),
          });
          vtWorkerTriggered = vtRes.ok;
          if (vtRes.ok) {
            cron.log('✓ VT worker triggered');
          } else {
            const errData = await vtRes.json().catch(() => ({}));
            cron.log(`⚠ VT worker failed: ${errData?.error || vtRes.statusText}`);
          }
        } catch (e) {
          cron.log(`⚠ VT worker error: ${e?.message}`);
        }
      } else {
        cron.log('⚠ VT worker skipped (no VT_WORKER_SECRET / CRON_SECRET)');
      }
    }

    // ============================================
    // 4. REQUEUE STUCK JOBS
    // ============================================
    cron.log('Step 2: Requeuing stuck jobs...');
    const requeueResult = await cron.requeueStuckJobs();
    if (!requeueResult.success) {
      throw new Error(`Failed to requeue stuck jobs: ${requeueResult.error}`);
    }
    cron.log(`✓ Requeued ${requeueResult.requeued} stuck jobs`);

    // ============================================
    // 5. ARCHIVE COMPLETED JOBS
    // ============================================
    cron.log('Step 3: Archiving completed jobs...');
    const archiveResult = await cron.archiveCompletedJobs();
    if (!archiveResult.success) {
      throw new Error(`Failed to archive jobs: ${archiveResult.error}`);
    }
    cron.log(`✓ Archived ${archiveResult.archived} completed jobs`);

    // ============================================
    // 6. TRIGGER LOCAL WORKER (optional)
    // ============================================
    cron.log('Step 4: Triggering local worker...');
    const workerResult = await cron.triggerLocalWorker();
    if (workerResult.triggered) {
      cron.log('✓ Local worker triggered');
    } else if (!workerResult.success) {
      cron.log(`⚠ Worker trigger failed: ${workerResult.error}`);
      // Don't fail the entire cron if worker fails
    } else {
      cron.log('⚠ Local worker disabled (CRON_LOCAL_WORKER != true)');
    }

    // ============================================
    // 5. MASTER OF COINS (reset due accounts: expire + grant monthly credits)
    // ============================================
    cron.log('Step 5: Master of Coins worker...');
    let creditsRefreshResult = { granted: 0, success: false };
    const origin = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) || 'http://localhost:3000';
    const mocSecret = process.env.MASTER_OF_COINS_SECRET || process.env.CRON_SECRET;
    if (mocSecret) {
      try {
        const mocRes = await fetch(`${origin}/api/master-of-coins/worker`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${mocSecret}` },
          body: JSON.stringify({}),
        });
        const mocData = await mocRes.json().catch(() => ({}));
        creditsRefreshResult = { granted: mocData.granted ?? 0, success: mocRes.ok };
        if (mocRes.ok) {
          cron.log(`✓ Master of Coins: ${creditsRefreshResult.granted} user(s) granted`);
        } else {
          cron.log(`⚠ Master of Coins worker failed: ${mocData.error || mocRes.statusText}`);
        }
      } catch (mocErr) {
        cron.log(`⚠ Master of Coins worker error: ${mocErr?.message}`);
      }
    } else {
      cron.log('⚠ Master of Coins skipped (MASTER_OF_COINS_SECRET or CRON_SECRET not set)');
    }

    // ============================================
    // 6. EXTERNAL_REQUESTS: PURGE + STALE PENDING SWEEPER
    // ============================================
    cron.log('Step 6: External requests purge + stale sweeper...');
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

      const { data: purgeData, error: purgeErr } = await cron.supabase
        .from('external_requests')
        .delete()
        .lt('created_at', thirtyDaysAgo)
        .select('id');

      if (purgeErr) {
        cron.log(`⚠ External requests purge failed: ${purgeErr.message}`);
      } else {
        const purged = purgeData?.length ?? 0;
        cron.log(`✓ Purged ${purged} external_requests rows older than 30 days`);
      }

      const { data: sweepData, error: sweepErr } = await cron.supabase
        .from('external_requests')
        .update({
          status: 'failed',
          error_message: 'Expired: no completion signal',
          finished_at: new Date().toISOString(),
        })
        .eq('status', 'pending')
        .lt('created_at', tenMinAgo)
        .select('id');

      if (sweepErr) {
        cron.log(`⚠ External requests stale sweeper failed: ${sweepErr.message}`);
      } else {
        const swept = sweepData?.length ?? 0;
        cron.log(`✓ Stale sweeper: marked ${swept} pending rows as failed`);
      }
    } catch (extErr) {
      cron.log(`⚠ External requests maintenance failed: ${extErr?.message ?? extErr}`);
      // Don't fail the entire cron
    }

    // ============================================
    // 7. SUCCESS RESPONSE
    // ============================================
    const duration = Date.now() - startTime;
    const response = {
      success: true,
      message: 'Cron trigger completed successfully',
      duration_ms: duration,
      results: {
        scheduled: scheduleResult.added,
        vt_worker_triggered: vtWorkerTriggered,
        requeued: requeueResult.requeued,
        archived: archiveResult.archived,
        worker_triggered: workerResult.triggered,
        credits_refresh_granted: creditsRefreshResult.granted ?? 0,
        external_requests_purge_sweep: 'ok',
      },
    };

    cron.log('='.repeat(60));
    cron.log(`CRON TRIGGER COMPLETED in ${duration}ms`);
    cron.log('='.repeat(60));
    cron.log('Results:', response.results);

    return Response.json(response, { status: 200 });
  } catch (error) {
    const duration = Date.now() - startTime;
    
    cron.log('='.repeat(60));
    cron.log('❌ CRON TRIGGER FAILED');
    cron.log('='.repeat(60));
    cron.log('Error:', error.message);
    cron.log('Stack:', error.stack);
    cron.log(`Duration: ${duration}ms`);

    return Response.json(
      {
        success: false,
        error: `[app/api/cron/trigger/route.js:GET] ${error.message}`,
        duration_ms: duration,
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/cron/trigger
 * 
 * Manual testing endpoint - handles individual actions
 * Called from cron-test dashboard to test specific cron functions
 * 
 * Body parameters:
 * - action: 'scheduleNewJobs' | 'requeueStuck' | 'archiveJobs' | 'triggerWorker' | 'runAll'
 * - jobType: (optional) 'prompt', default is 'prompt'
 * - CRON_SECRET: (optional) secret from body or header x-cron-secret
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
          success: false,
          error: '[app/api/cron/trigger/route.js:POST] Invalid JSON in request body',
        },
        { status: 400 }
      );
    }

    // ============================================
    // 2. VERIFY CRON SECRET
    // ============================================
    const cronSecret = body.CRON_SECRET || request.headers.get('x-cron-secret');
    const expectedSecret = process.env.CRON_SECRET;

    if (!expectedSecret) {
      return Response.json(
        { error: '[app/api/cron/trigger/route.js:POST] CRON_SECRET not set' },
        { status: 500 }
      );
    }

    if (cronSecret !== expectedSecret) {
      return Response.json(
        { error: '[app/api/cron/trigger/route.js:POST] Unauthorized: Invalid CRON_SECRET' },
        { status: 401 }
      );
    }

    // ============================================
    // 3. PARSE ACTION PARAMETERS
    // ============================================
    const action = body.action || 'runAll';
    const jobType = body.jobType || 'prompt';

    await cron.init();
    cron.log('='.repeat(60));
    cron.log(`POST ACTION: ${action}`);
    cron.log('='.repeat(60));

    let result;
    const duration = Date.now() - startTime;

    // ============================================
    // 4. ROUTE TO APPROPRIATE ACTION
    // ============================================
    switch (action) {
      case 'scheduleNewJobs':
        cron.log('Running: scheduleNewJobs');
        result = await cron.scheduleNewJobs(jobType, {
          tasks: body.tasks,
          userId: body.userId,
        });
        break;
      case 'testRLS':
        result = await cron.testServiceRolePermissions();
        break;
      case 'resetCron':
        result = await cron.resetCronSystem();
        break;
      case 'requeueStuck':
        cron.log('Running: requeueStuckJobs');
        result = await cron.requeueStuckJobs();
        break;

      case 'markAllAsTimeoutFail':
        cron.log('Running: markAllInProgressAsTimeoutFail');
        result = await cron.markAllInProgressAsTimeoutFail();
        break;

      case 'archiveJobs':
        cron.log('Running: archiveCompletedJobs');
        result = await cron.archiveCompletedJobs();
        break;

      case 'triggerWorker':
        cron.log('Running: triggerLocalWorker');
        result = await cron.triggerLocalWorker();
        break;

      case 'runAll':
        cron.log('Running: Full workflow (all steps)');
        // Delegate to GET handler for full workflow
        return GET(request);

      default:
        return Response.json(
          {
            success: false,
            error: `[app/api/cron/trigger/route.js:POST] Unknown action: ${action}. Valid actions: scheduleNewJobs, requeueStuck, markAllAsTimeoutFail, archiveJobs, triggerWorker, runAll`,
          },
          { status: 400 }
        );
    }

    // ============================================
    // 5. SUCCESS RESPONSE
    // ============================================
    const finalDuration = Date.now() - startTime;
    const response = {
      success: result.success,
      action,
      duration_ms: finalDuration,
      results: {
        [action]: result,
      },
    };

    cron.log(`✓ ${action} completed in ${finalDuration}ms`);
    cron.log('='.repeat(60));

    return Response.json(response, { status: result.success ? 200 : 400 });
  } catch (error) {
    const duration = Date.now() - startTime;

    cron.log('='.repeat(60));
    cron.log('❌ POST ACTION FAILED');
    cron.log('='.repeat(60));
    cron.log('Error:', error.message);
    cron.log(`Duration: ${duration}ms`);

    return Response.json(
      {
        success: false,
        error: `[app/api/cron/trigger/route.js:POST] ${error.message}`,
        duration_ms: duration,
      },
      { status: 500 }
    );
  }
}
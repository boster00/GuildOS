import { NextResponse } from 'next/server';
import cron from '@/libs/cron/class';

/**
 * Vercel Cron Master Endpoint
 * 
 * This endpoint is triggered by Vercel's cron scheduler (defined in vercel.json)
 * It orchestrates the same workflow as startCron.js pingCronAPI():
 * 1. Initialize cron system
 * 2. Call manageTasks to refresh task queue
 * 3. Optionally call processTasksLocal if CRON_LOCAL_WORKER is enabled
 */
export async function GET(request) {
  try {
    // Initialize cron system if not already initialized
    if (!cron.isInitialized) {
      await cron.init();
    }

    // Step 1: Manage tasks - refresh the cron_jobs queue
    cron.log("1. Cron Master: manageTasks called to refresh tasks");
    const manageTasksBody = {
      action: "manageTasks",
      jobType: "prompt",
      worker: 'local',
      CRON_SECRET: cron.cronSecret,
    };

    const manageResponse = await cron.monkey.apiCall(
      `${cron.siteUrl}/api/cron`,
      manageTasksBody
    ).catch(error => {
      cron.log("Cron Master Error in manageTasks:", error.message);
      throw error;
    });

    cron.log("2. Cron Master: manageTasks completed");

    // Step 2: Process tasks locally if enabled
    let processResponse = null;
    if (process.env.CRON_LOCAL_WORKER === 'true') {
      cron.log("3. Cron Master: Starting local worker to process tasks");
      
      const processTasksBody = {
        action: "processTasksLocal",
        jobType: "prompt",
        worker: 'local',
        CRON_SECRET: cron.cronSecret,
      };

      processResponse = cron.monkey.apiCall(
        `${cron.siteUrl}/api/cron`,
        processTasksBody
      ).catch(error => {
        cron.log("Cron Master Error in processTasksLocal:", error.message);
        // Don't throw - allow graceful degradation
        return { error: error.message };
      });

      cron.log("4. Cron Master: Local worker completed");
    } else {
      cron.log("3. Cron Master: CRON_LOCAL_WORKER disabled, skipping local processing");
    }

    return NextResponse.json({
      success: true,
      message: "Cron master workflow completed",
      timestamp: new Date().toISOString(),
      steps: {
        manageTasks: "completed",
        processTasksLocal: process.env.CRON_LOCAL_WORKER === 'true' ? "completed" : "skipped",
      },
      logs: cron.log(),
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error.message || "Cron master workflow failed",
      timestamp: new Date().toISOString(),
      logs: cron.log(),
    }, { status: 500 });
  }
}

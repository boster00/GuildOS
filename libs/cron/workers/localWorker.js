
import monkey from '@/libs/monkey';
import { initMonkey } from '@/libs/monkey';

/**
 * libs/cron/workers/localWorker.js
 * 
 * Local worker for processing cron jobs
 * - Called once by /api/cron/trigger each time cron runs
 * - Requests jobs from /api/cron/jobs/assign
 * - Processes job batch
 * - Submits results to /api/cron/results
 * - Returns summary stats
 * 
 * Usage (from /api/cron/trigger):
 *   import localWorker from '@/libs/cron/workers/localWorker';
 *   const stats = await localWorker.run();
 */

class LocalWorker {
  constructor(config = {}) {
    this.workerId = config.workerId || `local-worker-${Date.now()}`;
    this.baseUrl = config.baseUrl || process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || 
      (process.env.NODE_ENV === "development" 
        ? `http://localhost:${process.env.PORT || 3000}` 
        : null);
    this.workerSecret = config.workerSecret || process.env.WORKER_SECRET || process.env.CRON_SECRET || '';
    this.batchSize = config.batchSize || 10;
    this.processingDelay = config.processingDelay || 100; // ms delay per job

    this.log(`Initialized with workerId: ${this.workerId}`);
  }

  log(...args) {

  }

  // ============================================
  // 1. REQUEST JOBS FROM API
  // ============================================
  async requestJobs() {
    try {
      const monkeyInstance = await initMonkey();
      // Server-side: use worker's baseUrl so we hit the same app
      const originalSiteUrl = monkeyInstance.siteUrl;
      monkeyInstance.siteUrl = this.baseUrl || originalSiteUrl;
      try {
        const text = await monkeyInstance.apiCall('/api/cron/jobs/assign', {
          worker_id: this.workerId,
          batch_size: this.batchSize,
        }, {
          headers: { 'x-worker-secret': this.workerSecret },
        });
        const data = JSON.parse(text);
        if (!data.success) {
          throw new Error(data.error || 'Unknown error from jobs API');
        }
        return data.jobs || [];
      } finally {
        monkeyInstance.siteUrl = originalSiteUrl;
      }
    } catch (error) {
      this.log(`Error requesting jobs: ${error.message}`);
      return [];
    }
  }

  // ============================================
  // 2. SIMULATE JOB PROCESSING
  // ============================================
  async processJob(job) {

    try {
      this.log(`Processing job ${job.id} (task: ${job.task_id})`);

      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, this.processingDelay));

      
      // Return demo result
      
        const aiResponse = await monkey.AI(job.task.text,{apiKey:process.env.NEXT_PUBLIC_CHATGPT_API_KEY});
        const result = {
        result: aiResponse,
        model: 'gpt-4-turbo',
        };

      // Randomly decide success/failure for demo purposes
      const shouldFail = Math.random() < 0; // 20% failure rate for testing

      if (shouldFail) {
        throw new Error('Simulated AI processing error');
      }

      return result;
    } catch (error) {
      this.log(`Error processing job ${job.id}: ${error.message}`);
      throw error;
    }
  }

  // ============================================
  // 3. SUBMIT JOB RESULT
  // ============================================
  async submitResult(jobId, resultData, isSuccess = true) {
    try {
      const payload = {
        id: jobId,
        status: isSuccess ? 'completed' : 'error',
        json: resultData,
      };

      const monkeyInstance = await initMonkey();
      const text = await monkeyInstance.apiCall('/api/cron/results', payload, {
        headers: { 'x-worker-secret': this.workerSecret },
      });
      const data = JSON.parse(text);

      if (!data.success) {
        throw new Error(data.error || 'Unknown error from results API');
      }

      this.log(`✓ Job ${jobId} scus: ${data.status}`);

      return data;
    } catch (error) {
      this.log(`✗ Error submitting result for job ${jobId}: ${error.message}`);
      throw error;
    }
  }

  // ============================================
  // 4. RUN ONE BATCH (called by cron)
  // ============================================
  async run() {
    try {
      this.log(`Starting single batch execution`);

      const jobs = await this.requestJobs();

      if (jobs.length === 0) {
        this.log(`No jobs available`);
        return {
          workerId: this.workerId,
          jobsProcessed: 0,
          jobsSucceeded: 0,
          jobsFailed: 0,
          errors: [],
        };
      }

      this.log(`Received ${jobs.length} job(s) to process`);

      let succeededCount = 0;
      let failedCount = 0;
      const errors = [];

      for (const job of jobs) {
        try {
          // Process the job
          const result = await this.processJob(job);

          // Submit successful result
          await this.submitResult(job.id, result, true);
          succeededCount++;
        } catch (error) {
          this.log(`Job ${job.id} failed: ${error.message}`);

          try {
            // Submit error result
            await this.submitResult(
              job.id,
              {
                result: `Error: ${error.message}`,
                model: 'gpt-4-turbo',
              },
              false
            );
            failedCount++;
          } catch (submitError) {
            this.log(`Failed to submit error for job ${job.id}: ${submitError.message}`);
            errors.push(`Job ${job.id}: ${submitError.message}`);
            failedCount++;
          }
        }
      }

      const totalProcessed = succeededCount + failedCount;
      this.log(`Batch complete: ${succeededCount} success, ${failedCount} failed (${totalProcessed} total)`);

      return {
        workerId: this.workerId,
        jobsProcessed: totalProcessed,
        jobsSucceeded: succeededCount,
        jobsFailed: failedCount,
        errors: errors,
      };
    } catch (error) {
      this.log(`Fatal error: ${error.message}`);
      return {
        workerId: this.workerId,
        jobsProcessed: 0,
        jobsSucceeded: 0,
        jobsFailed: 0,
        errors: [error.message],
      };
    }
  }
}

// Export singleton instance
const localWorker = new LocalWorker();
export default localWorker;
export { LocalWorker };
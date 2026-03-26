// 'use server';

import dotenv from 'dotenv';
import { createClient } from '../supabase/service.js';


/*

Function Organization
Category	Functions	Purpose
Initialization	init(), log()	Setup & logging
Cron Trigger (API trigger)	scheduleNewJobs(), requeueStuckJobs(), archiveCompletedJobs(), triggerLocalWorker()	Called by /api/cron/trigger
Worker API (Job assignment)	getJobsForWorker(), markJobProcessing()	Called by /api/cron/jobs/assign
Results API (Job completion)	recordJobResult(), recordJobError()	Called by /api/cron/results
Utilities	getJobsByStatus(), getJob(), clearAllJobs()	Debugging & inspection

*/

if (!process.env.NEXT_PUBLIC_SITE_URL) {
  dotenv.config({ path: '.env.local' });
}

class Cron {
  constructor() {
    this.supabase = null;
    this.siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || 
      (process.env.NODE_ENV === "development" 
        ? `http://localhost:${process.env.PORT || 3000}` 
        : null);
    this.isInitialized = false;
  }

  async init() {
    if (!this.isInitialized) {
      this.supabase = await createClient();
      this.isInitialized = true;
    }
  }

  log(...msgs) {
  }
    /**
   * RESET: Empty vt_ai_results, vt_serp_results, vt_jobs, vt_runs only. vt_projects, vt_keywords, vt_prompts are left intact.
   * @returns {Object} { success, cleared: { jobs, runs, ai_results, serp_results } }
   */
  async resetCronSystem() {
    try {
      this.log('=== RESETTING CRON SYSTEM (vt_* result/run tables only) ===');

      const results = { jobs: 0, runs: 0, ai_results: 0, serp_results: 0 };

      const deleteTable = async (table, label) => {
        // PostgREST requires a WHERE clause; match all rows via id not null (all rows have id)
        const { count, error } = await this.supabase
          .from(table)
          .delete()
          .not('id', 'is', null)
          .select('id', { count: 'exact', head: true });
        if (error) throw error;
        const n = count ?? 0;
        this.log(`✓ Emptied ${table}: ${n} row(s) deleted`);
        return n;
      };

      try {
        results.ai_results = await deleteTable('vt_ai_results', 'ai_results');
      } catch (e) {
        this.log(`✗ Error emptying vt_ai_results: ${e.message}`);
        throw e;
      }
      try {
        results.serp_results = await deleteTable('vt_serp_results', 'serp_results');
      } catch (e) {
        this.log(`✗ Error emptying vt_serp_results: ${e.message}`);
        throw e;
      }
      try {
        results.jobs = await deleteTable('vt_jobs', 'jobs');
      } catch (e) {
        this.log(`✗ Error emptying vt_jobs: ${e.message}`);
        throw e;
      }
      try {
        results.runs = await deleteTable('vt_runs', 'runs');
      } catch (e) {
        this.log(`✗ Error emptying vt_runs: ${e.message}`);
        throw e;
      }

      this.log('=== CRON SYSTEM RESET COMPLETE (vt_projects, vt_keywords, vt_prompts preserved) ===');
      return { success: true, cleared: results };
    } catch (error) {
      this.log(`[libs/cron/class.js:resetCronSystem] ${error.message}`);
      return {
        success: false,
        error: error.message,
        cleared: { jobs: 0, runs: 0, ai_results: 0, serp_results: 0 },
      };
    }
  }

  // ============================================
  // CRON TRIGGER FUNCTIONS (called by /api/cron/trigger)
  // ============================================

  /**
   * Resolve a user id for the demo project: CRON_DEMO_USER_ID, or first user from vt_projects, profiles, icps, or Auth.
   * @returns {Promise<string|null>}
   */
  async _resolveDemoUserId() {
    if (process.env.CRON_DEMO_USER_ID) return process.env.CRON_DEMO_USER_ID;
    const { data: fromVt } = await this.supabase.from('vt_projects').select('user_id').limit(1).maybeSingle();
    if (fromVt?.user_id) return fromVt.user_id;
    try {
      const { data: fromProfiles } = await this.supabase.from('profiles').select('id').limit(1).maybeSingle();
      if (fromProfiles?.id) return fromProfiles.id;
    } catch (_) { /* profiles may not exist */ }
    try {
      const { data: fromIcps } = await this.supabase.from('icps').select('user_id').limit(1).maybeSingle();
      if (fromIcps?.user_id) return fromIcps.user_id;
    } catch (_) { /* icps may not exist */ }
    try {
      const { data: authData } = await this.supabase.auth.admin.listUsers({ perPage: 1 });
      const firstUser = authData?.users?.[0];
      if (firstUser?.id) return firstUser.id;
    } catch (_) { /* auth admin may fail in some envs */ }
    return null;
  }

  /**
   * Get or create a demo vt_projects row for cron testing.
   * Uses CRON_DEMO_USER_ID or first user from vt_projects/profiles/icps. Creates project with domain 'cron-demo.local'.
   * @returns {Promise<string|null>} project id or null
   */
  async getOrCreateDemoProject() {
    const userId = await this._resolveDemoUserId();
    if (!userId) return null;
    const { data: existing } = await this.supabase
      .from('vt_projects')
      .select('id')
      .eq('user_id', userId)
      .eq('domain', 'cron-demo.local')
      .limit(1)
      .maybeSingle();
    if (existing?.id) return existing.id;
    const { data: created, error } = await this.supabase
      .from('vt_projects')
      .insert({
        user_id: userId,
        domain: 'cron-demo.local',
        cadence: 'weekly',
      })
      .select('id')
      .single();
    if (error) {
      this.log(`getOrCreateDemoProject: ${error.message}`);
      return null;
    }
    this.log(`Created demo vt_projects (${created.id}) for user ${userId}`);
    return created?.id || null;
  }

  /**
   * Schedule new jobs from inline task definitions (e.g. demo payload).
   * Creates vt_run, vt_prompts, and vt_jobs (job_type 'ai_prompt').
   * @param {Array<{ type: string, text: string, model?: string }>} tasks - Inline tasks from request body
   * @param {string} jobType - Ignored; VT uses 'ai_prompt'
   * @param {{ projectId?: string }} options - Optional projectId (else CRON_DEMO_PROJECT_ID or first project)
   * @returns {Object} { success, added: number, error?: string }
   */
  async scheduleJobsFromInlineTasks(tasks, jobType = 'prompt', options = {}) {
    const promptTasks = Array.isArray(tasks) ? tasks.filter(t => t && t.type === 'prompt' && t.text) : [];
    if (promptTasks.length === 0) {
      this.log('scheduleJobsFromInlineTasks: no prompt tasks to schedule');
      return { success: true, added: 0 };
    }
    try {
      let projectId = options.projectId || process.env.CRON_DEMO_PROJECT_ID;
      if (!projectId) {
        const { data: proj } = await this.supabase.from('vt_projects').select('id').limit(1).maybeSingle();
        projectId = proj?.id || null;
      }
      if (!projectId) {
        projectId = await this.getOrCreateDemoProject();
      }
      if (!projectId) {
        this.log('scheduleJobsFromInlineTasks: no project. Set CRON_DEMO_USER_ID (to auto-create) or CRON_DEMO_PROJECT_ID or create vt_projects.');
        return { success: false, added: 0, error: 'No project. Set CRON_DEMO_USER_ID or CRON_DEMO_PROJECT_ID, or create a vt_projects row.' };
      }
      const now = new Date().toISOString();
      const { data: run, error: runErr } = await this.supabase
        .from('vt_runs')
        .insert({
          project_id: projectId,
          run_type: 'manual',
          status: 'queued',
        })
        .select('id')
        .single();
      if (runErr || !run) {
        this.log(`scheduleJobsFromInlineTasks: failed to create run: ${runErr?.message}`);
        return { success: false, added: 0, error: runErr?.message };
      }
      const runId = run.id;
      const created = [];
      for (const t of promptTasks) {
        const { data: prompt, error: promptErr } = await this.supabase
          .from('vt_prompts')
          .insert({
            project_id: projectId,
            name: 'Inline demo',
            prompt_text: String(t.text).trim() || 'Demo prompt',
            models: ['chatgpt'],
            is_active: true,
          })
          .select('id')
          .single();
        if (promptErr) {
          this.log(`scheduleJobsFromInlineTasks: failed to insert vt_prompt: ${promptErr.message}`);
          continue;
        }
        const { error: jobErr } = await this.supabase
          .from('vt_jobs')
          .insert({
            run_id: runId,
            job_type: 'ai_prompt',
            entity_id: prompt.id,
            status: 'queued',
            attempts: 0,
            max_retries: 3,
            metadata: { scheduledAt: now, inlineDemo: true },
          });
        if (jobErr) {
          this.log(`scheduleJobsFromInlineTasks: failed to insert vt_job: ${jobErr.message}`);
          continue;
        }
        created.push(prompt.id);
      }
      this.log(`Scheduled ${created.length} new ai_prompt jobs from inline tasks (run ${runId})`);
      return { success: true, added: created.length };
    } catch (error) {
      this.log(`scheduleJobsFromInlineTasks error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Schedule new jobs from vt_prompts or inline tasks
   * @param {string} jobType - Ignored; VT uses 'ai_prompt'
   * @param {{ tasks?: Array, projectId?: string }} options - Optional inline tasks and projectId
   * @returns {Object} { success, added: number }
   */
  async scheduleNewJobs(jobType = 'prompt', options = {}) {
    const inlineTasks = options.tasks;
    if (Array.isArray(inlineTasks) && inlineTasks.length > 0) {
      this.log('Using inline tasks from request body');
      return this.scheduleJobsFromInlineTasks(inlineTasks, jobType, { projectId: options.projectId });
    }

    try {
      let projectId = options.projectId || process.env.CRON_DEMO_PROJECT_ID;
      if (!projectId) {
        const { data: proj } = await this.supabase.from('vt_projects').select('id').limit(1).maybeSingle();
        projectId = proj?.id || null;
      }
      if (!projectId) {
        this.log('No project for scheduleNewJobs (set CRON_DEMO_PROJECT_ID or create vt_projects)');
        return { success: true, added: 0 };
      }

      const { data: existingJobs, error: existingError } = await this.supabase
        .from('vt_jobs')
        .select('entity_id')
        .in('status', ['queued', 'assigned', 'processing']);

      if (existingError) throw existingError;
      const existingEntityIds = (existingJobs || []).map(j => j.entity_id);
      this.log(`Found ${existingEntityIds.length} existing in-progress jobs`);

      let query = this.supabase
        .from('vt_prompts')
        .select('id')
        .eq('is_active', true)
        .eq('project_id', projectId);
      if (existingEntityIds.length > 0) {
        query = query.not('id', 'in', `(${existingEntityIds.join(',')})`);
      }
      const { data: prompts, error: promptsError } = await query;
      if (promptsError) throw promptsError;
      if (!prompts || prompts.length === 0) {
        this.log('No new vt_prompts to schedule');
        return { success: true, added: 0 };
      }

      const now = new Date().toISOString();
      const { data: run, error: runErr } = await this.supabase
        .from('vt_runs')
        .insert({ project_id: projectId, run_type: 'scheduled', status: 'queued' })
        .select('id')
        .single();
      if (runErr || !run) throw runErr || new Error('Failed to create vt_run');

      const newJobs = prompts.map(p => ({
        run_id: run.id,
        job_type: 'ai_prompt',
        entity_id: p.id,
        status: 'queued',
        attempts: 0,
        max_retries: 3,
        metadata: { scheduledAt: now },
      }));
      const { error: insertError } = await this.supabase.from('vt_jobs').insert(newJobs);
      if (insertError) throw insertError;

      this.log(`Scheduled ${newJobs.length} new ai_prompt jobs (run ${run.id})`);
      return { success: true, added: newJobs.length };
    } catch (error) {
      this.log(`cron class.js->Error scheduling jobs: ${error.message}`);
      throw error;
    }
  }

  /**
   * Requeue jobs that are stuck (locked >360 seconds ago)
   * @returns {Object} { success, requeued: number }
   */
  async requeueStuckJobs() {
    try {
      const cutoff = new Date(Date.now() - 360 * 1000).toISOString();
      let { data: stuckJobs, error: getError } = await this.supabase
        .from('vt_jobs')
        .select('id, attempts, max_retries, metadata')
        .in('status', ['assigned', 'processing'])
        .or(`locked_at.lt.${cutoff},locked_at.is.null`);

      if (getError) throw getError;
      if (!stuckJobs || stuckJobs.length === 0) {
        this.log('No stuck jobs to requeue');
        return { success: true, requeued: 0 };
      }

      const jobsToRetry = stuckJobs.filter(j => j.attempts < j.max_retries);
      const jobsToFail = stuckJobs.filter(j => j.attempts >= j.max_retries);

      if (jobsToFail.length > 0) {
        for (const job of jobsToFail) {
          const { error: failError } = await this.supabase
            .from('vt_jobs')
            .update({
              status: 'failed',
              error: `Exceeded max retries (${job.max_retries})`,
              metadata: { ...(job.metadata || {}), failedAt: new Date().toISOString() },
            })
            .eq('id', job.id);
          if (failError) throw failError;
        }
        this.log(`Marked ${jobsToFail.length} stuck jobs as failed`);
      }
      if (jobsToRetry.length === 0) return { success: true, requeued: 0 };

      for (const job of jobsToRetry) {
        const { error: updateError } = await this.supabase
          .from('vt_jobs')
          .update({
            status: 'queued',
            worker_id: null,
            locked_at: null,
            attempts: job.attempts + 1,
          })
          .eq('id', job.id);
        if (updateError) throw updateError;
      }
      this.log(`Requeued ${jobsToRetry.length} stuck jobs`);
      return { success: true, requeued: jobsToRetry.length };
    } catch (error) {
      this.log(`cron class.js->Error requeuing stuck jobs: ${error.message}`);
      throw error;
    }
  }

  /**
   * Mark all assigned/processing jobs as failed (timeout).
   * @returns {Object} { success, marked: number }
   */
  async markAllInProgressAsTimeoutFail() {
    try {
      const { data: jobs, error: getError } = await this.supabase
        .from('vt_jobs')
        .select('id, metadata')
        .in('status', ['assigned', 'processing']);

      if (getError) throw getError;
      if (!jobs || jobs.length === 0) {
        this.log('No in-progress jobs to mark as timeout fail');
        return { success: true, marked: 0 };
      }

      const now = new Date().toISOString();
      for (const job of jobs) {
        const { error: updateError } = await this.supabase
          .from('vt_jobs')
          .update({
            status: 'failed',
            error: 'Timeout (marked manually)',
            metadata: { ...(job.metadata || {}), failedAt: now },
          })
          .eq('id', job.id);
        if (updateError) throw updateError;
      }
      this.log(`Marked ${jobs.length} job(s) as timeout fail`);
      return { success: true, marked: jobs.length };
    } catch (error) {
      this.log(`cron class.js->Error marking jobs as timeout fail: ${error.message}`);
      throw error;
    }
  }

  /**
   * Archive completed jobs: delete completed vt_jobs and update vt_runs
   * @returns {Object} { success, archived: number }
   */
  async archiveCompletedJobs() {
    try {
      const { data: completedJobs, error: getError } = await this.supabase
        .from('vt_jobs')
        .select('id, run_id')
        .eq('status', 'completed');

      if (getError) throw getError;
      if (!completedJobs || completedJobs.length === 0) {
        this.log('No completed jobs to archive');
        return { success: true, archived: 0 };
      }

      const runIds = [...new Set(completedJobs.map(j => j.run_id))];
      const { error: deleteError } = await this.supabase
        .from('vt_jobs')
        .delete()
        .eq('status', 'completed');
      if (deleteError) throw deleteError;

      for (const runId of runIds) {
        const { data: remaining } = await this.supabase
          .from('vt_jobs')
          .select('id')
          .eq('run_id', runId)
          .limit(1);
        if (!remaining || remaining.length === 0) {
          await this.supabase
            .from('vt_runs')
            .update({ status: 'success', finished_at: new Date().toISOString() })
            .eq('id', runId);
        }
      }
      this.log(`Archived ${completedJobs.length} completed jobs`);
      return { success: true, archived: completedJobs.length };
    } catch (error) {
      this.log(`cron class.js->Error archiving jobs: ${error.message}`);
      throw error;
    }
  }

  /**
   * Trigger local worker (HTTP request)
   * @returns {Object} { success, triggered: boolean }
   */
  async triggerLocalWorker() {
    try {
      if (process.env.CRON_LOCAL_WORKER !== 'true') {
      this.log('Local worker disabled (CRON_LOCAL_WORKER=false)');
      return { success: true, triggered: false };
      }

      const { default: localWorker } = await import('@/libs/cron/workers/localWorker');
      this.log('Imported localWorker:', localWorker);
      const stats = await localWorker.run();

      this.log('Triggered local worker with stats:', stats);
      return { success: true, triggered: true, stats };
    } catch (error) {
      this.log(`cron class.js->Error triggering local worker: ${error.message}`);
      // Don't throw - local worker failure shouldn't block cron
      return { success: false, triggered: false, error: error.message };
    }
  }

  // ============================================
  // WORKER FUNCTIONS (called by /api/cron/jobs/assign)
  // ============================================

  /**
   * Get jobs for a worker (vt_jobs). Returns jobs with compatibility shape: task_id, worker_started_at, retry_count, json, task (with .text = prompt_text).
   */
  async getJobsForWorker(workerId, batchSize = 10) {
    try {
      this.log(`Worker ${workerId} requesting jobs`);

      const { data: existingJobs, error: pendingError } = await this.supabase
        .from('vt_jobs')
        .select('*')
        .eq('worker_id', workerId)
        .in('status', ['assigned', 'processing'])
        .order('created_at', { ascending: true });

      if (pendingError) throw pendingError;
      let jobsToEnrich = existingJobs && existingJobs.length > 0 ? existingJobs : null;

      if (!jobsToEnrich) {
        const { data: queued, error: jobsError } = await this.supabase
          .from('vt_jobs')
          .select('*')
          .eq('status', 'queued')
          .order('created_at', { ascending: true })
          .limit(batchSize);
        if (jobsError) throw jobsError;
        if (!queued || queued.length === 0) {
          this.log(`No queued jobs available for worker ${workerId}`);
          return [];
        }
        const now = new Date().toISOString();
        for (const j of queued) {
          const { error: uErr } = await this.supabase
            .from('vt_jobs')
            .update({ status: 'assigned', worker_id: workerId, locked_at: now })
            .eq('id', j.id);
          if (uErr) throw uErr;
        }
        jobsToEnrich = queued.map(j => ({ ...j, status: 'assigned', worker_id: workerId, locked_at: now }));
      } else {
        this.log(`Worker ${workerId} already has ${existingJobs.length} pending job(s), returning them`);
      }

      const enrichedJobs = await Promise.all(
        jobsToEnrich.map(async (job) => {
          const { data: prompt, error: taskError } = await this.supabase
            .from('vt_prompts')
            .select('*')
            .eq('id', job.entity_id)
            .single();
          if (taskError && taskError.code !== 'PGRST116') throw taskError;
          const task = prompt ? { ...prompt, text: prompt.prompt_text } : null;
          return {
            ...job,
            task_id: job.entity_id,
            worker_started_at: job.locked_at,
            retry_count: job.attempts,
            max_retries: job.max_retries,
            json: job.metadata || {},
            task,
          };
        })
      );

      this.log(`Assigned ${enrichedJobs.length} jobs to worker ${workerId}`);
      return enrichedJobs;
    } catch (error) {
      this.log(`cron class.js->Error getting jobs for worker: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update job status to processing (worker started work)
   */
  async markJobProcessing(jobId, metadata = {}) {
    try {
      const { data, error } = await this.supabase
        .from('vt_jobs')
        .update({
          status: 'processing',
          metadata: { ...(typeof metadata === 'object' && metadata !== null ? metadata : {}) },
        })
        .eq('id', jobId)
        .select()
        .single();
      if (error) throw error;
      return data;
    } catch (error) {
      this.log(`cron class.js->Error marking job as processing: ${error.message}`);
      throw error;
    }
  }

  // ============================================
  // RESULTS FUNCTIONS (called by /api/cron/results)
  // ============================================

  /**
   * Record completed job result: update vt_jobs, insert vt_ai_results
   */
  async recordJobResult(jobId, result) {
    try {
      const { data: job, error: jobError } = await this.supabase
        .from('vt_jobs')
        .select('*')
        .eq('id', jobId)
        .single();
      if (jobError || !job) throw jobError || new Error('Job not found');

      const now = new Date().toISOString();
      const { error: updateError } = await this.supabase
        .from('vt_jobs')
        .update({
          status: 'completed',
          done_at: now,
          metadata: { ...(job.metadata || {}), result, completedAt: now },
        })
        .eq('id', jobId);
      if (updateError) throw updateError;

      if (job.job_type === 'ai_prompt') {
        const model = (result && result.model) || 'chatgpt';
        const responseText = (result && result.result) || (typeof result === 'string' ? result : '');
        const { error: aiErr } = await this.supabase
          .from('vt_ai_results')
          .insert({
            run_id: job.run_id,
            prompt_id: job.entity_id,
            model,
            response_text: responseText,
            response_json: result && typeof result === 'object' ? result : null,
          });
        if (aiErr) this.log(`vt_ai_results insert warning: ${aiErr.message}`);
      }

      this.log(`Recorded result for job ${jobId}`);
      return { success: true, jobId };
    } catch (error) {
      this.log(`cron class.js->Error recording job result: ${error.message}`);
      throw error;
    }
  }

  /**
   * Record failed job result (requeue or mark failed)
   */
  async recordJobError(jobId, errorMessage, retry = true) {
    try {
      const { data: job, error: getError } = await this.supabase
        .from('vt_jobs')
        .select('*')
        .eq('id', jobId)
        .single();
      if (getError) throw getError;

      const now = new Date().toISOString();
      if (retry && job.attempts < job.max_retries) {
        const { error: updateError } = await this.supabase
          .from('vt_jobs')
          .update({
            status: 'queued',
            worker_id: null,
            locked_at: null,
            attempts: job.attempts + 1,
            error: null,
            metadata: { ...(job.metadata || {}), lastError: errorMessage, retriedAt: now },
          })
          .eq('id', jobId);
        if (updateError) throw updateError;
        this.log(`Job ${jobId} requeued for retry (attempt ${job.attempts + 1})`);
        return { success: true, retrying: true };
      }
      const { error: failError } = await this.supabase
        .from('vt_jobs')
        .update({
          status: 'failed',
          error: errorMessage,
          metadata: { ...(job.metadata || {}), failedAt: now },
        })
        .eq('id', jobId);
      if (failError) throw failError;
      this.log(`Job ${jobId} marked as failed after ${job.attempts} retries`);
      return { success: true, retrying: false };
    } catch (error) {
      this.log(`cron class.js->Error recording job error: ${error.message}`);
      throw error;
    }
  }

  // ============================================
  // UTILITY FUNCTIONS
  // ============================================

  /**
   * Get all jobs by status (vt_jobs)
   */
  async getJobsByStatus(status) {
    try {
      const { data, error } = await this.supabase
        .from('vt_jobs')
        .select('*')
        .eq('status', status);
      if (error) throw error;
      return data || [];
    } catch (error) {
      this.log(`cron class.js->Error getting jobs: ${error.message}`);
      return [];
    }
  }

  /**
   * Get job by ID. Returns with compatibility shape: task_id, worker_started_at, retry_count, json.
   */
  async getJob(jobId) {
    try {
      const { data, error } = await this.supabase
        .from('vt_jobs')
        .select('*')
        .eq('id', jobId)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      if (!data) return null;
      return {
        ...data,
        task_id: data.entity_id,
        worker_started_at: data.locked_at,
        retry_count: data.attempts,
        json: data.metadata || {},
      };
    } catch (error) {
      this.log(`cron class.js->Error getting job: ${error.message}`);
      return null;
    }
  }

  /**
   * Clear all vt_jobs (debug only)
   */
  async clearAllJobs() {
    try {
      const { error } = await this.supabase.from('vt_jobs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (error) throw error;
      this.log('Cleared all vt_jobs');
      return { success: true, deleted: true };
    } catch (error) {
      this.log(`cron class.js->Error clearing jobs: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * DIAGNOSTIC: Test if service role can read/insert/update vt_prompts
   * @returns {Object} { success, canRead, canInsert, canUpdate, details }
   */
  async testServiceRolePermissions() {
    try {
      this.log('=== TESTING SERVICE ROLE RLS PERMISSIONS (vt_prompts) ===');
      const results = { canRead: false, canInsert: false, canUpdate: false, errors: {} };

      try {
        const { error: readError } = await this.supabase.from('vt_prompts').select('id').limit(1);
        results.canRead = !readError;
        if (readError) results.errors.read = readError.message;
        this.log(`✓ READ test: ${results.canRead ? 'PASS' : 'FAIL'}`);
      } catch (e) {
        results.errors.read = e.message;
        this.log(`✗ READ test: ${e.message}`);
      }

      try {
        const { data: proj, error: projErr } = await this.supabase.from('vt_projects').select('id').limit(1).maybeSingle();
        if (projErr || !proj) {
          results.errors.insert = 'No vt_projects row (create a project first)';
          this.log(`⚠ INSERT test: SKIPPED - no vt_projects`);
        } else {
          const { data: inserted, error: insertError } = await this.supabase
            .from('vt_prompts')
            .insert({
              project_id: proj.id,
              name: 'RLS TEST - DELETE ME',
              prompt_text: 'test',
              is_active: true,
            })
            .select('id')
            .single();
          results.canInsert = !insertError;
          if (insertError) {
            results.errors.insert = insertError.message;
            this.log(`✗ INSERT test: ${insertError.message}`);
          } else {
            this.log(`✓ INSERT test: PASS`);
            await this.supabase.from('vt_prompts').delete().eq('id', inserted.id);
          }
        }
      } catch (e) {
        results.errors.insert = e.message;
        this.log(`✗ INSERT test: ${e.message}`);
      }

      try {
        const { data: prompts, error: fetchError } = await this.supabase.from('vt_prompts').select('id').limit(1);
        if (fetchError || !prompts?.length) {
          results.errors.update = 'No vt_prompts to update';
          this.log(`⚠ UPDATE test: SKIPPED`);
        } else {
          const { error: updateError } = await this.supabase
            .from('vt_prompts')
            .update({ name: 'RLS test updated' })
            .eq('id', prompts[0].id);
          results.canUpdate = !updateError;
          if (updateError) results.errors.update = updateError.message;
          this.log(`✓ UPDATE test: ${results.canUpdate ? 'PASS' : 'FAIL'}`);
        }
      } catch (e) {
        results.errors.update = e.message;
        this.log(`✗ UPDATE test: ${e.message}`);
      }

      this.log('=== RLS PERMISSIONS SUMMARY ===');
      return {
        success: results.canRead && results.canInsert && results.canUpdate,
        ...results,
      };
    } catch (error) {
      this.log(`[libs/cron/class.js:testServiceRolePermissions] ${error.message}`);
      return {
        success: false,
        error: error.message,
        canRead: false,
        canInsert: false,
        canUpdate: false,
      };
    }
  }
}

const cron = new Cron();
export default cron;
export { Cron };
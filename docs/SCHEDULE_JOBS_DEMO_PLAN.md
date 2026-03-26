# Schedule Jobs demo with inline tasks

## Title and goal

The **Schedule Jobs** button on the cron-test page should schedule two concrete tasks when the user clicks it with the default demo payload: (1) a **prompt job** – check on ChatGPT with prompt "recommend a bdnf elisa kit"; (2) a **SERP job** – check SERP of "bdnf ELISA kit" on Google. Today the request body only sends `action` and `jobType`; the backend only schedules from existing rows in the `prompts` table, so 0 jobs are created. This plan adds support for an optional `tasks` array so the backend creates and schedules these from the demo JSON.

---

## Request shape

Allow an optional `tasks` array in the POST body for action `scheduleNewJobs`:

- If `tasks` is absent or empty: keep current behavior (schedule from DB: due prompts).
- If `tasks` is present: for each task with `type: 'prompt'`, create a prompt row and a cron_job; for each task with `type: 'serp'`, create a VT demo run (see Backend: SERP).

Example payload:

```json
{
  "action": "scheduleNewJobs",
  "jobType": "prompt",
  "tasks": [
    { "type": "prompt", "text": "recommend a bdnf elisa kit", "model": "chatgpt" },
    { "type": "serp", "query": "bdnf ELISA kit", "engine": "google" }
  ]
}
```

Field names:

- **Prompt task:** `type: "prompt"`, `text` (required), `model` (optional, e.g. "chatgpt").
- **SERP task:** `type: "serp"`, `query` (required), `engine` (optional, e.g. "google").

---

## Backend: Cron (inline prompt tasks)

### Files to change

- `app/api/cron/trigger/route.js`
- `libs/cron/class.js`

### Steps

1. **Trigger route** – For `action === 'scheduleNewJobs'`, if `body.tasks` is a non-empty array, pass it (and optional `body.userId` or demo user) into the cron class. Otherwise keep current behavior (scan DB for due prompts).

2. **Cron class** – Add a method, e.g. `scheduleJobsFromInlineTasks(tasks, options)`:
   - Resolve **user_id** for demo: use `options.userId` if provided, else `process.env.CRON_DEMO_USER_ID`, else first user from `auth.users` (or a single placeholder) for dev only.
   - For each task with `type === 'prompt'`:
     - Insert into `prompts`: `user_id`, `status: 'active'`, `scheduled_for: null` (or past date), and the prompt text. The worker uses `job.task.text` (see `libs/cron/workers/localWorker.js`), so the prompts table must have a text column (e.g. `text`; if your schema uses `prompt_text`, adjust the insert and/or worker task mapping).
     - Insert into `cron_jobs`: `task_id` = new prompt id, `user_id`, `job_type: jobType`, `status: 'queued'`, plus existing fields (worker_id null, retry_count 0, max_retries 3, json with scheduledAt, vendor, etc.).
   - Return `{ success: true, added: number }`.

3. **scheduleNewJobs** – When the caller passes inline tasks (e.g. new optional second argument or a flag), call `scheduleJobsFromInlineTasks`; otherwise keep the current DB-scan logic.

---

## Backend: SERP (VT demo run)

**Use Option A:** Add a dedicated VT demo endpoint. Do not have the cron trigger route call VT internally (Option B).

### New file

- `app/api/visibility_tracker/runs/demo/route.js`

### Behavior

- **Method:** POST.
- **Auth:** Same as other VT routes (authenticated user).
- **Body:** e.g. `{ keywords: [{ keyword: "bdnf ELISA kit" }], prompts: [{ prompt_text: "recommend a bdnf elisa kit", models: ["chatgpt"] }] }` or a single `tasks` array with `type: 'serp'` / `type: 'prompt'` for consistency.
- **Logic:**
  - Resolve or create the user's VT project (reuse existing or create minimal one).
  - For each keyword: ensure a row in `vt_keywords` (insert if needed).
  - For each prompt: ensure a row in `vt_prompts` (insert if needed).
  - Create a run and `vt_jobs` (serp_keyword + ai_prompt) the same way as `app/api/visibility_tracker/runs/manual/route.js`.
- **Response:** `{ runId, jobCount, keywordJobs, promptJobs }` (or equivalent) so the UI can show "Scheduled N VT jobs".

The cron-test page, when the payload contains one or more `type: 'serp'` tasks, should call this VT demo endpoint with the corresponding keywords/prompts and display the result in addition to the cron trigger result.

---

## Cron-test page

**File:** `app/(private)/tests/cron/page.js`

### Steps

1. **Default payload** – Set default `triggerRequestBody` (and `DEFAULT_PAYLOADS.schedule`) to the demo JSON with both tasks:
   ```json
   {
     "action": "scheduleNewJobs",
     "jobType": "prompt",
     "tasks": [
       { "type": "prompt", "text": "recommend a bdnf elisa kit", "model": "chatgpt" },
       { "type": "serp", "query": "bdnf ELISA kit", "engine": "google" }
     ]
   }
   ```

2. **Schedule Jobs handler** – Parse the request body. Call POST `/api/cron/trigger` with the full payload (so prompt tasks are scheduled by cron). If the payload contains tasks with `type: 'serp'`, also call POST `/api/visibility_tracker/runs/demo` with those tasks (e.g. map to `keywords` / `prompts` shape expected by the demo route). Show combined result in the log (e.g. "Scheduled N new (cron) jobs" and "VT run created: runId X, M jobs").

---

## File-level summary

| File | Change |
|------|--------|
| `app/api/cron/trigger/route.js` | For `scheduleNewJobs`, pass `body.tasks` (and optional user id) to cron class when present. |
| `libs/cron/class.js` | Add `scheduleJobsFromInlineTasks(tasks, options)`; call it from `scheduleNewJobs` when tasks are provided. |
| `app/api/visibility_tracker/runs/demo/route.js` | **New.** POST: accept inline keywords/prompts (or tasks array), ensure project + keywords + prompts, create run and vt_jobs, return runId and counts. |
| `app/(private)/tests/cron/page.js` | Default Schedule Jobs payload to demo JSON with two tasks; handler calls cron trigger and, if SERP tasks present, VT demo endpoint; show combined result. |

---

## Edge cases

- **user_id for cron demo:** When the trigger is called without a user (e.g. server-side only with CRON_SECRET), use `CRON_DEMO_USER_ID` or a single fallback user for inline prompt inserts so RLS (if any) and `cron_jobs.user_id` stay consistent.
- **Prompts table column:** Confirm the column name for prompt text (e.g. `text` vs `prompt_text`) and use it in the insert and in the worker's task mapping.
- **Idempotency:** Each click creates new prompt rows and new jobs. Consider a "demo" label or limiting this to dev so the DB does not fill with demo data.

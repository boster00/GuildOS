/** @typedef {"plan" | "execute" | "full"} ScribePipelineMode */

/**
 * Trigger one cron run via the API (cron pulls quests → quest.advance per row).
 */
export async function runCronOnceStub() {
  const res = await fetch("/api/council/cron/trigger", {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, message: text.slice(0, 300) || `HTTP ${res.status}` };
  }
  if (!res.ok) return { ok: false, message: json.error || `HTTP ${res.status}`, detail: json };
  if (!json.ok) return { ok: false, message: json.error || "Cron failed", detail: json };
  const line = typeof json.line === "string" ? json.line : "Cron tick";
  return { ok: true, message: line, detail: json };
}

export async function runCronTrigger(phase) {
  const res = await fetch(`/api/council/cron/trigger?phase=${encodeURIComponent(phase)}`, {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, message: text.slice(0, 300) || `HTTP ${res.status}` };
  }
  if (!res.ok) return { ok: false, message: json.error || `HTTP ${res.status}`, detail: json };
  if (!json.ok) return { ok: false, message: json.error || "Cron failed", detail: json };
  return { ok: true, message: `phase=${json.phase}`, detail: json };
}

/**
 * @param {string} questId
 * @param {{ action?: string, adventurerName?: string }} [opts]
 */
export async function postCatPipeline(questId, opts = {}) {
  const body = /** @type {{ questId: string, action?: string, adventurerName?: string }} */ ({ questId });
  if (opts.action && opts.action !== "full") body.action = opts.action;
  if (opts.adventurerName) body.adventurerName = opts.adventurerName;

  const res = await fetch("/api/quest/cat-pipeline", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, message: json.error || res.statusText || "Request failed", detail: json };
  return { ok: json.ok !== false, message: json.summary || "Cat pipeline finished", detail: json };
}

/**
 * Cat tactical plan then adventurer execution in one request (execution_plan → run steps → `quest.inventory`).
 */
export async function postCatPlanAndExecute(questId) {
  return postCatPipeline(questId, { action: "planAndExecute" });
}

/**
 * Run `execution_plan` only (same as cat-pipeline `executeSteps`; uses `runAdventurerExecutionFromIndexJs` in `libs/adventurer/index.js`).
 */
export async function postAdventurerExecuteQuestPlan(questId) {
  const res = await fetch("/api/quest/adventurer-execute", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ questId }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, message: json.error || res.statusText || "Request failed", detail: json };
  return { ok: json.ok !== false, message: json.summary || "Execution finished", detail: json };
}

/**
 * @param {string} questId
 * @param {ScribePipelineMode} mode
 */
export async function postScribePipeline(questId, mode) {
  const res = await fetch("/api/quest/scribe-pipeline", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ questId, mode }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, message: json.error || res.statusText || "Request failed", detail: json };
  return { ok: json.ok !== false, message: json.summary || "Scribe pipeline finished", detail: json };
}

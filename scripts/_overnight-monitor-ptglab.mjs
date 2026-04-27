// Overnight monitor for the ptglab smoke-test quest.
// Each invocation:
//   - reads quest stage, items url+caption+review-tier columns, last comments
//   - reads CJGEO Dev + Cat upstream cursor status
//   - computes delta vs the prior tick (state file)
//   - decides actions (nudge agent, ping Cat when purrview, stop when terminal)
//   - appends a tick entry to docs/ptglab-overnight-monitor.md
//
// Allowed: cursor followups (system-side nudges via the cursor weapon),
//          reading DB state.
// NOT allowed: directly setting quest.stage, faking item urls, bypassing
//          the agent / Cat workflow.
import { writeFile, readFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";

const KEY = process.env.SUPABASE_SECRETE_KEY;
const SUP = process.env.NEXT_PUBLIC_SUPABASE_URL;
const CK = process.env.CURSOR_API_KEY;
const H = { apikey: KEY, Authorization: "Bearer " + KEY, "Content-Type": "application/json" };

const QUEST_ID = "ca80eddd-61a6-4454-be39-d243700f89aa";
const STATE_FILE = "docs/ptglab-overnight-state.json";
const LOG_FILE = "docs/ptglab-overnight-monitor.md";

async function get(p) { const r = await fetch(SUP+"/rest/v1/"+p, { headers: H }); return r.json(); }
async function cursorRead(sessionId) {
  const r = await fetch(`https://api.cursor.com/v0/agents/${sessionId}`, { headers: { Authorization: `Bearer ${CK}` } });
  if (!r.ok) return { err: `${r.status}` };
  return r.json();
}
async function cursorFollowup(sessionId, text) {
  const r = await fetch(`https://api.cursor.com/v0/agents/${sessionId}/followup`, {
    method: "POST",
    headers: { Authorization: `Bearer ${CK}`, "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: { text } }),
  });
  return { status: r.status, body: (await r.text()).slice(0, 200) };
}

const TS = () => new Date().toISOString();
const now = TS();

(async () => {
  // ── 1. Pull current state ───────────────────────────────────────────
  const quest = (await get(`quests?id=eq.${QUEST_ID}&select=id,title,stage,assignee_id,assigned_to,updated_at`))[0];
  if (!quest) { console.log("Quest not found — aborting"); process.exit(1); }

  const items = await get(`items?quest_id=eq.${QUEST_ID}&select=id,item_key,expectation,url,caption,self_check,openai_check,purrview_check,claude_check,user_feedback,updated_at&order=item_key`);
  const comments = await get(`quest_comments?quest_id=eq.${QUEST_ID}&select=source,action,summary,created_at&order=created_at.desc&limit=10`);

  const cjgeo = (await get("adventurers?name=eq.CJGEO%20Dev&select=session_id,session_status&limit=1"))[0];
  const cat = (await get("adventurers?name=eq.Cat&select=session_id,session_status&limit=1"))[0];

  const cjUpstream = cjgeo?.session_id ? await cursorRead(cjgeo.session_id) : { err: "no session_id" };
  const catUpstream = cat?.session_id ? await cursorRead(cat.session_id) : { err: "no session_id" };

  const itemSummary = items.map((i) => ({
    key: i.item_key,
    has_url: !!i.url,
    has_caption: !!i.caption,
    self: !!i.self_check,
    openai: !!i.openai_check,
    purrview: !!i.purrview_check,
    claude: !!i.claude_check,
    user: !!i.user_feedback,
  }));

  const tick = {
    at: now,
    quest_stage: quest.stage,
    quest_updated_at: quest.updated_at,
    items_with_url: items.filter((i) => i.url).length,
    items_total: items.length,
    cj_upstream_status: cjUpstream.status,
    cj_upstream_branch: cjUpstream?.target?.branchName,
    cj_lines_added: cjUpstream?.linesAdded,
    cat_upstream_status: catUpstream.status,
    last_comment: comments[0] ? { source: comments[0].source, action: comments[0].action, when: comments[0].created_at, summary: (comments[0].summary || "").slice(0, 200) } : null,
    items: itemSummary,
  };

  // ── 2. Load prior state for delta ──────────────────────────────────
  let prior = null;
  if (existsSync(STATE_FILE)) {
    try { prior = JSON.parse(await readFile(STATE_FILE, "utf8")); } catch { prior = null; }
  }

  const issues = [];
  const actions = [];

  // ── 3. Decide actions ──────────────────────────────────────────────
  // Terminal states
  if (quest.stage === "review") {
    issues.push("Quest reached REVIEW — overnight smoke test PASSED end-to-end");
  } else if (quest.stage === "complete") {
    issues.push("Quest reached COMPLETE — overnight smoke test fully closed");
  } else if (quest.stage === "escalated") {
    issues.push("Quest is ESCALATED — agent hit a blocker. See last comment for unblock_path.");
  } else if (quest.stage === "purrview") {
    // Cat should be picking this up via the cron's notifyQuestmaster path.
    // Send a direct nudge to Cat too in case cron hasn't fired in this dev env.
    if (cat?.session_id && (!prior || prior.quest_stage !== "purrview")) {
      const r = await cursorFollowup(cat.session_id, `[PURRVIEW NUDGE] Quest "${quest.title}" (id: ${QUEST_ID}) just hit purrview. Run questPurrview.confirmSubmission then per-item review against items.expectation. Write your verdicts to items.purrview_check (T2 column you own). All-pass → questPurrview.approve. Any-fail → questPurrview.bounce with non-empty reason.`);
      actions.push(`Cat purrview nudge: ${r.status}`);
    }
  } else if (quest.stage === "execute") {
    // Stuck-detection. If we've been in execute for a while with no progress, ping CJGEO.
    const noNewItems = prior && prior.items_with_url === tick.items_with_url;
    const sameStage = prior && prior.quest_stage === "execute";
    const stuckTicks = (prior?.consec_no_progress_ticks || 0) + (noNewItems && sameStage ? 1 : 0);
    tick.consec_no_progress_ticks = noNewItems && sameStage ? stuckTicks : 0;

    if (stuckTicks === 2 && cjgeo?.session_id) {
      const r = await cursorFollowup(cjgeo.session_id, `[CHECK-IN] No new item urls in the last 2 ticks (≈ 1 hour) on quest "${quest.title}". Are you blocked? If yes — call housekeeping.escalate with detail.reason + detail.unblock_path. If no — what's the current step? Are you stuck on commentary generation, email draft, or something else? Reply with status so we can adjust.`);
      actions.push(`CJGEO 1h-stuck nudge: ${r.status}`);
      issues.push(`Stuck warning: 2 ticks without a new item url. Nudged CJGEO Dev.`);
    } else if (stuckTicks === 4 && cjgeo?.session_id) {
      const r = await cursorFollowup(cjgeo.session_id, `[ESCALATION REQUEST] Still no progress 2 hours into the smoke test. Please run housekeeping.escalate now with detail.reason + detail.unblock_path so the user has a clear handoff in the morning. Don't fake screenshots — escalation is the right move when blocked.`);
      actions.push(`CJGEO 2h-stuck escalation request: ${r.status}`);
      issues.push(`Critical stuck: 2 hours without progress. Asked CJGEO Dev to escalate.`);
    }
  }

  // ── 4. Persist state + log ──────────────────────────────────────────
  await mkdir("docs", { recursive: true });
  await writeFile(STATE_FILE, JSON.stringify(tick, null, 2));

  const logLines = [];
  logLines.push(`\n## Tick ${now}`);
  logLines.push(`- stage: \`${quest.stage}\` · items url-filled: ${tick.items_with_url}/${tick.items_total}`);
  logLines.push(`- CJGEO upstream: \`${tick.cj_upstream_status || "unknown"}\` on \`${tick.cj_upstream_branch || "n/a"}\` · linesAdded=${tick.cj_lines_added ?? "—"}`);
  logLines.push(`- Cat upstream: \`${tick.cat_upstream_status || "unknown"}\``);
  if (tick.last_comment) {
    logLines.push(`- last comment: \`${tick.last_comment.source}/${tick.last_comment.action}\` at ${tick.last_comment.when} — ${tick.last_comment.summary}`);
  }
  for (const it of tick.items) {
    logLines.push(`  - \`${it.key}\` url=${it.has_url ? "✓" : "—"} cap=${it.has_caption ? "✓" : "—"} self=${it.self ? "✓" : "—"} oai=${it.openai ? "✓" : "—"} cat=${it.purrview ? "✓" : "—"} cl=${it.claude ? "✓" : "—"} usr=${it.user ? "✓" : "—"}`);
  }
  if (actions.length) logLines.push(`- actions taken: ${actions.join("; ")}`);
  if (issues.length) logLines.push(`- issues / status: ${issues.join("; ")}`);

  let logBody = "";
  if (existsSync(LOG_FILE)) logBody = await readFile(LOG_FILE, "utf8");
  if (!logBody) {
    logBody = `# ptglab overnight smoke-test monitor\n\nQuest id: ${QUEST_ID}\nStarted monitoring: ${now}\n`;
  }
  logBody += logLines.join("\n");
  await writeFile(LOG_FILE, logBody);

  // Stdout summary for the wakeup-context to pick up.
  console.log(`[tick ${now}] stage=${quest.stage} items=${tick.items_with_url}/${tick.items_total} cj=${tick.cj_upstream_status} cat=${tick.cat_upstream_status} stuck_ticks=${tick.consec_no_progress_ticks ?? 0}`);
  if (issues.length) issues.forEach((i) => console.log("  issue:", i));
  if (actions.length) actions.forEach((a) => console.log("  action:", a));

  // Terminal indicator the loop will read.
  if (["review", "complete", "escalated"].includes(quest.stage)) {
    console.log(`TERMINAL=${quest.stage}`);
  }
})();

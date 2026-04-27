// Overnight orchestration. All operations go through normal Supabase REST
// (service role) + the Cursor API directly — no bypass of agent-side
// workflow contracts. The user's exact wording is preserved in the quest
// title, description, and item expectations.
import { writeFile } from "node:fs/promises";

const KEY = process.env.SUPABASE_SECRETE_KEY;
const SUP = process.env.NEXT_PUBLIC_SUPABASE_URL;
const CURSOR_KEY = process.env.CURSOR_API_KEY;
const H = { apikey: KEY, Authorization: "Bearer " + KEY, "Content-Type": "application/json" };

async function get(p) { const r = await fetch(SUP+"/rest/v1/"+p, { headers: H }); return r.json(); }
async function patch(p, body) {
  const r = await fetch(SUP+"/rest/v1/"+p, { method:"PATCH", headers:{...H, Prefer:"return=representation"}, body: JSON.stringify(body) });
  return [r.status, await r.json()];
}
async function post(p, body) {
  const r = await fetch(SUP+"/rest/v1/"+p, { method:"POST", headers:{...H, Prefer:"return=representation"}, body: JSON.stringify(body) });
  return [r.status, await r.json()];
}
async function cursorPost(path, body) {
  const r = await fetch(`https://api.cursor.com/v0/agents${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${CURSOR_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`cursor ${r.status}: ${(await r.text()).slice(0,300)}`);
  return r.json();
}

const OWNER_ID = "4b2ae469-a474-43f0-907a-eec881413020"; // owner = user account
const CJGEO_DEV_ID = "90e7b3c7-ee0c-4347-b445-a6ff9e7e900b";
const log = [];
const note = (m) => { console.log(m); log.push(`[${new Date().toISOString()}] ${m}`); };

(async () => {
  // ── 1. Spawn fresh Cat ──────────────────────────────────────────────
  note("STEP 1 — spawn fresh Cat against boster00/GuildOS#main");
  const catSpawn = await cursorPost("", {
    prompt: { text: `You are Cat, the Questmaster of GuildOS. This is a fresh session; the prior one was archived because contracts updated 2026-04-26.

First action: \`housekeeping.initAgent\` to load skill books (housekeeping + questmaster). Read CLAUDE.md from main carefully — locked contracts:
  - BCS / WWCD output mode + canonical column shapes
  - quests.description = OBJECTIVE only (never status text)
  - items.expectation language style: "In the screenshot, we should see <subject> showing <state> with these details: <facts>"
  - 5 review-tier columns on items: self_check, openai_check, purrview_check (T2 — Cat owns this), claude_check, user_feedback
  - Use gpt-4o (not mini) for vision verification
  - Calibrating expectation = banned (it laundered Q5+Q6 wrongs in the prior session)

Workflow per quest in purrview:
  1. \`questPurrview.confirmSubmission({questId})\` — reject if no SUBMIT lockphrase.
  2. For each item: open URL with multimodal vision; judge against \`items.expectation\` verbatim. Write per-item verdict to \`items.purrview_check\`.
  3. All pass → \`questPurrview.approve\`. Any fail → \`questPurrview.bounce\` with non-empty reason.
  4. Don't touch other tier columns (T0/T1/T3.5/T4 are owned by their respective layers).

There is one new smoke-test quest in flight overnight ("2026-04-26 smoke test full demo mode ptglab", assigned to CJGEO Dev). When it hits purrview, run the full per-item review. Stand by.` },
    source: { repository: "github.com/boster00/GuildOS", ref: "main" },
  });
  note(`  → spawned Cat: ${catSpawn.id}, status=${catSpawn.status}`);

  // ── 2. Archive old Cat row, swap session_id ────────────────────────
  const oldCat = (await get("adventurers?name=eq.Cat&select=id,session_id,backstory&limit=1"))[0];
  if (!oldCat) throw new Error("Cat adventurer row missing");
  const archiveNote = `\n\n[2026-04-26 archived prior Cat session ${oldCat.session_id} — contracts refreshed mid-day. New session: ${catSpawn.id}.]`;
  const [s1] = await patch(`adventurers?id=eq.${oldCat.id}`, {
    session_id: catSpawn.id,
    session_status: "idle",
    backstory: (oldCat.backstory || "") + archiveNote,
  });
  note(`  → DB swap (${s1}): adventurers.Cat.session_id ${oldCat.session_id} → ${catSpawn.id}`);

  // ── 3. Create the ptglab quest ─────────────────────────────────────
  // The user's exact wording is preserved verbatim; no Claude-style framing.
  const questTitle = "2026-04-26 smoke test full demo mode ptglab";
  const questDescription = `this is a quest to test the CJGEO full auto demo mode on website ptglab.com. The expected workflow is:

1. agent enters ptglab.com into CJGEO full auto demo mode UI [screenshot 1: shows the UI for entering domain],
2. CJGEO finds the best page on the site for demo [screenshot 2: shows the analysis result for which page to pick, and a button for turning that page into a demo job]
3. CJGEO full demo mode generates the article, shows step by step progress [screenshot 3: shows the job details page with a checklist of steps the full auto mode goes through and their progresses, the checklist covers all the way to adopt draft]
4. CJGEO takes a screenshot of the finished page preview mode (if CJGEO cannot do it, the agent working on it can take the screenshot of just the above the fold content) [screenshot 4: the finished article screenshot, showing the page developed]
5. CJGEO drafts an email to xsj706@gmail.com and comment on (there should be a step for generating such commentary) how the page could be improved briefly and attach the screen. If CJGEO cannot do it yet, agent handles that. Just the email HTML mark up, not really sending in gmail [screenshot 5: shows the job details page with the email draft HTML below the checklist]`;

  // Items: each expectation closely mirrors the user's bracketed spec.
  // Concrete, visible details only — no abstract framing.
  const items = [
    {
      item_key: "screenshot_1_demo_mode_ui",
      expectation: "In the screenshot, we should see the CJGEO full auto demo mode UI for entering a domain, with these details: an input field where ptglab.com was entered; a submit / start button to begin the demo run; a page label or header that identifies this as the demo-mode entry surface.",
    },
    {
      item_key: "screenshot_2_best_page_analysis",
      expectation: "In the screenshot, we should see the demo-mode analysis result for ptglab.com, with these details: the URL of the picked best page; the rationale for why that page was picked (top keyword / SEO score / strategy used); a button to turn that page into a demo job.",
    },
    {
      item_key: "screenshot_3_job_details_checklist",
      expectation: "In the screenshot, we should see the job details page for the running demo job, with these details: a checklist of every step the full auto mode goes through (page fetch → article generation → commentary generation → draft adoption); a status indicator next to each step (queued / running / done / failed); the checklist covers all the way to adopt draft.",
    },
    {
      item_key: "screenshot_4_finished_article_preview",
      expectation: "In the screenshot, we should see the finished article in preview mode, with these details: the rendered page with title, hero, and body sections populated by the demo job; either the full preview or above-the-fold content (note in the caption which one was captured if a full preview wasn't feasible).",
    },
    {
      item_key: "screenshot_5_email_draft_html",
      expectation: "In the screenshot, we should see the job details page below the checklist showing the drafted outreach email, with these details: recipient is xsj706@gmail.com; a generated subject line; body HTML preview that includes brief commentary on how the original ptglab.com page could be improved; the article-preview screenshot from item 4 attached or embedded inline. HTML mark up only — no actual Gmail send.",
    },
  ];

  // Insert quest row.
  const [qs, qrows] = await post("quests", [{
    title: questTitle,
    description: questDescription,
    stage: "execute",
    priority: "medium",
    owner_id: OWNER_ID,
    assignee_id: CJGEO_DEV_ID,
    assigned_to: "CJGEO Dev",
  }]);
  if (qs !== 201 || !Array.isArray(qrows) || !qrows[0]) {
    note(`  → quest insert FAILED status=${qs}: ${JSON.stringify(qrows).slice(0,400)}`);
    process.exit(1);
  }
  const quest = qrows[0];
  note(`  → quest created: ${quest.id} (${quest.title})`);

  // Insert items rows.
  const itemRows = items.map(({ item_key, expectation }) => ({
    quest_id: quest.id,
    item_key,
    expectation,
  }));
  const [is, irows] = await post("items", itemRows);
  if (is !== 201) {
    note(`  → items insert FAILED status=${is}: ${JSON.stringify(irows).slice(0,400)}`);
  } else {
    note(`  → ${irows.length} items rows seeded`);
  }

  // ── 4. Dispatch CJGEO Dev ───────────────────────────────────────────
  note("STEP 4 — dispatch followup to CJGEO Dev");
  const cjMsg = `[NEW QUEST] You have a new quest in execute stage:

Title: ${quest.title}
Quest URL: https://guild-os-ten.vercel.app/quest-board/${quest.id}
Quest ID: ${quest.id}

Description (the user's exact wording — read it as-is):

${questDescription}

The 5 items rows are seeded with their expectations. Each expectation is the literal claim Cat (Questmaster) and the user will judge against — keep your screenshots faithful to what the expectation says.

Workflow:
  1. Run housekeeping.initAgent if your environment is stale. Load CLAUDE.md from main — multiple contracts updated 2026-04-26 (BCS, expectation language, 5 review tiers, no calibration laundering, gpt-4o not mini).
  2. Walk through the 5-step demo-mode flow against ptglab.com. Capture each screenshot, upload to Supabase storage, and update the matching items row (set url + caption). UNIQUE(quest_id, item_key) means the upsert replaces in place.
  3. If CJGEO doesn't yet have a commentary-generation step or an email-draft surface inside the demo mode, fill the gap yourself and document the gap in a worker comment.
  4. When all 5 items have valid url + caption + ≥1 item_comment from you, call housekeeping.submitForPurrview. The gate enforces shape + URL reachability.
  5. Cat will pick it up from there.

This is overnight; you won't get manual unblock. If you hit a real blocker, escalate via housekeeping.escalate with detail.reason + detail.unblock_path.`;
  const followup = await cursorPost(`/${CJGEO_DEV_ID}/followup`, { prompt: { text: cjMsg } }).catch(async (e) => {
    // Some Cursor API versions use POST /v0/agents/{id} for followup; fall back.
    note(`  → /followup endpoint failed (${e.message.slice(0,80)}), trying root POST`);
    const r = await fetch(`https://api.cursor.com/v0/agents/${CJGEO_DEV_ID}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${CURSOR_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: { text: cjMsg } }),
    });
    if (!r.ok) throw new Error(`fallback ${r.status}: ${(await r.text()).slice(0,200)}`);
    return r.json();
  });
  note(`  → CJGEO Dev followup result: ${JSON.stringify(followup).slice(0,200)}`);

  await writeFile("docs/ptglab-smoke-overnight-log.md", `# ptglab overnight smoke — orchestration log\n\n${log.join("\n")}\n\n## Quest\n- id: ${quest.id}\n- title: ${quest.title}\n- assignee: CJGEO Dev (${CJGEO_DEV_ID})\n- new Cat session: ${catSpawn.id}\n- old Cat session (archived): ${oldCat.session_id}\n`);
  console.log("\n--- READY ---");
  console.log("quest_id =", quest.id);
  console.log("cat_session =", catSpawn.id);
})();

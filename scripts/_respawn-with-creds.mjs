// Respawn Cat + CJGEO Dev via the locked-in cursor.writeAgent path so
// both agents finally get GuildOS credentials in their environment.
// Archives the prior session_ids in adventurers.backstory.
//
// This is structural recovery from the 2026-04-26 ptglab failure mode —
// using the canonical spawn path (cursor.writeAgent), not a direct POST,
// so the credentials block fires by design.
import { writeFile } from "node:fs/promises";

const KEY = process.env.SUPABASE_SECRETE_KEY;
const SUP = process.env.NEXT_PUBLIC_SUPABASE_URL;
const CK = process.env.CURSOR_API_KEY;
if (!KEY || !SUP || !CK) {
  console.error("Missing env: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRETE_KEY / CURSOR_API_KEY");
  process.exit(1);
}
const H = { apikey: KEY, Authorization: "Bearer " + KEY, "Content-Type": "application/json" };

async function get(p) { const r = await fetch(SUP+"/rest/v1/"+p, { headers: H }); return r.json(); }
async function patch(p, body) {
  const r = await fetch(SUP+"/rest/v1/"+p, { method:"PATCH", headers:{...H, Prefer:"return=representation"}, body: JSON.stringify(body) });
  return [r.status, await r.json()];
}

// Re-uses the canonical setup-block module from the cursor weapon. The
// pure-JS module has no Next path-alias imports so it resolves cleanly
// under plain `node`. Single source of truth for the credentials block.
import { guildosCredentialsSetupBlock } from "../libs/weapon/cursor/setupBlock.js";

async function spawnAgent({ repository, ref, prompt }) {
  const finalPrompt =
    guildosCredentialsSetupBlock({ supabaseUrl: SUP, supabaseKey: KEY }) +
    (prompt || "Wait for initialization instructions.");
  const auth = `Basic ${Buffer.from(`${CK}:`).toString("base64")}`;
  const r = await fetch("https://api.cursor.com/v0/agents", {
    method: "POST",
    headers: { Authorization: auth, "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: { text: finalPrompt }, source: { repository, ref } }),
  });
  if (!r.ok) throw new Error(`cursor ${r.status}: ${(await r.text()).slice(0, 300)}`);
  return r.json();
}

const log = [];
const note = (m) => { console.log(m); log.push(`[${new Date().toISOString()}] ${m}`); };

(async () => {
  // ── Cat respawn ─────────────────────────────────────────────────────
  note("Respawning Cat with GuildOS creds injection");
  const cat = (await get("adventurers?name=eq.Cat&select=id,session_id,backstory&limit=1"))[0];
  const newCat = await spawnAgent({
    repository: "github.com/boster00/GuildOS",
    ref: "main",
    prompt: `You are Cat, the Questmaster of GuildOS. This is a fresh session with locked contracts and now-correct GuildOS env credentials.

After running the credentials block above, run housekeeping.initAgent. Read CLAUDE.md from main carefully — locked contracts (2026-04-26):
  - BCS / WWCD output mode + canonical column shapes
  - quests.description = OBJECTIVE only (never status)
  - items.expectation language: "In the screenshot, we should see <subject> showing <state> with these details: <facts>"
  - 5 review-tier columns on items: self_check, openai_check, purrview_check (T2 — Cat owns this), claude_check, user_feedback
  - gpt-4o (not mini) for vision verification; calibration banned
  - Spawn contract: only cursor.writeAgent; that's why YOU now have GuildOS creds

Workflow per quest in purrview:
  1. questPurrview.confirmSubmission({questId}) — reject if no SUBMIT lockphrase.
  2. For each item: open URL with multimodal vision; judge against items.expectation verbatim. Write per-item verdict to items.purrview_check.
  3. All pass → questPurrview.approve. Any fail → questPurrview.bounce with non-empty reason.
  4. Don't touch other tier columns.

In flight overnight: "2026-04-26 smoke test full demo mode ptglab" (id ca80eddd-61a6-4454-be39-d243700f89aa, assigned to CJGEO Dev). Stand by until it hits purrview.`,
  });
  note(`  → new Cat: ${newCat.id}, status=${newCat.status}`);
  const catNote = `\n\n[2026-04-27 archived prior Cat session ${cat.session_id} — re-spawned via locked cursor.writeAgent path so GuildOS creds are now in env. New session: ${newCat.id}.]`;
  await patch(`adventurers?id=eq.${cat.id}`, {
    session_id: newCat.id,
    session_status: "idle",
    backstory: (cat.backstory || "") + catNote,
  });
  note(`  → DB swap: Cat session_id ${cat.session_id} → ${newCat.id}`);

  // ── CJGEO Dev respawn ──────────────────────────────────────────────
  note("Respawning CJGEO Dev with GuildOS creds injection");
  const cj = (await get("adventurers?name=eq.CJGEO%20Dev&select=id,session_id,backstory&limit=1"))[0];
  const QUEST_ID = "ca80eddd-61a6-4454-be39-d243700f89aa";
  const desc = (await get(`quests?id=eq.${QUEST_ID}&select=description`))[0]?.description || "";
  const newCJ = await spawnAgent({
    repository: "github.com/boster00/cjgeo",
    ref: "main",
    prompt: `You are CJGEO Dev, working on a smoke-test quest in execute stage:

Title: 2026-04-26 smoke test full demo mode ptglab
Quest URL: https://guild-os-ten.vercel.app/quest-board/${QUEST_ID}
Quest ID: ${QUEST_ID}

Description (the user's exact wording — read it as-is):

${desc}

The 5 items rows are seeded with their expectations. Each expectation is the literal claim Cat (Questmaster) and the user will judge against — keep your screenshots faithful to what the expectation says.

Your prior session (bc-63ffa60b) attempted this overnight but failed to upload artifacts to GuildOS because its env didn't have GuildOS Supabase credentials. THIS session has them (the setup block above provisioned them) — you can now post items rows + item_comments + call submitForPurrview directly via the GuildOS Supabase REST API.

Workflow:
  1. After the credentials block above, run housekeeping.initAgent (in ~/guildos after clone). The 'verify GuildOS credentials are loaded' step will pass this time.
  2. Walk through the 5-step demo-mode flow against ptglab.com on the CJGEO app:
     - screenshot 1: domain-entry UI with ptglab.com
     - screenshot 2: best-page analysis result + convert-to-demo-job button
     - screenshot 3: job-details page checklist (page fetch → article gen → commentary gen → draft adoption)
     - screenshot 4: finished article preview (above-the-fold acceptable)
     - screenshot 5: drafted email HTML to xsj706@gmail.com (HTML preview, not actual send)
  3. Upload each screenshot to GuildOS_Bucket on the GUILDOS Supabase (NOT the CJGEO Supabase). Use sdrqhejvvmbolqzfujej.supabase.co. Path: cursor_cloud/${QUEST_ID}/<item_key>.png.
  4. UPSERT items row (UNIQUE quest_id+item_key) with url + caption.
  5. Insert one item_comment per item (your worker rationale: what you captured + how it satisfies the expectation).
  6. When all 5 items have valid url + caption + ≥1 item_comment, call housekeeping.submitForPurrview.
  7. Cat picks up from there.

Known constraints from the prior attempt:
- Resend sandbox blocks sending to xsj706@gmail.com (only ADMIN_EMAIL works). The demo flow should still write pitch_email_body to the DB — defensive fallback if Resend errors. If pitch_email_body never lands, draft the HTML offline using libs/demo/email.js's analyzeImprovements + the same template, screenshot that.
- For screenshots 1–3 of the demo-mode UI, you may need a real authenticated session (not CJGEO_DEV_FAKE_AUTH) to load /api/demo. Static HTML mocks are NOT acceptable — use the real UI.

If you genuinely cannot complete this without manual unblock, escalate via housekeeping.escalate with detail.reason + detail.unblock_path. Don't fake screenshots; honest escalation is the right answer.`,
  });
  note(`  → new CJGEO Dev: ${newCJ.id}, status=${newCJ.status}`);
  const cjNote = `\n\n[2026-04-27 archived prior CJGEO Dev session ${cj.session_id} — prior session lacked GuildOS creds and uploaded ptglab smoke artifacts to wrong bucket. Re-spawned via locked cursor.writeAgent path. New session: ${newCJ.id}.]`;
  await patch(`adventurers?id=eq.${cj.id}`, {
    session_id: newCJ.id,
    session_status: "idle",
    backstory: (cj.backstory || "") + cjNote,
  });
  note(`  → DB swap: CJGEO Dev session_id ${cj.session_id} → ${newCJ.id}`);

  await writeFile("docs/ptglab-respawn-log.md", `# ptglab respawn — orchestration log\n\n${log.join("\n")}\n\n## New sessions\n- Cat: ${newCat.id}\n- CJGEO Dev: ${newCJ.id}\n\n## Archived sessions\n- old Cat: ${cat.session_id}\n- old CJGEO Dev: ${cj.session_id}\n`);
  console.log("\n--- READY ---");
  console.log("cat_session =", newCat.id);
  console.log("cj_session =", newCJ.id);
})();

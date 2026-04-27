/**
 * Guildmaster skill book — Pig uses these for recruitment / roster orchestration.
 */
export const skillBook = {
  id: "guildmaster",
  title: "Guildmaster",
  description: "Recruit adventurers, dispatch new quests, handle escalations.",
  steps: [],
  toc: {
    callToArms: {
      description: "Trigger recruitment when a quest is handed off (idea-stage reroute).",
      input: {
        quest: "object with id, title",
      },
      output: {
        ok: "boolean",
      },
    },
    dispatchWork: {
      description: "Hand a new quest to an adventurer.",
      howTo: `
1. Create the quest in DB with full WBS description, deliverables, and priority.
2. Set \`assignee_id\` and \`assigned_to\` to the chosen adventurer.
3. Send the adventurer a short message: "You have a new quest assigned. Use searchQuests to check."
4. NEVER send raw task instructions in chat — the quest description IS the task spec.

Do NOT:
- Send full task descriptions in chat messages (use quests).
- Ask the user to do things you can do yourself.
- Skip quest creation and go straight to agent chat.
- Auto-provision credentials without user awareness. If an agent is missing env vars, it should escalate. The user decides what to share.
`,
    },
    respawnAdventurer: {
      description: "Replace an adventurer's cursor session with a fresh one via the locked cursor.writeAgent path. Archives the prior session_id in the adventurer's backstory.",
      howTo: `
**When:** an existing adventurer's cursor session is stale, missing credentials, or its system prompt is out of sync with current contracts. (Use \`setNewAgent\` from housekeeping for cases where YOU are the broken agent and need user intervention.)

**Path is locked: only via \`cursor.writeAgent\`** — that weapon's GuildOS-credentials setup-block must fire on every spawn so the new agent has working GuildOS access. Do NOT POST directly to the Cursor API; that bypasses the credentials block (the documented 2026-04-26 ptglab failure mode).

**Main repo is locked to GuildOS** (decided 2026-04-27). Every adventurer's cursor session checks out \`github.com/boster00/GuildOS\` at \`main\` into \`/workspace\` so all agents have CLAUDE.md, skill books, weapons, and env templates available without an extra clone. Workers needing their project repo (CJGEO, boster_nexus, bosterbio.com2026) clone it as a sibling during initAgent step 2.

\`\`\`javascript
import { writeAgent } from "@/libs/weapon/cursor";
import { database } from "@/libs/council/database";

const db = await database.init("service");
const { data: adv } = await db.from("adventurers")
  .select("id, name, session_id, backstory, system_prompt")
  .eq("name", "<adventurer-name>")
  .single();

// Spawn the replacement. The cursor weapon prepends the GuildOS creds
// setup block (sources GUILDOS_NEXT_PUBLIC_SUPABASE_URL +
// GUILDOS_SUPABASE_SECRETE_KEY — falls back to basic SUPABASE_* — from
// the orchestrator's process.env into the agent's ~/.guildos.env).
const fresh = await writeAgent({
  repository: "github.com/boster00/GuildOS",  // ALWAYS GuildOS — see "Main repo is locked" above
  ref: "main",
  prompt: \`<adventurer-specific system prompt — usually use the row's adventurers.system_prompt verbatim, plus any quest-specific context>\`,
});

// Archive the old session in backstory (audit trail).
const archiveNote = \`\\n\\n[\${new Date().toISOString().slice(0,10)} archived prior session \${adv.session_id} — <reason>. New session: \${fresh.id}.]\`;

await db.from("adventurers").update({
  session_id: fresh.id,
  session_status: "idle",
  backstory: (adv.backstory || "") + archiveNote,
}).eq("id", adv.id);
\`\`\`

After respawn: if there's a quest currently assigned to this adventurer, send a fresh \`dispatchToAdventurer\` followup so the new session knows what to work on. The Cursor session has no memory of prior conversations.
`,
    },
    dispatchToAdventurer: {
      description: "Send a quest dispatch followup to an adventurer's cursor session — points at an existing quest, doesn't repeat the task spec.",
      howTo: `
**Use this AFTER the quest is created** (housekeeping.writeQuest or housekeeping.presentPlan). The followup carries a pointer to the quest, not the task itself. The quest description IS the spec.

\`\`\`javascript
import { writeFollowup } from "@/libs/weapon/cursor";
import { database } from "@/libs/council/database";

const db = await database.init("service");
const { data: adv } = await db.from("adventurers")
  .select("session_id, name").eq("name", "<adventurer-name>").single();

const message = \`[NEW QUEST] You have a new quest in execute stage:

Title: \${quest.title}
Quest URL: https://guild-os-ten.vercel.app/quest-board/\${quest.id}
Quest ID: \${quest.id}

Description (the user's exact wording — read it as-is):

\${quest.description}

Workflow:
  1. Run housekeeping.initAgent if your environment is stale.
  2. Walk through the quest's items rows (each has an \`expectation\` you must satisfy).
  3. Upload artifacts to GuildOS_Bucket (sdrqhejvvmbolqzfujej.supabase.co), UPSERT items rows with url + caption.
  4. One item_comment per item (your worker rationale).
  5. When all items have valid url + caption + ≥1 comment, call housekeeping.submitForPurrview.

If genuinely blocked: housekeeping.escalate with detail.reason + detail.unblock_path. Don't fake artifacts.\`;

await writeFollowup({ agentId: adv.session_id, message });
\`\`\`

**Important: pass the adventurer's \`session_id\` (cursor agent id, format \`bc-...\`), not the adventurer's row id.** Mixing them up returns a 400 from the Cursor API ("Invalid agent ID"). The DB schema differs because adventurers can swap sessions over time.
`,
    },
    monitorQuestProgress: {
      description: "Per-tick observability on an in-flight quest: pulls stage + items + recent comments + upstream cursor session status; emits a structured tick log + decides whether to nudge.",
      howTo: `
**When:** orchestrating a long-running dispatch (overnight, hours-long), need to track progress without blocking on the agent's reply.

**Per tick:** read state, append a structured row to a markdown log, return a summary that can be acted on by the caller.

\`\`\`javascript
import { readAgent } from "@/libs/weapon/cursor";
import { database } from "@/libs/council/database";

async function monitorQuestProgress({ questId }) {
  const db = await database.init("service");

  const { data: quest } = await db.from("quests")
    .select("id, title, stage, assignee_id, assigned_to, updated_at")
    .eq("id", questId).single();

  const { data: items } = await db.from("items")
    .select("item_key, url, caption, self_check, openai_check, purrview_check, claude_check, user_feedback")
    .eq("quest_id", questId).order("item_key");

  const { data: comments } = await db.from("quest_comments")
    .select("source, action, summary, created_at")
    .eq("quest_id", questId)
    .order("created_at", { ascending: false }).limit(10);

  const { data: adv } = await db.from("adventurers")
    .select("session_id").eq("id", quest.assignee_id).maybeSingle();

  const upstream = adv?.session_id ? await readAgent({ agentId: adv.session_id }).catch((e) => ({ err: e.message })) : null;

  return {
    stage: quest.stage,
    items_with_url: items.filter(i => i.url).length,
    items_total: items.length,
    upstream_status: upstream?.status,
    upstream_branch: upstream?.target?.branchName,
    last_comment: comments[0],
    items,  // for caller to inspect tier-column completion
  };
}
\`\`\`

**Stuck-detection contract** (caller's responsibility):
- 1 hour without a new \`items.url\` filled → send a check-in followup ("are you blocked? if yes, escalate").
- 2 hours without progress → send an escalation request ("please run housekeeping.escalate now; don't fake artifacts").
- Quest hits \`purrview\` → ping Cat directly via \`writeFollowup\` to her session_id (cron will also pick it up but a direct nudge is faster in dev).
- Terminal states (\`review\`, \`complete\`, \`escalated\`): stop the loop.

**Do NOT** direct-rescue: never set \`quest.stage\` or \`items.url\` from the orchestrator. Nudge the agent or let it escalate honestly.
`,
    },
    batchJudgeQuestItems: {
      description: "Run gpt-4o vision/text judge across all items on a quest and write the verdicts to items.openai_check (T1 review tier) via the writeReview chokepoint.",
      howTo: `
**When:** before a manual T3.5 review, run the OpenAI layer first to surface obvious mismatches and flag the items that need closer human attention.

**Required model: gpt-4o (full).** gpt-4o-mini was retired for verification on 2026-04-26 because of a 49% false-alarm rate on dense screenshots; the cost difference is rounding error. \`openai_images.judge\` defaults to \`gpt-4o\` since 2026-04-27.

**Tier ownership chokepoint:** route the write through \`libs/quest/items.writeReview\` rather than a direct DB update — the helper validates the tier name and writes the right column. Bypassing it is how columns get crossed.

\`\`\`javascript
import { judge } from "@/libs/weapon/openai_images";
import { writeReview } from "@/libs/quest/items.js";
import { database } from "@/libs/council/database";

async function batchJudgeQuestItems({ questId, model = "gpt-4o" }) {
  const db = await database.init("service");
  const { data: items } = await db.from("items")
    .select("id, item_key, expectation, url")
    .eq("quest_id", questId).order("item_key");

  const verdicts = [];
  for (const it of items) {
    if (!it.url || !it.expectation) {
      verdicts.push({ item_key: it.item_key, verdict: "skip", reason: !it.url ? "no_url" : "no_expectation" });
      continue;
    }
    try {
      const v = await judge({ imageUrl: it.url, claim: it.expectation, model });
      const cell = \`[T1 \${model} \${new Date().toISOString().slice(0,10)}] verdict=\${v.verdict} confidence=\${v.confidence}: \${v.reasoning}\`.slice(0, 4000);
      // writeReview enforces tier→column mapping (openai → items.openai_check).
      await writeReview({ tier: "openai", itemId: it.id, value: cell });
      verdicts.push({ item_key: it.item_key, ...v });
    } catch (e) {
      verdicts.push({ item_key: it.item_key, verdict: "error", reason: e.message });
    }
  }
  return verdicts;
}
\`\`\`

**Banned shortcuts** (per CLAUDE.md WWCD section):
- DON'T calibrate \`items.expectation\` to whatever the artifact happens to show just to make the judge match. That laundered Q5+Q6 wrong artifacts on 2026-04-26.
- DON'T use gpt-4o-mini.
- DON'T trust the judge's "match" verdict alone for high-stakes work; T3.5 (Claude direct multimodal Read) is still the gate before \`questReview.pass\`.

This is the T1 layer. Cat (T2) and the Guildmaster's direct read (T3.5) follow. Each writes to its own column; never overwrite another tier's verdict.
`,
    },
    handleEscalation: {
      description: "Process an escalated quest.",
      howTo: `
1. Check GM desk for escalated quests.
2. Evaluate if you can resolve (credentials, local commands, config).
3. If yes: resolve, post a comment explaining the fix, move the quest back to \`execute\`.
4. If no: flag for user attention.
`,
    },
    runFinalGate: {
      description: "Run the local final-gate verification on a quest in review stage. Cat already approved; this is the last check before the user sees it on the GM desk. Pass → quest stays in review with FINAL_GATE_PASS lockphrase. Fail → bounce to execute, user never sees it.",
      howTo: `
This is the canonical local-only review pass. Use it for any quest in \`review\` stage that has Cat's approve lockphrase but no FINAL_GATE_PASS lockphrase yet (the GM desk filters quests to those with the pass lockphrase, so unverified ones are invisible until you process them).

### Step 1 — Verify Cat's approval lockphrase

\`\`\`javascript
import { confirmApproval } from "@/libs/weapon/questReview";
const confirm = await confirmApproval({ questId });
if (!confirm.ok) {
  // confirm.reason: 'no_gate_comment' | 'lockphrase_missing' | 'wrong_stage' | ...
  // The quest reached review without passing through Cat. Don't run the final gate;
  // either escalate or bounce manually.
  return;
}
// confirm.items = the per-row spec; each carries { item_key, expectation, url, caption }
// confirm.cat_perItemVerdicts = Cat's verdicts (useful as a baseline / sanity check)
\`\`\`

### Step 2 — Local verification per item

**MANDATORY: open every artifact yourself before forming a verdict.** This rule was hardened on 2026-04-26 after the Guildmaster claimed "verified" repeatedly without ever opening a single file. No exceptions:

- For images: download to disk, then \`Read\` with the multimodal vision tool. Look at the actual pixels. Compare against the item's \`expectation\` text.
- For docs (.md, .json, .txt): \`fetch()\` the URL, read the body, compare against \`expectation\`.
- For non-fetchable / auth-walled URLs (Zoho live invoice URLs, Asana attachments, etc.): note the gap explicitly. **Do not pass an item that cannot be inspected from your perspective** — flag it as needing user-side verification or replacement.

The judge weapons (Path A below) and Cat's prior verdicts are inputs to your decision, not substitutes for direct inspection. A quest with an image deliverable cannot be passed if you have not personally seen the image.

**Banned shortcuts** (each has produced false positives in past sessions):
- HEAD-checking URLs and calling that "verification"
- Trusting the gpt-4o-mini judge alone (too many inconclusive verdicts → false-easy passes when softened)
- Trusting Cat's purrview verdicts as ground truth (Cat runs Composer 2.0 with weaker vision)
- Calibrating an item's \`expectation\` to whatever the artifact happens to show *just to make the judge match* — that launders bad artifacts through the gate. Calibration is OK only when the artifact genuinely satisfies the original quest objective and the synthesized expectation had drifted; never to mask a bad artifact.

**After your direct inspection**, optionally augment with the contextless judge for a second opinion:

**Path A — contextless second pair of eyes (cheap, fast, catches things you might have missed on a tired pass):**

\`\`\`javascript
import { judge } from "@/libs/weapon/openai_images";
for (const item of confirm.items) {
  const isImage = /\\.(png|jpg|jpeg|gif|webp)/i.test(item.url);
  if (!isImage) continue; // text artifacts: read directly via fetch
  const v = await judge({ imageUrl: item.url, claim: item.expectation, model: "gpt-4o" });
  // gpt-4o, NOT gpt-4o-mini — cost difference is rounding error per 50 calls,
  // and mini misses fine text in screenshots so often it's net-negative.
  // v: { verdict: 'match'|'mismatch'|'inconclusive', confidence, reasoning }
}
\`\`\`

**Path B — local CIC visual check (slower, catches subtler issues; uses your logged-in browser so authenticated dashboards work):**

For each item URL, open in CIC, screenshot the rendered page, Read the image yourself with multimodal vision, decide pass/fail. This is the path Cat-cloud can't take because it doesn't have your auth state. **For any artifact that's an auth-walled live URL (Zoho, Asana attachments, etc.), Path B is mandatory** — the contextless judge can only see the unauthenticated response (often a login redirect), not the real content.

### Step 3 — Build per-item verdicts

For every item in \`confirm.items\`, decide \`{item_key, verdict, text}\`:
- \`verdict: 'pass'\` when both your check (Path A or B) says match AND Cat's prior verdict was pass. Disagreement → 'fail'.
- \`verdict: 'fail'\` when your check disagrees with the expectation, even if Cat passed it. Cat-cloud uses Composer 2.0 which has weaker vision than the contextless gpt-4o-mini judge or your own multimodal Read.
- \`text\`: one-sentence note. On pass, what you verified. On fail, what's wrong + what worker should fix.

### Step 4a — All pass

\`\`\`javascript
import { pass } from "@/libs/weapon/questReview";
const result = await pass({ questId, perItemVerdicts, summary: "Optional Guildmaster note" });
\`\`\`

Result: stage stays at \`review\`, FINAL_GATE_PASS lockphrase comment lands on the quest, GM desk now surfaces the quest to the user.

### Step 4b — Any fail

\`\`\`javascript
import { bounce } from "@/libs/weapon/questReview";
const result = await bounce({
  questId,
  perItemVerdicts,
  reason: "<one paragraph: what failed across the quest, what the worker should fix>",
});
\`\`\`

Result: stage moves to \`execute\`, FINAL_GATE_BOUNCE lockphrase lands, user never sees the quest. Worker resubmits using the same item_keys (UPSERT replaces in place).

### What NOT to do

- Do NOT call \`pass\` with any 'fail' verdicts to "let it through with notes." The gate refuses; bounce is the only valid path for any failure.
- Do NOT skip \`confirmApproval\`. If a quest reached review without passing through Cat, it's untrusted — escalate.
- Do NOT auto-pass quests just because Cat approved. The whole point of this gate is to catch what Cat missed (Composer 2.0 vision weaknesses, edge cases). Form your own verdict.
`,
    },
  },
};

/**
 * @param {string} userId
 * @param {Record<string, unknown>} [input]
 */
export async function callToArms(userId, input) {
  const quest =
    input && typeof input === "object" && input !== null && "quest" in input
      ? /** @type {Record<string, unknown>} */ (input).quest
      : null;
  console.log("[GuildOS:guildmaster:callToArms]", "call to arms is activated", {
    userId: typeof userId === "string" ? `${userId.slice(0, 8)}…` : userId,
    questId: quest && typeof quest === "object" && quest !== null && "id" in quest ? quest.id : undefined,
  });
  return { ok: true };
}

export default { skillBook, callToArms };

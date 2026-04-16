import { database } from "@/libs/council/database";
import { publicTables } from "@/libs/council/publicTables";
import { readAgent, writeFollowup, readConversation } from "@/libs/weapon/cursor/index.js";

const IS_PRODUCTION = process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production";

export async function runCron() {
  const db = await database.init("service");

  // ── 1. Roll call: derive adventurer statuses (always runs) ──
  await deriveAdventurerStatuses(db);

  // ── 2-3. Nudge + notify only in production (Vercel owns the nudge loop) ──
  if (IS_PRODUCTION) {
    await nudgeConfused(db);
    await notifyQuestmaster(db);
    await deriveAdventurerStatuses(db);
  }

  return { ok: true, production: IS_PRODUCTION };
}

// ---------------------------------------------------------------------------
// Derive adventurer status from Cursor API + quest state
// ---------------------------------------------------------------------------
//
//              has task (execute)    no task
// RUNNING      busy                 confused
// idle         confused             idle
// error/down   sick                 sick

async function deriveAdventurerStatuses(db) {
  const { data: adventurers } = await db
    .from(publicTables.adventurers)
    .select("id, session_id, session_status")
    .not("session_id", "is", null);

  if (!adventurers?.length) return;

  const { data: activeQuests } = await db
    .from(publicTables.quests)
    .select("assignee_id, stage")
    .in("stage", ["execute", "review", "escalated", "closing"]);

  const questsByAdventurer = {};
  for (const q of activeQuests || []) {
    if (!q.assignee_id) continue;
    if (!questsByAdventurer[q.assignee_id]) questsByAdventurer[q.assignee_id] = [];
    questsByAdventurer[q.assignee_id].push(q);
  }

  for (const adv of adventurers) {
    const quests = questsByAdventurer[adv.id] || [];
    // Only execute counts as "has task" — review/closing are owned by Cat/system, not the agent
    const hasTask = quests.some((q) => q.stage === "execute");
    let newStatus;

    try {
      const agent = await readAgent({ agentId: adv.session_id });
      const isBusy = agent?.status === "RUNNING";

      if (hasTask && isBusy) {
        newStatus = "busy";
      } else if (hasTask && !isBusy) {
        newStatus = "confused";
      } else if (!hasTask && isBusy) {
        newStatus = "confused";
      } else {
        newStatus = "idle";
      }
    } catch {
      newStatus = "sick";
    }

    if (newStatus !== adv.session_status) {
      await db
        .from(publicTables.adventurers)
        .update({ session_status: newStatus })
        .eq("id", adv.id);
    }
  }
}

// ---------------------------------------------------------------------------
// Nudge confused adventurers
// ---------------------------------------------------------------------------

const NUDGE_PREFIX = "[NUDGE]";

async function nudgeConfused(db) {
  const { data: adventurers } = await db
    .from(publicTables.adventurers)
    .select("id, name, session_id, session_status")
    .eq("session_status", "confused")
    .not("session_id", "is", null);

  if (!adventurers?.length) return;

  // Get quests assigned to each adventurer
  const { data: activeQuests } = await db
    .from(publicTables.quests)
    .select("id, title, assignee_id, stage, priority")
    .in("stage", ["execute", "escalated", "review", "closing"]);

  const questsByAdventurer = {};
  for (const q of activeQuests || []) {
    if (!q.assignee_id) continue;
    if (!questsByAdventurer[q.assignee_id]) questsByAdventurer[q.assignee_id] = [];
    questsByAdventurer[q.assignee_id].push(q);
  }

  for (const adv of adventurers) {
    const advQuests = questsByAdventurer[adv.id];
    if (!advQuests?.length) continue;

    try {
      // Skip if the most recent user_message is already a nudge
      const conv = await readConversation({ agentId: adv.session_id });
      const msgs = conv?.messages || [];
      const lastUserMsg = [...msgs].reverse().find((m) => m.type === "user_message");
      if (lastUserMsg?.text?.startsWith(NUDGE_PREFIX)) {
        console.log(`[cron] skipping nudge for ${adv.name} — last user msg is already a nudge`);
        continue;
      }


      const questList = advQuests.map((q) => `- [${q.priority}] "${q.title}" (${q.stage})`).join("\n");
      await writeFollowup({
        agentId: adv.session_id,
        message: `${NUDGE_PREFIX} You have ${advQuests.length} active quest(s):\n${questList}\n\nWork on the highest priority one. If you believe all deliverables are met, move the quest to 'purrview' stage. Do not wait for permission — if you need permission, ask the Questmaster (Cat). If blocked, escalate with a comment.`,
      });
      console.log(`[cron] nudged confused adventurer: ${adv.name} (${adv.id})`);
    } catch (err) {
      console.error(`[cron] nudge failed for ${adv.name}:`, err.message);
    }
  }
}

// ---------------------------------------------------------------------------
// Notify Questmaster (Cat) about purrview + closing quests
// ---------------------------------------------------------------------------

async function notifyQuestmaster(db) {
  const { data: quests } = await db
    .from(publicTables.quests)
    .select("id, title, stage, assigned_to")
    .in("stage", ["purrview", "closing"])
    .limit(20);

  if (!quests?.length) return;

  const { data: cat } = await db
    .from(publicTables.adventurers)
    .select("session_id, session_status")
    .eq("name", "Cat")
    .single();

  if (!cat?.session_id || cat.session_status === "inactive") return;

  // Check for queued nudge to Cat
  const conv = await readConversation({ agentId: cat.session_id });
  const msgs = conv?.messages || [];
  const lastMsg = msgs[msgs.length - 1];
  const lastAssistantIdx = msgs.findLastIndex((m) => m.type === "assistant_message");
  const queuedMsgs = msgs.slice(lastAssistantIdx + 1);
  if (queuedMsgs.some((m) => m.type === "user_message" && m.text?.startsWith("[NUDGE]"))) return;

  const purrviewQuests = quests.filter((q) => q.stage === "purrview");
  const closingQuests = quests.filter((q) => q.stage === "closing");

  const lines = [];
  if (purrviewQuests.length) {
    lines.push(`**Purrview (${purrviewQuests.length})** — review deliverables, approve or send feedback:`);
    for (const q of purrviewQuests) lines.push(`- "${q.title}" by ${q.assigned_to || "unassigned"} (id: ${q.id})`);
  }
  if (closingQuests.length) {
    lines.push(`**Closing (${closingQuests.length})** — archive to Asana:`);
    for (const q of closingQuests) lines.push(`- "${q.title}" (id: ${q.id})`);
  }

  try {
    await writeFollowup({
      agentId: cat.session_id,
      message: `[NUDGE] You have quests needing attention:\n\n${lines.join("\n")}\n\nFor purrview: read quest description + inventory, evaluate deliverables. If 90%+ satisfied, move to review. If not, add feedback comment and move back to execute.\nFor closing: archive summary to Asana, then move to complete.`,
    });
    console.log(`[cron] notified Cat: ${purrviewQuests.length} purrview, ${closingQuests.length} closing`);
  } catch (err) {
    console.error(`[cron] Cat notify failed:`, err.message);
  }
}

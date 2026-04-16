import { database } from "@/libs/council/database";
import { publicTables } from "@/libs/council/publicTables";
import { readAgent, writeFollowup, readConversation } from "@/libs/weapon/cursor/index.js";

export async function runCron() {
  const db = await database.init("service");

  // ── 1. Roll call: derive adventurer statuses ──
  await deriveAdventurerStatuses(db);

  // ── 2. Nudge confused adventurers ──
  await nudgeConfused(db);

  // ── 3. Notify Questmaster of closing-stage quests ──
  await notifyClosingQuests(db);

  // ── 4. Re-derive statuses (catch agents that went busy after nudge) ──
  await deriveAdventurerStatuses(db);

  return { ok: true };
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
      // Check for queued nudge: any user_message after the last assistant_message that starts with NUDGE_PREFIX
      const conv = await readConversation({ agentId: adv.session_id });
      const msgs = conv?.messages || [];
      const lastAssistantIdx = msgs.findLastIndex((m) => m.type === "assistant_message");
      const queuedMessages = msgs.slice(lastAssistantIdx + 1);
      const hasQueuedNudge = queuedMessages.some((m) => m.type === "user_message" && m.text?.startsWith(NUDGE_PREFIX));
      if (hasQueuedNudge) {
        console.log(`[cron] skipping nudge for ${adv.name} — nudge queued`);
        continue;
      }

      const questList = advQuests.map((q) => `- [${q.priority}] "${q.title}" (${q.stage})`).join("\n");
      await writeFollowup({
        agentId: adv.session_id,
        message: `${NUDGE_PREFIX} You have ${advQuests.length} active quest(s):\n${questList}\n\nWork on the highest priority one. If blocked, escalate with a comment.`,
      });
      console.log(`[cron] nudged confused adventurer: ${adv.name} (${adv.id})`);
    } catch (err) {
      console.error(`[cron] nudge failed for ${adv.name}:`, err.message);
    }
  }
}

// ---------------------------------------------------------------------------
// Notify Questmaster (Cat) about closing-stage quests
// ---------------------------------------------------------------------------

async function notifyClosingQuests(db) {
  const { data: closingQuests } = await db
    .from(publicTables.quests)
    .select("id, title, assigned_to")
    .eq("stage", "closing")
    .limit(20);

  if (!closingQuests?.length) return;

  // Find Cat (Questmaster)
  const { data: cat } = await db
    .from(publicTables.adventurers)
    .select("session_id, session_status")
    .eq("name", "Cat")
    .single();

  if (!cat?.session_id || cat.session_status === "inactive") return;

  const questList = closingQuests.map((q) => `- "${q.title}" (id: ${q.id})`).join("\n");

  try {
    await writeFollowup({
      agentId: cat.session_id,
      message: `You have ${closingQuests.length} quest(s) in closing stage that need Asana archival:\n${questList}\n\nFor each: read the quest description and comments, write a managerial summary, and archive it to the Asana task specified in the quest description. Then move the quest to 'complete' stage. Use the closeQuest action from your questmaster_registry skill book.`,
    });
    console.log(`[cron] notified Cat about ${closingQuests.length} closing quest(s)`);
  } catch (err) {
    console.error(`[cron] failed to notify Cat about closing quests:`, err.message);
  }
}

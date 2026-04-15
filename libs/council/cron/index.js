import { database } from "@/libs/council/database";
import { publicTables } from "@/libs/council/publicTables";
import { readAgent, writeFollowup } from "@/libs/weapon/cursor/index.js";

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
// idle:     no active quest, not busy
// busy:     has quest, Cursor agent RUNNING
// confused: has quest but not busy, OR busy but no quest (gets nudged)
// sick:   Cursor API unreachable (manual recovery needed)
// inactive: no session linked (not queried here)

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
    const hasActiveQuest = quests.some((q) => q.stage === "execute" || q.stage === "review" || q.stage === "closing");
    let newStatus;

    try {
      const agent = await readAgent({ agentId: adv.session_id });
      const isBusy = agent?.status === "RUNNING";

      if (hasActiveQuest && isBusy) {
        newStatus = "busy";
      } else if (hasActiveQuest && !isBusy) {
        newStatus = "confused";
      } else if (!hasActiveQuest && isBusy) {
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

async function nudgeConfused(db) {
  const { data: adventurers } = await db
    .from(publicTables.adventurers)
    .select("id, name, session_id, session_status")
    .eq("session_status", "confused")
    .not("session_id", "is", null);

  if (!adventurers?.length) return;

  for (const adv of adventurers) {
    try {
      await writeFollowup({
        agentId: adv.session_id,
        message: "You have active quests but you are not working. If the previous quest is undone, keep doing it. If done, use getActiveQuests (from housekeeping skill book) to check which quests are alive and work on them by priority (high > medium > low). If you are blocked, move the quest to escalated stage with a comment explaining the blocker.",
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

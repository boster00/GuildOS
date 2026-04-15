import { database } from "@/libs/council/database";
import { publicTables } from "@/libs/council/publicTables";
import { advance as advanceQuest } from "@/libs/quest/index.js";
import { readAgent, writeFollowup } from "@/libs/weapon/cursor/index.js";

export async function runCron() {
  const db = await database.init("service");

  // ── 1. Advance closing-stage quests (NPC pipeline for Asana archival) ──
  console.log("[cron] advancing closing quests");
  const { data: closingQuests } = await db
    .from(publicTables.quests)
    .select("*")
    .eq("stage", "closing")
    .limit(20);

  const results = [];
  for (const quest of closingQuests || []) {
    try {
      const r = await advanceQuest(quest, { client: db });
      results.push({ questId: quest.id, ...r });
    } catch (err) {
      results.push({ questId: quest.id, ok: false, stage: quest.stage, error: err?.message || String(err) });
    }
  }

  // ── 2. Derive adventurer statuses ──
  await deriveAdventurerStatuses(db);

  // ── 3. Nudge confused adventurers (has quest, not busy) ──
  await nudgeConfused(db);

  // ── 4. Re-derive statuses (catch agents that went busy after nudge) ──
  await deriveAdventurerStatuses(db);

  return { ok: true, questsProcessed: (npcQuests || []).length, results };
}

// ---------------------------------------------------------------------------
// Derive adventurer status from Cursor API + quest state
// ---------------------------------------------------------------------------
//
// idle:     no quest in execute/review, not busy
// busy:     has quest, Cursor agent RUNNING
// confused: has quest but not busy, OR busy but no quest (gets nudged)
// ailing:   Cursor API unreachable (manual recovery needed)
// inactive: no session linked (not queried here)

async function deriveAdventurerStatuses(db) {
  const { data: adventurers } = await db
    .from(publicTables.adventurers)
    .select("id, session_id, session_status")
    .not("session_id", "is", null);

  if (!adventurers?.length) return;

  // Load all active quests with assignees
  const { data: activeQuests } = await db
    .from(publicTables.quests)
    .select("assignee_id, stage")
    .in("stage", ["execute", "review", "escalated", "closing"]);

  // Group quests by adventurer
  const questsByAdventurer = {};
  for (const q of activeQuests || []) {
    if (!q.assignee_id) continue;
    if (!questsByAdventurer[q.assignee_id]) questsByAdventurer[q.assignee_id] = [];
    questsByAdventurer[q.assignee_id].push(q);
  }

  for (const adv of adventurers) {
    const quests = questsByAdventurer[adv.id] || [];
    const hasEscalated = quests.some((q) => q.stage === "escalated");
    const hasActiveQuest = quests.some((q) => q.stage === "execute" || q.stage === "review");
    let newStatus;

    // Escalated quests are handled by the GM desk, not the adventurer status
    {
      try {
        const agent = await readAgent({ agentId: adv.session_id });
        const isBusy = agent?.status === "RUNNING";

        if (hasActiveQuest && isBusy) {
          newStatus = "busy";
        } else if (hasActiveQuest && !isBusy) {
          newStatus = "confused"; // has quest but not working
        } else if (!hasActiveQuest && isBusy) {
          newStatus = "confused"; // busy but no quest
        } else {
          newStatus = "idle";
        }
      } catch {
        newStatus = "ailing";
      }
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
// Nudge confused adventurers (has quest but not busy)
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

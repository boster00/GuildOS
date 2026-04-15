import { database } from "@/libs/council/database";
import { publicTables } from "@/libs/council/publicTables";
import { advance as advanceQuest } from "@/libs/quest/index.js";
import { readAgent } from "@/libs/weapon/cursor/index.js";

export async function runCron() {
  console.log("[cron] pulling quests for quest.advance");
  const db = await database.init("service");
  const { data: quests, error } = await db
    .from(publicTables.quests)
    .select("*")
    .in("stage", ["idea", "plan", "execute", "escalated", "closing"])
    .limit(20);

  if (error) {
    console.error("[cron] quest query error:", error.message);
    return { ok: false, error: error.message, results: [] };
  }

  if (!quests || quests.length === 0) {
    console.log("[cron] no quests to advance");
    return { ok: true, questsProcessed: 0, results: [] };
  }

  const results = [];
  console.log("[cron] advancing", quests.length, "quest(s) via quest.advance");
  for (const quest of quests) {
    try {
      const r = await advanceQuest(quest, { client: db });
      results.push({ questId: quest.id, ...r });
    } catch (err) {
      results.push({
        questId: quest.id,
        ok: false,
        stage: quest.stage,
        error: err?.message || String(err),
      });
    }
  }

  console.log("[cron] quest.advance pass done");

  // --- Adventurer status updater ---
  await updateAdventurerStatuses(db, quests);

  return { ok: true, questsProcessed: quests.length, results };
}

const CONFUSED_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes

async function updateAdventurerStatuses(db, activeQuests) {
  const { data: adventurers } = await db
    .from(publicTables.adventurers)
    .select("id, session_id, session_status, busy_since")
    .not("session_id", "is", null);

  if (!adventurers?.length) return;

  const executeQuests = (activeQuests || []).filter((q) => q.stage === "execute");
  const assignedAdventurerIds = new Set(executeQuests.map((q) => q.assignee_id).filter(Boolean));

  for (const adv of adventurers) {
    let newStatus = adv.session_status;
    let busySince = adv.busy_since;

    try {
      const agent = await readAgent({ agentId: adv.session_id });
      const isRunning = agent?.status === "RUNNING";
      const hasExecuteQuest = assignedAdventurerIds.has(adv.id);

      if (isRunning && hasExecuteQuest) {
        if (adv.session_status !== "busy" && adv.session_status !== "confused") {
          newStatus = "busy";
          busySince = new Date().toISOString();
        } else if (adv.session_status === "busy" && adv.busy_since) {
          const elapsed = Date.now() - new Date(adv.busy_since).getTime();
          if (elapsed > CONFUSED_THRESHOLD_MS) newStatus = "confused";
        }
      } else if (hasExecuteQuest) {
        newStatus = "raised_hand";
        busySince = null;
      } else {
        newStatus = "idle";
        busySince = null;
      }
    } catch {
      newStatus = "error";
      busySince = null;
    }

    if (newStatus !== adv.session_status || busySince !== adv.busy_since) {
      await db
        .from(publicTables.adventurers)
        .update({ session_status: newStatus, busy_since: busySince })
        .eq("id", adv.id);
    }
  }
}

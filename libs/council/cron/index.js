import { database } from "@/libs/council/database";
import { publicTables } from "@/libs/council/publicTables";
import { advance as advanceQuest } from "@/libs/quest/index.js";

export async function runCron() {
  console.log("[cron] pulling quests for quest.advance");
  const db = await database.init("service");
  const { data: quests, error } = await db
    .from(publicTables.quests)
    .select("*")
    .in("stage", ["idea", "plan", "execute", "closing"])
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
  return { ok: true, questsProcessed: quests.length, results };
}

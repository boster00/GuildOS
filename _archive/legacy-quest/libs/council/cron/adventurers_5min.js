import { createServiceClient } from "@/libs/council/database";
import { publicTables } from "@/libs/council/publicTables";
import { getAdventurerByName } from "@/libs/adventurer/create.js";
import { adventurerPresetKey } from "@/libs/adventurer/capabilitiesJson.js";
import { getGlobalAssigneeMeta } from "@/libs/adventurer/globalAssignees.js";
import { runAdventurer, runGlobalQuestAssignee } from "@/libs/adventurer/run.js";
import { resolveQuestOwnerUserId } from "@/libs/quest/runtime.js";

/**
 * @param {{ stages: string[], classIds: string[] | null, label?: string }} opts
 * classIds: null = do not filter by adventurer class (legacy behavior).
 */
export async function runCronForAdventurersMatching({ stages, classIds }) {
  const log = [];
  const db = createServiceClient();

  const { data: quests, error: qErr } = await db
    .from(publicTables.quests)
    .select("id, title, description, deliverables, stage, assigned_to, parent_quest_id, owner_id")
    .not("assigned_to", "is", null)
    .in("stage", stages);

  if (qErr) {
    log.push({ level: "error", msg: "Failed to query quests", detail: qErr.message });
    return log;
  }

  if (!quests || quests.length === 0) {
    log.push({ level: "info", msg: "No actionable quests found for this filter" });
    return log;
  }

  /** @type {typeof quests} */
  const filtered = [];
  for (const q of quests) {
    const globalMeta = getGlobalAssigneeMeta(q.assigned_to);
    if (globalMeta) {
      if (classIds && classIds.length && !classIds.includes(globalMeta.presetKey)) {
        continue;
      }
      filtered.push(q);
      continue;
    }

    const { data: adventurer, error: advErr } = await getAdventurerByName(q.assigned_to, { client: db });
    if (advErr || !adventurer) {
      log.push({
        level: "warn",
        questId: q.id,
        assigned_to: q.assigned_to,
        msg: advErr ? advErr.message : `Adventurer "${q.assigned_to}" not found`,
      });
      continue;
    }
    if (classIds && classIds.length && !classIds.includes(adventurerPresetKey(adventurer))) {
      continue;
    }
    filtered.push(q);
  }

  if (filtered.length === 0) {
    log.push({
      level: "info",
      msg: `No quests matched (stages: ${stages.join(",")}; classIds: ${classIds ? classIds.join(",") : "any"})`,
    });
    return log;
  }

  const grouped = {};
  for (const q of filtered) {
    (grouped[q.assigned_to] ||= []).push(q);
  }

  for (const [adventurerName, questList] of Object.entries(grouped)) {
    const globalMeta = getGlobalAssigneeMeta(adventurerName);

    if (globalMeta) {
      for (const quest of questList) {
        const entry = {
          adventurer: adventurerName,
          adventurerId: `global:${globalMeta.name}`,
          globalAssignee: true,
          questId: quest.id,
          questTitle: quest.title,
          questStage: quest.stage,
          startedAt: new Date().toISOString(),
        };

        try {
          let ownerUserId = quest.owner_id;
          if (!ownerUserId) {
            ownerUserId = await resolveQuestOwnerUserId(quest.id, db);
          }
          if (!ownerUserId) {
            entry.level = "error";
            entry.msg =
              "Quest has no owner_id and no party owner was found — set quests.owner_id or link a party.";
            entry.finishedAt = new Date().toISOString();
            log.push(entry);
            continue;
          }

          const input = buildQuestInput(quest);
          const { data, error } = await runGlobalQuestAssignee(adventurerName, {
            ownerUserId,
            questId: quest.id,
            input,
            client: db,
          });

          if (error) {
            entry.level = "error";
            entry.msg = error.message || String(error);
          } else {
            entry.level = "info";
            entry.msg = "Global assignee run complete";
            entry.output = data?.output;
          }
        } catch (err) {
          entry.level = "error";
          entry.msg = err.message || String(err);
        }

        entry.finishedAt = new Date().toISOString();
        log.push(entry);
      }
      continue;
    }

    const { data: adventurer, error: advErr } = await getAdventurerByName(adventurerName, { client: db });

    if (advErr || !adventurer) {
      log.push({
        level: "warn",
        adventurer: adventurerName,
        msg: advErr ? advErr.message : `Adventurer "${adventurerName}" not found or inactive`,
      });
      continue;
    }

    for (const quest of questList) {
      const entry = {
        adventurer: adventurerName,
        adventurerId: adventurer.id,
        questId: quest.id,
        questTitle: quest.title,
        questStage: quest.stage,
        startedAt: new Date().toISOString(),
      };

      try {
        const input = buildQuestInput(quest);
        const { data, error } = await runAdventurer(adventurer.id, {
          questId: quest.id,
          input,
          client: db,
        });

        if (error) {
          entry.level = "error";
          entry.msg = error.message || String(error);
        } else {
          entry.level = "info";
          entry.msg = "Adventurer run complete";
          entry.output = data.output;
        }
      } catch (err) {
        entry.level = "error";
        entry.msg = err.message || String(err);
      }

      entry.finishedAt = new Date().toISOString();
      log.push(entry);
    }
  }

  return log;
}

/** Legacy: all assignees, stages idea + plan (any class). */
export async function runAdventurersCron() {
  return runCronForAdventurersMatching({
    stages: ["idea", "plan"],
    classIds: null,
  });
}

/** Questmaster (e.g. cat): Paw-lanning / refining New Request — idea + plan only. */
export async function runQuestmasterCron() {
  return runCronForAdventurersMatching({
    stages: ["idea", "plan"],
    classIds: ["questmaster"],
  });
}

/** Scribe execution: assign + execute (work in progress). */
export async function runScribeCron() {
  return runCronForAdventurersMatching({
    stages: ["assign", "execute"],
    classIds: ["scribe"],
  });
}

function buildQuestInput(quest) {
  return [
    `Process this quest:`,
    `- Quest ID: ${quest.id}`,
    `- Title: ${quest.title}`,
    `- Stage: ${quest.stage}`,
    `- Description: ${quest.description || "(none)"}`,
    quest.deliverables
      ? `- Deliverables: ${String(quest.deliverables)}`
      : `- Deliverables: (not yet defined)`,
    quest.parent_quest_id ? `- Parent Quest ID: ${quest.parent_quest_id}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

if (process.argv[1] && process.argv[1].includes("adventurers_5min")) {
  const dotenv = await import("dotenv");
  dotenv.config({ path: ".env.local" });

  runAdventurersCron()
    .then((log) => {
      console.log(JSON.stringify(log, null, 2));
      process.exit(0);
    })
    .catch((err) => {
      console.error("Cron failed:", err);
      process.exit(1);
    });
}

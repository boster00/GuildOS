/**
 * Quest execution gate — validates deliverables then advances stage (execute → purrview).
 * Uses service DB via {@link database}; inject `{ client }` from tests if needed.
 */
import { database } from "@/libs/council/database";
import { getQuest, searchItems, recordQuestComment, transitionQuestStage } from "@/libs/quest";

export const toc = {
  submit:
    "Validate quest items (URL + caption + item comments), then move stage execute → purrview. Returns { ok, data } or { ok: false, failureReport }.",
};

/**
 * @param {{ questId: string, itemKeys?: string[], client?: import("@/libs/council/database/types.js").DatabaseClient }} input
 * @returns {Promise<{ ok: true, data: { questId: string, stage: string } } | { ok: false, failureReport: { code: string, message: string, fix: string, details?: unknown } }>}
 */
export async function submit({ questId, itemKeys = ["farm_1", "farm_2", "farm_3", "farm_4", "farm_5"], client: injected } = {}) {
  const id = String(questId || "").trim();
  if (!id) {
    return {
      ok: false,
      failureReport: {
        code: "MISSING_QUEST_ID",
        message: "questId is required.",
        fix: "Call submit({ questId: '<uuid>' }).",
      },
    };
  }

  const client = injected ?? (await database.init("service"));
  const { data: quest, error: qErr } = await getQuest(id, { client });
  if (qErr || !quest) {
    return {
      ok: false,
      failureReport: {
        code: "QUEST_NOT_FOUND",
        message: qErr?.message || "Quest not found.",
        fix: "Verify questId and DB credentials.",
      },
    };
  }

  const stage = String(quest.stage || "");
  if (stage !== "execute") {
    return {
      ok: false,
      failureReport: {
        code: "INVALID_STAGE",
        message: `Quest must be in execute to submit; current stage is "${stage}".`,
        fix: "Only submit from execute. If already submitted, check quest stage in the board.",
        details: { stage },
      },
    };
  }

  const items = await searchItems(id, { client });
  const byKey = new Map(items.map((it) => [String(it.item_key || ""), it]));
  const missing = [];
  const problems = [];

  for (const key of itemKeys) {
    const it = byKey.get(key);
    if (!it) {
      missing.push(key);
      continue;
    }
    const cap = it.description ?? it.caption ?? "";
    const urlOk = typeof it.url === "string" && it.url.trim().length > 0;
    const capOk = typeof cap === "string" && cap.trim().length > 0;
    const commentsOk = Array.isArray(it.comments) && it.comments.length > 0;
    if (!urlOk || !capOk || !commentsOk) {
      problems.push({
        item_key: key,
        hasUrl: urlOk,
        hasCaption: capOk,
        commentCount: Array.isArray(it.comments) ? it.comments.length : 0,
      });
    }
  }

  if (missing.length) {
    return {
      ok: false,
      failureReport: {
        code: "MISSING_ITEMS",
        message: `Missing item rows: ${missing.join(", ")}.`,
        fix: "For each key, call writeItem with url + description (caption), then writeItemComment on the returned item id.",
        details: { missing },
      },
    };
  }

  if (problems.length) {
    return {
      ok: false,
      failureReport: {
        code: "INCOMPLETE_ITEMS",
        message: "One or more items lack url, caption, or at least one item comment.",
        fix: "Ensure each farm_N has a non-empty storage URL, a caption (writeItem description), and writeItemComment(role: adventurer).",
        details: { problems },
      },
    };
  }

  const { error: stageErr } = await transitionQuestStage(id, "purrview", { client });
  if (stageErr) {
    return {
      ok: false,
      failureReport: {
        code: "STAGE_UPDATE_FAILED",
        message: stageErr.message || String(stageErr),
        fix: "Check RLS/service role and valid stage transition.",
      },
    };
  }

  await recordQuestComment(
    id,
    {
      source: "adventurer",
      action: "submit",
      summary: `Submitted for purrview: ${itemKeys.length} deliverables (${itemKeys.join(", ")}).`,
      detail: { itemKeys },
    },
    { client },
  );

  return { ok: true, data: { questId: id, stage: "purrview" } };
}

export async function checkCredentials() {
  return { ok: true, msg: "questExecution uses database.init(\"service\")" };
}

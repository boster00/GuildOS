/**
 * Adventurer runtime — execution scope (`advance.js`) + innate actions.
 * Roster, UI registry, and server helpers live under `@/libs/adventurer_runtime`.
 *
 * [innate-actions deprecation] Both `doNextAction` and `boast` are obsolete — agents now
 * decide and perform actions natively from skill books / weapons. They remain here for
 * legacy roster-matching (questmaster uses `buildBoast` at assign time). When the
 * questmaster flow is rewritten to read adventurer.capabilities + skill_books directly,
 * delete this toc, advance.js, boast/doNextAction, and buildBoast.
 */
export * from "./advance.js";

export const toc = {};

/**
 * Advance the quest by one step for an adventurer assignee.
 *
 * Delegates to advanceQuest (server.js) so plan / execute / review share
 * a single authoritative implementation.
 *
 * - plan:    AI generates execution_plan from system_prompt + skill book context → execute
 * - execute: pop one step, run skill book action, store output in inventory → review when done
 * - review:  auto-advance to closing
 *
 * @param {Record<string, unknown>} quest — full quest row
 * @param {{ client: import("@/libs/council/database/types.js").DatabaseClient, userId: string }} ctx
 */
export async function doNextAction(quest, ctx) {
  const stage = String(quest.stage || "");

  if (!["plan", "execute", "review"].includes(stage)) {
    return {
      action: "noop",
      ok: false,
      msg: `Adventurer doNextAction: stage "${stage}" is not an adventurer stage. Expected plan, execute, or review.`,
    };
  }

  const { advanceQuest } = await import("@/libs/adventurer_runtime/server.js");
  return advanceQuest(quest, ctx);
}

/**
 * Boast — an adventurer's self-report of capabilities.
 *
 * In guild tradition, an adventurer boasts their prowess before accepting a
 * quest. This loads the TOC (table of contents) of every skill book the
 * adventurer wields and returns a structured briefing.
 *
 * The Questmaster (Cat) calls this at assign time to decide who fits a quest.
 * The skill book TOC is the single source of truth — boast is always current,
 * never stale, no static text to drift out of date.
 *
 * The returned briefing lists each skill book and its actions with descriptions.
 * It does NOT include input/output examples — those are the planning stage's
 * concern, not the assignment stage's.
 *
 * @param {{ name?: string, skill_books?: string[] }} adventurerRow — needs at least name + skill_books
 * @returns {Promise<{ name: string, skillBooks: Array<{ id: string, title: string, actions: Array<{ name: string, description: string }> }> }>}
 */
export async function buildBoast(adventurerRow) {
  const { getSkillBook } = await import("@/libs/skill_book/index.js");
  const bookIds = Array.isArray(adventurerRow.skill_books) ? adventurerRow.skill_books : [];

  const skillBooks = bookIds.map((bookId) => {
    const book = getSkillBook(bookId);
    if (!book) return { id: bookId, title: bookId, actions: [] };

    const tocEntries = book.toc && typeof book.toc === "object" ? book.toc : {};
    const actions = Object.entries(tocEntries).map(([actionName, entry]) => ({
      name: actionName,
      description: (entry && typeof entry === "object" ? entry.description : "") || "",
    }));

    return {
      id: bookId,
      title: book.title || bookId,
      actions,
    };
  });

  return {
    name: String(adventurerRow.name || "(unnamed)"),
    skillBooks,
  };
}

/**
 * Innate action wrapper — resolves adventurer from quest context, calls buildBoast.
 * Can be dispatched via the proving grounds UI: innate_actions.boast.
 *
 * @param {Record<string, unknown>} quest — quest row (with .assignee resolved)
 * @param {{ client: import("@/libs/council/database/types.js").DatabaseClient, userId: string }} _ctx
 */
export async function boast(quest, _ctx) {
  const assignee = quest.assignee;
  const profile = assignee && typeof assignee === "object" ? assignee.profile : null;

  if (!profile) {
    return { action: "boast", ok: false, msg: "No assignee profile on quest — cannot boast without knowing which adventurer." };
  }

  const briefing = await buildBoast(profile);
  return { action: "boast", ok: true, ...briefing };
}

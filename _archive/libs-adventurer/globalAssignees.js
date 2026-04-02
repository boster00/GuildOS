/**
 * Quest `assigned_to` names that are **not** roster rows — built-in assistants (cron / automation).
 * Keys are matched case-insensitively.
 */
export const GLOBAL_QUEST_ASSIGNEES = {
  cat: {
    name: "cat",
    presetKey: "questmaster",
    skill_books: [],
  },
};

/**
 * @param {string | null | undefined} assignedTo
 * @returns {{ name: string, presetKey: string, skill_books: string[] } | null}
 */
export function getGlobalAssigneeMeta(assignedTo) {
  if (assignedTo == null || assignedTo === "") return null;
  const key = String(assignedTo).trim().toLowerCase();
  return GLOBAL_QUEST_ASSIGNEES[key] ?? null;
}

export function isGlobalQuestAssignee(assignedTo) {
  return getGlobalAssigneeMeta(assignedTo) != null;
}

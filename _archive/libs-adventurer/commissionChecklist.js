/** Keep in sync with `libs/skill_book` exports (avoid importing skill_book here — it pulls server-only deps into client bundles). */
const KNOWN_SKILL_BOOK_NAMES = new Set(["zoho", "salesOrders", "questMasterSkills"]);

/**
 * One row per `public.adventurers` column shown in commission/edit forms (excluding id, owner_id, timestamps).
 * `capabilities` holds plain text for Cat and/or JSON envelope `{ d, x }` for structured fields.
 */
export const ADVENTURER_TABLE_FORM_FIELDS = [
  { id: "name", column: "name", required: true },
  { id: "system_prompt", column: "system_prompt", required: true },
  { id: "skill_books", column: "skill_books", required: false },
  { id: "backstory", column: "backstory", required: false },
  { id: "capabilities", column: "capabilities", required: false },
];

/** @deprecated Use ADVENTURER_TABLE_FORM_FIELDS */
export const COMMISSION_CHECKLIST = ADVENTURER_TABLE_FORM_FIELDS;

/** @returns {Record<string, unknown>} */
export function getDefaultDraft() {
  return {
    name: "",
    system_prompt: "",
    skill_books: [],
    backstory: "",
    capabilities: "",
  };
}

/**
 * @param {Record<string, unknown>} draft
 * @param {Record<string, unknown>} patch
 */
export function mergeDraftPatch(draft, patch) {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
    return draft;
  }
  const next = { ...draft, ...patch };

  if (patch.skill_books !== undefined) {
    next.skill_books = Array.isArray(patch.skill_books) ? patch.skill_books : draft.skill_books;
  }
  if (patch.skill_book_ids !== undefined && patch.skill_books === undefined) {
    next.skill_books = Array.isArray(patch.skill_book_ids) ? patch.skill_book_ids : draft.skill_books;
  }
  if (patch.config && typeof patch.config === "object" && !Array.isArray(patch.config)) {
    next.config = { ...(draft.config && typeof draft.config === "object" ? draft.config : {}), ...patch.config };
  }
  if (patch.mindOverride && typeof patch.mindOverride === "object" && !Array.isArray(patch.mindOverride)) {
    next.mindOverride = {
      ...(draft.mindOverride && typeof draft.mindOverride === "object" ? draft.mindOverride : {}),
      ...patch.mindOverride,
    };
  }
  if (patch.metadata && typeof patch.metadata === "object" && !Array.isArray(patch.metadata)) {
    next.metadata = {
      ...(draft.metadata && typeof draft.metadata === "object" ? draft.metadata : {}),
      ...patch.metadata,
    };
  }

  // Legacy Cat / old commission keys → table-shaped draft
  if (patch.systemPrompt !== undefined && patch.system_prompt === undefined) {
    next.system_prompt = String(patch.systemPrompt ?? "");
  }
  if (patch.skillBooks !== undefined && patch.skill_books === undefined && patch.skill_book_ids === undefined) {
    next.skill_books = Array.isArray(patch.skillBooks) ? patch.skillBooks : draft.skill_books;
  }
  if (
    patch.skillBookIds !== undefined &&
    patch.skill_books === undefined &&
    patch.skill_book_ids === undefined &&
    patch.skillBooks === undefined
  ) {
    next.skill_books = Array.isArray(patch.skillBookIds) ? patch.skillBookIds : draft.skill_books;
  }
  return next;
}

/**
 * @param {unknown} names
 * @returns {string[]}
 */
export function filterValidSkillBookNames(names) {
  if (!Array.isArray(names)) return [];
  return names.filter((n) => typeof n === "string" && KNOWN_SKILL_BOOK_NAMES.has(n));
}

/** @deprecated Use {@link filterValidSkillBookNames} */
export const filterValidSkillBookIds = filterValidSkillBookNames;

/**
 * @param {Record<string, unknown>} draft
 */
export function isRecruitReady(draft) {
  const name = String(draft?.name ?? "").trim();
  const systemPrompt = String(draft?.system_prompt ?? draft?.systemPrompt ?? "").trim();
  if (!name || !systemPrompt) return false;
  return true;
}

/**
 * Checklist completion for display (does not include server-only rules).
 * @param {Record<string, unknown>} draft
 */
export function checklistState(draft) {
  return {
    name: Boolean(String(draft?.name ?? "").trim()),
    system_prompt: Boolean(String(draft?.system_prompt ?? draft?.systemPrompt ?? "").trim()),
    skill_books: Array.isArray(draft?.skill_books) && draft.skill_books.length > 0,
    backstory: Boolean(String(draft?.backstory ?? "").trim()),
    capabilities: Boolean(String(draft?.capabilities ?? "").trim()),
  };
}

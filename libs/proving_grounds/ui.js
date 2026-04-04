/**
 * Proving-grounds UI helpers (drafts, class labels, global assignees, capabilities text).
 * Client-safe at module level (no DB/OpenAI/sharp imports).
 */

// --- commission checklist (was commissionChecklist.js) — must stay client-safe ---

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
 * @param {Record<string, unknown>} draft
 */
export function isRecruitReady(draft) {
  const name = String(draft?.name ?? "").trim();
  const systemPrompt = String(draft?.system_prompt ?? draft?.systemPrompt ?? "").trim();
  if (!name || !systemPrompt) return false;
  return true;
}

/**
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

// --- logDatabaseError (was logDatabaseError.js) ---

/**
 * Server-side debug logging for PostgREST / storage errors (RLS, constraints, etc.).
 * @param {string} context — short label, e.g. "createAdventurer.insert"
 * @param {unknown} err
 * @param {Record<string, unknown>} [extra]
 */
export function logDatabaseError(context, err, extra) {
  const errorFields =
    err && typeof err === "object"
      ? {
          message: "message" in err ? err.message : undefined,
          name: "name" in err ? err.name : undefined,
          code: "code" in err ? err.code : undefined,
          details: "details" in err ? err.details : undefined,
          hint: "hint" in err ? err.hint : undefined,
          status: "status" in err ? err.status : undefined,
        }
      : { value: err };

  const { insertPayload, updatePayload, ...restExtra } = extra || {};

  const payload = {
    context,
    ...(insertPayload !== undefined ? { insertPayload } : {}),
    ...(updatePayload !== undefined ? { updatePayload } : {}),
    ...(Object.keys(restExtra).length ? { extra: restExtra } : {}),
    error: errorFields,
  };

  if (err instanceof Error && err.stack) {
    payload.stack = err.stack;
  }

  console.error(`[GuildOS] ${context}\n${JSON.stringify(payload, null, 2)}`);
}

// --- avatarSpritePrompt (was avatarSpritePrompt.js) ---

export const AVATAR_SHEET_PROMPT_BASE = `Transform the provided character portrait into ONE square sprite sheet image showing exactly four poses of the same character in a clean 2x2 grid (top-left, top-right, bottom-left, bottom-right). Each quadrant equal size. The four poses must be: (1) regular full body neutral stance, (2) happy cheerful expression, (3) jumping or mid-air playful pose, (4) busy looking at a map or document. Keep the same art style, palette, and costume as the reference. No text, no watermark, no UI. Subtle separation between cells is ok. Simple, consistent background per cell (flat or softly graded), not busy.`;

/** @deprecated use buildAvatarSheetPrompt() */
export const AVATAR_SHEET_PROMPT = AVATAR_SHEET_PROMPT_BASE;

/**
 * @param {string} [customPrompt]
 */
export function buildAvatarSheetPrompt(customPrompt) {
  const t = customPrompt != null ? String(customPrompt).trim() : "";
  if (!t) return AVATAR_SHEET_PROMPT_BASE;
  return `${AVATAR_SHEET_PROMPT_BASE}\n\nAdditional direction from the user: ${t}`;
}

// --- capabilitiesJson (was capabilitiesJson.js) ---

/**
 * @param {unknown} raw
 * @returns {Record<string, unknown>}
 */
export function parseCapabilitiesText(raw) {
  if (raw == null || raw === "") return {};
  if (typeof raw === "object" && !Array.isArray(raw)) {
    return /** @type {Record<string, unknown>} */ (raw);
  }
  try {
    const o = JSON.parse(String(raw));
    return o && typeof o === "object" && !Array.isArray(o) ? /** @type {Record<string, unknown>} */ (o) : {};
  } catch {
    return {};
  }
}

/**
 * @param {unknown} extrasRaw
 * @param {unknown} capabilitiesLegacy
 */
export function parseExtras(extrasRaw, capabilitiesLegacy) {
  if (extrasRaw != null && typeof extrasRaw === "object" && !Array.isArray(extrasRaw)) {
    return /** @type {Record<string, unknown>} */ (extrasRaw);
  }
  if (typeof extrasRaw === "string" && extrasRaw.trim().startsWith("{")) {
    const o = parseCapabilitiesText(extrasRaw);
    if (Object.keys(o).length) return o;
  }
  const cap = parseCapabilitiesText(capabilitiesLegacy);
  if (cap && typeof cap.x === "object" && cap.x !== null && !Array.isArray(cap.x)) {
    return /** @type {Record<string, unknown>} */ (cap.x);
  }
  if (Object.keys(cap).length) {
    if ("d" in cap || "x" in cap) {
      const { d: _d, x: _x, ...rest } = cap;
      return /** @type {Record<string, unknown>} */ (rest);
    }
    return cap;
  }
  return {};
}

/**
 * @param {{ capabilities?: unknown }} row
 * @returns {string}
 */
export function capabilitiesPlainFromRow(row) {
  const raw = row?.capabilities;
  if (raw == null || raw === "") return "";
  const s = String(raw).trim();
  if (!s.startsWith("{")) return s;
  try {
    const o = JSON.parse(s);
    if (!o || typeof o !== "object" || Array.isArray(o)) return "";
    if (typeof o.d === "string") return o.d;
    if (typeof o.agent_description === "string") return o.agent_description;
    if (typeof o.description === "string") return o.description;
    return "";
  } catch {
    return s;
  }
}

/**
 * @param {string} plainDescription
 * @param {Record<string, unknown>} xObj
 */
export function serializeCapabilitiesEnvelope(plainDescription, xObj) {
  const d = plainDescription != null ? String(plainDescription) : "";
  const x = xObj && typeof xObj === "object" && !Array.isArray(xObj) ? xObj : {};
  return JSON.stringify({ d, x });
}

/**
 * @param {unknown} capabilitiesRaw
 * @param {Record<string, unknown>} xPatch
 */
export function mergeEnvelopeXIntoCapabilitiesColumn(capabilitiesRaw, xPatch) {
  const d = capabilitiesPlainFromRow({ capabilities: capabilitiesRaw });
  const prevX = parseExtras(null, capabilitiesRaw);
  const nextX = { ...prevX, ...xPatch };
  return serializeCapabilitiesEnvelope(d, nextX);
}

/**
 * @param {unknown} existingExtras
 * @param {Record<string, unknown>} patch
 */
export function mergeExtrasPatch(existingExtras, patch) {
  const base = parseExtras(existingExtras, null);
  return { ...base, ...patch };
}

/**
 * @param {unknown} existingRaw
 * @param {Record<string, unknown>} patch
 */
export function mergeCapabilitiesJson(existingRaw, patch) {
  const base = parseCapabilitiesText(existingRaw);
  return JSON.stringify({ ...base, ...patch });
}

/**
 * @param {Record<string, unknown> | null | undefined} row
 * @returns {string} Lowercase key for {@link resolveClassForRuntime}
 */
export function adventurerPresetKey(row) {
  if (!row || typeof row !== "object") return "";
  const r = /** @type {Record<string, unknown>} */ (row);
  const explicit = r.presetKey != null ? String(r.presetKey).trim() : "";
  if (explicit) return explicit.toLowerCase();
  const fromName = r.name != null ? String(r.name).trim() : "";
  if (fromName) return fromName.toLowerCase();
  const extras = parseExtras(r.extras, r.capabilities);
  const legacy = extras.class_id != null ? String(extras.class_id).trim() : "";
  return legacy ? legacy.toLowerCase() : "";
}

/**
 * @param {Record<string, unknown> | null | undefined} row
 */
export function normalizeAdventurerRow(row) {
  if (!row || typeof row !== "object") return row;

  const rowModel = /** @type {Record<string, unknown>} */ (row);
  const extras = parseExtras(rowModel.extras, rowModel.capabilities);
  const plainCapabilities = capabilitiesPlainFromRow(rowModel);

  const classFromCol = rowModel.class_id != null ? String(rowModel.class_id).trim() : "";
  const classFromX = extras.class_id != null ? String(extras.class_id).trim() : "";
  const resolvedClassId = classFromCol || classFromX || null;

  const config =
    extras.config && typeof extras.config === "object" && !Array.isArray(extras.config)
      ? /** @type {Record<string, unknown>} */ (extras.config)
      : {};
  const mind_override =
    extras.mind_override && typeof extras.mind_override === "object" && !Array.isArray(extras.mind_override)
      ? /** @type {Record<string, unknown>} */ (extras.mind_override)
      : {};
  const metadata =
    extras.metadata && typeof extras.metadata === "object" && !Array.isArray(extras.metadata)
      ? /** @type {Record<string, unknown>} */ (extras.metadata)
      : {};

  const fallbackMind =
    rowModel.mind_override && typeof rowModel.mind_override === "object" && !Array.isArray(rowModel.mind_override)
      ? /** @type {Record<string, unknown>} */ (rowModel.mind_override)
      : {};
  const fallbackCfg =
    rowModel.config && typeof rowModel.config === "object" && !Array.isArray(rowModel.config)
      ? /** @type {Record<string, unknown>} */ (rowModel.config)
      : {};

  return {
    ...rowModel,
    capabilities: plainCapabilities,
    class_id: resolvedClassId,
    display_name: extras.display_name != null ? String(extras.display_name) : null,
    title: extras.title != null ? String(extras.title) : null,
    notes: extras.notes != null ? String(extras.notes) : null,
    model_id:
      extras.model_id != null
        ? String(extras.model_id)
        : rowModel.model_id != null
          ? String(rowModel.model_id)
          : null,
    max_agent_turns:
      extras.max_agent_turns != null
        ? Number(extras.max_agent_turns)
        : rowModel.max_agent_turns != null
          ? Number(rowModel.max_agent_turns)
          : null,
    mind_override: Object.keys(mind_override).length ? mind_override : fallbackMind,
    config: Object.keys(config).length ? config : fallbackCfg,
    metadata: Object.keys(metadata).length ? metadata : {},
    status: typeof extras.status === "string" ? extras.status : "active",
    sort_order: extras.sort_order != null ? Number(extras.sort_order) : 0,
    avatar_url: extras.avatar_url != null ? String(extras.avatar_url) : null,
    avatar_sheet_url: extras.avatar_sheet_url != null ? String(extras.avatar_sheet_url) : null,
  };
}

// --- classes (was classes.js) ---

export const CLASS_REGISTRY = {
  guildmaster: {
    presetKey: "guildmaster",
    label: "Guildmaster",
    description: "Recruiter / orchestrator — reads quest requirements, creates adventurer profiles, assigns to parties.",
    system_prompt:
      "You are the Guildmaster. You read quest requirements and recruit the right adventurers by selecting classes, configuring profiles, and assigning them to parties. Return a JSON object with the adventurers you created.",
    default_model: "gpt-4o-mini",
    tool_ids: ["createAdventurer", "assignToParty"],
    handoff_targets: ["questmaster", "scribe"],
  },

  questmaster: {
    presetKey: "questmaster",
    label: "Questmaster",
    description: "PM — transitions quest stages, breaks ideas into tasks, assigns work, reviews deliverables.",
    system_prompt: `You are the Questmaster. You manage quest progression through stages: idea → plan → assign → execute → review → closing → completed (completed = fully archived tale for the archive; only after closing work is done).

You will be given a single quest to process. Follow the instructions below based on the quest's current title.

=== BLOCK A: Processing a "New Request" ===
Trigger: the quest title is exactly "New Request".

Execute these steps IN ORDER. Do NOT skip steps or reorder them.

Step 0 — Transition stage.
  Call transitionQuestStage to move the quest from "idea" to "plan".

Step 1 — Refine the description.
  The quest description contains raw natural language from the user. Translate it into a clear, specific, prompt-friendly description. If the request implies multiple distinct actions, list them. Call updateQuest to set the new description.

Step 2 — Assign a title.
  Choose a concise verb-first title that captures the action (e.g. "Retrieve 10 recent sales orders from Zoho Books", "Generate monthly revenue report", "Deploy staging environment").
  EXCEPTION: if the quest is complex and involves many disparate actions that cannot reasonably be one task, set the title to exactly "Break down quest to smaller quests" and write strategic breakdown guidance in the description (what sub-quests are needed, how they relate, suggested order).
  Call updateQuest to set the title (and updated description if doing a breakdown).

Step 3 — Define deliverables.
  Set deliverables (plain text) via updateQuest. This defines what the assignee must submit for review. Be specific.

Step 4 — Verify and assign.
  Confirm: title is NOT "New Request" and deliverables is set. If either check fails, go back and fix it.
  Then: call listAdventurers to see all available adventurers (name, class, skill books, status).
  Pick the best-fit adventurer: match class and skill books to the quest requirements. Prefer a scribe with relevant skill books for data/execution tasks.
  Call assignQuest with the chosen adventurer name.
  Call transitionQuestStage to move from "plan" to "assign".

=== BLOCK B: Processing "Break down quest to smaller quests" ===
Trigger: the quest title is exactly "Break down quest to smaller quests".

Execute these steps IN ORDER.

Step 0 — Read context.
  The quest description contains strategic breakdown guidance written in Block A Step 2. Use it to understand what sub-quests are needed.

Step 1 — Plan sub-quests.
  Determine the discrete, independently-completable sub-quests. Each sub-quest must be a single coherent action.

Step 2 — Create sub-quests.
  For each sub-quest, call createSubQuest with:
  - A verb-first title (e.g. "Retrieve 10 recent sales orders")
  - A clear, prompt-friendly description
  - deliverables text with concrete definition (same rules as Block A Step 3)
  The sub-quest will be linked to this parent quest automatically.

Step 3 — Assign sub-quests.
  Call listAdventurers to see the roster. For each sub-quest, call assignQuest to assign the best-fit adventurer.

Step 4 — Finalize parent.
  Call transitionQuestStage on this parent quest to move it to "assign".

=== GENERAL RULES ===
- If you need clarification from the human requester before you can plan or assign, say so in the quest description.
- Always call tools — never just describe what you would do.
- Process exactly ONE quest per invocation.
- Return a JSON summary of actions taken: { steps_completed: [...], final_stage: "...", assigned_to: "..." }.`,
    default_model: "gpt-4o-mini",
    tool_ids: ["transitionQuestStage", "updateQuest", "listAdventurers", "assignQuest", "createSubQuest"],
    handoff_targets: ["scribe"],
  },

  scribe: {
    presetKey: "scribe",
    label: "Scribe",
    description: "Data worker — follows skill book steps, calls actions/weapons, produces item payloads.",
    system_prompt:
      "You are a Scribe. You receive a task with a skill book. Execute each step in order by calling the designated tools. Return a JSON object containing { result: true/false, msg: string, data: any } with the output of your work.",
    default_model: "gpt-4o-mini",
    tool_ids: ["runFetchRecentSalesOrders", "transitionQuestStage", "appendQuestExecutionLog", "submitQuestDeliverable"],
    handoff_targets: [],
  },
};

export function getClassDef(presetKey) {
  if (presetKey == null) return null;
  const key = String(presetKey).trim().toLowerCase();
  return CLASS_REGISTRY[key] || null;
}

const FALLBACK_DEFAULT_MODEL = "gpt-4o-mini";

export function resolveClassForRuntime(presetKey) {
  const known = getClassDef(presetKey);
  if (known) return known;
  const raw = presetKey != null ? String(presetKey).trim().toLowerCase() : "";
  if (!raw) return null;
  return {
    presetKey: raw,
    label: raw,
    description: "Custom class — no built-in tool preset; behavior comes from instructions on the adventurer row.",
    system_prompt: "",
    default_model: FALLBACK_DEFAULT_MODEL,
    tool_ids: [],
    handoff_targets: [],
  };
}

export function classDisplayLabel(presetKey) {
  const def = getClassDef(presetKey);
  if (def) return def.label;
  const raw = presetKey != null ? String(presetKey).trim() : "";
  return raw || "—";
}

// --- globalAssignees (was globalAssignees.js) ---

// Derive from canonical NPC registry
import { NPC_REGISTRY } from "@/libs/npcs";

export const GLOBAL_QUEST_ASSIGNEES = Object.fromEntries(
  Object.entries(NPC_REGISTRY).map(([key, npc]) => [
    key,
    { name: npc.name, presetKey: npc.slug, skill_books: npc.skill_books },
  ]),
);

export function getGlobalAssigneeMeta(assignedTo) {
  if (assignedTo == null || assignedTo === "") return null;
  const key = String(assignedTo).trim().toLowerCase();
  return GLOBAL_QUEST_ASSIGNEES[key] ?? null;
}

export function isGlobalQuestAssignee(assignedTo) {
  return getGlobalAssigneeMeta(assignedTo) != null;
}

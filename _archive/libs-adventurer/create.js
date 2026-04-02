import { resolveServerClient } from "@/libs/council/database";
import {
  insertAdventurerRow,
  selectAdventurerForOwner,
  updateAdventurerRow,
  selectAdventurerById,
  selectAdventurerByName,
  listAdventurersForOwner,
  deleteAdventurerForOwner,
} from "@/libs/council/database/serverAdventurer.js";
import { publicTables } from "@/libs/council/publicTables";
import { resolveClassForRuntime } from "./classes.js";
import {
  filterValidSkillBookNames,
  getDefaultDraft,
  isRecruitReady,
  mergeDraftPatch,
} from "./commissionChecklist.js";
import { logDatabaseError } from "./logDatabaseError.js";
import {
  normalizeAdventurerRow,
  parseExtras,
  serializeCapabilitiesEnvelope,
} from "./capabilitiesJson.js";

async function resolveClient(injected) {
  return resolveServerClient(injected);
}

/**
 * Structured fields stored in envelope `x` (avatars, overrides). Excludes table columns.
 * @param {NonNullable<ReturnType<typeof resolveClassForRuntime>>} classDef
 * @param {Record<string, unknown>} draft
 */
function buildCapabilitiesFromDraft(classDef, draft) {
  const modelRaw = draft.modelId != null ? String(draft.modelId).trim() : "";
  const modelId = modelRaw ? modelRaw : null;
  const cfg = draft.config && typeof draft.config === "object" && !Array.isArray(draft.config) ? draft.config : {};
  const meta =
    draft.metadata && typeof draft.metadata === "object" && !Array.isArray(draft.metadata) ? draft.metadata : {};
  const mo =
    draft.mindOverride && typeof draft.mindOverride === "object" && !Array.isArray(draft.mindOverride)
      ? draft.mindOverride
      : {};
  const maxTurns =
    draft.maxAgentTurns != null && Number.isFinite(Number(draft.maxAgentTurns))
      ? Math.floor(Number(draft.maxAgentTurns))
      : null;

  return {
    display_name: draft.displayName != null ? String(draft.displayName).trim() || null : null,
    title: draft.title != null ? String(draft.title).trim() || null : null,
    notes: draft.notes != null ? String(draft.notes).trim() || null : null,
    model_id: modelId,
    mind_override: mo,
    max_agent_turns: maxTurns,
    config: cfg,
    metadata: meta,
    status: draft.status === "idle" || draft.status === "retired" ? draft.status : "active",
    sort_order: draft.sortOrder != null ? Number(draft.sortOrder) : 0,
    avatar_url: draft.avatarUrl != null ? String(draft.avatarUrl).trim() || null : null,
    avatar_sheet_url: draft.avatarSheetUrl != null ? String(draft.avatarSheetUrl).trim() || null : null,
  };
}

/**
 * Map DB row to commission draft shape for forms.
 * @param {Record<string, unknown> | null | undefined} row
 */
/**
 * Map DB row to table-shaped draft (table columns + plain capabilities text).
 */
export function adventurerRowToDraft(row) {
  const base = getDefaultDraft();
  if (!row || typeof row !== "object") return base;
  const r = normalizeAdventurerRow(row);
  return mergeDraftPatch(base, {
    name: r.name ?? "",
    system_prompt: r.system_prompt ?? "",
    skill_books: Array.isArray(r.skill_books) ? r.skill_books : [],
    backstory: r.backstory ?? "",
    capabilities: r.capabilities ?? "",
  });
}

/**
 * @param {{
 *   ownerId: string,
 *   name: string,
 *   skillBooks?: string[],
 *   modelId?: string | null,
 *   systemPrompt?: string | null,
 *   config?: Record<string, unknown>,
 *   displayName?: string | null,
 *   title?: string | null,
 *   backstory?: string | null,
 *   notes?: string | null,
 *   avatarUrl?: string | null,
 *   avatarSheetUrl?: string | null,
 *   mindOverride?: Record<string, unknown>,
 *   maxAgentTurns?: number | null,
 *   sortOrder?: number,
 *   metadata?: Record<string, unknown>,
 *   status?: string,
 *   client?: import("@/libs/council/database/types.js").DatabaseClient,
 * }} opts
 */
export async function createAdventurer({
  ownerId,
  name,
  skillBooks,
  modelId,
  systemPrompt,
  config,
  displayName,
  title,
  backstory,
  notes,
  avatarUrl,
  avatarSheetUrl,
  mindOverride,
  maxAgentTurns,
  sortOrder,
  metadata,
  status,
  client: injected,
}) {
  const presetKey = String(name ?? "").trim().toLowerCase();
  const classDef = resolveClassForRuntime(presetKey);
  if (!classDef) {
    return { error: new Error("name is required (non-empty string) — it selects the built-in class preset.") };
  }

  const client = await resolveClient(injected);

  const cap = buildCapabilitiesFromDraft(classDef, {
    displayName,
    title,
    notes,
    modelId,
    mindOverride,
    maxAgentTurns,
    config,
    metadata,
    status,
    sortOrder,
    avatarUrl,
    avatarSheetUrl,
  });

  const x = { ...cap, class_id: classDef.class_id };
  const capabilitiesValue = serializeCapabilitiesEnvelope("", x);

  const insertRow = {
    owner_id: ownerId,
    name,
    system_prompt: systemPrompt || null,
    skill_books: skillBooks || [],
    backstory: backstory ?? null,
    capabilities: capabilitiesValue,
  };

  const { data, error } = await insertAdventurerRow(insertRow, { client: injected });

  if (error) {
    let authUserId = null;
    try {
      const { data: authData } = await client.auth.getUser();
      authUserId = authData?.user?.id ?? null;
    } catch {
      /* ignore */
    }
    logDatabaseError("createAdventurer.insert", error, {
      table: publicTables.adventurers,
      insertPayload: insertRow,
      authUserIdFromSession: authUserId,
      ownerIdMatchesSession: authUserId === ownerId,
    });
    if (error.code === "23505") {
      return { error: new Error("An adventurer with this name already exists on your roster.") };
    }
    return { error };
  }
  return { data: data ? normalizeAdventurerRow(data) : data };
}

/**
 * Validate commission draft and insert adventurer row.
 * @param {{ ownerId: string, draft: Record<string, unknown>, client?: import("@/libs/council/database/types.js").DatabaseClient }} opts
 */
export async function recruitAdventurer({ ownerId, draft, client: injected }) {
  if (!isRecruitReady(draft)) {
    return {
      error: new Error("Recruit draft incomplete: name and system_prompt are required."),
    };
  }

  const presetKey = String(draft.name ?? "").trim().toLowerCase();
  const classDef = resolveClassForRuntime(presetKey);
  if (!classDef) {
    return { error: new Error("name is required (non-empty string) — it selects the built-in class preset.") };
  }

  const cap = buildCapabilitiesFromDraft(classDef, {});
  const x = { ...cap, class_id: classDef.class_id };
  const plain = draft.capabilities != null ? String(draft.capabilities).trim() : "";
  const capabilitiesValue = serializeCapabilitiesEnvelope(plain, x);

  const client = await resolveClient(injected);

  const insertRow = {
    owner_id: ownerId,
    name: String(draft.name).trim(),
    system_prompt: String(draft.system_prompt ?? draft.systemPrompt ?? "").trim(),
    skill_books: filterValidSkillBookNames(
      draft.skill_books ?? draft.skill_book_ids ?? draft.skillBooks ?? draft.skillBookIds,
    ),
    backstory: draft.backstory != null ? String(draft.backstory).trim() || null : null,
    capabilities: capabilitiesValue,
  };

  const { data, error } = await insertAdventurerRow(insertRow, { client: injected });

  if (error) {
    let authUserId = null;
    try {
      const { data: authData } = await client.auth.getUser();
      authUserId = authData?.user?.id ?? null;
    } catch {
      /* ignore */
    }
    logDatabaseError("recruitAdventurer.insert", error, {
      table: publicTables.adventurers,
      insertPayload: insertRow,
      authUserIdFromSession: authUserId,
      ownerIdMatchesSession: authUserId === ownerId,
    });
    if (error.code === "23505") {
      return { error: new Error("An adventurer with this name already exists on your roster.") };
    }
    return { error };
  }
  return { data: data ? normalizeAdventurerRow(data) : data };
}

/**
 * Load a single adventurer if it belongs to `ownerId`.
 * @param {string} adventurerId
 * @param {string} ownerId
 * @param {{ client?: import("@/libs/council/database/types.js").DatabaseClient }} [opts]
 */
export async function getAdventurerForOwner(adventurerId, ownerId, { client: injected } = {}) {
  const { data, error } = await selectAdventurerForOwner(adventurerId, ownerId, { client: injected });
  if (error) {
    logDatabaseError("getAdventurerForOwner.select", error, {
      adventurerId,
      ownerId,
      table: publicTables.adventurers,
    });
    return { error };
  }
  if (!data) return { error: new Error("Adventurer not found.") };
  return { data: normalizeAdventurerRow(data) };
}

/**
 * Update adventurer fields from a commission-shaped draft (same rules as recruit).
 * @param {{ adventurerId: string, ownerId: string, draft: Record<string, unknown>, client?: import("@/libs/council/database/types.js").DatabaseClient }} opts
 */
export async function updateAdventurer({ adventurerId, ownerId, draft, client: injected }) {
  if (!isRecruitReady(draft)) {
    return {
      error: new Error("Draft is incomplete: name and system_prompt are required."),
    };
  }

  const presetKey = String(draft.name ?? "").trim().toLowerCase();
  const classDef = resolveClassForRuntime(presetKey);
  if (!classDef) {
    return { error: new Error("name is required (non-empty string) — it selects the built-in class preset.") };
  }

  const skillBooksFiltered = filterValidSkillBookNames(
    draft.skill_books ?? draft.skill_book_ids ?? draft.skillBooks ?? draft.skillBookIds,
  );

  const { data: current, error: readErr } = await selectAdventurerForOwner(adventurerId, ownerId, { client: injected });
  if (readErr || !current) {
    return { error: readErr || new Error("Adventurer not found.") };
  }

  const prevExtras = parseExtras(current.extras, current.capabilities);
  const baseCap = buildCapabilitiesFromDraft(classDef, draft);
  const mergedX = { ...prevExtras, ...baseCap, class_id: classDef.class_id };
  const plain = draft.capabilities != null ? String(draft.capabilities).trim() : "";
  const capabilitiesValue = serializeCapabilitiesEnvelope(plain, mergedX);

  const updateRow = {
    name: String(draft.name).trim(),
    system_prompt: String(draft.system_prompt ?? draft.systemPrompt ?? "").trim(),
    skill_books: skillBooksFiltered,
    backstory: draft.backstory != null ? String(draft.backstory).trim() || null : null,
    capabilities: capabilitiesValue,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await updateAdventurerRow(adventurerId, ownerId, updateRow, { client: injected });

  if (error) {
    logDatabaseError("updateAdventurer.update", error, {
      table: publicTables.adventurers,
      adventurerId,
      ownerId,
      updatePayload: updateRow,
    });
    if (error.code === "23505") {
      return { error: new Error("An adventurer with this name already exists on your roster.") };
    }
    return { error };
  }
  return { data: data ? normalizeAdventurerRow(data) : data };
}

/**
 * Remove an adventurer row (owner must match).
 */
export async function decommissionAdventurer({ adventurerId, ownerId, client: injected }) {
  const { error } = await deleteAdventurerForOwner(adventurerId, ownerId, { client: injected });
  if (error) {
    logDatabaseError("decommissionAdventurer.delete", error, {
      adventurerId,
      ownerId,
      table: publicTables.adventurers,
    });
    return { error };
  }
  return { data: true };
}

export async function getAdventurer(adventurerId, { client: injected } = {}) {
  const { data, error } = await selectAdventurerById(adventurerId, { client: injected });
  if (error) {
    logDatabaseError("getAdventurer.select", error, { adventurerId, table: publicTables.adventurers });
    return { error };
  }
  return { data: normalizeAdventurerRow(data) };
}

export async function getAdventurerByName(name, { client: injected } = {}) {
  const { data, error } = await selectAdventurerByName(name, { client: injected });
  if (error) {
    logDatabaseError("getAdventurerByName.select", error, { name, table: publicTables.adventurers });
    return { error };
  }
  if (!data) return { data: null };
  return { data: normalizeAdventurerRow(data) };
}

export async function listAdventurers(ownerId, { client: injected } = {}) {
  const { data, error } = await listAdventurersForOwner(ownerId, { client: injected });
  if (error) {
    logDatabaseError("listAdventurers.select", error, { ownerId, table: publicTables.adventurers });
    return { error };
  }
  const rows = (data || []).map((r) => normalizeAdventurerRow(r));
  const active = rows.filter((r) => r.status !== "retired");
  return { data: active };
}

export async function seedQuestPartyAdventurers(ownerId) {
  const adventurers = [
    {
      name: "questmaster",
      skillBooks: [],
    },
    {
      name: "scribe",
      skillBooks: ["zoho"],
    },
  ];

  const results = [];
  for (const adv of adventurers) {
    const { data, error } = await createAdventurer({
      ownerId,
      name: adv.name,
      skillBooks: adv.skillBooks ?? [],
    });
    if (error) {
      logDatabaseError("seedQuestPartyAdventurers.insert", error, { ownerId, name: adv.name });
      return { error };
    }
    results.push(data);
  }
  return { data: results };
}

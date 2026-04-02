import { resolveDungeonMasterRuntime } from "@/libs/council/councilSettings";
import { getAdventurer } from "./create.js";
import { resolveClassForRuntime } from "./classes.js";
import { adventurerPresetKey, normalizeAdventurerRow } from "./capabilitiesJson.js";

/**
 * Load DB row, class definition, and resolved mind (DM + overrides) for runtime.
 * @param {string} adventurerId
 * @param {{ client: import("@/libs/council/database/types.js").DatabaseClient }} opts
 */
/**
 * Resolve class + DM runtime from an adventurer-shaped row (DB or synthetic global assignee).
 * @param {Record<string, unknown>} row — DB row or synthetic global row (`presetKey` optional)
 */
export async function loadAdventurerFromRow(row, { client }) {
  const rowNorm = normalizeAdventurerRow(row);
  const classDef = resolveClassForRuntime(adventurerPresetKey(rowNorm));
  const rt = await resolveDungeonMasterRuntime(row.owner_id, { client });

  const mo =
    rowNorm.mind_override && typeof rowNorm.mind_override === "object" && !Array.isArray(rowNorm.mind_override)
      ? rowNorm.mind_override
      : /** @type {Record<string, unknown>} */ ({});

  const moBase = typeof mo.base_url === "string" && mo.base_url.trim() ? mo.base_url.trim() : null;
  const moModel = typeof mo.model_id === "string" && mo.model_id.trim() ? mo.model_id.trim() : null;

  const effectiveBaseUrl = moBase || rt.baseUrl;
  const rowModel = rowNorm.model_id && String(rowNorm.model_id).trim() ? String(rowNorm.model_id).trim() : null;
  const effectiveModel =
    rowModel || moModel || rt.defaultModel || (classDef?.default_model ?? null);

  const rawTurns = rowNorm.max_agent_turns;
  const maxTurns =
    rawTurns != null && Number.isFinite(Number(rawTurns))
      ? Math.max(1, Math.min(100, Math.floor(Number(rawTurns))))
      : 15;

  return {
    data: {
      row: rowNorm,
      classDef,
      mind: {
        ...rt,
        effectiveBaseUrl,
        effectiveModel,
        maxTurns,
      },
    },
  };
}

export async function loadAdventurer(adventurerId, { client }) {
  const { data: row, error } = await getAdventurer(adventurerId, { client });
  if (error) return { error };
  return loadAdventurerFromRow(row, { client });
}

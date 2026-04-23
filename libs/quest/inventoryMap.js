/**
 * [items workflow migration] This entire module maps the legacy `quests.inventory` JSONB shape.
 * Once items move to `quest_items` + `quest_item_comments` tables, this file is deleted and
 * callers use a hydrated loader in libs/quest/ that returns quest + items + nested comments.
 *
 * Quest inventory canonical shape: a plain object **{ key1: value1, key2: value2, ... }**.
 *
 * Special key `pigeon_letters`: value is **Letter[]** (array of letter objects), not wrapped in `{ letters }`.
 *
 * Legacy: array of rows, `{ letters: [...] }`, `{ payload: { letters } }`, or `{ payload, source?, created_at? }`.
 */

export const PIGEON_LETTERS_KEY = "pigeon_letters";

/**
 * Legacy cell: `{ payload, source?, created_at? }` → return `payload` as the real value.
 * @param {unknown} v
 */
function unwrapLegacyCell(v) {
  if (v == null || typeof v !== "object" || Array.isArray(v)) return v;
  const keys = Object.keys(v);
  if (keys.length === 0) return v;
  const legacyWrapper =
    "payload" in v && keys.every((k) => k === "payload" || k === "source" || k === "created_at");
  if (legacyWrapper) return /** @type {{ payload?: unknown }} */ (v).payload;
  return v;
}

/**
 * Normalize pigeon slot to **Letter[]** (canonical).
 * @param {unknown} v
 * @returns {unknown[]}
 */
function normalizePigeonValue(v) {
  const u = unwrapLegacyCell(v);
  if (Array.isArray(u)) return [...u];
  if (u && typeof u === "object" && !Array.isArray(u) && Array.isArray(u.payload?.letters)) {
    return [...u.payload.letters];
  }
  if (u && typeof u === "object" && !Array.isArray(u) && Array.isArray(u.letters)) {
    return [...u.letters];
  }
  return [];
}

/**
 * Accept any of: new items[] array (post items workflow migration), legacy JSONB map, legacy array of rows.
 * Returns the canonical { item_key: value } map shape the UI uses.
 * @param {unknown} raw
 * @returns {Record<string, unknown>}
 */
export function inventoryRawToMap(raw) {
  if (raw == null || raw === "") return {};
  // New items[] shape: rows from public.items with direct fields
  if (Array.isArray(raw) && raw.length > 0 && raw[0] && typeof raw[0] === "object" && "item_key" in raw[0] && ("url" in raw[0] || "description" in raw[0])) {
    /** @type {Record<string, unknown>} */
    const map = {};
    for (const row of raw) {
      const r = /** @type {Record<string, unknown>} */ (row);
      const k = r.item_key != null ? String(r.item_key) : "";
      if (!k) continue;
      map[k] = { url: r.url ?? null, description: r.description ?? null, source: r.source ?? null, comments: Array.isArray(r.comments) ? r.comments : [] };
    }
    return map;
  }
  if (typeof raw === "object" && !Array.isArray(raw)) {
    /** @type {Record<string, unknown>} */
    const out = {};
    for (const [k, v] of Object.entries(raw)) {
      if (k === PIGEON_LETTERS_KEY) {
        out[k] = normalizePigeonValue(v);
      } else {
        out[k] = unwrapLegacyCell(v);
      }
    }
    return out;
  }
  if (!Array.isArray(raw)) return {};
  return arrayInventoryRowsToMap(raw);
}

/**
 * @param {unknown[]} rows
 */
function arrayInventoryRowsToMap(rows) {
  /** @type {Record<string, unknown>} */
  const map = {};
  const pigeonLetters = [];

  for (const it of rows) {
    if (!it || typeof it !== "object") continue;
    const ik = it.item_key != null ? String(it.item_key) : it.key != null ? String(it.key) : "";
    if (!ik) continue;

    if (ik === PIGEON_LETTERS_KEY) {
      const pl = it.payload !== undefined ? it.payload : it.value;
      if (Array.isArray(pl)) {
        pigeonLetters.push(...pl);
      } else if (pl && typeof pl === "object" && !Array.isArray(pl) && Array.isArray(pl.letters)) {
        pigeonLetters.push(...pl.letters);
      } else if (pl && typeof pl === "object") {
        pigeonLetters.push(pl);
      }
    } else {
      map[ik] = it.payload !== undefined ? it.payload : it.value;
    }
  }

  if (pigeonLetters.length > 0) {
    map[PIGEON_LETTERS_KEY] = pigeonLetters;
  }

  return map;
}

/**
 * Rows for quest detail UI (array of { item_key, payload }).
 * @param {unknown} raw
 * @returns {Array<{ item_key: string, payload: unknown, source?: string }>}
 */
export function inventoryToDisplayRows(raw) {
  const map = inventoryRawToMap(raw);
  const rows = [];
  for (const [k, val] of Object.entries(map)) {
    rows.push({
      item_key: k,
      payload: val,
    });
  }
  return rows;
}

/**
 * @param {Record<string, unknown>} map
 */
export function inventoryMapKeyCount(map) {
  return Object.keys(map || {}).length;
}

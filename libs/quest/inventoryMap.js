/**
 * Client-safe helpers for mapping items[] (from the public.items table) into the
 * { item_key: payload } map shape the UI uses.
 *
 * This module has NO server imports so it can be imported from client components.
 */

/**
 * Convert an items[] array into a map keyed by item_key.
 * @param {unknown[]} items
 * @returns {Record<string, unknown>}
 */
export function inventoryRawToMap(items) {
  if (!Array.isArray(items)) return {};
  const map = {};
  for (const it of items) {
    if (!it || typeof it !== "object") continue;
    const k = it.item_key != null ? String(it.item_key) : "";
    if (!k) continue;
    map[k] = { url: it.url ?? null, description: it.description ?? null, source: it.source ?? null, comments: Array.isArray(it.comments) ? it.comments : [] };
  }
  return map;
}

/**
 * Items as rows for quest detail UI. Accepts either the raw items[] array
 * (as returned by the items table) or an already-mapped { item_key: payload } object.
 * @param {unknown[] | Record<string, unknown>} input
 * @returns {Array<{ item_key: string, payload: unknown, source?: string }>}
 */
export function inventoryToDisplayRows(input) {
  const map = Array.isArray(input)
    ? inventoryRawToMap(input)
    : input && typeof input === "object"
      ? input
      : {};
  return Object.entries(map).map(([item_key, payload]) => ({ item_key, payload, source: payload?.source }));
}

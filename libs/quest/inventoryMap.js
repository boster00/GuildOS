/**
 * Client-safe helpers for mapping items[] (from the public.items table) into the
 * { item_key: payload } map shape the UI uses.
 *
 * This module has NO server imports so it can be imported from client components.
 */

/**
 * Natural-numeric collator: orders `screenshot_2` before `screenshot_10`, and
 * `doc_1` before `screenshot_1` (alphabetic on the prefix, numeric on the
 * trailing digits). This is the canonical display order for quest items,
 * because:
 *   - `created_at` ASC fails when a worker re-uploads (bounce-fix) only some
 *     items: their UPSERT keeps the original created_at, but two sibling
 *     inserts collapsing to the same microsecond + the worker uploading
 *     out-of-key-order both produce wrong-looking carousels.
 *   - `item_key` is the canonical handle the worker chooses with the
 *     intended display order baked in (`screenshot_1`, `_2`, `_3`, …), so
 *     sorting by it gives the user what they expect with no schema change.
 * If item_keys ever go fully unstructured (no numeric suffix, no consistent
 * prefix), add an explicit `sort_order` column to `items` and switch this
 * helper to read from it.
 */
const _itemKeyCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

/**
 * @param {string} a
 * @param {string} b
 */
export function compareItemKeys(a, b) {
  return _itemKeyCollator.compare(String(a ?? ""), String(b ?? ""));
}

/**
 * Convert an items[] array into a map keyed by item_key.
 *
 * Insertion order matters: `Object.entries(map)` preserves insertion order for
 * non-integer-like string keys (which `screenshot_N` etc. are), so sorting the
 * input array by `item_key` here propagates that order all the way to the
 * carousel without any caller-side sort.
 *
 * @param {unknown[]} items
 * @returns {Record<string, unknown>}
 */
export function inventoryRawToMap(items) {
  if (!Array.isArray(items)) return {};
  const sorted = items
    .filter((it) => it && typeof it === "object" && it.item_key != null && String(it.item_key) !== "")
    .slice()
    .sort((a, b) => compareItemKeys(a.item_key, b.item_key));
  const map = {};
  for (const it of sorted) {
    const k = String(it.item_key);
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

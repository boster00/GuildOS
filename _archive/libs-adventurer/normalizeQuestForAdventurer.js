/**
 * Map DB quest row to the shape implied by `libs/adventurer/index.js` (inventory as `{ key, value }[]`).
 */
export function normalizeQuestRowForAdventurer(row) {
  if (!row || typeof row !== "object") return row;
  const inv = [];
  const rawItems = Array.isArray(row.items) ? row.items : [];
  for (const it of rawItems) {
    if (it && typeof it === "object" && it.item_key != null) {
      inv.push({ key: String(it.item_key), value: it.payload });
    }
  }
  if (Array.isArray(row.inventory)) {
    for (const it of row.inventory) {
      if (it && typeof it === "object" && "key" in it && it.key != null) {
        inv.push({ key: String(it.key), value: it.value });
      } else if (it && it.item_key != null) {
        inv.push({ key: String(it.item_key), value: it.payload });
      }
    }
  }
  return { ...row, inventory: inv };
}

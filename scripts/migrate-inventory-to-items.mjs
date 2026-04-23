#!/usr/bin/env node
/**
 * One-shot data migration: unpack `quests.inventory` JSONB → `items` + `item_comments` rows.
 *
 * Run with: node --env-file=.env.local scripts/migrate-inventory-to-items.mjs
 *
 * Safe to re-run: uses UPSERT on (quest_id, item_key) so repeated runs converge.
 * Skips the reserved `pigeon_letters` key (that stays in JSONB for now; pigeon is dormant).
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SECRETE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRETE_KEY in env.");
  process.exit(1);
}

const HEADERS = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
};

const PIGEON_KEY = "pigeon_letters";

/** Normalize legacy inventory shapes to { item_key: payload } map. */
function inventoryToMap(raw) {
  if (raw == null) return {};
  if (Array.isArray(raw)) {
    const map = {};
    for (const row of raw) {
      if (row && typeof row === "object" && typeof row.item_key === "string") {
        map[row.item_key] = row.payload !== undefined ? row.payload : row;
      }
    }
    return map;
  }
  if (typeof raw === "object") return raw;
  return {};
}

/** Pull url + description from any of the common payload shapes. */
function extractItemFields(payload) {
  if (payload == null) return { url: null, description: null };
  if (typeof payload === "string") return { url: null, description: payload };
  if (typeof payload !== "object") return { url: null, description: String(payload) };
  const url =
    typeof payload.url === "string" ? payload.url :
    typeof payload.supabaselinktoscreenshot === "string" ? payload.supabaselinktoscreenshot :
    null;
  const description =
    typeof payload.description === "string" ? payload.description :
    typeof payload.descriptionofscreenshot === "string" ? payload.descriptionofscreenshot :
    null;
  return { url, description };
}

function extractComments(payload) {
  if (!payload || typeof payload !== "object" || !Array.isArray(payload.comments)) return [];
  return payload.comments.filter((c) => c && typeof c === "object" && typeof c.comment === "string" || typeof c?.text === "string").map((c) => ({
    role: String(c.role || "adventurer").toLowerCase(),
    text: String(c.text || c.comment || "").trim(),
    created_at: typeof c.timestamp === "string" ? c.timestamp : (typeof c.created_at === "string" ? c.created_at : null),
  })).filter((c) => c.text);
}

async function fetchQuests() {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/quests?select=id,inventory&inventory=not.is.null`, { headers: HEADERS });
  if (!r.ok) throw new Error(`quests fetch failed: ${r.status} ${await r.text()}`);
  return r.json();
}

async function upsertItem(quest_id, item_key, fields, source) {
  const body = [{ quest_id, item_key, url: fields.url, description: fields.description, source: source || null }];
  const r = await fetch(`${SUPABASE_URL}/rest/v1/items?on_conflict=quest_id,item_key`, {
    method: "POST",
    headers: { ...HEADERS, Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`items upsert failed for ${quest_id}/${item_key}: ${r.status} ${await r.text()}`);
  const rows = await r.json();
  return rows[0]?.id;
}

async function insertComment(item_id, comment) {
  const body = [{ item_id, role: ["adventurer", "questmaster", "chaperon", "guildmaster"].includes(comment.role) ? comment.role : "adventurer", text: comment.text }];
  const r = await fetch(`${SUPABASE_URL}/rest/v1/item_comments`, {
    method: "POST",
    headers: { ...HEADERS, Prefer: "return=minimal" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    console.warn(`  item_comment insert failed for item ${item_id}: ${r.status} ${await r.text()}`);
  }
}

async function main() {
  console.log("Fetching quests with non-null inventory...");
  const quests = await fetchQuests();
  console.log(`Found ${quests.length} quests.`);

  let totalItems = 0;
  let totalComments = 0;
  let totalSkipped = 0;

  for (const quest of quests) {
    const map = inventoryToMap(quest.inventory);
    const keys = Object.keys(map).filter((k) => k !== PIGEON_KEY);
    if (keys.length === 0) continue;

    for (const key of keys) {
      const payload = map[key];
      let outerSource = null;
      let innerPayload = payload;
      // Legacy wrapped shape: { payload: {...}, source, created_at }
      if (payload && typeof payload === "object" && !Array.isArray(payload) && "payload" in payload && ("source" in payload || "created_at" in payload)) {
        innerPayload = payload.payload;
        outerSource = typeof payload.source === "string" ? payload.source : null;
      }
      const fields = extractItemFields(innerPayload);
      if (!fields.url && !fields.description) {
        totalSkipped++;
        continue;
      }
      try {
        const itemId = await upsertItem(quest.id, key, fields, outerSource);
        totalItems++;
        const comments = extractComments(innerPayload);
        for (const c of comments) {
          await insertComment(itemId, c);
          totalComments++;
        }
      } catch (err) {
        console.warn(`  ${quest.id}/${key}: ${err.message}`);
        totalSkipped++;
      }
    }
  }

  console.log(`\nDone. Items upserted: ${totalItems}. Comments: ${totalComments}. Skipped (empty or failed): ${totalSkipped}.`);

  // Verify counts
  const itemsCount = await fetch(`${SUPABASE_URL}/rest/v1/items?select=id`, { headers: { ...HEADERS, Prefer: "count=exact" } });
  console.log(`items row count in DB: ${itemsCount.headers.get("content-range")}`);
  const commentsCount = await fetch(`${SUPABASE_URL}/rest/v1/item_comments?select=id`, { headers: { ...HEADERS, Prefer: "count=exact" } });
  console.log(`item_comments row count in DB: ${commentsCount.headers.get("content-range")}`);
}

main().catch((err) => { console.error(err); process.exit(1); });

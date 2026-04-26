#!/usr/bin/env node
// Data-migration companion to 20260427000000_items_merge_deliverables.sql.
//
// 1. For every items row whose `expectation` is NULL, backfill from the matching
//    `quests.deliverables[i]` entry by item_key (use accept_criteria || description).
// 2. For every `quests.deliverables[i]` entry that has no matching items row,
//    INSERT an items row (promote legacy deliverables-as-inventory to first-class
//    items).
//
// Idempotent: re-runnable without harm. Skips rows that already look migrated.
//
// Usage: node --env-file=.env.local scripts/migrate-items-merge.mjs

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRETE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRETE_KEY in env.");
  process.exit(1);
}
const db = createClient(url, key);

function parseDeliverables(raw) {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
}

async function run() {
  // Load every quest with deliverables data — we walk only those that need work.
  const { data: quests, error: qErr } = await db
    .from("quests")
    .select("id, title, deliverables");
  if (qErr) {
    console.error("Failed to read quests:", qErr.message);
    process.exit(1);
  }

  let backfilledCount = 0;
  let promotedCount = 0;
  let skippedCount = 0;
  let errCount = 0;

  for (const q of quests || []) {
    const dl = parseDeliverables(q.deliverables);
    if (!Array.isArray(dl) || dl.length === 0) continue;

    // Load current items for this quest
    const { data: items, error: iErr } = await db
      .from("items")
      .select("id, item_key, expectation, caption, url")
      .eq("quest_id", q.id);
    if (iErr) {
      console.error(`[${q.id.slice(0, 8)}] failed to read items:`, iErr.message);
      errCount++;
      continue;
    }
    const itemsByKey = new Map((items || []).map((i) => [i.item_key, i]));

    for (const d of dl) {
      if (!d || typeof d !== "object") continue;
      const itemKey =
        typeof d.item_key === "string" && d.item_key.trim().length > 0 ? d.item_key.trim() : null;
      if (!itemKey) {
        console.warn(`[${q.id.slice(0, 8)}] skipping deliverables entry with no item_key:`, JSON.stringify(d).slice(0, 100));
        skippedCount++;
        continue;
      }
      // The expectation is whichever is present — accept_criteria is more specific,
      // description is the friendlier fallback.
      const expectation =
        (typeof d.accept_criteria === "string" && d.accept_criteria.trim()) ||
        (typeof d.description === "string" && d.description.trim()) ||
        null;

      const existing = itemsByKey.get(itemKey);

      if (existing) {
        // Row exists — backfill expectation if missing.
        if (existing.expectation == null && expectation) {
          const { error } = await db
            .from("items")
            .update({ expectation })
            .eq("id", existing.id);
          if (error) {
            console.error(`[${q.id.slice(0, 8)}] backfill ${itemKey}:`, error.message);
            errCount++;
          } else {
            backfilledCount++;
          }
        } else {
          skippedCount++;
        }
      } else {
        // Promote: insert a new items row from the deliverables entry.
        const insertRow = {
          quest_id: q.id,
          item_key: itemKey,
          expectation,
          url:
            typeof d.url === "string" && d.url.startsWith("http") ? d.url : null,
          caption:
            typeof d.description === "string" && d.description.trim()
              ? d.description.trim()
              : null,
        };
        const { error } = await db.from("items").insert(insertRow);
        if (error) {
          console.error(`[${q.id.slice(0, 8)}] promote ${itemKey}:`, error.message);
          errCount++;
        } else {
          promotedCount++;
        }
      }
    }
  }

  console.log("\n=== Migration summary ===");
  console.log(`  Backfilled expectation on existing items: ${backfilledCount}`);
  console.log(`  Promoted orphan deliverables to items:    ${promotedCount}`);
  console.log(`  Skipped (no work needed or no item_key):  ${skippedCount}`);
  console.log(`  Errors:                                   ${errCount}`);
}

run().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});

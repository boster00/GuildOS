#!/usr/bin/env node
// Smoke test: end-to-end exercise of the new gate chain on a fresh quest.
//
// Task: find 5 U-pick cherry farms near Dublin CA (within ~50 mi) opening in
// 2026-04-26 → 2026-05-31, one screenshot per farm.
//
// What this script does:
//   1. Creates the quest in `execute` stage with strategic-context description
//   2. Seeds 5 items rows with template expectations (item_keys: farm_1..farm_5)
//   3. Dispatches a followup to Neo Golden Finger via Cursor API
//   4. Prints the quest ID so we can monitor progress and run the gates
//
// Usage: node --env-file=.env.local scripts/_smoke-cherry-farms.mjs

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SECRETE_KEY;
const CURSOR_API_KEY = process.env.CURSOR_API_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing Supabase creds in env.");
  process.exit(1);
}
if (!CURSOR_API_KEY) {
  console.error("Missing CURSOR_API_KEY in env.");
  process.exit(1);
}
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

const ASSIGNEE_NAME = "Neo Golden Finger";

const QUEST_TITLE = "U-pick cherry farms near Dublin CA — 5 recommendations";

const QUEST_DESCRIPTION = [
  "## Goal",
  "Identify 5 distinct U-pick cherry farms within ~50 miles of Dublin, CA whose 2026 season opens between today (2026-04-26) and 2026-05-31. One screenshot per farm.",
  "",
  "## Source of truth",
  "Public farm websites. Aggregator listings (PickYourOwn.org, RealCalifornia, etc.) are fine for discovery but the screenshot must be from the farm's own site.",
  "",
  "## Scope",
  "- IN: U-pick cherries specifically; farms whose 2026 season is announced.",
  "- OUT: non-U-pick orchards, farms beyond ~50 mi from Dublin, farms whose 2026 season is not yet posted, farms that only do other fruits.",
  "",
  "## Approach",
  "Web-search for U-pick cherry farms in the Bay Area / Central Valley region. Visit each candidate's site. Confirm 2026 U-pick cherry season is announced and opening date falls within the window. Capture a clean screenshot of the relevant page (U-pick info, season dates, or homepage with cherry season callout). Five distinct businesses — no duplicates.",
].join("\n");

const ITEM_EXPECTATION_TEMPLATE = (n) =>
  `Screenshot of recommended U-pick cherry farm #${n}. Image must show: (a) the farm's name visible (URL bar, page header, or logo), (b) explicit reference to U-pick cherries (text on page mentioning "U-pick cherries", "cherry season", or similar), (c) opening dates or season info within 2026-04-26 → 2026-05-31 visible on the page. Must be a DIFFERENT farm than the other 4 items. Aggregator pages don't count — must be the farm's own website.`;

async function run() {
  // 1. Find the user (owner) and the assignee adventurer.
  const { data: anyQuest } = await db.from("quests").select("owner_id").limit(1).single();
  const userId = anyQuest?.owner_id;
  if (!userId) throw new Error("Could not resolve owner_id from existing quests");

  const { data: assignee } = await db
    .from("adventurers")
    .select("id, name, session_id, session_status")
    .eq("name", ASSIGNEE_NAME)
    .single();
  if (!assignee) throw new Error(`Assignee ${ASSIGNEE_NAME} not found`);
  if (!assignee.session_id) throw new Error(`Assignee ${ASSIGNEE_NAME} has no session_id`);
  console.log(`Assignee: ${assignee.name} (${assignee.id}) — session ${assignee.session_id} status=${assignee.session_status}`);

  // 2. Create the quest.
  const deliverables = [];
  for (let n = 1; n <= 5; n++) {
    deliverables.push({
      item_key: `farm_${n}`,
      expectation: ITEM_EXPECTATION_TEMPLATE(n),
    });
  }

  const { data: quest, error: qErr } = await db
    .from("quests")
    .insert({
      owner_id: userId,
      title: QUEST_TITLE,
      description: QUEST_DESCRIPTION,
      deliverables, // JSONB column — kept for backward compat
      stage: "execute",
      priority: "low",
      assignee_id: assignee.id,
      assigned_to: assignee.name,
    })
    .select()
    .single();
  if (qErr) throw new Error(`Quest insert failed: ${qErr.message}`);
  console.log(`Quest created: ${quest.id}`);

  // 3. Seed items rows from deliverables (writeQuest auto-seeds in Next.js context;
  //    raw script does it explicitly).
  const itemsRows = deliverables.map((d) => ({
    quest_id: quest.id,
    item_key: d.item_key,
    expectation: d.expectation,
  }));
  const { data: items, error: iErr } = await db
    .from("items")
    .insert(itemsRows)
    .select("id, item_key, expectation");
  if (iErr) throw new Error(`Items insert failed: ${iErr.message}`);
  console.log(`Seeded ${items.length} items rows`);
  for (const it of items) console.log(`  - ${it.item_key}: ${it.expectation.slice(0, 80)}…`);

  // 4. Dispatch followup to Cursor agent.
  const message = [
    `New quest assigned: ${QUEST_TITLE}`,
    `Quest ID: ${quest.id}`,
    "",
    "Use housekeeping.searchQuests to load it. Read the description (strategic context) and the items (5 rows, each with expectation). Each item is one farm recommendation; the expectation tells you what the screenshot must show.",
    "",
    "Pick 5 distinct U-pick cherry farms within ~50 miles of Dublin CA opening 2026-04-26 → 2026-05-31. For each: capture a screenshot from the farm's own website (not aggregator listings) that satisfies the expectation, upload to GuildOS_Bucket via supabase_storage.writeFile (path: cursor_cloud/<questId>/<filename>), then writeItem({questId, item_key: 'farm_N', url, caption}) and writeItemComment({itemId, role: 'adventurer', text: '<one sentence: what this shows + why it satisfies the expectation>'}).",
    "",
    "When all 5 items have url + caption + ≥1 comment, call questExecution.submit({questId}). The gate will refuse if anything is missing — read the failure report.fix and act on it. Do NOT write quest stage directly; submit is the only path.",
    "",
    "Hard rule: 5 different farms. If you can't find 5 that satisfy the criteria, escalate via housekeeping.escalate rather than ship 4 + a placeholder.",
  ].join("\n");

  const res = await fetch(`https://api.cursor.com/v0/agents/${assignee.session_id}/followup`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${CURSOR_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt: { text: message } }),
  });
  const dispatchResp = await res.json();
  if (!res.ok) {
    console.error("Cursor dispatch failed:", res.status, JSON.stringify(dispatchResp));
    throw new Error("Dispatch failed");
  }
  console.log("Cursor followup dispatched:", JSON.stringify(dispatchResp).slice(0, 200));

  console.log("\n=== SMOKE TEST DISPATCHED ===");
  console.log(`Quest ID: ${quest.id}`);
  console.log(`Quest URL: http://localhost:3002/quest-board/${quest.id}`);
  console.log(`Assignee: ${assignee.name} (${assignee.session_id})`);
  console.log("Now monitor the quest. When agent submits (lockphrase comment lands), run the gates.");
}

run().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});

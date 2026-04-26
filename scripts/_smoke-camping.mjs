#!/usr/bin/env node
// Smoke test #2: cabin-with-bathroom camping near Russian River, available May 16-17.
// Dispatches to Researcher (the new generalist adventurer).

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SECRETE_KEY;
const CURSOR_API_KEY = process.env.CURSOR_API_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY || !CURSOR_API_KEY) {
  console.error("Missing env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRETE_KEY, CURSOR_API_KEY");
  process.exit(1);
}
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

const RESEARCHER_NAME = "Researcher";

const QUEST_TITLE = "Russian River cabin camping with bathroom — May 16-17 availability check";

const QUEST_DESCRIPTION = [
  "## Goal",
  "Find up to 5 cabin-with-private-bathroom camping options in the Russian River corridor (within ~30 miles of Guerneville, CA) with availability for May 16–17, 2026.",
  "",
  "## Source of truth",
  "Public booking pages on the campgrounds' own sites OR major aggregators (Hipcamp, Recreation.gov, KOA, ReserveCalifornia, etc.). Aggregator listings are fine for both discovery and as the artifact when listing exhaustion.",
  "",
  "## Russian River corridor (in scope)",
  "Guerneville, Monte Rio, Forestville, Cazadero, Healdsburg west, Duncans Mills, Jenner. Roughly Sonoma County coast and inland up to 30 miles from Guerneville.",
  "",
  "## Filter",
  "- Cabin (not tent / RV / glamping unless it has a private indoor bathroom)",
  "- Private bathroom (in-cabin, not shared bathhouse)",
  "- Available the night of May 16 → check-out May 17, 2026",
  "",
  "## Items (5 slots)",
  "If 5 distinct qualifying campgrounds exist, every item is one campground booking page (artifact type A).",
  "If fewer than 5 qualify (likely — these are restrictive filters), the remaining items hold listing-exhaustion artifacts (type B): a search/aggregator results page showing the filters applied and demonstrating no further qualifying options. Type B items MUST include an item_comments row whose text is 'no more options available' (literal phrase, plus any context).",
  "",
  "## Out of scope",
  "Tent sites, RV sites, glamping without bathroom, bathhouse-only setups, sites outside the Russian River corridor.",
].join("\n");

const ITEM_EXPECTATION = (n) => [
  `Camping option ${n} (Russian River corridor, May 16-17 cabin-with-bathroom).`,
  ``,
  `One of two valid artifact types:`,
  ``,
  `A) Booking-page artifact: a screenshot from the campground's own booking page (or the canonical aggregator listing for it) showing — together visibly:`,
  `   - the campground/cabin name`,
  `   - selected dates including May 16-17, 2026 (or May 16 → May 17)`,
  `   - cabin unit type with explicit private bathroom callout`,
  `   - an availability indicator (price, "Book", "Available", or equivalent)`,
  ``,
  `B) Listing-exhaustion artifact (only if fewer than 5 unique cabins-with-bathroom exist for these dates in the Russian River corridor): a screenshot of the aggregator/search results page showing — visibly:`,
  `   - applied filters: dates May 16-17, cabin type, private bathroom, Russian River geography`,
  `   - the visible result set fully accounted for in items 1..N OR showing no further matches`,
  ``,
  `Type B items MUST be accompanied by an item_comments row containing the literal phrase "no more options available".`,
  ``,
  `Items must be DIFFERENT campgrounds (no duplicates among type A); type B items can repeat if needed but each must show a distinct search/page.`,
].join("\n");

async function run() {
  const { data: anyAdv } = await db.from("adventurers").select("owner_id").limit(1).single();
  const ownerId = anyAdv?.owner_id;
  if (!ownerId) throw new Error("no owner");

  const { data: researcher } = await db
    .from("adventurers")
    .select("id, name, session_id, session_status")
    .eq("name", RESEARCHER_NAME)
    .single();
  if (!researcher) throw new Error(`Researcher adventurer not found`);
  console.log(`Researcher: ${researcher.id} session=${researcher.session_id} (${researcher.session_status})`);

  const deliverables = [];
  for (let n = 1; n <= 5; n++) {
    deliverables.push({ item_key: `camping_${n}`, expectation: ITEM_EXPECTATION(n) });
  }

  const { data: quest, error: qErr } = await db
    .from("quests")
    .insert({
      owner_id: ownerId,
      title: QUEST_TITLE,
      description: QUEST_DESCRIPTION,
      deliverables,
      stage: "execute",
      priority: "low",
      assignee_id: researcher.id,
      assigned_to: researcher.name,
    })
    .select()
    .single();
  if (qErr) throw new Error(`Quest insert failed: ${qErr.message}`);
  console.log(`Quest created: ${quest.id}`);

  const itemsRows = deliverables.map((d) => ({
    quest_id: quest.id,
    item_key: d.item_key,
    expectation: d.expectation,
  }));
  const { data: items, error: iErr } = await db
    .from("items")
    .insert(itemsRows)
    .select("id, item_key");
  if (iErr) throw new Error(`Items insert failed: ${iErr.message}`);
  console.log(`Seeded ${items.length} items`);

  const message = [
    `New quest assigned: ${QUEST_TITLE}`,
    `Quest ID: ${quest.id}`,
    "",
    "Boot if needed (housekeeping.initAgent), then load the quest with housekeeping.searchQuests. Read the description (strategic context) and the items rows (5 of them, each with the SAME flexible expectation that allows EITHER a booking-page artifact OR a listing-exhaustion artifact).",
    "",
    "Research up to 5 distinct qualifying campgrounds. For each found:",
    "  1. Open the campground/aggregator page and capture a screenshot showing the dates + cabin unit + private bathroom + availability indicator together visibly.",
    "  2. Read your screenshot to confirm it matches the expectation; recapture if not.",
    "  3. Upload to GuildOS_Bucket via supabase_storage.writeFile (path: cursor_cloud/<questId>/<filename>).",
    "  4. writeItem({ questId, item_key: 'camping_N', url, caption: <one-liner about what the screenshot actually shows — visually grounded, not what you read elsewhere on the site> }).",
    "  5. writeItemComment({ itemId, role: 'adventurer', actor_name: 'Researcher', text: <one-sentence rationale: why this satisfies the expectation> }).",
    "",
    "If you exhaust the Russian River corridor and find fewer than 5 qualifying campgrounds: fill remaining items with type-B listing-exhaustion artifacts (search results page showing applied filters + no further matches). Each type-B item MUST get an additional item_comment containing the literal phrase 'no more options available'.",
    "",
    "When all 5 items have url + caption + at least one item_comment, call questExecution.submit({questId}) from libs/weapon/questExecution. The gate enforces structural completeness; read result.report.fix on any failure.",
    "",
    "DO NOT write quest stage directly. submit() is the only path. Bypassing the gate is detected downstream by questPurrview.confirmSubmission and the quest will be rejected.",
    "",
    "Visual honesty: the caption + item_comment text must describe what is VISIBLE in your screenshot, not what you read elsewhere. T2 vision-judge will catch over-claims.",
  ].join("\n");

  const r = await fetch(`https://api.cursor.com/v0/agents/${researcher.session_id}/followup`, {
    method: "POST",
    headers: { Authorization: `Bearer ${CURSOR_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: { text: message } }),
  });
  const j = await r.json();
  if (!r.ok) {
    console.error("dispatch failed:", r.status, JSON.stringify(j));
    process.exit(1);
  }
  console.log("Dispatched. Quest URL: http://localhost:3002/quest-board/" + quest.id);
  console.log("Researcher session id:", researcher.session_id);
}

run().catch((e) => { console.error(e); process.exit(1); });

#!/usr/bin/env node
/**
 * run-quest-context.mjs — Fetch quest details for an adventurer during execution.
 *
 * Usage:
 *   node libs/adventurer/run-quest-context.mjs <questId>
 *
 * Output: JSON with { title, description, stage, inventory, comments, deliverables }
 *
 * Uses the service role database client (no user session needed).
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const [,, questId] = process.argv;

if (!questId) {
  console.error(JSON.stringify({ ok: false, error: "Usage: node libs/adventurer/run-quest-context.mjs <questId>" }));
  process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SECRETE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error(JSON.stringify({ ok: false, error: "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRETE_KEY in environment." }));
  process.exit(1);
}

const db = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

try {
  // Fetch quest
  const { data: quest, error: qErr } = await db
    .from("quests")
    .select("id, title, description, stage, inventory, deliverables, assigned_to, assignee_id, execution_plan, next_steps")
    .eq("id", questId)
    .single();

  if (qErr || !quest) {
    console.error(JSON.stringify({ ok: false, error: `Quest not found: ${qErr?.message || "no data"}` }));
    process.exit(1);
  }

  // Fetch recent comments
  const { data: comments } = await db
    .from("quest_comments")
    .select("source, action, summary, created_at")
    .eq("quest_id", questId)
    .order("created_at", { ascending: false })
    .limit(15);

  const recentComments = (comments || []).reverse().map((c) => ({
    source: c.source,
    action: c.action,
    summary: c.summary,
    at: c.created_at,
  }));

  // Normalize inventory
  let inventory = {};
  if (quest.inventory && typeof quest.inventory === "object" && !Array.isArray(quest.inventory)) {
    inventory = quest.inventory;
  }

  // Fetch adventurer details if assigned
  let adventurer = null;
  if (quest.assignee_id) {
    const { data: adv } = await db
      .from("adventurers")
      .select("name, system_prompt, skill_books")
      .eq("id", quest.assignee_id)
      .maybeSingle();
    if (adv) {
      adventurer = {
        name: adv.name,
        systemPrompt: adv.system_prompt,
        skillBooks: adv.skill_books || [],
      };
    }
  }

  console.log(JSON.stringify({
    ok: true,
    questId: quest.id,
    title: quest.title,
    description: quest.description,
    stage: quest.stage,
    assignedTo: quest.assigned_to,
    adventurer,
    deliverables: quest.deliverables,
    inventory,
    comments: recentComments,
  }, null, 2));
} catch (err) {
  console.error(JSON.stringify({ ok: false, error: err.message || String(err) }));
  process.exit(1);
}

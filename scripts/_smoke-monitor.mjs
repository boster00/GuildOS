#!/usr/bin/env node
// Poll quest 8e37080b state every 30s. Emit one line per meaningful state change.
// Exits when SUBMIT lockphrase comment lands, agent reports terminal status,
// or 30 minutes elapses.

import { createClient } from "@supabase/supabase-js";

const QUEST_ID = "2beac37f-6c7e-450d-9eb8-e642af41e3af";
const AGENT_SID = "bc-94eb142f-c1c2-4f4d-9af3-516ef7c24072";
const TIMEOUT_MS = 30 * 60 * 1000;

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRETE_KEY);
const cursorKey = process.env.CURSOR_API_KEY;

let lastAgentStatus = null;
let lastItemFilled = -1;
let lastStage = null;
let sawSubmitLockphrase = false;
const start = Date.now();

function emit(msg) {
  // single stdout line, line-buffered (Node default for console.log when piped is OK)
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`);
}

async function poll() {
  // Agent
  try {
    const r = await fetch(`https://api.cursor.com/v0/agents/${AGENT_SID}`, {
      headers: { Authorization: `Bearer ${cursorKey}` },
    });
    if (r.ok) {
      const j = await r.json();
      if (j.status !== lastAgentStatus) {
        emit(`AGENT status: ${lastAgentStatus || "(init)"} → ${j.status} | files=${j.filesChanged} +${j.linesAdded}/-${j.linesRemoved}`);
        lastAgentStatus = j.status;
      }
      if (j.status === "FINISHED" || j.status === "EXPIRED" || j.status === "ERROR") {
        // Don't exit yet — items may still need to be checked one final time.
      }
    }
  } catch (e) {
    emit(`AGENT poll failed: ${e.message}`);
  }

  // Quest stage
  try {
    const { data: q } = await db.from("quests").select("stage").eq("id", QUEST_ID).single();
    if (q && q.stage !== lastStage) {
      emit(`QUEST stage: ${lastStage || "(init)"} → ${q.stage}`);
      lastStage = q.stage;
    }
  } catch (e) {
    emit(`QUEST poll failed: ${e.message}`);
  }

  // Items state
  try {
    const { data: items } = await db
      .from("items")
      .select("item_key, url")
      .eq("quest_id", QUEST_ID);
    const filled = (items || []).filter((i) => i.url).length;
    if (filled !== lastItemFilled) {
      emit(`ITEMS filled: ${lastItemFilled === -1 ? 0 : lastItemFilled} → ${filled} / 5`);
      lastItemFilled = filled;
    }
  } catch (e) {
    emit(`ITEMS poll failed: ${e.message}`);
  }

  // Submit lockphrase
  try {
    const { data: comments } = await db
      .from("quest_comments")
      .select("source, action, summary")
      .eq("quest_id", QUEST_ID)
      .eq("source", "questExecution")
      .eq("action", "submit_for_purrview")
      .limit(1);
    if (!sawSubmitLockphrase && comments && comments.length > 0) {
      sawSubmitLockphrase = true;
      emit(`✓ SUBMIT LOCKPHRASE landed: ${String(comments[0].summary).slice(0, 200)}`);
      emit(`READY for T2 gate run`);
      process.exit(0);
    }
  } catch (e) {
    emit(`COMMENT poll failed: ${e.message}`);
  }

  // Recent quest_comments (catch escalations / errors)
  try {
    const { data: recent } = await db
      .from("quest_comments")
      .select("source, action, summary, created_at")
      .eq("quest_id", QUEST_ID)
      .order("created_at", { ascending: false })
      .limit(1);
    if (recent && recent.length > 0) {
      const c = recent[0];
      const age = Date.now() - new Date(c.created_at).getTime();
      if (age < 60_000 && c.action !== "submit_for_purrview") {
        emit(`COMMENT: ${c.source}.${c.action}: ${String(c.summary).slice(0, 150)}`);
      }
    }
  } catch (e) { /* ignore */ }

  if (Date.now() - start > TIMEOUT_MS) {
    emit("TIMEOUT after 30 min — exiting monitor; check state manually");
    process.exit(2);
  }
}

emit("Monitor armed. Polling every 30s for up to 30 min.");
await poll();
setInterval(poll, 30_000);

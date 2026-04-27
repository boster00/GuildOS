import { database } from "@/libs/council/database";
import { publicTables } from "@/libs/council/publicTables";
import { readAgent, writeFollowup, readConversation } from "@/libs/weapon/cursor/index.js";

const IS_PRODUCTION = process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production";

export async function runCron() {
  const db = await database.init("service");

  // ── 1. Roll call: derive adventurer statuses (always runs) ──
  await deriveAdventurerStatuses(db);

  // ── 2. User-feedback bounce: any review-stage quest with a fresh user
  //       feedback comment goes back to execute and the assigned agent
  //       gets a followup. Runs in all envs so dev can validate. ──
  await bounceReviewOnUserFeedback(db);

  // ── 3-4. Nudge + notify only in production (Vercel owns the nudge loop) ──
  if (IS_PRODUCTION) {
    await nudgeConfused(db);
    await notifyQuestmaster(db);
    await deriveAdventurerStatuses(db);
  }

  return { ok: true, production: IS_PRODUCTION };
}

// ---------------------------------------------------------------------------
// Derive adventurer status from Cursor API + quest state
// ---------------------------------------------------------------------------
//
//              has task (execute)    no task
// RUNNING      busy                 confused
// idle         confused             idle
// error/down   sick                 sick

async function deriveAdventurerStatuses(db) {
  const { data: adventurers } = await db
    .from(publicTables.adventurers)
    .select("id, session_id, session_status")
    .not("session_id", "is", null);

  if (!adventurers?.length) return;

  const { data: activeQuests } = await db
    .from(publicTables.quests)
    .select("assignee_id, stage")
    .in("stage", ["execute", "review", "escalated", "closing"]);

  const questsByAdventurer = {};
  for (const q of activeQuests || []) {
    if (!q.assignee_id) continue;
    if (!questsByAdventurer[q.assignee_id]) questsByAdventurer[q.assignee_id] = [];
    questsByAdventurer[q.assignee_id].push(q);
  }

  for (const adv of adventurers) {
    const quests = questsByAdventurer[adv.id] || [];
    // Only execute counts as "has task" — review/closing are owned by Cat/system, not the agent
    const hasTask = quests.some((q) => q.stage === "execute");
    let newStatus;

    try {
      const agent = await readAgent({ agentId: adv.session_id });
      const isBusy = agent?.status === "RUNNING";

      if (hasTask && isBusy) {
        newStatus = "busy";
      } else if (hasTask && !isBusy) {
        newStatus = "confused";
      } else if (!hasTask && isBusy) {
        newStatus = "confused";
      } else {
        newStatus = "idle";
      }
    } catch {
      newStatus = "sick";
    }

    if (newStatus !== adv.session_status) {
      await db
        .from(publicTables.adventurers)
        .update({ session_status: newStatus })
        .eq("id", adv.id);
    }
  }
}

// ---------------------------------------------------------------------------
// Nudge confused adventurers
// ---------------------------------------------------------------------------

const NUDGE_PREFIX = "[NUDGE]";

async function nudgeConfused(db) {
  const { data: adventurers } = await db
    .from(publicTables.adventurers)
    .select("id, name, session_id, session_status")
    .eq("session_status", "confused")
    .not("session_id", "is", null);

  if (!adventurers?.length) return;

  // Get quests assigned to each adventurer
  const { data: activeQuests } = await db
    .from(publicTables.quests)
    .select("id, title, assignee_id, stage, priority")
    .in("stage", ["execute", "escalated", "review", "closing"]);

  const questsByAdventurer = {};
  for (const q of activeQuests || []) {
    if (!q.assignee_id) continue;
    if (!questsByAdventurer[q.assignee_id]) questsByAdventurer[q.assignee_id] = [];
    questsByAdventurer[q.assignee_id].push(q);
  }

  for (const adv of adventurers) {
    const advQuests = questsByAdventurer[adv.id];
    if (!advQuests?.length) continue;

    try {
      // Skip if the most recent user_message is already a nudge
      const conv = await readConversation({ agentId: adv.session_id });
      const msgs = conv?.messages || [];
      const lastUserMsg = [...msgs].reverse().find((m) => m.type === "user_message");
      if (lastUserMsg?.text?.startsWith(NUDGE_PREFIX)) {
        console.log(`[cron] skipping nudge for ${adv.name} — last user msg is already a nudge`);
        continue;
      }


      const questList = advQuests.map((q) => `- [${q.priority}] "${q.title}" (${q.stage})`).join("\n");
      const ts = new Date().toISOString();
      await writeFollowup({
        agentId: adv.session_id,
        message: `${NUDGE_PREFIX} [${ts}] You have ${advQuests.length} active quest(s):\n${questList}\n\nWork on the highest-priority quest. Load its description, run your standard flow, and run housekeeping.verifyDeliverable before housekeeping.submitForPurrview. Do not wait for permission.\n\nIf you can't read the quest (missing ~/guildos checkout, missing SUPABASE_SECRETE_KEY, no DB access): run housekeeping.initAgent first to recover the environment, then retry. If initAgent itself cannot complete, escalate the quest with specifics — do not improvise deliverables.`,
      });
      console.log(`[cron] nudged confused adventurer: ${adv.name} (${adv.id})`);
    } catch (err) {
      console.error(`[cron] nudge failed for ${adv.name}:`, err.message);
    }
  }
}

// ---------------------------------------------------------------------------
// User-feedback bounce: review → execute when the user leaves feedback
// ---------------------------------------------------------------------------
//
// Trigger: a quest_comments row exists with source='user' + action='feedback'
// that is newer than the quest's most-recent entry-into-review marker
// (FINAL_GATE_PASS lockphrase, Cat's approve, or a prior self-bounce of the
// same kind). When that holds, write a system-bounce comment, flip the
// quest stage back to execute, and ping the assigned cursor agent with
// the feedback text so they can address it on resume.

async function bounceReviewOnUserFeedback(db) {
  const { data: quests } = await db
    .from(publicTables.quests)
    .select("id, title, assignee_id")
    .eq("stage", "review");

  if (!quests?.length) return;

  for (const q of quests) {
    const { data: comments } = await db
      .from(publicTables.questComments)
      .select("id, source, action, summary, created_at")
      .eq("quest_id", q.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (!comments?.length) continue;

    // Most recent user-feedback comment.
    const lastUserFeedback = comments.find(
      (c) => c.source === "user" && c.action === "feedback",
    );
    if (!lastUserFeedback) continue;

    // Most recent entry-into-review marker. Anything that signals the
    // quest re-entered review *after* the feedback would mean the user's
    // feedback has already been addressed (worker resubmitted, Cat
    // approved, local Claude passed final gate).
    const lastReviewMarker = comments.find((c) =>
      c.action === "final_gate_pass" ||
      c.action === "approve" ||
      c.action === "review_bounce_user_feedback"
    );

    if (lastReviewMarker && new Date(lastReviewMarker.created_at) >= new Date(lastUserFeedback.created_at)) {
      continue; // feedback already addressed
    }

    const feedbackText = (lastUserFeedback.summary || "").trim();
    const trimmed = feedbackText.slice(0, 80);

    // Audit comment first, so the stage-log trigger has context if you query it later.
    await db.from(publicTables.questComments).insert({
      quest_id: q.id,
      source: "system",
      action: "review_bounce_user_feedback",
      summary: `Bounced from review back to execute: user left feedback ("${trimmed}${feedbackText.length > 80 ? "…" : ""}"). Agent should address before re-submitting.`,
      detail: {
        user_feedback_id: lastUserFeedback.id,
        user_feedback_text: feedbackText,
      },
    });

    // Stage flip — the trigger writes quest_stage_log automatically.
    await db.from(publicTables.quests).update({ stage: "execute" }).eq("id", q.id);

    // Notify the assigned agent so they see the feedback ASAP, not just on
    // the next nudge sweep.
    if (q.assignee_id) {
      const { data: adv } = await db
        .from(publicTables.adventurers)
        .select("session_id, name")
        .eq("id", q.assignee_id)
        .maybeSingle();
      if (adv?.session_id) {
        try {
          await writeFollowup({
            agentId: adv.session_id,
            message: `[USER FEEDBACK] Quest "${q.title}" was in review and the user left this feedback:\n\n"${feedbackText}"\n\nThe quest has been bounced back to execute. Read the user's note carefully, address what they're asking for, then re-submit via housekeeping.submitForPurrview. The user's feedback is the contract — do not re-submit until you've addressed it.`,
          });
          console.log(`[cron] feedback-bounced quest "${q.title}" → execute, notified ${adv.name}`);
        } catch (err) {
          console.error(`[cron] feedback nudge failed for ${adv.name}:`, err.message);
        }
      } else {
        console.log(`[cron] feedback-bounced quest "${q.title}" → execute (no session_id on assignee, agent not notified)`);
      }
    } else {
      console.log(`[cron] feedback-bounced quest "${q.title}" → execute (no assignee, nobody to notify)`);
    }
  }
}

// ---------------------------------------------------------------------------
// Notify Questmaster (Cat) about purrview + closing quests
// ---------------------------------------------------------------------------

async function notifyQuestmaster(db) {
  const { data: quests } = await db
    .from(publicTables.quests)
    .select("id, title, stage, assigned_to")
    .in("stage", ["purrview", "closing"])
    .limit(20);

  if (!quests?.length) return;

  // Re-read the same rows by id so we never nudge Cat off a stale snapshot
  // (quest advanced to review/complete between the filtered SELECT and notify).
  const ids = [...new Set(quests.map((q) => q.id))];
  const { data: freshRows, error: freshErr } = await db
    .from(publicTables.quests)
    .select("id, title, stage, assigned_to")
    .in("id", ids);
  if (freshErr) {
    console.error("[cron] notifyQuestmaster re-verify failed:", freshErr.message);
    return;
  }
  const freshById = new Map((freshRows || []).map((r) => [r.id, r]));
  const verified = [];
  for (const q of quests) {
    const row = freshById.get(q.id);
    if (row && (row.stage === "purrview" || row.stage === "closing")) verified.push(row);
  }
  if (!verified.length) {
    console.log("[cron] notifyQuestmaster: purrview/closing list empty after re-verify — skipping nudge");
    return;
  }

  const { data: cat } = await db
    .from(publicTables.adventurers)
    .select("session_id, session_status")
    .eq("name", "Cat")
    .single();

  if (!cat?.session_id || cat.session_status === "inactive") return;

  // Check for queued nudge to Cat
  const conv = await readConversation({ agentId: cat.session_id });
  const msgs = conv?.messages || [];
  const lastMsg = msgs[msgs.length - 1];
  const lastAssistantIdx = msgs.findLastIndex((m) => m.type === "assistant_message");
  const queuedMsgs = msgs.slice(lastAssistantIdx + 1);
  if (queuedMsgs.some((m) => m.type === "user_message" && m.text?.startsWith("[NUDGE]"))) return;

  const purrviewQuests = verified.filter((q) => q.stage === "purrview");
  const closingQuests = verified.filter((q) => q.stage === "closing");

  const lines = [];
  if (purrviewQuests.length) {
    lines.push(`**Purrview (${purrviewQuests.length})** — review deliverables, approve or send feedback:`);
    for (const q of purrviewQuests) lines.push(`- "${q.title}" by ${q.assigned_to || "unassigned"} (id: ${q.id})`);
  }
  if (closingQuests.length) {
    lines.push(`**Closing (${closingQuests.length})** — archive to Asana:`);
    for (const q of closingQuests) lines.push(`- "${q.title}" (id: ${q.id})`);
  }

  try {
    await writeFollowup({
      agentId: cat.session_id,
      message: `[NUDGE] [${new Date().toISOString()}] You have quests needing attention:\n\n${lines.join("\n")}\n\nFor purrview: read quest description + inventory, evaluate deliverables. If 90%+ satisfied, move to review. If not, add feedback comment and move back to execute.\nFor closing: archive summary to Asana, then move to complete.`,
    });
    console.log(`[cron] notified Cat: ${purrviewQuests.length} purrview, ${closingQuests.length} closing`);
  } catch (err) {
    console.error(`[cron] Cat notify failed:`, err.message);
  }
}

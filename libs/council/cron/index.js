import { database } from "@/libs/council/database";
import { publicTables } from "@/libs/council/publicTables";
import { readAgent, writeFollowup, readConversation, syncSessionStatus } from "@/libs/weapon/cursor/index.js";
import { respawnAdventurer } from "@/libs/skill_book/guildmaster/index.js";

const IS_PRODUCTION = process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production";

/** Adventurers eligible for auto-respawn when EXPIRED. Conservative whitelist:
 *  high-value automation targets only. Workers stay manual-respawn so a human
 *  decides whether the spawn prompt should change first. */
const AUTO_RESPAWN_NAMES = new Set(["Cat"]);

/** Min interval between auto-respawns of the same adventurer — circuit
 *  breaker against an infinite respawn loop if something deeper is wrong.
 *  Set to 24h because the backstory marker only carries date resolution
 *  (YYYY-MM-DD); a same-day prior auto-respawn blocks a new one this tick. */
const AUTO_RESPAWN_COOLDOWN_MS = 24 * 60 * 60_000; // 24 hours

export async function runCron() {
  const db = await database.init("service");

  // ── 0. Reconcile upstream cursor session lifecycle ──
  //    syncSessionStatus per adventurer so DB session_status reflects what
  //    cursor.com actually thinks. Catches FINISHED/EXPIRED/deleted sessions
  //    before downstream nudge logic tries to followup against a corpse.
  //    Also surfaces a "needs respawn" log line when a non-dispatchable
  //    adventurer has assigned active quests.
  await reconcileSessionLifecycle(db);

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
// Reconcile upstream cursor session lifecycle into DB session_status.
// ---------------------------------------------------------------------------
//
// Why this exists: cursor.com keeps its own session lifecycle (RUNNING →
// FINISHED → EXPIRED). The adventurers table doesn't auto-reflect upstream
// state, so for a long time a Cat session that had FINISHED upstream still
// looked "idle" in the DB and the nudge loop kept trying to followup against
// a dead session. Now we run syncSessionStatus on every cron tick so the
// DB is the truth. The extra cost is N HTTP GETs (~N adventurers, currently 5).
//
// When an adventurer is non-dispatchable (EXPIRED / deleted) AND has active
// assigned quests, we log a needs_respawn warning so the Guildmaster sees it.
// We don't auto-respawn (that's a manual decision — sometimes the user wants
// a fresh prompt, sometimes the same prompt; cursor.writeAgent must be
// called explicitly via the locked path).

export async function reconcileSessionLifecycle(db) {
  const { data: adventurers } = await db
    .from(publicTables.adventurers)
    .select("id, name, session_id, session_status")
    .not("session_id", "is", null);

  if (!adventurers?.length) return { reconciled: 0, needsRespawn: [] };

  let reconciled = 0;
  const needsRespawn = [];

  for (const adv of adventurers) {
    let sync;
    try {
      sync = await syncSessionStatus({ adventurerId: adv.id });
    } catch (err) {
      console.error(`[cron] syncSessionStatus failed for ${adv.name}:`, err.message);
      continue;
    }
    if (sync.was_drift) {
      reconciled += 1;
      console.log(
        `[cron] reconciled ${adv.name}: db said ${adv.session_status}, upstream=${sync.upstream_status} → set to ${sync.adventurer.session_status}`,
      );
    }

    // Non-dispatchable AND has agent-actionable quests = needs_respawn.
    //
    // Only `execute` and `escalated` stages require the assigned agent to
    // act next. `purrview` is Cat's read; `review` is Guildmaster's
    // final-gate; `closing` is the questmaster's archive step. So an
    // EXPIRED agent whose quests are all in review/closing is fine — the
    // work has moved on, we just haven't recommissioned the agent yet.
    //
    // Special case: Cat (the Questmaster) is dispatched by purrview-stage
    // quests, not execute. She's also on the AUTO_RESPAWN_NAMES whitelist
    // and gets respawned automatically when EXPIRED. Other agents are
    // manual-respawn only — a human should decide whether the spawn prompt
    // should change first.
    const queueStages =
      adv.name === "Cat" ? ["purrview"] : ["execute", "escalated"];
    if (!sync.dispatch_safe) {
      const { data: quests } = await db
        .from(publicTables.quests)
        .select("id, title, stage")
        .eq("assignee_id", adv.id)
        .in("stage", queueStages);
      const hasWork = quests?.length > 0;

      // For Cat, also count purrview quests not yet assigned to anyone (the
      // assignee_id filter above misses them; cron's notifyQuestmaster picks
      // them up regardless of assignee).
      let unassignedPurrview = 0;
      if (adv.name === "Cat") {
        const { data: floats } = await db
          .from(publicTables.quests)
          .select("id")
          .eq("stage", "purrview")
          .is("assignee_id", null);
        unassignedPurrview = floats?.length || 0;
      }

      const totalWaiting = (quests?.length || 0) + unassignedPurrview;
      if (totalWaiting > 0) {
        needsRespawn.push({
          adventurer: adv.name,
          adventurer_id: adv.id,
          session_id: adv.session_id,
          upstream_status: sync.upstream_status,
          quest_count: totalWaiting,
          quest_titles: (quests || []).map((q) => `${q.title} (${q.stage})`).slice(0, 5),
        });

        // Auto-respawn EXPIRED sessions for whitelisted high-value adventurers.
        // Circuit breaker: skip if we respawned this adventurer within the
        // cooldown window — prevents infinite respawn loops if something
        // deeper is broken (e.g. spawn prompt itself causes the session to
        // crash).
        if (
          AUTO_RESPAWN_NAMES.has(adv.name) &&
          sync.upstream_status === "EXPIRED"
        ) {
          const lastRespawn = await getLastAutoRespawnAt(db, adv.id);
          if (lastRespawn && Date.now() - lastRespawn < AUTO_RESPAWN_COOLDOWN_MS) {
            console.warn(
              `[cron] auto-respawn SKIPPED for ${adv.name}: cooldown (last respawn ${new Date(lastRespawn).toISOString()})`,
            );
          } else {
            try {
              const r = await respawnAdventurer(
                { name: adv.name, reason: `auto-respawn: upstream session EXPIRED with ${totalWaiting} pending purrview quest(s)` },
                null,
              );
              console.log(
                `[cron] auto-respawned ${adv.name}: ${r.prior_session_id} → ${r.new_session_id} (upstream=${r.upstream_status})`,
              );
              await markAutoRespawn(db, adv.id, r.new_session_id);
            } catch (err) {
              console.error(`[cron] auto-respawn FAILED for ${adv.name}: ${err.message}`);
            }
          }
        }
      }
    }
  }

  if (needsRespawn.length > 0) {
    console.warn(
      `[cron] needs_respawn — ${needsRespawn.length} adventurer(s) non-dispatchable with active quests:`,
      JSON.stringify(needsRespawn, null, 2),
    );
  }

  return { reconciled, needsRespawn };
}

/** Read the timestamp of the most recent cron auto-respawn for this
 *  adventurer by parsing the backstory archive notes. Returns null if none.
 *
 *  The backstory note format (set by guildmaster.respawnAdventurer) is:
 *    [YYYY-MM-DD archived prior <Name> session bc-... — <reason>. New session: bc-....]
 *
 *  Notes containing "auto-respawn" in the reason are cron-triggered. */
async function getLastAutoRespawnAt(db, adventurerId) {
  const { data } = await db
    .from(publicTables.adventurers)
    .select("backstory")
    .eq("id", adventurerId)
    .single();
  const text = data?.backstory || "";
  // Find the most recent auto-respawn line (the format puts the date first,
  // and we appended in order so the LAST occurrence wins).
  const re = /\[(\d{4}-\d{2}-\d{2})[^\]]*auto-respawn[^\]]*\]/g;
  let lastMatch = null;
  for (const m of text.matchAll(re)) lastMatch = m;
  if (!lastMatch) return null;
  // The date in the marker is just YYYY-MM-DD; treat as midnight UTC. The
  // cooldown window (1h) has a much smaller resolution than the date, so this
  // is conservative: any same-day auto-respawn blocks a new one.
  return new Date(`${lastMatch[1]}T00:00:00Z`).getTime();
}

/** No-op kept for symmetry — the backstory already gets the audit note via
 *  guildmaster.respawnAdventurer's archive line, so we don't need a second
 *  audit row. Function exists so the call site reads naturally. */
async function markAutoRespawn(_db, _adventurerId, _newSessionId) {
  // intentionally empty
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

export async function bounceReviewOnUserFeedback(db) {
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
    .limit(40);

  if (!quests?.length) return;

  const { data: cat } = await db
    .from(publicTables.adventurers)
    .select("session_id, session_status")
    .eq("name", "Cat")
    .single();

  if (!cat?.session_id || cat.session_status === "inactive") return;

  // Filter purrview quests to only those that legitimately reached purrview
  // through the questExecution.submit gate (the SUBMIT lockphrase comment is
  // present). Legacy or backfilled quests without the lockphrase would force
  // Cat to bounce/escalate them — wastes a turn and clutters the inbox.
  const purrviewCandidates = quests.filter((q) => q.stage === "purrview");
  const closingQuests = quests.filter((q) => q.stage === "closing");
  let purrviewQuests = [];
  if (purrviewCandidates.length > 0) {
    const { data: gateRows } = await db
      .from(publicTables.questComments)
      .select("quest_id")
      .in("quest_id", purrviewCandidates.map((q) => q.id))
      .eq("source", "questExecution")
      .eq("action", "submit_for_purrview");
    const gated = new Set((gateRows || []).map((r) => r.quest_id));
    purrviewQuests = purrviewCandidates.filter((q) => gated.has(q.id));
    const stranded = purrviewCandidates.length - purrviewQuests.length;
    if (stranded > 0) {
      console.log(
        `[cron] notifyQuestmaster: skipping ${stranded} purrview quest(s) without questExecution.submit lockphrase (legacy/stranded; need worker resubmit)`,
      );
    }
  }

  if (!purrviewQuests.length && !closingQuests.length) return;

  // Check for queued nudge to Cat
  const conv = await readConversation({ agentId: cat.session_id });
  const msgs = conv?.messages || [];
  const lastAssistantIdx = msgs.findLastIndex((m) => m.type === "assistant_message");
  const queuedMsgs = msgs.slice(lastAssistantIdx + 1);
  if (queuedMsgs.some((m) => m.type === "user_message" && m.text?.startsWith("[NUDGE]"))) return;

  const lines = [];
  if (purrviewQuests.length) {
    lines.push(`**Purrview (${purrviewQuests.length})** — script-locked review (mandatory \`judge_origin\` per item):`);
    for (const q of purrviewQuests) lines.push(`- "${q.title}" by ${q.assigned_to || "unassigned"} (id: ${q.id})`);
  }
  if (closingQuests.length) {
    lines.push(`\n**Closing (${closingQuests.length})** — archive to Asana, then advance to complete:`);
    for (const q of closingQuests) lines.push(`- "${q.title}" (id: ${q.id})`);
  }

  try {
    await writeFollowup({
      agentId: cat.session_id,
      message: `[NUDGE] [${new Date().toISOString()}] You have quests needing attention:\n\n${lines.join("\n")}\n\nFor each purrview quest: prefer \`questmaster.runReviewLoop({questId})\` for image-only quests — one call runs confirmSubmission → openai_images.judge per item → approve/bounce. Result tells you what happened (action: 'approved' | 'bounced' | 'manual_required'). Fall back to the manual reviewSubmission howTo only when items are non-image or you need a tiebreaker.\n\nFor closing: archive summary to Asana via questmaster.closeQuest, then questmaster moves stage to complete.`,
    });
    console.log(`[cron] notified Cat: ${purrviewQuests.length} purrview, ${closingQuests.length} closing`);
  } catch (err) {
    console.error(`[cron] Cat notify failed:`, err.message);
  }
}

/**
 * questPurrview weapon — Questmaster-side quest stage transitions.
 *
 * Owns the QUESTMASTER's view: how Cat verifies a worker handoff and decides
 * whether the quest goes forward (purrview → review) or back (purrview → execute).
 * Sister weapon: `questExecution` owns the worker's `submit` path.
 *
 * Three actions, all script-locked:
 *   - `confirmSubmission` — verify the worker's `submit` lockphrase before opening
 *                           any screenshot. No phrase, no review.
 *   - `approve`           — purrview → review. Requires per-item Cat verdicts, all
 *                           must be 'pass'. Writes the next-stage lockphrase.
 *   - `bounce`            — purrview → execute. Requires per-item Cat verdicts with
 *                           ≥1 'fail' and a reason. Writes the bounce lockphrase.
 *
 * Auth: uses the service-role DB facade (`database.init("service")`).
 * No external API. Reads + writes `quests`, `items`, `item_comments`, `quest_comments`.
 */

import { database } from "@/libs/council/database";
import { publicTables } from "@/libs/council/publicTables";
import { SUBMIT_LOCKPHRASE } from "@/libs/weapon/questExecution";

export const toc = {
  confirmSubmission:
    "Verify a quest reached purrview through questExecution.submit (lockphrase comment present). Run BEFORE opening any screenshot — no comment, no review.",
  approve:
    "Move a quest from purrview to review. Hard-gated: requires submit lockphrase + per-item verdicts (all 'pass'). Writes the review-handoff lockphrase.",
  bounce:
    "Move a quest from purrview back to execute. Hard-gated: requires submit lockphrase + per-item verdicts with ≥1 'fail' + a reason. Writes the bounce lockphrase.",
};

export const GATE_VERSION = 1;

/** Default actor name for Cat-side comments. Override via the caller's input
 *  if multi-questmaster setups exist down the road. */
const QUESTMASTER_ACTOR_DEFAULT = "Cat";

/** Worker → Questmaster handoff lockphrase (set by questExecution.submit). */
// (imported above as SUBMIT_LOCKPHRASE)

/** Questmaster → user/GM-desk handoff lockphrase (set by approve). */
export const APPROVE_LOCKPHRASE = "this quest now meets the criteria for review";

/** Questmaster → worker handback lockphrase (set by bounce). */
export const BOUNCE_LOCKPHRASE = "this quest has been bounced back to execute";

const APPROVE_CRITERIA_CHECKED = [
  "questId is a non-empty string",
  "quest exists",
  "quest.stage === 'purrview'",
  "questExecution.submit lockphrase comment present (worker handoff verified)",
  "perItemVerdicts is a non-empty array",
  "perItemVerdicts.length === items.length and every item_key matched",
  "every verdict === 'pass'",
  "one item_comments row written per verdict (role='questmaster')",
  "stage write to review verified by SELECT-back",
];

const BOUNCE_CRITERIA_CHECKED = [
  "questId is a non-empty string",
  "quest exists",
  "quest.stage === 'purrview'",
  "questExecution.submit lockphrase comment present (worker handoff verified)",
  "perItemVerdicts is a non-empty array",
  "perItemVerdicts.length === items.length and every item_key matched",
  "≥1 verdict === 'fail'",
  "reason is a non-empty string",
  "one item_comments row written per verdict (role='questmaster')",
  "stage write back to execute verified by SELECT-back",
];

// ---------------------------------------------------------------------------
// confirmSubmission — read-side gate. Questmaster runs this BEFORE reviewing.
// ---------------------------------------------------------------------------

/**
 * Verify the quest reached `purrview` through `questExecution.submit`
 * (not a bare stage write). Looks for the SUBMIT_LOCKPHRASE comment.
 *
 * Questmaster contract: run this BEFORE opening any deliverable URL. If it
 * returns ok:false, the quest didn't pass through the gate — bounce it back
 * to execute or escalate, do NOT start review.
 *
 * @param {{ questId: string }} args
 */
export async function confirmSubmission({ questId }) {
  if (typeof questId !== "string" || !questId.trim()) {
    return { ok: false, reason: "questId_required", msg: "questId is required (non-empty string)." };
  }

  const db = await database.init("service");

  const { data: quest, error: qErr } = await db
    .from(publicTables.quests)
    .select("id, stage, title")
    .eq("id", questId)
    .single();
  if (qErr || !quest) {
    return { ok: false, reason: "quest_not_found", msg: qErr?.message || "Quest not found." };
  }
  if (quest.stage !== "purrview") {
    return {
      ok: false,
      reason: "wrong_stage",
      msg: `Quest stage is "${quest.stage}", expected "purrview". Quest is not awaiting Questmaster review.`,
      current_stage: quest.stage,
    };
  }

  const { data: gateComments, error: cErr } = await db
    .from(publicTables.questComments)
    .select("id, source, action, summary, detail, created_at")
    .eq("quest_id", questId)
    .eq("source", "questExecution")
    .eq("action", "submit_for_purrview")
    .order("created_at", { ascending: false })
    .limit(1);
  if (cErr) {
    return { ok: false, reason: "comments_read_failed", msg: cErr.message };
  }
  const gate = gateComments?.[0];
  if (!gate) {
    return {
      ok: false,
      reason: "no_gate_comment",
      msg: "No questExecution.submit_for_purrview comment found. Quest reached purrview without passing through the gate. Bounce back to execute and require submit().",
    };
  }

  const summary = String(gate.summary || "");
  const detailLock =
    gate.detail && typeof gate.detail === "object" ? String(gate.detail.lockphrase || "") : "";
  const summaryHasPhrase = summary.toLowerCase().includes(SUBMIT_LOCKPHRASE.toLowerCase());
  const detailHasPhrase = detailLock.toLowerCase() === SUBMIT_LOCKPHRASE.toLowerCase();
  if (!summaryHasPhrase && !detailHasPhrase) {
    return {
      ok: false,
      reason: "lockphrase_missing",
      msg: `Gate comment exists but lockphrase "${SUBMIT_LOCKPHRASE}" is absent from both summary and detail.lockphrase. Treating as untrusted.`,
      gate_comment_id: gate.id,
    };
  }

  // Items ARE the spec post-merge — return them shaped for Cat to grade against
  // (each row carries expectation + url + caption; per-item Cat verdict goes back
  // through approve/bounce by item_key).
  const { data: items } = await db
    .from(publicTables.items)
    .select("id, item_key, expectation, url, caption")
    .eq("quest_id", questId);

  return {
    ok: true,
    msg: "Submission gate verified. Safe to begin review.",
    gate_version: gate.detail?.gate_version ?? null,
    items_count: items?.length ?? 0,
    items: items || [],
    submitted_at: gate.created_at,
  };
}

// ---------------------------------------------------------------------------
// approve — purrview → review with per-item Cat verdicts (all pass)
// ---------------------------------------------------------------------------

/**
 * @param {{ questId: string, perItemVerdicts: Array<{item_key: string, verdict: 'pass'|'fail', text: string}>, summary?: string, actor_name?: string }} args
 */
export async function approve({ questId, perItemVerdicts, summary: approvalSummary, actor_name = QUESTMASTER_ACTOR_DEFAULT }) {
  const pre = await preflightStageTransition({ questId, perItemVerdicts, requiredStage: "purrview" });
  if (!pre.ok) return pre.failure;
  const { db, items, normalizedVerdicts } = pre;

  // Approve-specific gate: every verdict === 'pass'
  const fails = normalizedVerdicts.filter((v) => v.verdict !== "pass");
  if (fails.length > 0) {
    return {
      ok: false,
      failed: ["verdict_not_all_pass"],
      report: {
        msg: `${fails.length} verdict(s) are not 'pass'. Approve requires every item to pass.`,
        fix: "Use bounce({ questId, perItemVerdicts, reason }) to send the quest back to execute with the failure feedback.",
        failing_item_keys: fails.map((v) => v.item_key),
      },
    };
  }

  // Write per-item verdict comments (role='questmaster')
  const writeRes = await writeVerdictComments(db, items, normalizedVerdicts, "approve", actor_name);
  if (!writeRes.ok) return writeRes.failure;

  // Advance stage with SELECT-back verify
  const stageRes = await writeStage(db, questId, "review");
  if (!stageRes.ok) return stageRes.failure;

  // Lockphrase quest-level comment
  const lockSummary = `Approve gate v${GATE_VERSION} passed. ${normalizedVerdicts.length}/${items.length} items pass. ${capitalize(APPROVE_LOCKPHRASE)}.${approvalSummary ? ` ${actor_name} note: ${approvalSummary}` : ""}`;
  const { error: commentErr } = await db.from(publicTables.questComments).insert({
    quest_id: questId,
    source: "questPurrview",
    action: "approve",
    summary: lockSummary,
    actor_name,
    detail: {
      gate_version: GATE_VERSION,
      lockphrase: APPROVE_LOCKPHRASE,
      criteria_checked: APPROVE_CRITERIA_CHECKED,
      items_count: items.length,
      perItemVerdicts: normalizedVerdicts,
      questmaster_summary: approvalSummary || null,
    },
  });
  if (commentErr) {
    return {
      ok: false,
      failed: ["lockphrase_comment_write"],
      report: {
        msg: `Stage moved to review but the lockphrase audit comment failed to write: ${commentErr.message}.`,
        fix: `Manually insert a quest_comments row with the phrase "${APPROVE_LOCKPHRASE}" so the GM-desk script trusts the handoff.`,
        partial: true,
        stage: "review",
      },
    };
  }

  return {
    ok: true,
    stage: "review",
    items_count: items.length,
    lockphrase: APPROVE_LOCKPHRASE,
    criteria_checked: APPROVE_CRITERIA_CHECKED,
  };
}

// ---------------------------------------------------------------------------
// bounce — purrview → execute with per-item Cat verdicts (≥1 fail) + reason
// ---------------------------------------------------------------------------

/**
 * @param {{ questId: string, perItemVerdicts: Array<{item_key: string, verdict: 'pass'|'fail', text: string}>, reason: string }} args
 */
export async function bounce({ questId, perItemVerdicts, reason, actor_name = QUESTMASTER_ACTOR_DEFAULT }) {
  if (typeof reason !== "string" || !reason.trim()) {
    return {
      ok: false,
      failed: ["reason_required"],
      report: {
        msg: "bounce requires a non-empty `reason` string.",
        fix: "Pass { reason: '<one paragraph: what failed across the quest, what worker should fix>' }.",
      },
    };
  }

  const pre = await preflightStageTransition({ questId, perItemVerdicts, requiredStage: "purrview" });
  if (!pre.ok) return pre.failure;
  const { db, items, normalizedVerdicts } = pre;

  // Bounce-specific gate: at least one verdict === 'fail'
  const fails = normalizedVerdicts.filter((v) => v.verdict === "fail");
  if (fails.length === 0) {
    return {
      ok: false,
      failed: ["no_failures"],
      report: {
        msg: "bounce requires at least one verdict === 'fail'. All verdicts are pass — use approve() instead.",
        fix: "If the quest passes, call approve({ questId, perItemVerdicts }).",
      },
    };
  }

  // Bounce-loop detection: count prior BOUNCE comments per failing item_key.
  // Doesn't block — surfaces the count so the worker / Guildmaster can decide
  // whether to escalate instead of running yet another retry.
  const failingItemIds = items
    .filter((it) => fails.some((f) => f.item_key === it.item_key))
    .map((i) => i.id);
  const priorBounces = await countPriorBounces(db, failingItemIds);

  // Write per-item verdict comments
  const writeRes = await writeVerdictComments(db, items, normalizedVerdicts, "bounce", actor_name);
  if (!writeRes.ok) return writeRes.failure;

  // Move stage back to execute with SELECT-back verify
  const stageRes = await writeStage(db, questId, "execute");
  if (!stageRes.ok) return stageRes.failure;

  const failingKeys = fails.map((v) => v.item_key);
  const chronicKeys = failingKeys.filter((k) => {
    const itemId = items.find((i) => i.item_key === k)?.id;
    return itemId && (priorBounces.get(itemId) || 0) >= 2; // 2 prior + this one = 3rd bounce
  });
  const lockSummary = `Bounce gate v${GATE_VERSION} passed. ${fails.length} item(s) failed: ${failingKeys.join(", ")}. ${capitalize(BOUNCE_LOCKPHRASE)}. Reason: ${reason}${chronicKeys.length > 0 ? ` ⚠️ Chronic-bounce items (3+ bounces): ${chronicKeys.join(", ")} — consider escalating instead of resubmitting.` : ""}`;
  const { error: commentErr } = await db.from(publicTables.questComments).insert({
    quest_id: questId,
    source: "questPurrview",
    action: "bounce",
    summary: lockSummary,
    actor_name,
    detail: {
      gate_version: GATE_VERSION,
      lockphrase: BOUNCE_LOCKPHRASE,
      criteria_checked: BOUNCE_CRITERIA_CHECKED,
      reason,
      failing_item_keys: failingKeys,
      perItemVerdicts: normalizedVerdicts,
    },
  });
  if (commentErr) {
    return {
      ok: false,
      failed: ["lockphrase_comment_write"],
      report: {
        msg: `Stage moved to execute but the bounce audit comment failed to write: ${commentErr.message}.`,
        fix: `Manually insert a quest_comments row with the phrase "${BOUNCE_LOCKPHRASE}" + reason so the worker knows what to fix.`,
        partial: true,
        stage: "execute",
      },
    };
  }

  return {
    ok: true,
    stage: "execute",
    items_count: items.length,
    failing_count: fails.length,
    failing_item_keys: failingKeys,
    chronic_bounce_keys: chronicKeys, // item_keys that have now bounced 3+ times — caller should consider escalating
    prior_bounce_counts: Object.fromEntries(
      failingItemIds.map((id) => {
        const it = items.find((i) => i.id === id);
        return [it?.item_key, priorBounces.get(id) || 0];
      }),
    ),
    lockphrase: BOUNCE_LOCKPHRASE,
    criteria_checked: BOUNCE_CRITERIA_CHECKED,
  };
}

/** Count prior bounce comments per item (across both Cat and Guildmaster bounces). */
async function countPriorBounces(db, itemIds) {
  if (!itemIds.length) return new Map();
  const { data } = await db
    .from(publicTables.itemComments)
    .select("item_id, text")
    .in("item_id", itemIds);
  const counts = new Map();
  for (const c of data || []) {
    if (typeof c.text === "string" && /BOUNCE.*:fail/i.test(c.text)) {
      counts.set(c.item_id, (counts.get(c.item_id) || 0) + 1);
    }
  }
  return counts;
}

// ---------------------------------------------------------------------------
// shared preflight — gates 1–6 are common to approve and bounce
// ---------------------------------------------------------------------------

/**
 * Returns either { ok: true, db, items, normalizedVerdicts } or { ok: false, failure: <skill-shaped error> }.
 */
async function preflightStageTransition({ questId, perItemVerdicts, requiredStage }) {
  if (typeof questId !== "string" || !questId.trim()) {
    return {
      ok: false,
      failure: {
        ok: false,
        failed: ["questId"],
        report: { msg: "questId is required (non-empty string).", fix: "Pass { questId: '<uuid>' }." },
      },
    };
  }
  if (!Array.isArray(perItemVerdicts) || perItemVerdicts.length === 0) {
    return {
      ok: false,
      failure: {
        ok: false,
        failed: ["perItemVerdicts_required"],
        report: {
          msg: "perItemVerdicts is required: a non-empty array of {item_key, verdict, text}.",
          fix: "After running confirmSubmission, judge each deliverable and pass the verdicts here.",
        },
      },
    };
  }

  const db = await database.init("service");

  // Worker handoff must be verified — same logic as confirmSubmission.
  const confirm = await confirmSubmission({ questId });
  if (!confirm.ok) {
    return {
      ok: false,
      failure: {
        ok: false,
        failed: ["confirmSubmission_failed"],
        report: {
          msg: `Worker handoff not verified: ${confirm.msg}`,
          fix: "Cannot approve/bounce a quest that didn't reach purrview through questExecution.submit. Bounce back to execute or escalate.",
          confirmSubmissionReason: confirm.reason,
        },
      },
    };
  }
  // confirmSubmission also enforces stage === 'purrview'; redundant guard for clarity:
  if (requiredStage !== "purrview") {
    return {
      ok: false,
      failure: {
        ok: false,
        failed: ["unsupported_stage"],
        report: { msg: `preflightStageTransition only supports requiredStage='purrview'.` },
      },
    };
  }

  const { data: items, error: iErr } = await db
    .from(publicTables.items)
    .select("id, item_key")
    .eq("quest_id", questId);
  if (iErr) {
    return {
      ok: false,
      failure: {
        ok: false,
        failed: ["items_read"],
        report: { msg: iErr.message, fix: "DB read against `items` failed." },
      },
    };
  }
  const itemList = items || [];

  // Normalize verdicts and require 1:1 match against items
  const normalizedVerdicts = perItemVerdicts
    .map((v) => {
      if (!v || typeof v !== "object") return null;
      const item_key = typeof v.item_key === "string" ? v.item_key.trim() : "";
      const verdict = v.verdict === "pass" ? "pass" : v.verdict === "fail" ? "fail" : null;
      const text = typeof v.text === "string" ? v.text.trim() : "";
      if (!item_key || !verdict || !text) return null;
      return { item_key, verdict, text };
    })
    .filter(Boolean);

  if (normalizedVerdicts.length !== perItemVerdicts.length) {
    return {
      ok: false,
      failure: {
        ok: false,
        failed: ["verdict_shape"],
        report: {
          msg: "Each verdict must be { item_key: string, verdict: 'pass'|'fail', text: string-non-empty }.",
          fix: "Fix the malformed entries and retry.",
        },
      },
    };
  }

  if (normalizedVerdicts.length !== itemList.length) {
    const verdictKeys = normalizedVerdicts.map((v) => v.item_key);
    const itemKeys = itemList.map((i) => i.item_key);
    return {
      ok: false,
      failure: {
        ok: false,
        failed: ["verdict_count"],
        report: {
          msg: `Verdict count (${normalizedVerdicts.length}) !== items count (${itemList.length}). Cat must judge every item.`,
          fix: "Provide one verdict per items.item_key. Don't skip any.",
          missing_keys: itemKeys.filter((k) => !verdictKeys.includes(k)),
          unexpected_keys: verdictKeys.filter((k) => !itemKeys.includes(k)),
        },
      },
    };
  }

  const itemKeySet = new Set(itemList.map((i) => i.item_key));
  const unmatched = normalizedVerdicts.filter((v) => !itemKeySet.has(v.item_key));
  if (unmatched.length > 0) {
    return {
      ok: false,
      failure: {
        ok: false,
        failed: ["verdict_key_mismatch"],
        report: {
          msg: `${unmatched.length} verdict(s) reference item_keys that don't exist on this quest.`,
          fix: "Use the exact item_keys returned by confirmSubmission.item_keys.",
          unmatched_keys: unmatched.map((v) => v.item_key),
        },
      },
    };
  }

  return { ok: true, db, items: itemList, normalizedVerdicts };
}

async function writeVerdictComments(db, items, normalizedVerdicts, action, actorName = QUESTMASTER_ACTOR_DEFAULT) {
  const itemIdByKey = new Map(items.map((i) => [i.item_key, i.id]));
  const rows = normalizedVerdicts.map((v) => ({
    item_id: itemIdByKey.get(v.item_key),
    role: "questmaster",
    actor_name: actorName,
    text: `[${action.toUpperCase()}:${v.verdict}] ${v.text}`,
  }));
  const { error } = await db.from(publicTables.itemComments).insert(rows);
  if (error) {
    return {
      ok: false,
      failure: {
        ok: false,
        failed: ["item_comments_write"],
        report: {
          msg: `Failed to write per-item verdict comments: ${error.message}.`,
          fix: "DB write failure. Check service-role auth and item_comments schema.",
        },
      },
    };
  }
  return { ok: true };
}

async function writeStage(db, questId, nextStage) {
  const { error: upErr } = await db.from(publicTables.quests).update({ stage: nextStage }).eq("id", questId);
  if (upErr) {
    return {
      ok: false,
      failure: {
        ok: false,
        failed: ["stage_write"],
        report: { msg: upErr.message, fix: "Stage write failed at the DB layer. Contact Guildmaster." },
      },
    };
  }
  const { data: verify } = await db
    .from(publicTables.quests)
    .select("stage")
    .eq("id", questId)
    .single();
  if (verify?.stage !== nextStage) {
    return {
      ok: false,
      failure: {
        ok: false,
        failed: ["stage_write_verify"],
        report: { msg: `Stage write did not persist; reads back as "${verify?.stage}".`, fix: "Likely RLS or trigger. Contact Guildmaster." },
      },
    };
  }
  return { ok: true };
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

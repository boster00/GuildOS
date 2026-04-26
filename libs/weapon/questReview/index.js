/**
 * questReview weapon — local-Claude-side final gate before user sees a quest.
 *
 * Owns the LOCAL view: how the Guildmaster (or anyone running locally with CIC +
 * full filesystem) verifies a quest that Cat already approved, before it surfaces
 * on the user's GM desk. Sister weapons:
 *   - `questExecution`  — worker's submit (execute → purrview).
 *   - `questPurrview`   — Cat's confirmSubmission / approve / bounce (purrview → review or back).
 *
 * Three actions, all script-locked:
 *   - `confirmApproval`  — verify questPurrview.approve lockphrase. Run BEFORE
 *                         opening any item URL for final review.
 *   - `pass`             — write FINAL_GATE_PASS lockphrase + per-item local
 *                         verdicts. Stage stays at `review`. The GM desk surfaces
 *                         only review-stage quests with this lockphrase.
 *   - `bounce`           — review → execute with per-item verdicts (≥1 fail) and
 *                         reason. User never sees the quest. Worker addresses the
 *                         listed item_keys and resubmits.
 *
 * Plus a read-side helper for the UI:
 *   - `confirmFinalGate` — read whether FINAL_GATE_PASS lockphrase is present.
 *                         Used by the GM desk to decide visibility.
 *
 * Auth: service-role DB facade. No external API.
 */

import { database } from "@/libs/council/database";
import { publicTables } from "@/libs/council/publicTables";
import { APPROVE_LOCKPHRASE } from "@/libs/weapon/questPurrview";

export const toc = {
  confirmApproval:
    "Verify a quest reached review through questPurrview.approve (lockphrase present). Run BEFORE opening any item URL for final verification.",
  pass:
    "Write FINAL_GATE_PASS lockphrase + per-item local verdicts. Stage stays at review. Hard-gated: requires Cat-approval lockphrase + per-item verdicts (all 'pass').",
  bounce:
    "Move quest from review back to execute. User never sees it. Hard-gated: requires Cat-approval lockphrase + per-item verdicts (≥1 'fail') + reason.",
  confirmFinalGate:
    "Read whether FINAL_GATE_PASS lockphrase is present on a quest. Used by the GM desk UI to filter review-stage quests to those ready for the user.",
};

export const GATE_VERSION = 1;

/** Local-Claude pass lockphrase — GM desk greps for this. */
export const FINAL_GATE_PASS_LOCKPHRASE = "this quest has cleared final verification";

/** Local-Claude bounce lockphrase — distinguishes from Cat's purrview bounce. */
export const FINAL_GATE_BOUNCE_LOCKPHRASE = "this quest has been bounced from review back to execute";

const PASS_CRITERIA_CHECKED = [
  "questId is a non-empty string",
  "quest exists",
  "quest.stage === 'review'",
  "questPurrview.approve lockphrase comment present (Cat handoff verified)",
  "perItemVerdicts is a non-empty array",
  "perItemVerdicts.length === items.length and every item_key matched",
  "every verdict === 'pass'",
  "one item_comments row written per verdict (role='guildmaster')",
  "FINAL_GATE_PASS lockphrase quest_comments row written",
];

const BOUNCE_CRITERIA_CHECKED = [
  "questId is a non-empty string",
  "quest exists",
  "quest.stage === 'review'",
  "questPurrview.approve lockphrase comment present (Cat handoff verified)",
  "perItemVerdicts is a non-empty array",
  "perItemVerdicts.length === items.length and every item_key matched",
  "≥1 verdict === 'fail'",
  "reason is a non-empty string",
  "one item_comments row written per verdict (role='guildmaster')",
  "stage write back to execute verified by SELECT-back",
  "FINAL_GATE_BOUNCE lockphrase quest_comments row written",
];

// ---------------------------------------------------------------------------
// confirmApproval — read-side gate. Local runs this BEFORE final review.
// ---------------------------------------------------------------------------

/**
 * Verify the quest reached `review` through `questPurrview.approve` (not a bare
 * stage write). Looks for the APPROVE_LOCKPHRASE comment.
 *
 * @param {{ questId: string }} args
 */
export async function confirmApproval({ questId }) {
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
  if (quest.stage !== "review") {
    return {
      ok: false,
      reason: "wrong_stage",
      msg: `Quest stage is "${quest.stage}", expected "review". Quest is not awaiting final verification.`,
      current_stage: quest.stage,
    };
  }

  const { data: gateComments, error: cErr } = await db
    .from(publicTables.questComments)
    .select("id, source, action, summary, detail, created_at")
    .eq("quest_id", questId)
    .eq("source", "questPurrview")
    .eq("action", "approve")
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
      msg: "No questPurrview.approve comment found. Quest reached review without passing through Cat. Bounce back to execute or escalate.",
    };
  }

  const summary = String(gate.summary || "");
  const detailLock =
    gate.detail && typeof gate.detail === "object" ? String(gate.detail.lockphrase || "") : "";
  const summaryHasPhrase = summary.toLowerCase().includes(APPROVE_LOCKPHRASE.toLowerCase());
  const detailHasPhrase = detailLock.toLowerCase() === APPROVE_LOCKPHRASE.toLowerCase();
  if (!summaryHasPhrase && !detailHasPhrase) {
    return {
      ok: false,
      reason: "lockphrase_missing",
      msg: `Cat-approve comment exists but lockphrase "${APPROVE_LOCKPHRASE}" is absent. Treating as untrusted.`,
      gate_comment_id: gate.id,
    };
  }

  // Items ARE the spec post-merge — Guildmaster grades each row's expectation
  // against its url + caption. Cat's prior verdicts are surfaced too so the
  // local gate can see what Cat already attested.
  const { data: items } = await db
    .from(publicTables.items)
    .select("id, item_key, expectation, url, caption")
    .eq("quest_id", questId);

  return {
    ok: true,
    msg: "Cat-approval verified. Safe to begin final verification.",
    gate_version: gate.detail?.gate_version ?? null,
    items_count: items?.length ?? 0,
    items: items || [],
    cat_perItemVerdicts: gate.detail?.perItemVerdicts ?? [],
    cat_summary: gate.detail?.cat_summary ?? null,
    approved_at: gate.created_at,
  };
}

// ---------------------------------------------------------------------------
// pass — write FINAL_GATE_PASS lockphrase + local verdicts. No stage change.
// ---------------------------------------------------------------------------

/**
 * @param {{ questId: string, perItemVerdicts: Array<{item_key: string, verdict: 'pass'|'fail', text: string}>, summary?: string }} args
 */
export async function pass({ questId, perItemVerdicts, summary: passSummary }) {
  const pre = await preflightFinalGate({ questId, perItemVerdicts });
  if (!pre.ok) return pre.failure;
  const { db, items, normalizedVerdicts } = pre;

  // pass-specific gate: every verdict === 'pass'
  const fails = normalizedVerdicts.filter((v) => v.verdict !== "pass");
  if (fails.length > 0) {
    return {
      ok: false,
      failed: ["verdict_not_all_pass"],
      report: {
        msg: `${fails.length} verdict(s) are not 'pass'. Final-gate pass requires every item to pass.`,
        fix: "Use bounce({ questId, perItemVerdicts, reason }) to send the quest back to execute.",
        failing_item_keys: fails.map((v) => v.item_key),
      },
    };
  }

  // Write per-item verdict comments (role='guildmaster')
  const writeRes = await writeVerdictComments(db, items, normalizedVerdicts, "final_gate_pass");
  if (!writeRes.ok) return writeRes.failure;

  // No stage change — quest stays at 'review'. Just write the lockphrase comment.
  const lockSummary = `Final gate v${GATE_VERSION} passed. ${normalizedVerdicts.length}/${items.length} items verified locally. ${capitalize(FINAL_GATE_PASS_LOCKPHRASE)}.${passSummary ? ` Note: ${passSummary}` : ""}`;
  const { error: commentErr } = await db.from(publicTables.questComments).insert({
    quest_id: questId,
    source: "questReview",
    action: "final_gate_pass",
    summary: lockSummary,
    detail: {
      gate_version: GATE_VERSION,
      lockphrase: FINAL_GATE_PASS_LOCKPHRASE,
      criteria_checked: PASS_CRITERIA_CHECKED,
      items_count: items.length,
      perItemVerdicts: normalizedVerdicts,
      local_summary: passSummary || null,
    },
  });
  if (commentErr) {
    return {
      ok: false,
      failed: ["lockphrase_comment_write"],
      report: {
        msg: `Per-item verdicts wrote but the lockphrase comment failed: ${commentErr.message}.`,
        fix: `Manually insert a quest_comments row with the phrase "${FINAL_GATE_PASS_LOCKPHRASE}" so the GM desk surfaces this quest.`,
      },
    };
  }

  return {
    ok: true,
    stage: "review",
    items_count: items.length,
    lockphrase: FINAL_GATE_PASS_LOCKPHRASE,
    criteria_checked: PASS_CRITERIA_CHECKED,
  };
}

// ---------------------------------------------------------------------------
// bounce — review → execute. User never sees it.
// ---------------------------------------------------------------------------

/**
 * @param {{ questId: string, perItemVerdicts: Array<{item_key: string, verdict: 'pass'|'fail', text: string}>, reason: string }} args
 */
export async function bounce({ questId, perItemVerdicts, reason }) {
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

  const pre = await preflightFinalGate({ questId, perItemVerdicts });
  if (!pre.ok) return pre.failure;
  const { db, items, normalizedVerdicts } = pre;

  const fails = normalizedVerdicts.filter((v) => v.verdict === "fail");
  if (fails.length === 0) {
    return {
      ok: false,
      failed: ["no_failures"],
      report: {
        msg: "bounce requires at least one verdict === 'fail'. All verdicts are pass — use pass() instead.",
        fix: "If the quest passes, call pass({ questId, perItemVerdicts }).",
      },
    };
  }

  const writeRes = await writeVerdictComments(db, items, normalizedVerdicts, "final_gate_bounce");
  if (!writeRes.ok) return writeRes.failure;

  const stageRes = await writeStage(db, questId, "execute");
  if (!stageRes.ok) return stageRes.failure;

  const failingKeys = fails.map((v) => v.item_key);
  const lockSummary = `Final gate v${GATE_VERSION} BOUNCE. ${fails.length} item(s) failed local verification: ${failingKeys.join(", ")}. ${capitalize(FINAL_GATE_BOUNCE_LOCKPHRASE)}. Reason: ${reason}`;
  const { error: commentErr } = await db.from(publicTables.questComments).insert({
    quest_id: questId,
    source: "questReview",
    action: "final_gate_bounce",
    summary: lockSummary,
    detail: {
      gate_version: GATE_VERSION,
      lockphrase: FINAL_GATE_BOUNCE_LOCKPHRASE,
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
        msg: `Stage moved to execute but the bounce lockphrase comment failed: ${commentErr.message}.`,
        fix: `Manually insert a quest_comments row with the phrase "${FINAL_GATE_BOUNCE_LOCKPHRASE}" + reason so the worker knows what to fix.`,
      },
    };
  }

  return {
    ok: true,
    stage: "execute",
    items_count: items.length,
    failing_count: fails.length,
    failing_item_keys: failingKeys,
    lockphrase: FINAL_GATE_BOUNCE_LOCKPHRASE,
    criteria_checked: BOUNCE_CRITERIA_CHECKED,
  };
}

// ---------------------------------------------------------------------------
// confirmFinalGate — read-side helper for the GM desk UI
// ---------------------------------------------------------------------------

/**
 * Whether a quest's final gate has been passed (FINAL_GATE_PASS lockphrase present).
 * Used by the GM desk to decide visibility — quests in review stage WITHOUT this
 * comment are pending local verification and not yet surfaced to the user.
 *
 * @param {{ questId: string }} args
 */
export async function confirmFinalGate({ questId }) {
  if (typeof questId !== "string" || !questId.trim()) {
    return { ok: false, reason: "questId_required", msg: "questId is required (non-empty string)." };
  }
  const db = await database.init("service");
  const { data: gateComments, error } = await db
    .from(publicTables.questComments)
    .select("id, summary, detail, created_at")
    .eq("quest_id", questId)
    .eq("source", "questReview")
    .eq("action", "final_gate_pass")
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) return { ok: false, reason: "comments_read_failed", msg: error.message };
  const gate = gateComments?.[0];
  if (!gate) {
    return {
      ok: false,
      reason: "no_gate_comment",
      msg: "Quest has no final-gate-pass comment. Pending local verification; not yet ready for user.",
    };
  }
  const summary = String(gate.summary || "");
  const detailLock =
    gate.detail && typeof gate.detail === "object" ? String(gate.detail.lockphrase || "") : "";
  if (
    !summary.toLowerCase().includes(FINAL_GATE_PASS_LOCKPHRASE.toLowerCase()) &&
    detailLock.toLowerCase() !== FINAL_GATE_PASS_LOCKPHRASE.toLowerCase()
  ) {
    return {
      ok: false,
      reason: "lockphrase_missing",
      msg: "Final-gate comment exists but lockphrase missing. Treating as not passed.",
      gate_comment_id: gate.id,
    };
  }
  return {
    ok: true,
    msg: "Final gate passed. Quest ready for user.",
    passed_at: gate.created_at,
    items_count: gate.detail?.items_count ?? null,
  };
}

// ---------------------------------------------------------------------------
// shared preflight (mirrors questPurrview's pattern, source stage = review)
// ---------------------------------------------------------------------------

async function preflightFinalGate({ questId, perItemVerdicts }) {
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
          fix: "After confirmApproval, run local verification (CIC + openai_images.judge) and pass the verdicts here.",
        },
      },
    };
  }

  const db = await database.init("service");

  const confirm = await confirmApproval({ questId });
  if (!confirm.ok) {
    return {
      ok: false,
      failure: {
        ok: false,
        failed: ["confirmApproval_failed"],
        report: {
          msg: `Cat-approval not verified: ${confirm.msg}`,
          fix: "Cannot run final gate on a quest that didn't reach review through questPurrview.approve. Escalate or bounce manually.",
          confirmApprovalReason: confirm.reason,
        },
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
          msg: `Verdict count (${normalizedVerdicts.length}) !== items count (${itemList.length}). Local verification must judge every item.`,
          fix: "Provide one verdict per items.item_key.",
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
          fix: "Use the exact item_keys returned by confirmApproval.items.",
          unmatched_keys: unmatched.map((v) => v.item_key),
        },
      },
    };
  }

  return { ok: true, db, items: itemList, normalizedVerdicts };
}

async function writeVerdictComments(db, items, normalizedVerdicts, action) {
  const itemIdByKey = new Map(items.map((i) => [i.item_key, i.id]));
  const rows = normalizedVerdicts.map((v) => ({
    item_id: itemIdByKey.get(v.item_key),
    role: "guildmaster",
    text: `[${action.toUpperCase()}:${v.verdict}] ${v.text}`,
  }));
  const { error } = await db.from(publicTables.itemComments).insert(rows);
  if (error) {
    return {
      ok: false,
      failure: {
        ok: false,
        failed: ["item_comments_write"],
        report: { msg: `Failed to write per-item verdict comments: ${error.message}.`, fix: "DB write failure." },
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
        report: { msg: upErr.message, fix: "Stage write failed at the DB layer." },
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
        report: { msg: `Stage write did not persist; reads back as "${verify?.stage}".`, fix: "Likely RLS or trigger." },
      },
    };
  }
  return { ok: true };
}


function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

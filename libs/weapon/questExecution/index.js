/**
 * questExecution weapon — worker-side quest stage transitions.
 *
 * Owns the WORKER's view: how an adventurer ships a quest from execute → purrview.
 * The agent CANNOT advance a quest by writing `stage` directly anymore. The only
 * supported path is `submit({ questId })`, which refuses to move the quest unless
 * every gate passes. Each gate maps to one of the failure modes we hit overnight
 * (empty inventory, bogus URLs, items with no rationale, deliverables_count drift).
 *
 * Sister weapon: `questPurrview` owns the QUESTMASTER's view (confirmSubmission
 * for the read-side handoff check, approve/bounce for the write-side transitions
 * out of purrview). Roles get distinct weapons for clarity.
 *
 * Auth: uses the service-role DB facade (`database.init("service")`).
 * No external API. Reads + writes `quests`, `items`, `item_comments`, `quest_comments`.
 */

import { database } from "@/libs/council/database";
import { publicTables } from "@/libs/council/publicTables";

export const toc = {
  submit:
    "Move a quest from execute to purrview. Hard-gated: refuses to advance unless deliverables spec, items count, per-item comments, and per-item URL size all pass. On success, leaves the lockphrase comment that questPurrview.confirmSubmission checks for.",
};

export const GATE_VERSION = 1;
/**
 * Stable phrase embedded in the success comment.
 * `questPurrview.confirmSubmission` greps for it verbatim.
 * Do not change without coordinating with every consumer.
 */
export const SUBMIT_LOCKPHRASE = "this quest now meets the criteria for purrview";

const CRITERIA_CHECKED = [
  "questId is a non-empty string",
  "quest exists",
  "quest.stage === 'execute'",
  "items rows exist for the quest",
  "every item has expectation set (declared spec)",
  "every item has url set (artifact uploaded — no pending items)",
  "every item has ≥1 item_comments entry (worker rationale)",
  "every item.url responds with content > 0 bytes",
  "stage write to purrview verified by SELECT-back",
];

/**
 * Submit a quest for Questmaster review.
 *
 * On full pass: writes `stage = "purrview"`, posts a `submit_for_purrview` audit
 * comment containing the lockphrase + full criteria list, returns
 * `{ ok: true, stage: "purrview", ... }`.
 *
 * On any failure: stage stays at `execute`, returns
 * `{ ok: false, failed: [<gate-id>], report: { msg, fix, ...details } }`.
 * `report.msg` describes the failure. `report.fix` is an actionable next step
 * the agent can follow without further escalation.
 *
 * @param {{ questId: string }} args
 */
export async function submit({ questId }) {
  // Gate 1 — questId
  if (typeof questId !== "string" || !questId.trim()) {
    return {
      ok: false,
      failed: ["questId"],
      report: {
        msg: "questId is required (non-empty string).",
        fix: "Pass { questId: '<uuid>' } as the argument.",
      },
    };
  }

  const db = await database.init("service");

  // Gates 2 + 3 — read the quest
  const { data: quest, error: qErr } = await db
    .from(publicTables.quests)
    .select("id, stage, title")
    .eq("id", questId)
    .single();
  if (qErr || !quest) {
    return {
      ok: false,
      failed: ["quest_exists"],
      report: {
        msg: qErr?.message || "Quest not found.",
        fix: "Verify the questId. Confirm the quest exists with: SELECT id, stage FROM quests WHERE id = '<uuid>'.",
        questId,
      },
    };
  }
  if (quest.stage !== "execute") {
    return {
      ok: false,
      failed: ["stage"],
      report: {
        msg: `Quest stage is "${quest.stage}", expected "execute". Submission only valid from execute.`,
        fix:
          quest.stage === "purrview" || quest.stage === "review"
            ? "Quest is already past execute — no resubmission needed. If you have new artifacts, post them as comments and ping the Questmaster."
            : "If the quest is in escalated/closing/complete, contact the Guildmaster — submission only opens from execute.",
        current_stage: quest.stage,
      },
    };
  }

  // Gate 4 — items rows exist (must have at least one declared expectation)
  const { data: items, error: iErr } = await db
    .from(publicTables.items)
    .select("id, item_key, expectation, url, caption")
    .eq("quest_id", questId);
  if (iErr) {
    return {
      ok: false,
      failed: ["items_read"],
      report: {
        msg: iErr.message,
        fix: "DB read against `items` failed. Check service-role auth and table name (libs/council/publicTables.js: items).",
      },
    };
  }
  const itemList = items || [];
  if (itemList.length === 0) {
    return {
      ok: false,
      failed: ["no_items"],
      report: {
        msg: "Quest has no items declared. Items are the per-artifact spec — without them there's nothing to submit.",
        fix: "Insert one items row per artifact you plan to ship at quest creation: writeItemExpectations({ questId, expectations: [{item_key, expectation}, ...] }) from libs/quest.",
      },
    };
  }

  // Gate 5 — every item has expectation set (declared spec, not null)
  const itemsMissingExpectation = itemList.filter(
    (i) => !i.expectation || (typeof i.expectation === "string" && i.expectation.trim().length === 0),
  );
  if (itemsMissingExpectation.length > 0) {
    return {
      ok: false,
      failed: ["expectation_missing"],
      report: {
        msg: `${itemsMissingExpectation.length} item(s) have no expectation set. Every item needs a declared spec.`,
        fix: `Set items.expectation for: ${itemsMissingExpectation.map((i) => i.item_key).join(", ")}. The expectation is what the verifier (imageJudge / Cat) tests the artifact against.`,
        item_keys_missing_expectation: itemsMissingExpectation.map((i) => i.item_key),
      },
    };
  }

  // Gate 6 — every item has url set (artifact uploaded; no pending items)
  const pendingItems = itemList.filter((i) => !i.url);
  if (pendingItems.length > 0) {
    const pendingKeys = pendingItems.map((i) => i.item_key);
    return {
      ok: false,
      failed: ["items_pending"],
      report: {
        msg: `${pendingItems.length} item(s) still pending (url IS NULL).`,
        fix: `Upload artifacts and call writeItem with these item_keys to fill in url + caption: ${pendingKeys.join(", ")}. UPSERT replaces in place — keep the same item_key.`,
        pending_item_keys: pendingKeys,
      },
    };
  }

  // Gate 8 — each item has ≥1 comment (worker rationale)
  const itemIds = itemList.map((i) => i.id);
  const { data: comments, error: cErr } = await db
    .from(publicTables.itemComments)
    .select("item_id")
    .in("item_id", itemIds);
  if (cErr) {
    return {
      ok: false,
      failed: ["item_comments_read"],
      report: {
        msg: cErr.message,
        fix: "DB read against `item_comments` failed. Check service-role auth and table name (libs/council/publicTables.js: itemComments).",
      },
    };
  }
  const hasComment = new Set((comments || []).map((c) => c.item_id));
  const itemsMissingComments = itemList.filter((i) => !hasComment.has(i.id));
  if (itemsMissingComments.length > 0) {
    const missing = itemsMissingComments.map((i) => i.item_key);
    return {
      ok: false,
      failed: ["item_comments_missing"],
      report: {
        msg: `${itemsMissingComments.length} item(s) have no item_comments rows.`,
        fix: `For each of [${missing.join(", ")}], call writeItemComment({ itemId, role: 'adventurer', text: '<one sentence: what this artifact shows and why it satisfies the expectation>' }). One comment per item is the minimum.`,
        item_keys_missing_comments: missing,
      },
    };
  }

  // Gate 9 — each url is reachable and non-empty
  const sizeChecks = await Promise.all(itemList.map((it) => checkUrlSize(it.url)));
  const failedUrls = itemList
    .map((it, idx) => ({ item: it, ...sizeChecks[idx] }))
    .filter((r) => !r.ok || r.size === 0);
  if (failedUrls.length > 0) {
    return {
      ok: false,
      failed: ["item_url_size"],
      report: {
        msg: `${failedUrls.length} item(s) have unreachable or zero-byte URLs.`,
        fix: "Re-upload each broken artifact to Supabase Storage (bucket: GuildOS_Bucket, path: cursor_cloud/<questId>/<filename>) and call writeItem with the SAME item_key — UPSERT replaces in place. Do NOT invent new keys like screenshot_v2.",
        items: failedUrls.map((f) => ({
          item_key: f.item.item_key,
          url: f.item.url,
          size: f.size ?? null,
          error: f.error ?? null,
        })),
      },
    };
  }

  // All gates pass — advance and verify
  const { error: upErr } = await db
    .from(publicTables.quests)
    .update({ stage: "purrview" })
    .eq("id", questId);
  if (upErr) {
    return {
      ok: false,
      failed: ["stage_write"],
      report: {
        msg: upErr.message,
        fix: "Quest stage write failed at the DB layer. Check service-role auth or contact Guildmaster — this is a system-level failure, not an agent fix.",
      },
    };
  }
  const { data: verify } = await db
    .from(publicTables.quests)
    .select("stage")
    .eq("id", questId)
    .single();
  if (verify?.stage !== "purrview") {
    return {
      ok: false,
      failed: ["stage_write_verify"],
      report: {
        msg: `Stage write did not persist; reads back as "${verify?.stage}".`,
        fix: "Stage write was silently rejected (likely RLS or trigger). Contact Guildmaster.",
      },
    };
  }

  // Lockphrase comment — questPurrview.confirmSubmission grep target.
  const summary = `Gate v${GATE_VERSION} passed. ${itemList.length} item(s) verified. ${SUBMIT_LOCKPHRASE.charAt(0).toUpperCase() + SUBMIT_LOCKPHRASE.slice(1)}.`;
  const { error: commentErr } = await db.from(publicTables.questComments).insert({
    quest_id: questId,
    source: "questExecution",
    action: "submit_for_purrview",
    summary,
    detail: {
      gate_version: GATE_VERSION,
      lockphrase: SUBMIT_LOCKPHRASE,
      criteria_checked: CRITERIA_CHECKED,
      items_count: itemList.length,
      item_keys: itemList.map((i) => i.item_key),
    },
  });
  if (commentErr) {
    // The stage already moved. We don't roll back, but we surface the partial state
    // so the agent (or operator) can post the comment manually before the Questmaster
    // arrives — without it, confirmSubmission will reject the review.
    return {
      ok: false,
      failed: ["lockphrase_comment_write"],
      report: {
        msg: `Stage moved to purrview but the lockphrase audit comment failed to write: ${commentErr.message}.`,
        fix: `Manually insert a quest_comments row: { source: 'questExecution', action: 'submit_for_purrview', summary including the phrase "${SUBMIT_LOCKPHRASE}", detail.gate_version: ${GATE_VERSION} }. Without it, the Questmaster's confirmSubmission gate rejects the review.`,
        partial: true,
        stage: "purrview",
      },
    };
  }

  return {
    ok: true,
    stage: "purrview",
    items_count: itemList.length,
    lockphrase: SUBMIT_LOCKPHRASE,
    criteria_checked: CRITERIA_CHECKED,
  };
}

// ---------------------------------------------------------------------------
// helpers (intentionally not exported — plumbing, not part of the contract)
// ---------------------------------------------------------------------------

/**
 * HEAD probe with GET fallback. Returns `{ ok, size?, error? }`.
 * size === 0 is treated as failure by the caller.
 */
async function checkUrlSize(url) {
  if (!url || typeof url !== "string") {
    return { ok: false, error: "no_url" };
  }
  try {
    const head = await fetch(url, { method: "HEAD" });
    if (head.ok) {
      const len = head.headers.get("content-length");
      if (len != null) {
        const n = parseInt(len, 10);
        if (Number.isFinite(n)) return { ok: true, size: n };
      }
    }
    // HEAD failed or no content-length — try GET
    const get = await fetch(url);
    if (!get.ok) return { ok: false, error: `HTTP ${get.status}` };
    const buf = await get.arrayBuffer();
    return { ok: true, size: buf.byteLength };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
}

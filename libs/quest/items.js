/**
 * items module — single writer for items review-tier columns.
 *
 * Tier column ownership (locked here in code, documented in CLAUDE.md):
 *   - self_check     T0   worker self-claim at submit time
 *   - openai_check   T1   contextless OpenAI judge (gpt-4o via openai_images.judge)
 *   - purrview_check T2   Cat (Questmaster) per-item review
 *   - claude_check   T3.5 Local Claude / Guildmaster final-gate review
 *   - user_feedback  T4   end-user comment from the GM-desk review pass
 *
 * Each tier MUST write only its own column. This helper is the single
 * chokepoint — verification weapons + judge actions go through `writeReview`
 * and a typo'd tier name fails fast instead of silently writing the wrong
 * column. The migration `20260427210000_items_review_columns.sql` notes
 * that DB-level enforcement is a follow-up; until then, this module is the
 * enforcement.
 */

import { database } from "@/libs/council/database";
import { publicTables } from "@/libs/council/publicTables";

const TIER_COLUMN = Object.freeze({
  worker: "self_check",
  openai: "openai_check",
  cat: "purrview_check",
  guildmaster: "claude_check",
  user: "user_feedback",
});

const VALID_TIERS = Object.keys(TIER_COLUMN);

/**
 * Write a per-item review verdict to the column owned by `tier`.
 *
 * @param {{ tier: keyof typeof TIER_COLUMN, itemId: string, value: string|null }} args
 * @returns {Promise<{ ok: true } | { ok: false, reason: string, msg: string }>}
 */
export async function writeReview({ tier, itemId, value }) {
  if (!VALID_TIERS.includes(tier)) {
    return {
      ok: false,
      reason: "invalid_tier",
      msg: `tier must be one of [${VALID_TIERS.join(", ")}] — got "${tier}".`,
    };
  }
  if (typeof itemId !== "string" || !itemId.trim()) {
    return { ok: false, reason: "invalid_itemId", msg: "itemId must be a non-empty string." };
  }
  if (value !== null && typeof value !== "string") {
    return { ok: false, reason: "invalid_value", msg: "value must be a string or null." };
  }

  const column = TIER_COLUMN[tier];
  const db = await database.init("service");
  const { error } = await db
    .from(publicTables.items)
    .update({ [column]: value })
    .eq("id", itemId);
  if (error) {
    return { ok: false, reason: "db_error", msg: error.message };
  }
  return { ok: true };
}

/**
 * Scan quests for the banned "Quest in the X stage" status-overwrite pattern
 * in the `description` column. Per CLAUDE.md, `description` is OBJECTIVE only;
 * status lives in `stage` + the per-item review-tier columns. The 2026-04-26
 * incident overwrote 13 descriptions with status text; this scan exists so
 * regressions surface in CI rather than silently shipping.
 *
 * @returns {Promise<Array<{ id: string, title: string, description: string }>>}
 */
export async function scanForStatusOverwriteDescriptions() {
  const db = await database.init("service");
  const { data } = await db
    .from(publicTables.quests)
    .select("id, title, description, stage")
    .in("stage", ["execute", "purrview", "review", "escalated", "closing"]);
  const pattern = /Quest (in|now in) the (review|purrview|escalated|execute|closing) stage/i;
  return (data || [])
    .filter((q) => pattern.test(q.description || ""))
    .map(({ id, title, description }) => ({ id, title, description }));
}

export const TIER_COLUMNS = TIER_COLUMN;

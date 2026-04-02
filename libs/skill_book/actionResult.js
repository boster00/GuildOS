/**
 * Standard skill-book action return shape (single envelope for actions, proving grounds, and inventory merge).
 *
 * @typedef {{ ok: boolean, msg: string, items: Record<string, unknown> }} SkillActionResult
 */

/**
 * @param {Record<string, unknown>} [items]
 * @param {string} [msg] — empty when success
 * @returns {SkillActionResult}
 */
export function skillActionOk(items = {}, msg = "") {
  const o = items && typeof items === "object" && !Array.isArray(items) ? items : {};
  return { ok: true, msg: typeof msg === "string" ? msg : "", items: o };
}

/**
 * @param {string} msg
 * @param {Record<string, unknown>} [items] — usually {}
 * @returns {SkillActionResult}
 */
export function skillActionErr(msg, items = {}) {
  const o = items && typeof items === "object" && !Array.isArray(items) ? items : {};
  return { ok: false, msg: msg || "Error", items: o };
}

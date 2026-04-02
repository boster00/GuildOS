/**
 * Normalize a stored pigeon letter into ordered browser/worker steps.
 * Supports multi-step letters (`steps[]`) and legacy single-step (fields on the letter root).
 *
 * @param {unknown} letter
 * @returns {Array<{ action: string, selector: string, item: string, url?: string }>}
 */
export function normalizePigeonLetterSteps(letter) {
  if (!letter || typeof letter !== "object" || Array.isArray(letter)) return [];

  const L = /** @type {Record<string, unknown>} */ (letter);

  if (Array.isArray(L.steps) && L.steps.length > 0) {
    const out = [];
    for (const s of L.steps) {
      const one = normalizeOneStep(s);
      if (one) out.push(one);
    }
    return out;
  }

  const one = normalizeOneStep(L);
  return one ? [one] : [];
}

/**
 * @param {unknown} step
 */
function normalizeOneStep(step) {
  if (!step || typeof step !== "object" || Array.isArray(step)) return null;
  const s = /** @type {Record<string, unknown>} */ (step);
  const action = String(s.action ?? "obtainText");
  const selector = String(s.selector ?? "");
  const item = String(s.item ?? "").trim();
  if (!item) return null;
  const urlRaw = s.url != null ? String(s.url).trim() : "";
  const o = { action, selector, item };
  if (urlRaw) o.url = urlRaw;
  return o;
}

/**
 * True if any step's `item` is not yet present as a top-level inventory key (excluding pigeon_letters).
 *
 * @param {unknown} letter
 * @param {Set<string>} keysDelivered
 */
export function pigeonLetterHasPendingWork(letter, keysDelivered) {
  const steps = normalizePigeonLetterSteps(letter);
  if (steps.length === 0) return false;
  return steps.some((st) => !keysDelivered.has(st.item));
}

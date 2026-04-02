/**
 * Client-side out-of-credits UX: trigger banner and detect OOC errors.
 * Safe to call from browser only (cookie + CustomEvent on window).
 */

const OUT_OF_CREDITS_COOKIE = "outofcredits";
const OUT_OF_CREDITS_EVENT = "out-of-credits";

/**
 * Sets the outofcredits cookie and dispatches 'out-of-credits' on window
 * so OutOfCreditsBanner can show immediately without waiting for polling.
 */
export function triggerOutOfCreditsBanner() {
  if (typeof document === "undefined" || typeof window === "undefined") return;
  document.cookie = `${OUT_OF_CREDITS_COOKIE}=true; path=/; max-age=86400; SameSite=Lax`;
  window.dispatchEvent(new CustomEvent(OUT_OF_CREDITS_EVENT));
}

/**
 * Returns true when the error indicates out-of-credits (quota exceeded).
 * Checks err.code === 'QUOTA_EXCEEDED' or err.name === 'OutOfCreditsError'.
 */
export function isOutOfCreditsError(err) {
  if (!err) return false;
  return err.code === "QUOTA_EXCEEDED" || err.name === "OutOfCreditsError";
}

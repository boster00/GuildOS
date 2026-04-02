/**
 * Normalize and validate a media source domain for URL resolution.
 * Returns null for empty input (no-op), origin string if valid, or { error } if invalid.
 *
 * @param {string} input - User-entered domain (e.g. "example.com", "https://example.com/")
 * @returns {string|null|{ error: string }} Normalized origin, null for empty, or error object
 *
 * @example
 * normalizeMediaDomain("example.com")        → "https://example.com"
 * normalizeMediaDomain("https://example.com/") → "https://example.com"
 * normalizeMediaDomain("https://example.com/assets") → "https://example.com"
 * normalizeMediaDomain("")                   → null
 * normalizeMediaDomain("not a url !!!")      → { error: "Invalid domain — enter a full URL like https://example.com" }
 */
export function normalizeMediaDomain(input) {
  const trimmed = typeof input === "string" ? input.trim() : "";
  if (!trimmed) return null;

  let candidate = trimmed;
  if (!/^https?:\/\//i.test(candidate)) {
    candidate = "https://" + candidate;
  }

  try {
    const url = new URL(candidate);
    const origin = url.origin;
    if (!origin || origin === "null") {
      return { error: "Invalid domain — enter a full URL like https://example.com" };
    }
    return origin;
  } catch {
    return { error: "Invalid domain — enter a full URL like https://example.com" };
  }
}

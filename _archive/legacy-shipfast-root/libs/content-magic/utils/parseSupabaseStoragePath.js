/**
 * Extracts the storage path from a Supabase storage URL.
 * Supports public object URLs: https://*.supabase.co/storage/v1/object/public/images/path
 *
 * @param {string} src - The Supabase storage URL (e.g. from images.src)
 * @returns {string|null} - The storage path (e.g. "user-id/123-abc.jpg") or null if not parseable
 */
export function parseSupabaseStoragePath(src) {
  if (!src || typeof src !== "string") return null;

  const trimmed = src.trim();
  if (!trimmed) return null;

  // Standard format: https://project.supabase.co/storage/v1/object/public/images/path/to/file
  const match = trimmed.match(
    /https?:\/\/[^/]+\.supabase\.co\/storage\/v1\/object\/public\/images\/(.+?)(?:\?|$)/i
  );
  if (match) {
    const path = decodeURIComponent(match[1]);
    return path || null;
  }

  // Legacy/alternate: object path might be slightly different; try broader pattern
  const fallback = trimmed.match(
    /supabase\.co\/storage\/v1\/object\/public\/images\/(.+?)(?:\?|$)/i
  );
  if (fallback) {
    const path = decodeURIComponent(fallback[1]);
    return path || null;
  }

  return null;
}

/**
 * Returns true if the src looks like a Supabase storage URL (even if truncated).
 */
export function isSupabaseStorageUrl(src) {
  if (!src || typeof src !== "string") return false;
  return src.includes("supabase.co/storage");
}

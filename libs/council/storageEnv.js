/**
 * Server-only: object storage bucket id (must match dashboard bucket name and storage policies).
 * @returns {string}
 */
export function getStorageBucketName() {
  const raw = process.env.SUPABASE_BUCKET || "GuildOS_Bucket";
  const v = String(raw).trim();
  if (!v) {
    throw new Error("SUPABASE_BUCKET is empty.");
  }
  return v;
}

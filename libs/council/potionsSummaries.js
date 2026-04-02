import { database } from "@/libs/council/database";
import { publicTables } from "@/libs/council/publicTables";

/** Human-readable labels for `potions.kind` (extend when new kinds ship). */
export const POTION_KIND_LABELS = {
  zoho_books: "Zoho Books session",
};

/**
 * List potion rows for the current user without exposing `secrets` (tokens stay server-side only in UI terms).
 */
export async function getPotionSummariesForOwner(userId) {
  const db = await database.init("server");
  const { data, error } = await db
    .from(publicTables.potions)
    .select("id, kind, expires_at, updated_at, created_at")
    .eq("owner_id", userId)
    .order("kind", { ascending: true });

  if (error) {
    return { rows: [], error: error.message };
  }

  const rows = (data || []).map((row) => ({
    ...row,
    label: POTION_KIND_LABELS[row.kind] || row.kind,
  }));

  return { rows, error: null };
}

/**
 * Quest planning entry — safe to import from client bundles (no skill_book).
 * Runs translate / plan only (SMART quest update through 4a), not assign.
 * @param {Record<string, unknown>} input
 * @returns {Promise<{ ok: true, data: unknown } | { ok: false, error: string }>}
 */
export async function planQuest(input) {
  const questId = typeof input?.questId === "string" ? input.questId.trim() : "";
  if (!questId) return { ok: false, error: "questId is required" };

  const res = await fetch("/api/quest/cat-pipeline", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ questId, action: "planOnly" }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = typeof json?.error === "string" ? json.error : res.statusText || "Request failed";
    return { ok: false, error: err };
  }
  if (json?.ok === false) {
    return { ok: false, error: typeof json?.summary === "string" ? json.summary : "Plan pipeline did not complete" };
  }
  return { ok: true, data: json };
}

/**
 * Skill book actions — triage via ?action=
 * listRosterIds: ids for commission/edit checkboxes (from libs/skill_book catalog)
 */
import { requireUser } from "@/libs/council/auth/server";
import { listSkillBookIdsForRosterUI } from "@/libs/skill_book";

export async function GET(request) {
  const action = request.nextUrl.searchParams.get("action");

  if (action === "listRosterIds") {
    try {
      await requireUser();
    } catch (e) {
      if (e?.message === "UNAUTHORIZED") {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }
      return Response.json({ error: e?.message || String(e) }, { status: 500 });
    }
    return Response.json({ ok: true, ids: listSkillBookIdsForRosterUI() });
  }

  return Response.json(
    {
      error: "Missing or invalid action",
      validActions: ["listRosterIds"],
      example: "/api/skill_book?action=listRosterIds",
    },
    { status: 400 }
  );
}

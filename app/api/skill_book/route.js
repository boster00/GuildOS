/**
 * Skill book actions — triage via ?action=
 * listRosterIds: ids for commission/edit checkboxes (from libs/skill_book catalog)
 * runRecentSalesOrders: same as quest salesOrders without item handoff (dev / direct test)
 */
import { requireUser } from "@/libs/council/auth/server";
import { listSkillBookIdsForRosterUI } from "@/libs/skill_book";
import { getRecentOrders } from "@/libs/skill_book/zoho";
import { zohoErrorToJsonPayload } from "@/libs/weapon/zoho";

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

  if (action !== "runRecentSalesOrders") {
    return Response.json(
      {
        error: "Missing or invalid action",
        validActions: ["listRosterIds", "runRecentSalesOrders"],
        example: "/api/skill_book?action=listRosterIds",
      },
      { status: 400 }
    );
  }

  await requireUser();
  const res = await getRecentOrders({ module: "salesorders", numOfRecords: 10 });
  if (!res.ok) {
    return Response.json({ error: res.msg, ok: false, msg: res.msg, items: res.items }, { status: 400 });
  }
  const rows = /** @type {unknown[]} */ (res.items.salesorders ?? []);
  return Response.json({ ok: true, msg: "", items: res.items, count: rows.length, rows });
}

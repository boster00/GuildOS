import { requireUser } from "@/libs/council/auth/server";
import { database } from "@/libs/council/database";
import { updateAdventurer } from "@/libs/proving_grounds/server.js";
import { isRecruitReady } from "@/libs/proving_grounds/ui.js";
import {
  listSkillBooksForProvingGrounds,
  getAdventurerDraftForOwner,
  getQuestContextForOwner,
  runProvingGroundsAction,
} from "@/libs/proving_grounds";
import { getQuestForOwner, advance as advanceQuest } from "@/libs/quest";

function unauthorized() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

export async function GET(request) {
  let user;
  try {
    user = await requireUser();
  } catch (e) {
    if (e?.message === "UNAUTHORIZED") return unauthorized();
    return Response.json({ error: e?.message || String(e) }, { status: 500 });
  }

  const action = request.nextUrl.searchParams.get("action") || "";

  if (action === "listSkillBooks") {
    const books = listSkillBooksForProvingGrounds();
    return Response.json({ ok: true, books });
  }

  if (action === "getAdventurer") {
    const adventurerId = request.nextUrl.searchParams.get("adventurerId")?.trim();
    if (!adventurerId) {
      return Response.json({ error: "adventurerId is required" }, { status: 400 });
    }
    const db = await database.init("server");
    const { data, error } = await getAdventurerDraftForOwner({
      adventurerId,
      ownerId: user.id,
      client: db,
    });
    if (error) {
      return Response.json({ error: error.message }, { status: 404 });
    }
    return Response.json({ ok: true, ...data });
  }

  if (action === "getQuest") {
    const questId = request.nextUrl.searchParams.get("questId")?.trim();
    if (!questId) {
      return Response.json({ error: "questId is required" }, { status: 400 });
    }
    const db = await database.init("server");
    const { data, error } = await getQuestContextForOwner({
      questId,
      ownerId: user.id,
      client: db,
    });
    if (error) {
      return Response.json({ error: error.message }, { status: 404 });
    }
    return Response.json({ ok: true, preview: data.preview, quest: data.quest });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}

export async function POST(request) {
  let user;
  try {
    user = await requireUser();
  } catch (e) {
    if (e?.message === "UNAUTHORIZED") return unauthorized();
    return Response.json({ error: e?.message || String(e) }, { status: 500 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const action = typeof body?.action === "string" ? body.action : "";
  const db = await database.init("server");

  if (action === "updateAdventurer") {
    const adventurerId = body?.adventurerId != null ? String(body.adventurerId).trim() : "";
    const draft = body?.draft;
    if (!adventurerId) {
      return Response.json({ error: "adventurerId is required" }, { status: 400 });
    }
    if (!draft || typeof draft !== "object") {
      return Response.json({ error: "draft object is required" }, { status: 400 });
    }
    if (!isRecruitReady(draft)) {
      return Response.json({ error: "Draft is incomplete (name and system_prompt required)." }, { status: 400 });
    }
    const { data, error } = await updateAdventurer({
      adventurerId,
      ownerId: user.id,
      draft,
      client: db,
    });
    if (error) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    return Response.json({ ok: true, data });
  }

  if (action === "advanceQuest") {
    const questId = body?.questId != null ? String(body.questId).trim() : "";
    if (!questId) {
      return Response.json({ error: "questId is required" }, { status: 400 });
    }
    const { data: questRow, error: qErr } = await getQuestForOwner(questId, user.id, { client: db });
    if (qErr || !questRow) {
      return Response.json({ error: qErr?.message || "Quest not found." }, { status: 404 });
    }
    const result = await advanceQuest(questRow, { client: db });
    return Response.json({ ok: result.ok !== false, ...result });
  }

  if (action === "runAction") {
    const adventurerId = body?.adventurerId != null ? String(body.adventurerId).trim() : "";
    const skillBookId = body?.skillBookId != null ? String(body.skillBookId).trim() : "";
    const actionName = body?.actionName != null ? String(body.actionName).trim() : "";
    const payload = body?.payload && typeof body.payload === "object" && !Array.isArray(body.payload) ? body.payload : {};
    const draft =
      body?.draft && typeof body.draft === "object" && !Array.isArray(body.draft) ? body.draft : undefined;
    const questIdRaw = body?.questId != null ? String(body.questId).trim() : "";

    if (!adventurerId) {
      return Response.json({ error: "adventurerId is required" }, { status: 400 });
    }
    if (!skillBookId) {
      return Response.json({ error: "skillBookId is required" }, { status: 400 });
    }
    if (!actionName) {
      return Response.json({ error: "actionName is required" }, { status: 400 });
    }

    const { data: advRow, error: loadErr } = await getAdventurerDraftForOwner({
      adventurerId,
      ownerId: user.id,
      client: db,
    });
    if (loadErr || !advRow?.row) {
      return Response.json({ error: loadErr?.message || "Adventurer not found." }, { status: 404 });
    }

    let questRow = null;
    if (questIdRaw) {
      const { data: q, error: qErr } = await getQuestForOwner(questIdRaw, user.id, { client: db });
      if (qErr || !q) {
        return Response.json({ error: qErr?.message || "Quest not found." }, { status: 404 });
      }
      questRow = q;
    }

    // Proving grounds: catalog + UI selection are authoritative (dev/QA), not adventurer.skill_books.
    const result = await runProvingGroundsAction({
      userId: user.id,
      client: db,
      skillBookId,
      actionName,
      payload,
      adventurerRow: advRow.row,
      draft,
      questRow,
    });

    return Response.json({
      ok: result.ok,
      msg: result.msg ?? "",
      items: result.items ?? {},
    });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}

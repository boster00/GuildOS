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
import { getQuestForOwner, advance as advanceQuest, createQuest } from "@/libs/quest";
import { runQuestToCompletion } from "@/libs/proving_grounds/server.js";
import { publicTables } from "@/libs/council/publicTables";

export const maxDuration = 300;

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

  if (action === "getSetupSteps") {
    const db = await database.init("server");
    const { data } = await db
      .from(publicTables.profiles)
      .select("council_settings")
      .eq("id", user.id)
      .single();
    const steps = data?.council_settings?.proving_grounds_setup;
    return Response.json({ ok: true, steps: Array.isArray(steps) ? steps : [] });
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

  if (action === "seedGuildAdventurers") {
    const serviceDb = await database.init("service");
    const { data, error } = await serviceDb.rpc("seed_guild_adventurers", { p_owner_id: user.id });
    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }
    const rows = Array.isArray(data) ? data : [];
    return Response.json({ ok: true, count: rows.length, adventurers: rows });
  }

  if (action === "runTestQuest") {
    const title = typeof body?.title === "string" ? body.title.trim() : "";
    const description = typeof body?.description === "string" ? body.description.trim() : "";
    if (!title && !description) {
      return Response.json({ error: "title or description is required" }, { status: 400 });
    }

    const questTitle = title || description.slice(0, 80);
    const questDescription = description || title;

    const { data: newQuest, error: createErr } = await createQuest({
      userId: user.id,
      title: questTitle,
      description: questDescription,
      stage: "idea",
      client: db,
    });

    if (createErr || !newQuest) {
      return Response.json({ error: createErr?.message || "Failed to create quest" }, { status: 500 });
    }

    // Use service client for the long-running advancement loop (bypasses RLS, consistent)
    const serviceDb = await database.init("service");
    const { ok, finalStage, logs, html } = await runQuestToCompletion(newQuest.id, { client: serviceDb });

    return Response.json({ ok, questId: newQuest.id, finalStage, logs, html });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}

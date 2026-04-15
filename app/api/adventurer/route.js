import { requireUser } from "@/libs/council/auth/server";
import { database } from "@/libs/council/database";
import { recruitAdventurer, updateAdventurer, decommissionAdventurer } from "@/libs/proving_grounds/server.js";
import { isRecruitReady } from "@/libs/proving_grounds/ui.js";
import { updateAdventurerSession, selectAdventurerForOwner } from "@/libs/council/database/serverAdventurer.js";
import { writeFollowup, readConversation, readAgent } from "@/libs/weapon/cursor/index.js";
function unauthorized() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

export async function POST(request) {
  const db = await database.init("server");
  const action = request.nextUrl.searchParams.get("action") || "recruit";

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

  if (action === "link_session") {
    const { adventurerId, sessionId, workerType } = body || {};
    if (!adventurerId || !sessionId) {
      return Response.json({ error: "adventurerId and sessionId are required" }, { status: 400 });
    }
    const { data: adv } = await selectAdventurerForOwner(adventurerId, user.id, { client: db });
    if (!adv) return Response.json({ error: "Adventurer not found" }, { status: 404 });
    const { data, error } = await updateAdventurerSession(adventurerId, {
      session_id: sessionId,
      worker_type: workerType || "cursor_cloud",
      session_status: "idle",
    }, { client: db });
    if (error) return Response.json({ error: error.message }, { status: 400 });
    return Response.json({ ok: true, data });
  }

  if (action === "message") {
    const { adventurerId, message } = body || {};
    if (!adventurerId || !message) {
      return Response.json({ error: "adventurerId and message are required" }, { status: 400 });
    }
    const { data: adv } = await selectAdventurerForOwner(adventurerId, user.id, { client: db });
    if (!adv) return Response.json({ error: "Adventurer not found" }, { status: 404 });
    if (!adv.session_id) return Response.json({ error: "No session linked" }, { status: 400 });
    const result = await writeFollowup({ agentId: adv.session_id, message });
    return Response.json({ ok: true, data: result });
  }

  if (action === "decommission") {
    const adventurerId = body?.adventurerId;
    if (adventurerId == null || String(adventurerId).trim() === "") {
      return Response.json({ error: "adventurerId is required" }, { status: 400 });
    }
    const { error } = await decommissionAdventurer({
      adventurerId: String(adventurerId).trim(),
      ownerId: user.id,
      client: db,
    });
    if (error) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    return Response.json({ ok: true });
  }

  const draft = body?.draft;
  if (!draft || typeof draft !== "object") {
    return Response.json({ error: "draft object is required" }, { status: 400 });
  }
  if (!isRecruitReady(draft)) {
    return Response.json(
      { error: "Draft is incomplete (name and system_prompt required)." },
      { status: 400 },
    );
  }

  if (action === "recruit") {
    const { data, error } = await recruitAdventurer({ ownerId: user.id, draft, client: db });
    if (error) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    return Response.json({ ok: true, data });
  }

  if (action === "update") {
    const adventurerId = body?.adventurerId;
    if (adventurerId == null || String(adventurerId).trim() === "") {
      return Response.json({ error: "adventurerId is required" }, { status: 400 });
    }
    const { data, error } = await updateAdventurer({
      adventurerId: String(adventurerId).trim(),
      ownerId: user.id,
      draft,
      client: db,
    });
    if (error) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    return Response.json({ ok: true, data });
  }

  return Response.json(
    { error: "Invalid action", validActions: ["recruit", "update", "decommission", "link_session", "message"] },
    { status: 400 },
  );
}

export async function GET(request) {
  const db = await database.init("server");
  const action = request.nextUrl.searchParams.get("action");
  const adventurerId = request.nextUrl.searchParams.get("adventurerId");

  let user;
  try {
    user = await requireUser();
  } catch (e) {
    if (e?.message === "UNAUTHORIZED") return unauthorized();
    return Response.json({ error: e?.message || String(e) }, { status: 500 });
  }

  if (!adventurerId) {
    return Response.json({ error: "adventurerId query param is required" }, { status: 400 });
  }

  const { data: adv } = await selectAdventurerForOwner(adventurerId, user.id, { client: db });
  if (!adv) return Response.json({ error: "Adventurer not found" }, { status: 404 });
  if (!adv.session_id) return Response.json({ error: "No session linked" }, { status: 400 });

  if (action === "conversation") {
    const result = await readConversation({ agentId: adv.session_id });
    return Response.json({ ok: true, data: result });
  }

  if (action === "session_status") {
    const result = await readAgent({ agentId: adv.session_id });
    return Response.json({ ok: true, data: result });
  }

  return Response.json(
    { error: "Invalid action", validActions: ["conversation", "session_status"] },
    { status: 400 },
  );
}

import { requireUser } from "@/libs/council/auth/server";
import { database } from "@/libs/council/database";
import { recruitAdventurer, updateAdventurer, decommissionAdventurer } from "@/libs/proving_grounds/server.js";
import { isRecruitReady } from "@/libs/proving_grounds/ui.js";
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
    { error: "Invalid action", validActions: ["recruit", "update", "decommission"] },
    { status: 400 },
  );
}

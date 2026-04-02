import { requireUser } from "@/libs/council/auth/server";
import { createServerClient } from "@/libs/council/database";
import { getQuestForOwner } from "@/libs/quest/runtime.js";
import { runAdventurerExecuteQuestPlan } from "@/libs/adventurer/executeQuestPlan.js";

function unauthorized() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

/**
 * POST JSON: `{ questId }` — run `execution_plan` (same engine as cat-pipeline `executeSteps`).
 */
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

  const questId = typeof body?.questId === "string" ? body.questId.trim() : "";
  if (!questId) {
    return Response.json({ error: "questId is required" }, { status: 400 });
  }

  const db = await createServerClient();
  const { data: quest, error: qErr } = await getQuestForOwner(questId, user.id, { client: db });
  if (qErr || !quest) {
    return Response.json({ error: qErr?.message || "Quest not found" }, { status: 404 });
  }

  console.log("[GuildOS:api/quest/adventurer-execute]", "POST", {
    questId,
    userId: typeof user.id === "string" ? `${user.id.slice(0, 8)}…` : user.id,
  });
  const result = await runAdventurerExecuteQuestPlan({ questId, userId: user.id, client: db });
  console.log("[GuildOS:api/quest/adventurer-execute]", "result", {
    questId,
    ok: result?.ok,
    summary: result?.summary,
    stoppedAt: result?.stoppedAt,
  });
  return Response.json(result);
}

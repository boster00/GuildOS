import { requireUser } from "@/libs/council/auth/server";
import { createServerClient } from "@/libs/council/database";
import { getQuestForOwner } from "@/libs/quest/runtime.js";
import {
  runCatQuestmasterPipeline,
  runCatQuestmasterPlanOnly,
  runCatPipelineListRoster,
  runCatPipelinePlanRequestToQuest,
  runCatPipelineFindAdventurerForQUest,
  runCatPipelineTacticalPlan,
  runCatPipelineExecuteSteps,
} from "@/libs/quest/catQuestmasterPipeline.js";

function unauthorized() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

/** @param {string} raw */
function normalizeAction(raw) {
  const a = typeof raw === "string" ? raw.trim() : "";
  if (a === "translatePlan") return "planOnly";
  return a || "full";
}

/**
 * POST JSON: `{ questId, action? }`
 * - `action` optional, default `full`: `full` | `planOnly` | `translatePlan` | `listRoster` | `planRequestToQuest` | `findAdventurerForQUest`
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

  const action = normalizeAction(body?.action);
  const allowed = new Set([
    "full",
    "planOnly",
    "listRoster",
    "planRequestToQuest",
    "findAdventurerForQUest",
    "tacticalPlan",
    "executeSteps",
    "planAndExecute",
  ]);
  if (!allowed.has(action)) {
    return Response.json(
      {
        error: `Invalid action "${body?.action}". Use: full, planOnly, translatePlan, listRoster, planRequestToQuest, findAdventurerForQUest, tacticalPlan, executeSteps, planAndExecute`,
      },
      { status: 400 },
    );
  }

  const db = await createServerClient();

  if (action === "listRoster") {
    const { data: q, error: qErr } = await getQuestForOwner(questId, user.id, { client: db });
    if (qErr || !q) {
      return Response.json({ error: qErr?.message || "Quest not found" }, { status: 404 });
    }
  }

  if (action === "full") {
    const result = await runCatQuestmasterPipeline({ questId, userId: user.id, client: db });
    return Response.json(result);
  }

  if (action === "planOnly") {
    const result = await runCatQuestmasterPlanOnly({ questId, userId: user.id, client: db });
    return Response.json(result);
  }

  if (action === "listRoster") {
    const result = await runCatPipelineListRoster({ questId, userId: user.id, client: db });
    return Response.json(result);
  }

  if (action === "planRequestToQuest") {
    console.log("[GuildOS:planRequestToQuest]", "api POST /api/quest/cat-pipeline", {
      questId,
      userIdPrefix: typeof user.id === "string" ? `${user.id.slice(0, 8)}…` : user.id,
    });
    const result = await runCatPipelinePlanRequestToQuest({ questId, userId: user.id, client: db });
    console.log("[GuildOS:planRequestToQuest]", "api response", {
      questId,
      ok: result?.ok,
      stoppedAt: result?.stoppedAt,
      summary: result?.summary,
      stepIds: Array.isArray(result?.steps) ? result.steps.map((s) => s.id) : [],
      lastError: Array.isArray(result?.steps)
        ? [...result.steps].reverse().find((s) => s.error)?.error
        : undefined,
    });
    return Response.json(result);
  }

  if (action === "findAdventurerForQUest") {
    const result = await runCatPipelineFindAdventurerForQUest({ questId, userId: user.id, client: db });
    return Response.json(result);
  }

  if (action === "tacticalPlan") {
    const result = await runCatPipelineTacticalPlan({ questId, userId: user.id, client: db });
    return Response.json(result);
  }

  if (action === "executeSteps") {
    console.log("[GuildOS:api/quest/cat-pipeline]", "POST executeSteps", {
      questId,
      userId: typeof user.id === "string" ? `${user.id.slice(0, 8)}…` : user.id,
    });
    const result = await runCatPipelineExecuteSteps({ questId, userId: user.id, client: db });
    console.log("[GuildOS:api/quest/cat-pipeline]", "executeSteps response", {
      questId,
      ok: result?.ok,
      stoppedAt: result?.stoppedAt,
      summary: result?.summary,
      stepIds: Array.isArray(result?.steps) ? result.steps.map((s) => s.id) : [],
    });
    return Response.json(result);
  }

  if (action === "planAndExecute") {
    const tactical = await runCatPipelineTacticalPlan({ questId, userId: user.id, client: db });
    if (!tactical.ok) {
      return Response.json(tactical);
    }
    const execution = await runCatPipelineExecuteSteps({ questId, userId: user.id, client: db });
    return Response.json({
      ok: execution.ok !== false,
      summary: tactical.summary && execution.summary ? `${tactical.summary} · ${execution.summary}` : execution.summary || tactical.summary,
      tacticalPlan: tactical,
      executeSteps: execution,
      stoppedAt: execution.ok === false ? execution.stoppedAt : undefined,
    });
  }

  return Response.json({ error: "Unhandled action" }, { status: 500 });
}

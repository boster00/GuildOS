/**
 * Quest domain — single route; triage via ?action=
 * GET:  get (id=)
 * POST: request (default)
 */
import { requireUser } from "@/libs/council/auth/server";
import {
  assignQuest,
  createQuest,
  getQuest,
  appendInventoryItem,
  updateQuest,
  recordQuestComment,
  QUEST_STAGES,
} from "@/libs/quest";
import {
  updateQuestAssignee,
} from "@/libs/council/database/serverQuest.js";
import { database } from "@/libs/council/database";

const GET_ACTIONS = ["get"];

export async function GET(request) {
  const action = request.nextUrl.searchParams.get("action");
  const user = await requireUser();

  if (!action || !GET_ACTIONS.includes(action)) {
    return Response.json(
      {
        error: "Missing or invalid action",
        validActions: GET_ACTIONS,
        examples: [
          "/api/quest?action=salesOrders",
          "/api/quest?action=get&id=<quest-uuid>",
        ],
      },
      { status: 400 }
    );
  }

  if (action === "get") {
    const id = request.nextUrl.searchParams.get("id");
    if (!id) {
      return Response.json({ error: "id query parameter is required" }, { status: 400 });
    }

    const { data, error } = await getQuest(id);

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return Response.json({ error: "Quest not found" }, { status: 404 });
    }

    if (data.owner_id !== user.id) {
      return Response.json({ error: "Not authorized" }, { status: 403 });
    }

    return Response.json(data);
  }

  return Response.json({ error: "Unhandled action" }, { status: 500 });
}

export async function POST(request) {
  const action = request.nextUrl.searchParams.get("action") || "request";

  if (action === "triage_escalated") {
    const user = await requireUser();
    const db = await database.init("server");
    const { data: quests } = await db
      .from("quests")
      .select("id, title, description, inventory, assigned_to, assignee_id")
      .eq("owner_id", user.id)
      .eq("stage", "escalated");

    if (!quests?.length) {
      return Response.json({ ok: true, results: [], message: "No escalated quests" });
    }

    // For each quest, read latest comments to understand the escalation reason
    const questIds = quests.map((q) => q.id);
    const { data: comments } = await db
      .from("quest_comments")
      .select("quest_id, summary, source, action, created_at")
      .in("quest_id", questIds)
      .order("created_at", { ascending: false })
      .limit(100);

    const commentsByQuest = {};
    for (const c of comments || []) {
      if (!commentsByQuest[c.quest_id]) commentsByQuest[c.quest_id] = [];
      commentsByQuest[c.quest_id].push(c);
    }

    const results = quests.map((q) => {
      const qComments = (commentsByQuest[q.id] || []).slice(0, 5);
      const recentComments = qComments.map((c) => `[${c.source}/${c.action}] ${c.summary}`).join("\n");

      // Analyze: what is the issue, what could solve it, can we auto-resolve?
      const escalationText = qComments.map((c) => c.summary).join(" ").toLowerCase();

      let issue = "Unknown blocker";
      let proposedSolution = "Review manually";
      let canAutoResolve = false;

      if (/missing.*(?:key|token|credential|secret|password|env)|supabase.*key|env.*not.*set/i.test(escalationText)) {
        issue = "Missing credentials or environment variables";
        proposedSolution = "Provide the required credentials via base64-encoded message or .env.local file";
        canAutoResolve = true;
      } else if (/auth.*(?:expired|refresh|failed)|permission.*denied|403|401/i.test(escalationText)) {
        issue = "Authentication or permission failure";
        proposedSolution = "Refresh auth tokens or update permissions";
        canAutoResolve = true;
      } else if (/(?:install|npm|package|module).*(?:missing|not found|failed)/i.test(escalationText)) {
        issue = "Missing dependency or build failure";
        proposedSolution = "Install missing packages or fix build configuration";
        canAutoResolve = true;
      } else if (/figma|design.*file|image.*export/i.test(escalationText)) {
        issue = "Need access to design assets (Figma/images)";
        proposedSolution = "Provide Figma access token or export the needed assets";
        canAutoResolve = false;
      } else if (/decision|choose|which.*option|unclear|ambiguous/i.test(escalationText)) {
        issue = "Needs a decision or clarification from user";
        proposedSolution = "User provides direction";
        canAutoResolve = false;
      } else {
        issue = "Agent reported a blocker — see comments below";
        proposedSolution = "Review the comments and provide guidance";
        canAutoResolve = false;
      }

      return {
        questId: q.id,
        title: q.title,
        assignedTo: q.assigned_to,
        issue,
        proposedSolution,
        canAutoResolve,
        recentComments,
      };
    });

    return Response.json({ ok: true, results });
  }

  if (action === "resolve_escalation") {
    const user = await requireUser();
    let body;
    try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
    const { questId, resolution } = body || {};
    if (!questId || !resolution) {
      return Response.json({ error: "questId and resolution are required" }, { status: 400 });
    }
    const { data: quest } = await getQuest(questId);
    if (!quest || quest.owner_id !== user.id) {
      return Response.json({ error: "Quest not found or not authorized" }, { status: 404 });
    }
    if (quest.stage !== "escalated") {
      return Response.json({ error: "Quest is not in escalated stage" }, { status: 400 });
    }
    await recordQuestComment(questId, {
      source: "guildmaster",
      action: "resolve_escalation",
      summary: resolution,
    });
    await updateQuest(questId, { stage: "execute" });
    return Response.json({ ok: true, message: "Escalation resolved, quest returned to execute" });
  }

  if (!["request"].includes(action)) {
    return Response.json(
      { error: "Invalid action", validActions: ["request", "triage_escalated", "resolve_escalation"] },
      { status: 400 }
    );
  }

  const user = await requireUser();

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { text } = body;

  if (!text || typeof text !== "string" || !text.trim()) {
    return Response.json({ error: "text is required" }, { status: 400 });
  }

  const { data, error } = await createQuest({
    userId: user.id,
    title: "New Request",
    description: text.trim(),
    stage: "execute",
  });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({
    questId: data.id,
    stage: "execute",
    title: "New Request",
  });
}

/**
 * PATCH body: { id, stage? } — update quest via {@link updateQuest} (stage optional if other fields sent)
 * PATCH body: { id, title?, description?, deliverables?, dueDate?, due_date?, assigneeName?, inventory?, items?, nextSteps?, next_steps? }
 * PATCH body: { id, action: "addItem", item_key, value } — append inventory row
 */
export async function PATCH(request) {
  const user = await requireUser();

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id.trim() : "";

  if (!id) {
    return Response.json({ error: "id is required" }, { status: 400 });
  }

  const { data: quest, error: readErr } = await getQuest(id);
  if (readErr) {
    return Response.json({ error: readErr.message }, { status: 500 });
  }
  if (!quest) {
    return Response.json({ error: "Quest not found" }, { status: 404 });
  }
  if (quest.owner_id !== user.id) {
    return Response.json({ error: "Not authorized" }, { status: 403 });
  }

  if (body.action === "addItem") {
    const item_key = typeof body.item_key === "string" ? body.item_key.trim() : "";
    if (!item_key) {
      return Response.json({ error: "item_key is required" }, { status: 400 });
    }
    const value = body.value;
    const { error: appendErr } = await appendInventoryItem(id, {
      item_key,
      payload: value,
      source: "manual_ui",
    });
    if (appendErr) {
      return Response.json({ error: appendErr.message }, { status: 500 });
    }
    return Response.json({ ok: true });
  }

  let assigneeTouched = false;
  if ("assigneeName" in body) {
    assigneeTouched = true;
    const raw = typeof body.assigneeName === "string" ? body.assigneeName.trim() : "";
    if (!raw) {
      const { error: clearErr } = await updateQuestAssignee(id, { assigneeId: null, assignedTo: null });
      if (clearErr) {
        return Response.json({ error: clearErr.message }, { status: 500 });
      }
    } else {
      const { error: assErr } = await assignQuest(id, raw);
      if (assErr) {
        return Response.json({ error: assErr.message }, { status: 400 });
      }
    }
  }

  const updates = {};

  if (typeof body.title === "string") {
    updates.title = body.title;
  }
  if (body.description !== undefined) {
    updates.description = body.description;
  }
  if (body.deliverables !== undefined) {
    updates.deliverables = body.deliverables;
  }
  if (body.dueDate !== undefined) {
    updates.dueDate = body.dueDate === null || body.dueDate === "" ? null : body.dueDate;
  } else if (body.due_date !== undefined) {
    updates.dueDate = body.due_date === null || body.due_date === "" ? null : body.due_date;
  }
  if (body.inventory !== undefined) {
    updates.inventory = body.inventory;
  } else if (body.items !== undefined) {
    updates.items = body.items;
  }
  if (body.nextSteps !== undefined) {
    updates.nextSteps = body.nextSteps;
  } else if (body.next_steps !== undefined) {
    updates.nextSteps = body.next_steps;
  }

  const stage = typeof body.stage === "string" ? body.stage.trim() : "";
  if (stage) {
    updates.stage = stage;
  }

  if (Object.keys(updates).length === 0 && !assigneeTouched) {
    return Response.json(
      {
        error:
          "No valid fields to update. Use stage, title, description, deliverables, dueDate, assigneeName, inventory, items, nextSteps, or action: addItem.",
      },
      { status: 400 },
    );
  }

  const ALL_STAGES = [...QUEST_STAGES, "idea", "plan", "assign", "completed"];
  if (updates.stage !== undefined && !ALL_STAGES.includes(updates.stage)) {
    return Response.json({ error: "Invalid stage", validStages: [...QUEST_STAGES] }, { status: 400 });
  }

  if (Object.keys(updates).length > 0) {
    const { error } = await updateQuest(id, updates);
    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }
  }

  const { data: fresh, error: reloadErr } = await getQuest(id);
  if (reloadErr) {
    return Response.json({ error: reloadErr.message }, { status: 500 });
  }
  return Response.json({ ok: true, data: fresh ?? null });
}

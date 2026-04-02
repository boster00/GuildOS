/**
 * Quest domain — single route; triage via ?action=
 * GET:  salesOrders | get (id=)
 * POST: request (default)
 */
import { requireUser } from "@/libs/council/auth/server";
import {
  assignQuest,
  createQuest,
  getQuest,
  appendInventoryItem,
  updateQuest,
  QUEST_STAGES,
} from "@/libs/quest";
import { getRecentOrders } from "@/libs/skill_book/zoho";
import {
  insertQuestMinimal,
  selectQuestIdByOwnerTitle,
  updateQuestAssignee,
} from "@/libs/council/database/serverQuest.js";
import { zohoErrorToJsonPayload } from "@/libs/weapon/zoho";

const GET_ACTIONS = ["salesOrders", "sales-orders", "get"];

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

  if (action === "salesOrders" || action === "sales-orders") {
    const res = await getRecentOrders({ module: "salesorders", numOfRecords: 10 });
    if (!res.ok) {
      return Response.json(zohoErrorToJsonPayload(new Error(res.msg)), { status: 400 });
    }
    const data = /** @type {unknown[]} */ (res.items.salesorders ?? []);

    const title = "Quest 1: Recent Sales Orders";
    const { data: existingQuest } = await selectQuestIdByOwnerTitle(user.id, title);
    const questId =
      existingQuest?.id ??
      (await insertQuestMinimal({ ownerId: user.id, title, stage: "execute" })).data?.id;

    await appendInventoryItem(questId, {
      item_key: "quest1_sales_orders",
      payload: {
        source: "zoho_books",
        row_count: data.length,
        rows: data,
      },
    });

    return Response.json({
      questId,
      count: data.length,
      rows: data,
    });
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

  if (action !== "request") {
    return Response.json(
      { error: "Invalid action", validActions: ["request"] },
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
    assignedTo: "cat",
    stage: "idea",
  });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({
    questId: data.id,
    stage: "idea",
    title: "New Request",
    assigned_to: "cat",
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

  if (updates.stage !== undefined && !QUEST_STAGES.includes(updates.stage)) {
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

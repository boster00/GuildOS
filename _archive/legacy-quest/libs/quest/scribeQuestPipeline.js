import { createServerClient } from "@/libs/council/database";
import {
  getQuestForOwner,
  transitionQuestStage,
  appendAgentExecutionAttempt,
  patchQuestAgentExecution,
  appendInventoryItem,
} from "@/libs/quest/runtime.js";
import { getAdventurerByName } from "@/libs/adventurer/create.js";
import { adventurerPresetKey } from "@/libs/adventurer/capabilitiesJson.js";
import { getRecentOrders } from "@/libs/skill_book/zoho";

function buildSalesOrdersHtmlTable(rows) {
  const esc = (s) =>
    String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  const head = "<tr><th>ID</th><th>Number</th><th>Customer</th><th>Date</th><th>Total</th><th>Status</th></tr>";
  const body = (rows || [])
    .map(
      (r) =>
        `<tr><td>${esc(r.id)}</td><td>${esc(r.salesorder_number)}</td><td>${esc(r.customer_name)}</td><td>${esc(r.date)}</td><td>${esc(r.total)}</td><td>${esc(r.status)}</td></tr>`,
    )
    .join("");
  return `<table class="zoho-sales-orders"><thead>${head}</thead><tbody>${body}</tbody></table>`;
}

/**
 * @param {{ questId: string, userId: string, mode: "plan" | "execute" | "full", client?: import("@/libs/council/database/types.js").DatabaseClient }} opts
 */
export async function runScribeQuestPipeline({ questId, userId, mode, client: injected }) {
  const client = injected || (await createServerClient());
  const steps = [];

  const { data: quest, error: qErr } = await getQuestForOwner(questId, userId, { client });
  if (qErr || !quest) {
    return {
      ok: false,
      steps,
      stoppedAt: "load",
      summary: qErr?.message || "Quest not found",
    };
  }

  const assignee = quest.assigned_to ? String(quest.assigned_to).trim() : "";
  if (!assignee) {
    return { ok: false, steps, stoppedAt: "assignee", summary: "Quest has no assignee." };
  }

  const { data: adventurer, error: advErr } = await getAdventurerByName(assignee, { client });
  if (advErr || !adventurer) {
    return { ok: false, steps, stoppedAt: "adventurer", summary: advErr?.message || "Assignee not found." };
  }
  if (adventurer.owner_id !== userId) {
    return { ok: false, steps, stoppedAt: "owner", summary: "Assignee adventurer does not belong to this user." };
  }
  if (adventurerPresetKey(adventurer) !== "scribe") {
    return { ok: false, steps, stoppedAt: "class", summary: "Quest is not assigned to a scribe." };
  }

  if (mode === "plan" && quest.stage === "execute") {
    return {
      ok: false,
      steps,
      stoppedAt: "plan-mode-stage",
      summary: "Quest is already in execute; use mode execute or full instead of plan.",
    };
  }

  const runPlan =
    (mode === "plan" && (quest.stage === "assign" || quest.stage === "plan")) ||
    (mode === "full" && (quest.stage === "assign" || quest.stage === "plan"));
  const runExec = mode === "execute" || mode === "full";

  if (runPlan) {
    const plannedSteps = [{ skillbook: "zoho", action: "getRecentOrders" }];

    const { error: patchErr } = await patchQuestAgentExecution(
      questId,
      {
        plannedSteps,
        planSource: "scribe_pipeline",
      },
      { client },
    );
    if (patchErr) {
      return {
        ok: false,
        steps,
        stoppedAt: "plan-patch",
        summary: patchErr.message || String(patchErr),
      };
    }

    const { error: planLogErr } = await appendAgentExecutionAttempt(
      questId,
      {
        at: new Date().toISOString(),
        phase: "plan",
        ok: true,
        detail: "Documented default steps for Zoho recent orders fetch.",
      },
      { client },
    );
    if (planLogErr) {
      return {
        ok: false,
        steps,
        stoppedAt: "plan-log",
        summary: planLogErr.message || String(planLogErr),
      };
    }

    steps.push({
      id: "plan",
      title: "Document planned steps (agent_execution.plannedSteps)",
      output: { plannedSteps },
    });

    const { error: trErr } = await transitionQuestStage(questId, "execute", { client });
    if (trErr) {
      return { ok: false, steps, stoppedAt: "plan-transition", summary: trErr.message || String(trErr) };
    }
    steps.push({ id: "plan-transition", title: "assign → execute", output: { stage: "execute" } });
  }

  if (runExec) {
    const { data: q2 } = await getQuestForOwner(questId, userId, { client });
    const stageNow = q2?.stage || quest.stage;
    if (stageNow !== "execute") {
      return {
        ok: false,
        steps,
        stoppedAt: "execute-stage",
        summary: `Execute mode requires stage execute; got ${stageNow}. Run plan first or transition manually.`,
      };
    }

    const { error: execStartErr } = await appendAgentExecutionAttempt(
      questId,
      { at: new Date().toISOString(), phase: "execute", started: true },
      { client },
    );
    if (execStartErr) {
      return {
        ok: false,
        steps,
        stoppedAt: "execute-log-start",
        summary: execStartErr.message || String(execStartErr),
      };
    }

    let rows;
    try {
      rows = await getRecentOrders({ module: "salesorders", numOfRecords: 10 });
    } catch (fetchErr) {
      const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
      await appendAgentExecutionAttempt(
        questId,
        {
          at: new Date().toISOString(),
          phase: "execute",
          ok: false,
          error: msg,
        },
        { client },
      );
      return { ok: false, steps, stoppedAt: "fetch", summary: msg };
    }

    const html = buildSalesOrdersHtmlTable(rows);

    const { error: itemErr } = await appendInventoryItem(
      questId,
      {
        item_key: "deliverable_zoho_sales_orders",
        payload: {
          html,
          row_count: rows.length,
          rows,
          source: "zoho_books",
        },
      },
      { client },
    );

    if (itemErr) {
      await appendAgentExecutionAttempt(
        questId,
        {
          at: new Date().toISOString(),
          phase: "execute",
          ok: false,
          error: itemErr.message || String(itemErr),
        },
        { client },
      );
      return { ok: false, steps, stoppedAt: "item", summary: itemErr.message || String(itemErr) };
    }

    const { error: execDoneErr } = await appendAgentExecutionAttempt(
      questId,
      {
        at: new Date().toISOString(),
        phase: "execute",
        ok: true,
        rowCount: rows.length,
      },
      { client },
    );
    if (execDoneErr) {
      return {
        ok: false,
        steps,
        stoppedAt: "execute-log-done",
        summary: execDoneErr.message || String(execDoneErr),
      };
    }

    const { error: revErr } = await transitionQuestStage(questId, "review", { client });
    if (revErr) {
      return { ok: false, steps, stoppedAt: "review-transition", summary: revErr.message || String(revErr) };
    }

    steps.push({
      id: "execute",
      title: "Fetched Zoho rows, stored item, moved to review",
      output: { row_count: rows.length, stage: "review" },
    });
  }

  return {
    ok: true,
    steps,
    summary: mode === "plan" ? "Planned and moved to execute." : mode === "execute" ? "Executed and moved to review." : "Full pipeline completed.",
  };
}

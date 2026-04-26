import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/libs/council/auth/server";
import { database } from "@/libs/council/database";
import { selectQuestCommentsForQuest } from "@/libs/council/database/serverQuest.js";
import { GLOBAL_QUEST_ASSIGNEES } from "@/libs/adventurer_runtime/ui.js";
import { listAdventurers } from "@/libs/adventurer_runtime/server.js";
import { getQuestForOwner, QUEST_PATCH_RELATIVE_URL, QUEST_STAGES, searchItems } from "@/libs/quest";
import QuestActivityCommentsPanel from "./QuestActivityCommentsPanel.js";
import QuestDetailFieldEditClient from "./QuestDetailFieldEditClient.js";
import QuestNextStepsEditClient from "./QuestNextStepsEditClient.js";
import QuestItemsCarousel from "../../_components/QuestItemsCarousel.js";
// QuestAdvanceButtons removed — agent-driven model, no manual stage advance

function JsonBlock({ label, value, showEmptyObject = false }) {
  const isPlainObject = typeof value === "object" && value !== null && !Array.isArray(value);
  const emptyObject = isPlainObject && Object.keys(value).length === 0;
  if (value == null || (emptyObject && !showEmptyObject)) {
    return null;
  }
  const text =
    typeof value === "string" ? value : JSON.stringify(value, null, 2);
  return (
    <div className="mt-4">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-base-content/55">{label}</h2>
      <pre className="mt-1 max-h-64 overflow-auto rounded-xl border border-base-300 bg-base-200/50 p-3 text-xs text-base-content/90">
        {text}
      </pre>
    </div>
  );
}

/** Normalize one execution_plan row for display (skillbook+action; legacy dotted action + input/output or input_from/output_keys if stored). */
function executionPlanRowDisplay(row, index) {
  let skillbook = typeof row?.skillbook === "string" ? row.skillbook : "";
  let action = typeof row?.action === "string" ? row.action : "";
  if (!skillbook && action.includes(".")) {
    const dot = action.indexOf(".");
    skillbook = action.slice(0, dot);
    action = action.slice(dot + 1);
  }
  const input = Array.isArray(row?.input)
    ? row.input
    : Array.isArray(row?.input_from)
      ? row.input_from
      : [];
  const output = Array.isArray(row?.output)
    ? row.output
    : Array.isArray(row?.output_keys)
      ? row.output_keys
      : [];
  const params = row?.params && typeof row.params === "object" && !Array.isArray(row.params)
    ? row.params
    : null;
  return { index, skillbook, action, input, output, params };
}

function executionPlanAsArray(plan) {
  if (Array.isArray(plan)) return plan;
  if (plan && typeof plan === "object" && Array.isArray(plan.steps)) return plan.steps;
  return [];
}

function ExecutionPlanTable({ plan }) {
  const raw = executionPlanAsArray(plan);
  const rows = raw.map((row, i) => executionPlanRowDisplay(row, i));

  return (
    <div className="mt-4">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-base-content/55">
        Execution plan{rows.length > 0 ? ` (${rows.length})` : ""}
      </h2>
      {rows.length === 0 ? (
        <p className="mt-1 text-sm text-base-content/50">No steps yet.</p>
      ) : (
        <div className="mt-2 overflow-x-auto rounded-xl border border-base-300 bg-base-200/30">
          <table className="table table-sm w-full min-w-[32rem] border-collapse">
            <thead>
              <tr className="border-b border-base-300 bg-base-200/50 text-left [&_th]:font-semibold">
                <th className="w-10 px-3 py-2 text-xs uppercase tracking-wide text-base-content/55">#</th>
                <th className="px-3 py-2 text-xs uppercase tracking-wide text-base-content/55">Skill book</th>
                <th className="px-3 py-2 text-xs uppercase tracking-wide text-base-content/55">Action</th>
                <th className="px-3 py-2 text-xs uppercase tracking-wide text-base-content/55">Input</th>
                <th className="px-3 py-2 text-xs uppercase tracking-wide text-base-content/55">Output</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.index} className="border-b border-base-300/80 last:border-0 hover:bg-base-200/40">
                  <td className="px-3 py-2 align-top font-mono text-xs text-base-content/60">{r.index + 1}</td>
                  <td className="px-3 py-2 align-top font-mono text-sm text-base-content/90">{r.skillbook || "—"}</td>
                  <td className="px-3 py-2 align-top font-mono text-sm text-base-content/90">{r.action || "—"}</td>
                  <td className="px-3 py-2 align-top font-mono text-xs text-base-content/80">
                    {r.input.length ? r.input.join(", ") : r.params ? "" : "—"}
                    {r.params ? (
                      <details className="inline-block">
                        <summary className="cursor-pointer select-none" title="Inspect step params">
                          {r.input.length ? " " : ""}🔍 <span className="text-[0.65rem] text-base-content/50">params</span>
                        </summary>
                        <div className="mt-1 rounded-lg border border-base-300 bg-base-200/60 p-2 text-[0.7rem] leading-relaxed">
                          {Object.entries(r.params).map(([k, v]) => (
                            <div key={k}>
                              <span className="font-semibold text-base-content/70">{k}:</span>{" "}
                              <span className="text-base-content/90">{typeof v === "string" ? v : JSON.stringify(v)}</span>
                            </div>
                          ))}
                        </div>
                      </details>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 align-top font-mono text-xs text-base-content/80">
                    {r.output.length ? r.output.join(", ") : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Stage changes use PATCH /api/quest → updateQuest (cookies). Inline script drives optimistic UI + saving + tick. */
import QuestStageMenuClient from "./QuestStageMenuClient.js";

function QuestStageMenu({ questId, currentStage }) {
  return <QuestStageMenuClient questId={questId} initialStage={currentStage} />;
}


export default async function QuestDetailPage({ params }) {
  const { questId } = await params;
  const user = await getCurrentUser();

  if (!user) {
    return (
      <main className="guild-bg-quest-board min-h-dvh p-4 md:p-8">
        <section className="mx-auto max-w-3xl rounded-3xl border border-base-300 bg-base-100/88 p-6 shadow-xl backdrop-blur">
          <p className="text-base-content/80">Sign in to view this quest.</p>
          <Link href={`/signin?next=/quest-board/${questId}`} className="btn btn-primary mt-4">
            Sign in
          </Link>
        </section>
      </main>
    );
  }

  const db = await database.init("server");
  const { data: quest, error } = await getQuestForOwner(questId, user.id, { client: db });
  if (error || !quest) {
    notFound();
  }

  // Hydrate items + per-item comments via searchItems (libs/quest). Ownership
  // was just verified via getQuestForOwner, so use service role to sidestep
  // item-RLS evaluation quirks on the user-scoped server client.
  const svc = await database.init("service");
  const items = await searchItems(quest.id, { client: svc });
  quest.items = items;
  // Legacy alias — some downstream renderers still read quest.inventory.
  quest.inventory = items;

  const { data: roster } = await listAdventurers(user.id, { client: db });
  const assigneeOptions = [
    { value: "", label: "Unassigned" },
    ...Object.keys(GLOBAL_QUEST_ASSIGNEES).map((name) => ({
      value: name,
      label: `${name} (assistant)`,
    })),
    ...(roster || []).map((a) => ({
      value: a.name,
      label: a.name,
    })),
  ];

  const { data: commentsRows } = await selectQuestCommentsForQuest(quest.id, { client: db, limit: 100 });
  const questComments = commentsRows ?? [];

  return (
    <main className="guild-bg-quest-board min-h-dvh p-4 md:p-8">
      <section className="mx-auto max-w-3xl rounded-3xl border border-base-300 bg-base-100/88 p-6 shadow-xl backdrop-blur">
        <nav className="text-sm text-base-content/60">
          <Link href="/quest-board" className="link link-hover">
            The Inn
          </Link>
          <span className="mx-2">/</span>
          <Link href="/quest-board" className="link link-hover">
            Quest board
          </Link>
          <span className="mx-2">/</span>
          <span className="text-base-content">Quest</span>
        </nav>

        <QuestDetailFieldEditClient
          questId={quest.id}
          initialTitle={quest.title}
          initialDescription={quest.description}
          initialInventory={quest.inventory}
          initialItems={Array.isArray(quest.items) ? quest.items : []}
          initialAssignedTo={quest.assigned_to}
          initialAssigneeId={quest.assignee_id}
          initialDueDate={quest.due_date}
          assigneeOptions={assigneeOptions}
          stageControls={<QuestStageMenu questId={quest.id} currentStage={quest.stage} />}
        />

        <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium text-base-content/55">Created</dt>
            <dd className="mt-0.5">{quest.created_at ? new Date(quest.created_at).toLocaleString() : "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-base-content/55">Updated</dt>
            <dd className="mt-0.5">{quest.updated_at ? new Date(quest.updated_at).toLocaleString() : "—"}</dd>
          </div>
        </dl>

        <div className="mt-6">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-base-content/55">Items</h2>
          <div className="mt-2">
            <QuestItemsCarousel items={Array.isArray(quest.items) ? quest.items : []} />
          </div>
        </div>

        <ExecutionPlanTable plan={quest.execution_plan} />

        <QuestNextStepsEditClient
          questId={quest.id}
          initialNextSteps={Array.isArray(quest.next_steps) ? quest.next_steps : []}
        />

        <QuestActivityCommentsPanel questId={quest.id} initialComments={questComments} />
      </section>
    </main>
  );
}

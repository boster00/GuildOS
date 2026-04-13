import Link from "next/link";
import Script from "next/script";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/libs/council/auth/server";
import { database } from "@/libs/council/database";
import { selectQuestCommentsForQuest } from "@/libs/council/database/serverQuest.js";
import { GLOBAL_QUEST_ASSIGNEES } from "@/libs/proving_grounds/ui.js";
import { listAdventurers } from "@/libs/proving_grounds/server.js";
import { getQuestForOwner, QUEST_PATCH_RELATIVE_URL, QUEST_STAGES } from "@/libs/quest";
import QuestActivityCommentsPanel from "./QuestActivityCommentsPanel.js";
import QuestDetailFieldEditClient from "./QuestDetailFieldEditClient.js";
import QuestNextStepsEditClient from "./QuestNextStepsEditClient.js";
import QuestAdvanceButtons from "./QuestAdvanceButtons.js";

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
function QuestStageMenu({ questId, currentStage }) {
  const rootId = `quest-stage-root-${questId}`;
  const scriptId = `quest-stage-init-${questId}`;

  return (
    <div
      id={rootId}
      className="flex flex-wrap items-center gap-2"
      data-quest-id={questId}
      data-stage={currentStage}
      data-patch-url={QUEST_PATCH_RELATIVE_URL}
    >
      <details className="dropdown dropdown-end group relative">
        <summary className="badge badge-primary cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden">
          <span className="qsm-label">{currentStage}</span>
          <span className="ml-1 text-[0.65em] opacity-70" aria-hidden>
            ▾
          </span>
        </summary>
        <div className="dropdown-content absolute end-0 z-50 mt-2 min-w-[12rem] rounded-box border border-base-300 bg-base-100 p-2 shadow-lg">
          <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-base-content/50">Set stage</p>
          <ul className="menu menu-compact w-full p-0">
            {QUEST_STAGES.map((s) => (
              <li key={s}>
                <button
                  type="button"
                  className="qsm-opt w-full justify-start text-left font-normal"
                  data-stage={s}
                  disabled={s === currentStage}
                >
                  {s}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </details>
      <span
        className="qsm-saved hidden inline-flex items-center gap-1 text-sm font-medium text-success pointer-events-none"
        aria-live="polite"
      >
        <span aria-hidden>✓</span> Saved
      </span>
      <Script id={scriptId} strategy="afterInteractive">{`
(function () {
  var root = document.getElementById(${JSON.stringify(rootId)});
  if (!root || root.dataset.qsmReady === "1") return;
  root.dataset.qsmReady = "1";
  var questId = root.dataset.questId;
  var patchUrl = root.dataset.patchUrl || "/api/quest";
  var committed = root.dataset.stage || "";
  var summaryLabel = root.querySelector(".qsm-label");
  var savedEl = root.querySelector(".qsm-saved");
  var details = root.querySelector("details");
  var saveHideTimer;

  function syncDisabled() {
    root.querySelectorAll(".qsm-opt").forEach(function (b) {
      b.disabled = b.getAttribute("data-stage") === committed;
    });
  }

  function setLabel(text) {
    if (summaryLabel) summaryLabel.textContent = text;
  }

  function showSavedTick() {
    if (!savedEl) return;
    clearTimeout(saveHideTimer);
    savedEl.classList.remove("hidden");
    savedEl.style.transition = "none";
    savedEl.style.opacity = "1";
    void savedEl.offsetHeight;
    savedEl.style.transition = "opacity 3s ease-out";
    requestAnimationFrame(function () {
      savedEl.style.opacity = "0";
    });
    saveHideTimer = setTimeout(function () {
      savedEl.classList.add("hidden");
      savedEl.style.transition = "";
      savedEl.style.opacity = "";
    }, 3000);
  }

  // Close dropdown when clicking outside
  document.addEventListener("click", function (e) {
    if (details && details.open && !details.contains(e.target)) {
      details.open = false;
    }
  });

  root.querySelectorAll(".qsm-opt").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var next = btn.getAttribute("data-stage");
      if (!next || next === committed) return;
      var prev = committed;
      var prevText = btn.textContent;
      committed = next;
      root.dataset.stage = next;
      setLabel(next);
      syncDisabled();
      btn.disabled = true;
      btn.textContent = "Saving…";
      if (details) details.open = false;

      fetch(patchUrl, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ id: questId, stage: next }),
      })
        .then(function (res) {
          btn.textContent = prevText;
          if (!res.ok) {
            committed = prev;
            root.dataset.stage = prev;
            setLabel(prev);
            syncDisabled();
            return;
          }
          syncDisabled();
          showSavedTick();
        })
        .catch(function () {
          btn.textContent = prevText;
          committed = prev;
          root.dataset.stage = prev;
          setLabel(prev);
          syncDisabled();
        });
    });
  });
})();
      `}</Script>
    </div>
  );
}

export default async function QuestDetailPage({ params }) {
  const { questId } = await params;
  const user = await getCurrentUser();

  if (!user) {
    return (
      <main className="guild-bg-inn min-h-dvh p-4 md:p-8">
        <section className="mx-auto max-w-3xl rounded-3xl border border-base-300 bg-base-100/88 p-6 shadow-xl backdrop-blur">
          <p className="text-base-content/80">Sign in to view this quest.</p>
          <Link href={`/signin?next=/town/inn/quest-board/${questId}`} className="btn btn-primary mt-4">
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
    <main className="guild-bg-inn min-h-dvh p-4 md:p-8">
      <section className="mx-auto max-w-3xl rounded-3xl border border-base-300 bg-base-100/88 p-6 shadow-xl backdrop-blur">
        <nav className="text-sm text-base-content/60">
          <Link href="/town/inn" className="link link-hover">
            The Inn
          </Link>
          <span className="mx-2">/</span>
          <Link href="/town/inn/quest-board" className="link link-hover">
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
          initialAssignedTo={quest.assigned_to}
          initialAssigneeId={quest.assignee_id}
          initialDueDate={quest.due_date}
          assigneeOptions={assigneeOptions}
          stageControls={<><QuestStageMenu questId={quest.id} currentStage={quest.stage} /><QuestAdvanceButtons questId={quest.id} currentStage={quest.stage} /></>}
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

        <JsonBlock label="Deliverables" value={quest.deliverables} />

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

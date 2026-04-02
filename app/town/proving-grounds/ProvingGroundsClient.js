"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";

// ---------------------------------------------------------------------------
// Default left-rail setup steps (BigQuery)
// ---------------------------------------------------------------------------
const BIGQUERY_DEFAULT_STEPS = [
  "Go to GCP Console → IAM & Admin → Service Accounts. Create a new service account and grant it the BigQuery Data Viewer and BigQuery Job User roles.",
  "On the service account page, go to Keys → Add Key → Create new key → JSON. Download the key file.",
  "In GuildOS, open Council → Potions → add a new potion with kind set to bigquery_service_account and paste the full contents of the JSON key file into the secrets field.",
  "Return here and run the BigQuery test quest. The Blacksmith will scaffold the weapon and skill book automatically.",
];

// ---------------------------------------------------------------------------
// Left rail: setup steps + seed
// ---------------------------------------------------------------------------
function SetupStepsRail() {
  const [steps, setSteps] = useState(null);
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    let c = false;
    (async () => {
      try {
        const r = await fetch("/api/proving_grounds?action=getSetupSteps");
        const j = await r.json().catch(() => ({}));
        if (!c) setSteps(Array.isArray(j.steps) && j.steps.length > 0 ? j.steps : BIGQUERY_DEFAULT_STEPS);
      } catch {
        if (!c) setSteps(BIGQUERY_DEFAULT_STEPS);
      }
    })();
    return () => { c = true; };
  }, []);

  const seedGuild = async () => {
    setSeeding(true);
    try {
      const r = await fetch("/api/proving_grounds", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "seedGuildAdventurers" }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { toast.error(j.error || "Seed failed"); return; }
      toast.success(`Guild seeded — ${j.count ?? 0} adventurers ready`);
    } finally { setSeeding(false); }
  };

  return (
    <aside className="md:sticky md:top-20 space-y-4 rounded-2xl border border-primary/25 bg-primary/5 p-4 text-sm md:w-80 md:shrink-0">
      <p className="text-xs font-semibold uppercase tracking-wide text-primary">Setup steps</p>
      <div className="space-y-3 text-xs leading-relaxed text-base-content/80">
        {steps === null ? (
          <p className="text-base-content/50">Loading…</p>
        ) : (
          steps.map((step, i) => (
            <div key={i} className="rounded-lg border border-base-300/60 bg-base-100/50 p-3">
              <span className="font-semibold text-primary">{i + 1}. </span>{step}
            </div>
          ))
        )}
      </div>
      <div className="border-t border-primary/20 pt-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary mb-2">Guild roster</p>
        <p className="text-[11px] text-base-content/60 mb-2">
          Seeds Cat, Pig, Runesmith, and Blacksmith. Safe to run multiple times.
        </p>
        <button type="button" className="btn btn-outline btn-xs w-full" disabled={seeding} onClick={seedGuild}>
          {seeding ? <><span className="loading loading-spinner loading-xs" /> Seeding…</> : "Seed Guild Adventurers"}
        </button>
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Log viewer — structured, copy-friendly, failure-highlighted
// ---------------------------------------------------------------------------
function LogViewer({ logs }) {
  const ref = useRef(null);
  if (!logs || !Array.isArray(logs) || logs.length === 0) return null;

  const copyAll = () => {
    const text = JSON.stringify(logs, null, 2);
    navigator.clipboard.writeText(text).then(() => toast.success("Logs copied")).catch(() => toast.error("Copy failed"));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-base-content/70">Pipeline log ({logs.length} steps)</p>
        <button type="button" className="btn btn-ghost btn-xs" onClick={copyAll}>Copy JSON</button>
      </div>
      <div className="space-y-1.5 max-h-[60vh] overflow-auto">
        {logs.map((entry, i) => {
          const failed = entry.ok === false;
          const borderColor = failed ? "border-error/60" : "border-base-300/50";
          const bgColor = failed ? "bg-error/5" : "bg-base-100/60";
          return (
            <div key={i} className={`rounded-lg border ${borderColor} ${bgColor} p-3 text-xs font-mono`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className={`inline-block w-2 h-2 rounded-full ${failed ? "bg-error" : "bg-success"}`} />
                  <span className="font-semibold text-base-content">{entry.action || `step ${entry.step ?? i}`}</span>
                </div>
                <span className="text-base-content/50 shrink-0">{entry.stage || ""}</span>
              </div>
              {entry.questTitle && (
                <p className="mt-1 text-base-content/60 truncate">Quest: {entry.questTitle}</p>
              )}
              {entry.error && (
                <p className="mt-1.5 text-error font-medium break-words">Error: {entry.error}</p>
              )}
              {entry.detail && (
                <details className="mt-1.5">
                  <summary className="cursor-pointer text-base-content/50 hover:text-base-content/70">detail</summary>
                  <pre className="mt-1 text-[10px] text-base-content/70 whitespace-pre-wrap break-all">
                    {JSON.stringify(entry.detail, null, 2)}
                  </pre>
                </details>
              )}
              {entry.note && <p className="mt-1 text-base-content/50 italic">{entry.note}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Weapon / Skill book tester — loads TOC, renders input fields
// ---------------------------------------------------------------------------
function WeaponTester({ catalog }) {
  const [selectedBook, setSelectedBook] = useState("");
  const [selectedAction, setSelectedAction] = useState("");
  const [toc, setToc] = useState(null);
  const [loadingToc, setLoadingToc] = useState(false);
  const [fieldValues, setFieldValues] = useState({});
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);

  // When book changes, load TOC
  useEffect(() => {
    if (!selectedBook) { setToc(null); return; }
    let c = false;
    setLoadingToc(true);
    (async () => {
      try {
        const r = await fetch(`/api/proving_grounds?action=getSkillBookToc&skillBookId=${encodeURIComponent(selectedBook)}`);
        const j = await r.json().catch(() => ({}));
        if (!c) {
          setToc(j.toc && typeof j.toc === "object" ? j.toc : null);
          setSelectedAction("");
          setFieldValues({});
          setResult(null);
        }
      } catch {
        if (!c) setToc(null);
      } finally {
        if (!c) setLoadingToc(false);
      }
    })();
    return () => { c = true; };
  }, [selectedBook]);

  // Derive input fields from TOC entry
  const actionEntry = toc && selectedAction ? toc[selectedAction] : null;
  const inputFields = useMemo(() => {
    if (!actionEntry) return [];
    const input = actionEntry.input || actionEntry.inputExample || {};
    return Object.entries(input).map(([key, spec]) => ({
      key,
      type: typeof spec === "string" ? spec : JSON.stringify(spec),
    }));
  }, [actionEntry]);

  // When action changes, reset fields
  useEffect(() => {
    const defaults = {};
    for (const f of inputFields) {
      defaults[f.key] = "";
    }
    setFieldValues(defaults);
    setResult(null);
  }, [selectedAction, inputFields]);

  const actionNames = toc ? Object.keys(toc) : [];

  const runTest = async () => {
    if (!selectedBook || !selectedAction) return;
    setRunning(true);
    setResult(null);
    try {
      // Parse field values — attempt JSON for objects/arrays, otherwise string
      const payload = {};
      for (const [k, v] of Object.entries(fieldValues)) {
        const trimmed = String(v).trim();
        if (trimmed === "") continue;
        if (/^[{\[]/.test(trimmed)) {
          try { payload[k] = JSON.parse(trimmed); continue; } catch { /* use as string */ }
        }
        if (trimmed === "true") { payload[k] = true; continue; }
        if (trimmed === "false") { payload[k] = false; continue; }
        if (trimmed !== "" && Number.isFinite(Number(trimmed)) && String(Number(trimmed)) === trimmed) {
          payload[k] = Number(trimmed);
          continue;
        }
        payload[k] = v;
      }

      // Use Blacksmith as default adventurer for weapon testing
      const BLACKSMITH_ID = "a4000000-0000-0000-0000-000000000004";
      const r = await fetch("/api/proving_grounds", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "runAction",
          adventurerId: BLACKSMITH_ID,
          skillBookId: selectedBook,
          actionName: selectedAction,
          payload,
        }),
      });
      const j = await r.json().catch(() => ({}));
      setResult(j);
      if (j.ok) toast.success("Action returned OK");
      else toast.error(j.msg || j.error || "Action failed");
    } finally { setRunning(false); }
  };

  return (
    <section className="rounded-2xl border border-base-300 bg-base-100/90 p-5 shadow-sm">
      <h2 className="text-lg font-bold text-base-content">Weapon / Skill Book Tester</h2>
      <p className="mt-1 text-xs text-base-content/60">
        Select a skill book and action. Input fields are generated from the TOC definition.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="form-control w-full">
          <span className="label-text text-xs font-mono">skill_book</span>
          <select
            className="select select-bordered select-sm mt-1 w-full font-mono text-xs"
            value={selectedBook}
            onChange={(e) => setSelectedBook(e.target.value)}
          >
            <option value="">— select —</option>
            {catalog.map((b) => (
              <option key={b.id} value={b.id}>{b.id} — {b.title}</option>
            ))}
          </select>
        </label>

        <label className="form-control w-full">
          <span className="label-text text-xs font-mono">action</span>
          <select
            className="select select-bordered select-sm mt-1 w-full font-mono text-xs"
            value={selectedAction}
            onChange={(e) => setSelectedAction(e.target.value)}
            disabled={!toc || loadingToc}
          >
            <option value="">— {loadingToc ? "loading…" : "select action"} —</option>
            {actionNames.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </label>
      </div>

      {actionEntry && (
        <p className="mt-2 text-xs text-base-content/60 italic">{actionEntry.summary || actionEntry.description || ""}</p>
      )}

      {inputFields.length > 0 && (
        <div className="mt-4 space-y-3 border-t border-base-300/60 pt-4">
          <p className="text-xs font-semibold text-base-content/80">Input fields</p>
          {inputFields.map((f) => (
            <label key={f.key} className="form-control w-full">
              <div className="flex items-baseline gap-2">
                <span className="label-text text-xs font-mono">{f.key}</span>
                <span className="text-[10px] text-base-content/40">{f.type}</span>
              </div>
              <input
                type="text"
                className="input input-bordered input-sm mt-1 w-full font-mono text-xs"
                placeholder={f.type}
                value={fieldValues[f.key] ?? ""}
                onChange={(e) => setFieldValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
                disabled={running}
              />
            </label>
          ))}
        </div>
      )}

      <button
        type="button"
        className="btn btn-primary btn-sm mt-4"
        disabled={running || !selectedBook || !selectedAction}
        onClick={runTest}
      >
        {running ? <><span className="loading loading-spinner loading-xs" /> Running…</> : "Run Action"}
      </button>

      {result && (
        <div className={`mt-4 rounded-xl border p-3 ${result.ok ? "border-success/30 bg-success/5" : "border-error/30 bg-error/5"}`}>
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold ${result.ok ? "text-success" : "text-error"}`}>
              {result.ok ? "OK" : "FAILED"}{result.msg ? `: ${result.msg}` : ""}
            </span>
            <button
              type="button"
              className="btn btn-ghost btn-xs"
              onClick={() => {
                navigator.clipboard.writeText(JSON.stringify(result, null, 2)).then(() => toast.success("Copied"));
              }}
            >Copy</button>
          </div>
          {result.items && Object.keys(result.items).length > 0 && (
            <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-base-100 p-2 font-mono text-[10px] text-base-content/80 whitespace-pre-wrap break-all">
              {JSON.stringify(result.items, null, 2)}
            </pre>
          )}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Main client
// ---------------------------------------------------------------------------
export default function ProvingGroundsClient() {
  const [catalog, setCatalog] = useState([]);
  const [testQuestInput, setTestQuestInput] = useState("");
  const [testRunning, setTestRunning] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const logsRef = useRef(null);

  // Load skill book catalog
  useEffect(() => {
    let c = false;
    (async () => {
      try {
        const r = await fetch("/api/proving_grounds?action=listSkillBooks");
        const j = await r.json().catch(() => ({}));
        if (!c && Array.isArray(j.books)) setCatalog(j.books);
      } catch { /* noop */ }
    })();
    return () => { c = true; };
  }, []);

  const runTestQuest = async () => {
    const desc = testQuestInput.trim();
    if (!desc) { toast.error("Enter a quest description"); return; }
    setTestRunning(true);
    setTestResult(null);
    try {
      const r = await fetch("/api/proving_grounds", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "runTestQuest", title: desc.slice(0, 80), description: desc }),
      });
      const j = await r.json().catch(() => ({}));
      setTestResult(j && typeof j === "object" ? j : { raw: j });
      if (!r.ok || j.ok === false) toast.error(j.error || "Test quest failed — check logs");
      else toast.success(`Quest reached: ${j.finalStage}`);
      setTimeout(() => logsRef.current?.scrollIntoView({ behavior: "smooth" }), 200);
    } finally { setTestRunning(false); }
  };

  return (
    <div className="flex flex-col gap-6 md:flex-row md:items-start">
      <SetupStepsRail />
      <div className="min-w-0 flex-1 space-y-6">

        {/* ── Test Quest ── */}
        <section className="rounded-2xl border border-primary/40 bg-primary/5 p-5 shadow-sm">
          <h2 className="text-lg font-bold text-base-content">Test Quest</h2>
          <p className="mt-1 text-xs text-base-content/60">
            Describe a task. The guild pipeline runs to completion and forges any required weapons or skill books.
          </p>
          <textarea
            className="textarea textarea-bordered mt-3 min-h-[72px] w-full text-sm"
            placeholder='e.g. "Create a weapon that multiplies two numbers, use it in testskillbook under action test"'
            value={testQuestInput}
            onChange={(e) => setTestQuestInput(e.target.value)}
            disabled={testRunning}
          />
          <button
            type="button"
            className="btn btn-primary btn-sm mt-3"
            disabled={testRunning || !testQuestInput.trim()}
            onClick={runTestQuest}
          >
            {testRunning
              ? <><span className="loading loading-spinner loading-xs" /> Running… (may take several minutes)</>
              : "Submit Quest"}
          </button>
        </section>

        {/* ── Weapon / Skill Book Tester ── */}
        <WeaponTester catalog={catalog} />

        {/* ── Logs ── */}
        <section ref={logsRef} className="rounded-2xl border border-base-300 bg-base-200/30 p-5">
          <h2 className="text-lg font-bold text-base-content mb-3">Execution Log</h2>
          {testResult ? (
            <div className="space-y-4">
              {/* Summary bar */}
              <div className={`flex items-center gap-3 rounded-xl border p-3 ${testResult.ok ? "border-success/30 bg-success/5" : "border-error/30 bg-error/5"}`}>
                <span className={`inline-block w-3 h-3 rounded-full ${testResult.ok ? "bg-success" : "bg-error"}`} />
                <span className="text-sm font-semibold text-base-content">
                  {testResult.ok ? "Quest completed" : "Quest failed"}
                </span>
                <span className="text-xs text-base-content/50">
                  Stage: <span className="font-mono">{testResult.finalStage || "—"}</span>
                  {testResult.questId && <> &middot; Quest: <span className="font-mono text-[10px]">{testResult.questId}</span></>}
                </span>
              </div>

              {/* HTML report from claudeCLI */}
              {testResult.html && (
                <div className="rounded-xl border border-base-300 bg-base-100 overflow-auto">
                  <div dangerouslySetInnerHTML={{ __html: testResult.html }} />
                </div>
              )}

              {/* Step-by-step log */}
              <LogViewer logs={testResult.logs} />

              {/* Raw JSON for copy-paste debugging */}
              <details>
                <summary className="cursor-pointer text-xs font-medium text-base-content/60">Raw JSON (for feedback)</summary>
                <pre className="mt-2 max-h-64 overflow-auto rounded-lg border border-base-300 bg-base-100 p-2 font-mono text-[10px] text-base-content/75 whitespace-pre-wrap break-all select-all">
                  {JSON.stringify(testResult, null, 2)}
                </pre>
              </details>
            </div>
          ) : (
            <p className="text-sm text-base-content/50">Submit a quest to see execution logs here.</p>
          )}
        </section>

      </div>
    </div>
  );
}

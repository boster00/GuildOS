"use client";

import { useEffect, useState } from "react";
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
// Skill book action tester
// ---------------------------------------------------------------------------
function WeaponTester({ catalog, questId }) {
  const [selectedBook, setSelectedBook] = useState("questmaster");
  const [selectedAction, setSelectedAction] = useState("");
  const [toc, setToc] = useState(null);
  const [loadingToc, setLoadingToc] = useState(false);
  const [itemsJson, setItemsJson] = useState("{}");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [debugLog, setDebugLog] = useState(null);

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
          const loadedToc = j.toc && typeof j.toc === "object" ? j.toc : null;
          setToc(loadedToc);
          const defaultAction = loadedToc && "assign" in loadedToc ? "assign" : "";
          setSelectedAction(defaultAction);
          setResult(null);
          setDebugLog(null);
        }
      } catch {
        if (!c) setToc(null);
      } finally {
        if (!c) setLoadingToc(false);
      }
    })();
    return () => { c = true; };
  }, [selectedBook]);

  const actionEntry = toc && selectedAction ? toc[selectedAction] : null;
  const actionNames = toc ? Object.keys(toc) : [];

  const runTest = async () => {
    if (!selectedBook || !selectedAction) return;
    setRunning(true);
    setResult(null);
    setDebugLog(null);
    try {
      const payload = {};

      if (itemsJson.trim()) {
        try {
          const items = JSON.parse(itemsJson);
          if (items && typeof items === "object") Object.assign(payload, items);
        } catch { toast.error("Items JSON is invalid"); }
      }

      if (questId && !payload.questId) payload.questId = questId;

      const apiPayload = {
        action: "runAction",
        skillBookId: selectedBook,
        actionName: selectedAction,
        payload,
        questId: questId || undefined,
      };

      const r = await fetch("/api/proving_grounds", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(apiPayload),
      });
      const j = await r.json().catch(() => ({}));
      setResult(j);

      const meta = j.items?.meta || j.meta || {};
      setDebugLog({
        apiPayload,
        prompt: meta.prompt || null,
        modelResponse: meta.modelText || null,
        fullResponse: j,
      });

      if (j.ok) toast.success("Action returned OK");
      else toast.error(j.msg || j.error || "Action failed");
    } finally { setRunning(false); }
  };

  return (
    <section className="rounded-2xl border border-base-300 bg-base-100/90 p-5 shadow-sm">
      <h2 className="text-lg font-bold text-base-content">Skill Book Tester</h2>
      <p className="mt-1 text-xs text-base-content/60">
        Select a skill book and action. The quest ID above is auto-injected into the payload.
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
            <option value="innate_actions">innate_actions — NPC / Adventurer</option>
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

      <div className="mt-4 border-t border-base-300/60 pt-4">
        <label className="form-control w-full">
          <span className="label-text text-xs font-mono">Items</span>
          <textarea
            className="textarea textarea-bordered textarea-sm mt-1 w-full font-mono text-xs"
            rows={3}
            placeholder='{"item_key": "value", ...}'
            value={itemsJson}
            onChange={(e) => setItemsJson(e.target.value)}
            disabled={running}
          />
        </label>
      </div>

      <button
        type="button"
        className="btn btn-primary btn-sm mt-4"
        disabled={running || !selectedBook || !selectedAction}
        onClick={runTest}
      >
        {running ? <><span className="loading loading-spinner loading-xs" /> Running…</> : "Run Action!"}
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

      {debugLog && (
        <div className="mt-4 space-y-3 rounded-xl border border-info/30 bg-info/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-info">Debug Log</p>

          <details className="collapse collapse-arrow bg-base-100/80 rounded-lg">
            <summary className="collapse-title text-xs font-medium">API Payload</summary>
            <pre className="collapse-content max-h-48 overflow-auto font-mono text-[10px] whitespace-pre-wrap break-all">
              {JSON.stringify(debugLog.apiPayload, null, 2)}
            </pre>
          </details>

          {debugLog.prompt && (
            <details className="collapse collapse-arrow bg-base-100/80 rounded-lg">
              <summary className="collapse-title text-xs font-medium">Prompt sent to AI</summary>
              <pre className="collapse-content max-h-64 overflow-auto font-mono text-[10px] whitespace-pre-wrap break-all">
                {debugLog.prompt}
              </pre>
            </details>
          )}

          {debugLog.modelResponse && (
            <details className="collapse collapse-arrow bg-base-100/80 rounded-lg">
              <summary className="collapse-title text-xs font-medium">AI Response (full)</summary>
              <pre className="collapse-content max-h-64 overflow-auto font-mono text-[10px] whitespace-pre-wrap break-all">
                {debugLog.modelResponse}
              </pre>
            </details>
          )}

          <details className="collapse collapse-arrow bg-base-100/80 rounded-lg">
            <summary className="collapse-title text-xs font-medium">Full API Response</summary>
            <pre className="collapse-content max-h-64 overflow-auto font-mono text-[10px] whitespace-pre-wrap break-all">
              {JSON.stringify(debugLog.fullResponse, null, 2)}
            </pre>
          </details>
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
  const [questId, setQuestId] = useState("acdf9b82-2502-4201-a139-87fd08c1f92e");

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

  return (
    <div className="flex flex-col gap-6 md:flex-row md:items-start">
      <SetupStepsRail />
      <div className="min-w-0 flex-1 space-y-6">

        {/* ── Quest ID ── */}
        <div className="flex items-center gap-3 rounded-2xl border border-base-300 bg-base-100/90 p-4 shadow-sm">
          <span className="text-xs font-semibold uppercase tracking-wide text-base-content/70 shrink-0">Quest ID</span>
          <input
            type="text"
            className="input input-bordered input-sm flex-1 font-mono text-xs"
            value={questId}
            onChange={(e) => setQuestId(e.target.value)}
            placeholder="UUID of quest to test against"
          />
        </div>

        {/* ── Skill Book Tester ── */}
        <WeaponTester catalog={catalog} questId={questId} />

      </div>
    </div>
  );
}

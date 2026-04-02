"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { isRecruitReady, mergeDraftPatch } from "@/libs/proving_grounds/ui.js";

function DevWorkflowRail() {
  return (
    <aside className="md:sticky md:top-20 space-y-4 rounded-2xl border border-primary/25 bg-primary/5 p-4 text-sm md:w-80 md:shrink-0">
      <p className="text-xs font-semibold uppercase tracking-wide text-primary">Questmaster triage (cat)</p>
      <div className="space-y-3 text-xs leading-relaxed text-base-content/80">
        <p>
          The request was passed to the questmaster, the cat, who thought (the triaging process):
        </p>
        <p className="rounded-lg border border-base-300/60 bg-base-100/50 p-3 text-base-content/85">
          <span className="font-medium text-base-content">1.</span> I checked all my adventurers, no one has that
          capability (initial triaging query, checking NL against roster of agents), we must recruit a new adventurer who
          can do BigQuery. This is the most immediate goal, so I should add a note about next steps after the goal is
          accomplished.
        </p>
        <div className="space-y-2 border-l-2 border-primary/40 pl-3">
          <p className="font-medium text-base-content/90">Key concepts:</p>
          <p>
            First step in advancing the idea stage is to evalaute if we have the right adventurer for the job. If so,
            proceed to the planning stage, if not, proceed to the recruiting workflow by naming the quest as
            &quot;recruiting an adventurer for XXX&quot; and put the user instruction into the what to do next description
            of the quest.
          </p>
          <p>
            These &quot;next steps&quot; instructions should be recorded in the description of the quest at the end under
            the label &quot;next steps&quot; and in a number bullet format like 1. xxxx 2. xxxx.
          </p>
          <p>
            At the closing step of these quests, the next steps quest will be used to create new quests, which will use
            item 1 as main quest and inherit the next steps.
          </p>
          <p>
            These AI actions prompt template are defined in questmaster skill book actions.
          </p>
        </div>
      </div>
    </aside>
  );
}

function emptyDraft() {
  return {
    name: "",
    system_prompt: "",
    skill_books: [],
    backstory: "",
    capabilities: "",
  };
}

const DEFAULT_ADVENTURER_ID = "8cafbcf5-536f-4fc3-b240-480f2c3ce325";
const DEFAULT_QUEST_ID = "e8dfccc1-3adf-41fc-9ff3-a71ad78a05db";

const DEFAULT_SKILL_BOOK_ID = "testskillbook";
const DEFAULT_ACTION_NAME = "sendpigeonpost";
/** Pigeon letters without `url` run on the active browser tab when delivering from the Browserclaw popup (no navigation). */
const PLACEHOLDER_BROWSER_ACTIONS_JSON = `[{"action":"obtainText","selector":"h1","item":"h1text"}]`;
const DEFAULT_PAYLOAD_KV_ROWS = [
  {
    key: "browserActions",
    value: PLACEHOLDER_BROWSER_ACTIONS_JSON,
  },
];

/**
 * Turn a form string into booleans, finite decimals, or JSON (objects, arrays, string literals, null).
 */
function parseProvingGroundsPayloadValue(raw) {
  if (raw === null || raw === undefined) return raw;
  const t = String(raw).trim();
  if (t === "") return "";
  const tl = t.toLowerCase();
  if (tl === "true") return true;
  if (tl === "false") return false;
  if (t !== "" && Number.isFinite(Number(t)) && String(Number(t)) === t) return Number(t);
  const c0 = t[0];
  if (c0 === "{" || c0 === "[" || c0 === '"') {
    try {
      return JSON.parse(t);
    } catch {
      return raw;
    }
  }
  if (t === "null") {
    try {
      return JSON.parse(t);
    } catch {
      return null;
    }
  }
  return raw;
}

export default function ProvingGroundsClient() {
  const [catalog, setCatalog] = useState([]);
  const [adventurerIdInput, setAdventurerIdInput] = useState(DEFAULT_ADVENTURER_ID);
  const [loadedId, setLoadedId] = useState("");
  const [draft, setDraft] = useState(() => emptyDraft());
  const [loadingAdv, setLoadingAdv] = useState(false);
  const [saving, setSaving] = useState(false);
  const [skillBookId, setSkillBookId] = useState(DEFAULT_SKILL_BOOK_ID);
  const [actionName, setActionName] = useState(DEFAULT_ACTION_NAME);
  const [kvRows, setKvRows] = useState(() => DEFAULT_PAYLOAD_KV_ROWS.map((r) => ({ ...r })));
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [catalogError, setCatalogError] = useState(null);
  const [questIdInput, setQuestIdInput] = useState(DEFAULT_QUEST_ID);
  const [loadedQuestId, setLoadedQuestId] = useState("");
  const [questPreview, setQuestPreview] = useState(null);
  const [questDetail, setQuestDetail] = useState(null);
  const [loadingQuest, setLoadingQuest] = useState(false);
  const [advancingQuest, setAdvancingQuest] = useState(false);
  /** Last `advanceQuest` API JSON (logs, stage, errors) for PG debugging */
  const [advanceQuestResult, setAdvanceQuestResult] = useState(null);
  /** Quest-context quick test: action name + optional JSON payload (same POST as Run action; uses loaded quest as guildos.quest). */
  const [questTestActionName, setQuestTestActionName] = useState("");
  const [questTestInputJson, setQuestTestInputJson] = useState("");

  const skillBookSelectValue = useMemo(() => {
    if (!catalog.length) return "";
    return catalog.some((b) => b.id === skillBookId) ? skillBookId : catalog[0].id;
  }, [catalog, skillBookId]);

  const saveReady = useMemo(() => isRecruitReady(draft) && Boolean(loadedId), [draft, loadedId]);

  const updateDraft = useCallback((patch) => {
    setDraft((d) => mergeDraftPatch(d, patch));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/proving_grounds?action=listSkillBooks");
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(json.error || "Could not load skill books");
        }
        if (!cancelled) {
          const books = Array.isArray(json.books) ? json.books : [];
          setCatalog(books);
          setCatalogError(null);
          if (books.length) {
            setSkillBookId((prev) => {
              if (books.some((b) => b.id === prev)) return prev;
              const preferred = books.find((b) => b.id === DEFAULT_SKILL_BOOK_ID);
              return preferred?.id ?? books[0].id;
            });
          }
        }
      } catch (e) {
        if (!cancelled) {
          setCatalogError(e instanceof Error ? e.message : String(e));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadAdventurer = async () => {
    const id = adventurerIdInput.trim();
    if (!id) {
      toast.error("Enter an adventurer id");
      return;
    }
    setLoadingAdv(true);
    try {
      const res = await fetch(`/api/proving_grounds?action=getAdventurer&adventurerId=${encodeURIComponent(id)}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.error || "Load failed");
        return;
      }
      const nextDraft = json.draft && typeof json.draft === "object" ? json.draft : emptyDraft();
      setDraft(nextDraft);
      setLoadedId(json.id || id);
      toast.success("Adventurer loaded");
    } finally {
      setLoadingAdv(false);
    }
  };

  const loadQuest = async (idOverride) => {
    const id = (typeof idOverride === "string" && idOverride.trim() ? idOverride : questIdInput).trim();
    if (!id) {
      toast.error("Enter a quest id");
      return;
    }
    setLoadingQuest(true);
    try {
      const res = await fetch(`/api/proving_grounds?action=getQuest&questId=${encodeURIComponent(id)}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.error || "Quest load failed");
        setLoadedQuestId("");
        setQuestPreview(null);
        setQuestDetail(null);
        return;
      }
      const preview = json.preview && typeof json.preview === "object" ? json.preview : null;
      const qid = preview?.id != null ? String(preview.id) : id;
      setLoadedQuestId(qid);
      setQuestPreview(preview);
      setQuestDetail(json.quest && typeof json.quest === "object" ? json.quest : null);
      setQuestIdInput(qid);
      toast.success("Quest loaded — skill-book runs receive guildos.quest");
    } finally {
      setLoadingQuest(false);
    }
  };

  /** One shot of the same path as cron: `advanceAssignedQuest` (owner execution context + stage machine). */
  const advanceQuestOnce = async () => {
    const id = loadedQuestId || questIdInput.trim();
    if (!id) {
      toast.error("Load a quest first or enter a quest id");
      return;
    }
    setAdvancingQuest(true);
    try {
      const res = await fetch("/api/proving_grounds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "advanceQuest", questId: id }),
      });
      const json = await res.json().catch(() => ({}));
      setAdvanceQuestResult(json && typeof json === "object" ? json : { raw: json });
      if (!res.ok) {
        toast.error(json.error || "advanceQuest failed");
        return;
      }
      if (json.ok === false) {
        toast.error(
          (Array.isArray(json.logs) && json.logs.find((e) => e?.level === "error")?.msg) ||
            "Advance finished with errors — see logs in response",
        );
      } else {
        toast.success("Advance step ran");
      }
      await loadQuest(id);
    } finally {
      setAdvancingQuest(false);
    }
  };

  const saveAdventurer = async () => {
    if (!loadedId || !saveReady) return;
    setSaving(true);
    try {
      const res = await fetch("/api/proving_grounds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "updateAdventurer", adventurerId: loadedId, draft }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.error || "Save failed");
        return;
      }
      toast.success("Saved");
    } finally {
      setSaving(false);
    }
  };

  const toggleSkillBook = (id) => {
    const cur = new Set(draft.skill_books || []);
    if (cur.has(id)) cur.delete(id);
    else cur.add(id);
    updateDraft({ skill_books: [...cur] });
  };

  const addKvRow = () => setKvRows((rows) => [...rows, { key: "", value: "" }]);
  const updateKvRow = (i, field, val) => {
    setKvRows((rows) => rows.map((r, j) => (j === i ? { ...r, [field]: val } : r)));
  };
  const removeKvRow = (i) => setKvRows((rows) => rows.filter((_, j) => j !== i));

  const postRunAction = async ({ actionName: act, payload, toastLabel = "Action finished" }) => {
    const res = await fetch("/api/proving_grounds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "runAction",
        adventurerId: loadedId,
        skillBookId: skillBookSelectValue || skillBookId,
        actionName: act,
        draft,
        payload,
        ...(loadedQuestId ? { questId: loadedQuestId } : {}),
      }),
    });
    const json = await res.json().catch(() => ({}));
    setResult(json);
    if (!json.ok) {
      toast.error(json.msg || json.error || "Action failed");
    } else {
      toast.success(toastLabel);
    }
  };

  const runAction = async () => {
    if (!loadedId) {
      toast.error("Load an adventurer first");
      return;
    }
    const payload = {};
    for (const row of kvRows) {
      const k = row.key.trim();
      if (!k) continue;
      payload[k] = parseProvingGroundsPayloadValue(row.value);
    }
    setRunning(true);
    setResult(null);
    try {
      await postRunAction({ actionName, payload });
    } finally {
      setRunning(false);
    }
  };

  /** Single action + optional JSON object; uses skill book from "Skill book + action" and current quest context if loaded. */
  const testAdventurerActionFromQuest = async () => {
    if (!loadedId) {
      toast.error("Load an adventurer first");
      return;
    }
    const act = questTestActionName.trim();
    if (!act) {
      toast.error("Enter an action name");
      return;
    }
    const raw = questTestInputJson.trim();
    let payload = {};
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
          throw new Error("not_object");
        }
        payload = parsed;
      } catch {
        toast.error("Optional input must be a JSON object (e.g. {\"key\": \"value\"}).");
        return;
      }
    }
    if (!catalog.length) {
      toast.error("Skill book catalog not loaded");
      return;
    }
    setRunning(true);
    setResult(null);
    try {
      await postRunAction({
        actionName: act,
        payload,
        toastLabel: "Adventurer action finished",
      });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 md:flex-row md:items-start">
      <DevWorkflowRail />
      <div className="min-w-0 flex-1 space-y-8" id="proving-grounds-action-test">
        <section className="rounded-2xl border border-base-300 bg-base-100/90 p-5 shadow-sm backdrop-blur">
          <h2 className="text-lg font-bold text-base-content">Adventurer profile</h2>
          <p className="mt-1 text-xs text-base-content/60">
            Paste a roster id from Upstairs, load, edit, and save. Prompts and capability prose stay with the row; actions
            resolve through skill books.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <input
              type="text"
              className="input input-bordered input-sm w-full max-w-md font-mono text-xs"
              placeholder="Adventurer UUID"
              value={adventurerIdInput}
              onChange={(e) => setAdventurerIdInput(e.target.value)}
            />
            <button type="button" className="btn btn-primary btn-sm" disabled={loadingAdv} onClick={loadAdventurer}>
              {loadingAdv ? "Loading…" : "Load"}
            </button>
            <button type="button" className="btn btn-outline btn-sm" disabled={!saveReady || saving} onClick={saveAdventurer}>
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
          {loadedId ? <p className="mt-2 font-mono text-[10px] text-base-content/50">Loaded: {loadedId}</p> : null}

          <div className="mt-6 space-y-4 border-t border-base-300/80 pt-6">
            <label className="form-control w-full">
              <span className="label-text text-xs font-mono">name</span>
              <input
                type="text"
                className="input input-bordered input-sm mt-1 w-full"
                value={String(draft.name ?? "")}
                onChange={(e) => updateDraft({ name: e.target.value })}
              />
            </label>
            <label className="form-control w-full">
              <span className="label-text text-xs font-mono">system_prompt</span>
              <textarea
                className="textarea textarea-bordered mt-1 min-h-[120px] w-full text-sm"
                value={String(draft.system_prompt ?? "")}
                onChange={(e) => updateDraft({ system_prompt: e.target.value })}
              />
            </label>
            <div className="form-control w-full">
              <span className="label-text text-xs font-mono">skill_books</span>
              <div className="mt-2 flex flex-wrap gap-2">
                {catalog.length === 0 ? (
                  <span className="text-xs text-base-content/50">{catalogError || "Loading catalog…"}</span>
                ) : (
                  catalog.map((b) => (
                    <label key={b.id} className="label cursor-pointer gap-2">
                      <input
                        type="checkbox"
                        className="checkbox checkbox-sm"
                        checked={(draft.skill_books || []).includes(b.id)}
                        onChange={() => toggleSkillBook(b.id)}
                      />
                      <span className="label-text font-mono text-xs">{b.id}</span>
                    </label>
                  ))
                )}
              </div>
            </div>
            <label className="form-control w-full">
              <span className="label-text text-xs font-mono">capabilities</span>
              <textarea
                className="textarea textarea-bordered mt-1 min-h-[96px] w-full text-sm"
                value={String(draft.capabilities ?? "")}
                onChange={(e) => updateDraft({ capabilities: e.target.value })}
              />
            </label>
            <label className="form-control w-full">
              <span className="label-text text-xs font-mono">backstory</span>
              <textarea
                className="textarea textarea-bordered mt-1 min-h-[72px] w-full text-sm"
                value={String(draft.backstory ?? "")}
                onChange={(e) => updateDraft({ backstory: e.target.value })}
              />
            </label>
          </div>
        </section>

        <section className="rounded-2xl border border-base-300 bg-base-100/90 p-5 shadow-sm backdrop-blur">
          <h2 className="text-lg font-bold text-base-content">Quest context (optional)</h2>
          <p className="mt-1 text-xs text-base-content/60">
            Load a quest you own so proving-ground actions get the same{" "}
            <span className="font-mono text-xs">guildos.quest</span> shape as{" "}
            <span className="font-mono text-xs">Adventurer.executePlan</span> (normalized inventory, execution plan, stage).
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <input
              type="text"
              className="input input-bordered input-sm w-full max-w-md font-mono text-xs"
              placeholder="Quest UUID"
              value={questIdInput}
              onChange={(e) => setQuestIdInput(e.target.value)}
            />
            <button type="button" className="btn btn-primary btn-sm" disabled={loadingQuest} onClick={() => loadQuest()}>
              {loadingQuest ? "Loading…" : "Load quest"}
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={
                advancingQuest || loadingQuest || (!loadedQuestId && !questIdInput.trim())
              }
              onClick={advanceQuestOnce}
              title="Same as cron: advanceAssignedQuest with quest.owner_id execution context"
            >
              {advancingQuest ? "Advancing…" : "Advance quest (cron step)"}
            </button>
          </div>
          <div className="mt-4 rounded-xl border border-base-300/70 bg-base-200/20 p-3">
            <p className="text-xs font-medium text-base-content/80">Test adventurer action</p>
            <p className="mt-1 text-[11px] leading-snug text-base-content/55">
              Uses the <span className="font-mono">skill_book</span> from{" "}
              <span className="font-medium">Skill book + action</span> below (same POST as Run action). With a loaded quest,{" "}
              <span className="font-mono">guildos.quest</span> is set.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="form-control w-full sm:col-span-2 sm:max-w-md">
                <span className="label-text text-xs font-mono">Action</span>
                <input
                  type="text"
                  className="input input-bordered input-sm mt-1 w-full font-mono text-xs"
                  placeholder="e.g. sendpigeonpost"
                  value={questTestActionName}
                  onChange={(e) => setQuestTestActionName(e.target.value)}
                  disabled={running}
                />
              </label>
              <label className="form-control w-full sm:col-span-2">
                <span className="label-text text-xs font-mono">Input (optional JSON object)</span>
                <textarea
                  className="textarea textarea-bordered mt-1 min-h-[72px] w-full font-mono text-[11px]"
                  placeholder='{} or {"browserActions": [...] }'
                  value={questTestInputJson}
                  onChange={(e) => setQuestTestInputJson(e.target.value)}
                  disabled={running}
                />
              </label>
            </div>
            <button
              type="button"
              className="btn btn-outline btn-sm mt-3"
              disabled={
                running || !loadedId || !catalog.length || !questTestActionName.trim()
              }
              onClick={testAdventurerActionFromQuest}
            >
              {running ? (
                <span className="inline-flex items-center gap-2">
                  <span className="loading loading-spinner loading-xs" />
                  Running…
                </span>
              ) : (
                "Test adventurer action"
              )}
            </button>
          </div>
          <p className="mt-2 text-[11px] leading-snug text-base-content/55">
            <span className="font-semibold text-base-content/70">Advance quest</span> calls{" "}
            <span className="font-mono">advanceAssignedQuest</span> in{" "}
            <span className="font-mono">libs/proving_grounds</span> (not raw{" "}
            <span className="font-mono">serverQuest</span>). Queue pops like{" "}
            <span className="font-mono">popNextStep</span> run inside that stage machine.
          </p>
          {questPreview ? (
            <div className="mt-4 rounded-xl border border-base-300/80 bg-base-200/40 p-3 text-xs">
              <p className="font-mono text-[10px] text-base-content/50">{String(questPreview.id ?? loadedQuestId)}</p>
              <p className="mt-1 font-medium text-base-content">
                {questPreview.title ? String(questPreview.title) : "(no title)"}
              </p>
              <p className="mt-0.5 text-base-content/65">
                stage: <span className="font-mono">{questPreview.stage != null ? String(questPreview.stage) : "—"}</span>
              </p>
            </div>
          ) : (
            <p className="mt-3 text-xs text-base-content/55">No quest loaded — runs use guildos.quest = null.</p>
          )}
          {questDetail ? (
            <details className="mt-3">
              <summary className="cursor-pointer text-xs font-medium text-base-content/80">Normalized quest JSON (read-only)</summary>
              <pre className="mt-2 max-h-48 overflow-auto rounded-lg border border-base-300 bg-base-100 p-2 font-mono text-[10px] text-base-content/85">
                {JSON.stringify(questDetail, null, 2)}
              </pre>
            </details>
          ) : null}
          {advanceQuestResult ? (
            <details className="mt-3" open>
              <summary className="cursor-pointer text-xs font-medium text-base-content/80">
                Advance quest response (logs — triage prompt & conclusion appear under{" "}
                <span className="font-mono">logs[].detail</span>)
              </summary>
              <pre className="mt-2 max-h-[min(24rem,50vh)] overflow-auto rounded-lg border border-primary/25 bg-primary/5 p-2 font-mono text-[10px] text-base-content/85">
                {JSON.stringify(advanceQuestResult, null, 2)}
              </pre>
            </details>
          ) : null}
        </section>

        <section className="rounded-2xl border border-base-300 bg-base-100/90 p-5 shadow-sm backdrop-blur">
          <h2 className="text-lg font-bold text-base-content">Skill book + action</h2>
          <p className="mt-1 text-xs text-base-content/60">
            Weapon wiring stays inside book modules. Pick the catalog id plus the exported action name your book registers.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="form-control w-full">
              <span className="label-text text-xs font-mono">skill_book</span>
              {catalog.length === 0 ? (
                <p className="mt-2 text-xs text-base-content/55">No books loaded yet. Fix catalog fetch or refresh.</p>
              ) : (
                <select
                  className="select select-bordered select-sm mt-1 w-full font-mono text-xs"
                  value={skillBookSelectValue}
                  onChange={(e) => setSkillBookId(e.target.value)}
                >
                  {catalog.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.id}
                    </option>
                  ))}
                </select>
              )}
            </label>
            <label className="form-control w-full">
              <span className="label-text text-xs font-mono">action</span>
              <input
                type="text"
                className="input input-bordered input-sm mt-1 w-full font-mono text-xs"
                value={actionName}
                onChange={(e) => setActionName(e.target.value)}
              />
            </label>
          </div>

          <div className="mt-6 border-t border-base-300/80 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-base-content">Payload (key / value)</h3>
              <button type="button" className="btn btn-ghost btn-xs" onClick={addKvRow}>
                Add field
              </button>
            </div>
            <p className="mt-1 text-[11px] leading-snug text-base-content/55">
              Values are trimmed, then parsed as JSON when they start with <span className="font-mono">{"{"}</span>,{" "}
              <span className="font-mono">[</span>, or <span className="font-mono">{'"'}</span> (also{" "}
              <span className="font-mono">null</span>), or as booleans / plain numbers. For{" "}
              <span className="font-mono">browserActions</span>, omit <span className="font-mono">url</span> to run on
              the tab where Browserclaw delivers.
            </p>
            <div className="mt-3 space-y-2">
              {kvRows.map((row, i) => (
                <div key={`kv-${i}`} className="flex flex-wrap gap-2">
                  <input
                    className="input input-bordered input-sm w-36 font-mono"
                    placeholder="key"
                    value={row.key}
                    onChange={(e) => updateKvRow(i, "key", e.target.value)}
                  />
                  <input
                    className="input input-bordered input-sm min-w-[12rem] flex-1 font-mono"
                    placeholder={
                      row.key.trim() === "browserActions" ? PLACEHOLDER_BROWSER_ACTIONS_JSON : "value"
                    }
                    value={row.value}
                    onChange={(e) => updateKvRow(i, "value", e.target.value)}
                  />
                  <button type="button" className="btn btn-ghost btn-xs" onClick={() => removeKvRow(i)}>
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>

          <button
            type="button"
            className="btn btn-primary btn-sm mt-6"
            disabled={running || !loadedId || !catalog.length}
            onClick={runAction}
          >
            {running ? (
              <span className="inline-flex items-center gap-2">
                <span className="loading loading-spinner loading-xs" />
                Running…
              </span>
            ) : (
              "Run action"
            )}
          </button>
        </section>

        <section className="rounded-2xl border border-base-300 bg-base-200/30 p-5">
          <h2 className="text-lg font-bold text-base-content">Result</h2>
          {result == null ? (
            <p className="mt-2 text-sm text-base-content/55">Run an action to capture the server response envelope.</p>
          ) : (
            <pre className="mt-3 max-h-[28rem] overflow-auto rounded-xl border border-base-300 bg-base-100 p-3 font-mono text-[11px] text-base-content/85">
              {(() => {
                try {
                  return JSON.stringify(result, null, 2);
                } catch (e) {
                  return e instanceof Error ? e.message : String(e);
                }
              })()}
            </pre>
          )}
        </section>
      </div>
    </div>
  );
}


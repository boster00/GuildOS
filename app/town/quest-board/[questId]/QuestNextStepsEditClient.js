"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { NextStepsListDisplay } from "./questDetailDisplays.js";

const QUEST_PATCH_RELATIVE_URL = "/api/quest";

function PencilButton({ onPress, label }) {
  return (
    <button
      type="button"
      className="btn btn-ghost btn-xs btn-square shrink-0 text-base-content/60 hover:text-base-content"
      aria-label={label}
      onClick={onPress}
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
        <path d="M21.731 2.269a2.625 2.625 0 0 0-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 0 0 0-3.712ZM19.513 8.199l-3.712-3.712-12.15 12.15a5.25 5.25 0 0 0-1.32 2.214l-.8 2.685a.75.75 0 0 0 .933.933l2.685-.8a5.25 5.25 0 0 0 2.214-1.32L19.513 8.199Z" />
      </svg>
    </button>
  );
}

/**
 * @param {{ questId: string, initialNextSteps: unknown[] }} props
 */
export default function QuestNextStepsEditClient({ questId, initialNextSteps }) {
  const router = useRouter();
  const [nextSteps, setNextSteps] = useState(() => (Array.isArray(initialNextSteps) ? initialNextSteps : []));
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const begin = useCallback(() => {
    setDraft(JSON.stringify(nextSteps, null, 2));
    setEditing(true);
    setErr(null);
  }, [nextSteps]);

  const applyRow = useCallback((row) => {
    if (row?.next_steps !== undefined) {
      setNextSteps(Array.isArray(row.next_steps) ? row.next_steps : []);
    }
  }, []);

  const save = useCallback(async () => {
    let parsed;
    try {
      parsed = JSON.parse(draft || "[]");
    } catch {
      setErr("Invalid JSON.");
      return;
    }
    if (!Array.isArray(parsed)) {
      setErr("Next steps must be a JSON array.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(QUEST_PATCH_RELATIVE_URL, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ id: questId, nextSteps: parsed }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error || res.statusText || "Save failed");
      }
      if (json.data) applyRow(json.data);
      setEditing(false);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }, [applyRow, draft, questId, router]);

  return (
    <div className="mt-4">
      {err ? (
        <div className="alert alert-warning mb-2 text-sm" role="alert">
          {err}
        </div>
      ) : null}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-base-content/55">
          Next steps{nextSteps.length > 0 ? ` (${nextSteps.length})` : ""}
        </span>
        {!editing ? <PencilButton label="Edit next steps as JSON" onPress={begin} /> : null}
      </div>
      {editing ? (
        <div className="mt-2 flex flex-col gap-2">
          <textarea
            className="textarea textarea-bordered min-h-[10rem] w-full font-mono text-xs"
            spellCheck={false}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={busy}
          />
          <p className="text-xs text-base-content/50">JSON array. Save replaces the full next_steps queue.</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={save}>
              {busy ? "Saving…" : "Save"}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <NextStepsListDisplay steps={nextSteps} omitHeading />
      )}
    </div>
  );
}

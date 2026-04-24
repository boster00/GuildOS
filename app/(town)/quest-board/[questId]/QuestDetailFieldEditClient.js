"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { inventoryRawToMap, inventoryToDisplayRows } from "@/libs/quest/inventoryMap.js";
import { ItemsListDisplay } from "./questDetailDisplays.js";
import { ImageCarousel, extractImages } from "../../guildmaster-room/desk/DeskReviewClient";

const QUEST_PATCH_RELATIVE_URL = "/api/quest";

/** @param {string | null | undefined} iso */
function dueDateToLocalInput(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** @param {string} local */
function localInputToIsoOrNull(local) {
  if (local == null || !String(local).trim()) return null;
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function PencilButton({ pressed, onPress, label }) {
  return (
    <button
      type="button"
      className="btn btn-ghost btn-xs btn-square shrink-0 text-base-content/60 hover:text-base-content"
      aria-label={label}
      aria-pressed={pressed}
      onClick={onPress}
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
        <path d="M21.731 2.269a2.625 2.625 0 0 0-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 0 0 0-3.712ZM19.513 8.199l-3.712-3.712-12.15 12.15a5.25 5.25 0 0 0-1.32 2.214l-.8 2.685a.75.75 0 0 0 .933.933l2.685-.8a5.25 5.25 0 0 0 2.214-1.32L19.513 8.199Z" />
      </svg>
    </button>
  );
}

/**
 * @param {{ questId: string, initialTitle: string | null, initialDescription: string | null, initialInventory: unknown, initialAssignedTo?: string | null, initialAssigneeId?: string | null, initialDueDate?: string | null, assigneeOptions: { value: string, label: string }[], stageControls?: import("react").ReactNode }} props
 */
export default function QuestDetailFieldEditClient({
  questId,
  initialTitle,
  initialDescription,
  initialInventory,
  initialAssignedTo = null,
  initialAssigneeId = null,
  initialDueDate = null,
  // eslint-disable-next-line no-unused-vars
  assigneeOptions,
  stageControls = null,
}) {
  const router = useRouter();
  const patchUrl = QUEST_PATCH_RELATIVE_URL;

  const [title, setTitle] = useState(() => (typeof initialTitle === "string" ? initialTitle : ""));
  const [description, setDescription] = useState(() =>
    typeof initialDescription === "string" ? initialDescription : "",
  );
  const [assignedTo, setAssignedTo] = useState(() =>
    typeof initialAssignedTo === "string" ? initialAssignedTo : "",
  );
  const [assigneeId, setAssigneeId] = useState(() => initialAssigneeId ?? null);
  const [dueIso, setDueIso] = useState(() =>
    initialDueDate != null && initialDueDate !== "" ? String(initialDueDate) : null,
  );
  const [rawInv, setRawInv] = useState(() => initialInventory);
  const [invMap, setInvMap] = useState(() => inventoryRawToMap(initialInventory));

  const [editTitle, setEditTitle] = useState(false);
  const [editDesc, setEditDesc] = useState(false);
  const [editAssignee, setEditAssignee] = useState(false);
  const [editDue, setEditDue] = useState(false);
  const [editInv, setEditInv] = useState(false);
  const [viewScreenshotsOpen, setViewScreenshotsOpen] = useState(false);

  const [draftTitle, setDraftTitle] = useState("");
  const [draftDesc, setDraftDesc] = useState("");
  const [draftAssignee, setDraftAssignee] = useState("");
  const [draftDueLocal, setDraftDueLocal] = useState("");
  const [draftInv, setDraftInv] = useState("");
  const [showAdvPicker, setShowAdvPicker] = useState(true);
  const [advSearch, setAdvSearch] = useState("");
  const [advList, setAdvList] = useState(null);
  const [advLoading, setAdvLoading] = useState(false);


  // Load adventurers when picker opens
  useEffect(() => {
    if (!showAdvPicker || advList) return;
    setAdvLoading(true);
    (async () => {
      try {
        const r = await fetch("/api/adventurer?action=search");
        const j = await r.json().catch(() => ({}));
        setAdvList(Array.isArray(j.adventurers) ? j.adventurers : []);
      } catch {
        setAdvList([]);
      } finally { setAdvLoading(false); }
    })();
  }, [showAdvPicker, advList]);

  const filteredAdventurers = useMemo(() => {
    const list = advList || [];
    const q = advSearch.trim().toLowerCase();
    if (!q) return list;
    return list.filter((a) => (a.label || a.name || "").toLowerCase().includes(q));
  }, [advList, advSearch]);

  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState(null);

  const beginTitle = useCallback(() => {
    setDraftTitle(title);
    setEditTitle(true);
    setErr(null);
  }, [title]);

  const beginDesc = useCallback(() => {
    setDraftDesc(description);
    setEditDesc(true);
    setErr(null);
  }, [description]);

  const beginInv = useCallback(() => {
    setDraftInv(rawInv == null ? "" : typeof rawInv === "string" ? rawInv : JSON.stringify(rawInv, null, 2));
    setEditInv(true);
    setErr(null);
  }, [rawInv]);

  const beginAssignee = useCallback(() => {
    setDraftAssignee(assignedTo.trim());
    setEditAssignee(true);
    setErr(null);
  }, [assignedTo]);

  const beginDue = useCallback(() => {
    setDraftDueLocal(dueDateToLocalInput(dueIso));
    setEditDue(true);
    setErr(null);
  }, [dueIso]);

  const applyRow = useCallback((row) => {
    if (!row) return;
    if (row.title !== undefined) setTitle(row.title == null ? "" : String(row.title));
    if (row.description !== undefined) setDescription(row.description == null ? "" : String(row.description));
    if (row.assigned_to !== undefined) {
      setAssignedTo(row.assigned_to == null ? "" : String(row.assigned_to));
    }
    if (row.assignee_id !== undefined) {
      setAssigneeId(row.assignee_id);
    }
    if (row.due_date !== undefined) {
      setDueIso(row.due_date == null || row.due_date === "" ? null : String(row.due_date));
    }
    if (row.inventory !== undefined) {
      setRawInv(row.inventory);
      setInvMap(inventoryRawToMap(row.inventory));
    }
  }, []);

  const patchQuest = useCallback(
    async (body) => {
      setBusy("save");
      setErr(null);
      try {
        const res = await fetch(patchUrl, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ id: questId, ...body }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(json.error || res.statusText || "Save failed");
        }
        if (json.data) applyRow(json.data);
        router.refresh();
        return true;
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Save failed");
        return false;
      } finally {
        setBusy(null);
      }
    },
    [applyRow, patchUrl, questId, router],
  );

  const saveTitle = useCallback(async () => {
    const t = draftTitle.trim();
    const ok = await patchQuest({ title: t || "Untitled quest" });
    if (ok) setEditTitle(false);
  }, [draftTitle, patchQuest]);

  const saveDesc = useCallback(async () => {
    const ok = await patchQuest({ description: draftDesc });
    if (ok) setEditDesc(false);
  }, [draftDesc, patchQuest]);

  const saveAssignee = useCallback(async () => {
    const ok = await patchQuest({ assigneeName: draftAssignee.trim() });
    if (ok) setEditAssignee(false);
  }, [draftAssignee, patchQuest]);

  const saveDue = useCallback(async () => {
    const ok = await patchQuest({ dueDate: localInputToIsoOrNull(draftDueLocal) });
    if (ok) setEditDue(false);
  }, [draftDueLocal, patchQuest]);

  const saveInv = useCallback(async () => {
    let parsed;
    try {
      parsed = JSON.parse(draftInv || "null");
    } catch {
      setErr("Items: invalid JSON.");
      return;
    }
    const ok = await patchQuest({ inventory: parsed });
    if (ok) setEditInv(false);
  }, [draftInv, patchQuest]);

  const itemRows = inventoryToDisplayRows(invMap);
  const screenshots = useMemo(() => extractImages(invMap), [invMap]);
  const saving = busy === "save";

  return (
    <>
      {err ? (
        <div className="alert alert-warning mt-4 text-sm" role="alert">
          {err}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          {editTitle ? (
            <div className="flex flex-col gap-2">
              <input
                type="text"
                className="input input-bordered w-full text-2xl font-bold md:text-3xl"
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                disabled={saving}
              />
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn btn-primary btn-sm" disabled={saving} onClick={saveTitle}>
                  {saving ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={saving}
                  onClick={() => setEditTitle(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-1">
              <h1 className="min-w-0 flex-1 text-2xl font-bold leading-tight md:text-3xl">
                {title.trim() ? title : "Untitled quest"}
              </h1>
              <PencilButton label="Edit title" pressed={false} onPress={beginTitle} />
            </div>
          )}
          <p className="mt-1 font-mono text-xs text-base-content/50">{questId}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {stageControls}
          {screenshots.length > 0 ? (
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => setViewScreenshotsOpen(true)}
            >
              View screenshots ({screenshots.length})
            </button>
          ) : null}
        </div>
      </div>

      {viewScreenshotsOpen && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
              role="dialog"
              aria-modal="true"
              onClick={(e) => {
                if (e.target === e.currentTarget) setViewScreenshotsOpen(false);
              }}
            >
              <div className="flex h-[90vh] w-full max-w-5xl flex-col rounded-2xl border border-base-300 bg-base-100 p-4 shadow-2xl">
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-sm font-semibold">Screenshots ({screenshots.length})</h2>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm btn-circle"
                    onClick={() => setViewScreenshotsOpen(false)}
                    aria-label="Close screenshots"
                  >
                    ✕
                  </button>
                </div>
                <div className="min-h-0 flex-1">
                  <ImageCarousel images={screenshots} />
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      <div className="mt-6">
        <div className="flex items-start justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-base-content/55">Description</span>
          {!editDesc ? <PencilButton label="Edit description" pressed={false} onPress={beginDesc} /> : null}
        </div>
        {editDesc ? (
          <div className="mt-2 flex flex-col gap-2">
            <textarea
              className="textarea textarea-bordered min-h-[8rem] w-full text-sm leading-relaxed"
              value={draftDesc}
              onChange={(e) => setDraftDesc(e.target.value)}
              disabled={saving}
            />
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn btn-primary btn-sm" disabled={saving} onClick={saveDesc}>
                {saving ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={saving}
                onClick={() => setEditDesc(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : description ? (
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-base-content/85">{description}</p>
        ) : (
          <p className="mt-2 text-sm italic text-base-content/50">No description.</p>
        )}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-base-content/55">Assignee</span>
            {!editAssignee ? (
              <PencilButton label="Edit assignee" pressed={false} onPress={beginAssignee} />
            ) : null}
          </div>
          {editAssignee ? (
            <div className="mt-2 space-y-3">
              <div className="rounded-xl border border-primary/30 bg-base-200/50 p-3 space-y-2">
                <input
                  type="text"
                  className="input input-bordered input-sm w-full text-xs"
                  placeholder="Search adventurers by name…"
                  value={advSearch}
                  onChange={(e) => setAdvSearch(e.target.value)}
                />
                <div className="max-h-60 overflow-auto space-y-1">
                  {filteredAdventurers.length === 0 ? (
                    <p className="text-xs text-base-content/50 py-2 text-center">
                      {advLoading ? "Loading…" : "No adventurers found"}
                    </p>
                  ) : (
                    filteredAdventurers.map((a) => (
                      <button
                        key={a.value}
                        type="button"
                        className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs transition-colors ${draftAssignee === a.label ? "bg-primary/15 border border-primary/40" : "hover:bg-base-300/60"}`}
                        onClick={() => { setDraftAssignee(a.label); }}
                      >
                        <span className="font-medium">{a.label}</span>
                        <span className="font-mono text-[9px] text-base-content/40">{a.value}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn btn-primary btn-sm" disabled={saving} onClick={saveAssignee}>
                  {saving ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={saving}
                  onClick={() => { setEditAssignee(false); }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-2 flex items-center gap-2 text-sm text-base-content/85">
              {assignedTo.trim() ? (
                <>
                  <span>{assignedTo}</span>
                  {assigneeId ? (
                    <span className="ml-1 font-mono text-[10px] text-base-content/45">{String(assigneeId)}</span>
                  ) : null}
                </>
              ) : (
                <span className="text-base-content/50">—</span>
              )}
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-base-content/55">Due</span>
            {!editDue ? <PencilButton label="Edit due date" pressed={false} onPress={beginDue} /> : null}
          </div>
          {editDue ? (
            <div className="mt-2 flex flex-col gap-2">
              <input
                type="datetime-local"
                className="input input-bordered w-full max-w-md text-sm"
                value={draftDueLocal}
                onChange={(e) => setDraftDueLocal(e.target.value)}
                disabled={saving}
              />
              <p className="text-xs text-base-content/50">Leave empty and save to clear the due date.</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn btn-primary btn-sm" disabled={saving} onClick={saveDue}>
                  {saving ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={saving}
                  onClick={() => setEditDue(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <p className="mt-2 text-sm text-base-content/85">
              {dueIso ? new Date(dueIso).toLocaleString() : <span className="text-base-content/50">—</span>}
            </p>
          )}
        </div>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-base-content/55">Items (inventory)</span>
          {!editInv ? <PencilButton label="Edit items as JSON" pressed={false} onPress={beginInv} /> : null}
        </div>
        {editInv ? (
          <div className="mt-2 flex flex-col gap-2">
            <textarea
              className="textarea textarea-bordered min-h-[12rem] w-full font-mono text-xs"
              spellCheck={false}
              value={draftInv}
              onChange={(e) => setDraftInv(e.target.value)}
              disabled={saving}
            />
            <p className="text-xs text-base-content/50">Raw inventory JSON. Save replaces the full inventory column.</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn btn-primary btn-sm" disabled={saving} onClick={saveInv}>
                {saving ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={saving}
                onClick={() => setEditInv(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <ItemsListDisplay items={itemRows} />
        )}
      </div>
    </>
  );
}

"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";

export default function QuestActivityCommentsPanel({ questId, initialComments }) {
  const router = useRouter();
  const [comments, setComments] = useState(() =>
    Array.isArray(initialComments) ? initialComments : [],
  );
  const [pending, setPending] = useState(null);
  const [addBusy, setAddBusy] = useState(false);
  const [error, setError] = useState(null);
  const [draftSummary, setDraftSummary] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState("");
  const [editBusy, setEditBusy] = useState(false);

  const deleteOne = useCallback(
    async (commentId) => {
      setError(null);
      setPending(commentId);
      try {
        const res = await fetch("/api/quest/comments", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ questId, commentId }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || "Could not remove entry");
        }
        setComments((prev) => prev.filter((c) => c.id !== commentId));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not remove entry");
      } finally {
        setPending(null);
      }
    },
    [questId],
  );

  const clearAll = useCallback(async () => {
    if (comments.length === 0) return;
    if (
      !window.confirm(
        `Remove all ${comments.length} comment${comments.length === 1 ? "" : "s"}? This cannot be undone.`,
      )
    ) {
      return;
    }
    setError(null);
    setPending("clear");
    try {
      const res = await fetch("/api/quest/comments", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Could not clear comments");
      }
      setComments([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not clear comments");
    } finally {
      setPending(null);
    }
  }, [comments.length, questId]);

  const addComment = useCallback(async () => {
    const summary = draftSummary.trim();
    if (!summary) {
      setError("Enter a comment before posting.");
      return;
    }
    setError(null);
    setAddBusy(true);
    try {
      const res = await fetch("/api/quest/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questId, summary, source: "user", action: "note" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Could not add comment");
      }
      const row = data.comment;
      if (row && typeof row === "object" && row.id) {
        setComments((prev) => [row, ...prev]);
      }
      setDraftSummary("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add comment");
    } finally {
      setAddBusy(false);
    }
  }, [draftSummary, questId, router]);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditDraft("");
    setError(null);
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editingId) return;
    const summary = editDraft.trim();
    if (!summary) {
      setError("Comment text cannot be empty.");
      return;
    }
    setError(null);
    setEditBusy(true);
    try {
      const res = await fetch("/api/quest/comments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questId, commentId: editingId, summary }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Could not save comment");
      }
      const row = data.comment;
      if (row && typeof row === "object" && row.id) {
        setComments((prev) => prev.map((c) => (c.id === row.id ? row : c)));
      }
      cancelEdit();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save comment");
    } finally {
      setEditBusy(false);
    }
  }, [cancelEdit, editDraft, editingId, questId, router]);

  const count = comments.length;
  const interactionsLocked = pending !== null || addBusy || editBusy || editingId !== null;

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-base-content/55">
          Comments ({count})
        </h2>
        {count > 0 ? (
          <button
            type="button"
            className="btn btn-ghost btn-xs text-error hover:bg-error/10"
            onClick={clearAll}
            disabled={interactionsLocked}
          >
            {pending === "clear" ? (
              <span className="loading loading-spinner loading-xs" />
            ) : (
              "Clear all"
            )}
          </button>
        ) : null}
      </div>

      <div className="mt-3 rounded-xl border border-base-300 bg-base-200/20 p-3">
        <label className="label py-1">
          <span className="label-text text-xs font-medium text-base-content/70">New comment</span>
        </label>
        <textarea
          className="textarea textarea-bordered w-full min-h-[5rem] text-sm"
          placeholder="Write a note for this quest…"
          value={draftSummary}
          onChange={(e) => setDraftSummary(e.target.value)}
          disabled={interactionsLocked}
        />
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={addComment}
            disabled={interactionsLocked || !draftSummary.trim()}
          >
            {addBusy ? <span className="loading loading-spinner loading-sm" /> : "Post comment"}
          </button>
        </div>
      </div>

      {error ? (
        <p className="mt-2 text-sm text-error" role="alert">
          {error}
        </p>
      ) : null}
      {count === 0 ? (
        <p className="mt-2 text-sm text-base-content/50">No comments yet.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {comments.map((row) => (
            <li
              key={row.id}
              className="rounded-lg border border-base-300 bg-base-200/25 px-3 py-2 text-sm text-base-content/85"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="font-mono text-[10px] text-base-content/45">
                      {row.created_at ? new Date(row.created_at).toLocaleString() : "—"}
                    </span>
                    <span className="text-xs font-semibold text-primary">{row.source}</span>
                    <span className="font-mono text-xs text-base-content/60">{row.action}</span>
                  </div>
                  {editingId === row.id ? (
                    <div className="space-y-2 pt-1">
                      <textarea
                        className="textarea textarea-bordered w-full min-h-[4.5rem] text-sm"
                        value={editDraft}
                        onChange={(e) => setEditDraft(e.target.value)}
                        disabled={editBusy}
                      />
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="btn btn-primary btn-xs"
                          onClick={saveEdit}
                          disabled={editBusy || !editDraft.trim()}
                        >
                          {editBusy ? (
                            <span className="loading loading-spinner loading-xs" />
                          ) : (
                            "Save"
                          )}
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs"
                          onClick={cancelEdit}
                          disabled={editBusy}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm leading-snug">{row.summary}</p>
                  )}
                </div>
                <div className="flex shrink-0 items-start gap-0.5">
                  {editingId !== row.id ? (
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs text-base-content/50 hover:text-primary"
                      title="Edit this comment"
                      aria-label="Edit this comment"
                      onClick={() => {
                        setError(null);
                        setEditingId(row.id);
                        setEditDraft(row.summary ?? "");
                      }}
                      disabled={interactionsLocked}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        aria-hidden
                      >
                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                      </svg>
                    </button>
                  ) : null}
                <button
                  type="button"
                  className="btn btn-ghost btn-xs shrink-0 text-base-content/50 hover:text-error"
                  title="Remove this comment"
                  aria-label="Remove this comment"
                  onClick={() => deleteOne(row.id)}
                  disabled={interactionsLocked || editingId === row.id}
                >
                  {pending === row.id ? (
                    <span className="loading loading-spinner loading-xs" />
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path
                        fillRule="evenodd"
                        d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

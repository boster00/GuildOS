"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Extract image URLs from inventory items.
 * Detects: { url: "...png" }, Supabase storage URLs, etc.
 */
function extractImages(inventory) {
  if (!inventory || typeof inventory !== "object") return [];
  const images = [];
  const imgExtensions = /\.(png|jpg|jpeg|gif|webp|svg|bmp|avif)(\?.*)?$/i;
  const supabaseStorage = /storage\/v1\/object\/public\//i;

  for (const [key, value] of Object.entries(inventory)) {
    if (key === "pigeon_letters") continue;

    if (typeof value === "string" && (imgExtensions.test(value) || supabaseStorage.test(value))) {
      images.push({ key, url: value, description: key });
      continue;
    }

    if (value && typeof value === "object" && !Array.isArray(value)) {
      const url = value.url || value.src || value.image || value.screenshot;
      if (typeof url === "string" && (imgExtensions.test(url) || supabaseStorage.test(url))) {
        images.push({ key, url, description: value.description || value.caption || key });
      }
    }

    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        const item = value[i];
        if (typeof item === "string" && (imgExtensions.test(item) || supabaseStorage.test(item))) {
          images.push({ key: `${key}[${i}]`, url: item, description: `${key} #${i + 1}` });
        } else if (item && typeof item === "object") {
          const url = item.url || item.src || item.image;
          if (typeof url === "string" && imgExtensions.test(url)) {
            images.push({ key: `${key}[${i}]`, url, description: item.description || `${key} #${i + 1}` });
          }
        }
      }
    }
  }

  return images;
}

function ImageCarousel({ images }) {
  const [current, setCurrent] = useState(0);
  if (images.length === 0) {
    return (
      <div className="flex h-full min-h-[200px] items-center justify-center rounded-xl border border-dashed border-base-300 bg-base-200/30">
        <p className="text-sm text-base-content/50">No screenshots attached.</p>
      </div>
    );
  }

  const img = images[current];

  return (
    <div className="flex h-full flex-col">
      {/* Main image — scrollable on both axes, max-width 1200px */}
      <div className="relative flex-1 overflow-auto rounded-xl border border-base-300 bg-black/5" style={{ maxHeight: 500 }}>
        <img
          src={img.url}
          alt={img.description}
          className="block"
          style={{ maxWidth: 1200 }}
          loading="lazy"
        />
        {/* Prev / Next buttons */}
        {images.length > 1 && (
          <>
            <button
              type="button"
              className="btn btn-circle btn-sm sticky left-2 bottom-1/2 z-10 bg-base-100/90 shadow"
              style={{ position: "absolute", top: "50%", left: 8, transform: "translateY(-50%)" }}
              onClick={() => setCurrent((c) => (c - 1 + images.length) % images.length)}
              aria-label="Previous image"
            >
              &#8249;
            </button>
            <button
              type="button"
              className="btn btn-circle btn-sm sticky right-2 bottom-1/2 z-10 bg-base-100/90 shadow"
              style={{ position: "absolute", top: "50%", right: 8, transform: "translateY(-50%)" }}
              onClick={() => setCurrent((c) => (c + 1) % images.length)}
              aria-label="Next image"
            >
              &#8250;
            </button>
          </>
        )}
      </div>
      {/* Caption + counter */}
      <div className="mt-2 flex items-center justify-between px-1">
        <p className="truncate text-xs text-base-content/60">{img.description}</p>
        <span className="shrink-0 text-xs text-base-content/40">
          {current + 1} / {images.length}
        </span>
      </div>
      {/* Thumbnails — scrollable row */}
      {images.length > 1 && (
        <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
          {images.map((im, i) => (
            <button
              key={im.key}
              type="button"
              className={`h-12 w-16 shrink-0 overflow-hidden rounded border-2 transition-all ${
                i === current ? "border-primary" : "border-transparent opacity-60 hover:opacity-90"
              }`}
              onClick={() => setCurrent(i)}
              aria-label={`View ${im.description}`}
            >
              <img src={im.url} alt="" className="h-full w-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ReviewCard({ quest, comments, onUpdate }) {
  const router = useRouter();
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const images = extractImages(quest.inventory);

  const markDone = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/quest", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: quest.id, stage: "completed" }),
      });
      if (!res.ok) throw new Error("Failed to update stage");
      router.refresh();
      if (onUpdate) onUpdate();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }, [quest.id, router, onUpdate]);

  const sendFeedback = useCallback(async () => {
    const text = feedbackText.trim();
    if (!text) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/quest/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questId: quest.id, summary: text, source: "user", action: "feedback" }),
      });
      if (!res.ok) throw new Error("Failed to post feedback");
      setFeedbackText("");
      setFeedbackOpen(false);
      router.refresh();
      if (onUpdate) onUpdate();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }, [feedbackText, quest.id, router, onUpdate]);

  const sortedComments = [...(comments || [])].sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at),
  );

  return (
    <div className="w-full rounded-2xl border border-amber-900/15 bg-gradient-to-br from-base-200/80 to-base-200/40 shadow-sm dark:border-amber-100/10">
      {/* Header — full width */}
      <div className="flex items-start justify-between gap-3 border-b border-base-300/50 px-5 py-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold leading-snug">{quest.title || "Untitled"}</h2>
          {quest.assigned_to && (
            <p className="mt-0.5 text-xs text-base-content/50">Adventurer: {quest.assigned_to}</p>
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => setFeedbackOpen((o) => !o)}
            disabled={busy}
          >
            Feedback
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={markDone}
            disabled={busy}
          >
            {busy ? <span className="loading loading-spinner loading-sm" /> : "Mark done"}
          </button>
        </div>
      </div>

      {/* Content row: text left, images right */}
      <div className="flex flex-col lg:flex-row">
        {/* Left panel: description + comments */}
        <div className="space-y-4 overflow-y-auto border-b border-base-300/50 p-5 lg:w-1/3 lg:shrink-0 lg:border-b-0 lg:border-r" style={{ maxHeight: 600 }}>
          {quest.description && (
            <div>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-base-content/55">
                Description
              </h3>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-base-content/80">
                {quest.description}
              </p>
            </div>
          )}

          {feedbackOpen && (
            <div className="rounded-xl border border-base-300 bg-base-200/30 p-3">
              <textarea
                className="textarea textarea-bordered w-full min-h-[4rem] text-sm"
                placeholder="Write feedback or ask for changes..."
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                disabled={busy}
              />
              <div className="mt-2 flex gap-2">
                <button type="button" className="btn btn-primary btn-sm" onClick={sendFeedback} disabled={busy || !feedbackText.trim()}>Send</button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setFeedbackOpen(false)}>Cancel</button>
              </div>
            </div>
          )}

          {error && <p className="text-sm text-error">{error}</p>}

          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-base-content/55">
              Activity ({sortedComments.length})
            </h3>
            {sortedComments.length === 0 ? (
              <p className="text-sm text-base-content/50">No activity yet.</p>
            ) : (
              <ul className="space-y-2">
                {sortedComments.map((c) => (
                  <li key={c.id} className="rounded-lg border border-base-300/50 bg-base-200/20 px-3 py-2">
                    <div className="flex items-baseline gap-2 text-xs">
                      <span className="font-mono text-base-content/40">
                        {c.created_at ? new Date(c.created_at).toISOString().replace("T", " ").slice(0, 16) : ""}
                      </span>
                      <span className="font-semibold text-primary">{c.source}</span>
                      <span className="font-mono text-base-content/50">{c.action}</span>
                    </div>
                    <p className="mt-1 text-sm leading-snug text-base-content/80">{c.summary}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Right panel: image carousel — max 500px height, images max 1200px width, scrollable */}
        <div className="w-full flex-1 p-5" style={{ maxHeight: 600 }}>
          <ImageCarousel images={images} />
        </div>
      </div>
    </div>
  );
}

function EscalatedSection({ quests, onUpdate }) {
  const [triageResults, setTriageResults] = useState(null);
  const [busy, setBusy] = useState(false);

  const runTriage = useCallback(async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/quest?action=triage_escalated", { method: "POST" });
      const json = await res.json();
      if (json.ok) setTriageResults(json.results);
    } catch { /* ignore */ }
    setBusy(false);
  }, []);

  const resolveEscalation = useCallback(async (questId, resolution) => {
    setBusy(true);
    try {
      await fetch("/api/quest?action=resolve_escalation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questId, resolution }),
      });
      setTriageResults(null);
      if (onUpdate) onUpdate();
    } catch { /* ignore */ }
    setBusy(false);
  }, [onUpdate]);

  const triageMap = {};
  if (triageResults) {
    for (const r of triageResults) triageMap[r.questId] = r;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Escalated ({quests.length})</h2>
        <button
          type="button"
          className="btn btn-warning btn-sm"
          onClick={runTriage}
          disabled={busy}
        >
          {busy ? <span className="loading loading-spinner loading-sm" /> : "Triage All"}
        </button>
      </div>

      {quests.map((q) => {
        const triage = triageMap[q.id];
        return (
          <div key={q.id} className="rounded-2xl border border-warning/30 bg-warning/5 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold">{q.title || "Untitled"}</h3>
                {q.assigned_to && (
                  <p className="text-xs text-base-content/50">Adventurer: {q.assigned_to}</p>
                )}
              </div>
              {triage && (
                <span className={`badge badge-sm ${triage.classification === "autonomous" ? "badge-success" : "badge-warning"}`}>
                  {triage.classification === "autonomous" ? "Can resolve" : "Needs you"}
                </span>
              )}
            </div>
            {q.description && (
              <p className="mt-2 text-sm text-base-content/70 line-clamp-3">{q.description}</p>
            )}
            {triage && (
              <div className="mt-3 rounded-lg border border-base-300/50 bg-base-200/30 p-3 text-sm">
                <p className="text-base-content/60">{triage.reason}</p>
                {triage.latestComment && (
                  <p className="mt-1 text-base-content/80">Last comment: {triage.latestComment}</p>
                )}
                {triage.classification === "autonomous" && (
                  <button
                    type="button"
                    className="btn btn-success btn-sm mt-2"
                    onClick={() => resolveEscalation(q.id, "Resolved autonomously by Guildmaster")}
                    disabled={busy}
                  >
                    Resolve & Return to Execute
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function DeskReviewClient({ quests }) {
  const router = useRouter();

  if (!quests || quests.length === 0) return null;

  const reviewQuests = quests.filter((q) => q.stage === "review");
  const escalatedQuests = quests.filter((q) => q.stage === "escalated");

  return (
    <div className="mt-6 space-y-8">
      {escalatedQuests.length > 0 && (
        <EscalatedSection
          quests={escalatedQuests}
          onUpdate={() => router.refresh()}
        />
      )}

      {reviewQuests.length > 0 && (
        <>
          <p className="text-sm text-base-content/65">
            {reviewQuests.length} matter{reviewQuests.length === 1 ? "" : "s"} awaiting your review.
          </p>
          {reviewQuests.map((q) => (
            <ReviewCard
              key={q.id}
              quest={q}
              comments={q._comments || []}
              onUpdate={() => router.refresh()}
            />
          ))}
        </>
      )}
    </div>
  );
}

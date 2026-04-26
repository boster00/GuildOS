"use client";

/**
 * QuestItemsCarousel — single component used by both the quest detail page
 * and the Guildmaster desk review.
 *
 * Each items row renders as one slide showing:
 *   - expectation as the slide title (the declared spec, set at quest creation)
 *   - artifact (image inline; non-image artifacts show as a typed file link)
 *   - pending state if `url` is null (slide visible, artifact placeholder)
 *   - caption as the worker's one-liner under the artifact
 *   - role-coded comment thread (adventurer / questmaster / guildmaster / user)
 *
 * Pass `items` already hydrated with comments (use `searchItems` from libs/quest).
 * No internal data fetching — the parent owns that.
 */

import { useState } from "react";

const IMAGE_EXT = /\.(png|jpg|jpeg|gif|webp|svg|bmp|avif)(\?.*)?$/i;
const ROLE_STYLES = {
  adventurer: "bg-info/10 text-info",
  questmaster: "bg-warning/10 text-warning",
  guildmaster: "bg-accent/10 text-accent",
  user: "bg-success/10 text-success",
};

function isImage(url) {
  if (typeof url !== "string") return false;
  return IMAGE_EXT.test(url) || url.includes("/storage/v1/object/public/");
}

function fileExtension(url) {
  if (typeof url !== "string") return "";
  const m = url.match(/\.([a-z0-9]+)(?:\?|$)/i);
  return m ? m[1].toUpperCase() : "FILE";
}

export default function QuestItemsCarousel({ items }) {
  const [current, setCurrent] = useState(0);

  if (!Array.isArray(items) || items.length === 0) {
    return (
      <div className="flex min-h-[200px] items-center justify-center rounded-xl border border-dashed border-base-300 bg-base-200/30">
        <p className="text-sm text-base-content/50">No items declared on this quest.</p>
      </div>
    );
  }

  const item = items[current];
  const pending = !item.url;
  const itemImage = isImage(item.url);

  return (
    <div className="flex h-full flex-col gap-3">
      {/* Slide title — expectation */}
      <div className="flex items-start justify-between gap-3 px-1">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-base-content/55">
            {item.item_key}
            {pending && <span className="ml-2 rounded bg-warning/20 px-1.5 py-0.5 text-[10px] text-warning">pending</span>}
          </p>
          <h3 className="mt-0.5 text-sm font-medium text-base-content">{item.expectation || "(no expectation set)"}</h3>
        </div>
        <span className="shrink-0 text-xs text-base-content/40">
          {current + 1} / {items.length}
        </span>
      </div>

      {/* Artifact frame */}
      <div className="relative flex-1 overflow-hidden rounded-xl border border-base-300 bg-black/5" style={{ minHeight: 240 }}>
        {pending ? (
          <div className="flex h-full min-h-[240px] items-center justify-center text-sm text-base-content/40">
            Pending — no artifact uploaded yet
          </div>
        ) : itemImage ? (
          <a href={item.url} target="_blank" rel="noopener noreferrer" className="block">
            <img src={item.url} alt={item.expectation || item.item_key} className="block w-full h-auto" loading="lazy" />
          </a>
        ) : (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-full min-h-[240px] flex-col items-center justify-center gap-3 hover:bg-base-200/30"
          >
            <span className="rounded-lg border border-base-300 bg-base-100 px-3 py-1 text-xs font-mono uppercase">
              {fileExtension(item.url)}
            </span>
            <span className="text-xs text-base-content/60 underline">Open file</span>
          </a>
        )}
        {items.length > 1 && (
          <>
            <button
              type="button"
              className="btn btn-circle btn-sm absolute z-10 bg-base-100/90 shadow"
              style={{ top: "50%", left: 8, transform: "translateY(-50%)" }}
              onClick={() => setCurrent((c) => (c - 1 + items.length) % items.length)}
              aria-label="Previous item"
            >
              &#8249;
            </button>
            <button
              type="button"
              className="btn btn-circle btn-sm absolute z-10 bg-base-100/90 shadow"
              style={{ top: "50%", right: 8, transform: "translateY(-50%)" }}
              onClick={() => setCurrent((c) => (c + 1) % items.length)}
              aria-label="Next item"
            >
              &#8250;
            </button>
          </>
        )}
      </div>

      {/* Caption */}
      {item.caption && (
        <div className="px-1 text-xs italic text-base-content/70">
          <span className="font-medium not-italic text-base-content/50">caption:</span> {item.caption}
        </div>
      )}

      {/* Comments thread */}
      {Array.isArray(item.comments) && item.comments.length > 0 && (
        <div className="space-y-1.5 px-1">
          {item.comments.map((c) => (
            <div
              key={c.id || `${c.role}-${c.created_at || c.text?.slice(0, 20)}`}
              className={`rounded-md px-2 py-1 text-xs ${ROLE_STYLES[c.role] || "bg-base-200/60 text-base-content/70"}`}
            >
              <span className="font-semibold">{c.role}:</span>
              <span className="ml-1.5">{c.text}</span>
            </div>
          ))}
        </div>
      )}

      {/* Thumbnail strip */}
      {items.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {items.map((it, i) => {
            const isImg = !pending && isImage(it.url);
            return (
              <button
                key={it.id || it.item_key}
                type="button"
                className={`relative h-12 w-16 shrink-0 overflow-hidden rounded border-2 transition-all ${
                  i === current ? "border-primary" : "border-transparent opacity-60 hover:opacity-90"
                }`}
                onClick={() => setCurrent(i)}
                aria-label={`View ${it.item_key}`}
              >
                {!it.url ? (
                  <div className="flex h-full w-full items-center justify-center bg-base-200 text-[9px] text-base-content/50">pending</div>
                ) : isImg ? (
                  <img src={it.url} alt="" className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-base-200 font-mono text-[9px] uppercase text-base-content/60">
                    {fileExtension(it.url)}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

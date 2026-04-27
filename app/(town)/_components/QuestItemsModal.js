"use client";

/**
 * QuestItemsModal — full-screen modal showing one item per slide.
 *
 * Layout: image area on the left (max real estate), extendable info side panel
 * on the right with expectation, caption, and the role-coded comment thread.
 * Side-panel state (open/closed) persisted in a cookie so the user's preference
 * survives navigations and reloads.
 *
 * Caller owns open/close state via `open` + `onClose`.
 */

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

const IMAGE_EXT = /\.(png|jpg|jpeg|gif|webp|svg|bmp|avif)(\?.*)?$/i;
const COOKIE_KEY = "qim-side-panel";
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

function readSidePanelCookie() {
  if (typeof document === "undefined") return true; // SSR default: open
  const m = document.cookie.split("; ").find((c) => c.startsWith(`${COOKIE_KEY}=`));
  if (!m) return true; // first visit → open
  const v = decodeURIComponent(m.split("=")[1] || "");
  return v !== "closed";
}

function writeSidePanelCookie(open) {
  if (typeof document === "undefined") return;
  const v = open ? "open" : "closed";
  // 1 year, path /, lax — keep it scoped to this origin
  document.cookie = `${COOKIE_KEY}=${encodeURIComponent(v)}; max-age=${60 * 60 * 24 * 365}; path=/; SameSite=Lax`;
}

export default function QuestItemsModal({ items, open, onClose, title }) {
  const [current, setCurrent] = useState(0);
  const [sidePanelOpen, setSidePanelOpen] = useState(true);

  // Hydrate side-panel state from cookie on first client render.
  useEffect(() => {
    setSidePanelOpen(readSidePanelCookie());
  }, []);

  const togglePanel = () => {
    setSidePanelOpen((prev) => {
      const next = !prev;
      writeSidePanelCookie(next);
      return next;
    });
  };

  // Keyboard shortcuts when modal is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
      else if (e.key === "ArrowLeft") setCurrent((c) => (c - 1 + (items?.length || 1)) % (items?.length || 1));
      else if (e.key === "ArrowRight") setCurrent((c) => (c + 1) % (items?.length || 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, items?.length]);

  // Reset to slide 0 when opening with new items.
  useEffect(() => {
    if (open) setCurrent(0);
  }, [open, items]);

  const list = useMemo(() => (Array.isArray(items) ? items : []), [items]);
  if (!open || typeof document === "undefined") return null;

  const empty = list.length === 0;
  const item = empty ? null : list[Math.min(current, list.length - 1)];
  const pending = item && !item.url;
  const itemImage = item && isImage(item.url);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex bg-black/85"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      {/* Top bar */}
      <div className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between gap-3 bg-base-100/85 px-4 py-2 backdrop-blur">
        <div className="min-w-0 flex-1 truncate text-sm font-semibold">
          {title || "Quest items"}
          {!empty && <span className="ml-3 font-mono text-xs text-base-content/50">{current + 1} / {list.length}</span>}
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={togglePanel}
          aria-pressed={sidePanelOpen}
          aria-label={sidePanelOpen ? "Collapse info panel" : "Expand info panel"}
        >
          {sidePanelOpen ? "Hide info ›" : "‹ Show info"}
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm btn-circle"
          onClick={onClose}
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      {/* Left column: image area on top, thumbnail strip on bottom.
          Thumbnail strip lives inside this column (not as an absolute-positioned
          full-width strip) so the side panel, when open, sits cleanly next to
          it — the bottom of the side panel is naturally clear, no hidden
          comments. Right-arrow placement is anchored to the image sub-area, so
          it no longer needs a conditional offset for the side panel. */}
      <div className="flex flex-1 flex-col pt-12">
        <div className="relative flex flex-1 items-center justify-center">
          {empty ? (
            <p className="text-base-content/60">No items on this quest.</p>
          ) : pending ? (
            <div className="flex flex-col items-center gap-2 text-base-content/70">
              <span className="rounded-full border border-base-300 bg-base-100 px-3 py-1 text-xs">pending</span>
              <p className="text-sm">No artifact uploaded yet.</p>
            </div>
          ) : itemImage ? (
            <a href={item.url} target="_blank" rel="noopener noreferrer" className="block max-h-[88vh] max-w-full">
              <img src={item.url} alt={item.expectation || item.item_key} className="max-h-[88vh] max-w-full object-contain" />
            </a>
          ) : (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-3 rounded-xl border border-base-300 bg-base-100 px-8 py-6 hover:bg-base-200/60"
            >
              <span className="rounded border border-base-300 bg-base-200 px-3 py-1 font-mono text-xs uppercase">
                {fileExtension(item.url)}
              </span>
              <span className="text-sm underline">Open file in new tab</span>
            </a>
          )}

          {!empty && list.length > 1 && (
            <>
              <button
                type="button"
                className="btn btn-circle absolute left-4 top-1/2 -translate-y-1/2 bg-base-100/80 shadow"
                onClick={() => setCurrent((c) => (c - 1 + list.length) % list.length)}
                aria-label="Previous item"
              >
                ‹
              </button>
              <button
                type="button"
                className="btn btn-circle absolute right-4 top-1/2 -translate-y-1/2 bg-base-100/80 shadow"
                onClick={() => setCurrent((c) => (c + 1) % list.length)}
                aria-label="Next item"
              >
                ›
              </button>
            </>
          )}
        </div>

        {/* Thumbnail strip — under the image sub-area only, not full viewport width */}
        {!empty && list.length > 1 && (
          <div className="z-10 flex shrink-0 justify-center gap-1.5 overflow-x-auto bg-base-100/85 p-2 backdrop-blur">
            {list.map((it, i) => {
              const t = !it.url
                ? null
                : isImage(it.url)
                  ? "img"
                  : "file";
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
                  ) : t === "img" ? (
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

      {/* Side panel — info / comments. No bottom-padding hack needed: the
          thumbnail strip is now scoped to the left column, so the side panel
          extends cleanly to the bottom of the viewport. */}
      {sidePanelOpen && !empty && item && (
        <aside className="flex w-[20rem] shrink-0 flex-col gap-4 overflow-y-auto border-l border-base-300/40 bg-base-100/95 p-4 pt-14 backdrop-blur">
          <div>
            <p className="font-mono text-xs uppercase tracking-wide text-base-content/55">{item.item_key}</p>
            <h3 className="mt-1 text-sm font-semibold leading-snug">Expectation</h3>
            <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-base-content/85">
              {item.expectation || "(no expectation set)"}
            </p>
          </div>

          {item.caption && (
            <div>
              <h3 className="text-sm font-semibold leading-snug">Caption</h3>
              <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-base-content/85">{item.caption}</p>
            </div>
          )}

          {/* Reviews — 5 tier slots, each owned by exactly one tier per items.<col>.
              Tiers are locked in code: only their owning weapon/skill book may
              write to the column. NULL = tier hasn't reviewed yet. */}
          <div className="flex flex-col gap-1.5">
            <h3 className="text-sm font-semibold leading-snug">Reviews</h3>
            {[
              { key: "self_check",     label: "Worker (self-check)",       icon: "🧑‍💻", style: "bg-info/10 text-info" },
              { key: "openai_check",   label: "OpenAI judge",              icon: "🤖", style: "bg-base-200 text-base-content/80" },
              { key: "purrview_check", label: "Cat (purrview)",            icon: "🐱", style: "bg-warning/10 text-warning" },
              { key: "claude_check",   label: "Guildmaster (Claude read)", icon: "🛡️", style: "bg-accent/10 text-accent" },
              { key: "user_feedback",  label: "User feedback",             icon: "👤", style: "bg-success/10 text-success" },
            ].map((row) => {
              const value = item[row.key];
              const empty = value == null || value === "";
              return (
                <div
                  key={row.key}
                  className={`rounded-md px-2 py-1 text-xs leading-relaxed ${empty ? "bg-base-200/40 text-base-content/40" : row.style}`}
                >
                  <span className="font-semibold">
                    {row.icon} {row.label}
                  </span>
                  <span className="ml-1.5 whitespace-pre-wrap">
                    {empty ? "(pending)" : value}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Legacy item_comments thread is no longer rendered here — its
              content is absorbed into the 5-tier Reviews panel above. The
              `item_comments` table remains as a quiet append-only audit log
              while weapons are rewritten to write the tier columns directly;
              once the migration is complete the table can be retired. */}

          {pending && <p className="text-xs italic text-warning">No artifact uploaded yet.</p>}
        </aside>
      )}

    </div>,
    document.body,
  );
}

"use client";

/**
 * Shared quest-items carousel surface, renderable in two modes:
 *
 *   <QuestItemsModal items={...} open={...} onClose={...} title="..." />
 *     — full-screen modal mounted via React portal. Used by the quest-detail
 *     page on the GM Desk via a "View items" button.
 *
 *   <QuestItemsContent items={...} title="..." />
 *     — inline-renderable layout. Used by the GM Room desk card so the same
 *     carousel + 5-tier Reviews panel surfaces inside a card alongside the
 *     description + activity. Single source of truth for the layout.
 *
 * Both modes share the inner layout (image area + thumbnail strip + side
 * panel with Expectation / Caption / 5-tier Reviews). Side-panel open state
 * persists via the `qim-side-panel` cookie.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

const IMAGE_EXT = /\.(png|jpg|jpeg|gif|webp|svg|bmp|avif)(\?.*)?$/i;
const COOKIE_KEY = "qim-side-panel";

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
  if (typeof document === "undefined") return true;
  const m = document.cookie.split("; ").find((c) => c.startsWith(`${COOKIE_KEY}=`));
  if (!m) return true;
  const v = decodeURIComponent(m.split("=")[1] || "");
  return v !== "closed";
}

function writeSidePanelCookie(open) {
  if (typeof document === "undefined") return;
  const v = open ? "open" : "closed";
  document.cookie = `${COOKIE_KEY}=${encodeURIComponent(v)}; max-age=${60 * 60 * 24 * 365}; path=/; SameSite=Lax`;
}

/**
 * Inline-renderable items carousel + side panel. Caller controls outer
 * sizing (flex / grid). On mobile/tablet the side panel can be toggled off
 * via the chrome's "Hide info" button when rendered as a modal.
 *
 * Props:
 *   items   — array of { id, item_key, expectation, url, caption,
 *                        self_check, openai_check, purrview_check,
 *                        claude_check, user_feedback }
 *   title   — string shown in the top bar (modal mode only)
 *   onClose — optional close handler. Renders the ✕ button when provided.
 *   showChrome — when false, hides the top bar entirely (use for inline mode
 *                where the parent card already has its own header).
 */
export function QuestItemsContent({ items, title, onClose, showChrome = true }) {
  const [current, setCurrent] = useState(0);
  const [sidePanelOpen, setSidePanelOpen] = useState(true);
  const [enlarged, setEnlarged] = useState(false);
  // Ref to the image's scrollable wrapper — used for ArrowUp/ArrowDown scrolling
  // in enlarged mode and for resetting scroll position on item change.
  const scrollRef = useRef(null);

  useEffect(() => { setSidePanelOpen(readSidePanelCookie()); }, []);
  // Enlarged state persists across items (so navigating with arrows / next-prev
  // keeps zoom). Reset scroll position to top on each item change so the new
  // image starts from the beginning rather than mid-scroll.
  useEffect(() => { scrollRef.current?.scrollTo({ top: 0 }); }, [current]);

  const togglePanel = () => {
    setSidePanelOpen((prev) => {
      const next = !prev;
      writeSidePanelCookie(next);
      return next;
    });
  };

  // Keyboard navigation when chrome is shown (= modal mode).
  useEffect(() => {
    if (!showChrome) return;
    const len = items?.length || 1;
    const onKey = (e) => {
      // Don't hijack arrows when the user is typing in an input/textarea/contenteditable.
      const tgt = e.target;
      const editing =
        tgt && (tgt.tagName === "INPUT" || tgt.tagName === "TEXTAREA" || tgt.isContentEditable);
      if (e.key === "Escape") {
        onClose?.();
      } else if (e.key === "ArrowLeft" && !editing) {
        e.preventDefault();
        setCurrent((c) => (c - 1 + len) % len);
      } else if (e.key === "ArrowRight" && !editing) {
        e.preventDefault();
        setCurrent((c) => (c + 1) % len);
      } else if ((e.key === "ArrowUp" || e.key === "ArrowDown") && !editing) {
        // Scroll the screenshot vertically when it overflows (enlarged tall images).
        // Use "auto" not "smooth" — smooth is silently ignored under
        // prefers-reduced-motion, which leaves the keypress feeling broken.
        const el = scrollRef.current;
        if (el && el.scrollHeight > el.clientHeight) {
          e.preventDefault();
          const step = Math.max(120, Math.round(el.clientHeight * 0.4));
          el.scrollBy({ top: e.key === "ArrowUp" ? -step : step, behavior: "auto" });
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showChrome, onClose, items?.length]);

  const list = useMemo(() => (Array.isArray(items) ? items : []), [items]);
  const empty = list.length === 0;
  const item = empty ? null : list[Math.min(current, list.length - 1)];
  const pending = item && !item.url;
  const itemImage = item && isImage(item.url);

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Top chrome — title + side-panel toggle + close. Only rendered in
          modal mode; inline mode lets the parent card own the header. */}
      {showChrome && (
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
          {onClose && (
            <button
              type="button"
              className="btn btn-ghost btn-sm btn-circle"
              onClick={onClose}
              aria-label="Close"
            >
              ✕
            </button>
          )}
        </div>
      )}

      {/* Left column: image area + thumbnail strip. */}
      <div className={`flex flex-1 flex-col ${showChrome ? "pt-12" : ""}`}>
        {/* Outer container is the STABLE anchor for prev/next buttons. The inner
            wrapper is absolute-inset-0 so its height is bounded by the outer
            (which is bounded by the column flex layout). That keeps the buttons'
            top:50% anchored to the visible viewport center, not to the scroll
            content's full height. */}
        <div className="relative flex-1">
          <div
            ref={scrollRef}
            className={`absolute inset-0 flex ${
              enlarged && itemImage
                ? "items-start justify-center overflow-y-auto"
                : "items-center justify-center"
            }`}
          >
            {empty ? (
              <p className="text-base-content/60">No items on this quest.</p>
            ) : pending ? (
              <div className="flex flex-col items-center gap-2 text-base-content/70">
                <span className="rounded-full border border-base-300 bg-base-100 px-3 py-1 text-xs">pending</span>
                <p className="text-sm">No artifact uploaded yet.</p>
              </div>
            ) : itemImage ? (
              <img
                src={item.url}
                alt={item.expectation || item.item_key}
                onClick={() => setEnlarged((v) => !v)}
                title={enlarged ? "Click to shrink" : "Click to enlarge"}
                className={
                  enlarged
                    ? "h-auto max-w-full cursor-zoom-out"
                    : "max-h-[88vh] max-w-full cursor-zoom-in object-contain"
                }
              />
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
          </div>

          {!empty && list.length > 1 && (
            <>
              <button
                type="button"
                className="btn btn-circle absolute left-4 top-1/2 z-20 -translate-y-1/2 bg-base-100/80 shadow"
                onClick={(e) => { e.stopPropagation(); setCurrent((c) => (c - 1 + list.length) % list.length); }}
                aria-label="Previous item"
              >
                ‹
              </button>
              <button
                type="button"
                className="btn btn-circle absolute right-4 top-1/2 z-20 -translate-y-1/2 bg-base-100/80 shadow"
                onClick={(e) => { e.stopPropagation(); setCurrent((c) => (c + 1) % list.length); }}
                aria-label="Next item"
              >
                ›
              </button>
            </>
          )}
        </div>

        {!empty && list.length > 1 && (
          <div className="z-10 flex shrink-0 justify-center gap-1.5 overflow-x-auto bg-base-100/85 p-2 backdrop-blur">
            {list.map((it, i) => {
              const t = !it.url ? null : isImage(it.url) ? "img" : "file";
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

      {/* Side panel — info / 5-tier Reviews. */}
      {sidePanelOpen && !empty && item && (
        <aside className={`flex w-[22rem] shrink-0 flex-col gap-4 overflow-y-auto border-l border-base-300/40 bg-base-100/95 p-4 backdrop-blur ${showChrome ? "pt-14" : ""}`}>
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

          {pending && <p className="text-xs italic text-warning">No artifact uploaded yet.</p>}
        </aside>
      )}
    </div>
  );
}

/**
 * Modal wrapper — fixed-portal full-screen, click-to-close on the backdrop.
 * Caller owns open/close state via `open` + `onClose`.
 */
export default function QuestItemsModal({ items, open, onClose, title }) {
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex bg-black/85"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <QuestItemsContent items={items} title={title} onClose={onClose} showChrome={true} />
    </div>,
    document.body,
  );
}

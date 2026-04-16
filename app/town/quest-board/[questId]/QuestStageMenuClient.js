"use client";

import { useState, useEffect, useRef } from "react";
const QUEST_STAGES = ["execute", "escalated", "review", "closing", "complete"];
const QUEST_PATCH_RELATIVE_URL = "/api/quest";

export default function QuestStageMenuClient({ questId, initialStage }) {
  const [stage, setStage] = useState(initialStage);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const maybeOpen = () => {
      try {
        if (new URLSearchParams(window.location.search).get("openStage") === "1") setOpen(true);
      } catch {
        /* ignore */
      }
    };
    maybeOpen();
    window.addEventListener("popstate", maybeOpen);
    return () => window.removeEventListener("popstate", maybeOpen);
  }, []);

  const pickStage = async (next) => {
    if (next === stage || busy) return;
    const prev = stage;
    setStage(next);
    setOpen(false);
    setBusy(true);
    try {
      const res = await fetch(QUEST_PATCH_RELATIVE_URL, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ id: questId, stage: next }),
      });
      if (!res.ok) setStage(prev);
      else { setSaved(true); setTimeout(() => setSaved(false), 2000); }
    } catch { setStage(prev); }
    setBusy(false);
  };

  return (
    <div ref={ref} className="relative flex flex-wrap items-center gap-2">
      <button
        type="button"
        className="badge badge-primary cursor-pointer select-none"
        onClick={() => setOpen((o) => !o)}
      >
        {busy ? "Saving…" : stage}
        <span className="ml-1 text-[0.65em] opacity-70" aria-hidden>▾</span>
      </button>
      {open && (
        <div className="absolute end-0 top-full z-50 mt-2 min-w-[12rem] rounded-box border border-base-300 bg-base-100 p-2 shadow-lg">
          <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-base-content/50">Set stage</p>
          <ul className="menu menu-compact w-full p-0">
            {QUEST_STAGES.map((s) => (
              <li key={s}>
                <button
                  type="button"
                  className="w-full justify-start text-left font-normal"
                  disabled={s === stage}
                  onClick={() => pickStage(s)}
                >
                  {s}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {saved && (
        <span className="inline-flex items-center gap-1 text-sm font-medium text-success" aria-live="polite">
          <span aria-hidden>✓</span> Saved
        </span>
      )}
    </div>
  );
}

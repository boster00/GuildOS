"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";

export default function QuestAdvanceButtons({ questId, currentStage }) {
  const router = useRouter();
  const [busy, setBusy] = useState(null); // "step" | "run" | null
  const [log, setLog] = useState(null);

  const advanceOnce = useCallback(async () => {
    setBusy("step");
    setLog(null);
    try {
      const res = await fetch("/api/proving_grounds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "advanceQuest", questId }),
      });
      const data = await res.json().catch(() => ({}));
      setLog(data);
      router.refresh();
    } catch (err) {
      setLog({ ok: false, error: err.message });
    } finally {
      setBusy(null);
    }
  }, [questId, router]);

  const runToReview = useCallback(async () => {
    setBusy("run");
    setLog(null);
    const logs = [];
    for (let i = 0; i < 10; i++) {
      try {
        const res = await fetch("/api/proving_grounds", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "advanceQuest", questId }),
        });
        const data = await res.json().catch(() => ({}));
        logs.push(data);
        const stage = data.stage || "";
        if (["review", "closing", "completed"].includes(stage)) {
          setLog({ ok: true, summary: `Reached ${stage} after ${i + 1} step(s)`, steps: logs });
          router.refresh();
          setBusy(null);
          return;
        }
        if (!data.ok || !data.advanced) {
          setLog({ ok: false, summary: `Stopped at step ${i + 1}: ${data.error || data.note || "no progress"}`, steps: logs });
          router.refresh();
          setBusy(null);
          return;
        }
      } catch (err) {
        logs.push({ ok: false, error: err.message });
        setLog({ ok: false, summary: `Error at step ${i + 1}`, steps: logs });
        router.refresh();
        setBusy(null);
        return;
      }
    }
    setLog({ ok: false, summary: "Reached 10 step limit without completing", steps: logs });
    router.refresh();
    setBusy(null);
  }, [questId, router]);

  const isTerminal = currentStage === "completed";

  return (
    <>
      <button
        type="button"
        className="btn btn-sm btn-outline btn-accent"
        disabled={!!busy || isTerminal}
        onClick={advanceOnce}
        title="Run one doNextAction step"
      >
        {busy === "step" ? <><span className="loading loading-spinner loading-xs" /> Step…</> : "▶ Step"}
      </button>
      <button
        type="button"
        className="btn btn-sm btn-outline btn-secondary"
        disabled={!!busy || isTerminal}
        onClick={runToReview}
        title="Loop doNextAction until review/closing (max 10)"
      >
        {busy === "run" ? <><span className="loading loading-spinner loading-xs" /> Running…</> : "▶▶ Run"}
      </button>
      {log && (
        <div className={`mt-2 w-full rounded-lg border p-2 text-[10px] font-mono ${log.ok === false ? "border-error/30 bg-error/5 text-error" : "border-success/30 bg-success/5 text-success"}`}>
          <pre className="max-h-32 overflow-auto whitespace-pre-wrap break-all">
            {log.summary || JSON.stringify(log, null, 2)}
          </pre>
        </div>
      )}
    </>
  );
}

"use client";

import { useState } from "react";

// ─── Badge ────────────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  if (!status || status === "idle")
    return <span className="text-gray-400 text-sm">— idle</span>;
  const map = {
    PASS: "bg-green-100 text-green-800",
    FAIL: "bg-red-100 text-red-800",
    WARN: "bg-yellow-100 text-yellow-800",
    BLOCKED: "bg-gray-100 text-gray-600",
  };
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-sm font-medium ${map[status] ?? "bg-gray-100 text-gray-600"}`}
    >
      {status}
    </span>
  );
}

// ─── Step card ────────────────────────────────────────────────────────────────

function StepCard({
  number,
  title,
  outside,
  expect: expectList,
  stepResult,
  onVerify,
  verifyLabel = "Verify",
  verifyLoading,
  children,
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 text-left"
      >
        <span className="font-semibold text-gray-800">
          <span className="mr-2 text-gray-400">{number}.</span>
          {title}
        </span>
        <div className="flex items-center gap-3">
          <StatusBadge status={stepResult?.status} />
          <span className="text-gray-400 text-xs">{open ? "▲" : "▼"}</span>
        </div>
      </button>
      {open && (
        <div className="px-4 py-3 space-y-3 text-sm">
          <div className="rounded bg-blue-50 border border-blue-100 p-3">
            <p className="font-medium text-blue-800 mb-1">Outside this page</p>
            <ol className="list-decimal list-inside space-y-1 text-blue-900">
              {outside.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ol>
          </div>
          <div className="rounded bg-gray-50 border border-gray-200 p-3">
            <p className="font-medium text-gray-700 mb-1">Expected results</p>
            <ul className="list-disc list-inside space-y-0.5 text-gray-600">
              {expectList.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </div>
          {children}
          {onVerify && (
            <p className="text-gray-600">
              <span className="font-medium text-gray-700">Then:</span> click{" "}
              <span className="font-medium">{verifyLabel}</span> below.
            </p>
          )}
          {onVerify && (
            <button
              type="button"
              onClick={onVerify}
              disabled={verifyLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {verifyLoading ? "Checking…" : verifyLabel}
            </button>
          )}
          {stepResult && stepResult.status !== "idle" && (
            <div
              className={`rounded border p-3 ${
                stepResult.status === "PASS"
                  ? "bg-green-50 border-green-200"
                  : stepResult.status === "FAIL"
                    ? "bg-red-50 border-red-200"
                    : stepResult.status === "WARN"
                      ? "bg-yellow-50 border-yellow-200"
                      : "bg-gray-50 border-gray-200"
              }`}
            >
              <p className="font-medium mb-1">
                {stepResult.status === "PASS"
                  ? "✓ Passed"
                  : stepResult.status === "FAIL"
                    ? "✗ Failed"
                    : stepResult.status === "WARN"
                      ? "⚠ Warning"
                      : "⊘ Blocked"}
              </p>
              <ul className="list-disc list-inside space-y-0.5 text-sm">
                {(stepResult.reasons ?? []).map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main client ──────────────────────────────────────────────────────────────

export default function TestVisibilityTrackingClient() {
  const [stepResults, setStepResults] = useState({});
  const [loading, setLoading] = useState({});
  const [projectId, setProjectId] = useState(null);

  const setResult = (stepId, status, reasons = []) =>
    setStepResults((p) => ({ ...p, [stepId]: { status, reasons } }));
  const setLoadingStep = (stepId, value) =>
    setLoading((p) => ({ ...p, [stepId]: value }));

  // Step 1: Keywords and prompts existence
  const runStep1 = async () => {
    setLoadingStep(1, true);
    setResult(1, "idle");
    try {
      const res = await fetch("/api/visibility_tracker/project", {
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setResult(1, "FAIL", [
          data?.error || `HTTP ${res.status}`,
          ...(data?.details ? [data.details] : []),
        ]);
        return;
      }
      const project = data.project;
      const keywords = data.keywords || [];
      const prompts = data.prompts || [];
      const reasons = [];
      if (!project) reasons.push("No project found.");
      if (keywords.length < 1) reasons.push("No keywords (need at least one).");
      if (prompts.length < 1) reasons.push("No prompts (need at least one).");
      if (keywords.length > 20) reasons.push("More than 20 keywords (limit 20).");
      if (prompts.length > 5) reasons.push("More than 5 prompts (limit 5).");
      if (project?.id) setProjectId(project.id);
      if (reasons.length > 0) {
        setResult(1, "FAIL", reasons);
      } else {
        setResult(1, "PASS", [
          `Project: ${project.domain}`,
          `${keywords.length} keyword(s), ${prompts.length} prompt(s).`,
        ]);
      }
    } catch (e) {
      setResult(1, "FAIL", [e?.message || "Request failed"]);
    } finally {
      setLoadingStep(1, false);
    }
  };

  // Step 2: Set due in 1 min + Run cron + Verify
  const [setDueMessage, setSetDueMessage] = useState(null);
  const [cronMessage, setCronMessage] = useState(null);

  const runSetDueInOneMin = async () => {
    setSetDueMessage(null);
    try {
      const res = await fetch("/api/visibility_tracker/test/set-due-in-one-minute", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(projectId ? { projectId } : {}),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setSetDueMessage(
          `Project will be due in ~1 min (last_run_at set). Cadence: ${data.cadence}.`
        );
      } else {
        setSetDueMessage(data?.error || `HTTP ${res.status}`);
      }
    } catch (e) {
      setSetDueMessage(e?.message || "Failed");
    }
  };

  const runTriggerCron = async () => {
    setCronMessage(null);
    try {
      const res = await fetch("/api/visibility_tracker/test/trigger-cron", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setCronMessage(
          `Cron ran. Scheduled: ${data.scheduled ?? data.results?.scheduled ?? "—"}. Now click Verify.`
        );
      } else {
        setCronMessage(data?.error || `HTTP ${res.status}`);
      }
    } catch (e) {
      setCronMessage(e?.message || "Failed");
    }
  };

  const runStep2 = async () => {
    setLoadingStep(2, true);
    setResult(2, "idle");
    try {
      const res = await fetch("/api/visibility_tracker/debug/tables", {
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setResult(2, "FAIL", [data?.error || `HTTP ${res.status}`]);
        return;
      }
      const runs = data?.vt_runs || [];
      const jobs = data?.vt_jobs || [];
      const pid = projectId || (data?.vt_projects?.[0]?.id);
      const scheduledRuns = runs.filter(
        (r) => r.project_id === pid && r.run_type === "scheduled"
      );
      const recentRun = scheduledRuns[0];
      const runJobs = recentRun
        ? jobs.filter((j) => j.run_id === recentRun.id)
        : [];
      if (scheduledRuns.length === 0) {
        setResult(2, "FAIL", [
          "No scheduled run found for your project. Set due in 1 min, then Run cron, wait a few seconds, then Verify again.",
        ]);
      } else if (runJobs.length === 0 && recentRun?.status !== "success" && recentRun?.status !== "partial") {
        setResult(2, "WARN", [
          `Scheduled run ${recentRun.id} exists (status: ${recentRun.status}). Jobs may still be queued (${runJobs.length} jobs for this run in snapshot).`,
        ]);
      } else {
        setResult(2, "PASS", [
          `Scheduled run: ${recentRun?.id}, status: ${recentRun?.status}, jobs: ${runJobs.length}.`,
        ]);
      }
    } catch (e) {
      setResult(2, "FAIL", [e?.message || "Request failed"]);
    } finally {
      setLoadingStep(2, false);
    }
  };

  // Step 3: Next run time (cadence) and results
  const runStep3 = async () => {
    setLoadingStep(3, true);
    setResult(3, "idle");
    try {
      const res = await fetch("/api/visibility_tracker/project", {
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setResult(3, "FAIL", [data?.error || `HTTP ${res.status}`]);
        return;
      }
      const project = data.project;
      const lastRunAt = project?.last_run_at;
      const cadence = project?.cadence || "weekly";
      const reasons = [];
      if (!lastRunAt) {
        reasons.push(
          "last_run_at not set yet. Run completes when worker finalizes the run; then last_run_at is updated."
        );
        setResult(3, "WARN", reasons);
        return;
      }
      const last = new Date(lastRunAt);
      let nextRunMs = last.getTime();
      if (cadence === "daily") nextRunMs += 24 * 60 * 60 * 1000;
      else if (cadence === "2xdaily") nextRunMs += 12 * 60 * 60 * 1000;
      else nextRunMs += 168 * 60 * 60 * 1000;
      const nextRunStr = new Date(nextRunMs).toLocaleString();
      reasons.push(`last_run_at: ${last.toLocaleString()}`);
      reasons.push(`cadence: ${cadence}`);
      reasons.push(`next run (computed): ${nextRunStr}`);
      setResult(3, "PASS", reasons);
    } catch (e) {
      setResult(3, "FAIL", [e?.message || "Request failed"]);
    } finally {
      setLoadingStep(3, false);
    }
  };

  // Step 4: Manual scan
  const runStep4 = async () => {
    setLoadingStep(4, true);
    setResult(4, "idle");
    try {
      const res = await fetch("/api/visibility_tracker/runs/manual", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(projectId ? { projectId } : {}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setResult(4, "FAIL", [
          data?.error || `HTTP ${res.status}`,
          ...(data?.current != null ? [`current: ${data.current}`] : []),
        ]);
        return;
      }
      const jobCount = data.jobCount ?? (data.keywordJobs ?? 0) + (data.promptJobs ?? 0);
      if (!data.runId) {
        setResult(4, "FAIL", ["No runId in response"]);
        return;
      }
      if (jobCount < 1) {
        setResult(4, "WARN", [
          `Manual run ${data.runId} created but jobCount is 0 (keywords/prompts may be empty).`,
        ]);
      } else {
        setResult(4, "PASS", [
          `Run ${data.runId} created, ${jobCount} job(s).`,
        ]);
      }
    } catch (e) {
      setResult(4, "FAIL", [e?.message || "Request failed"]);
    } finally {
      setLoadingStep(4, false);
    }
  };

  // Step 5: Worker execution — button to queue jobs for testing
  const [queueJobsMessage, setQueueJobsMessage] = useState(null);
  const [queueJobsLoading, setQueueJobsLoading] = useState(false);

  const runQueueJobs = async () => {
    setQueueJobsMessage(null);
    setQueueJobsLoading(true);
    try {
      const res = await fetch("/api/visibility_tracker/runs/manual", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(projectId ? { projectId } : {}),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const jobCount = data.jobCount ?? (data.keywordJobs ?? 0) + (data.promptJobs ?? 0);
        setQueueJobsMessage(
          `Run ${data.runId} created with ${jobCount} queued job(s). Click Verify to run worker poll.`
        );
      } else {
        setQueueJobsMessage(data?.error || `HTTP ${res.status}`);
      }
    } catch (e) {
      setQueueJobsMessage(e?.message || "Failed");
    } finally {
      setQueueJobsLoading(false);
    }
  };

  const runStep5 = async () => {
    setLoadingStep(5, true);
    setResult(5, "idle");
    try {
      const res = await fetch("/api/visibility_tracker/test/worker-poll", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchSize: 2, workerId: "test-vt-page" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setResult(5, "FAIL", [data?.error || `HTTP ${res.status}`]);
        return;
      }
      const claimed = data.claimed ?? data.jobs?.length ?? 0;
      if (claimed > 0) {
        setResult(5, "PASS", [
          `Worker poll succeeded. Claimed/processed: ${claimed} job(s).`,
        ]);
      } else {
        setResult(5, "WARN", [
          "Worker poll returned 200 but no jobs claimed (no queued jobs or worker already busy).",
        ]);
      }
    } catch (e) {
      setResult(5, "FAIL", [e?.message || "Request failed"]);
    } finally {
      setLoadingStep(5, false);
    }
  };

  // Step 6: Results APIs (SEO + AI) — need a completed runId; use last run from project
  const [lastRunId, setLastRunId] = useState(null);
  const runStep6 = async () => {
    setLoadingStep(6, true);
    setResult(6, "idle");
    try {
      let pid = projectId;
      if (!pid) {
        const projRes = await fetch("/api/visibility_tracker/project", {
          credentials: "include",
        });
        const projData = await projRes.json().catch(() => ({}));
        pid = projData?.project?.id;
        if (pid) setProjectId(pid);
      }
      if (!pid) {
        setResult(6, "FAIL", ["No project. Complete Step 1 first."]);
        setLoadingStep(6, false);
        return;
      }
      const histRes = await fetch(
        `/api/visibility_tracker/projects/${encodeURIComponent(pid)}/report-history`,
        { credentials: "include" }
      );
      const histData = await histRes.json().catch(() => ({}));
      const runs = histData?.runs || [];
      const completedRun = runs.find((r) =>
        ["success", "partial"].includes(r?.status)
      );
      const runId = completedRun?.id || lastRunId;
      if (!runId) {
        setResult(6, "WARN", [
          "No completed run found. Complete a run (e.g. manual + worker poll until done) then Verify again.",
        ]);
        setLoadingStep(6, false);
        return;
      }
      setLastRunId(runId);
      const [seoRes, aiRes] = await Promise.all([
        fetch(
          `/api/visibility_tracker/results/seo?runId=${encodeURIComponent(runId)}`,
          { credentials: "include" }
        ),
        fetch(
          `/api/visibility_tracker/results/ai?runId=${encodeURIComponent(runId)}`,
          { credentials: "include" }
        ),
      ]);
      const seoData = await seoRes.json().catch(() => ({}));
      const aiData = await aiRes.json().catch(() => ({}));
      const seoOk = seoRes.ok && Array.isArray(seoData?.results);
      const aiOk = aiRes.ok && (Array.isArray(aiData?.results) || aiData?.domain != null);
      if (seoOk && aiOk) {
        setResult(6, "PASS", [
          `SEO results: ${seoData.results?.length ?? 0} item(s).`,
          `AI results: ${aiData.results?.length ?? 0} item(s), domain: ${aiData.domain ?? "—"}.`,
        ]);
      } else {
        const parts = [];
        if (!seoOk) parts.push("SEO API error or invalid shape.");
        if (!aiOk) parts.push("AI API error or invalid shape.");
        setResult(6, "FAIL", parts);
      }
    } catch (e) {
      setResult(6, "FAIL", [e?.message || "Request failed"]);
    } finally {
      setLoadingStep(6, false);
    }
  };

  // Step 7: Report history
  const runStep7 = async () => {
    setLoadingStep(7, true);
    setResult(7, "idle");
    try {
      let pid = projectId;
      if (!pid) {
        const projRes = await fetch("/api/visibility_tracker/project", {
          credentials: "include",
        });
        const projData = await projRes.json().catch(() => ({}));
        const p = projData?.project;
        if (!p?.id) {
          setResult(7, "FAIL", ["No project. Complete Step 1 first."]);
          setLoadingStep(7, false);
          return;
        }
        pid = p.id;
        setProjectId(pid);
      }
      const res = await fetch(
        `/api/visibility_tracker/projects/${encodeURIComponent(pid)}/report-history`,
        { credentials: "include" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setResult(7, "FAIL", [data?.error || `HTTP ${res.status}`]);
        return;
      }
      const runs = data?.runs || [];
      setResult(7, "PASS", [
        `Report history returned ${runs.length} run(s) for project.`,
      ]);
    } catch (e) {
      setResult(7, "FAIL", [e?.message || "Request failed"]);
    } finally {
      setLoadingStep(7, false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Visibility Tracking Test</h1>
      <p className="text-gray-600 text-sm">
        Step-by-step validation. Each step has its own Verify button; result
        appears below the step.
      </p>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Test Steps</h2>

        <StepCard
          number={1}
          title="Keywords and prompts existence"
          outside={[
            "Create a visibility tracking project (e.g. from Visibility Tracking in the sidebar).",
            "Open the project edit page and add at least one keyword and one prompt.",
          ]}
          expect={[
            "Project exists; at least one active keyword and one active prompt.",
            "Within limits: max 20 keywords, max 5 prompts.",
          ]}
          stepResult={stepResults[1]}
          onVerify={runStep1}
          verifyLoading={loading[1]}
        />

        <StepCard
          number={2}
          title="Cron run and due-in-1-min"
          outside={[
            "Ensure Step 1 is passing (project with keywords and prompts).",
            "Use the buttons below to set the project due in ~1 min and trigger the cron.",
          ]}
          expect={[
            "After Set due in 1 min: project will be due on next cron tick.",
            "After Run cron: full cron runs (VT scheduleFromDb picks due projects, creates runs/jobs).",
            "Verify: a scheduled run exists for your project with jobs.",
          ]}
          stepResult={stepResults[2]}
          onVerify={runStep2}
          verifyLoading={loading[2]}
          verifyLabel="Verify cron result"
        >
          <div className="rounded border border-amber-200 bg-amber-50 p-3 space-y-2">
            <div className="flex flex-wrap gap-2 items-center">
              <button
                type="button"
                onClick={runSetDueInOneMin}
                className="px-3 py-1.5 bg-amber-600 text-white rounded font-medium hover:bg-amber-700 text-sm"
              >
                Set due in 1 min
              </button>
              <button
                type="button"
                onClick={runTriggerCron}
                className="px-3 py-1.5 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 text-sm"
              >
                Run cron
              </button>
            </div>
            {setDueMessage && (
              <p className="text-sm text-amber-800">{setDueMessage}</p>
            )}
            {cronMessage && (
              <p className="text-sm text-blue-800">{cronMessage}</p>
            )}
          </div>
        </StepCard>

        <StepCard
          number={3}
          title="Next run time (cadence) and results"
          outside={[
            "After cron has run and the worker has processed jobs, the run finalizes and last_run_at is updated.",
            "Optionally run Step 5 (Worker) until jobs complete, then verify here.",
          ]}
          expect={[
            "last_run_at is set on the project.",
            "Next run time = last_run_at + cadence (weekly +7d, daily +1d, 2xdaily +12h).",
          ]}
          stepResult={stepResults[3]}
          onVerify={runStep3}
          verifyLoading={loading[3]}
        />

        <StepCard
          number={4}
          title="Manual scan protocol"
          outside={[
            "Use the same project (with keywords/prompts).",
          ]}
          expect={[
            "POST /api/visibility_tracker/runs/manual creates a run and jobs.",
            "Response: runId, jobCount > 0 (or keywordJobs + promptJobs).",
          ]}
          stepResult={stepResults[4]}
          onVerify={runStep4}
          verifyLoading={loading[4]}
        />

        <StepCard
          number={5}
          title="Worker execution"
          outside={[
            "Have at least one run with queued jobs (e.g. from Step 2 or Step 4), or use the button below to create one.",
          ]}
          expect={[
            "Worker poll claims and processes jobs (or returns 200 with 0 claimed if none queued).",
          ]}
          stepResult={stepResults[5]}
          onVerify={runStep5}
          verifyLoading={loading[5]}
        >
          <div className="rounded border border-slate-200 bg-slate-50 p-3 space-y-2">
            <p className="text-sm text-slate-700 font-medium">Queue jobs for testing</p>
            <div className="flex flex-wrap gap-2 items-center">
              <button
                type="button"
                onClick={runQueueJobs}
                disabled={queueJobsLoading}
                className="px-3 py-1.5 bg-slate-600 text-white rounded font-medium hover:bg-slate-700 disabled:opacity-50 text-sm"
              >
                {queueJobsLoading ? "Queuing…" : "Queue jobs (create manual run)"}
              </button>
            </div>
            {queueJobsMessage && (
              <p className="text-sm text-slate-800">{queueJobsMessage}</p>
            )}
          </div>
        </StepCard>

        <StepCard
          number={6}
          title="Results APIs (SEO and AI)"
          outside={[
            "Have at least one completed run (success or partial).",
          ]}
          expect={[
            "GET results/seo?runId=... and results/ai?runId=... return 200 with results array (or domain for AI).",
          ]}
          stepResult={stepResults[6]}
          onVerify={runStep6}
          verifyLoading={loading[6]}
        />

        <StepCard
          number={7}
          title="Report history"
          outside={[
            "Project exists (Step 1).",
          ]}
          expect={[
            "GET projects/[projectId]/report-history returns list of runs with SEO and AI summaries.",
          ]}
          stepResult={stepResults[7]}
          onVerify={runStep7}
          verifyLoading={loading[7]}
        />
      </div>
    </div>
  );
}

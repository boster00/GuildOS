"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { BarChart2, Settings, RefreshCw, Loader, ChevronLeft, Trash2 } from "lucide-react";

/** Map DataForSEO engine id to display name. */
function getEngineDisplayName(engineId) {
  const map = { google: "Google", bing: "Bing", yahoo: "Yahoo", baidu: "Baidu" };
  return map[String(engineId || "").toLowerCase()] ?? (engineId ? String(engineId) : "Google");
}

export default function VisibilityTrackingViewPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug;

  const [project, setProject] = useState(null);
  const [keywords, setKeywords] = useState([]);
  const [prompts, setPrompts] = useState([]);
  const [reportHistory, setReportHistory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [running, setRunning] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [activeRun, setActiveRun] = useState(null);

  useEffect(() => {
    if (!slug) return;
    async function load() {
      setLoading(true);
      setNotFound(false);
      try {
        const [projRes, historyRes, statusRes] = await Promise.all([
          fetch(
            `/api/visibility_tracker/project?projectId=${encodeURIComponent(slug)}`
          ),
          fetch(
            `/api/visibility_tracker/projects/${encodeURIComponent(slug)}/report-history`
          ),
          fetch(
            `/api/visibility_tracker/projects/${encodeURIComponent(slug)}/run-status`
          ),
        ]);
        const projData = await projRes.json();
        const historyData = await historyRes.json();
        const statusData = await statusRes.json();

        if (projData.success && projData.project) {
          setProject(projData.project);
          setKeywords(projData.keywords || []);
          setPrompts(projData.prompts || []);
        } else if (projRes.status === 404 || !projData.project) {
          setNotFound(true);
        }
        if (historyData.success && historyData.runs) {
          setReportHistory(historyData.runs);
        } else {
          setReportHistory([]);
        }
        if (statusData.active) {
          setActiveRun({
            active: true,
            run_id: statusData.run_id,
            status: statusData.status,
          });
        } else {
          setActiveRun({ active: false });
        }
      } catch (e) {

      } finally {
        setLoading(false);
      }
    }
    load();
  }, [slug]);

  useEffect(() => {
    if (!slug || !activeRun?.active) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/visibility_tracker/projects/${encodeURIComponent(slug)}/run-status`
        );
        const data = await res.json();
        if (!data.active) {
          setActiveRun({ active: false });
          const historyRes = await fetch(
            `/api/visibility_tracker/projects/${encodeURIComponent(slug)}/report-history`
          );
          const historyData = await historyRes.json();
          if (historyData.success && historyData.runs) {
            setReportHistory(historyData.runs);
          }
        } else {
          setActiveRun({
            active: true,
            run_id: data.run_id,
            status: data.status,
          });
        }
      } catch (e) {

      }
    }, 30000);
    return () => clearInterval(interval);
  }, [slug, activeRun?.active]);

  const handleRunNow = async () => {
    if (!slug) return;
    setRunning(true);
    try {
      const res = await fetch("/api/visibility_tracker/cron/run-now", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (data.success) {
        const statusRes = await fetch(
          `/api/visibility_tracker/projects/${encodeURIComponent(slug)}/run-status`
        );
        const statusData = await statusRes.json();
        if (statusData.active) {
          setActiveRun({
            active: true,
            run_id: statusData.run_id,
            status: statusData.status,
          });
        }
      }
    } catch (e) {

    } finally {
      setRunning(false);
    }
  };

  const handleDeleteProject = async () => {
    if (
      !window.confirm(
        "Delete this project and all its keywords, prompts, and run history? This cannot be undone."
      )
    ) {
      return;
    }
    if (!slug) return;
    setDeleting(true);
    try {
      const res = await fetch(
        `/api/visibility_tracker/project?projectId=${encodeURIComponent(slug)}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (data.success) {
        router.replace("/geo-seo-visibility-tracking");
        return;
      }
      alert(data.error || "Failed to delete project");
    } catch (e) {
      alert(e?.message || "Request failed");
    } finally {
      setDeleting(false);
    }
  };

  const runs = reportHistory || [];
  const periods = runs.slice(0, 10);
  const displayPeriods = periods.length > 0 ? periods : [null];

  if (loading && !project) {
    return (
      <div className="min-h-screen bg-base-200 p-8 flex items-center justify-center">
        <Loader className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (notFound || (!loading && !project)) {
    return (
      <div className="min-h-screen bg-base-200 p-8">
        <div className="max-w-xl mx-auto">
          <p className="text-error">Project not found.</p>
          <Link
            href="/geo-seo-visibility-tracking"
            className="btn btn-ghost btn-sm mt-4"
          >
            Back to list
          </Link>
        </div>
      </div>
    );
  }

  const editHref = `/geo-seo-visibility-tracking/${encodeURIComponent(slug)}/edit`;

  return (
    <div className="min-h-screen bg-base-200 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link
              href="/geo-seo-visibility-tracking"
              className="btn btn-ghost btn-sm gap-1"
              title="Back to projects list"
            >
              <ChevronLeft className="w-5 h-5" />
              Back
            </Link>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <BarChart2 className="w-8 h-8" />
              {project?.domain ?? "Project"}
            </h1>
          </div>
          <div className="flex gap-2">
            <Link href={editHref} className="btn btn-outline">
              <Settings className="w-4 h-4" />
              Edit settings
            </Link>
            <button
              className="btn btn-primary"
              onClick={handleRunNow}
              disabled={running || activeRun?.active}
            >
              {running ? (
                <Loader className="w-4 h-4 animate-spin" />
              ) : activeRun?.active ? (
                "Project is running"
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Run now
                </>
              )}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm text-error"
              onClick={handleDeleteProject}
              disabled={deleting}
              title="Delete project and all its data"
            >
              {deleting ? (
                <Loader className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              Delete project
            </button>
          </div>
        </div>

        <div className="card bg-base-100 shadow-xl mb-6">
          <div className="card-body">
            <p className="text-sm text-gray-500">
              Domain: <strong>{project?.domain}</strong>
              {project?.last_run_at && (
                <>
                  {" "}
                  · Last run:{" "}
                  {new Date(project.last_run_at).toLocaleString()}
                </>
              )}
            </p>
            <div className="flex flex-wrap gap-4 mt-2">
              <div className="stat bg-base-200 rounded-lg px-4 py-2">
                <div className="stat-title text-xs">Keywords</div>
                <div className="stat-value text-lg">{keywords.length}</div>
              </div>
              <div className="stat bg-base-200 rounded-lg px-4 py-2">
                <div className="stat-title text-xs">Prompts</div>
                <div className="stat-value text-lg">{prompts.length}</div>
              </div>
            </div>
          </div>
        </div>

        <h2 className="text-xl font-bold mb-2">
          Keyword rankings (last 10 periods)
          <span className="text-sm font-normal text-base-content/70 ml-2">
            — from {getEngineDisplayName(runs.find((r) => r.seo?.length)?.seo?.[0]?.engine ?? "google")}
          </span>
        </h2>
        <div className="card bg-base-100 shadow-xl mb-6 overflow-x-auto">
          <div className="card-body p-4">
            <table className="table table-zebra table-sm">
              <thead>
                <tr>
                  <th className="min-w-[140px]">Keyword</th>
                  {displayPeriods.map((run, i) => (
                    <th
                      key={run?.id ?? "placeholder"}
                      className="whitespace-nowrap text-xs font-normal text-base-content/80 align-top"
                      title={run?.error_summary ?? run?.status}
                    >
                      <span className="block">
                        {run?.started_at
                          ? new Date(run.started_at).toLocaleDateString()
                          : "—"}
                      </span>
                      {run?.status && (
                        <span
                          className={`block text-[10px] mt-0.5 ${
                            run.status === "success"
                              ? "text-success"
                              : run.status === "failed"
                                ? "text-error"
                                : run.status === "partial"
                                  ? "text-warning"
                                  : "text-base-content/60"
                          }`}
                        >
                          {run.status === "running" || run.status === "queued"
                            ? "in progress"
                            : run.status}
                          {run.error_summary ? ` (${run.error_summary})` : ""}
                        </span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {keywords.length === 0 ? (
                  <tr>
                    <td colSpan={displayPeriods.length + 1} className="text-gray-500">
                      No keywords. Add them in Edit settings.
                    </td>
                  </tr>
                ) : (
                  keywords.map((kw, rowIndex) => (
                    <tr key={kw.id}>
                      <td className="font-mono text-xs">{kw.keyword}</td>
                      {displayPeriods.map((run) => {
                        if (!run) {
                          return (
                            <td key="placeholder" className="text-xs text-base-content/60">
                              {rowIndex === 0 ? "Run to see rankings" : "—"}
                            </td>
                          );
                        }
                        const seoRow = (run.seo || []).find(
                          (s) => s.keyword_id === kw.id
                        );
                        return (
                          <td key={run.id} className="text-xs">
                            {seoRow != null
                              ? `#${seoRow.rank ?? "—"}`
                              : "—"}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <h2 className="text-xl font-bold mb-2">Prompt mentions (last 10 periods)</h2>
        <div className="card bg-base-100 shadow-xl overflow-x-auto">
          <div className="card-body p-4">
            <table className="table table-zebra table-sm">
              <thead>
                <tr>
                  <th className="min-w-[120px]">Prompt / Model</th>
                  {displayPeriods.map((run) => (
                    <th
                      key={run?.id ?? "placeholder"}
                      className="whitespace-nowrap text-xs font-normal text-base-content/80 align-top"
                      title={run?.error_summary ?? run?.status}
                    >
                      <span className="block">
                        {run?.started_at
                          ? new Date(run.started_at).toLocaleDateString()
                          : "—"}
                      </span>
                      {run?.status && (
                        <span
                          className={`block text-[10px] mt-0.5 ${
                            run.status === "success"
                              ? "text-success"
                              : run.status === "failed"
                                ? "text-error"
                                : run.status === "partial"
                                  ? "text-warning"
                                  : "text-base-content/60"
                          }`}
                        >
                          {run.status === "running" || run.status === "queued"
                            ? "in progress"
                            : run.status}
                          {run.error_summary ? ` (${run.error_summary})` : ""}
                        </span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {prompts.length === 0 ? (
                  <tr>
                    <td colSpan={displayPeriods.length + 1} className="text-gray-500">
                      No prompts. Add them in Edit settings.
                    </td>
                  </tr>
                ) : (
                  prompts.flatMap((prompt, promptIndex) => {
                    const models = prompt.models || ["chatgpt"];
                    return models.map((model, modelIndex) => {
                      const isFirstRow = promptIndex === 0 && modelIndex === 0;
                      return (
                        <tr key={`${prompt.id}-${model}`}>
                          <td className="text-xs">
                            {(prompt.prompt_text || "").slice(0, 40)}{(prompt.prompt_text || "").length > 40 ? "…" : ""} / {model}
                          </td>
                          {displayPeriods.map((run) => {
                            if (!run) {
                              return (
                                <td key="placeholder" className="text-xs text-base-content/60">
                                  {isFirstRow ? "Run to see results" : "—"}
                                </td>
                              );
                            }
                            const aiRow = (run.ai || []).find(
                              (a) =>
                                a.prompt_id === prompt.id && a.model === model
                            );
                            if (!aiRow) {
                              return (
                                <td key={run.id} className="text-xs">
                                  —
                                </td>
                              );
                            }
                            const parts = [];
                            if (aiRow.mentions_brand) parts.push("Brand: Y");
                            else parts.push("Brand: N");
                            if (aiRow.mentions_domain) parts.push("Domain: Y");
                            else parts.push("Domain: N");
                            parts.push(
                              `${aiRow.citations_count ?? 0} citations`
                            );
                            return (
                              <td key={run.id} className="text-xs">
                                {parts.join(", ")}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    });
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { Play, Check, X, Database } from "lucide-react";

const STEPS = [
  {
    id: 1,
    name: "Load Config",
    endpoint: "/api/visibility_tracker/project",
    method: "GET",
  },
  { id: 2, name: "Validate Limits", action: "client" },
  {
    id: 3,
    name: "Create Manual Run",
    endpoint: "/api/visibility_tracker/runs/manual",
    method: "POST",
  },
  {
    id: 4,
    name: "Preview Jobs",
    endpoint: "/api/visibility_tracker/runs/{runId}/jobs",
    method: "GET",
  },
  {
    id: 5,
    name: "Run Worker Poll",
    endpoint: "/api/visibility_tracker/test/worker-poll",
    method: "POST",
  },
  {
    id: 6,
    name: "Fetch SEO Results",
    endpoint: "/api/visibility_tracker/results/seo?runId={runId}",
    method: "GET",
  },
  {
    id: 7,
    name: "Fetch AI Results",
    endpoint: "/api/visibility_tracker/results/ai?runId={runId}",
    method: "GET",
  },
  { id: 8, name: "Compute Aggregates", action: "client" },
];

const DEFAULT_PAYLOADS = {
  3: "{}",
  4: '{ "runId": "" }',
  5: '{ "batchSize": 2, "workerId": "test-worker" }',
  6: '{ "runId": "" }',
  7: '{ "runId": "" }',
};

function parsePayload(raw, stepId) {
  const fallback = DEFAULT_PAYLOADS[stepId] || "{}";
  if (!raw || typeof raw !== "string") return fallback.trim() ? JSON.parse(fallback) : {};
  const trimmed = raw.trim();
  if (!trimmed) return fallback.trim() ? JSON.parse(fallback) : {};
  try {
    return JSON.parse(trimmed);
  } catch {
    return fallback.trim() ? JSON.parse(fallback) : {};
  }
}

function runClientAction(stepId, stepResults, currentRunId) {
  if (stepId === 2) {
    const configData = stepResults[1]?.data;
    const keywordCount = configData?.keywords?.length ?? 0;
    const promptCount = configData?.prompts?.length ?? 0;
    return {
      valid: keywordCount <= 20 && promptCount <= 5,
      keywordCount,
      promptCount,
      keywordLimit: 20,
      promptLimit: 5,
    };
  }

  if (stepId === 8) {
    const seoResults = stepResults[6]?.data?.results ?? [];
    const aiResults = stepResults[7]?.data?.results ?? [];
    const domain = stepResults[7]?.data?.domain;
    return {
      seoResultsCount: seoResults.length,
      aiResultsCount: aiResults.length,
      domain,
      rankedKeywords: seoResults.filter((r) => r.rank).length,
      domainMentions: aiResults.filter((r) => r.mentions_domain).length,
      brandMentions: aiResults.filter((r) => r.mentions_brand).length,
    };
  }

  return { message: "Client action completed" };
}

export default function TestVisibilityTrackerPage() {
  const [currentStep, setCurrentStep] = useState(null);
  const [stepResults, setStepResults] = useState({});
  const [loading, setLoading] = useState(false);
  const [runId, setRunId] = useState(null);
  const [payloads, setPayloads] = useState(() => ({
    3: DEFAULT_PAYLOADS[3],
    4: DEFAULT_PAYLOADS[4],
    5: DEFAULT_PAYLOADS[5],
    6: DEFAULT_PAYLOADS[6],
    7: DEFAULT_PAYLOADS[7],
  }));
  const [dbTables, setDbTables] = useState(null);
  const [dbLoading, setDbLoading] = useState(false);

  const runStep = async (step) => {
    setLoading(true);
    setCurrentStep(step.id);

    try {
      let result;

      if (step.action === "client") {
        result = runClientAction(step.id, stepResults, runId);
      } else {
        const payload = parsePayload(payloads[step.id], step.id);
        const effectiveRunId =
          (payload.runId && String(payload.runId).trim()) || runId || "";
        let endpoint = (step.endpoint || "")
          .replace("{runId}", effectiveRunId)
          .replace(/\?runId=\{runId\}/, effectiveRunId ? `?runId=${encodeURIComponent(effectiveRunId)}` : "");
        if ((step.id === 6 || step.id === 7) && effectiveRunId) {
          endpoint = step.id === 6
            ? `/api/visibility_tracker/results/seo?runId=${encodeURIComponent(effectiveRunId)}`
            : `/api/visibility_tracker/results/ai?runId=${encodeURIComponent(effectiveRunId)}`;
        }
        if (step.id === 4 && effectiveRunId) {
          endpoint = `/api/visibility_tracker/runs/${effectiveRunId}/jobs`;
        }
        const fetchOptions = {
          method: step.method,
          headers: { "Content-Type": "application/json" },
        };

        if (step.method === "POST") {
          if (step.id === 3) {
            fetchOptions.body = JSON.stringify(payload);
          }
          if (step.id === 5) {
            fetchOptions.body = JSON.stringify({
              batchSize: payload.batchSize ?? 2,
              workerId: payload.workerId ?? "test-worker",
            });
          }
        }

        const response = await fetch(endpoint, fetchOptions);
        result = await response.json();
        if (step.id === 3 && result.runId) {
          setRunId(result.runId);
        }

        if (!response.ok) {
          setStepResults((prev) => ({
            ...prev,
            [step.id]: { success: false, error: result?.error || "Request failed", data: result },
          }));
          return;
        }
      }

      setStepResults((prev) => ({
        ...prev,
        [step.id]: { success: true, data: result },
      }));
    } catch (error) {
      setStepResults((prev) => ({
        ...prev,
        [step.id]: {
          success: false,
          error: error?.message || "Unknown error",
        },
      }));
    } finally {
      setLoading(false);
      setCurrentStep(null);
    }
  };

  const pullDbState = async () => {
    setDbLoading(true);
    setDbTables(null);
    try {
      const res = await fetch("/api/visibility_tracker/debug/tables");
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Request failed");
      setDbTables(data);
    } catch (e) {
      setDbTables({ error: e?.message || "Failed to load tables" });
    } finally {
      setDbLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-base-200 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="card bg-base-100 shadow-xl mb-6">
          <div className="card-body">
            <h1 className="card-title text-3xl">
              Visibility Tracker Test Harness
            </h1>
            <p className="text-gray-600">
              Step-by-step testing for visibility tracking pipeline
            </p>
            <div className="mt-2">
              <button
                type="button"
                onClick={pullDbState}
                disabled={dbLoading}
                className="btn btn-outline btn-sm gap-2"
              >
                {dbLoading ? (
                  <span className="loading loading-spinner loading-sm" />
                ) : (
                  <Database className="w-4 h-4" />
                )}
                Pull DB state
              </button>
            </div>
          </div>
        </div>

        {dbTables && (
          <div className="card bg-base-100 shadow-xl mb-6 overflow-hidden">
            <div className="card-body">
              <h2 className="card-title">Database tables</h2>
              {dbTables.error ? (
                <div className="alert alert-error">{dbTables.error}</div>
              ) : (
                <div className="overflow-x-auto space-y-6">
                  {Object.entries(dbTables).map(([tableName, rows]) => {
                    if (!Array.isArray(rows) || rows.length === 0) {
                      return (
                        <div key={tableName}>
                          <h3 className="font-semibold text-lg mb-2">{tableName}</h3>
                          <p className="text-sm text-base-content/70">No rows</p>
                        </div>
                      );
                    }
                    const keys = Object.keys(rows[0]);
                    return (
                      <div key={tableName}>
                        <h3 className="font-semibold text-lg mb-2">
                          {tableName} ({rows.length})
                        </h3>
                        <div className="overflow-x-auto">
                          <table className="table table-xs table-zebra">
                            <thead>
                              <tr>
                                {keys.map((k) => (
                                  <th key={k}>{k}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {rows.map((row, i) => (
                                <tr key={i}>
                                  {keys.map((k) => (
                                    <td key={k} className="max-w-xs truncate">
                                      {typeof row[k] === "object" && row[k] !== null
                                        ? JSON.stringify(row[k])
                                        : String(row[k] ?? "")}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4">
          {STEPS.map((step) => (
            <div key={step.id} className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-lg">
                      Step {step.id}: {step.name}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {step.endpoint || step.action}
                    </p>
                  </div>
                  <button
                    className="btn btn-primary"
                    onClick={() => runStep(step)}
                    disabled={
                      (loading && currentStep === step.id) ||
                      ((step.id === 4 || step.id === 6 || step.id === 7) &&
                        !runId &&
                        !(parsePayload(payloads[step.id], step.id).runId))
                    }
                  >
                    {loading && currentStep === step.id ? (
                      <span className="loading loading-spinner loading-sm" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                    Run
                  </button>
                </div>

                {[3, 4, 5, 6, 7].includes(step.id) && (
                  <div className="mt-3">
                    <label className="block text-sm font-medium text-base-content/70 mb-1">
                      Request payload (JSON)
                    </label>
                    <textarea
                      value={payloads[step.id] ?? DEFAULT_PAYLOADS[step.id]}
                      onChange={(e) =>
                        setPayloads((prev) => ({
                          ...prev,
                          [step.id]: e.target.value,
                        }))
                      }
                      rows={3}
                      className="w-full font-mono text-sm textarea textarea-bordered"
                      placeholder={DEFAULT_PAYLOADS[step.id]}
                    />
                  </div>
                )}

                {stepResults[step.id] && (
                  <div className="mt-4">
                    <div
                      className={`alert ${
                        stepResults[step.id].success
                          ? "alert-success"
                          : "alert-error"
                      }`}
                    >
                      {stepResults[step.id].success ? (
                        <Check className="w-5 h-5" />
                      ) : (
                        <X className="w-5 h-5" />
                      )}
                      <span>
                        {stepResults[step.id].success ? "Success" : "Error"}
                      </span>
                    </div>

                    <details className="mt-2">
                      <summary className="cursor-pointer font-semibold">
                        View Response
                      </summary>
                      <pre className="bg-base-200 p-3 rounded text-xs overflow-x-auto max-h-96 mt-2 whitespace-pre-wrap break-words">
                        {JSON.stringify(
                          stepResults[step.id].data ??
                            stepResults[step.id].error,
                          null,
                          2
                        )}
                      </pre>
                    </details>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

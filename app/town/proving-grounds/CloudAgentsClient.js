"use client";

import { useEffect, useState } from "react";

// Temporary: proving-grounds harness target (remove when env-driven again)
const PROVING_GROUNDS_CURSOR_REPOSITORY = "https://github.com/boster00/GuildOS.git";
const PROVING_GROUNDS_CURSOR_REF = "main";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function ResultBox({ result }) {
  if (!result) return <p className="text-[11px] text-base-content/40 italic">No response yet.</p>;
  const isError = result.ok === false || result.error;
  return (
    <div className={`rounded-lg border p-2 text-[10px] font-mono ${isError ? "border-error/30 bg-error/5 text-error" : "border-success/30 bg-success/5 text-success"}`}>
      <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all leading-relaxed">
        {typeof result === "string" ? result : JSON.stringify(result, null, 2)}
      </pre>
    </div>
  );
}

function StepPanel({ stepNum, label, description, onRun, loading, result, disabled }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-base-300 bg-base-100/60 p-3">
      <div className="flex items-start gap-2">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
          {stepNum}
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-base-content leading-tight">{label}</p>
          {description && <p className="mt-0.5 text-[10px] text-base-content/50 leading-snug">{description}</p>}
        </div>
      </div>
      <button
        type="button"
        className="btn btn-sm btn-outline w-full"
        disabled={disabled || loading}
        onClick={onRun}
      >
        {loading
          ? <><span className="loading loading-spinner loading-xs" /> Running…</>
          : label}
      </button>
      <div className="min-h-[60px]">
        <ResultBox result={result} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Individual provider rows
// ---------------------------------------------------------------------------
function ViewSessionPanel({ sessionData, defaultViewUrl }) {
  const url = sessionData?.viewUrl || defaultViewUrl;
  const sessionId = sessionData?.sessionId;
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-base-300 bg-base-100/60 p-3">
      <div className="flex items-start gap-2">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-secondary/15 text-[10px] font-bold text-secondary">
          4
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-base-content leading-tight">View Session</p>
          <p className="mt-0.5 text-[10px] text-base-content/50 leading-snug">Open the agent session in the provider web UI.</p>
        </div>
      </div>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={`btn btn-sm btn-outline btn-secondary w-full ${!sessionId ? "btn-disabled opacity-40 pointer-events-none" : ""}`}
      >
        Open in Browser ↗
      </a>
      <div className="min-h-[60px]">
        {sessionId ? (
          <div className="rounded-lg border border-base-300 bg-base-100 p-2">
            <p className="text-[10px] text-base-content/50 mb-1">Session ID (copy to find it in the web UI):</p>
            <p className="font-mono text-[10px] text-primary break-all">{sessionId}</p>
            <p className="mt-1 text-[10px] text-base-content/40">{url}</p>
          </div>
        ) : (
          <p className="text-[11px] text-base-content/40 italic">Run Setup first to get a session.</p>
        )}
      </div>
    </div>
  );
}

function ProviderRow({
  id,
  name,
  badge,
  badgeColor,
  docsUrl,
  defaultViewUrl,
  requiredEnv,
  setupDescription,
  setupExtra,
  fetchDescription,
  initialSessionId,
}) {
  const [sessionData, setSessionData] = useState(
    initialSessionId ? { sessionId: initialSessionId, viewUrl: defaultViewUrl } : null
  );
  const [loading, setLoading] = useState({ 1: false, 2: false, 3: false });
  const [results, setResults] = useState({ 1: null, 2: null, 3: null });

  const call = async (action, extra = {}) => {
    const r = await fetch("/api/cloud_agents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    });
    return r.json().catch(() => ({ error: "Failed to parse response" }));
  };

  const setLoad = (step, val) => setLoading((l) => ({ ...l, [step]: val }));
  const setResult = (step, val) => setResults((r) => ({ ...r, [step]: val }));

  const handleSetup = async () => {
    setLoad(1, true);
    const res = await call(`${id}_setup`, setupExtra ?? {});
    setResult(1, res);
    if (res.sessionId) {
      setSessionData({ sessionId: res.sessionId, runId: res.runId, viewUrl: res.viewUrl });
    }
    setLoad(1, false);
  };

  const handleMessage = async () => {
    setLoad(2, true);
    const res = await call(`${id}_message`, {
      sessionId: sessionData?.sessionId,
      runId: sessionData?.runId,
    });
    setResult(2, res);
    if (res.runId) setSessionData((s) => ({ ...s, runId: res.runId }));
    setLoad(2, false);
  };

  const handleFetch = async () => {
    setLoad(3, true);
    const res = await call(`${id}_fetch`, {
      sessionId: sessionData?.sessionId,
      runId: sessionData?.runId,
    });
    setResult(3, res);
    setLoad(3, false);
  };

  return (
    <div className="rounded-2xl border border-base-300 bg-base-100/80 p-4 shadow-sm">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2 mb-1">
        <h3 className="text-base font-bold text-base-content">{name}</h3>
        <span className={`badge badge-sm ${badgeColor}`}>{badge}</span>
        {docsUrl && (
          <a href={docsUrl} target="_blank" rel="noopener noreferrer" className="link link-hover text-[11px] text-base-content/50 ml-auto">
            API docs ↗
          </a>
        )}
      </div>

      {/* Required env notice */}
      {requiredEnv && requiredEnv.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1">
          {requiredEnv.map(({ key, available, note }) => (
            <span
              key={key}
              className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[10px] ${
                available ? "bg-success/10 text-success" : "bg-error/10 text-error"
              }`}
              title={note}
            >
              {available ? "✓" : "✗"} {key}
            </span>
          ))}
        </div>
      )}

      {/* Session ID indicator */}
      {sessionData?.sessionId && (
        <p className="mb-3 font-mono text-[10px] text-base-content/50">
          session: <span className="text-primary">{sessionData.sessionId}</span>
        </p>
      )}

      {/* 4 Steps */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StepPanel
          stepNum={1}
          label="Setup Agent"
          description={setupDescription ?? "Create persistent agent session with .env.local vars."}
          onRun={handleSetup}
          loading={loading[1]}
          result={results[1]}
        />
        <StepPanel
          stepNum={2}
          label="Calculate 8×9"
          description='Send follow-up message: "calculate 8*9".'
          onRun={handleMessage}
          loading={loading[2]}
          result={results[2]}
          disabled={!sessionData}
        />
        <StepPanel
          stepNum={3}
          label="Fetch Response"
          description={fetchDescription ?? "Poll/fetch the agent's response."}
          onRun={handleFetch}
          loading={loading[3]}
          result={results[3]}
          disabled={!sessionData}
        />
        <ViewSessionPanel sessionData={sessionData} defaultViewUrl={defaultViewUrl} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main cloud agents client
// ---------------------------------------------------------------------------
export default function CloudAgentsClient() {
  const [envStatus, setEnvStatus] = useState(null);

  useEffect(() => {
    let c = false;
    fetch("/api/cloud_agents?action=checkEnv")
      .then((r) => r.json().catch(() => ({})))
      .then((j) => { if (!c) setEnvStatus(j.env || {}); });
    return () => { c = true; };
  }, []);

  const has = (key) => envStatus?.[key] === true;

  const PROVIDERS = [
    {
      id: "cursor",
      name: "Cursor Cloud Agent",
      badge: "cursor.com",
      badgeColor: "badge-neutral",
      docsUrl: "https://cursor.com/docs/cloud-agent/api/endpoints",
      defaultViewUrl: "https://cursor.com",
      setupExtra: {
        cursorRepository: PROVING_GROUNDS_CURSOR_REPOSITORY,
        cursorRef: PROVING_GROUNDS_CURSOR_REF,
      },
      setupDescription:
        "Temporary: targets https://github.com/boster00/GuildOS.git @ main. Install the Cursor GitHub App on that repo.",
      fetchDescription:
        "GET /v0/agents/{id} (status) plus GET …/conversation for chat. JSON includes latestAssistantText.",
      requiredEnv: [
        { key: "CURSOR_API_KEY", available: has("CURSOR_API_KEY"), note: "Cursor Cloud Agent API key from Cursor dashboard." },
      ],
    },
    {
      id: "codex",
      name: "OpenAI Codex (Cloud Delegation)",
      badge: "openai",
      badgeColor: "badge-accent",
      docsUrl: "https://developers.openai.com/codex/ide/features#cloud-delegation",
      defaultViewUrl: "https://platform.openai.com/responses",
      requiredEnv: [
        { key: "OPENAI_API_KEY", available: has("OPENAI_API_KEY"), note: "OpenAI API key" },
      ],
    },
  ];

  return (
    <div className="space-y-4">
      {envStatus === null ? (
        <div className="flex items-center gap-2 text-sm text-base-content/50">
          <span className="loading loading-spinner loading-xs" /> Checking environment…
        </div>
      ) : (
        PROVIDERS.map((p) => <ProviderRow key={p.id} {...p} />)
      )}
    </div>
  );
}

"use client";

import { useState } from "react";

const SETUP_CHECKLIST = [
  {
    id: "ws-relay",
    label: "WS relay server running",
    detail: "Run: npm run dev:browserclaw-ws",
  },
  {
    id: "extension",
    label: "Browserclaw extension loaded",
    detail: "Load unpacked from browserclaw/ in chrome://extensions",
  },
  {
    id: "ws-enabled",
    label: "WebSocket enabled in extension settings",
    detail: 'Set WS URL to ws://localhost:3003 and enable in extension options',
  },
  {
    id: "native-host",
    label: "Native messaging host installed (for Option 2)",
    detail: "Run: browserclaw/native-host/install-windows.bat <extension-id>",
  },
  {
    id: "native-enabled",
    label: "Native messaging enabled in extension settings",
    detail: "Toggle in extension options page",
  },
  {
    id: "cdp",
    label: "Chrome launched with --remote-debugging-port=9222 (for Option 3)",
    detail: 'Close Chrome, relaunch: chrome.exe --remote-debugging-port=9222',
  },
];

function StepTable({ steps }) {
  if (!steps || steps.length === 0) return null;
  return (
    <div className="overflow-x-auto">
      <table className="table table-xs mt-2">
        <thead>
          <tr>
            <th>#</th>
            <th>Action</th>
            <th>Duration</th>
            <th>Status</th>
            <th>Detail</th>
          </tr>
        </thead>
        <tbody>
          {steps.map((s, i) => (
            <tr key={i} className={s.ok ? "" : "text-error"}>
              <td>{s.index}</td>
              <td className="font-mono text-xs">{s.action}</td>
              <td>{s.elapsed}ms</td>
              <td>{s.ok ? "OK" : "FAIL"}</td>
              <td className="max-w-xs truncate text-xs">
                {s.error || (typeof s.value === "object" ? JSON.stringify(s.value) : s.value) || ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MetricsCard({ title, metrics, result, error, loading }) {
  return (
    <div className="card card-border bg-base-200/60">
      <div className="card-body">
        <h3 className="card-title text-lg">{title}</h3>
        {loading && (
          <div className="flex items-center gap-2">
            <span className="loading loading-spinner loading-sm" />
            <span className="text-sm">Running test&hellip; (navigating to Google, searching &ldquo;dog videos&rdquo;)</span>
          </div>
        )}
        {error && (
          <div className="alert alert-error text-sm">
            <span>{error}</span>
          </div>
        )}
        {metrics && (
          <>
            <div className="stats stats-vertical lg:stats-horizontal shadow">
              <div className="stat">
                <div className="stat-title">Connect</div>
                <div className="stat-value text-lg">{metrics.connectMs ?? "—"}ms</div>
              </div>
              <div className="stat">
                <div className="stat-title">Round Trip</div>
                <div className="stat-value text-lg">{metrics.totalRoundTripMs ?? "—"}ms</div>
              </div>
              <div className="stat">
                <div className="stat-title">Extension Exec</div>
                <div className="stat-value text-lg">{metrics.extensionExecMs ?? "—"}ms</div>
              </div>
              <div className="stat">
                <div className="stat-title">Transport Overhead</div>
                <div className="stat-value text-lg">{metrics.transportOverheadMs ?? "—"}ms</div>
              </div>
            </div>
            {result?.steps && <StepTable steps={result.steps} />}
            <details className="collapse collapse-arrow mt-2 bg-base-300/40">
              <summary className="collapse-title text-xs font-medium">Raw JSON</summary>
              <div className="collapse-content">
                <pre className="max-h-60 overflow-auto text-xs">
                  {JSON.stringify({ metrics, result }, null, 2)}
                </pre>
              </div>
            </details>
          </>
        )}
      </div>
    </div>
  );
}

export default function BrowserclawTestClient() {
  const [wsState, setWsState] = useState({ loading: false, metrics: null, result: null, error: null });
  const [nativeState, setNativeState] = useState({ loading: false, metrics: null, result: null, error: null });
  const [cdpState, setCdpState] = useState({ loading: false, metrics: null, result: null, error: null });

  async function runTest(transport) {
    const setter = transport === "ws" ? setWsState : transport === "native" ? setNativeState : setCdpState;
    setter({ loading: true, metrics: null, result: null, error: null });

    try {
      const action = transport === "ws" ? "testBrowserclawWs" : transport === "native" ? "testBrowserclawNative" : "testBrowserclawCdp";
      const res = await fetch("/api/proving_grounds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (data.ok) {
        setter({ loading: false, metrics: data.metrics, result: data.result, error: null });
      } else {
        setter({ loading: false, metrics: data.metrics || null, result: null, error: data.error || "Test failed" });
      }
    } catch (err) {
      setter({ loading: false, metrics: null, result: null, error: err.message });
    }
  }

  return (
    <div className="space-y-6">
      {/* Setup checklist */}
      <div className="collapse collapse-arrow border border-base-300 bg-base-200/40">
        <input type="checkbox" />
        <div className="collapse-title font-medium">Setup Checklist</div>
        <div className="collapse-content">
          <ul className="steps steps-vertical text-sm">
            {SETUP_CHECKLIST.map((item) => (
              <li key={item.id} className="step">
                <div className="text-left">
                  <span className="font-medium">{item.label}</span>
                  <br />
                  <code className="text-xs text-base-content/60">{item.detail}</code>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Test buttons */}
      <div className="flex flex-wrap gap-4">
        <button
          className="btn btn-primary btn-lg"
          disabled={wsState.loading}
          onClick={() => runTest("ws")}
        >
          {wsState.loading ? (
            <span className="loading loading-spinner loading-sm" />
          ) : (
            "Test WebSocket"
          )}
          <span className="badge badge-ghost ml-2">Option 1</span>
        </button>

        <button
          className="btn btn-secondary btn-lg"
          disabled={nativeState.loading}
          onClick={() => runTest("native")}
        >
          {nativeState.loading ? (
            <span className="loading loading-spinner loading-sm" />
          ) : (
            "Test Native Messaging"
          )}
          <span className="badge badge-ghost ml-2">Option 2</span>
        </button>

        <button
          className="btn btn-accent btn-lg"
          disabled={cdpState.loading}
          onClick={() => runTest("cdp")}
        >
          {cdpState.loading ? (
            <span className="loading loading-spinner loading-sm" />
          ) : (
            "Test CDP"
          )}
          <span className="badge badge-ghost ml-2">Option 3</span>
        </button>
      </div>

      {/* Results */}
      <div className="grid gap-4 lg:grid-cols-2">
        {(wsState.metrics || wsState.error || wsState.loading) && (
          <MetricsCard
            title="WebSocket Relay"
            metrics={wsState.metrics}
            result={wsState.result}
            error={wsState.error}
            loading={wsState.loading}
          />
        )}
        {(nativeState.metrics || nativeState.error || nativeState.loading) && (
          <MetricsCard
            title="Native Messaging"
            metrics={nativeState.metrics}
            result={nativeState.result}
            error={nativeState.error}
            loading={nativeState.loading}
          />
        )}
        {(cdpState.metrics || cdpState.error || cdpState.loading) && (
          <MetricsCard
            title="CDP (Chrome DevTools Protocol)"
            metrics={cdpState.metrics}
            result={cdpState.result}
            error={cdpState.error}
            loading={cdpState.loading}
          />
        )}
      </div>

      <p className="text-xs text-base-content/50">
        Results are saved to <code>docs/browserclaw-testing-results.md</code> after each test run.
      </p>
    </div>
  );
}

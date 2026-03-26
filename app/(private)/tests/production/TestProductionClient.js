"use client";

import { useState, useEffect } from "react";

// ─── Badge ────────────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  if (!status || status === "idle") return <span className="text-gray-400 text-sm">— idle</span>;
  const map = {
    PASS: "bg-green-100 text-green-800",
    FAIL: "bg-red-100 text-red-800",
    WARN: "bg-yellow-100 text-yellow-800",
    BLOCKED: "bg-gray-100 text-gray-600",
  };
  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-sm font-medium ${map[status] ?? "bg-gray-100 text-gray-600"}`}>
      {status}
    </span>
  );
}

// ─── Step card ────────────────────────────────────────────────────────────────

function StepCard({ number, title, outside, instructions, expect, stepResult }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 text-left"
      >
        <span className="font-semibold text-gray-800">
          <span className="mr-2 text-gray-400">{number}.</span>{title}
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
              {outside.map((line, i) => <li key={i}>{line}</li>)}
            </ol>
          </div>
          <p className="text-gray-600">
            <span className="font-medium text-gray-700">Then:</span> click{" "}
            <span className="font-medium">Run Full Account Report</span> above.
          </p>
          <div className="rounded bg-gray-50 border border-gray-200 p-3">
            <p className="font-medium text-gray-700 mb-1">Expected results</p>
            <ul className="list-disc list-inside space-y-0.5 text-gray-600">
              {expect.map((line, i) => <li key={i}>{line}</li>)}
            </ul>
          </div>
          {stepResult && stepResult.status !== "idle" && (
            <div className={`rounded border p-3 ${
              stepResult.status === "PASS" ? "bg-green-50 border-green-200" :
              stepResult.status === "FAIL" ? "bg-red-50 border-red-200" :
              stepResult.status === "WARN" ? "bg-yellow-50 border-yellow-200" :
              "bg-gray-50 border-gray-200"
            }`}>
              <p className="font-medium mb-1">
                {stepResult.status === "PASS" ? "✓ Passed" :
                 stepResult.status === "FAIL" ? "✗ Failed" :
                 stepResult.status === "WARN" ? "⚠ Warning" : "⊘ Blocked"}
              </p>
              <ul className="list-disc list-inside space-y-0.5 text-sm">
                {(stepResult.reasons ?? []).map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Expandable JSON ──────────────────────────────────────────────────────────

function JsonViewer({ data, label = "event_data" }) {
  const [open, setOpen] = useState(false);
  if (!data) return <span className="text-gray-400 text-xs">—</span>;
  return (
    <span>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="text-blue-600 hover:underline text-xs"
      >
        {open ? "▼ hide" : "▶ " + label}
      </button>
      {open && (
        <pre className="mt-1 text-xs bg-gray-50 border border-gray-200 rounded p-2 max-h-48 overflow-auto whitespace-pre-wrap break-all">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </span>
  );
}

// ─── Evidence tables ──────────────────────────────────────────────────────────

function ProfileGrid({ profile }) {
  if (!profile) return <p className="text-sm text-gray-500">No profile data.</p>;
  const fields = [
    ["email", profile.email],
    ["subscription_plan", profile.subscription_plan],
    ["credits_remaining", profile.credits_remaining],
    ["credits_reset_at", profile.credits_reset_at ? new Date(profile.credits_reset_at).toLocaleString() : "—"],
    ["payg_wallet", profile.payg_wallet],
    ["stripe_subscription_id", profile.stripe_subscription_id ?? "—"],
    ["stripe_customer_id", profile.stripe_customer_id ?? "—"],
    ["coins_work_order", profile.coins_work_order ? JSON.stringify(profile.coins_work_order) : "—"],
  ];
  return (
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
      {fields.map(([k, v]) => (
        <div key={k} className="flex gap-2">
          <dt className="font-medium text-gray-500 w-44 shrink-0">{k}</dt>
          <dd className="text-gray-800 break-all">{String(v ?? "—")}</dd>
        </div>
      ))}
    </dl>
  );
}

function LedgerTable({ ledger }) {
  if (!ledger?.length) return <p className="text-sm text-gray-500">No ledger entries.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-xs border border-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {["action", "cost", "monthly_bal", "payg_bal", "meta", "created_at"].map((h) => (
              <th key={h} className="px-3 py-2 text-left font-medium text-gray-500 border-b">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ledger.map((row) => (
            <tr key={row.id} className="border-b hover:bg-gray-50">
              <td className="px-3 py-1.5 font-medium">{row.action}</td>
              <td className="px-3 py-1.5">{row.cost}</td>
              <td className="px-3 py-1.5">{row.monthly_balance ?? "—"}</td>
              <td className="px-3 py-1.5">{row.payg_balance ?? "—"}</td>
              <td className="px-3 py-1.5">
                {row.meta ? (
                  row.meta?.proration_math?.formula
                    ? <span title={JSON.stringify(row.meta)} className="text-blue-700 cursor-help">{row.meta.proration_math.formula}</span>
                    : <JsonViewer data={row.meta} label="meta" />
                ) : "—"}
              </td>
              <td className="px-3 py-1.5 whitespace-nowrap">{new Date(row.created_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StripeEventsTable({ events }) {
  if (!events?.length) return <p className="text-sm text-gray-500">No Stripe events (migration may not have run yet, or no events for this account).</p>;
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-xs border border-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {["event_type", "subscription_id", "invoice_id", "customer_id", "livemode", "processed_at", "data"].map((h) => (
              <th key={h} className="px-3 py-2 text-left font-medium text-gray-500 border-b">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {events.map((e) => (
            <tr key={e.event_id} className="border-b hover:bg-gray-50">
              <td className="px-3 py-1.5 font-medium">{e.event_type}</td>
              <td className="px-3 py-1.5 max-w-[120px] truncate" title={e.stripe_subscription_id}>{e.stripe_subscription_id ?? "—"}</td>
              <td className="px-3 py-1.5 max-w-[120px] truncate" title={e.stripe_invoice_id}>{e.stripe_invoice_id ?? "—"}</td>
              <td className="px-3 py-1.5 max-w-[120px] truncate" title={e.stripe_customer_id}>{e.stripe_customer_id ?? "—"}</td>
              <td className="px-3 py-1.5">{e.livemode ? "live" : "test"}</td>
              <td className="px-3 py-1.5 whitespace-nowrap">{e.processed_at ? new Date(e.processed_at).toLocaleString() : "—"}</td>
              <td className="px-3 py-1.5"><JsonViewer data={e.event_data} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CronLogsTable({ cronLogs }) {
  if (!cronLogs?.length) return <p className="text-sm text-gray-500">No cron log entries (migration may not have run yet, or no runs recorded).</p>;
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-xs border border-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {["job_name", "status", "user_scope", "ran_at", "meta"].map((h) => (
              <th key={h} className="px-3 py-2 text-left font-medium text-gray-500 border-b">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cronLogs.map((row) => (
            <tr key={row.id} className="border-b hover:bg-gray-50">
              <td className="px-3 py-1.5 font-medium">{row.job_name}</td>
              <td className="px-3 py-1.5">
                <span className={row.status === "ok" ? "text-green-700" : row.status === "error" ? "text-red-700" : "text-gray-500"}>
                  {row.status}
                </span>
              </td>
              <td className="px-3 py-1.5">{row.user_id ? "account-specific" : "global"}</td>
              <td className="px-3 py-1.5 whitespace-nowrap">{new Date(row.ran_at).toLocaleString()}</td>
              <td className="px-3 py-1.5"><JsonViewer data={row.meta} label="meta" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Legacy checks (kept from original page) ─────────────────────────────────

function ResultBadge({ status = "idle", expected, actual }) {
  if (status === "idle") return <span className="text-gray-500">—</span>;
  if (status === "running") return <span className="text-blue-600">Running…</span>;
  if (status === "pass")
    return <span className="inline-flex items-center rounded bg-green-100 px-2 py-0.5 text-sm text-green-800">Pass</span>;
  return (
    <span className="inline-flex items-center rounded bg-red-100 px-2 py-0.5 text-sm text-red-800">
      Fail {expected != null && actual != null && `(expected ${expected}, got ${actual})`}
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function TestProductionClient() {
  const [env, setEnv] = useState(null);
  const [envError, setEnvError] = useState(null);
  const [report, setReport] = useState(null);
  const [reportError, setReportError] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);

  // Legacy test state
  const [legacyOpen, setLegacyOpen] = useState(false);
  const [legacyResults, setLegacyResults] = useState({});
  const [legacyRunning, setLegacyRunning] = useState(false);

  // Step 2: set credits_reset_at to N minutes from now (workaround for RPC advancing by 1 month)
  const [resetMinutes, setResetMinutes] = useState(10);
  const [setResetLoading, setSetResetLoading] = useState(false);
  const [setResetMessage, setSetResetMessage] = useState(null);

  useEffect(() => {
    fetch("/api/test-production/env", { credentials: "include" })
      .then((r) => {
        if (!r.ok) throw new Error(r.status === 404 ? "Not allowed in this environment" : `HTTP ${r.status}`);
        return r.json();
      })
      .then(setEnv)
      .catch((e) => setEnvError(e.message));
  }, []);

  const runReport = async () => {
    setReportLoading(true);
    setReportError(null);
    try {
      const res = await fetch("/api/test-production/account-report", { credentials: "include" });
      if (!res.ok) {
        const text = await res.text().catch(() => `HTTP ${res.status}`);
        throw new Error(text);
      }
      const data = await res.json();
      setReport(data);
    } catch (e) {
      setReportError(e.message);
    }
    setReportLoading(false);
  };

  const setResetToMinutesFromNow = async () => {
    setSetResetLoading(true);
    setSetResetMessage(null);
    try {
      const res = await fetch("/api/test-production/set-reset-minutes", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minutes: resetMinutes }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setSetResetMessage(`credits_reset_at set to ${resetMinutes} min from now. Run report to verify.`);
      runReport();
    } catch (e) {
      setSetResetMessage(e.message || "Failed");
    }
    setSetResetLoading(false);
  };

  // ── Overall summary ──────────────────────────────────────────────────────
  const stepEntries = report?.steps ? Object.entries(report.steps) : [];
  const passCount = stepEntries.filter(([, s]) => s.status === "PASS").length;
  const failCount = stepEntries.filter(([, s]) => s.status === "FAIL").length;
  const warnCount = stepEntries.filter(([, s]) => s.status === "WARN").length;
  const overallStatus = failCount > 0 ? "FAIL" : warnCount > 0 ? "WARN" : passCount === 7 ? "PASS" : null;

  // ── Legacy helpers ───────────────────────────────────────────────────────
  const setLegacyResult = (id, status, expected = null, actual = null) =>
    setLegacyResults((p) => ({ ...p, [id]: { status, expected, actual } }));

  const legacyRunOne = async (id, method, url, options = {}, expectedStatuses) => {
    const allowed = Array.isArray(expectedStatuses) ? expectedStatuses : [expectedStatuses];
    setLegacyResult(id, "running");
    try {
      const res = await fetch(url, { method, credentials: "include", ...options });
      const pass = allowed.includes(res.status);
      setLegacyResult(id, pass ? "pass" : "fail", allowed.join(" or "), res.status);
    } catch (e) {
      setLegacyResult(id, "fail", allowed.join(" or "), "error");
    }
  };

  const runLegacyEnvProd = async () => {
    setLegacyRunning(true);
    const base = { headers: { "Content-Type": "application/json" } };
    await legacyRunOne("sandbox-subscribe", "POST", "/api/billing/sandbox-subscribe", { ...base, body: "{}" }, [403, 404]);
    await legacyRunOne("sandbox-cancel", "POST", "/api/billing/sandbox-cancel", base, [403, 404]);
    await legacyRunOne("test-stripe-check-account", "GET", "/api/test-stripe/check-account", {}, [403, 404]);
    await legacyRunOne("test-stripe-ping", "POST", "/api/test-stripe/ping-webhook", base, [403, 404]);
    await legacyRunOne("simulate-webhook", "GET", "/api/test/simulate-webhook", {}, [403, 404]);
    setLegacyRunning(false);
  };

  const runLegacyEnvNonProd = async () => {
    setLegacyRunning(true);
    await legacyRunOne("sandbox-mode", "GET", "/api/billing/sandbox-mode", {}, 200);
    await legacyRunOne("test-allowed", "GET", "/api/test/allowed", {}, [200, 403]);
    setLegacyRunning(false);
  };

  const runLegacyCheckoutFake = async () => {
    setLegacyRunning(true);
    setLegacyResult("checkout-fake", "running");
    try {
      const res = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId: "price_fake_xxx", mode: "subscription", successUrl: window.location.origin + "/billing", cancelUrl: window.location.origin + "/billing" }),
      });
      const pass = res.status === 400 || res.status === 500;
      setLegacyResult("checkout-fake", pass ? "pass" : "fail", "400 or 500", res.status);
    } catch {
      setLegacyResult("checkout-fake", "fail", "400 or 500", "error");
    }
    setLegacyRunning(false);
  };

  if (envError) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Test Production</h1>
        <p className="text-red-600">Cannot load: {envError}</p>
      </div>
    );
  }
  if (!env) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Test Production</h1>
        <p className="text-gray-600">Loading environment…</p>
      </div>
    );
  }

  const steps = report?.steps ?? {};

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Guided Account Test</h1>

      {/* ── Environment banner ── */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm space-y-1">
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-gray-700">
          <span><span className="font-medium">env:</span> {env.nodeEnv} / {env.vercelEnv ?? "local"}</span>
          <span><span className="font-medium">isProduction:</span> {String(env.isProduction)}</span>
          {report?.profile && (
            <>
              <span><span className="font-medium">user:</span> {report.profile.email}</span>
              <span><span className="font-medium">plan:</span> {report.profile.subscription_plan ?? "free"}</span>
            </>
          )}
        </div>
        {env.isProduction && (
          <p className="text-amber-700 text-xs mt-1">
            ⚠ Production environment — safety tests will check for live Stripe key.
          </p>
        )}
      </div>

      {/* ── Primary CTA ── */}
      <div className="flex items-center gap-4 flex-wrap">
        <button
          type="button"
          onClick={runReport}
          disabled={reportLoading}
          className="px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {reportLoading ? "Loading…" : "Run Full Account Report"}
        </button>
        {report?.snapshot_fetched_at && (
          <span className="text-sm text-gray-500">
            Snapshot fetched at {new Date(report.snapshot_fetched_at).toLocaleString()}
          </span>
        )}
      </div>
      {report && (
        <p className="text-xs text-gray-500">
          ⚠ Webhook and cron events may lag 30–60 s. Re-run the report if you expect new entries.
        </p>
      )}
      {reportError && (
        <p className="text-sm text-red-600">Report error: {reportError}</p>
      )}

      {/* ── Overall summary ── */}
      {report && overallStatus && (
        <div className={`rounded-lg border p-4 ${
          overallStatus === "PASS" ? "bg-green-50 border-green-200" :
          overallStatus === "FAIL" ? "bg-red-50 border-red-200" :
          "bg-yellow-50 border-yellow-200"
        }`}>
          <div className="flex items-center gap-3 flex-wrap">
            <StatusBadge status={overallStatus} />
            <span className="text-sm font-medium">
              {passCount} passed · {failCount} failed · {warnCount} warnings
            </span>
          </div>
          {failCount > 0 && (
            <ul className="mt-2 text-sm list-disc list-inside space-y-0.5">
              {stepEntries.filter(([, s]) => s.status === "FAIL").map(([k, s]) => (
                <li key={k}><span className="font-medium">{k}:</span> {s.reasons?.[0]}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ── Step cards ── */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Test Steps</h2>

        <StepCard
          number={1}
          title="Register Free Account"
          outside={[
            "Register a new account at /auth/signup",
            "Log in as the new account, then return here",
          ]}
          expect={[
            "credits_remaining = 50",
            "Ledger: signup_bonus row, cost = −50",
          ]}
          stepResult={steps.step1}
        />
        <StepCard
          number={2}
          title="Subscribe to Test Plan ($1/month)"
          outside={[
            "Go to /billing/subscriptions",
            "Click the button under Test ($1/month) to open Stripe Checkout",
            "Complete Stripe Checkout with your real payment card",
            "You will be redirected back to the success URL",
          ]}
          expect={[
            "subscription_plan = test",
            "stripe_subscription_id set",
            "credits_reset_at ≈ 10 min from now (test plan uses short reset cycle)",
            "Ledger: subscription row with meta.proration_math.formula",
            "Events: checkout.session.completed + customer.subscription.updated + invoice.paid",
          ]}
          stepResult={steps.step2}
        />
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
          <p className="font-medium text-amber-900 mb-2">Set reset time (for testing)</p>
          <p className="text-amber-800 mb-2">
            After a cron reset, the RPC advances credits_reset_at by 1 month. To test another reset cycle without waiting, set it manually:
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="number"
              min={1}
              max={44640}
              value={resetMinutes}
              onChange={(e) => setResetMinutes(Number(e.target.value) || 10)}
              className="w-20 px-2 py-1 border border-gray-300 rounded text-gray-800"
            />
            <span className="text-amber-800">minutes from now</span>
            <button
              type="button"
              onClick={setResetToMinutesFromNow}
              disabled={setResetLoading}
              className="px-3 py-1.5 bg-amber-600 text-white rounded font-medium hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {setResetLoading ? "Setting…" : "Set reset time"}
            </button>
            {setResetMessage && (
              <span className={setResetMessage.startsWith("credits_reset_at") ? "text-green-700" : "text-red-600"}>
                {setResetMessage}
              </span>
            )}
          </div>
        </div>
        <StepCard
          number={3}
          title="Upgrade to Test2 ($2/month)"
          outside={[
            "Go to /billing/subscriptions → click the Test2 upgrade button (redirects to Stripe Checkout)",
            "Stripe will charge a prorated amount",
          ]}
          expect={[
            "subscription_plan = test2",
            "Ledger: subscription_upgrade_prorated row with proration formula",
            "Events: customer.subscription.updated + invoice.paid (billing_reason=subscription_update)",
          ]}
          stepResult={steps.step3}
        />
        <StepCard
          number={4}
          title="Wait for Cron Reset (~10 minutes)"
          outside={[
            "Wait approximately 10 minutes after subscribing",
            "The credit reset job runs on a short cycle for test/test2 plans",
            "You can re-run the report to check a second reset cycle",
          ]}
          expect={[
            "credits_remaining = 1000 (test2 quota) or 500 (test quota)",
            "credits_reset_at ≈ 10 min from now (advanced again)",
            "Ledger: monthly_expire → monthly_grant, cost = −quota",
            "Cron log: credit_reset job entry present",
          ]}
          stepResult={steps.step4}
        />
        <StepCard
          number={5}
          title="Downgrade Test2 → Test"
          outside={[
            "Go to /billing/subscriptions → click the Test upgrade button (redirects to Stripe Checkout)",
          ]}
          expect={[
            "Immediately after: coins_work_order shows pending downgrade (WARN — not yet applied)",
            "After next cron reset: subscription_plan = test (PASS)",
            "Events: customer.subscription.updated",
          ]}
          stepResult={steps.step5}
        />
        <StepCard
          number={6}
          title="Buy PAYG Credits — 1 credit ($0.50)"
          outside={[
            "Ensure you are on the test or test2 plan (otherwise BLOCKED)",
            "Go to /billing/subscriptions",
            'Click "1 credit — $0.50 (Test pack)"',
            "Complete Stripe Checkout (mode=payment, not subscription)",
          ]}
          expect={[
            "payg_wallet ≥ 1",
            "Ledger: payg_purchase row, cost = −1",
            "Events: checkout.session.completed with mode=payment and metadata.credits=1",
          ]}
          stepResult={steps.step6}
        />
        <StepCard
          number={7}
          title="Downgrade Test to Free"
          outside={[
            "Go to /billing/subscriptions",
            'Under the Free plan column, click "Downgrade to Free"',
            "Confirm in the modal (subscription cancels at period end)",
          ]}
          expect={[
            "Immediately after: coins_work_order shows pending downgrade to free (WARN — not yet applied)",
            "After period end: subscription_plan = free, stripe_subscription_id cleared",
            "Events: customer.subscription.deleted when subscription ends",
          ]}
          stepResult={steps.step7}
        />
      </div>

      {/* ── Evidence tables ── */}
      {report && (
        <div className="space-y-6">
          <h2 className="text-lg font-semibold border-t pt-4">Evidence</h2>

          <section>
            <h3 className="font-medium text-gray-700 mb-2">Account Snapshot</h3>
            <ProfileGrid profile={report.profile} />
          </section>

          <section>
            <h3 className="font-medium text-gray-700 mb-2">Recent Ledger Entries ({report.ledger?.length ?? 0})</h3>
            <LedgerTable ledger={report.ledger} />
          </section>

          <section>
            <h3 className="font-medium text-gray-700 mb-2">Recent Stripe Events ({report.stripeEvents?.length ?? 0})</h3>
            <StripeEventsTable events={report.stripeEvents} />
          </section>

          <section>
            <h3 className="font-medium text-gray-700 mb-2">Recent Cron Logs ({report.cronLogs?.length ?? 0})</h3>
            <CronLogsTable cronLogs={report.cronLogs} />
          </section>

          {/* Checkout safety inline */}
          {report.checkoutSafety && (
            <section>
              <h3 className="font-medium text-gray-700 mb-2">Checkout Safety Probe</h3>
              <div className={`rounded border p-3 text-sm ${
                report.checkoutSafety.blocked && !report.checkoutSafety.hasSandboxPrices
                  ? "bg-green-50 border-green-200"
                  : report.checkoutSafety.blocked
                  ? "bg-yellow-50 border-yellow-200"
                  : "bg-red-50 border-red-200"
              }`}>
                <p>
                  <span className="font-medium">blocked:</span>{" "}
                  {String(report.checkoutSafety.blocked)}{" "}
                  — {report.checkoutSafety.keyReason}
                </p>
                <p>
                  <span className="font-medium">hasSandboxPrices:</span>{" "}
                  {String(report.checkoutSafety.hasSandboxPrices)}
                  {report.checkoutSafety.hasSandboxPrices && (
                    <span className="text-amber-700 ml-2">⚠ Sandbox price env vars are set — OK in dev, not in prod</span>
                  )}
                </p>
              </div>
            </section>
          )}
        </div>
      )}

      {/* ── Legacy checks (collapsible) ── */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <button
          type="button"
          onClick={() => setLegacyOpen((o) => !o)}
          className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 text-left"
        >
          <span className="font-medium text-gray-700">Legacy Automated Checks</span>
          <span className="text-gray-400 text-xs">{legacyOpen ? "▲" : "▼"}</span>
        </button>
        {legacyOpen && (
          <div className="px-4 py-4 space-y-4">
            {env.isProduction ? (
              <section>
                <h3 className="font-medium mb-2">Environment enforcement (production)</h3>
                <p className="text-sm text-gray-600 mb-2">Dev-only API routes must return 403 or 404.</p>
                <div className="space-y-1 text-sm">
                  {[
                    ["sandbox-subscribe", "POST /api/billing/sandbox-subscribe"],
                    ["sandbox-cancel", "POST /api/billing/sandbox-cancel"],
                    ["test-stripe-check-account", "GET /api/test-stripe/check-account"],
                    ["test-stripe-ping", "POST /api/test-stripe/ping-webhook"],
                    ["simulate-webhook", "GET /api/test/simulate-webhook"],
                  ].map(([id, label]) => (
                    <div key={id} className="flex items-center gap-3">
                      <span className="w-64">{label}</span>
                      <ResultBadge {...(legacyResults[id] ?? {})} />
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={runLegacyEnvProd}
                  disabled={legacyRunning}
                  className="mt-3 px-3 py-1.5 text-sm bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50"
                >
                  Run env checks
                </button>
              </section>
            ) : (
              <section>
                <h3 className="font-medium mb-2">Environment enforcement (non-production)</h3>
                <div className="space-y-1 text-sm">
                  {[
                    ["sandbox-mode", "GET /api/billing/sandbox-mode"],
                    ["test-allowed", "GET /api/test/allowed"],
                  ].map(([id, label]) => (
                    <div key={id} className="flex items-center gap-3">
                      <span className="w-48">{label}</span>
                      <ResultBadge {...(legacyResults[id] ?? {})} />
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={runLegacyEnvNonProd}
                  disabled={legacyRunning}
                  className="mt-3 px-3 py-1.5 text-sm bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50"
                >
                  Run env checks
                </button>
              </section>
            )}

            <section>
              <h3 className="font-medium mb-2">Fake price ID rejection</h3>
              <div className="flex items-center gap-3 text-sm">
                <span>Fake price → 400 or 500</span>
                <ResultBadge {...(legacyResults["checkout-fake"] ?? {})} />
              </div>
              <button
                type="button"
                onClick={runLegacyCheckoutFake}
                disabled={legacyRunning}
                className="mt-3 px-3 py-1.5 text-sm bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50"
              >
                Run check
              </button>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

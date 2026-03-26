"use client";

import React, { useState, useCallback } from "react";
import { Play, ChevronDown, ChevronUp, CheckCircle, XCircle, ArrowRight } from "lucide-react";
import { initMonkey } from "@/libs/monkey";

const FEATURE_CATALOG = [
  // Category 1: Core Quota Enforcement
  { id: "1.1", category: "Core Quota", name: "Basic Quota Check - Below Limit", description: "User with 50/100 credits used makes a 5-credit API call. Should succeed.", demoInputs: { userId: "", credits: 5 }, expectedResult: { allowed: true }, executionFlow: "Route -> monkey._checkQuota() -> read('profiles') -> registry getTierById -> read('user_credits')", testApi: "test-quota" },
  { id: "1.2", category: "Core Quota", name: "Quota Exceeded - Hard Block", description: "User with 98/100 credits tries 15-credit call (113 total, beyond 10% grace). Should fail.", demoInputs: { userId: "", credits: 15 }, expectedResult: { allowed: false, reason: "Grace period exceeded" }, executionFlow: "Route -> monkey._checkQuota() -> projected > quota*1.1 -> returns allowed: false", testApi: "test-quota" },
  { id: "1.3", category: "Core Quota", name: "Grace Period - 10% Overage", description: "User with 105/100 credits (within 10% grace) tries 2-credit call. Should succeed with warning.", demoInputs: { userId: "", credits: 2 }, expectedResult: { allowed: true, inGracePeriod: true }, executionFlow: "_checkQuota() allows quota * 1.10", testApi: "test-quota" },
  { id: "1.4", category: "Core Quota", name: "Grace Period Exceeded", description: "User with 112/100 credits (beyond 10% grace) tries call. Should hard block.", demoInputs: { userId: "", credits: 2 }, expectedResult: { allowed: false, reason: "Grace period exceeded" }, executionFlow: "_checkQuota() blocks when projected > quota * 1.10", testApi: "test-quota" },
  { id: "1.5", category: "Core Quota", name: "Unlimited Tier (Pro)", description: "Pro user with 5000 credits used. Should always pass quota check.", demoInputs: { userId: "", credits: 100 }, expectedResult: { allowed: true }, executionFlow: "tier.monthly_credit_quota === 0 -> return allowed: true", testApi: "test-quota" },
  { id: "1.6", category: "Core Quota", name: "Override Quota Flag", description: "User with quota exceeded but override_quota=true. Should pass.", demoInputs: { userId: "", credits: 5 }, expectedResult: { allowed: true }, executionFlow: "profile.override_quota -> return allowed: true", testApi: "test-quota" },
  { id: "1.7", category: "Core Quota", name: "Monthly Reset Logic", description: "User with 95/100 credits, reset date passed. Should reset to 0/100 and allow call.", demoInputs: { userId: "", credits: 5 }, expectedResult: { allowed: true }, executionFlow: "_checkQuota() -> reset monthly_credits_used if past reset_at", testApi: "test-quota" },
  // Category 2: Credit Calculation & Logging
  { id: "2.1", category: "Credit Calc", name: "Dictionary-Based Credit Lookup", description: "Each action has fixed credit cost from config. AI_TEXT_SHORT = 1 credit.", demoInputs: { actionType: "AI_TEXT_SHORT" }, expectedResult: { credits: "number" }, executionFlow: "CREDIT_COSTS[actionType] or calculateCredits with useDictionary", testApi: "estimate" },
  { id: "2.2", category: "Credit Calc", name: "Log API Usage to DB", description: "Usage is recorded in credit_ledger via meterSpend; logUsage is a no-op.", demoInputs: { credits: 0.5, apiProvider: "openai" }, expectedResult: { logged: true }, executionFlow: "meterSpend -> credit_ledger; logUsage no-op (api_usage_logs removed)", testApi: "test-log" },
  { id: "2.3", category: "Credit Calc", name: "Deduct Credits After Success", description: "User makes credit call. monthly_credits_used should increment.", demoInputs: { credits: 1 }, expectedResult: { incremented: true }, executionFlow: "monkey._deductCredits() -> update user_credits", testApi: "test-deduct" },
  { id: "2.4", category: "Credit Calc", name: "No Deduction on Failure", description: "API call fails. Credits should NOT be deducted.", demoInputs: {}, expectedResult: { monthly_credits_used: "unchanged" }, executionFlow: "Deduct only AFTER success; catch block skips _deductCredits", testApi: null },
  { id: "2.5", category: "Credit Calc", name: "Credit Cost Override", description: "Admin adjusts credit cost in config. Next call uses new cost.", demoInputs: {}, expectedResult: { credits: "from config" }, executionFlow: "CREDIT_COSTS in config/creditPricing.js", testApi: null },
  { id: "2.6", category: "Credit Calc", name: "Concurrent Request Handling", description: "5 requests at once, 60 quota. Some should fail.", demoInputs: {}, expectedResult: { totalDeducted: "<=", quota: 60 }, executionFlow: "DB transaction or optimistic locking", testApi: null },
  { id: "2.7", category: "Credit Calc", name: "Request Idempotency", description: "Same request_id sent twice. Should only log once.", demoInputs: { requestId: "test-123" }, expectedResult: { logCount: 1 }, executionFlow: "ON CONFLICT (request_id) DO NOTHING", testApi: null },
  { id: "2.8", category: "Credit Calc", name: "Async Job Metering", description: "Background job (outline generation) still counts toward quota.", demoInputs: {}, expectedResult: { creditsDeducted: true }, executionFlow: "processOutlineGeneration passes userId to monkey.v0Generate", testApi: null },
  // Category 3: User Experience
  { id: "3.1", category: "UX", name: "Navbar Credit Meter", description: "Top nav shows 47/100 credits always visible.", demoInputs: {}, expectedResult: { creditsUsed: "number", creditsQuota: "number|null" }, executionFlow: "GET /api/usage/me on layout mount", testApi: "usage-me" },
  { id: "3.2", category: "UX", name: "Warning Toast at 80%", description: "When user crosses 80% threshold, show toast.", demoInputs: {}, expectedResult: { toast: "80% quota used" }, executionFlow: "creditsUsed/creditsQuota >= 0.8 -> toast", testApi: null },
  { id: "3.3", category: "UX", name: "Warning Toast at 90%", description: "At 90% usage, show urgent warning toast.", demoInputs: {}, expectedResult: { toast: "90% quota used" }, executionFlow: "creditsUsed/creditsQuota >= 0.9 -> toast", testApi: null },
  { id: "3.4", category: "UX", name: "Pre-Action Cost Estimate", description: "Before expensive operation, show This will use ~5 credits.", demoInputs: { actionType: "V0_OUTLINE" }, expectedResult: { credits: "number" }, executionFlow: "POST /api/metering-rollout/estimate", testApi: "estimate" },
  { id: "3.5", category: "UX", name: "Usage History Page", description: "Detailed breakdown of past 50 API calls with filters.", demoInputs: {}, expectedResult: { logs: "array" }, executionFlow: "GET /api/usage/logs?limit=50", testApi: "usage-logs" },
  { id: "3.6", category: "UX", name: "Upgrade Prompt on Block", description: "When 429, show modal with plan comparison and upgrade CTA.", demoInputs: {}, expectedResult: { modal: "shown", upgrade_url: "/billing" }, executionFlow: "Detect 429 in API client -> show modal", testApi: null },
  // Category 4: Notifications
  { id: "4.1", category: "Alerts", name: "Email Alert at 80%", description: "Send email when user crosses 80% threshold.", demoInputs: {}, expectedResult: { emailSent: true }, executionFlow: "_deductCredits -> if newUsage/quota>=0.8 -> send email", testApi: null },
  { id: "4.2", category: "Alerts", name: "Email Alert at 100%", description: "Send urgent email when quota fully consumed.", demoInputs: {}, expectedResult: { emailSent: true }, executionFlow: "threshold 1.0 -> send email", testApi: null },
  { id: "4.3", category: "Alerts", name: "In-App Notification Center", description: "Bell icon with unread count, dropdown shows notifications.", demoInputs: {}, expectedResult: { notifications: "list" }, executionFlow: "notifications table -> navbar component", testApi: null },
  { id: "4.4", category: "Alerts", name: "Slack Alert for Admin", description: "When user hits quota, notify Slack channel.", demoInputs: {}, expectedResult: { slackMessage: true }, executionFlow: "_deductCredits when quota hit -> POST Slack webhook", testApi: null },
  { id: "4.5", category: "Alerts", name: "Slack Alert for Revenue Leakage", description: "Daily cron: free users using > 50 credits in 7 days.", demoInputs: {}, expectedResult: { cronAlert: true }, executionFlow: "Cron -> query credit_ledger (debits) -> Slack", testApi: null },
  // Category 5: Billing
  { id: "5.1", category: "Billing", name: "Stripe Checkout with Tier", description: "Upgrade to Starter, webhook sets tier.", demoInputs: {}, expectedResult: { tier: "starter" }, executionFlow: "POST /api/stripe/create-checkout -> webhook", testApi: null },
  { id: "5.2", category: "Billing", name: "Stripe Portal Management", description: "Manage subscription, cancel -> tier free.", demoInputs: {}, expectedResult: { portalOpens: true }, executionFlow: "POST /api/stripe/create-portal", testApi: null },
  { id: "5.3", category: "Billing", name: "Free Trial Expiration (14 days)", description: "After 14 days, free user loses access.", demoInputs: { credits: 5 }, expectedResult: { allowed: false, reason: "Free trial expired" }, executionFlow: "_checkQuota -> trial_ends_at check", testApi: "test-quota" },
  { id: "5.4", category: "Billing", name: "Grace Period with Soft Block", description: "User at 105/100 sees warning but can use. At 111 hard block.", demoInputs: {}, expectedResult: { inGracePeriod: true }, executionFlow: "_checkQuota allows quota*1.1", testApi: null },
  // Category 6: Admin
  { id: "6.1", category: "Admin", name: "Admin Dashboard - User List", description: "All users with current month credit usage.", demoInputs: {}, expectedResult: { table: "users" }, executionFlow: "Query profiles + user_credits", testApi: null },
  { id: "6.2", category: "Admin", name: "Admin Dashboard - Cost vs Revenue", description: "Total API costs vs subscription revenue this month.", demoInputs: {}, expectedResult: { cost: "number", revenue: "number" }, executionFlow: "SUM credit_ledger cost (debits) or meta.cost_usd", testApi: null },
  { id: "6.3", category: "Admin", name: "Heavy User Detection", description: "Flag users > 95th percentile of tier quota.", demoInputs: {}, expectedResult: { flagged: "list" }, executionFlow: "usage/quota > 0.95 -> flag", testApi: null },
  { id: "6.4", category: "Admin", name: "Feature Cost Breakdown", description: "Chart: AI text vs images vs search costs.", demoInputs: {}, expectedResult: { chart: "by api_type" }, executionFlow: "GROUP BY api_type SUM(cost_usd)", testApi: null },
  { id: "6.5", category: "Admin", name: "Cost Projection", description: "At current rate, user will use X credits this month.", demoInputs: {}, expectedResult: { projected: "number" }, executionFlow: "(used/daysElapsed)*daysInMonth", testApi: null },
  { id: "6.6", category: "Admin", name: "Manual Credit Add (Admin UI)", description: "Admin adds 500 credits to user.", demoInputs: { userId: "", amount: 100 }, expectedResult: { credit_balance: "increased" }, executionFlow: "POST /api/admin/credits/adjust", testApi: null },
  { id: "6.7", category: "Admin", name: "Revenue Leakage Report", description: "Free users using > 90% of quota.", demoInputs: {}, expectedResult: { candidates: "list" }, executionFlow: "monthly_credits_used > quota*0.9", testApi: null },
  // Category 7: Technical
  { id: "7.1", category: "Technical", name: "API Response Headers", description: "X-Credits-Used, X-Credits-Remaining, X-Quota-Reset.", demoInputs: {}, expectedResult: { headers: "present" }, executionFlow: "NextResponse.json(..., { headers })", testApi: null },
  { id: "7.2", category: "Technical", name: "Idempotent Request Deduplication", description: "Same request_id twice = single log entry.", demoInputs: {}, expectedResult: { logCount: 1 }, executionFlow: "ON CONFLICT (request_id) DO NOTHING", testApi: null },
  { id: "7.3", category: "Technical", name: "Background Job Metering", description: "Async outline generation counts toward quota.", demoInputs: {}, expectedResult: { creditsDeducted: true }, executionFlow: "userId passed to v0Generate in processOutlineGeneration", testApi: null },
  { id: "7.4", category: "Technical", name: "Rate Limiting", description: "Block > 60 requests/min (abuse prevention).", demoInputs: {}, expectedResult: { status: 429, "Retry-After": "header" }, executionFlow: "rate_limit_cache check", testApi: null },
  { id: "7.5", category: "Technical", name: "Database Unavailable - Fail Closed", description: "DB down -> 503 Service temporarily unavailable.", demoInputs: {}, expectedResult: { status: 503 }, executionFlow: "_checkQuota catch -> return 503", testApi: null },
  { id: "7.6", category: "Technical", name: "Credit Refund on API Failure", description: "OpenAI 500 error -> refund deducted credits.", demoInputs: {}, expectedResult: { creditsRestored: true }, executionFlow: "catch -> _refundCredits()", testApi: null },
  // Category 8: Multi-Tenant
  { id: "8.1", category: "Teams", name: "Organization Shared Credits", description: "Team of 3 shares 5000-credit monthly pool.", demoInputs: {}, expectedResult: { orgCredits: "shared" }, executionFlow: "_checkQuota checks org_credits", testApi: null },
  { id: "8.2", category: "Teams", name: "Per-User Usage in Team", description: "Admin sees which member used how many org credits.", demoInputs: {}, expectedResult: { breakdown: "per user" }, executionFlow: "credit_ledger by user_id / organization_id", testApi: null },
  { id: "8.3", category: "Teams", name: "Team Credit Allocation", description: "Org admin allocates 1000 to User A, 500 to User B.", demoInputs: {}, expectedResult: { allocation: "enforced" }, executionFlow: "user_credit_allocation table", testApi: null },
  // Category 9: Edge Cases
  { id: "9.1", category: "Edge", name: "Negative Credit Balance Protection", description: "Credits can never go negative.", demoInputs: {}, expectedResult: { minBalance: 0 }, executionFlow: "GREATEST(0, monthly_credits_used + credits)", testApi: null },
  { id: "9.2", category: "Edge", name: "Quota Reset During Request", description: "User at 99/100, month resets mid-request. Should succeed.", demoInputs: {}, expectedResult: { allowed: true }, executionFlow: "Reset triggers on _checkQuota", testApi: null },
  { id: "9.3", category: "Edge", name: "Tier Downgrade Mid-Month", description: "Pro downgrades to Starter, already used 1500. Block?", demoInputs: {}, expectedResult: { allowed: false }, executionFlow: "_checkQuota blocks when over new quota", testApi: null },
  { id: "9.4", category: "Edge", name: "Free Trial Expiration Warning", description: "3 days before trial ends, show countdown banner.", demoInputs: {}, expectedResult: { banner: "Trial ends in 2 days" }, executionFlow: "daysRemaining < 3 -> banner", testApi: null },
  { id: "9.5", category: "Edge", name: "Deleted User Cleanup", description: "User deleted -> cascade delete usage logs and credits.", demoInputs: {}, expectedResult: { cascadeDelete: true }, executionFlow: "ON DELETE CASCADE", testApi: null },
  // Category 10: Monitoring
  { id: "10.1", category: "Monitoring", name: "Real-Time Usage Dashboard", description: "Admin sees live chart credits/hour last 24h.", demoInputs: {}, expectedResult: { chart: "credits/hour" }, executionFlow: "GROUP BY hour credit_ledger (debits)", testApi: null },
  { id: "10.2", category: "Monitoring", name: "Alert on Anomalous Usage", description: "User uses 500 credits in 1 hour -> alert admin.", demoInputs: {}, expectedResult: { alert: true }, executionFlow: "Cron -> lastHour > 10x average -> Slack", testApi: null },
  { id: "10.3", category: "Monitoring", name: "Cost Per User Report", description: "Export CSV: user_id, email, tier, cost_usd.", demoInputs: {}, expectedResult: { csv: "download" }, executionFlow: "GET /api/admin/reports/cost-per-user", testApi: null },
  { id: "10.4", category: "Monitoring", name: "Health Check Endpoint", description: "/api/healthz/metering checks quota system.", demoInputs: {}, expectedResult: { ok: true }, executionFlow: "GET /api/healthz/metering -> registry tiers, user_credits, _checkQuota", testApi: "healthz-metering" },
];

export default function MeteringRolloutPage() {
  const [activeTab, setActiveTab] = useState("TODO");
  const [finishedIds, setFinishedIds] = useState(new Set());
  const [results, setResults] = useState({});
  const [loading, setLoading] = useState({});
  const [expanded, setExpanded] = useState({});
  const [demoInputs, setDemoInputs] = useState(() => {
    const init = {};
    FEATURE_CATALOG.forEach((f) => {
      init[f.id] = { ...f.demoInputs };
    });
    return init;
  });

  const todoFeatures = FEATURE_CATALOG.filter((f) => !finishedIds.has(f.id));
  const finishedFeatures = FEATURE_CATALOG.filter((f) => finishedIds.has(f.id));

  const runTest = useCallback(async (feature) => {
    setLoading((prev) => ({ ...prev, [feature.id]: true }));
    setResults((prev) => ({ ...prev, [feature.id]: null }));

    try {
      const inputs = demoInputs[feature.id] || feature.demoInputs;

      if (feature.testApi === "test-quota") {
        const monkey = await initMonkey();
        const text = await monkey.apiCall("/api/metering-rollout/test-quota", {
          userId: inputs.userId || undefined,
          credits: inputs.credits ?? 5,
        });
        const data = JSON.parse(text);
        const expectedAllowed = feature.expectedResult?.allowed;
        const actualAllowed = data.result?.allowed;
        let pass = actualAllowed === expectedAllowed;
        if (expectedAllowed === true && feature.expectedResult?.inGracePeriod) {
          pass = pass && data.result?.inGracePeriod === true;
        }
        setResults((prev) => ({
          ...prev,
          [feature.id]: {
            actual: data.result,
            raw: data,
            pass,
            executionFlow: data.executionFlow || feature.executionFlow,
          },
        }));
      } else if (feature.testApi === "test-log") {
        const monkey = await initMonkey();
        const text = await monkey.apiCall("/api/metering-rollout/test-log", {
          credits: inputs.credits ?? 0.5,
          apiProvider: inputs.apiProvider ?? "openai",
        });
        const data = JSON.parse(text);
        const pass = data.result?.logged === true && data.result?.logEntry;
        setResults((prev) => ({
          ...prev,
          [feature.id]: { actual: data.result, raw: data, pass, executionFlow: data.executionFlow || feature.executionFlow },
        }));
      } else if (feature.testApi === "test-deduct") {
        const monkey = await initMonkey();
        const text = await monkey.apiCall("/api/metering-rollout/test-deduct", { credits: inputs.credits ?? 1 });
        const data = JSON.parse(text);
        const pass = data.result?.incremented === true;
        setResults((prev) => ({
          ...prev,
          [feature.id]: { actual: data.result, raw: data, pass, executionFlow: data.executionFlow || feature.executionFlow },
        }));
      } else if (feature.testApi === "usage-me") {
        const monkey = await initMonkey();
        const text = await monkey.apiGet("/api/usage/me");
        const data = JSON.parse(text);
        const pass = typeof data.creditsUsed === "number" && (data.creditsQuota === null || typeof data.creditsQuota === "number");
        setResults((prev) => ({
          ...prev,
          [feature.id]: {
            actual: { creditsUsed: data.creditsUsed, creditsQuota: data.creditsQuota, tierId: data.tierId },
            raw: data,
            pass,
            executionFlow: "GET /api/usage/me -> returns { creditsUsed, creditsQuota, tierId }",
          },
        }));
      } else if (feature.testApi === "usage-logs") {
        const monkey = await initMonkey();
        const text = await monkey.apiGet("/api/usage/logs?limit=50");
        const data = JSON.parse(text);
        const pass = Array.isArray(data.logs);
        setResults((prev) => ({
          ...prev,
          [feature.id]: {
            actual: { logsCount: data.logs?.length ?? 0 },
            raw: data,
            pass,
            executionFlow: "GET /api/usage/logs?limit=50 -> returns { logs }",
          },
        }));
      } else if (feature.testApi === "healthz-metering") {
        const monkey = await initMonkey();
        const text = await monkey.apiGet("/api/healthz/metering");
        const data = JSON.parse(text);
        const pass = data.ok === true;
        setResults((prev) => ({
          ...prev,
          [feature.id]: { actual: data, raw: data, pass, executionFlow: "GET /api/healthz/metering -> verify DB and _checkQuota", },
        }));
      } else if (feature.testApi === "estimate") {
        const monkey = await initMonkey();
        const text = await monkey.apiCall("/api/metering-rollout/estimate", {
          actionType: inputs.actionType || "AI_TEXT_SHORT",
          params: inputs.params || {},
        });
        const data = JSON.parse(text);
        const pass = typeof data.credits === "number";
        setResults((prev) => ({
          ...prev,
          [feature.id]: {
            actual: { credits: data.credits },
            raw: data,
            pass,
            executionFlow: data.executionFlow || feature.executionFlow,
          },
        }));
      } else {
        setResults((prev) => ({
          ...prev,
          [feature.id]: {
            actual: null,
            raw: null,
            pass: null,
            executionFlow: feature.executionFlow,
            message: "Test not implemented yet. Implement API and wire up.",
          },
        }));
      }
    } catch (err) {
      setResults((prev) => ({
        ...prev,
        [feature.id]: {
          actual: null,
          raw: null,
          pass: false,
          executionFlow: feature.executionFlow,
          message: err.message,
        },
      }));
    } finally {
      setLoading((prev) => ({ ...prev, [feature.id]: false }));
    }
  }, [demoInputs]);

  const moveToFinished = (id) => setFinishedIds((prev) => new Set(prev).add(id));
  const moveToTodo = (id) => setFinishedIds((prev) => { const s = new Set(prev); s.delete(id); return s; });
  const toggleExpanded = (id) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  const updateDemoInput = (featureId, key, value) => {
    setDemoInputs((prev) => ({
      ...prev,
      [featureId]: { ...(prev[featureId] || {}), [key]: value },
    }));
  };

  const renderFeatureCard = (feature, isFinished = false) => {
    const res = results[feature.id];
    const isExpanded = expanded[feature.id] !== false;
    const inputs = demoInputs[feature.id] || feature.demoInputs;

    return (
      <div key={feature.id} className="card bg-base-100 shadow-md border border-base-300 mb-4">
        <div className="card-body">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="badge badge-sm badge-ghost">{feature.category}</span>
                <h3 className="card-title text-lg">{feature.id} {feature.name}</h3>
                {res?.pass === true && <CheckCircle className="w-5 h-5 text-success" />}
                {res?.pass === false && <XCircle className="w-5 h-5 text-error" />}
              </div>
              <p className="text-sm text-base-content/70 mt-1">{feature.description}</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              {(feature.id.startsWith("1.") || feature.id === "5.3") && (
                <button
                  className="btn btn-sm btn-secondary"
                  disabled={loading[`seed-${feature.id}`]}
                  onClick={async () => {
                    setLoading((p) => ({ ...p, [`seed-${feature.id}`]: true }));
                    try {
                      const monkey = await initMonkey();
                      await monkey.apiCall("/api/metering-rollout/seed-scenario", { scenario: feature.id });
                    } finally {
                      setLoading((p) => ({ ...p, [`seed-${feature.id}`]: false }));
                    }
                  }}
                >
                  {loading[`seed-${feature.id}`] ? "Seeding..." : "Seed scenario"}
                </button>
              )}
              <button
                className="btn btn-sm btn-primary"
                disabled={loading[feature.id]}
                onClick={() => runTest(feature)}
              >
                {loading[feature.id] ? "Running..." : <><Play className="w-4 h-4 mr-1" />Execute</>}
              </button>
              {isFinished ? (
                <button className="btn btn-sm btn-ghost" onClick={() => moveToTodo(feature.id)}>
                  ← Back to TODO
                </button>
              ) : (
                <button className="btn btn-sm btn-outline" onClick={() => moveToFinished(feature.id)}>
                  <ArrowRight className="w-4 h-4 mr-1" />Move to Finished
                </button>
              )}
            </div>
          </div>

          <div className="divider my-2" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-semibold mb-2">Demo Inputs</h4>
              <div className="space-y-2">
                {Object.keys(inputs).map((key) => (
                  <div key={key} className="form-control">
                    <label className="label py-0">
                      <span className="label-text">{key}</span>
                    </label>
                    <input
                      type="text"
                      className="input input-bordered input-sm"
                      value={inputs[key] ?? ""}
                      onChange={(e) => updateDemoInput(feature.id, key, e.target.value)}
                      placeholder={String(feature.demoInputs[key] ?? "")}
                    />
                  </div>
                ))}
                {Object.keys(inputs).length === 0 && <span className="text-base-content/50">(none)</span>}
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Expected Result</h4>
              <pre className="bg-base-200 p-2 rounded text-xs overflow-auto max-h-24">{JSON.stringify(feature.expectedResult, null, 2)}</pre>
              <h4 className="font-semibold mt-2 mb-2">Actual Result</h4>
              <pre className="bg-base-200 p-2 rounded text-xs overflow-auto max-h-24">
                {res?.message || (res?.actual != null ? JSON.stringify(res.actual, null, 2) : "—")}
              </pre>
            </div>
          </div>

          <div className="mt-2">
            <button className="btn btn-ghost btn-xs gap-1" onClick={() => toggleExpanded(feature.id)}>
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              Execution Flow
            </button>
            {isExpanded && (
              <div className="mt-2 bg-base-200 p-3 rounded font-mono text-xs whitespace-pre-wrap">
                {Array.isArray(res?.executionFlow) ? res.executionFlow.join("\n") : (res?.executionFlow || feature.executionFlow)}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-base-200 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="card bg-base-100 shadow-xl mb-6">
          <div className="card-body">
            <h1 className="card-title text-3xl">Metering Rollout Test Suite</h1>
            <p className="text-base-content/70">Test usage metering features. Each card: demo inputs, Execute, expected vs actual, execution flow. Move to Finished when verified.</p>
          </div>
        </div>

        <div className="tabs tabs-boxed mb-6">
          <button className={`tab ${activeTab === "TODO" ? "tab-active" : ""}`} onClick={() => setActiveTab("TODO")}>
            TODO ({todoFeatures.length})
          </button>
          <button className={`tab ${activeTab === "FINISHED" ? "tab-active" : ""}`} onClick={() => setActiveTab("FINISHED")}>
            FINISHED ({finishedFeatures.length})
          </button>
        </div>

        {activeTab === "TODO" && (
          <div>
            {todoFeatures.length === 0 ? (
              <p className="text-base-content/60">All features moved to Finished.</p>
            ) : (
              todoFeatures.map((f) => renderFeatureCard(f, false))
            )}
          </div>
        )}

        {activeTab === "FINISHED" && (
          <div>
            {finishedFeatures.length === 0 ? (
              <p className="text-base-content/60">No features finished yet. Run tests and click Move to Finished.</p>
            ) : (
              finishedFeatures.map((f) => renderFeatureCard(f, true))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

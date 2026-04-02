"use client";

import { useState, useEffect } from "react";
import { Play } from "lucide-react";
import { initMonkey } from "@/libs/monkey";
import { getCostByPath } from "@/libs/monkey/tools/metering_costs";
import CreditCostBadge from "@/components/CreditCostBadge";

/** id -> { label, method, path, action, defaultBody }. Action 7 (evaluate_keywords) omitted - no single endpoint. */
const ACTIONS = {
  suggest_transaction_details: {
    label: "Suggest transaction details",
    method: "POST",
    path: "/api/ai",
    action: "openai_text",
    defaultBody: {
      query: "List 3 example transactional details for a B2B product (price, lead time, warranty). One line each.",
      vendor: "openai",
      model: "gpt-4o",
    },
  },
  suggest_icp: {
    label: "Suggest ICP",
    method: "POST",
    path: "/api/ai",
    action: "openai_text",
    defaultBody: {
      query: "Suggest one ideal customer profile (ICP) in one sentence for a SaaS analytics tool.",
      vendor: "openai",
      model: "gpt-4o",
    },
  },
  search_competitors: {
    label: "Search competitors",
    method: "POST",
    path: "/api/content-magic/search",
    action: "tavily_search",
    defaultBody: { query: "SEO content software", maxResults: 2 },
  },
  benchmark_competitors: {
    label: "Analyze competitors for topics",
    method: "POST",
    path: "/api/content-magic/benchmark",
    action: "benchmark_topics",
    defaultBody: {
      pages: [{ url: "https://example.com", content: "Example page content for benchmark test." }],
      assetType: "key_topics",
    },
  },
  evaluate_topics: {
    label: "Evaluate topics for relevance",
    method: "POST",
    path: "/api/content-magic/topics/evaluate-topic",
    action: "evaluate_topic",
    defaultBody: {
      topicId: "test-topic-1",
      topic: { label: "Test topic" },
      article: { title: "Test", content_html: "<p>Test content</p>" },
    },
  },
  ranking_keywords: {
    label: "Get page also rank for keywords",
    method: "POST",
    path: "/api/dataforseo/ranking-keywords",
    action: "dataforseo_ranked_keywords",
    defaultBody: { urls: ["https://example.com"], limit: 5 },
  },
  related_keywords: {
    label: "Get related keywords",
    method: "POST",
    path: "/api/dataforseo/related-keywords",
    action: "dataforseo_related_keywords",
    defaultBody: { keywords: ["seo"], limit: 5 },
  },
  suggest_prompts: {
    label: "Suggest prompts",
    method: "POST",
    path: "/api/content-magic/suggest-prompts",
    action: "suggest_prompts",
    defaultBody: {
      articleId: "00000000-0000-0000-0000-000000000001",
      icp: { name: "Test", description: "Test ICP" },
      outlineTopics: [{ key: "intro", title: "Introduction" }],
      keywords: [],
    },
  },
  v0_outline: {
    label: "v0 outline generation/edits",
    method: "POST",
    path: "/api/v0/generate-with-files",
    action: "v0",
    defaultBody: { articleId: "00000000-0000-0000-0000-000000000001" },
  },
  geo_report: {
    label: "Evaluate GEO report prompts against article",
    method: "POST",
    path: "/api/content-magic/ai-optimization-score",
    action: "geo_report",
    defaultBody: {
      articleId: "00000000-0000-0000-0000-000000000001",
      contentHtml: "<p>Test</p>",
    },
  },
  topics_prioritize: {
    label: "Prioritize topics and evaluate for completion",
    method: "POST",
    path: "/api/content-magic/topics/suggest-priorities",
    action: "topics_suggest_priorities",
    defaultBody: {
      topics: [{ label: "Test topic" }],
      article: { title: "Test", content_html: "<p>Test</p>" },
      campaignContext: {},
    },
  },
  topic_implementation: {
    label: "Suggest topic implementation (single topic)",
    method: "POST",
    path: "/api/content-magic/topics/suggest-implementation",
    action: "topic_suggest_implementation",
    defaultBody: {
      topicId: "t1",
      topic: { label: "Test" },
      article: { content_html: "<p>Test</p>" },
    },
  },
  keyword_implementation: {
    label: "Suggest keyword implementation (multiple keywords)",
    method: "POST",
    path: "/api/content-magic/prompts/suggest-implementation",
    action: "prompts_suggest_implementation",
    defaultBody: {
      promptId: "p1",
      prompt: { text: "Test question?" },
      article: { content_html: "<p>Test</p>" },
    },
  },
  convert_social: {
    label: "Convert to social media",
    method: "POST",
    path: "/api/content-magic/repurpose-content/generate",
    action: "repurpose_social",
    defaultBody: {
      articleId: "00000000-0000-0000-0000-000000000001",
      format: "social_media",
      articleTitle: "Test Article",
      articleContent: "Test content for social conversion.",
    },
  },
};

export default function TestMeteringPage() {
  const [activeTab, setActiveTab] = useState("to_test");
  const [creditsInputStr, setCreditsInputStr] = useState("10");
  const [creditsRemaining, setCreditsRemaining] = useState(null);
  const [lastCost, setLastCost] = useState(null);
  const [setCreditsLoading, setSetCreditsLoading] = useState(false);
  const [addCreditsEmail, setAddCreditsEmail] = useState("");
  const [addCreditsAmountStr, setAddCreditsAmountStr] = useState("50");
  const [addCreditsLoading, setAddCreditsLoading] = useState(false);
  const [addCreditsMessage, setAddCreditsMessage] = useState(null);
  const [actions, setActions] = useState([]);
  const [actionsLoading, setActionsLoading] = useState(true);
  const [runningId, setRunningId] = useState(null);
  const [actionMessage, setActionMessage] = useState(null);

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [allPass, setAllPass] = useState(null);
  const [step4Logs, setStep4Logs] = useState([]);
  const [step4Loading, setStep4Loading] = useState(false);
  const [step4Pass, setStep4Pass] = useState(null);
  const [costRegistryResult, setCostRegistryResult] = useState(null);
  const [costRegistryLoading, setCostRegistryLoading] = useState(false);
  const [ledgerRecords, setLedgerRecords] = useState([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);

  async function fetchBalance() {
    try {
      const monkey = await initMonkey();
      const text = await monkey.apiCall("/api/test-metering", null, { method: "GET" });
      const data = JSON.parse(text);
      if (typeof data.creditsRemaining === "number") {
        setCreditsRemaining(data.creditsRemaining);
      }
    } catch {
      // ignore
    }
  }

  async function fetchLedger() {
    setLedgerLoading(true);
    try {
      const monkey = await initMonkey();
      const text = await monkey.apiCall("/api/test-metering/ledger", null, { method: "GET" });
      const data = JSON.parse(text);
      setLedgerRecords(Array.isArray(data.ledger) ? data.ledger : []);
    } catch {
      setLedgerRecords([]);
    } finally {
      setLedgerLoading(false);
    }
  }

  useEffect(() => {
    fetchBalance();
    fetchLedger();
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setActionsLoading(true);
      try {
        const monkey = await initMonkey();
        const text = await monkey.apiCall("/api/test-metering/actions", null, { method: "GET" });
        const data = JSON.parse(text);
        if (Array.isArray(data) && !cancelled) setActions(data);
      } catch {
        if (!cancelled) setActions([]);
      } finally {
        if (!cancelled) setActionsLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  async function handleSetCredits() {
    const creditsInput = parseInt(creditsInputStr, 10);
    if (Number.isNaN(creditsInput)) {
      setActionMessage("Enter a number (positive = add, negative = remove).");
      return;
    }
    setSetCreditsLoading(true);
    setActionMessage(null);
    try {
      const monkey = await initMonkey();
      const text = await monkey.apiCall("/api/test-metering/set-credits", { credits: creditsInput });
      const data = JSON.parse(text);
      if (typeof data.creditsRemaining === "number") {
        setCreditsRemaining(data.creditsRemaining);
        setLastCost(null);
        setActionMessage(creditsInput > 0 ? "Credits added." : creditsInput < 0 ? "Credits removed." : "No change.");
        fetchLedger();
      } else {
        setActionMessage(data.error || "Failed");
      }
    } catch (e) {
      setActionMessage(e.message || "Failed");
    } finally {
      setSetCreditsLoading(false);
    }
  }

  async function handleAddCreditsByEmail() {
    if (!addCreditsEmail.trim()) {
      setAddCreditsMessage("Enter an email.");
      return;
    }
    const amount = parseInt(addCreditsAmountStr, 10);
    if (Number.isNaN(amount) || amount === 0) {
      setAddCreditsMessage("Enter a non-zero number (positive = add, negative = remove).");
      return;
    }
    setAddCreditsLoading(true);
    setAddCreditsMessage(null);
    try {
      const monkey = await initMonkey();
      const text = await monkey.apiCall("/api/test-metering/add-credits-by-email", {
        email: addCreditsEmail.trim(),
        credits: amount,
      });
      const data = JSON.parse(text);
      if (data.ok) {
        const msg = data.creditsAdded != null
          ? `Added ${data.creditsAdded} credits to ${data.email}. New balance: ${data.creditsRemaining}.`
          : data.creditsRemoved != null
            ? `Removed ${data.creditsRemoved} credits from ${data.email}. New balance: ${data.creditsRemaining}.`
            : `Updated ${data.email}. Balance: ${data.creditsRemaining}.`;
        setAddCreditsMessage(msg);
        setAddCreditsEmail("");
        fetchLedger();
      } else {
        setAddCreditsMessage(data.error || "Failed");
      }
    } catch (e) {
      setAddCreditsMessage(e.message || "Failed");
    } finally {
      setAddCreditsLoading(false);
    }
  }

  async function runAction(actionId) {
    setRunningId(actionId);
    setActionMessage(null);
    try {
      const config = ACTIONS[actionId];
      if (!config) {
        setActionMessage(`Unknown action: ${actionId}`);
        return;
      }

      const monkey = await initMonkey();
      const cost = getCostByPath(config.path);
      const body = { ...config.defaultBody };
      const options = { returnResponse: true };
      const res = await monkey.apiCall(config.path, body, options);
      
      const text = await res.text();
      const data = JSON.parse(text);
      if (res.status === 429) {
        setCreditsRemaining(data.details?.remaining ?? 0);
        setActionMessage("Out of credits.");
        fetchLedger();
        return;
      }
      
      if (!res.ok) {
        setActionMessage(data.error || `HTTP ${res.status}`);
        return;
      }
      
      setLastCost(cost);
      if (typeof data.remaining === "number") {
        setCreditsRemaining(data.remaining);
      }
      fetchLedger();
      
      if (data.error) {
        setActionMessage(typeof data.error === "string" ? data.error : "API error (see console)");
      } else {
        setActionMessage("OK");
      }
    } catch (e) {
      if (e.code === "METERING_CODE_QUOTA_EXCEEDED" || e.message?.includes("429")) {
        setActionMessage("Out of credits.");
      } else {
        setActionMessage(e.message || "Request failed");
      }
    } finally {
      setRunningId(null);
    }
  }

  async function runCostRegistryChecks() {
    setCostRegistryLoading(true);
    setCostRegistryResult(null);
    try {
      const monkey = await initMonkey();
      const text = await monkey.apiCall("/api/test-metering", null, { method: "GET" });
      const data = JSON.parse(text);
      setCostRegistryResult(data);
    } catch (e) {
      setCostRegistryResult({ pass: false, message: e.message });
    } finally {
      setCostRegistryLoading(false);
    }
  }

  async function runTests() {
    setLoading(true);
    setLogs([]);
    setAllPass(null);
    try {
      const monkey = await initMonkey();
      const text = await monkey.apiCall("/api/test-metering", {});
      const data = JSON.parse(text);
      setLogs(data.logs ?? []);
      setAllPass(data.allPass ?? false);
    } catch (e) {
      setLogs([{ step: 0, action: "Request", expected: "success", actual: e.message, pass: false }]);
      setAllPass(false);
    } finally {
      setLoading(false);
    }
  }

  async function runStep4() {
    setStep4Loading(true);
    setStep4Logs([]);
    setStep4Pass(null);
    try {
      const monkey = await initMonkey();
      const text = await monkey.apiCall("/api/test-metering", { runStep4: true });
      const data = JSON.parse(text);
      setStep4Logs(data.logs ?? []);
      setStep4Pass(data.allPass ?? false);
    } catch (e) {
      setStep4Logs([{ step: "Step4", action: "Request", expected: "success", actual: e.message, pass: false }]);
      setStep4Pass(false);
    } finally {
      setStep4Loading(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-2">Test metering</h1>

      {/* Top bar: update credits (current user) — positive = add, negative = remove */}
      <div className="flex flex-wrap items-center gap-4 py-3 px-4 bg-gray-100 dark:bg-gray-800 rounded-lg mb-6">
        <div className="flex items-center gap-2">
          <label htmlFor="credits-input" className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Update
          </label>
          <input
            id="credits-input"
            type="number"
            value={creditsInputStr}
            onChange={(e) => setCreditsInputStr(e.target.value)}
            className="w-24 px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 "
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">credits (positive = add, negative = remove)</span>
          <button
            type="button"
            onClick={handleSetCredits}
            disabled={setCreditsLoading}
            className="px-3 py-1 rounded bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {setCreditsLoading ? "…" : "Update"}
          </button>
        </div>
        <span className="text-sm text-gray-600 dark:text-gray-400">
          Last action cost: {lastCost != null ? lastCost : "—"}
        </span>
        <span className="text-sm font-medium text-gray-100 ">
          Remaining: {creditsRemaining != null ? creditsRemaining : "—"}
        </span>
        {actionMessage && (
          <span className="text-sm text-gray-600 dark:text-gray-400">{actionMessage}</span>
        )}
      </div>

      {/* Update credits for user by email (positive = add → ledger cost negative; negative = remove → ledger cost positive) */}
      <div className="flex flex-wrap items-center gap-4 py-3 px-4 bg-gray-100 dark:bg-gray-800 rounded-lg mb-6">
        <div className="flex items-center gap-2 flex-wrap">
          <label htmlFor="add-credits-email" className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Update
          </label>
          <input
            id="add-credits-amount"
            type="number"
            value={addCreditsAmountStr}
            onChange={(e) => setAddCreditsAmountStr(e.target.value)}
            className="w-20 px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">credits for</span>
          <input
            id="add-credits-email"
            type="email"
            placeholder="user@example.com"
            value={addCreditsEmail}
            onChange={(e) => setAddCreditsEmail(e.target.value)}
            className="min-w-[200px] px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900"
          />
          <button
            type="button"
            onClick={handleAddCreditsByEmail}
            disabled={addCreditsLoading}
            className="px-3 py-1 rounded bg-green-600 text-white text-sm hover:bg-green-700 disabled:opacity-50"
          >
            {addCreditsLoading ? "…" : "Update credits"}
          </button>
        </div>
        {addCreditsMessage && (
          <span className="text-sm text-gray-600 dark:text-gray-400">{addCreditsMessage}</span>
        )}
      </div>

      {/* Recent credit costing records */}
      <div className="mb-6 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Recent credit costing records</h2>
          <button
            type="button"
            onClick={fetchLedger}
            disabled={ledgerLoading}
            className="text-xs px-2 py-1 rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50"
          >
            {ledgerLoading ? "…" : "Refresh"}
          </button>
        </div>
        <div className="overflow-x-auto max-h-[240px] overflow-y-auto">
          {ledgerLoading && ledgerRecords.length === 0 ? (
            <p className="p-4 text-sm text-gray-500">Loading…</p>
          ) : ledgerRecords.length === 0 ? (
            <p className="p-4 text-sm text-gray-500">No records yet. Run an action above to see entries.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-300">Time</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-300">Action</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-700 dark:text-gray-300" title="+N = credits added, −N = credits spent">Cost</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-300">Idempotency key</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {ledgerRecords.map((row) => (
                  <tr key={row.id} className="bg-white dark:bg-gray-900">
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                      {row.created_at ? new Date(row.created_at).toLocaleString() : "—"}
                    </td>
                    <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{row.action ?? "—"}</td>
                    <td className="px-3 py-2 text-right font-medium text-gray-900 dark:text-gray-100">
                      {row.cost != null
                        ? row.cost < 0
                          ? `+${Math.abs(row.cost)}`
                          : `−${row.cost}`
                        : "—"}
                    </td>
                    <td className="px-3 py-2 text-gray-500 dark:text-gray-400 font-mono text-xs truncate max-w-[140px]" title={row.idempotency_key}>
                      {row.idempotency_key ? `${String(row.idempotency_key).slice(0, 8)}…` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700 mb-4">
        <button
          type="button"
          onClick={() => { setActiveTab("to_test"); fetchBalance(); }}
          className={`px-4 py-2 font-medium rounded-t ${activeTab === "to_test" ? "bg-gray-200 dark:bg-gray-700 text-gray-900 " : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"}`}
        >
          To test
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("test_completed")}
          className={`px-4 py-2 font-medium rounded-t ${activeTab === "test_completed" ? "bg-gray-200 dark:bg-gray-700 text-gray-900 " : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"}`}
        >
          Test completed
        </button>
      </div>

      {activeTab === "to_test" && (
        <div className="space-y-2">
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Run each CJGEO action; cost is deducted and remaining balance is shown above. Action 7 (evaluate keywords for relevance) has no single endpoint and is omitted.
          </p>
          {actionsLoading ? (
            <p className="text-sm text-gray-500">Loading actions…</p>
          ) : (
            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
              {actions.map((a) => (
                <li key={a.id} className="flex items-center justify-between py-3">
                  <div className="text-gray-900 ">
                    <span className="font-medium">{a.label}</span>
                    <span className="ml-2 text-sm font-normal text-gray-700 dark:text-gray-400">({a.cost} credits)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => runAction(a.id)}
                    disabled={runningId !== null}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-emerald-600 text-white text-sm hover:bg-emerald-700 disabled:opacity-50 disabled:pointer-events-none"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>{runningId === a.id ? "Running…" : "Run"}</span>
                    {typeof a.cost === "number" && (
                      <CreditCostBadge cost={a.cost} size="md" className="ml-1" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {activeTab === "test_completed" && (
        <>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Runs the four verification steps: add 10 credits via ledger, first spend(5), replay same key, then spend(6) expecting OUT_OF_CREDITS.
          </p>
          <div className="flex flex-wrap gap-3 mb-4">
            <button
              type="button"
              onClick={runTests}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:pointer-events-none"
            >
              <Play className="w-4 h-4" />
              {loading ? "Running…" : "Run meterSpend tests"}
            </button>
            <button
              type="button"
              onClick={runCostRegistryChecks}
              disabled={costRegistryLoading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-600 text-white hover:bg-gray-700 disabled:opacity-50 disabled:pointer-events-none"
            >
              <Play className="w-4 h-4" />
              {costRegistryLoading ? "Running…" : "Run cost registry checks"}
            </button>
            <button
              type="button"
              onClick={runStep4}
              disabled={step4Loading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 disabled:pointer-events-none"
            >
              <Play className="w-4 h-4" />
              {step4Loading ? "Running…" : "Run Step 4 (apiCall metering)"}
            </button>
          </div>
          {costRegistryResult !== null && (
            <p className={`mb-2 text-sm ${costRegistryResult.pass ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
              Cost registry: {costRegistryResult.pass ? "Pass" : costRegistryResult.message ?? "Fail"}
            </p>
          )}
          {allPass !== null && (
            <p className={`mt-4 font-medium ${allPass ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
              {allPass ? "All four steps passed." : "One or more steps failed."}
            </p>
          )}
          {step4Pass !== null && (
            <p className={`mt-2 font-medium ${step4Pass ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
              Step 4: {step4Pass ? "Pass" : "Fail"}
            </p>
          )}
          {step4Logs.length > 0 && (
            <div className="mt-4">
              <h2 className="text-lg font-medium mb-2">Step 4 logs</h2>
              <pre className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-auto max-h-[300px] text-sm whitespace-pre-wrap">
                {step4Logs.map((entry, i) => (
                  <span key={i}>
                    [{entry.pass ? "PASS" : "FAIL"}] {entry.action}
                    {"\n"}  Expected: {entry.expected}
                    {"\n"}  Actual:   {entry.actual}
                    {"\n"}
                  </span>
                ))}
              </pre>
            </div>
          )}
          <div className="mt-6">
            <h2 className="text-lg font-medium mb-2">Logs</h2>
            <pre className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-auto max-h-[400px] text-sm whitespace-pre-wrap">
              {logs.length === 0
                ? "Click the button to run tests."
                : logs.map((entry, i) => (
                    <span key={i}>
                      [{entry.pass ? "PASS" : "FAIL"}] Step {entry.step}: {entry.action}
                      {"\n"}  Expected: {entry.expected}
                      {"\n"}  Actual:   {entry.actual}
                      {"\n"}
                    </span>
                  ))}
            </pre>
          </div>
        </>
      )}
    </div>
  );
}

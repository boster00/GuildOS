"use client";

import { useState } from "react";
import { Loader, ChevronDown, ChevronUp, Play, Copy, Check, X, Info } from "lucide-react";
import { initMonkey } from "@/libs/monkey";

const DEFAULT_LOCATION = typeof process !== "undefined" && process.env?.NEXT_PUBLIC_DATAFORSEO_DEFAULT_LOCATION
  ? parseInt(process.env.NEXT_PUBLIC_DATAFORSEO_DEFAULT_LOCATION, 10)
  : 2840;

// DataForSEO API endpoints with default payloads
const DATA_FOR_SEO_APIS = [
  {
    id: "related-keywords",
    name: "Related Keywords",
    description: "Get keywords related to a seed keyword with search volume and difficulty",
    endpoint: "/v3/dataforseo_labs/google/related_keywords/live",
    needsKeyword: true,
    defaultPayload: [
      {
        keyword: "{keyword}",
        location_code: null,
        language_code: "en",
        depth: 1,
        limit: 100,
        include_serp_info: false,
        include_clickstream_data: false,
      }
    ],
  },
  {
    id: "search-volume",
    name: "Search Volume (Bulk)",
    description: "Get search volumes for multiple keywords",
    endpoint: "/v3/keywords_data/clickstream_data/bulk_search_volume/live",
    needsKeyword: true,
    defaultPayload: [
      {
        location_code: DEFAULT_LOCATION,
        keywords: ["{keyword}", "peptide synthesis", "custom antibodies"],
      }
    ],
  },
  {
    id: "keyword-overview",
    name: "Keyword Overview",
    description: "Get comprehensive keyword metrics including volume, difficulty, CPC, competition",
    endpoint: "/v3/dataforseo_labs/google/keyword_overview/live",
    needsKeyword: true,
    defaultPayload: [
      {
        keyword: "{keyword}",
        location_code: DEFAULT_LOCATION,
        language_code: "en",
        include_serp_info: true,
        include_clickstream_data: true,
      }
    ],
  },
  {
    id: "historical-keyword-data",
    name: "Historical Keyword Data",
    description: "Get historical search volume trends over time",
    endpoint: "/v3/dataforseo_labs/google/historical_keyword_data/live",
    needsKeyword: true,
    defaultPayload: [
      {
        keyword: "{keyword}",
        location_code: DEFAULT_LOCATION,
        language_code: "en",
        date_from: "2024-01-01",
        date_to: "2024-12-31",
      }
    ],
  },
  {
    id: "serp-organic",
    name: "SERP Organic Results",
    description: "Get Google organic search results for a keyword",
    endpoint: "/v3/serp/google/organic/live/advanced",
    needsKeyword: true,
    defaultPayload: [
      {
        keyword: "{keyword}",
        location_code: DEFAULT_LOCATION,
        language_code: "en",
        device: "desktop",
        os: "windows",
        depth: 100,
      }
    ],
  },
  {
    id: "keyword-difficulty",
    name: "Keyword Difficulty (Bulk)",
    description: "Get keyword difficulty scores for multiple keywords",
    endpoint: "/v3/dataforseo_labs/google/keyword_difficulty/live",
    needsKeyword: true,
    defaultPayload: [
      {
        keywords: ["{keyword}", "peptide synthesis", "protein expression"],
        location_code: DEFAULT_LOCATION,
        language_code: "en",
      }
    ],
  },
  {
    id: "ranked-keywords",
    name: "Ranked Keywords (URL also rank for)",
    description: "Get keywords that a URL/domain ranks for with positions and search volume",
    endpoint: "/v3/dataforseo_labs/google/ranked_keywords/live",
    needsKeyword: false,
    needsUrl: true,
    defaultPayload: [
      {
        target: "{url}",
        location_code: DEFAULT_LOCATION,
        language_name: "English",
        limit: 20,
        load_rank_absolute: true,
        historical_serp_mode: "live",
        order_by: [
          "keyword_data.keyword_info.search_volume,DESC",
          "ranked_serp_element.serp_item.rank_absolute,ASC"
        ],
        filters: [
          ["ranked_serp_element.serp_item.rank_absolute", "<=", 20]
        ],
      }
    ],
  },
  {
    id: "relevant-pages",
    name: "Relevant Pages (Top Traffic Pages)",
    description: "Get pages of a domain with estimated monthly traffic (ETV) and ranking distribution",
    endpoint: "/v3/dataforseo_labs/google/relevant_pages/live",
    needsKeyword: false,
    needsUrl: true,
    defaultPayload: [
      {
        target: "{url}",
        location_code: DEFAULT_LOCATION,
        language_name: "English",
        order_by: ["metrics.organic.etv,desc"],
        limit: 50,
      }
    ],
  },
  {
    id: "bulk-traffic-estimation",
    name: "Bulk Traffic Estimation",
    description: "Get estimated monthly traffic for up to 1000 domains/URLs in one call",
    endpoint: "/v3/dataforseo_labs/google/bulk_traffic_estimation/live",
    needsKeyword: false,
    needsUrl: true,
    defaultPayload: [
      {
        targets: ["{url}"],
        location_code: DEFAULT_LOCATION,
        language_code: "en",
      }
    ],
  },
  {
    id: "locations",
    name: "Get Locations",
    description: "List all available location codes",
    endpoint: "/v3/keywords_data/google_ads/locations",
    needsKeyword: false,
    defaultPayload: null,
  },
  {
    id: "languages",
    name: "Get Languages",
    description: "List all available language codes",
    endpoint: "/v3/keywords_data/google_ads/languages",
    needsKeyword: false,
    defaultPayload: null,
  },
];

// Competitor workflow step definitions
const WORKFLOW_STEPS = [
  {
    id: "ranked-keywords",
    title: "Step 1: Top Ranking Keywords",
    explanation: "Find which keywords the competitor ranks for in organic search. DataForSEO returns keywords with position, search volume, and competition. Results are ordered by search volume (highest first). Use this to identify their strongest topic areas.",
    apiId: "ranked-keywords",
  },
  {
    id: "relevant-pages",
    title: "Step 2: Top Traffic Pages",
    explanation: "Get the competitor's pages that receive the most estimated organic traffic. DataForSEO calculates ETV (Estimated Traffic Volume) as CTR × search volume for all keywords each page ranks for. No manual traffic calculation needed.",
    apiId: "relevant-pages",
  },
  {
    id: "bulk-traffic-estimation",
    title: "Step 3 (Optional): Domain-Level Traffic",
    explanation: "Compare total estimated organic traffic across multiple domains. Useful for benchmarking one competitor against others or against your own domain.",
    apiId: "bulk-traffic-estimation",
  },
];

// Used DataForSEO endpoints for cost research (bosterbio.com, "ELISA service")
const COST_RESEARCH_APIS = [
  { id: "related_keywords", name: "Related Keywords", endpoint: "/v3/dataforseo_labs/google/related_keywords/live", payload: [{ keyword: "{keyword}", location_code: 2840, language_code: "en", depth: 1, limit: 100, include_serp_info: false, include_clickstream_data: false }] },
  { id: "ranked_keywords", name: "Ranked Keywords", endpoint: "/v3/dataforseo_labs/google/ranked_keywords/live", payload: [{ target: "{url}", location_code: 2840, language_name: "English", limit: 20, load_rank_absolute: true, historical_serp_mode: "live", order_by: ["keyword_data.keyword_info.search_volume,DESC", "ranked_serp_element.serp_item.rank_absolute,ASC"], filters: [["ranked_serp_element.serp_item.rank_absolute", "<=", 20]] }] },
  { id: "relevant_pages", name: "Relevant Pages", endpoint: "/v3/dataforseo_labs/google/relevant_pages/live", payload: [{ target: "{url}", location_code: 2840, language_name: "English", order_by: ["metrics.organic.etv,desc"], limit: 50 }] },
  { id: "bulk_traffic_estimation", name: "Bulk Traffic Estimation", endpoint: "/v3/dataforseo_labs/google/bulk_traffic_estimation/live", payload: [{ targets: ["{url}"], location_code: 2840, language_code: "en" }] },
  { id: "serp_organic", name: "SERP Organic", endpoint: "/v3/serp/google/organic/live/advanced", payload: [{ keyword: "{keyword}", location_code: 2840, language_code: "en", device: "desktop", os: "windows", depth: 100 }] },
  { id: "bulk_search_volume", name: "Bulk Search Volume", endpoint: "/v3/keywords_data/clickstream_data/bulk_search_volume/live", payload: [{ location_code: 2840, keywords: ["{keyword}", "ELISA kit", "antibody"] }] },
];

export default function TestDataForSeoPage() {
  const [seedKeyword, setSeedKeyword] = useState("ELISA service");
  const [seedUrl, setSeedUrl] = useState("https://bosterbio.com");
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState({});
  const [expanded, setExpanded] = useState({});
  const [copied, setCopied] = useState({});

  // Workflow-specific state
  const [workflowResults, setWorkflowResults] = useState({});
  const [workflowRaw, setWorkflowRaw] = useState({});

  // Cost research: per-endpoint result { rawFirst500, cost, taskCosts, error }
  const [costResearchResults, setCostResearchResults] = useState({});

  const handleTestApi = async (api) => {
    const responseId = `${api.id}-${Date.now()}`;
    const loadingKey = api.id;
    setLoading(prev => ({ ...prev, [loadingKey]: true }));

    try {
      const monkey = await initMonkey();
      const text = await monkey.apiCall("/api/dataforseo/playground", {
        endpoint: api.endpoint,
        payload: api.defaultPayload,
        seedKeyword: api.needsKeyword ? seedKeyword : null,
        seedUrl: api.needsUrl ? seedUrl : null,
        method: api.method || "POST",
      });
      const data = JSON.parse(text);

      const newResponse = {
        id: responseId,
        api: api,
        timestamp: new Date().toISOString(),
        ...data,
      };

      setResponses(prev => [newResponse, ...prev]);
      setExpanded(prev => ({ ...prev, [responseId]: true }));
    } catch (error) {
      const errorResponse = {
        id: responseId,
        api: api,
        timestamp: new Date().toISOString(),
        success: false,
        error: error.message,
      };
      setResponses(prev => [errorResponse, ...prev]);
      setExpanded(prev => ({ ...prev, [responseId]: true }));
    } finally {
      setLoading(prev => {
        const next = { ...prev };
        delete next[loadingKey];
        return next;
      });
    }
  };

  const handleWorkflowStep = async (step) => {
    const api = DATA_FOR_SEO_APIS.find(a => a.id === step.apiId);
    if (!api || !seedUrl.trim()) return;

    const loadingKey = `workflow-${step.id}`;
    setLoading(prev => ({ ...prev, [loadingKey]: true }));
    setWorkflowResults(prev => ({ ...prev, [step.id]: null }));
    setWorkflowRaw(prev => ({ ...prev, [step.id]: null }));

    try {
      const monkey = await initMonkey();
      const text = await monkey.apiCall("/api/dataforseo/playground", {
        endpoint: api.endpoint,
        payload: api.defaultPayload,
        seedKeyword: null,
        seedUrl: seedUrl.trim(),
        method: "POST",
      });
      const data = JSON.parse(text);
      setWorkflowRaw(prev => ({ ...prev, [step.id]: data }));

      // Parse response for table display (playground returns raw DataForSEO: data.tasks, not data.response)
      if (step.apiId === "ranked-keywords") {
        const tasks = data.tasks || [];
        const resultData = tasks[0]?.result?.[0];
        const items = resultData?.items || [];
        const keywords = items.map((item) => {
          const keywordText = item.keyword_data?.keyword ?? "";
          const keywordInfo = item.keyword_data?.keyword_info || {};
          const serpItem = item.ranked_serp_element?.serp_item;
          const rankAbsolute = serpItem?.rank_absolute ?? serpItem?.rank_group != null ? serpItem.rank_group + 1 : null;
          const difficulty = item.keyword_data?.keyword_properties?.keyword_difficulty ?? (keywordInfo.competition != null ? Number(keywordInfo.competition) * 100 : null);
          return {
            keyword: keywordText,
            position: rankAbsolute,
            rank_absolute: rankAbsolute,
            search_volume: keywordInfo.search_volume ?? 0,
            difficulty,
          };
        }).filter((k) => k.keyword);
        setWorkflowResults(prev => ({
          ...prev,
          [step.id]: { type: "ranked-keywords", keywords, success: data.status_code === 20000 },
        }));
      } else if (step.apiId === "relevant-pages") {
        const tasks = data.tasks || [];
        const items = tasks[0]?.result?.[0]?.items || [];
        if ((items || []).length > 0) {
          setWorkflowResults(prev => ({
            ...prev,
            [step.id]: { type: "relevant-pages", items, success: data.success },
          }));
        } else {
          // Fallback: discover pages via Ranked Keywords, then Bulk Traffic Estimation
          try {
            const rkPayload = [
              {
                target: "{url}",
                location_code: DEFAULT_LOCATION,
                language_name: "English",
                limit: 500,
                load_rank_absolute: true,
                historical_serp_mode: "live",
                order_by: [
                  "keyword_data.keyword_info.search_volume,DESC",
                  "ranked_serp_element.serp_item.rank_absolute,ASC"
                ],
                filters: [["ranked_serp_element.serp_item.rank_absolute", "<=", 20]],
              }
            ];
            const rkText = await monkey.apiCall("/api/dataforseo/playground", {
              endpoint: "/v3/dataforseo_labs/google/ranked_keywords/live",
              payload: rkPayload,
              seedKeyword: null,
              seedUrl: seedUrl.trim(),
              method: "POST",
              returnRaw: true,
            });
            const rkData = JSON.parse(rkText);
            const rkTasks = rkData.tasks || [];
            const rkItems = rkTasks[0]?.result?.[0]?.items || [];
            const pageUrls = [...new Set(
              rkItems
                .map(it => it.ranked_serp_element?.serp_item?.url)
                .filter(Boolean)
            )].slice(0, 100);
            if (pageUrls.length === 0) {
              setWorkflowResults(prev => ({
                ...prev,
                [step.id]: { type: "relevant-pages", items: [], success: false },
              }));
            } else {
              const bteText = await monkey.apiCall("/api/dataforseo/playground", {
                endpoint: "/v3/dataforseo_labs/google/bulk_traffic_estimation/live",
                payload: [{
                  targets: pageUrls,
                  location_code: DEFAULT_LOCATION,
                  language_code: "en",
                  item_types: ["organic"],
                }],
                seedKeyword: null,
                seedUrl: null,
                method: "POST",
              });
              const bteData = JSON.parse(bteText);
              const bteTasks = bteData.tasks || [];
              const bteItems = (bteTasks[0]?.result?.[0]?.items || [])
                .sort((a, b) => (b.metrics?.organic?.etv ?? 0) - (a.metrics?.organic?.etv ?? 0));
              setWorkflowResults(prev => ({
                ...prev,
                [step.id]: { type: "relevant-pages", items: bteItems, success: bteData.success, fromFallback: true },
              }));
            }
          } catch (fallbackError) {
            setWorkflowResults(prev => ({
              ...prev,
              [step.id]: { type: "error", error: fallbackError.message },
            }));
          }
        }
      } else if (step.apiId === "bulk-traffic-estimation") {
        const tasks = data.tasks || [];
        const items = tasks[0]?.result?.[0]?.items || [];
        setWorkflowResults(prev => ({
          ...prev,
          [step.id]: { type: "bulk-traffic", items, success: data.success },
        }));
      }
    } catch (error) {
      setWorkflowResults(prev => ({
        ...prev,
        [step.id]: { type: "error", error: error.message },
      }));
    } finally {
      setLoading(prev => {
        const next = { ...prev };
        delete next[loadingKey];
        return next;
      });
    }
  };

  const handleCopy = (text, responseId) => {
    navigator.clipboard.writeText(text);
    setCopied(prev => ({ ...prev, [responseId]: true }));
    setTimeout(() => {
      setCopied(prev => {
        const next = { ...prev };
        delete next[responseId];
        return next;
      });
    }, 2000);
  };

  const handleCostResearch = async (api) => {
    setLoading(prev => ({ ...prev, [`cost-${api.id}`]: true }));
    setCostResearchResults(prev => ({ ...prev, [api.id]: null }));
    try {
      const monkey = await initMonkey();
      const text = await monkey.apiCall("/api/dataforseo/playground", {
        endpoint: api.endpoint,
        payload: api.payload,
        seedKeyword,
        seedUrl: seedUrl.trim(),
        method: "POST",
      });
      const data = typeof text === "string" ? JSON.parse(text) : text;
      const rawStr = JSON.stringify(data);
      const rawFirst500 = rawStr.slice(0, 500);
      const cost = data.cost != null ? Number(data.cost) : null;
      const taskCosts = Array.isArray(data.tasks) ? data.tasks.map((t) => t.cost != null ? Number(t.cost) : null) : [];
      setCostResearchResults(prev => ({
        ...prev,
        [api.id]: { rawFirst500, cost, taskCosts, fullLength: rawStr.length },
      }));
    } catch (error) {
      setCostResearchResults(prev => ({
        ...prev,
        [api.id]: { error: error.message, rawFirst500: null, cost: null, taskCosts: [] },
      }));
    } finally {
      setLoading(prev => {
        const next = { ...prev };
        delete next[`cost-${api.id}`];
        return next;
      });
    }
  };

  const toggleExpanded = (responseId) => {
    setExpanded(prev => ({
      ...prev,
      [responseId]: !prev[responseId],
    }));
  };

  const formatJson = (obj) => {
    try {
      return JSON.stringify(obj, null, 2);
    } catch (e) {
      return String(obj);
    }
  };

  const showRawWorkflow = (stepId) => {
    const raw = workflowRaw[stepId];
    return raw ? formatJson(raw) : "No data";
  };

  return (
    <div className="min-h-screen bg-base-200 py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="card bg-base-100 shadow-xl mb-6">
          <div className="card-body">
            <h1 className="card-title text-3xl">DataForSEO Test Page</h1>
            <p className="text-base-content/60">
              Test DataForSEO API endpoints and run the Competitor Analysis workflow to get top ranking keywords and top traffic pages for any domain.
            </p>
          </div>
        </div>

        {/* Competitor Analysis Workflow */}
        <div className="card bg-base-100 shadow-xl mb-6">
          <div className="card-body">
            <h2 className="card-title text-xl mb-2">Competitor Analysis Workflow</h2>
            <div className="alert alert-info mb-4">
              <Info className="w-5 h-5 shrink-0" />
              <div>
                <p className="font-semibold">What this workflow does</p>
                <p className="text-sm">
                  This workflow analyzes a competitor domain to get (1) top ranking keywords and (2) top traffic pages,
                  using DataForSEO&apos;s Ranked Keywords and Relevant Pages endpoints. DataForSEO provides estimated
                  traffic directly, so no local traffic calculation is needed.
                </p>
              </div>
            </div>

            <div className="form-control mb-6">
              <label className="label">
                <span className="label-text font-semibold">Competitor URL</span>
                <span className="label-text-alt">Enter the competitor domain or full URL (e.g. https://example.com)</span>
              </label>
              <input
                type="text"
                className="input input-bordered"
                value={seedUrl}
                onChange={(e) => setSeedUrl(e.target.value)}
                placeholder="https://example.com"
              />
            </div>

            <div className="space-y-6">
              {WORKFLOW_STEPS.map((step) => (
                <div key={step.id} className="border border-base-300 rounded-lg p-4">
                  <h3 className="font-semibold text-lg mb-2">{step.title}</h3>
                  <div className="alert alert-info alert-sm mb-3">
                    <Info className="w-4 h-4 shrink-0" />
                    <span className="text-sm">{step.explanation}</span>
                  </div>
                  <button
                    onClick={() => handleWorkflowStep(step)}
                    disabled={loading[`workflow-${step.id}`] || !seedUrl.trim()}
                    className="btn btn-primary btn-sm gap-2 mb-3"
                  >
                    {loading[`workflow-${step.id}`] ? (
                      <>
                        <Loader className="w-4 h-4 animate-spin" />
                        Running...
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4" />
                        Run
                      </>
                    )}
                  </button>

                  {workflowResults[step.id] && (
                    <div className="mt-3 space-y-2">
                      {workflowResults[step.id].type === "ranked-keywords" && (
                        <div>
                          {(workflowResults[step.id].keywords || []).length > 0 ? (
                            <div className="overflow-x-auto">
                              <table className="table table-sm table-zebra">
                                <thead>
                                  <tr>
                                    <th>Keyword</th>
                                    <th>Position</th>
                                    <th>Search Volume</th>
                                    <th>Difficulty</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(workflowResults[step.id].keywords || []).slice(0, 20).map((kw, i) => (
                                    <tr key={i}>
                                      <td className="font-mono text-xs">{kw.keyword}</td>
                                      <td>{kw.rank_absolute ?? kw.position ?? "—"}</td>
                                      <td>{kw.search_volume != null ? kw.search_volume.toLocaleString() : "—"}</td>
                                      <td>{kw.difficulty != null ? kw.difficulty : "—"}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <div className="alert alert-warning">
                              <Info className="w-5 h-5 shrink-0" />
                              <span>No ranking keywords found. DataForSEO returned no keywords for this domain.</span>
                            </div>
                          )}
                        </div>
                      )}
                      {workflowResults[step.id].type === "relevant-pages" && (
                        <div>
                          {(workflowResults[step.id].items || []).length > 0 ? (
                            <div className="overflow-x-auto">
                              <table className="table table-sm table-zebra">
                                <thead>
                                  <tr>
                                    <th>Page URL</th>
                                    <th>Organic ETV</th>
                                    <th>SERP Count</th>
                                    <th>pos_1</th>
                                    <th>pos_2_3</th>
                                    <th>pos_4_10</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(workflowResults[step.id].items || []).slice(0, 20).map((item, i) => (
                                    <tr key={i}>
                                      <td className="font-mono text-xs max-w-xs truncate" title={item.page_address || item.target}>
                                        {item.page_address || item.target}
                                      </td>
                                      <td>
                                        {item.metrics?.organic?.etv != null
                                          ? Math.round(item.metrics.organic.etv).toLocaleString()
                                          : "—"}
                                      </td>
                                      <td>{item.metrics?.organic?.count ?? "—"}</td>
                                      <td>{item.metrics?.organic?.pos_1 ?? "—"}</td>
                                      <td>{item.metrics?.organic?.pos_2_3 ?? "—"}</td>
                                      <td>{item.metrics?.organic?.pos_4_10 ?? "—"}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <div className="alert alert-warning">
                              <Info className="w-5 h-5 shrink-0" />
                              <div>
                                <p className="font-semibold">No relevant pages found</p>
                                <p className="text-sm">
                                  DataForSEO returned no items for this domain (items_count: 0). This can happen if the domain has limited organic search presence in DataForSEO&apos;s index, or try a different domain (e.g. a commercial site with more SEO data).
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      {workflowResults[step.id].type === "bulk-traffic" && (
                        <div>
                          {(workflowResults[step.id].items || []).length > 0 ? (
                            <div className="overflow-x-auto">
                              <table className="table table-sm table-zebra">
                                <thead>
                                  <tr>
                                    <th>Domain</th>
                                    <th>Organic ETV</th>
                                    <th>Paid ETV</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(workflowResults[step.id].items || []).map((item, i) => (
                                    <tr key={i}>
                                      <td className="font-mono text-xs">{item.target}</td>
                                      <td>
                                        {item.metrics?.organic?.etv != null
                                          ? Math.round(item.metrics.organic.etv).toLocaleString()
                                          : "—"}
                                      </td>
                                      <td>
                                        {item.metrics?.paid?.etv != null
                                          ? Math.round(item.metrics.paid.etv).toLocaleString()
                                          : "—"}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <div className="alert alert-warning">
                              <Info className="w-5 h-5 shrink-0" />
                              <span>No traffic data found. DataForSEO returned no items for the specified domain(s).</span>
                            </div>
                          )}
                        </div>
                      )}
                      {workflowResults[step.id].type === "error" && (
                        <div className="alert alert-error">
                          <X className="w-5 h-5" />
                          <span>{workflowResults[step.id].error}</span>
                        </div>
                      )}
                      <details className="collapse collapse-arrow bg-base-200">
                        <summary className="collapse-title text-sm font-medium">View raw response</summary>
                        <div className="collapse-content">
                          <pre className="text-xs overflow-x-auto max-h-48 overflow-y-auto p-2">
                            {showRawWorkflow(step.id)}
                          </pre>
                        </div>
                      </details>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Cost research: used endpoints, first 500 chars + extracted cost */}
        <div className="card bg-base-100 shadow-xl mb-6">
          <div className="card-body">
            <h2 className="card-title text-xl mb-2">Cost research</h2>
            <p className="text-base-content/60 text-sm mb-4">
              Run each used DataForSEO endpoint with default samples (keyword: &quot;ELISA service&quot;, URL: bosterbio.com). View first 500 chars of response and extracted cost (top-level and per-task).
            </p>
            <div className="space-y-4">
              {COST_RESEARCH_APIS.map((api) => (
                <div key={api.id} className="border border-base-300 rounded-lg p-4">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <h3 className="font-semibold">{api.name}</h3>
                    <button
                      type="button"
                      onClick={() => handleCostResearch(api)}
                      disabled={loading[`cost-${api.id}`]}
                      className="btn btn-primary btn-sm gap-2"
                    >
                      {loading[`cost-${api.id}`] ? (
                        <>
                          <Loader className="w-4 h-4 animate-spin" />
                          Running...
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4" />
                          Run
                        </>
                      )}
                    </button>
                  </div>
                  {costResearchResults[api.id] && (
                    <div className="mt-3 space-y-2 text-sm">
                      {costResearchResults[api.id].error ? (
                        <div className="alert alert-error py-2">
                          <span>{costResearchResults[api.id].error}</span>
                        </div>
                      ) : (
                        <>
                          <div className="flex flex-wrap gap-4">
                            <span><strong>Cost (total USD):</strong> {costResearchResults[api.id].cost != null ? costResearchResults[api.id].cost : "—"}</span>
                            {Array.isArray(costResearchResults[api.id].taskCosts) && costResearchResults[api.id].taskCosts.length > 0 && (
                              <span><strong>Per-task costs:</strong> [{costResearchResults[api.id].taskCosts.join(", ")}]</span>
                            )}
                            {costResearchResults[api.id].fullLength != null && (
                              <span><strong>Response length:</strong> {costResearchResults[api.id].fullLength} chars</span>
                            )}
                          </div>
                          <div>
                            <strong>First 500 chars of response:</strong>
                            <pre className="mt-1 p-2 bg-base-200 rounded text-xs overflow-x-auto whitespace-pre-wrap break-all max-h-32 overflow-y-auto">
                              {costResearchResults[api.id].rawFirst500 ?? "—"}
                            </pre>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Seed Keyword and URL Input */}
        <div className="card bg-base-100 shadow-xl mb-6">
          <div className="card-body">
            <h2 className="card-title text-xl mb-4">Inputs for Available APIs</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold">Seed Keyword</span>
                  <span className="label-text-alt">Used for APIs that require a keyword</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered"
                  value={seedKeyword}
                  onChange={(e) => setSeedKeyword(e.target.value)}
                  placeholder="Enter seed keyword (e.g., peptide synthesis)"
                />
              </div>
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold">Seed URL</span>
                  <span className="label-text-alt">Used for APIs that require a URL</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered"
                  value={seedUrl}
                  onChange={(e) => setSeedUrl(e.target.value)}
                  placeholder="Enter URL (e.g., https://example.com)"
                />
              </div>
            </div>
          </div>
        </div>

        {/* API List */}
        <div className="card bg-base-100 shadow-xl mb-6">
          <div className="card-body">
            <h2 className="card-title text-xl mb-4">Available APIs</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {DATA_FOR_SEO_APIS.map((api) => (
                <div
                  key={api.id}
                  className="border border-base-300 rounded-lg p-4 hover:border-primary transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg">{api.name}</h3>
                      <p className="text-sm text-base-content/60 mt-1">
                        {api.description}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    {api.needsKeyword && (
                      <span className="badge badge-sm badge-info">Requires Keyword</span>
                    )}
                    {api.needsUrl && (
                      <span className="badge badge-sm badge-warning">Requires URL</span>
                    )}
                    {api.defaultPayload !== null && (
                      <button
                        onClick={() => handleTestApi(api)}
                        disabled={loading[api.id] ||
                          (api.needsKeyword && !seedKeyword.trim()) ||
                          (api.needsUrl && !seedUrl.trim())}
                        className="btn btn-primary btn-sm flex-1 gap-2"
                      >
                        {loading[api.id] ? (
                          <>
                            <Loader className="w-4 h-4 animate-spin" />
                            Testing...
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4" />
                            Test API
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Responses - Waterfall */}
        {responses.length > 0 && (
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <div className="flex items-center justify-between mb-4">
                <h2 className="card-title text-xl">API Responses</h2>
                <button
                  onClick={() => setResponses([])}
                  className="btn btn-sm btn-ghost"
                >
                  Clear All
                </button>
              </div>
              <div className="space-y-4">
                {responses.map((response) => (
                  <div
                    key={response.id}
                    className={`border rounded-lg overflow-hidden ${
                      response.success
                        ? "border-success bg-success/5"
                        : "border-error bg-error/5"
                    }`}
                  >
                    {/* Response Header */}
                    <div
                      className="p-4 cursor-pointer hover:bg-base-200 transition-colors"
                      onClick={() => toggleExpanded(response.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {expanded[response.id] ? (
                            <ChevronUp className="w-5 h-5" />
                          ) : (
                            <ChevronDown className="w-5 h-5" />
                          )}
                          <div>
                            <h3 className="font-semibold">{response.api.name}</h3>
                            <p className="text-sm text-base-content/60">
                              {new Date(response.timestamp).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {response.success !== false ? (
                            <span className="badge badge-success">
                              {response.status || "Success"}
                            </span>
                          ) : (
                            <span className="badge badge-error">Error</span>
                          )}
                          {response.responseSize && (
                            <span className="badge badge-outline">
                              {response.responseSize.toLocaleString()} chars
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Expanded Content */}
                    {expanded[response.id] && (
                      <div className="border-t border-base-300 p-4 space-y-4">
                        {/* Endpoint */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-semibold text-sm">Endpoint</h4>
                            <button
                              onClick={() => handleCopy(response.endpoint, `${response.id}-endpoint`)}
                              className="btn btn-xs btn-ghost gap-1"
                            >
                              {copied[`${response.id}-endpoint`] ? (
                                <Check className="w-3 h-3" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                          <code className="block bg-base-200 p-2 rounded text-xs overflow-x-auto">
                            {response.endpoint}
                          </code>
                        </div>

                        {/* Payload */}
                        {response.payload && (
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="font-semibold text-sm">Request Payload</h4>
                              <button
                                onClick={() => handleCopy(formatJson(response.payload), `${response.id}-payload`)}
                                className="btn btn-xs btn-ghost gap-1"
                              >
                                {copied[`${response.id}-payload`] ? (
                                  <Check className="w-3 h-3" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                            <pre className="bg-base-200 p-3 rounded text-xs overflow-x-auto max-h-64 overflow-y-auto">
                              {formatJson(response.payload)}
                            </pre>
                          </div>
                        )}

                        {/* Parsed Response */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-semibold text-sm">Parsed Response</h4>
                            <button
                              onClick={() => handleCopy(formatJson(response.response), `${response.id}-response`)}
                              className="btn btn-xs btn-ghost gap-1"
                            >
                              {copied[`${response.id}-response`] ? (
                                <Check className="w-3 h-3" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                          <pre className="bg-base-200 p-3 rounded text-xs overflow-x-auto max-h-96 overflow-y-auto">
                            {formatJson(response.response)}
                          </pre>
                        </div>

                        {/* Raw API Response */}
                        {response.rawApiResponse && (
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="font-semibold text-sm">Raw API Response</h4>
                              <button
                                onClick={() => handleCopy(formatJson(response.rawApiResponse), `${response.id}-raw-response`)}
                                className="btn btn-xs btn-ghost gap-1"
                              >
                                {copied[`${response.id}-raw-response`] ? (
                                  <Check className="w-3 h-3" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                            <pre className="bg-base-200 p-3 rounded text-xs overflow-x-auto max-h-96 overflow-y-auto">
                              {formatJson(response.rawApiResponse)}
                            </pre>
                          </div>
                        )}

                        {/* Error */}
                        {response.error && (
                          <div className="alert alert-error">
                            <X className="w-5 h-5" />
                            <span>{response.error}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

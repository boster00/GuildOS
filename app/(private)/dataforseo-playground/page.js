"use client";

import { useState } from "react";
import { Loader, ChevronDown, ChevronUp, Play, Copy, Check, X } from "lucide-react";
import { initMonkey } from "@/libs/monkey";

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
        location_code: process.env.NEXT_PUBLIC_DATAFORSEO_DEFAULT_LOCATION ? parseInt(process.env.NEXT_PUBLIC_DATAFORSEO_DEFAULT_LOCATION, 10) : 2840,
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
        location_code: process.env.NEXT_PUBLIC_DATAFORSEO_DEFAULT_LOCATION ? parseInt(process.env.NEXT_PUBLIC_DATAFORSEO_DEFAULT_LOCATION, 10) : 2840,
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
        location_code: process.env.NEXT_PUBLIC_DATAFORSEO_DEFAULT_LOCATION ? parseInt(process.env.NEXT_PUBLIC_DATAFORSEO_DEFAULT_LOCATION, 10) : 2840,
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
        location_code: process.env.NEXT_PUBLIC_DATAFORSEO_DEFAULT_LOCATION ? parseInt(process.env.NEXT_PUBLIC_DATAFORSEO_DEFAULT_LOCATION, 10) : 2840,
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
        location_code: process.env.NEXT_PUBLIC_DATAFORSEO_DEFAULT_LOCATION ? parseInt(process.env.NEXT_PUBLIC_DATAFORSEO_DEFAULT_LOCATION, 10) : 2840,
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
        location_code: process.env.NEXT_PUBLIC_DATAFORSEO_DEFAULT_LOCATION ? parseInt(process.env.NEXT_PUBLIC_DATAFORSEO_DEFAULT_LOCATION, 10) : 2840,
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

export default function DataForSeoPlayground() {
  const [seedKeyword, setSeedKeyword] = useState("peptide synthesis");
  const [seedUrl, setSeedUrl] = useState("https://en.wikipedia.org/wiki/Cancer");
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState({});
  const [expanded, setExpanded] = useState({});
  const [copied, setCopied] = useState({});

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
        delete next[responseId];
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

  return (
    <div className="min-h-screen bg-base-200 py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="card bg-base-100 shadow-xl mb-6">
          <div className="card-body">
            <h1 className="card-title text-3xl">DataForSEO API Playground</h1>
            <p className="text-base-content/60">
              Test various DataForSEO API endpoints. Click an API to test it with default payloads.
            </p>
          </div>
        </div>

        {/* Seed Keyword and URL Input */}
        <div className="card bg-base-100 shadow-xl mb-6">
          <div className="card-body">
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

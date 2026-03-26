// ARCHIVED: Original path was components/PlaygroundForTesting.js

"use client";

import { useState, useEffect } from "react";
import { initMonkey } from "@/libs/monkey";
import CreditCostBadge from "@/components/CreditCostBadge";

export default function PlaygroundForTesting() {
  const [input, setInput] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [monkey, setMonkey] = useState(null);
  const [rankingLimit, setRankingLimit] = useState(20);
  const [positionInput, setPositionInput] = useState({ keyword: "", url: "" });
  const [relatedDepth, setRelatedDepth] = useState(0);
  const [relatedLimit, setRelatedLimit] = useState(100);

  useEffect(() => {
    async function initializeMonkey() {
      try {
        const m = await initMonkey(true);
        setMonkey(m);
      } catch (err) {
        console.error("Failed to initialize monkey:", err);
        setError("Failed to initialize. Please refresh the page.");
      }
    }
    initializeMonkey();
  }, []);

  // Helper function to parse input (keywords or URLs)
  const parseInput = (inputText) => {
    if (!inputText || typeof inputText !== 'string' || !inputText.trim()) {
      return [];
    }
    // Split by newlines, commas, or semicolons, then trim and filter empty
    return inputText
      .split(/[\n,;]/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  };

  // DataForSEO API via monkey.apiCall
  const dataForSEOApiCall = async (endpoint, payload) => {
    try {
      const m = monkey || (await initMonkey());
      const text = await m.apiCall(`/api/dataforseo/${endpoint}`, payload);
      const data = JSON.parse(text);
      if (data.error) throw new Error(data.error || `API error`);
      return data;
    } catch (err) {
      console.error(`DataForSEO ${endpoint} error:`, err);
      throw err;
    }
  };

  // 1. Get search volumes for keywords
  const handleGetSearchVolumes = async () => {
    const keywords = parseInput(input);
    if (keywords.length === 0) {
      setError("Please enter at least one keyword");
      return;
    }

    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const data = await dataForSEOApiCall("search-volume", { keywords });
      setResults({
        type: "search-volume",
        data: data,
        input: keywords,
      });
    } catch (err) {
      setError(err.message || "Failed to fetch search volumes");
    } finally {
      setLoading(false);
    }
  };

  // 2. Get ranking keywords for URLs
  const handleGetRankingKeywords = async () => {
    const urls = parseInput(input);
    if (urls.length === 0) {
      setError("Please enter at least one URL");
      return;
    }

    // Validate URLs
    const invalidUrls = urls.filter(
      (url) => !url.startsWith("http://") && !url.startsWith("https://")
    );
    if (invalidUrls.length > 0) {
      setError(
        `Invalid URLs detected. Please include http:// or https://: ${invalidUrls.join(", ")}`
      );
      return;
    }

    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const data = await dataForSEOApiCall("ranking-keywords", { 
        urls,
        limit: parseInt(rankingLimit) || 20 
      });
      setResults({
        type: "ranking-keywords",
        data: data,
        input: urls,
      });
    } catch (err) {
      setError(err.message || "Failed to fetch ranking keywords");
    } finally {
      setLoading(false);
    }
  };

  // 3. Get related keywords
  const handleGetRelatedKeywords = async () => {
    const keywords = parseInput(input);
    if (keywords.length === 0) {
      setError("Please enter at least one keyword");
      return;
    }

    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const data = await dataForSEOApiCall("related-keywords", { 
        keywords,
        depth: parseInt(relatedDepth) || 0,
        limit: parseInt(relatedLimit) || 100
      });
      setResults({
        type: "related-keywords",
        data: data,
        input: keywords,
      });
    } catch (err) {
      setError(err.message || "Failed to fetch related keywords");
    } finally {
      setLoading(false);
    }
  };

  // 4. Check keyword position for URL
  const handleCheckKeywordPosition = async () => {
    const { keyword, url } = positionInput;
    if (!keyword || !keyword.trim()) {
      setError("Please enter a keyword");
      return;
    }
    if (!url || !url.trim()) {
      setError("Please enter a URL");
      return;
    }

    // Validate URL
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      setError("URL must include http:// or https://");
      return;
    }

    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const data = await dataForSEOApiCall("keyword-position", {
        keyword: keyword.trim(),
        url: url.trim(),
      });
      setResults({
        type: "keyword-position",
        data: data,
        input: { keyword, url },
      });
    } catch (err) {
      setError(err.message || "Failed to check keyword position");
    } finally {
      setLoading(false);
    }
  };

  // Render results based on type
  const renderResults = () => {
    if (!results) return null;

    const { type, data, input: inputData } = results;

    switch (type) {
      case "search-volume":
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Search Volume Results</h3>
            <div className="overflow-x-auto">
              <table className="table table-zebra w-full">
                 <thead>
                   <tr>
                     <th>Keyword</th>
                     <th>Search Volume</th>
                   </tr>
                 </thead>
                 <tbody>
                   {data.results?.map((item, idx) => (
                     <tr key={idx}>
                       <td className="font-medium">{item.keyword}</td>
                       <td>{item.search_volume?.toLocaleString() || "N/A"}</td>
                     </tr>
                   )) || (
                     <tr>
                       <td colSpan="2" className="text-center text-gray-500">
                         No results found
                       </td>
                     </tr>
                   )}
                </tbody>
              </table>
            </div>
            {data.rawResponse && (
              <div className="mt-6">
                <h4 className="text-md font-semibold mb-2">Raw JSON Response</h4>
                <pre className="bg-base-200 p-4 rounded-lg overflow-auto text-xs max-h-96">
                  {JSON.stringify(data.rawResponse, null, 2)}
                </pre>
              </div>
            )}
          </div>
        );

      case "ranking-keywords":
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Ranking Keywords Results</h3>
            {data.results?.map((urlResult, urlIdx) => (
              <div key={urlIdx} className="card card-border bg-base-100">
                <div className="card-body">
                  <h4 className="card-title text-sm">
                    {urlResult.url || inputData[urlIdx]}
                  </h4>
                  {urlResult.keywords && urlResult.keywords.length > 0 ? (
                    <>
                      <div className="text-xs text-gray-500 mb-2">
                        Showing {urlResult.keywords.length} of {urlResult.total_available || urlResult.keywords.length} keywords
                      </div>
                      <div className="overflow-x-auto">
                        <table className="table table-sm">
                          <thead>
                            <tr>
                              <th>Position</th>
                              <th>Keyword</th>
                              <th>Search Volume</th>
                              <th>CPC</th>
                              <th>Competition</th>
                            </tr>
                          </thead>
                          <tbody>
                            {urlResult.keywords.map((kw, kwIdx) => (
                              <tr key={kwIdx}>
                                <td>
                                  {kw.position !== null ? (
                                    <span className={`badge ${kw.position <= 3 ? 'badge-success' : kw.position <= 10 ? 'badge-warning' : 'badge-error'}`}>
                                      #{kw.position}
                                    </span>
                                  ) : (
                                    <span className="text-gray-400">N/A</span>
                                  )}
                                </td>
                                <td className="font-medium">{kw.keyword}</td>
                                <td>{kw.search_volume?.toLocaleString() || "N/A"}</td>
                                <td>{kw.cpc ? `$${kw.cpc.toFixed(2)}` : "N/A"}</td>
                                <td>{kw.competition !== null ? (kw.competition * 100).toFixed(0) + "%" : "N/A"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  ) : (
                    <p className="text-gray-500">No ranking keywords found</p>
                  )}
                </div>
              </div>
            )) || (
              <p className="text-gray-500">No results found</p>
            )}
            {data.rawResponse && (
              <div className="mt-6">
                <h4 className="text-md font-semibold mb-2">Raw JSON Response</h4>
                <pre className="bg-base-200 p-4 rounded-lg overflow-auto text-xs max-h-96">
                  {JSON.stringify(data.rawResponse, null, 2)}
                </pre>
              </div>
            )}
          </div>
        );

      case "related-keywords":
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Related Keywords Results</h3>
            {data.results?.map((keywordResult, kwIdx) => (
              <div key={kwIdx} className="card card-border bg-base-100">
                <div className="card-body">
                  <h4 className="card-title text-sm">
                    Related to: {keywordResult.keyword || inputData[kwIdx]}
                  </h4>
                  
                  {/* Show seed keyword data if available */}
                  {keywordResult.seed_keyword_data && (
                    <div className="mb-4 p-3 bg-base-200 rounded-lg">
                      <h5 className="text-sm font-semibold mb-2">Seed Keyword Data</h5>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                        <div>
                          <span className="text-gray-500">Search Volume:</span>
                          <span className="ml-1 font-medium">
                            {keywordResult.seed_keyword_data.search_volume?.toLocaleString() || "N/A"}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500">CPC:</span>
                          <span className="ml-1 font-medium">
                            {keywordResult.seed_keyword_data.cpc ? `$${keywordResult.seed_keyword_data.cpc.toFixed(2)}` : "N/A"}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500">Competition:</span>
                          <span className="ml-1 font-medium">
                            {keywordResult.seed_keyword_data.competition !== null && keywordResult.seed_keyword_data.competition !== undefined
                              ? (keywordResult.seed_keyword_data.competition * 100).toFixed(0) + "%"
                              : "N/A"}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {keywordResult.related && keywordResult.related.length > 0 ? (
                    <>
                      <div className="text-xs text-gray-500 mb-2">
                        Found {keywordResult.total_related || keywordResult.related.length} related keywords
                        {keywordResult.related[0]?.search_volume === null && (
                          <span className="ml-2 text-warning">(Metrics not available for related keywords)</span>
                        )}
                      </div>
                      <div className="overflow-x-auto">
                        <table className="table table-sm">
                          <thead>
                            <tr>
                              <th>Keyword</th>
                              <th>Search Volume</th>
                              <th>CPC</th>
                              <th>Competition</th>
                            </tr>
                          </thead>
                          <tbody>
                            {keywordResult.related.map((related, relIdx) => (
                              <tr key={relIdx}>
                                <td className="font-medium">{related.keyword}</td>
                                <td>{related.search_volume?.toLocaleString() || "N/A"}</td>
                                <td>{related.cpc ? `$${related.cpc.toFixed(2)}` : "N/A"}</td>
                                <td>
                                  {related.competition !== null && related.competition !== undefined
                                    ? (related.competition * 100).toFixed(0) + "%"
                                    : related.competition_index !== null && related.competition_index !== undefined
                                    ? (related.competition_index * 100).toFixed(0) + "%"
                                    : "N/A"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  ) : (
                    <p className="text-gray-500">No related keywords found</p>
                  )}
                </div>
              </div>
            )) || (
              <p className="text-gray-500">No results found</p>
            )}
            {data.rawResponse && (
              <div className="mt-6">
                <h4 className="text-md font-semibold mb-2">Raw JSON Response</h4>
                <pre className="bg-base-200 p-4 rounded-lg overflow-auto text-xs max-h-96">
                  {JSON.stringify(data.rawResponse, null, 2)}
                </pre>
              </div>
            )}
          </div>
        );

      case "keyword-position":
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Keyword Position Results</h3>
            <div className="card card-border bg-base-100">
              <div className="card-body">
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-600">Keyword:</p>
                    <p className="font-semibold">{inputData.keyword}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">URL:</p>
                    <p className="font-semibold break-all">{inputData.url}</p>
                  </div>
                  {data.position !== null ? (
                    <div className="alert alert-success">
                      <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div>
                        <h4 className="font-bold">Found at Position: {data.position}</h4>
                        {data.result && (
                          <div className="mt-2 text-sm">
                            <p><strong>Title:</strong> {data.result.title}</p>
                            <p><strong>Domain:</strong> {data.result.domain}</p>
                            {data.result.description && (
                              <p><strong>Description:</strong> {data.result.description}</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="alert alert-warning">
                      <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <span>URL not found in top 100 search results for this keyword</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            {data.rawResponse && (
              <div className="mt-6">
                <h4 className="text-md font-semibold mb-2">Raw JSON Response</h4>
                <pre className="bg-base-200 p-4 rounded-lg overflow-auto text-xs max-h-96">
                  {JSON.stringify(data.rawResponse, null, 2)}
                </pre>
              </div>
            )}
          </div>
        );

      default:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Results</h3>
            <pre className="bg-base-200 p-4 rounded-lg overflow-auto">
              {JSON.stringify(data, null, 2)}
            </pre>
          </div>
        );
    }
  };

  return (
    <div className="flex h-screen w-full gap-4 p-4">
      {/* Left Panel */}
      <div className="w-1/3 flex flex-col gap-4">
        <div className="card card-border bg-base-100">
          <div className="card-body">
            <h2 className="card-title">Test Input</h2>
            <textarea
              className="textarea textarea-bordered w-full h-64"
              placeholder="Enter keywords or URLs (one per line, or separated by commas/semicolons)"
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <div className="text-sm text-gray-500 mt-2">
              <p>• For keywords: Enter one keyword per line</p>
              <p>• For URLs: Include http:// or https://</p>
            </div>
          </div>
        </div>

        <div className="card card-border bg-base-100">
          <div className="card-body">
            <h2 className="card-title">DataForSEO Functions</h2>
            <div className="space-y-3">
              <button
                className="btn btn-primary btn-block"
                onClick={handleGetSearchVolumes}
                disabled={loading || !monkey}
              >
                Get Search Volumes
              </button>
              <div className="text-xs text-gray-500">
                Enter keywords to get their monthly search volumes, CPC, and
                competition data
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text text-xs">Result Limit</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={rankingLimit}
                  onChange={(e) => setRankingLimit(e.target.value)}
                  className="input input-bordered input-sm"
                  placeholder="20"
                />
              </div>
              <button
                className="btn btn-secondary btn-block flex items-center justify-center gap-2"
                onClick={handleGetRankingKeywords}
                disabled={loading || !monkey}
              >
                Get Ranking Keywords
                <CreditCostBadge path="/api/dataforseo/ranking-keywords" size="sm" />
              </button>
              <div className="text-xs text-gray-500">
                Enter URLs to see what keywords they are currently ranking for
                in search results (default: top 20)
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text text-xs">Depth (0-4)</span>
                </label>
                <input
                  type="number"
                  min="0"
                  max="4"
                  value={relatedDepth}
                  onChange={(e) => setRelatedDepth(e.target.value)}
                  className="input input-bordered input-sm"
                  placeholder="0"
                />
                <label className="label">
                  <span className="label-text-alt text-xs">Higher depth = more expansion</span>
                </label>
              </div>
              <div className="form-control">
                <label className="label">
                  <span className="label-text text-xs">Result Limit</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="1000"
                  value={relatedLimit}
                  onChange={(e) => setRelatedLimit(e.target.value)}
                  className="input input-bordered input-sm"
                  placeholder="100"
                />
              </div>
              <button
                className="btn btn-accent btn-block flex items-center justify-center gap-2"
                onClick={handleGetRelatedKeywords}
                disabled={loading || !monkey}
              >
                Get Related Keywords
                <CreditCostBadge path="/api/dataforseo/related-keywords" size="sm" />
              </button>
              <div className="text-xs text-gray-500">
                Enter keywords to find semantically related keywords and their
                search volumes (depth 0 = direct related, higher = more expansion)
              </div>

              <div className="divider"></div>

              <h3 className="text-sm font-semibold">Check Keyword Position</h3>
              <div className="form-control">
                <label className="label">
                  <span className="label-text text-xs">Keyword</span>
                </label>
                <input
                  type="text"
                  value={positionInput.keyword}
                  onChange={(e) => setPositionInput({ ...positionInput, keyword: e.target.value })}
                  className="input input-bordered input-sm"
                  placeholder="Enter keyword"
                />
              </div>
              <div className="form-control">
                <label className="label">
                  <span className="label-text text-xs">URL</span>
                </label>
                <input
                  type="text"
                  value={positionInput.url}
                  onChange={(e) => setPositionInput({ ...positionInput, url: e.target.value })}
                  className="input input-bordered input-sm"
                  placeholder="https://example.com"
                />
              </div>
              <button
                className="btn btn-info btn-block"
                onClick={handleCheckKeywordPosition}
                disabled={loading || !monkey}
              >
                Check Position
              </button>
              <div className="text-xs text-gray-500">
                Check what position a URL ranks for a specific keyword (top 100)
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel */}
      <div className="w-2/3 flex flex-col gap-4">
        <div className="card card-border bg-base-100 flex-1">
          <div className="card-body overflow-auto">
            <h2 className="card-title">Results</h2>
            {loading && (
              <div className="flex justify-center items-center h-full">
                <span className="loading loading-spinner loading-lg"></span>
              </div>
            )}
            {error && (
              <div className="alert alert-error">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="stroke-current shrink-0 h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span>{error}</span>
              </div>
            )}
            {!loading && !error && renderResults()}
            {!loading && !error && !results && (
              <div className="text-center text-gray-500 py-8">
                Select a function above to see results here
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


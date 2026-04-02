"use client";

import React, { useState } from "react";
import { initMonkey } from "@/libs/monkey";

const ROWS = [
  {
    id: "saveArticle",
    method: "monkey.saveArticle",
    endpoint: "POST /api/content-magic/save",
    payload: {
      articleId: "06e4231d-d46b-498b-90d7-5b4c9c8fdaba",
      title: "Test title",
      contentHtml: "<p>Test content</p>",
      sourceUrl: null,
    },
    expected: { success: true, articleId: "06e4231d-d46b-498b-90d7-5b4c9c8fdaba" },
  },
  {
    id: "getCampaignWithDetails",
    method: "monkey.getCampaignWithDetails",
    endpoint: "POST /api/monkey/campaign-with-details",
    payload: { campaignId: "9ac0c727-9886-445e-9715-914d453a61ee" },
    expected: "{ campaign: { id, name, icp, offer, outcome, ... } } or null",
  },
  {
    id: "saveCustomCss",
    method: "monkey.saveCustomCss",
    endpoint: "POST /api/settings/custom-css",
    payload: {
      css: "/* test */ .x { color: red; }",
      external_css_links: [],
    },
    expected: { success: true, message: "Custom CSS saved successfully" },
  },
  {
    id: "refreshGeoReport",
    method: "monkey.articleAssets.refreshGeoReport",
    endpoint: "POST /api/content-magic/ai-optimization-score",
    payload: { articleId: "06e4231d-d46b-498b-90d7-5b4c9c8fdaba", contentHtml: "<p>Sample article</p>" },
    expected: { success: true, score: "number", rationale: "object" },
  },
  {
    id: "savePatch",
    method: "monkey.articleAssets.savePatch",
    endpoint: "POST /api/content-magic/save-assets",
    payload: {
      articleId: "06e4231d-d46b-498b-90d7-5b4c9c8fdaba",
      patch: { main_keyword: "test keyword" },
      currentAssets: {},
    },
    expected: "merged assets object",
  },
];

function stringifySafe(obj) {
  try {
    if (obj === undefined || obj === null) return String(obj);
    if (typeof obj === "string") return obj;
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj);
  }
}

export default function TestApisPage() {
  const [results, setResults] = useState({});
  const [running, setRunning] = useState(null);

  const runTest = async (row) => {
    setRunning(row.id);
    setResults((prev) => ({ ...prev, [row.id]: { status: "running" } }));
    try {
      const monkey = await initMonkey();
      let actual;
      switch (row.id) {
        case "saveArticle": {
          actual = await monkey.saveArticle({
            articleId: "06e4231d-d46b-498b-90d7-5b4c9c8fdaba",
            title: "Test",
            contentHtml: "<p>Test</p>",
          });
          break;
        }
        case "getCampaignWithDetails": {
          actual = await monkey.getCampaignWithDetails(
            "9ac0c727-9886-445e-9715-914d453a61ee"
          );
          break;
        }
        case "saveCustomCss": {
          actual = await monkey.saveCustomCss({
            css: "/* test */ .x { color: red; }",
            external_css_links: [],
          });
          break;
        }
        case "refreshGeoReport": {
          actual = await monkey.articleAssets.refreshGeoReport(
            "06e4231d-d46b-498b-90d7-5b4c9c8fdaba",
            "<p>Sample</p>"
          );
          break;
        }
        case "savePatch": {
          actual = await monkey.articleAssets.savePatch(
            "06e4231d-d46b-498b-90d7-5b4c9c8fdaba",
            { main_keyword: "test" },
            {},
            null
          );
          break;
        }
        default:
          actual = { error: "Unknown test" };
      }
      setResults((prev) => ({
        ...prev,
        [row.id]: { status: "ok", data: actual },
      }));
    } catch (err) {
      setResults((prev) => ({
        ...prev,
        [row.id]: {
          status: "error",
          message: err?.message || String(err),
        },
      }));
    } finally {
      setRunning(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Test APIs / Monkey methods
        </h1>
        <p className="text-sm text-gray-600 mb-6">
          Centralized endpoints and monkey methods. Use Run to call with
          placeholder IDs (401/404 expected if not logged in or IDs invalid).
        </p>
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-100 border-b border-gray-200">
                  <th className="text-left p-3 font-semibold text-gray-700 w-48">
                    Endpoint / Method
                  </th>
                  <th className="text-left p-3 font-semibold text-gray-700 min-w-[200px]">
                    Example request payload
                  </th>
                  <th className="text-left p-3 font-semibold text-gray-700 min-w-[180px]">
                    Expected output
                  </th>
                  <th className="text-left p-3 font-semibold text-gray-700 min-w-[220px]">
                    Actual result
                  </th>
                  <th className="text-left p-3 font-semibold text-gray-700 w-20">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map((row) => {
                  const res = results[row.id];
                  return (
                    <tr
                      key={row.id}
                      className="border-b border-gray-100 hover:bg-gray-50/50"
                    >
                      <td className="p-3 align-top">
                        <div className="font-mono text-xs text-gray-800">
                          {row.method}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {row.endpoint}
                        </div>
                      </td>
                      <td className="p-3 align-top">
                        <pre className="text-xs bg-gray-50 p-2 rounded overflow-x-auto max-h-32 overflow-y-auto whitespace-pre-wrap font-mono text-gray-700">
                          {stringifySafe(row.payload)}
                        </pre>
                      </td>
                      <td className="p-3 align-top">
                        <pre className="text-xs bg-blue-50 p-2 rounded overflow-x-auto max-h-32 overflow-y-auto whitespace-pre-wrap font-mono text-blue-900">
                          {stringifySafe(row.expected)}
                        </pre>
                      </td>
                      <td className="p-3 align-top">
                        {res?.status === "running" && (
                          <span className="text-amber-600 text-xs">
                            Running…
                          </span>
                        )}
                        {res?.status === "ok" && (
                          <pre className="text-xs bg-green-50 p-2 rounded overflow-x-auto max-h-32 overflow-y-auto whitespace-pre-wrap font-mono text-green-900">
                            {stringifySafe(res.data)}
                          </pre>
                        )}
                        {res?.status === "error" && (
                          <pre className="text-xs bg-red-50 p-2 rounded overflow-x-auto max-h-32 overflow-y-auto whitespace-pre-wrap font-mono text-red-800">
                            {res.message}
                          </pre>
                        )}
                        {!res && (
                          <span className="text-gray-400 text-xs">
                            Click Run
                          </span>
                        )}
                      </td>
                      <td className="p-3 align-top">
                        <button
                          type="button"
                          onClick={() => runTest(row)}
                          disabled={running !== null}
                          className="px-2 py-1 text-xs font-medium rounded bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {running === row.id ? "…" : "Run"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

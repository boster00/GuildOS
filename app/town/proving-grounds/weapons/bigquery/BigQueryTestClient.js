"use client";

import { useState } from "react";

async function callApi(body) {
  const res = await fetch("/api/weapon/bigquery", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

export default function BigQueryTestClient() {
  const [credResult, setCredResult] = useState(null);
  const [helloResult, setHelloResult] = useState(null);
  const [eventsResult, setEventsResult] = useState(null);
  const [datasetId, setDatasetId] = useState("");
  const [tableId, setTableId] = useState("");
  const [limit, setLimit] = useState("10");

  return (
    <div className="mt-6 space-y-6">
      {/* Credential Check */}
      <div>
        <button
          id="bigquery-cred-check-btn"
          className="btn btn-sm btn-primary"
          onClick={async () => {
            setCredResult("Loading...");
            const data = await callApi({ action: "checkCredentials" });
            setCredResult(data);
          }}
        >
          Check Credentials
        </button>
        <pre id="bigquery-cred-check-result" className="mt-2 max-h-40 overflow-auto rounded bg-base-200 p-3 text-xs">
          {credResult ? JSON.stringify(credResult, null, 2) : "—"}
        </pre>
      </div>

      {/* List Datasets */}
      <div>
        <button
          id="bigquery-hello-btn"
          className="btn btn-sm btn-secondary"
          onClick={async () => {
            setHelloResult("Loading...");
            const data = await callApi({ action: "listDatasets" });
            setHelloResult(data);
          }}
        >
          List Datasets
        </button>
        <pre id="bigquery-hello-result" className="mt-2 max-h-60 overflow-auto rounded bg-base-200 p-3 text-xs">
          {helloResult ? JSON.stringify(helloResult, null, 2) : "—"}
        </pre>
      </div>

      {/* Get Recent Events */}
      <div>
        <div className="flex flex-wrap gap-2">
          <input
            className="input input-bordered input-sm w-48"
            placeholder="datasetId"
            value={datasetId}
            onChange={(e) => setDatasetId(e.target.value)}
          />
          <input
            className="input input-bordered input-sm w-48"
            placeholder="tableId"
            value={tableId}
            onChange={(e) => setTableId(e.target.value)}
          />
          <input
            className="input input-bordered input-sm w-24"
            placeholder="limit"
            type="number"
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
          />
        </div>
        <button
          id="bigquery-getRecentEvents-btn"
          className="btn btn-sm btn-accent mt-2"
          onClick={async () => {
            setEventsResult("Loading...");
            const data = await callApi({
              action: "getRecentEvents",
              datasetId,
              tableId,
              limit: Number(limit) || 10,
            });
            setEventsResult(data);
          }}
        >
          Get Recent Events
        </button>
        <pre id="bigquery-getRecentEvents-result" className="mt-2 max-h-80 overflow-auto rounded bg-base-200 p-3 text-xs">
          {eventsResult ? JSON.stringify(eventsResult, null, 2) : "—"}
        </pre>
      </div>
    </div>
  );
}

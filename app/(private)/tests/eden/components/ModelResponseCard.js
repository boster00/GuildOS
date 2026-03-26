"use client";

import { useState } from "react";
import { Copy, ChevronDown, ChevronUp } from "lucide-react";

export default function ModelResponseCard({ modelId, label, text, usage, latencyMs, requestId, rawPreview, cost, error }) {
  const [rawOpen, setRawOpen] = useState(false);
  const copyRequestId = () => {
    if (requestId) navigator.clipboard.writeText(requestId);
  };
  return (
    <div className="card bg-base-100 border border-base-300 shadow-sm">
      <div className="card-body p-4">
        <div className="flex justify-between items-start gap-2">
          <h3 className="font-semibold text-base">{label || modelId}</h3>
          {requestId && (
            <button
              type="button"
              className="btn btn-ghost btn-xs gap-1"
              onClick={copyRequestId}
              title="Copy request ID"
            >
              <Copy className="w-3 h-3" />
              <span className="font-mono text-xs">{requestId.slice(0, 8)}...</span>
            </button>
          )}
        </div>
        {error ? (
          <p className="text-error text-sm">{error}</p>
        ) : (
          <>
            <pre className="text-sm whitespace-pre-wrap break-words bg-base-200 p-3 rounded-lg max-h-64 overflow-auto">
              {text || "(no text)"}
            </pre>
            <div className="flex flex-wrap gap-3 text-xs text-base-content/70">
              {usage && (
                <span>
                  Tokens: in {usage.prompt_tokens ?? usage.input_tokens ?? "—"} / out{" "}
                  {usage.completion_tokens ?? usage.output_tokens ?? "—"}
                </span>
              )}
              {latencyMs != null && <span>{latencyMs} ms</span>}
              {cost != null && <span>Cost: {cost}</span>}
            </div>
          </>
        )}
        {rawPreview && (
          <div className="mt-2">
            <button
              type="button"
              className="btn btn-ghost btn-sm gap-1"
              onClick={() => setRawOpen(!rawOpen)}
            >
              {rawOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              Raw response
            </button>
            {rawOpen && (
              <pre className="mt-1 text-xs bg-base-200 p-2 rounded overflow-auto max-h-48">
                {rawPreview}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

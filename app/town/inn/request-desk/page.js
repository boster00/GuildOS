"use client";

import Link from "next/link";
import { useState } from "react";

const DEMO_REQUEST = "Get me the 10 most recent sales orders from Zoho Books.";

export default function RequestDeskPage() {
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  async function handleSubmit() {
    setSubmitting(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch("/api/quest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: body }),
      });

      if (!res.ok) {
        const text = await res.text();
        setError(text || `Request failed (${res.status})`);
        return;
      }

      const json = await res.json();
      setResult(json);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="guild-bg-inn min-h-dvh p-8">
      <section className="mx-auto max-w-3xl rounded-3xl border border-base-300 bg-base-100/90 p-6 shadow-xl backdrop-blur">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Request Desk</h1>
            <p className="text-sm text-base-content/70">
              Describe what you need in plain language. It will become a quest in the <strong>idea</strong> stage, assigned to the questmaster.
            </p>
          </div>
          <Link href="/town/inn" className="btn btn-sm">
            Back to Inn
          </Link>
        </div>

        <div className="space-y-4">
          <div className="flex gap-2">
            <button
              type="button"
              className="btn btn-sm btn-outline btn-primary"
              onClick={() => setBody(DEMO_REQUEST)}
            >
              Load Demo
            </button>
          </div>

          <textarea
            className="textarea textarea-bordered w-full text-sm"
            rows={4}
            placeholder="Describe what you need in plain language..."
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />

          <button
            type="button"
            className="btn btn-primary"
            disabled={submitting || !body.trim()}
            onClick={handleSubmit}
          >
            {submitting ? "Submitting..." : "Submit Request"}
          </button>

          {error && (
            <div className="alert alert-warning">
              <span>{error}</span>
            </div>
          )}

          {result && (
            <div className="rounded-xl border border-base-300 bg-base-200/70 p-4">
              <p className="text-sm font-semibold">Quest created</p>
              <pre className="mt-2 text-xs text-base-content/80 overflow-x-auto">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

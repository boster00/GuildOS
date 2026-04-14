"use client";

import { useState } from "react";

const PHASES = [
  {
    num: 0,
    label: "Environment Setup",
    desc: "Create directory structure, install Python packages (anthropic, python-dotenv, python-pptx, edge-tts, moviepy, playwright), verify ffmpeg, and load both API keys from .env.",
  },
  {
    num: 1,
    label: "Start CCC Session",
    desc: "Initialise the Anthropic client with conversation history. Send a READY ping to confirm the session is live before proceeding.",
  },
  {
    num: 2,
    label: "Build the Make 24 Program",
    desc: "Ask CCC to write src/make24.py — a recursive brute-force solver over all permutations and operator combinations. CCC then self-reviews the file and patches any issues.",
  },
  {
    num: 3,
    label: "Generate Test Cases & Run Tests",
    desc: "CCC generates 4 test cases (including at least one no-solution case), runs make24.py for each via subprocess, and saves structured results to results.json.",
  },
  {
    num: 4,
    label: "Capture Screenshots",
    desc: "Render an HTML result card for each test case and use Claude in Chrome to navigate + screenshot each file at 1280×800, saving PNGs to screenshots/.",
  },
  {
    num: 5,
    label: "Annotated PowerPoint",
    desc: "Generate a multi-slide .pptx report (title, one slide per test with screenshot + annotation panel, summary slide) and save to ~/Downloads/test-report.pptx.",
  },
  {
    num: 6,
    label: "Narrated Video",
    desc: "CCC writes a professional voiceover script, edge-tts synthesises audio per section, then moviepy assembles screenshots + audio into ~/Downloads/demo-video.mp4.",
  },
  {
    num: 7,
    label: "Final Report",
    desc: "Post a structured summary with deliverable paths, per-test results, overall pass rate, CCC message count, and any issues encountered.",
  },
];

const DEFAULT_CASES = [
  { id: "TEST_1", inputs: [4, 7, 8, 2], hasSolution: true },
  { id: "TEST_2", inputs: [1, 1, 1, 1], hasSolution: false },
  { id: "TEST_3", inputs: [6, 6, 6, 6], hasSolution: true },
  { id: "TEST_4", inputs: [3, 3, 8, 8], hasSolution: true },
];

export default function CccTestClient() {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [meta, setMeta] = useState(null);

  async function runTests() {
    setRunning(true);
    setError(null);
    setResults(null);
    setMeta(null);

    try {
      const res = await fetch("/api/ccc-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "runAll" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
      setResults(data.results);
      setMeta({ passed: data.passed, total: data.total, messages: data.messagesExchanged });
    } catch (err) {
      setError(err.message);
    } finally {
      setRunning(false);
    }
  }

  const passed = results ? results.filter((r) => r.status === "PASS").length : null;

  return (
    <div className="space-y-8">
      {/* What is CCC Test */}
      <div className="rounded-2xl border border-base-300 bg-base-200/40 p-5">
        <h2 className="text-lg font-semibold">What is this test?</h2>
        <p className="mt-2 text-sm text-base-content/70">
          This page described a <strong>Make&nbsp;24</strong> harness that used to call Anthropic’s HTTP API from the server. GuildOS no longer uses <code className="rounded bg-base-300 px-1 text-xs">ANTHROPIC_API_KEY</code> — use <strong>Claude Code</strong> in a terminal with{" "}
          <code className="rounded bg-base-300 px-1 text-xs">claude auth login --claudeai</code>{" "}
          (Claude subscription) for coding-agent work. The &quot;Run All Tests&quot; button below returns HTTP 501 until a non–API-key path is wired in.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-base-content/50">
          <span className="rounded-full border border-base-300 px-3 py-1">4 test cases (UI only)</span>
          <span className="rounded-full border border-base-300 px-3 py-1">Server API runner disabled</span>
        </div>
      </div>

      {/* What is Make 24 */}
      <div className="rounded-2xl border border-base-300 bg-base-200/40 p-5">
        <h2 className="text-lg font-semibold">The Make 24 Problem</h2>
        <p className="mt-2 text-sm text-base-content/70">
          Given four integers, find a mathematical expression using all four numbers exactly once — with <code className="rounded bg-base-300 px-1 text-xs">+&nbsp;−&nbsp;×&nbsp;÷</code> and parentheses — that evaluates to exactly&nbsp;24. The solver uses recursive brute-force over all permutations and operator combinations, handling division-by-zero gracefully.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-sm md:grid-cols-4">
          {DEFAULT_CASES.map((c) => (
            <div key={c.id} className="rounded-xl border border-base-300 bg-base-100/60 p-3 text-center">
              <div className="text-base font-bold text-base-content">{c.inputs.join(", ")}</div>
              <div className={`mt-1 text-xs ${c.hasSolution ? "text-success" : "text-error"}`}>
                {c.hasSolution ? "has solution" : "no solution"}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* All 8 phases */}
      <div>
        <h2 className="mb-3 text-lg font-semibold">Full Demo Phases</h2>
        <div className="space-y-2">
          {PHASES.map((phase) => (
            <div
              key={phase.num}
              className="flex gap-4 rounded-xl border border-base-300 bg-base-200/30 px-4 py-3"
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-base-300 bg-base-100 text-xs font-bold text-base-content/60">
                {phase.num}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold">{phase.label}</div>
                <div className="mt-0.5 text-xs text-base-content/60">{phase.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Runner */}
      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Run CCC Test</h2>
            <p className="mt-0.5 text-xs text-base-content/60">
              Sends all 4 test cases to a live CCC session and reports results.
            </p>
          </div>
          <button
            className="btn btn-primary btn-sm"
            onClick={runTests}
            disabled={running}
          >
            {running ? (
              <>
                <span className="loading loading-spinner loading-xs" />
                Running…
              </>
            ) : (
              "Run All Tests"
            )}
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-error/30 bg-error/5 p-3 text-sm text-error">
            {error}
          </div>
        )}

        {results && (
          <div className="mt-5 space-y-3">
            {/* Summary bar */}
            <div className={`flex items-center gap-3 rounded-xl border p-3 ${passed === results.length ? "border-success/30 bg-success/5" : "border-warning/30 bg-warning/5"}`}>
              <span className={`text-2xl font-bold ${passed === results.length ? "text-success" : "text-warning"}`}>
                {passed}/{results.length}
              </span>
              <div>
                <div className="text-sm font-semibold">
                  {passed === results.length ? "All tests passed" : `${results.length - passed} test${results.length - passed > 1 ? "s" : ""} failed`}
                </div>
                <div className="text-xs text-base-content/50">
                  {meta?.messages} CCC message{meta?.messages !== 1 ? "s" : ""} exchanged
                </div>
              </div>
            </div>

            {/* Per-test results */}
            <div className="overflow-x-auto rounded-xl border border-base-300">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-base-300 bg-base-200/50 text-xs text-base-content/60">
                    <th className="px-4 py-2 text-left font-medium">Test</th>
                    <th className="px-4 py-2 text-left font-medium">Inputs</th>
                    <th className="px-4 py-2 text-left font-medium">Output</th>
                    <th className="px-4 py-2 text-left font-medium">Expected</th>
                    <th className="px-4 py-2 text-left font-medium">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r) => (
                    <tr key={r.id} className="border-b border-base-300/50 last:border-0">
                      <td className="px-4 py-3 font-mono text-xs text-base-content/70">{r.id}</td>
                      <td className="px-4 py-3 font-mono text-xs">{r.inputs.join(", ")}</td>
                      <td className="max-w-xs px-4 py-3 font-mono text-xs text-base-content/80">
                        {r.actual_output}
                      </td>
                      <td className="px-4 py-3 text-xs text-base-content/60 capitalize">{r.expected}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                            r.status === "PASS"
                              ? "bg-success/15 text-success"
                              : "bg-error/15 text-error"
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Deliverables note */}
      <div className="rounded-2xl border border-base-300 bg-base-200/30 p-5">
        <h2 className="mb-3 text-lg font-semibold">Full Run Deliverables</h2>
        <p className="mb-4 text-sm text-base-content/60">
          When the complete 7-phase prompt is executed locally, these files are produced in <code className="rounded bg-base-300 px-1 text-xs">~/Downloads/</code>:
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="flex items-start gap-3 rounded-xl border border-base-300 bg-base-100/60 p-4">
            <div className="mt-0.5 text-2xl">🎬</div>
            <div>
              <div className="text-sm font-semibold">demo-video.mp4</div>
              <div className="mt-0.5 text-xs text-base-content/60">
                Narrated video — one chapter per test case, synthesised with edge-tts and assembled by moviepy at 1920×1080 / 24fps.
              </div>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-xl border border-base-300 bg-base-100/60 p-4">
            <div className="mt-0.5 text-2xl">📊</div>
            <div>
              <div className="text-sm font-semibold">test-report.pptx</div>
              <div className="mt-0.5 text-xs text-base-content/60">
                Annotated PowerPoint — title slide, one slide per test with screenshot + annotation panel, summary slide with overall pass rate.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

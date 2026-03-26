"use client";

import { useState, useEffect } from "react";
import { initMonkey } from "@/libs/monkey";
import ModelResponseCard from "./ModelResponseCard";
import PROMPT_PACK from "../promptPack";
import { saveRun, listRuns, loadRun, exportRun } from "../utils/runStorage";
import { EDEN_MODELS } from "../edenModels";

export default function ChatTester() {
  const [prompt, setPrompt] = useState("");
  const [modelIds, setModelIds] = useState([]);
  const [models, setModels] = useState(EDEN_MODELS);
  const [modelsLoadError, setModelsLoadError] = useState(false);
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(2048);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState(null);
  const [runHistory, setRunHistory] = useState([]);

  useEffect(() => {
    setRunHistory(listRuns());
  }, []);

  const loadModels = async () => {
    setModelsLoadError(false);
    try {
      const response = await fetch("/api/eden/models", { credentials: "include" });
      const data = await response.json();
      if (data.ok && data.data?.models?.length) {
        setModels(data.data.models);
        return;
      }
    } catch (e) {
    }
    setModels(EDEN_MODELS);
    setModelsLoadError(true);
  };

  useEffect(() => {
    loadModels();
  }, []);

  const handlePromptPackSelect = (e) => {
    const id = e.target.value;
    if (!id) return;
    const item = PROMPT_PACK.find((p) => p.id === id);
    if (item) setPrompt(item.prompt);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setResults(null);
    if (!prompt.trim()) {
      setError("Enter a prompt");
      return;
    }
    if (modelIds.length === 0) {
      setError("Select at least one model");
      return;
    }
    setLoading(true);
    try {
      const monkey = await initMonkey();
      const text = await monkey.apiCall("/api/eden/chat", {
        prompt: prompt.trim(),
        modelIds,
        temperature,
        maxTokens,
      });
      const data = JSON.parse(text);
      if (!data.ok) {
        setError(data.error?.message || "Request failed");
        return;
      }
      setResults(data.data.results);
    } catch (err) {
      setError(err.message || "Request failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveRun = () => {
    if (!results) return;
    const run = {
      runId: "run-" + Date.now(),
      runType: "single",
      timestamp: new Date().toISOString(),
      prompt,
      selectedModels: modelIds,
      params: { temperature, maxTokens },
      results,
    };
    saveRun(run);
    setRunHistory(listRuns());
  };

  const labelFor = (id) => models.find((m) => m.id === id)?.label || id;

  return (
    <div className="card bg-base-100 shadow-xl border border-base-300">
      <div className="card-body">
        <h2 className="card-title">Section A — Multi-model chat</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">
              <span className="label-text">Prompt</span>
            </label>
            <div className="flex gap-2 flex-wrap">
              <select
                className="select select-bordered select-sm"
                onChange={handlePromptPackSelect}
                defaultValue=""
              >
                <option value="">Load from prompt pack</option>
                {PROMPT_PACK.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <textarea
              className="textarea textarea-bordered w-full mt-1 h-28"
              placeholder="Enter your prompt..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={loading}
            />
          </div>
          <div>
            <label className="label">
              <span className="label-text">Models</span>
            </label>
            {modelsLoadError && (
              <p className="text-sm text-warning mb-2">
                Using default model list.{" "}
                <button type="button" className="link link-hover" onClick={() => loadModels()}>
                  Retry
                </button>
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {models.map((m) => (
                <label key={m.id} className="label cursor-pointer gap-2 border rounded px-3 py-1 bg-base-200">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-sm"
                    checked={modelIds.includes(m.id)}
                    onChange={(e) => {
                      if (e.target.checked) setModelIds((prev) => [...prev, m.id]);
                      else setModelIds((prev) => prev.filter((id) => id !== m.id));
                    }}
                  />
                  <span className="label-text">{m.label}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-4 items-center">
            <div className="form-control">
              <label className="label py-0">
                <span className="label-text">Temperature</span>
                <span className="label-text-alt">{temperature}</span>
              </label>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                className="range range-sm"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
              />
            </div>
            <div className="form-control">
              <label className="label">
                <span className="label-text">Max tokens</span>
              </label>
              <input
                type="number"
                className="input input-bordered input-sm w-24"
                min={1}
                max={128000}
                value={maxTokens}
                onChange={(e) => setMaxTokens(parseInt(e.target.value, 10) || 2048)}
              />
            </div>
          </div>
          {error && (
            <div className="alert alert-error">
              <span>{error}</span>
            </div>
          )}
          <div className="flex gap-2">
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? "Running..." : "Run"}
            </button>
            {results && (
              <button type="button" className="btn btn-outline" onClick={handleSaveRun}>
                Save run
              </button>
            )}
          </div>
        </form>
        {results && results.length > 0 && (
          <div className="mt-4">
            <h3 className="font-semibold mb-2">Results</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {results.map((r) => (
                <ModelResponseCard
                  key={r.modelId}
                  modelId={r.modelId}
                  label={labelFor(r.modelId)}
                  text={r.text}
                  usage={r.usage}
                  latencyMs={r.latencyMs}
                  requestId={r.requestId}
                  rawPreview={r.rawPreview}
                  cost={r.cost}
                  error={r.error}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

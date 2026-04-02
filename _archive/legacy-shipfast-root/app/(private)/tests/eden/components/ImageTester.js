"use client";

import { useState } from "react";
import { initMonkey } from "@/libs/monkey";

export default function ImageTester() {
  const [mode, setMode] = useState("text");
  const [prompt, setPrompt] = useState("");
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    if (!prompt.trim()) {
      setError("Enter a prompt");
      return;
    }
    setLoading(true);
    try {
      const monkey = await initMonkey();
      if (mode === "image" && file) {
        const formData = new FormData();
        formData.set("mode", "image");
        formData.set("prompt", prompt.trim());
        formData.append("image", file);
        const text = await monkey.apiCallFormData("/api/eden/image", formData);
        const data = JSON.parse(text);
        if (data.ok) setResult(data);
        else setError(data.error?.message || "Failed");
      } else {
        const text = await monkey.apiCall("/api/eden/image", {
          mode: "text",
          prompt: prompt.trim(),
          size: "1024x1024",
        });
        const data = JSON.parse(text);
        if (data.ok) setResult(data);
        else setError(data.error?.message || "Failed");
      }
    } catch (err) {
      setError(err.message || "Request failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card bg-base-100 shadow-xl border border-base-300">
      <div className="card-body">
        <h2 className="card-title">Section B — Image generation</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-2">
            <button
              type="button"
              className={`btn btn-sm ${mode === "text" ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setMode("text")}
            >
              Text → Image
            </button>
            <button
              type="button"
              className={`btn btn-sm ${mode === "image" ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setMode("image")}
            >
              Image → Image
            </button>
          </div>
          <div>
            <label className="label">
              <span className="label-text">Prompt</span>
            </label>
            <textarea
              className="textarea textarea-bordered w-full h-24"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the image..."
              disabled={loading}
            />
          </div>
          {mode === "image" && (
            <div>
              <label className="label">
                <span className="label-text">Upload image (max 10MB)</span>
              </label>
              <input
                type="file"
                className="file-input file-input-bordered w-full max-w-md"
                accept="image/*"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </div>
          )}
          {error && (
            <div className="alert alert-error">
              <span>{error}</span>
            </div>
          )}
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? "Generating..." : "Generate"}
          </button>
        </form>
        {result && result.data && result.data.url && (
          <div className="mt-4">
            <p className="text-sm text-base-content/70 mb-2">
              Request ID: {result.requestId}
              {result.latencyMs != null && ` · ${result.latencyMs} ms`}
            </p>
            <img src={result.data.url} alt="Generated" className="max-w-md rounded-lg border" />
            <a href={result.data.url} download className="btn btn-outline btn-sm mt-2">
              Download
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

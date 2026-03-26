"use client";

import { useState } from "react";
import { initMonkey } from "@/libs/monkey";

const DEFAULT_TEST_JOB_ID = "ed642a59-702b-4dcc-b895-c6fa659612bd";

export default function VideoTester() {
  const [mode, setMode] = useState("text");
  const [prompt, setPrompt] = useState("");
  const [startFrameFile, setStartFrameFile] = useState(null);
  const [previewReformatResult, setPreviewReformatResult] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [jobId, setJobId] = useState(null);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);

  const handleLoadDefaultJob = () => {
    setError(null);
    setJobId(DEFAULT_TEST_JOB_ID);
    setStatus({ status: "—" });
  };

  const handleCreateJob = async (e) => {
    e.preventDefault();
    setError(null);
    setStatus(null);
    if (!prompt.trim()) {
      setError("Enter a prompt");
      return;
    }
    if (mode === "image" && !startFrameFile) {
      setError("Select a start frame image");
      return;
    }
    setLoading(true);
    try {
      const monkey = await initMonkey();
      let text;
      if (mode === "image" && startFrameFile) {
        if (process.env.NODE_ENV === "development") {
          
        }
        const formData = new FormData();
        formData.set("mode", "image");
        formData.set("prompt", prompt.trim());
        formData.append("image", startFrameFile);
        text = await monkey.apiCallFormData("/api/eden/video", formData);
      } else {
        text = await monkey.apiCall("/api/eden/video", { mode: "text", prompt: prompt.trim() });
      }
      const data = JSON.parse(text);
      if (data.ok && data.data && data.data.jobId) {
        setJobId(data.data.jobId);
        setStatus({ status: "queued" });
      } else {
        setError(data.error?.message || "Failed to create job");
      }
    } catch (err) {
      setError(err.message || "Request failed");
    } finally {
      setLoading(false);
    }
  };

  const handlePreviewReformat = async () => {
    if (!startFrameFile) return;
    setError(null);
    setPreviewReformatResult(null);
    setPreviewLoading(true);
    try {
      const monkey = await initMonkey();
      const formData = new FormData();
      formData.append("image", startFrameFile);
      const text = await monkey.apiCallFormData("/api/eden/video/preview-reformat", formData);
      const data = JSON.parse(text);
      if (data.ok && data.data?.imageBase64) {
        setPreviewReformatResult(data.data);
      } else {
        setError(data.error?.message || "Preview failed");
      }
    } catch (err) {
      setError(err.message || "Preview failed");
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleCheckStatus = async () => {
    if (!jobId) return;
    try {
      const monkey = await initMonkey();
      const text = await monkey.apiGet(`/api/eden/video/status?jobId=${encodeURIComponent(jobId)}`);
      const data = JSON.parse(text);
      if (data.ok && data.data) setStatus(data.data);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="card bg-base-100 shadow-xl border border-base-300 mt-6">
      <div className="card-body">
        <h2 className="card-title">Section C — Video (async)</h2>
        <p className="text-base-content/70 text-sm">
          Create video job via Eden AI, then poll status. Uses Amazon provider by default.
        </p>
        <button
          type="button"
          className="btn btn-ghost btn-sm mb-2"
          onClick={handleLoadDefaultJob}
        >
          Load default test job ID
        </button>
        <form onSubmit={handleCreateJob} className="space-y-4">
          <div className="flex gap-2">
            <button
              type="button"
              className={`btn btn-sm ${mode === "text" ? "btn-primary" : "btn-ghost"}`}
              onClick={() => {
                setMode("text");
                setPreviewReformatResult(null);
              }}
            >
              Text only
            </button>
            <button
              type="button"
              className={`btn btn-sm ${mode === "image" ? "btn-primary" : "btn-ghost"}`}
              onClick={() => {
                setMode("image");
                setPreviewReformatResult(null);
              }}
            >
              Start frame + text
            </button>
          </div>
          <div>
            <label className="label">
              <span className="label-text">Prompt</span>
            </label>
            <textarea
              className="textarea textarea-bordered w-full h-20"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the video..."
              disabled={loading}
            />
          </div>
          {mode === "image" && (
            <div>
              <label className="label">
                <span className="label-text">Start frame image</span>
              </label>
              <input
                type="file"
                className="file-input file-input-bordered w-full max-w-md"
                accept="image/*"
                onChange={(e) => {
                  setStartFrameFile(e.target.files?.[0] || null);
                  setPreviewReformatResult(null);
                }}
              />
              {startFrameFile && (
                <button
                  type="button"
                  className="btn btn-outline btn-sm mt-2"
                  onClick={handlePreviewReformat}
                  disabled={previewLoading}
                >
                  {previewLoading ? "Reformatting..." : "Preview reformat"}
                </button>
              )}
              {previewReformatResult?.imageBase64 && (
                <div className="mt-3 p-3 bg-base-200 rounded-lg">
                  <p className="text-sm text-base-content/70 mb-2">
                    Reformatted preview ({previewReformatResult.dimensions || "1280x720"}, full image + black fill)
                  </p>
                  <img
                    src={`data:image/png;base64,${previewReformatResult.imageBase64}`}
                    alt="Reformatted preview"
                    className="max-w-md rounded-lg border border-base-300"
                  />
                </div>
              )}
            </div>
          )}
          {error && (
            <div className="alert alert-error">
              <span>{error}</span>
            </div>
          )}
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? "Creating job..." : "Create video job"}
          </button>
        </form>
        {jobId && (
          <div className="mt-4 p-3 bg-base-200 rounded-lg">
            <p className="text-sm font-mono">Job ID: {jobId}</p>
            <p className="text-sm mt-1">Status: {status?.status || "—"}</p>
            {status?.result?.video_url && (
              <div className="mt-2">
                <video
                  src={status.result.video_url}
                  controls
                  className="w-full max-w-md rounded-lg bg-black"
                  preload="metadata"
                />
                <a
                  href={status.result.video_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link text-sm mt-1 inline-block"
                >
                  Open video URL
                </a>
              </div>
            )}
            {status?.error && <p className="text-sm text-error mt-1">{status.error}</p>}
            <button type="button" className="btn btn-ghost btn-sm mt-2" onClick={handleCheckStatus}>
              Refresh status
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

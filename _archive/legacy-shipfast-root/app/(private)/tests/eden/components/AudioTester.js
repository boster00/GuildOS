"use client";

import { useState, useRef } from "react";
import { initMonkey } from "@/libs/monkey";

export default function AudioTester() {
  const [text, setText] = useState("Hello, this is a test of the text to speech system.");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const audioRef = useRef(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    if (!text.trim()) {
      setError("Enter text");
      return;
    }
    setLoading(true);
    try {
      const monkey = await initMonkey();
      const res = await monkey.apiCall("/api/eden/tts", { text: text.trim() });
      const data = JSON.parse(res);
      if (data.ok) setResult(data);
      else setError(data.error?.message || "TTS failed");
    } catch (err) {
      setError(err.message || "Request failed");
    } finally {
      setLoading(false);
    }
  };

  const audioUrl = result?.data?.audioUrl || (result?.data?.audioBase64 ? `data:audio/mp3;base64,${result.data.audioBase64}` : null);

  return (
    <div className="card bg-base-100 shadow-xl border border-base-300 mt-6">
      <div className="card-body">
        <h2 className="card-title">Section E — Audio / TTS</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">
              <span className="label-text">Text</span>
            </label>
            <textarea
              className="textarea textarea-bordered w-full h-24"
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={loading}
            />
          </div>
          {error && (
            <div className="alert alert-error">
              <span>{error}</span>
            </div>
          )}
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? "Generating..." : "Generate speech"}
          </button>
        </form>
        {result && (
          <div className="mt-4">
            <p className="text-sm text-base-content/70">
              Request ID: {result.requestId}
              {result.latencyMs != null && ` · ${result.latencyMs} ms`}
            </p>
            {audioUrl && (
              <>
                <audio ref={audioRef} src={audioUrl} controls className="mt-2 w-full max-w-md" />
                <a href={audioUrl} download="eden-tts.mp3" className="btn btn-outline btn-sm mt-2">
                  Download
                </a>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

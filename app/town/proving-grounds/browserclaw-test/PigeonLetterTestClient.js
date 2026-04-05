"use client";
import { useState } from "react";

const DEFAULT_PAYLOAD = JSON.stringify(
  {
    steps: [
      { action: "navigate", url: "https://example.com", item: "nav" },
      { action: "obtainText", selector: "h1", item: "heading" },
    ],
  },
  null,
  2,
);

export default function PigeonLetterTestClient({ quests }) {
  const [questId, setQuestId] = useState(quests[0]?.id ?? "");
  const [channel, setChannel] = useState("browserclaw");
  const [payloadText, setPayloadText] = useState(DEFAULT_PAYLOAD);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setResult(null);

    let payload;
    try {
      payload = JSON.parse(payloadText);
    } catch {
      setError("Payload is not valid JSON.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/pigeon-post?action=create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questId, channel, payload }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error ?? "Insert failed.");
      } else {
        setResult(json.letter);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
      {/* Quest */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium">Quest</label>
        {quests.length > 0 ? (
          <select
            className="select select-bordered w-full"
            value={questId}
            onChange={(e) => setQuestId(e.target.value)}
            required
          >
            {quests.map((q) => (
              <option key={q.id} value={q.id}>
                {q.title || q.id} ({q.stage})
              </option>
            ))}
          </select>
        ) : (
          <input
            type="text"
            className="input input-bordered w-full font-mono text-sm"
            placeholder="Quest UUID"
            value={questId}
            onChange={(e) => setQuestId(e.target.value)}
            required
          />
        )}
      </div>

      {/* Channel */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium">Channel</label>
        <input
          type="text"
          className="input input-bordered w-full font-mono text-sm"
          value={channel}
          onChange={(e) => setChannel(e.target.value)}
          required
        />
      </div>

      {/* Payload */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium">Payload (JSON)</label>
        <textarea
          className="textarea textarea-bordered w-full font-mono text-sm"
          rows={14}
          value={payloadText}
          onChange={(e) => setPayloadText(e.target.value)}
          spellCheck={false}
          required
        />
      </div>

      {error && (
        <div className="alert alert-error text-sm">{error}</div>
      )}

      {result && (
        <div className="alert alert-success flex flex-col items-start gap-1 text-sm">
          <span className="font-semibold">Letter inserted</span>
          <code className="break-all text-xs">{result.id}</code>
          <pre className="mt-1 text-xs opacity-80">{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}

      <button
        type="submit"
        className="btn btn-primary self-start"
        disabled={loading}
      >
        {loading ? "Sending…" : "Send pigeon letter"}
      </button>
    </form>
  );
}

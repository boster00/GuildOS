"use client";

import { useCallback, useEffect, useState } from "react";
import { MerchantGuildExplain } from "@/components/MerchantGuildExplain";

export default function DungeonMasterSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const [hasApiKey, setHasApiKey] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [modelId, setModelId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/council/profile/council-settings", {
        credentials: "include",
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || `HTTP ${res.status}`);
        return;
      }
      const dm = data.council_settings?.dungeon_master;
      setHasApiKey(Boolean(dm?.has_api_key));
      setBaseUrl(typeof dm?.base_url === "string" ? dm.base_url : "");
      setModelId(typeof dm?.model_id === "string" ? dm.model_id : "");
      setApiKeyInput("");
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSave(e) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const payload = {
        dungeon_master: {
          base_url: baseUrl,
          model_id: modelId,
        },
      };
      const trimmedKey = apiKeyInput.trim();
      if (trimmedKey.length > 0) {
        payload.dungeon_master.api_key = trimmedKey;
      }

      const res = await fetch("/api/council/profile/council-settings", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || `HTTP ${res.status}`);
        return;
      }
      setMessage("The charter is updated.");
      setApiKeyInput("");
      const dm = data.council_settings?.dungeon_master;
      setHasApiKey(Boolean(dm?.has_api_key));
      setBaseUrl(typeof dm?.base_url === "string" ? dm.base_url : "");
      setModelId(typeof dm?.model_id === "string" ? dm.model_id : "");
    } catch (err) {
      setError(err?.message || String(err));
    } finally {
      setSaving(false);
    }
  }

  async function onClearApiKey() {
    if (!hasApiKey) return;
    if (
      !window.confirm(
        "Remove the stored API key from your profile? The guild will fall back to OPENAI_API_KEY or OPENAI_API_KEY_1 on the server when set."
      )
    ) {
      return;
    }
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/council/profile/council-settings", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dungeon_master: { clear_api_key: true } }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || `HTTP ${res.status}`);
        return;
      }
      setMessage("Stored key removed.");
      setHasApiKey(false);
      setApiKeyInput("");
    } catch (err) {
      setError(err?.message || String(err));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-base-content/60">Opening the chamber ledger…</p>;
  }

  return (
    <div className="space-y-6">
      <MerchantGuildExplain
        fantasy={
          <p className="text-sm text-base-content/70">
            The <strong>Dungeon Master</strong> is the unseen voice that runs quests and tools when adventurers work. Here
            you may supply your own oracle and key; otherwise the guild uses the server&apos;s env secrets.
          </p>
        }
        merchant={
          <p className="text-sm text-base-content/70">
            Optional per-account OpenAI-compatible API key, base URL, and default model. If the key is omitted, the server
            uses environment keys in order: <code className="text-xs">OPENAI_API_KEY</code>, then{" "}
            <code className="text-xs">OPENAI_API_KEY_1</code>.
          </p>
        }
      />

      <form className="space-y-4" onSubmit={onSave}>
        <label className="form-control w-full max-w-lg">
          <span className="label-text text-sm font-medium">API key</span>
          <input
            type="password"
            autoComplete="off"
            className="input input-bordered w-full font-mono text-sm"
            placeholder={hasApiKey ? "••••••••  (enter a new key to replace)" : "sk-…  (optional if env OPENAI_API_KEY / _1 is set)"}
            value={apiKeyInput}
            onChange={(ev) => setApiKeyInput(ev.target.value)}
          />
          <span className="label-text-alt text-base-content/55">
            {hasApiKey ? "A key is on file. Leave blank to keep it, or save a new value to replace." : "Not set in profile."}
          </span>
        </label>

        {hasApiKey ? (
          <button type="button" className="btn btn-outline btn-sm" onClick={() => void onClearApiKey()} disabled={saving}>
            Remove stored API key
          </button>
        ) : null}

        <label className="form-control w-full max-w-lg">
          <span className="label-text text-sm font-medium">Base URL (optional)</span>
          <input
            type="url"
            className="input input-bordered w-full font-mono text-sm"
            placeholder="https://api.openai.com/v1"
            value={baseUrl}
            onChange={(ev) => setBaseUrl(ev.target.value)}
          />
          <span className="label-text-alt text-base-content/55">OpenAI-compatible API base; leave empty for default.</span>
        </label>

        <label className="form-control w-full max-w-lg">
          <span className="label-text text-sm font-medium">Default model (optional)</span>
          <input
            type="text"
            className="input input-bordered w-full font-mono text-sm"
            placeholder="e.g. gpt-4o-mini"
            value={modelId}
            onChange={(ev) => setModelId(ev.target.value)}
          />
          <span className="label-text-alt text-base-content/55">
            Used when an adventurer has no model set; class defaults apply if this is empty too.
          </span>
        </label>

        {error ? (
          <div className="alert alert-error text-sm">
            <span>{error}</span>
          </div>
        ) : null}
        {message ? (
          <div className="alert alert-success text-sm">
            <span>{message}</span>
          </div>
        ) : null}

        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </button>
      </form>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Save, Loader } from "lucide-react";

const MAX_KEYWORDS = 20;
const MAX_PROMPTS = 5;
const MODELS = ["chatgpt", "claude", "perplexity"];

export default function VisibilityTrackingEditPage() {
  const params = useParams();
  const slug = params?.slug;

  const [project, setProject] = useState(null);
  const [domain, setDomain] = useState("");
  const [brandTerms, setBrandTerms] = useState("");
  const [cadence, setCadence] = useState("weekly");
  const [keywords, setKeywords] = useState([]);
  const [keywordsPaste, setKeywordsPaste] = useState("");
  const [prompts, setPrompts] = useState([]);
  const [newPromptText, setNewPromptText] = useState("");
  const [newPromptModels, setNewPromptModels] = useState(["chatgpt"]);
  const [newPromptsDraft, setNewPromptsDraft] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    async function load() {
      setLoading(true);
      setNotFound(false);
      try {
        const res = await fetch(
          `/api/visibility_tracker/project?projectId=${encodeURIComponent(slug)}`
        );
        const data = await res.json();
        if (data.success && data.project) {
          setProject(data.project);
          setDomain(data.project.domain || "");
          setBrandTerms(
            Array.isArray(data.project.brand_terms)
              ? data.project.brand_terms.join(", ")
              : ""
          );
          setCadence(data.project.cadence || "weekly");
          setKeywords(data.keywords || []);
          setPrompts(data.prompts || []);
        } else if (res.status === 404 || !data.project) {
          setNotFound(true);
        }
      } catch (e) {

      } finally {
        setLoading(false);
      }
    }
    load();
  }, [slug]);

  const saveProject = async () => {
    if (!domain.trim()) {
      setMessage({ type: "error", text: "Domain is required" });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/visibility_tracker/project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: slug,
          domain: domain.trim(),
          brand_terms: brandTerms
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          cadence,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: "success", text: "Project saved" });
        if (data.project) setProject(data.project);
      } else {
        setMessage({
          type: "error",
          text: data.error || "Failed to save",
        });
      }
    } catch (e) {
      setMessage({ type: "error", text: e?.message || "Request failed" });
    } finally {
      setSaving(false);
    }
  };

  const saveKeywords = async () => {
    const fromPaste = keywordsPaste
      .split(/\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    const existing = keywords
      .map((k) => (typeof k === "string" ? k : (k.keyword || "")).trim())
      .filter(Boolean);
    const combined = [...existing, ...fromPaste];
    const seen = new Set();
    const deduped = combined.filter((kw) => {
      if (seen.has(kw)) return false;
      seen.add(kw);
      return true;
    });
    if (deduped.length > MAX_KEYWORDS) {
      setMessage({
        type: "error",
        text: `Maximum ${MAX_KEYWORDS} keywords allowed (you have ${deduped.length})`,
      });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/visibility_tracker/keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: slug,
          keywords: deduped.map((keyword) => ({ keyword, tags: {} })),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: "success", text: "Keywords saved" });
        setKeywords(data.keywords || []);
        setKeywordsPaste("");
      } else {
        setMessage({ type: "error", text: data.error || "Failed to save" });
      }
    } catch (e) {
      setMessage({ type: "error", text: e?.message || "Request failed" });
    } finally {
      setSaving(false);
    }
  };

  const savePrompts = async () => {
    const totalAfterSave = prompts.length + newPromptsDraft.length;
    if (totalAfterSave > MAX_PROMPTS) {
      setMessage({
        type: "error",
        text: `Maximum ${MAX_PROMPTS} prompts allowed`,
      });
      return;
    }
    const existingTexts = new Set(
      prompts.map((p) => (p.prompt_text || p.promptText || "").trim()).filter(Boolean)
    );
    for (const np of newPromptsDraft) {
      const text = (np.prompt_text || "").trim();
      if (!text) {
        setMessage({ type: "error", text: "New prompt text cannot be empty" });
        return;
      }
      if (existingTexts.has(text)) {
        setMessage({
          type: "error",
          text: "Duplicate prompt in list",
        });
        return;
      }
      existingTexts.add(text);
    }
    setSaving(true);
    setMessage(null);
    try {
      const payload = {
        projectId: slug,
        prompts: [
          ...prompts.map((p) => ({ id: p.id })),
          ...newPromptsDraft.map((p) => ({
            prompt_text: (p.prompt_text || "").trim(),
            models: p.models || ["chatgpt"],
          })),
        ],
      };
      const res = await fetch("/api/visibility_tracker/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: "success", text: "Prompts saved" });
        setPrompts(data.prompts || []);
        setNewPromptsDraft([]);
        setNewPromptText("");
        setNewPromptModels(["chatgpt"]);
      } else {
        setMessage({ type: "error", text: data.error || "Failed to save" });
      }
    } catch (e) {
      setMessage({ type: "error", text: e?.message || "Request failed" });
    } finally {
      setSaving(false);
    }
  };

  const removeKeyword = (index) => {
    setKeywords(keywords.filter((_, j) => j !== index));
  };

  const addNewPromptToDraft = () => {
    const text = newPromptText.trim();
    if (!text) {
      setMessage({ type: "error", text: "Enter prompt text first" });
      return;
    }
    const existingTexts = new Set([
      ...prompts.map((p) => (p.prompt_text || p.promptText || "").trim()),
      ...newPromptsDraft.map((p) => (p.prompt_text || "").trim()),
    ]);
    if (existingTexts.has(text)) {
      setMessage({ type: "error", text: "This prompt text is already in the list" });
      return;
    }
    if (prompts.length + newPromptsDraft.length >= MAX_PROMPTS) {
      setMessage({ type: "error", text: `Maximum ${MAX_PROMPTS} prompts allowed` });
      return;
    }
    setNewPromptsDraft((prev) => [
      ...prev,
      { prompt_text: text, models: [...newPromptModels] },
    ]);
    setNewPromptText("");
  };

  const removeExistingPrompt = (index) => {
    setPrompts((prev) => prev.filter((_, j) => j !== index));
  };

  const removeNewPromptDraft = (index) => {
    setNewPromptsDraft((prev) => prev.filter((_, j) => j !== index));
  };

  if (loading && !project) {
    return (
      <div className="min-h-screen bg-base-200 p-8 flex items-center justify-center">
        <Loader className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (notFound || (!loading && !project)) {
    return (
      <div className="min-h-screen bg-base-200 p-8">
        <div className="max-w-xl mx-auto">
          <p className="text-error">Project not found.</p>
          <Link
            href="/geo-seo-visibility-tracking"
            className="btn btn-ghost btn-sm mt-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to list
          </Link>
        </div>
      </div>
    );
  }

  const viewHref = `/geo-seo-visibility-tracking/${encodeURIComponent(slug)}`;

  return (
    <div className="min-h-screen bg-base-200 p-8">
      <div className="max-w-3xl mx-auto">
        <Link href={viewHref} className="btn btn-ghost btn-sm mb-4">
          <ArrowLeft className="w-4 h-4" />
          Back to project
        </Link>

        <h1 className="text-3xl font-bold mb-6">Edit project</h1>

        {message && (
          <div
            className={`alert ${
              message.type === "success" ? "alert-success" : "alert-error"
            } mb-4`}
          >
            <span>{message.text}</span>
          </div>
        )}

        <div className="card bg-base-100 shadow-xl mb-6">
          <div className="card-body">
            <h2 className="card-title">Domain &amp; brand</h2>
            <label className="label">
              <span className="label-text">Domain (required)</span>
            </label>
            <input
              type="text"
              className="input input-bordered w-full"
              placeholder="example.com"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
            />
            <label className="label mt-2">
              <span className="label-text">Brand terms (comma-separated)</span>
            </label>
            <input
              type="text"
              className="input input-bordered w-full"
              placeholder="Brand Name, Acme"
              value={brandTerms}
              onChange={(e) => setBrandTerms(e.target.value)}
            />
            <label className="label mt-2">
              <span className="label-text">Cadence</span>
            </label>
            <select
              className="select select-bordered w-full"
              value={cadence}
              onChange={(e) => setCadence(e.target.value)}
            >
              <option value="weekly">Weekly</option>
              <option value="daily">Daily</option>
              <option value="2xdaily">2x daily</option>
            </select>
            <button
              className="btn btn-primary mt-4"
              onClick={saveProject}
              disabled={saving}
            >
              {saving ? (
                <Loader className="w-4 h-4 animate-spin" />
              ) : (
                <Save />
              )}
              Save project
            </button>
          </div>
        </div>

        <div className="card bg-base-100 shadow-xl mb-6">
          <div className="card-body">
            <h2 className="card-title">Keywords (max {MAX_KEYWORDS})</h2>
            <p className="text-sm text-gray-500 mb-2">
              Existing keywords are listed below. Paste new keywords in the
              textarea (one per line), then Save.
            </p>
            {keywords.length > 0 && (
              <>
                <label className="label">
                  <span className="label-text">Existing keywords</span>
                </label>
                <ul className="list-none space-y-1 mb-4">
                  {keywords.map((kw, i) => (
                    <li
                      key={kw.id || i}
                      className="flex items-center justify-between gap-2 py-1 px-2 bg-base-200 rounded"
                    >
                      <span className="font-mono text-sm truncate flex-1">
                        {typeof kw === "string" ? kw : kw.keyword}
                      </span>
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs text-error"
                        onClick={() => removeKeyword(i)}
                        aria-label="Remove keyword"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <label className="label">
              <span className="label-text">
                Paste new keywords (one per line)
              </span>
            </label>
            <textarea
              className="textarea textarea-bordered w-full font-mono text-sm"
              placeholder="keyword one&#10;keyword two&#10;keyword three"
              rows={6}
              value={keywordsPaste}
              onChange={(e) => setKeywordsPaste(e.target.value)}
            />
            <button
              className="btn btn-primary mt-4"
              onClick={saveKeywords}
              disabled={saving}
            >
              {saving ? (
                <Loader className="w-4 h-4 animate-spin" />
              ) : (
                <Save />
              )}
              Save keywords
            </button>
          </div>
        </div>

        <div className="card bg-base-100 shadow-xl mb-6">
          <div className="card-body">
            <h2 className="card-title">Prompts (max {MAX_PROMPTS})</h2>
            <p className="text-sm text-gray-500 mb-2">
              Existing prompts are read-only. Add new prompts below, then Save.
            </p>
            {prompts.length > 0 && (
              <>
                <label className="label mt-2">
                  <span className="label-text">Existing prompts</span>
                </label>
                <ul className="list-none space-y-2 mb-4">
                  {prompts.map((p, i) => (
                    <li
                      key={p.id || i}
                      className="flex items-start justify-between gap-2 py-2 px-3 bg-base-200 rounded border border-base-300"
                    >
                      <span className="text-sm flex-1 break-words whitespace-pre-wrap">
                        {p.prompt_text || p.promptText || ""}
                      </span>
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs text-error shrink-0"
                        onClick={() => removeExistingPrompt(i)}
                        aria-label="Remove prompt"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {newPromptsDraft.length > 0 && (
              <>
                <label className="label">
                  <span className="label-text">New prompts (not saved yet)</span>
                </label>
                <ul className="list-none space-y-2 mb-4">
                  {newPromptsDraft.map((np, i) => (
                    <li
                      key={i}
                      className="flex items-start justify-between gap-2 py-2 px-3 bg-base-200 rounded border border-base-300"
                    >
                      <span className="text-sm flex-1 break-words whitespace-pre-wrap">
                        {np.prompt_text}
                      </span>
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs text-error shrink-0"
                        onClick={() => removeNewPromptDraft(i)}
                        aria-label="Remove draft"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <label className="label">
              <span className="label-text">Add new prompt</span>
            </label>
            <textarea
              className="textarea textarea-bordered w-full mb-2"
              placeholder="Prompt text"
              rows={3}
              value={newPromptText}
              onChange={(e) => setNewPromptText(e.target.value)}
            />
            <div className="flex flex-wrap gap-2 mb-2">
              {MODELS.map((m) => (
                <label key={m} className="label cursor-pointer gap-1">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-sm"
                    checked={newPromptModels.includes(m)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setNewPromptModels((prev) =>
                          prev.includes(m) ? prev : [...prev, m]
                        );
                      } else {
                        setNewPromptModels((prev) => {
                          const next = prev.filter((x) => x !== m);
                          return next.length ? next : ["chatgpt"];
                        });
                      }
                    }}
                  />
                  <span className="label-text text-sm">{m}</span>
                </label>
              ))}
            </div>
            <button
              type="button"
              className="btn btn-outline btn-sm mb-4"
              onClick={addNewPromptToDraft}
              disabled={
                prompts.length + newPromptsDraft.length >= MAX_PROMPTS ||
                !newPromptText.trim()
              }
            >
              Add prompt
            </button>
            <button
              className="btn btn-primary mt-4"
              onClick={savePrompts}
              disabled={saving}
            >
              {saving ? (
                <Loader className="w-4 h-4 animate-spin" />
              ) : (
                <Save />
              )}
              Save prompts
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader } from "lucide-react";

export default function NewProjectPage() {
  const router = useRouter();
  const [domain, setDomain] = useState("");
  const [brandTerms, setBrandTerms] = useState("");
  const [cadence, setCadence] = useState("weekly");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!domain.trim()) {
      setError("Domain is required");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/visibility_tracker/project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain: domain.trim(),
          brand_terms: brandTerms
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          cadence,
        }),
      });
      const data = await res.json();
      if (data.success && data.project?.id) {
        router.replace(
          `/geo-seo-visibility-tracking/${encodeURIComponent(data.project.id)}/edit`
        );
        return;
      }
      setError(data.error || "Failed to create project");
    } catch (e) {
      setError(e?.message || "Request failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-base-200 p-8">
      <div className="max-w-xl mx-auto">
        <Link
          href="/geo-seo-visibility-tracking"
          className="btn btn-ghost btn-sm mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>
        <h1 className="text-3xl font-bold mb-6">New project</h1>
        {error && (
          <div className="alert alert-error mb-4">
            <span>{error}</span>
          </div>
        )}
        <form onSubmit={handleSubmit} className="card bg-base-100 shadow-xl">
          <div className="card-body">
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
              type="submit"
              className="btn btn-primary mt-4"
              disabled={loading}
            >
              {loading ? (
                <Loader className="w-4 h-4 animate-spin" />
              ) : (
                "Create project"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

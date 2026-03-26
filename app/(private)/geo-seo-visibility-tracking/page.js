"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { BarChart2, Settings, Plus, Loader, ExternalLink } from "lucide-react";

export default function GeoSeoVisibilityTrackingPage() {
  const [projects, setProjects] = useState([]);
  const [recentRuns, setRecentRuns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [projRes, runsRes] = await Promise.all([
          fetch("/api/visibility_tracker/projects"),
          fetch("/api/visibility_tracker/runs?limit=20"),
        ]);
        const projData = await projRes.json();
        const runsData = await runsRes.json();
        if (projData.success && projData.projects) {
          setProjects(projData.projects);
        }
        if (runsData.success && runsData.runs) {
          setRecentRuns(runsData.runs);
        }
      } catch (e) {
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-base-200 p-8 flex items-center justify-center">
        <Loader className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-200 p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <BarChart2 className="w-8 h-8" />
            AI+SEO Visibility Tracking
          </h1>
          <Link href="/geo-seo-visibility-tracking/new" className="btn btn-primary">
            <Plus className="w-4 h-4" />
            Add project
          </Link>
        </div>

        {projects.length === 0 ? (
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h2 className="card-title">Set up your project</h2>
              <p className="text-gray-600">
                Add a domain and optionally keywords and prompts to start
                tracking visibility.
              </p>
              <Link
                href="/geo-seo-visibility-tracking/new"
                className="btn btn-primary w-fit"
              >
                <Settings className="w-4 h-4" />
                Create your first project
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="card bg-base-100 shadow-xl mb-6">
              <div className="card-body">
                <h2 className="card-title">Projects</h2>
                <div className="overflow-x-auto">
                  <table className="table table-zebra">
                    <thead>
                      <tr>
                        <th>Domain</th>
                        <th>Keywords</th>
                        <th>Prompts</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {projects.map((p) => (
                        <tr key={p.id}>
                          <td className="font-medium">{p.domain}</td>
                          <td>{p.keyword_count ?? 0}</td>
                          <td>{p.prompt_count ?? 0}</td>
                          <td>
                            <Link
                              href={`/geo-seo-visibility-tracking/${encodeURIComponent(p.id)}`}
                              className="btn btn-ghost btn-sm"
                            >
                              <ExternalLink className="w-4 h-4" />
                              View
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <h2 className="card-title">Recent runs</h2>
                {recentRuns.length > 0 ? (
                  <ul className="space-y-2">
                    {recentRuns.slice(0, 20).map((r) => (
                      <li
                        key={r.id}
                        className="flex justify-between items-center p-2 bg-base-200 rounded"
                      >
                        <span className="text-sm">
                          <span className="font-medium text-base-content/80">
                            {r.domain ?? "—"}
                          </span>
                          {" · "}
                          {new Date(r.created_at).toLocaleString()} · {r.run_type}{" "}
                          · {r.status}
                        </span>
                        <Link
                          href={`/geo-seo-visibility-tracking/${encodeURIComponent(r.project_id)}`}
                          className="btn btn-ghost btn-xs"
                        >
                          View project
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-gray-500">
                    No runs yet. Open a project and use &quot;Run now&quot; to
                    start.
                  </p>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

'use client';

/**
 * Test-only page to look up v0 project IDs (e.g. for cjgeo-chats).
 * Remove app/test-v0-project and app/api/test-v0-project when done.
 */

import { useState } from 'react';

export default function TestV0ProjectPage() {
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState([]);
  const [error, setError] = useState(null);
  const [hasFetched, setHasFetched] = useState(false);

  const fetchProjects = async () => {
    setLoading(true);
    setError(null);
    setProjects([]);

    try {
      const url = new URL('/api/test-v0-project/projects', window.location.origin);
      if (search.trim()) {
        url.searchParams.set('search', search.trim());
      }
      const res = await fetch(url);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setProjects(data.projects || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setHasFetched(true);
    }
  };

  const copyId = (id) => {
    navigator.clipboard.writeText(id);
    // Simple feedback - could use toast if available
    const el = document.getElementById(`copy-btn-${id}`);
    if (el) {
      const prev = el.textContent;
      el.textContent = 'Copied!';
      setTimeout(() => (el.textContent = prev), 1500);
    }
  };

  return (
    <div className="min-h-screen bg-base-200 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-2 text-center">
          v0 Projects Lookup (Test)
        </h1>
        <p className="text-center text-base-content/70 mb-8">
          List v0 projects and get their IDs. Use search to filter by name (e.g. cjgeo-chats).
        </p>

        <div className="card bg-base-100 shadow-xl mb-8">
          <div className="card-body">
            <div className="form-control mb-4">
              <label className="label">
                <span className="label-text">Filter by name (optional)</span>
              </label>
              <input
                type="text"
                className="input input-bordered font-mono"
                placeholder="cjgeo-chats"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchProjects()}
                disabled={loading}
              />
            </div>
            <div className="card-actions justify-end">
              <button
                className={`btn btn-primary ${loading ? 'loading' : ''}`}
                onClick={fetchProjects}
                disabled={loading}
              >
                {search.trim() ? 'Search Projects' : 'List All Projects'}
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="alert alert-error mb-8">
            <span>{error}</span>
          </div>
        )}

        {projects.length > 0 && (
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h2 className="card-title">Projects</h2>
              <div className="overflow-x-auto">
                <table className="table table-zebra">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>ID</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projects.map((p) => (
                      <tr key={p.id}>
                        <td className="font-medium">{p.name || '—'}</td>
                        <td>
                          <code className="text-sm">{p.id}</code>
                        </td>
                        <td>
                          <button
                            id={`copy-btn-${p.id}`}
                            className="btn btn-xs btn-ghost"
                            onClick={() => copyId(p.id)}
                          >
                            Copy ID
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {hasFetched && !loading && !error && projects.length === 0 && (
          <div className="alert alert-info">
            <span>
              {search.trim()
                ? 'No projects match your search.'
                : 'No projects found.'}
            </span>
          </div>
        )}

        <div className="alert alert-info mt-8">
          <span>
            Test-only page. Remove <code>app/test-v0-project</code> and{' '}
            <code>app/api/test-v0-project</code> when done.
          </span>
        </div>
      </div>
    </div>
  );
}

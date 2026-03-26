'use client';

/**
 * Test page for tuning decideRenderingStatus.
 * Start a v0 session, take snapshots of DB outline + raw v0 response, then run Diagnose on each row to inspect reasoning.
 */

import { useState } from 'react';
import { decideRenderingStatus } from '@/libs/content-magic/utils/decideRenderingStatus';

const DEFAULT_PROMPT = 'Create a single-page website for a Chinese food restaurant called Golden Dragon. Include a hero section, menu highlights, contact info, and an online order CTA.';

function apiPost(path, body) {
  return fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  }).then(async (res) => {
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    return { status: res.status, ok: res.ok, data };
  });
}

function SnapshotRow({ snapshot, onNotesChange, onDiagnoseResult }) {
  const [diagnosing, setDiagnosing] = useState(false);
  const diagnoseResult = snapshot.diagnoseResult ?? null;

  const handleDiagnose = () => {
    if (!snapshot.raw) {
      onDiagnoseResult?.(snapshot.id, { error: 'No v0 raw data in this snapshot' });
      return;
    }
    setDiagnosing(true);
    onDiagnoseResult?.(snapshot.id, null);
    try {
      const outline = snapshot.outline ?? {};
      const attemptStartedAtMs = outline.send_started_at
        ? new Date(outline.send_started_at).getTime()
        : undefined;
      const initiatedAtMs = outline.queued_at
        ? new Date(outline.queued_at).getTime()
        : undefined;
      const result = decideRenderingStatus(snapshot.raw, {
        attemptStartedAtMs: Number.isFinite(attemptStartedAtMs) ? attemptStartedAtMs : undefined,
        initiatedAtMs: Number.isFinite(initiatedAtMs) ? initiatedAtMs : undefined,
      });
      onDiagnoseResult?.(snapshot.id, result);
    } catch (err) {
      onDiagnoseResult?.(snapshot.id, {
        error: err.message,
        status: null,
        reason: null,
        reasoningLog: [],
      });
    } finally {
      setDiagnosing(false);
    }
  };

  const statusColor =
    diagnoseResult?.status === 'Completed'
      ? 'bg-green-100 text-green-800'
      : diagnoseResult?.status === 'Rendering'
        ? 'bg-yellow-100 text-yellow-800'
        : diagnoseResult?.status === 'Failed'
          ? 'bg-red-100 text-red-800'
          : 'bg-gray-100 text-gray-800';

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded">
          {snapshot.timestamp}
        </span>
        <button
          type="button"
          onClick={handleDiagnose}
          disabled={diagnosing}
          className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {diagnosing ? 'Diagnosing…' : 'Diagnose'}
        </button>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
        <input
          type="text"
          value={snapshot.notes}
          onChange={(e) => onNotesChange(snapshot.id, e.target.value)}
          placeholder="Short notes about what this row represents"
          className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
        />
      </div>

      <details className="text-sm">
        <summary className="cursor-pointer text-gray-600 hover:text-gray-800 font-medium">
          DB Outline
        </summary>
        <pre className="mt-2 max-h-48 overflow-auto rounded bg-gray-50 p-2 text-xs text-gray-700 whitespace-pre-wrap break-all">
          {snapshot.outline != null
            ? JSON.stringify(snapshot.outline, null, 2)
            : '(null or missing)'}
        </pre>
      </details>

      <details className="text-sm">
        <summary className="cursor-pointer text-gray-600 hover:text-gray-800 font-medium">
          v0 Raw
        </summary>
        <pre className="mt-2 max-h-48 overflow-auto rounded bg-gray-50 p-2 text-xs text-gray-700 whitespace-pre-wrap break-all">
          {snapshot.raw != null
            ? JSON.stringify(snapshot.raw, null, 2)
            : '(null or missing)'}
        </pre>
      </details>

      {diagnoseResult && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
          <h4 className="text-sm font-semibold text-gray-800">Diagnose result</h4>
          {diagnoseResult.error ? (
            <p className="text-sm text-red-600">{diagnoseResult.error}</p>
          ) : (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`inline-flex items-center rounded px-2 py-0.5 text-sm font-medium ${statusColor}`}
                >
                  {diagnoseResult.status}
                </span>
                <span className="text-sm text-gray-600">{diagnoseResult.reason}</span>
              </div>
              {Array.isArray(diagnoseResult.reasoningLog) &&
                diagnoseResult.reasoningLog.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs font-medium text-gray-600 mb-1">Reasoning log</p>
                    <ol className="list-decimal list-inside space-y-1 text-xs text-gray-700">
                      {diagnoseResult.reasoningLog.map((msg, i) => (
                        <li key={i} className="pl-1">
                          {msg}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function TestDecideStatusPage() {
  const [articleId, setArticleId] = useState('');
  const [userPrompt, setUserPrompt] = useState(DEFAULT_PROMPT);
  const [chatId, setChatId] = useState('');
  const [starting, setStarting] = useState(false);
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [snapshots, setSnapshots] = useState([]);
  const [error, setError] = useState('');

  const handleStartSession = async () => {
    if (!articleId?.trim()) {
      setError('Please enter an Article ID');
      return;
    }
    if (!userPrompt?.trim()) {
      setError('Please enter a User Prompt');
      return;
    }
    setError('');
    setStarting(true);
    try {
      const payload = {
        articleId: articleId.trim(),
        userPrompt: userPrompt.trim(),
        contextPrompt: '',
        competitorUrls: [],
        competitorContents: [],
        selectedAssets: [],
        useCustomTemplates: false,
        allowGeneratingCustomCss: false,
        allowImageGeneration: false,
        fileMode: true,
        request_id: crypto.randomUUID(),
      };
      const res = await apiPost('/api/content-magic/generate-outline', payload);
      if (!res.ok) {
        setError(res.data?.error || `HTTP ${res.status}`);
        return;
      }
      if (res.data?.chatId && String(res.data.chatId).length > 0) {
        setChatId(String(res.data.chatId));
      } else {
        setError('No chatId in response. Check article exists and request succeeded.');
      }
    } catch (err) {
      setError(err.message || 'Request failed');
    } finally {
      setStarting(false);
    }
  };

  const handleTakeSnapshot = async () => {
    if (!chatId?.trim() || !articleId?.trim()) {
      setError('Need Article ID and Chat ID (start a session first).');
      return;
    }
    setError('');
    setSnapshotLoading(true);
    try {
      const [rawRes, outlineRes] = await Promise.all([
        apiPost('/api/content-magic/outline-pull-raw', { chatId: chatId.trim() }),
        apiPost('/api/content-magic/debug-outline', { articleId: articleId.trim() }),
      ]);
      const raw = rawRes.ok ? rawRes.data?.raw : null;
      const outline = outlineRes.ok ? outlineRes.data?.outline : null;
      if (!rawRes.ok) {
        setError(`outline-pull-raw: ${rawRes.data?.error || rawRes.status}`);
      }
      if (!outlineRes.ok) {
        setError((prev) => (prev ? `${prev}; ` : '') + `debug-outline: ${outlineRes.data?.error || outlineRes.status}`);
      }
      const snapshot = {
        id: crypto.randomUUID(),
        timestamp: new Date().toLocaleString(),
        outline,
        raw,
        notes: '',
        diagnoseResult: null,
      };
      setSnapshots((prev) => [...prev, snapshot]);
    } catch (err) {
      setError(err.message || 'Snapshot failed');
    } finally {
      setSnapshotLoading(false);
    }
  };

  const handleNotesChange = (id, notes) => {
    setSnapshots((prev) =>
      prev.map((s) => (s.id === id ? { ...s, notes } : s))
    );
  };

  const handleDiagnoseResult = (id, diagnoseResult) => {
    setSnapshots((prev) =>
      prev.map((s) => (s.id === id ? { ...s, diagnoseResult } : s))
    );
  };

  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="text-xl font-semibold text-gray-900 mb-2">Decide Status Debugger</h1>
      <p className="text-sm text-gray-600 mb-6">
        Start a v0 session, take snapshots of DB outline + raw v0 response, then run Diagnose on each
        row to inspect decideRenderingStatus reasoning.
      </p>

      {/* Session setup */}
      <section className="rounded-lg border border-gray-200 bg-white p-4 mb-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-800">Session setup</h2>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Article ID</label>
          <input
            type="text"
            value={articleId}
            onChange={(e) => setArticleId(e.target.value)}
            placeholder="UUID from content_magic_articles"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            disabled={starting}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">User prompt</label>
          <textarea
            value={userPrompt}
            onChange={(e) => setUserPrompt(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            disabled={starting}
          />
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={handleStartSession}
            disabled={starting}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {starting ? 'Starting…' : 'Start v0 Session'}
          </button>
          {chatId && (
            <span className="text-sm text-gray-600">
              Chat ID: <code className="bg-gray-100 px-1.5 py-0.5 rounded font-mono text-xs">{chatId}</code>
            </span>
          )}
        </div>
      </section>

      {/* Snapshots */}
      <section className="rounded-lg border border-gray-200 bg-white p-4 mb-6">
        <h2 className="text-sm font-semibold text-gray-800 mb-3">Snapshots</h2>
        <div className="flex items-center gap-3 mb-4">
          <button
            type="button"
            onClick={handleTakeSnapshot}
            disabled={snapshotLoading || !chatId}
            className="px-4 py-2 rounded-lg bg-gray-800 text-white text-sm font-medium hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {snapshotLoading ? 'Taking…' : 'Take Snapshot'}
          </button>
          <span className="text-sm text-gray-500">
            Records DB outline + v0 raw for this chat. Enable after starting a session.
          </span>
        </div>
        <div className="space-y-4">
          {snapshots.map((snapshot) => (
            <SnapshotRow
              key={snapshot.id}
              snapshot={snapshot}
              onNotesChange={handleNotesChange}
              onDiagnoseResult={handleDiagnoseResult}
            />
          ))}
          {snapshots.length === 0 && (
            <p className="text-sm text-gray-500">No snapshots yet. Start a session, then take a snapshot.</p>
          )}
        </div>
      </section>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 mb-6">
          {error}
        </div>
      )}
    </div>
  );
}

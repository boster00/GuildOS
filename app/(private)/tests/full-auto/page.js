'use client';

import { useState, useEffect, useRef } from 'react';

const POLL_INTERVAL_MS = 10_000;
const POLL_TIMEOUT_MS = 5 * 60 * 1000;
const LS_KEY = 'fullAutoLastArticleId';

// ── Step status indicator ────────────────────────────────────────────────────

function StatusBadge({ status }) {
  if (status === 'done') return (
    <span className="inline-flex items-center rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">Done</span>
  );
  if (status === 'running') return (
    <span className="inline-flex items-center gap-1 rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
      <span className="h-2 w-2 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
      Running
    </span>
  );
  if (status === 'error') return (
    <span className="inline-flex items-center rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">Error</span>
  );
  if (status === 'skipped') return (
    <span className="inline-flex items-center rounded bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">Partial</span>
  );
  return <span className="text-gray-400 text-xs">—</span>;
}

function StepRow({ label, status, detail }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
      <div className="flex items-center gap-3">
        <StatusBadge status={status} />
        <span className="text-sm text-gray-800">{label}</span>
      </div>
      {detail && <span className="text-xs text-gray-500 ml-4 text-right max-w-xs truncate">{detail}</span>}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function FullAutoTestPage() {
  const [title, setTitle] = useState('');
  const [mainKeyword, setMainKeyword] = useState('');
  const [running, setRunning] = useState(false);
  const [articleId, setArticleId] = useState('');
  const [chatId, setChatId] = useState('');
  const [error, setError] = useState('');
  const [log, setLog] = useState([]);
  const [steps, setSteps] = useState({
    create: 'idle',
    competitors: 'idle',
    keywords: 'idle',
    outline: 'idle',
  });
  const [stepDetails, setStepDetails] = useState({});
  const pollRef = useRef(null);
  const pollStartRef = useRef(null);

  // Restore last article ID from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LS_KEY);
      if (saved) setArticleId(saved);
    } catch {}
  }, []);

  function addLog(msg) {
    const ts = new Date().toLocaleTimeString();
    setLog(prev => [`[${ts}] ${msg}`, ...prev]);
  }

  function updateStep(key, status, detail) {
    setSteps(prev => ({ ...prev, [key]: status }));
    if (detail != null) setStepDetails(prev => ({ ...prev, [key]: detail }));
  }

  // Polling logic for outline-status
  function startPolling(aid) {
    pollStartRef.current = Date.now();
    addLog('Polling outline-status every 10s...');

    function poll() {
      pollRef.current = setTimeout(async () => {
        if (Date.now() - pollStartRef.current > POLL_TIMEOUT_MS) {
          addLog('Polling timed out after 5 minutes');
          updateStep('outline', 'error', 'Timed out waiting for draft');
          setRunning(false);
          return;
        }

        try {
          const res = await fetch('/api/content-magic/outline-status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ articleId: aid }),
          });
          const data = await res.json();
          const renderStatus = data?.status;

          if (renderStatus === 'completed') {
            addLog('Draft ready — adopting...');
            try {
              // Primary adopt API (LEGACY: was /api/content-magic/adopt-draft)
              const adoptRes = await fetch('/api/content-magic/adopt-draft-new', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ articleId: aid }),
              });
              const adoptData = await adoptRes.json();
              if (adoptRes.ok && adoptData?.success) {
                addLog(`Draft adopted (${adoptData.adoptedLength ?? 0} chars).`);
                updateStep('outline', 'done', 'Draft adopted');
              } else {
                addLog('Draft ready but adopt failed: ' + (adoptData?.error || adoptRes.status));
                updateStep('outline', 'done', 'Draft ready (adopt failed)');
              }
            } catch (adoptErr) {
              addLog('Adopt error: ' + adoptErr.message);
              updateStep('outline', 'done', 'Draft ready (adopt failed)');
            }
            setRunning(false);
          } else if (renderStatus === 'failed') {
            addLog('Draft generation failed');
            updateStep('outline', 'error', data?.error || 'Draft generation failed');
            setRunning(false);
          } else {
            addLog(`Outline status: ${renderStatus ?? 'rendering...'}`);
            poll();
          }
        } catch (err) {
          addLog(`Poll error: ${err.message}`);
          poll();
        }
      }, POLL_INTERVAL_MS);
    }

    poll();
  }

  function stopPolling() {
    if (pollRef.current) clearTimeout(pollRef.current);
  }

  useEffect(() => () => stopPolling(), []);

  async function handleRun() {
    if (!title.trim() || !mainKeyword.trim()) {
      setError('Please enter both a title and a main keyword.');
      return;
    }

    setError('');
    setRunning(true);
    setLog([]);
    setSteps({ create: 'running', competitors: 'running', keywords: 'running', outline: 'idle' });
    setStepDetails({});
    stopPolling();

    addLog(`Starting full-auto: "${title.trim()}" / "${mainKeyword.trim()}"`);

    try {
      const res = await fetch('/api/content-magic/full-auto/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ title: title.trim(), mainKeyword: mainKeyword.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }

      const newArticleId = data.articleId;
      if (newArticleId) {
        setArticleId(newArticleId);
        try { localStorage.setItem(LS_KEY, newArticleId); } catch {}
      }

      // Update step statuses from response
      const s = data.steps || {};

      updateStep('create', newArticleId ? 'done' : 'error', 'Article created');

      const competitorStatus = s.competitorsError ? 'error' : (s.competitors > 0 ? 'done' : 'error');
      updateStep('competitors', competitorStatus, s.competitorsError
        ? s.competitorsError
        : `${s.competitors ?? 0} pages crawled, ${s.topics ?? 0} topics found`);

      const keywordStatus = s.keywordsError ? 'skipped' : (s.keywords > 0 ? 'done' : 'skipped');
      updateStep('keywords', keywordStatus, s.keywordsError
        ? s.keywordsError
        : `${s.keywords ?? 0} keywords`);

      addLog(`Article created: ${newArticleId}`);
      addLog(`Competitors: ${s.competitors ?? 0}, Topics: ${s.topics ?? 0}, Keywords: ${s.keywords ?? 0}`);

      if (data.status === 'outline_queued' && data.chatId) {
        setChatId(data.chatId);
        updateStep('outline', 'running', 'Draft rendering...');
        addLog(`Outline queued (chatId: ${data.chatId})`);
        startPolling(newArticleId);
      } else if (data.status === 'completed') {
        updateStep('outline', 'done', 'Draft ready');
        setRunning(false);
        addLog('Draft completed.');
      } else {
        updateStep('outline', 'error', data.error || 'Outline not queued');
        setRunning(false);
        addLog(`Unexpected status: ${data.status}`);
      }

    } catch (err) {
      setError(err.message || 'Unexpected error');
      addLog(`Error: ${err.message}`);
      setSteps(prev => ({
        create: prev.create === 'running' ? 'error' : prev.create,
        competitors: prev.competitors === 'running' ? 'error' : prev.competitors,
        keywords: prev.keywords === 'running' ? 'error' : prev.keywords,
        outline: 'idle',
      }));
      setRunning(false);
    }
  }

  const articleUrl = articleId ? `/content-magic/${articleId}` : null;
  const outlineDone = steps.outline === 'done';
  const outlineError = steps.outline === 'error';

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Full Auto Content Magic</h1>
        <p className="text-sm text-gray-500 mb-6">
          Enter a title and main keyword. One click runs the full pipeline: competitor research, keyword research, and draft generation.
        </p>

        {/* Inputs */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Article Title</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              disabled={running}
              placeholder="e.g. Best CRM Software for Small Businesses in 2025"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-50 disabled:text-gray-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Main Keyword</label>
            <input
              type="text"
              value={mainKeyword}
              onChange={e => setMainKeyword(e.target.value)}
              disabled={running}
              placeholder="e.g. crm software for small business"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-50 disabled:text-gray-400"
            />
          </div>
          <button
            onClick={handleRun}
            disabled={running || !title.trim() || !mainKeyword.trim()}
            className="w-full px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-md hover:bg-purple-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {running ? (
              <>
                <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                Running...
              </>
            ) : 'Do next action'}
          </button>
          {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
        </div>

        {/* Step progress */}
        {(steps.create !== 'idle' || steps.competitors !== 'idle' || steps.keywords !== 'idle' || steps.outline !== 'idle') && (
          <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Progress</h2>
            <StepRow label="Create article" status={steps.create} detail={stepDetails.create} />
            <StepRow label="Find competitors and topics" status={steps.competitors} detail={stepDetails.competitors} />
            <StepRow label="Research keywords" status={steps.keywords} detail={stepDetails.keywords} />
            <StepRow label="Generate draft" status={steps.outline} detail={stepDetails.outline} />
          </div>
        )}

        {/* Article result */}
        {articleId && (
          <div className={`rounded-lg border p-4 mb-4 ${outlineDone ? 'bg-green-50 border-green-200' : outlineError ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">
                {outlineDone ? 'Draft ready' : outlineError ? 'Article created (draft failed)' : 'Article created — draft in progress'}
              </span>
              {articleUrl && (
                <a
                  href={articleUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-purple-600 hover:underline font-medium"
                >
                  Open article →
                </a>
              )}
            </div>
            <p className="text-xs text-gray-500 font-mono break-all">{articleId}</p>
            {chatId && <p className="text-xs text-gray-400 mt-1">chatId: {chatId}</p>}
          </div>
        )}

        {/* Log */}
        {log.length > 0 && (
          <div className="bg-gray-900 rounded-lg p-3">
            <h2 className="text-xs font-semibold text-gray-400 mb-2">Log</h2>
            <div className="space-y-0.5 max-h-48 overflow-y-auto">
              {log.map((entry, i) => (
                <p key={i} className="text-xs text-gray-300 font-mono">{entry}</p>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

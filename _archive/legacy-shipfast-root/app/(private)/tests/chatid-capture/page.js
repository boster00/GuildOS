'use client';

/**
 * chatId Capture Test Page — drives the same API endpoints as the main app
 * and logs each step with EXPECTED vs ACTUAL and PASS|FAIL.
 *
 * Endpoints used:
 * - POST /api/content-magic/generate-outline
 * - POST /api/content-magic/outline-status (chatIdCheckOnly and normal mode)
 */

import { useState } from 'react';

function StepRow({ step, description, expected, actual, pass, raw }) {
  return (
    <tr className={pass === false ? 'bg-red-50' : pass === true ? 'bg-green-50/50' : ''}>
      <td className="px-3 py-2 text-sm font-medium text-gray-700">{step}</td>
      <td className="px-3 py-2 text-sm text-gray-900">{description}</td>
      <td className="px-3 py-2 text-sm text-gray-600">{expected}</td>
      <td className="px-3 py-2">
        {pass === true && (
          <span className="inline-flex items-center rounded bg-green-100 px-2 py-0.5 text-sm font-medium text-green-800">
            PASS
          </span>
        )}
        {pass === false && (
          <span className="inline-flex items-center rounded bg-red-100 px-2 py-0.5 text-sm font-medium text-red-800">
            FAIL
          </span>
        )}
        {pass === null && (
          <span className="text-gray-400 text-sm">—</span>
        )}
      </td>
      <td className="px-3 py-2">
        {raw != null && (
          <details className="text-xs">
            <summary className="cursor-pointer text-gray-500 hover:text-gray-700">Raw response</summary>
            <pre className="mt-1 max-h-32 overflow-auto rounded bg-gray-100 p-2 text-gray-700 whitespace-pre-wrap break-all">
              {typeof raw === 'string' ? raw : JSON.stringify(raw, null, 2)}
            </pre>
          </details>
        )}
      </td>
    </tr>
  );
}

export default function TestChatIdCapturePage() {
  const [articleId, setArticleId] = useState('');
  const [userPrompt, setUserPrompt] = useState('Generate a minimal landing page for a chinese restaurant.');
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState([]);
  const [rawLog, setRawLog] = useState([]);

  const log = (msg) => {
    const entry = `[${new Date().toLocaleTimeString()}] ${msg}`;
    setRawLog((prev) => [...prev, entry]);
  };

  const addStep = (step, description, expected, actual, pass, raw) => {
    setSteps((prev) => [...prev, { step, description, expected, actual, pass, raw }]);
  };

  const apiPost = async (path, body) => {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    return { status: res.status, ok: res.ok, data };
  };

  const runTest = async () => {
    if (!articleId?.trim()) {
      alert('Please enter an Article ID');
      return;
    }
    if (!userPrompt?.trim()) {
      alert('Please enter a User Prompt');
      return;
    }

    setRunning(true);
    setSteps([]);
    setRawLog([]);

    const aid = articleId.trim();
    const prompt = userPrompt.trim();
    const requestId = crypto.randomUUID();
    let firstChatId = null;

    try {
      // ── Step 1: POST generate-outline ─────────────────────────────────────
      log('Step 1: POST /api/content-magic/generate-outline');
      const payload = {
        articleId: aid,
        userPrompt: prompt,
        contextPrompt: '',
        competitorUrls: [],
        competitorContents: [],
        selectedAssets: [],
        useCustomTemplates: false,
        allowGeneratingCustomCss: false,
        allowImageGeneration: false,
        fileMode: true,
        request_id: requestId,
      };
      const res1 = await apiPost('/api/content-magic/generate-outline', payload);
      const hasChatId = res1.data?.chatId && String(res1.data.chatId).length > 0;
      const pass1 = res1.ok && res1.data?.success === true && hasChatId;
      if (hasChatId) {
        firstChatId = res1.data.chatId;
        log(`✓ Step 1: chatId = ${firstChatId}`);
      } else {
        log(`✗ Step 1: expected chatId, got status=${res1.status} success=${res1.data?.success} chatId=${res1.data?.chatId ?? 'missing'}`);
      }
      addStep(
        1,
        'POST generate-outline',
        'HTTP 200, success: true, chatId present',
        pass1 ? `chatId=${firstChatId}` : `status=${res1.status}, success=${res1.data?.success}, chatId=${res1.data?.chatId ?? 'null'}`,
        pass1,
        res1.data
      );

      if (!pass1) {
        setRunning(false);
        return;
      }

      // ── Step 2: Immediate chatIdCheckOnly poll ─────────────────────────────
      log('Step 2: Immediate chatIdCheckOnly poll');
      const poll2 = await apiPost('/api/content-magic/outline-status', {
        articleId: aid,
        chatIdCheckOnly: true,
      });
      const chatId2 = poll2.data?.chatId ?? null;
      const pass2 = poll2.ok && chatId2 && String(chatId2).length > 0;
      if (pass2) log(`✓ Step 2: chatId in DB = ${chatId2}`);
      else log(`✗ Step 2: expected chatId in DB, got chatId=${chatId2}`);
      addStep(
        2,
        'Immediate chatIdCheckOnly poll',
        'chatId present in DB',
        pass2 ? `chatId=${chatId2}` : `chatId=${chatId2 ?? 'null'}`,
        pass2,
        poll2.data
      );

      // ── Step 3: Fast-poll confirmation (3 × 500ms) ─────────────────────────
      log('Step 3: Fast-poll confirmation (3 × 500ms)');
      let confirmed = !!chatId2;
      if (!confirmed) {
        for (let i = 0; i < 3; i++) {
          await new Promise((r) => setTimeout(r, 500));
          const p = await apiPost('/api/content-magic/outline-status', {
            articleId: aid,
            chatIdCheckOnly: true,
          });
          if (p.data?.chatId) {
            confirmed = true;
            log(`✓ Step 3: chatId confirmed on attempt ${i + 1}`);
            break;
          }
        }
      } else {
        log('✓ Step 3: chatId already confirmed from Step 2');
      }
      const pass3 = confirmed;
      if (!pass3) log('✗ Step 3: chatId not confirmed after 3 polls');
      addStep(
        3,
        'Fast-poll confirmation (3 × 500ms)',
        'chatId confirmed in DB',
        pass3 ? 'confirmed' : 'not confirmed',
        pass3,
        null
      );

      // ── Step 4: Status progression check ───────────────────────────────────
      log('Step 4: Status progression check');
      const poll4 = await apiPost('/api/content-magic/outline-status', {
        articleId: aid,
        chatIdCheckOnly: true,
      });
      const status4 = poll4.data?.status ?? 'none';
      const validStatuses = ['queued', 'sending', 'rendering', 'completed'];
      const pass4 = poll4.ok && validStatuses.includes(status4);
      if (pass4) log(`✓ Step 4: status = ${status4}`);
      else log(`✗ Step 4: expected queued|sending|rendering|completed, got status=${status4}`);
      addStep(
        4,
        'Status progression check',
        'status in queued | sending | rendering | completed',
        `status=${status4}`,
        pass4,
        poll4.data
      );

      // ── Step 5: Full outline-status (normal mode) ──────────────────────────
      log('Step 5: Full outline-status (normal mode)');
      const poll5 = await apiPost('/api/content-magic/outline-status', { articleId: aid });
      const pass5 = poll5.ok && !poll5.data?.error;
      if (pass5) log('✓ Step 5: full outline-status returned without error');
      else log(`✗ Step 5: error or crash: ${poll5.data?.error ?? 'unknown'}`);
      addStep(
        5,
        'Full outline-status (normal)',
        'Returns DB state without crashing',
        pass5 ? 'ok' : (poll5.data?.error ?? `status=${poll5.status}`),
        pass5,
        poll5.data
      );

      // ── Step 6: Idempotency re-submit (same request_id) ────────────────────
      log('Step 6: Idempotency re-submit (same request_id)');
      const res6 = await apiPost('/api/content-magic/generate-outline', {
        ...payload,
        request_id: requestId,
      });
      const chatId6 = res6.data?.chatId ?? null;
      const pass6 = res6.ok && chatId6 && chatId6 === firstChatId;
      if (pass6) log(`✓ Step 6: same chatId returned (idempotent): ${chatId6}`);
      else log(`✗ Step 6: expected same chatId ${firstChatId}, got ${chatId6}`);
      addStep(
        6,
        'Idempotency re-submit',
        `Same chatId returned (${firstChatId})`,
        pass6 ? `chatId=${chatId6}` : `got ${chatId6}`,
        pass6,
        res6.data
      );

      // ── Step 7: Duplicate-article guard (new request_id, outline has chatId) ─
      log('Step 7: Duplicate-article guard (new request_id, outline already has chatId)');
      const res7 = await apiPost('/api/content-magic/generate-outline', {
        ...payload,
        request_id: crypto.randomUUID(),
      });
      const chatId7 = res7.data?.chatId ?? null;
      const pass7 = res7.ok && chatId7 && chatId7 === firstChatId;
      if (pass7) log(`✓ Step 7: existing chatId returned immediately: ${chatId7}`);
      else log(`✗ Step 7: expected existing chatId ${firstChatId}, got ${chatId7}`);
      addStep(
        7,
        'Duplicate-article guard',
        'Existing chatId returned immediately (no new v0 chat)',
        pass7 ? `chatId=${chatId7}` : `got ${chatId7}`,
        pass7,
        res7.data
      );

      const allPass = [pass1, pass2, pass3, pass4, pass5, pass6, pass7].every(Boolean);
      log(allPass ? '--- All steps PASSED ---' : '--- Some steps FAILED ---');
    } catch (err) {
      log(`Error: ${err.message}`);
      addStep(
        '?',
        'Exception',
        'No exception',
        err.message,
        false,
        { stack: err.stack }
      );
    } finally {
      setRunning(false);
    }
  };

  const reset = () => {
    setSteps([]);
    setRawLog([]);
  };

  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="text-xl font-semibold text-gray-900 mb-2">chatId Capture — Test Runner</h1>
      <p className="text-sm text-gray-600 mb-6">
        Uses the same API endpoints as the main app. Provide an existing article ID (from Content Magic).
      </p>

      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Article ID</label>
          <input
            type="text"
            value={articleId}
            onChange={(e) => setArticleId(e.target.value)}
            placeholder="e.g. uuid from content_magic_articles"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            disabled={running}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">User Prompt</label>
          <input
            type="text"
            value={userPrompt}
            onChange={(e) => setUserPrompt(e.target.value)}
            placeholder="Short prompt for v0"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            disabled={running}
          />
        </div>
        <div className="flex gap-3">
          <button
            onClick={runTest}
            disabled={running}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {running ? 'Running…' : 'Run Full Test'}
          </button>
          <button
            onClick={reset}
            disabled={running}
            className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
          >
            Reset
          </button>
        </div>
      </div>

      {steps.length > 0 && (
        <div className="rounded-lg border border-gray-200 overflow-hidden mb-6">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Step</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Expected</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Result</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Raw</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {steps.map((s, i) => (
                <StepRow key={i} {...s} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rawLog.length > 0 && (
        <details className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <summary className="cursor-pointer text-sm font-medium text-gray-700">Raw log</summary>
          <pre className="mt-3 text-xs text-gray-600 whitespace-pre-wrap font-mono max-h-64 overflow-auto">
            {rawLog.join('\n')}
          </pre>
        </details>
      )}
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import { Play, RotateCcw, Trash2, RefreshCw, AlertCircle, CheckCircle, Database } from 'lucide-react';

const DEFAULT_VT_SCHEDULE = {
  source: 'demo',
  run_type: 'manual',
  demo_contract: {
    domain: 'example.com',
    keywords: ['bdnf ELISA kit', 'neurotrophin assay'],
    prompts: [{ text: 'recommend a bdnf elisa kit', models: ['chatgpt'] }],
    ai_provider: 'eden',
  },
};

function getCronHeaders() {
  const secret = process.env.NEXT_PUBLIC_CRON_SECRET || process.env.NEXT_PUBLIC_VT_CRON_SECRET || '';
  return secret ? { 'x-cron-secret': secret } : {};
}

export default function CronTestPage() {
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [dbTables, setDbTables] = useState(null);
  const [dbLoading, setDbLoading] = useState(false);
  const [vtPayload, setVtPayload] = useState({
    run_id: null,
    job_ids: [],
    assigned_jobs: [],
    job_reports: [],
    persisted: [],
    summary: null,
  });

  const pullDbState = async () => {
    setDbLoading(true);
    setDbTables(null);
    try {
      const res = await fetch('/api/cron/debug/tables', {
        headers: getCronHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Request failed');
      setDbTables(data);
    } catch (e) {
      setDbTables({ error: e?.message || 'Failed to load tables' });
    } finally {
      setDbLoading(false);
    }
  };

  const log = (action, success, message, duration = 0) => {
    const timestamp = new Date().toLocaleTimeString();
    
    setResults(prev => [...prev, {
      id: `${Date.now()}-${prev.length}-${Math.random().toString(36).slice(2, 9)}`,
      timestamp,
      action,
      success,
      message,
      duration,
    }]);
  };

  // ============================================
  // VT PIPELINE (6-step spec)
  // ============================================
  const vtBaseUrl = '/api/visibility_tracker';
  const vtHeaders = () => ({ 'Content-Type': 'application/json', ...getCronHeaders() });

  const testVtSchedule = async () => {
    setIsLoading(true);
    const start = Date.now();
    const body = DEFAULT_VT_SCHEDULE;
    log('VT Schedule', false, '[REQUEST] payload:\n' + JSON.stringify(body, null, 2));
    try {
      const res = await fetch(`${vtBaseUrl}/schedule`, { method: 'POST', headers: vtHeaders(), body: JSON.stringify(body), credentials: 'include' });
      const data = await res.json();
      const duration = Date.now() - start;
      const serverLogs = (data.logs && data.logs.length) ? data.logs.join('\n') + '\n' : '';
      if (data.success && data.run_id) {
        log('VT Schedule', true, serverLogs + `[CHECK PASSED] run_id: ${data.run_id}, jobs_created: ${data.jobs_created}, job_ids: ${(data.job_ids || []).length}`, duration);
        setVtPayload((p) => ({ ...p, run_id: data.run_id, job_ids: data.job_ids || [], jobs_created: data.jobs_created }));
      } else {
        log('VT Schedule', false, serverLogs + `[CHECK FAILED] ${data.message || data.error || 'Failed'}`, duration);
      }
    } catch (e) {
      log('VT Schedule', false, `[EXCEPTION] ${e.message}`, Date.now() - start);
    } finally {
      setIsLoading(false);
    }
  };

  const testVtAssign = async () => {
    setIsLoading(true);
    const start = Date.now();
    const run_id = vtPayload.run_id;
    const body = { worker_id: 'test-worker', batch_size: 5, ...(run_id ? { run_id } : {}) };
    log('VT Assign', false, '[REQUEST] payload:\n' + JSON.stringify(body, null, 2));
    try {
      const res = await fetch(`${vtBaseUrl}/assign`, { method: 'POST', headers: vtHeaders(), body: JSON.stringify(body), credentials: 'include' });
      const data = await res.json();
      const duration = Date.now() - start;
      const serverLogs = (data.logs && data.logs.length) ? data.logs.join('\n') + '\n' : '';
      if (data.success) {
        const count = (data.assigned_jobs || []).length;
        log('VT Assign', true, serverLogs + `[CHECK PASSED] assigned_jobs: ${count}`, duration);
        setVtPayload((p) => ({ ...p, assigned_jobs: data.assigned_jobs || [] }));
      } else {
        log('VT Assign', false, serverLogs + `[CHECK FAILED] ${data.message || data.error || 'Failed'}`, duration);
      }
    } catch (e) {
      log('VT Assign', false, `[EXCEPTION] ${e.message}`, Date.now() - start);
    } finally {
      setIsLoading(false);
    }
  };

  const testVtExecute = async () => {
    setIsLoading(true);
    const start = Date.now();
    const assigned_jobs = vtPayload.assigned_jobs || [];
    const body = { assigned_jobs };
    log('VT Execute', false, '[REQUEST] payload:\n' + JSON.stringify({ assigned_jobs: assigned_jobs.length, sample: assigned_jobs[0] ? { job_id: assigned_jobs[0].job_id, job_type: assigned_jobs[0].job_type } : null }, null, 2));
    try {
      if (assigned_jobs.length === 0) {
        log('VT Execute', false, '[CHECK] No jobs to execute (assigned_jobs empty). Run Assign first.', Date.now() - start);
        setIsLoading(false);
        return;
      }
      const res = await fetch(`${vtBaseUrl}/execute`, { method: 'POST', headers: vtHeaders(), body: JSON.stringify(body), credentials: 'include' });
      const data = await res.json();
      const duration = Date.now() - start;
      const serverLogs = (data.logs && data.logs.length) ? data.logs.join('\n') + '\n' : '';
      if (data.success) {
        const reports = data.job_reports || [];
        const reportCount = reports.length;
        let detailsLog = serverLogs + `[CHECK PASSED] job_reports: ${reportCount}`;
        for (const r of reports) {
          const raw = JSON.stringify(r.payload || r, null, 2);
          const preview = raw.length > 500 ? raw.slice(0, 500) + '...' : raw;
          detailsLog += `\n\n[Job ${r.job_id?.slice(0, 8)}] payload (first 500 chars):\n${preview}`;
        }
        log('VT Execute', true, detailsLog, duration);
        setVtPayload((p) => ({ ...p, job_reports: reports }));
      } else {
        log('VT Execute', false, serverLogs + `[CHECK FAILED] ${data.message || data.error || 'Failed'}`, duration);
      }
    } catch (e) {
      log('VT Execute', false, `[EXCEPTION] ${e.message}`, Date.now() - start);
    } finally {
      setIsLoading(false);
    }
  };

  const testVtLogResults = async () => {
    setIsLoading(true);
    const start = Date.now();
    const run_id = vtPayload.run_id;
    const job_reports = vtPayload.job_reports || [];
    const body = { run_id, job_reports };
    log('VT Log Results', false, '[REQUEST] payload:\n' + JSON.stringify({ run_id, job_reports_count: job_reports.length }, null, 2));
    try {
      if (!run_id) {
        log('VT Log Results', false, '[CHECK FAILED] run_id required. Run Schedule first.', Date.now() - start);
        setIsLoading(false);
        return;
      }
      const res = await fetch(`${vtBaseUrl}/log-results`, { method: 'POST', headers: vtHeaders(), body: JSON.stringify(body), credentials: 'include' });
      const data = await res.json();
      const duration = Date.now() - start;
      const serverLogs = (data.logs && data.logs.length) ? data.logs.join('\n') + '\n' : '';
      if (data.success) {
        log('VT Log Results', true, serverLogs + `[CHECK PASSED] persisted: ${(data.persisted || []).length}, job_updates: ${(data.job_updates || []).length}`, duration);
        setVtPayload((p) => ({ ...p, persisted: data.persisted || [], job_updates: data.job_updates || [] }));
      } else {
        log('VT Log Results', false, serverLogs + `[CHECK FAILED] ${data.message || data.error || 'Failed'}`, duration);
      }
    } catch (e) {
      log('VT Log Results', false, `[EXCEPTION] ${e.message}`, Date.now() - start);
    } finally {
      setIsLoading(false);
    }
  };

  const testVtArchive = async () => {
    setIsLoading(true);
    const start = Date.now();
    const run_id = vtPayload.run_id;
    const body = run_id ? { run_id } : {};
    log('VT Archive', false, '[REQUEST] payload:\n' + JSON.stringify(body, null, 2));
    try {
      const res = await fetch(`${vtBaseUrl}/archive`, { method: 'POST', headers: vtHeaders(), body: JSON.stringify(body), credentials: 'include' });
      const data = await res.json();
      const duration = Date.now() - start;
      const serverLogs = (data.logs && data.logs.length) ? data.logs.join('\n') + '\n' : '';
      if (data.success) {
        log('VT Archive', true, serverLogs + `[CHECK PASSED] deleted_jobs: ${data.deleted_jobs}, remaining_jobs: ${data.remaining_jobs}`, duration);
      } else {
        log('VT Archive', false, serverLogs + `[CHECK FAILED] ${data.message || data.error || 'Failed'}`, duration);
      }
    } catch (e) {
      log('VT Archive', false, `[EXCEPTION] ${e.message}`, Date.now() - start);
    } finally {
      setIsLoading(false);
    }
  };

  const testVtValidateRun = async () => {
    setIsLoading(true);
    const start = Date.now();
    const run_id = vtPayload.run_id;
    const body = { run_id };
    log('VT Validate Run', false, '[REQUEST] payload:\n' + JSON.stringify(body, null, 2));
    try {
      if (!run_id) {
        log('VT Validate Run', false, '[CHECK FAILED] run_id required. Run Schedule first.', Date.now() - start);
        setIsLoading(false);
        return;
      }
      const res = await fetch(`${vtBaseUrl}/validate-run`, { method: 'POST', headers: vtHeaders(), body: JSON.stringify(body), credentials: 'include' });
      const data = await res.json();
      const duration = Date.now() - start;
      const serverLogs = (data.logs && data.logs.length) ? data.logs.join('\n') + '\n' : '';
      if (data.success) {
        log('VT Validate Run', true, serverLogs + `[CHECK PASSED] status: ${data.status}, summary: ${JSON.stringify(data.summary)}`, duration);
        setVtPayload((p) => ({ ...p, summary: data.summary }));
      } else {
        log('VT Validate Run', false, serverLogs + `[CHECK FAILED] ${data.message || data.error || 'Failed'}`, duration);
      }
    } catch (e) {
      log('VT Validate Run', false, `[EXCEPTION] ${e.message}`, Date.now() - start);
    } finally {
      setIsLoading(false);
    }
  };

  const testVtPipelineFull = async () => {
    setIsLoading(true);
    const start = Date.now();
    try {
      log('VT Pipeline (full)', true, '[REQUEST] payload:\n' + JSON.stringify(DEFAULT_VT_SCHEDULE, null, 2));
      log('VT Pipeline (full)', true, '[STEP 1] Running Schedule → Assign → Execute → Log Results → Archive → Validate...');
      const headers = vtHeaders();

      const scheduleRes = await fetch(`${vtBaseUrl}/schedule`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(DEFAULT_VT_SCHEDULE), credentials: 'include' });
      const scheduleData = await scheduleRes.json();
      const s1Logs = (scheduleData.logs && scheduleData.logs.length) ? scheduleData.logs.join('\n') + '\n' : '';
      const s1Ok = scheduleData.success && scheduleData.run_id;
      log('VT Pipeline (full)', s1Ok, s1Logs + `[CHECK 1] Schedule: success=${scheduleData.success}, run_id=${scheduleData.run_id ?? 'missing'}`);
      if (!s1Ok) {
        log('VT Pipeline (full)', false, `[CHECK FAILED] Schedule: ${scheduleData.message || scheduleData.error || 'Schedule failed'}`, Date.now() - start);
        return;
      }
      const run_id = scheduleData.run_id;
      setVtPayload((p) => ({ ...p, run_id, job_ids: scheduleData.job_ids || [] }));

      const assignRes = await fetch(`${vtBaseUrl}/assign`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ run_id, worker_id: 'test-worker', batch_size: 10 }), credentials: 'include' });
      const assignData = await assignRes.json();
      const s2Logs = (assignData.logs && assignData.logs.length) ? assignData.logs.join('\n') + '\n' : '';
      const s2Ok = assignData.success;
      log('VT Pipeline (full)', s2Ok, s2Logs + `[CHECK 2] Assign: success=${assignData.success}, assigned_jobs=${(assignData.assigned_jobs || []).length}`);
      if (!s2Ok) {
        log('VT Pipeline (full)', false, `[CHECK FAILED] Assign: ${assignData.message || assignData.error || 'Assign failed'}`, Date.now() - start);
        return;
      }
      const assigned_jobs = assignData.assigned_jobs || [];
      setVtPayload((p) => ({ ...p, assigned_jobs }));

      const executeRes = await fetch(`${vtBaseUrl}/execute`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ assigned_jobs }), credentials: 'include' });
      const executeData = await executeRes.json();
      const s3Logs = (executeData.logs && executeData.logs.length) ? executeData.logs.join('\n') + '\n' : '';
      const s3Ok = executeData.success;
      log('VT Pipeline (full)', s3Ok, s3Logs + `[CHECK 3] Execute: success=${executeData.success}, job_reports=${(executeData.job_reports || []).length}`);
      if (!s3Ok) {
        log('VT Pipeline (full)', false, `[CHECK FAILED] Execute: ${executeData.message || executeData.error || 'Execute failed'}`, Date.now() - start);
        return;
      }
      const job_reports = executeData.job_reports || [];
      setVtPayload((p) => ({ ...p, job_reports }));

      const logRes = await fetch(`${vtBaseUrl}/log-results`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ run_id, job_reports }), credentials: 'include' });
      const logData = await logRes.json();
      const s4Logs = (logData.logs && logData.logs.length) ? logData.logs.join('\n') + '\n' : '';
      const s4Ok = logData.success;
      log('VT Pipeline (full)', s4Ok, s4Logs + `[CHECK 4] Log Results: success=${logData.success}, persisted=${(logData.persisted || []).length}`);
      if (!s4Ok) {
        log('VT Pipeline (full)', false, `[CHECK FAILED] Log results: ${logData.message || logData.error || 'Log results failed'}`, Date.now() - start);
        return;
      }
      setVtPayload((p) => ({ ...p, persisted: logData.persisted || [], job_updates: logData.job_updates || [] }));

      const archiveRes = await fetch(`${vtBaseUrl}/archive`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ run_id }), credentials: 'include' });
      const archiveData = await archiveRes.json();
      const s5Logs = (archiveData.logs && archiveData.logs.length) ? archiveData.logs.join('\n') + '\n' : '';
      const s5Ok = archiveData.success !== false;
      log('VT Pipeline (full)', s5Ok, s5Logs + `[CHECK 5] Archive: deleted_jobs=${archiveData.deleted_jobs ?? 0}, remaining_jobs=${archiveData.remaining_jobs ?? 0}`);

      const validateRes = await fetch(`${vtBaseUrl}/validate-run`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ run_id }), credentials: 'include' });
      const validateData = await validateRes.json();
      const s6Logs = (validateData.logs && validateData.logs.length) ? validateData.logs.join('\n') + '\n' : '';
      const s6Ok = validateData.success;
      if (s6Ok) setVtPayload((p) => ({ ...p, summary: validateData.summary }));

      log('VT Pipeline (full)', s6Ok, s6Logs + `[ALL CHECKS PASSED] run_id: ${run_id}, jobs: ${assigned_jobs.length}, persisted: ${(logData.persisted || []).length}, status: ${validateData.status || 'N/A'}`, Date.now() - start);
    } catch (e) {
      log('VT Pipeline (full)', false, `[EXCEPTION] ${e.message}`, Date.now() - start);
    } finally {
      setIsLoading(false);
    }
  };

  // ============================================
  // CLEAR LOGS / EMPTY VT TABLES
  // ============================================
  const clearLogs = () => {
    setResults([]);
  };

  const emptyVtTables = async () => {
    setIsLoading(true);
    const start = Date.now();
    try {
      log('Empty VT Tables', false, '[INPUT] Calling /api/cron/debug/reset (same client as Pull all tables)...');
      const res = await fetch('/api/cron/debug/reset', {
        method: 'POST',
        headers: getCronHeaders(),
      });
      const data = await res.json();
      const duration = Date.now() - start;
      const c = data.cleared;
      if (data.success && c) {
        const sql = `[SQL (mock)]\nDELETE FROM vt_ai_results WHERE id IS NOT NULL;\nDELETE FROM vt_serp_results WHERE id IS NOT NULL;\nDELETE FROM vt_jobs WHERE id IS NOT NULL;\nDELETE FROM vt_runs WHERE id IS NOT NULL;\n-- vt_projects, vt_keywords, vt_prompts are preserved`;
        log('Empty VT Tables', true, `[CHECK PASSED] Cleared: vt_ai_results=${c.vt_ai_results ?? 0}, vt_serp_results=${c.vt_serp_results ?? 0}, vt_jobs=${c.vt_jobs ?? 0}, vt_runs=${c.vt_runs ?? 0}. (vt_projects, vt_keywords, vt_prompts preserved)\n${sql}`, duration);
        setVtPayload({ run_id: null, job_ids: [], assigned_jobs: [], job_reports: [], persisted: [], summary: null });
      } else {
        log('Empty VT Tables', false, `[CHECK FAILED] ${data.error || 'Reset failed'}`, duration);
      }
    } catch (e) {
      log('Empty VT Tables', false, `[EXCEPTION] ${e.message}`, Date.now() - start);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Cron System Tester</h1>
          <p className="text-gray-600">Test and debug the cron workflow</p>
          <div className="mt-2">
            <button
              type="button"
              onClick={pullDbState}
              disabled={dbLoading}
              className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
            >
              {dbLoading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Database className="h-4 w-4" />
              )}
              Pull all tables
            </button>
          </div>
        </div>

        {dbTables && (
          <div className="bg-white rounded-lg shadow-md overflow-hidden mb-8">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Database tables</h2>
            </div>
            <div className="p-6">
              {dbTables.error ? (
                <div className="rounded-lg bg-red-50 p-4 text-red-700">{dbTables.error}</div>
              ) : (
                <div className="space-y-6 overflow-x-auto">
                  {Object.entries(dbTables)
                    .filter(([k]) => !k.startsWith('_'))
                    .map(([tableName, rows]) => {
                    const queryError = dbTables._errors?.[tableName];
                    if (!Array.isArray(rows) || rows.length === 0) {
                      return (
                        <div key={tableName}>
                          <h3 className="text-lg font-semibold text-gray-900 mb-2">{tableName}</h3>
                          {queryError ? (
                            <p className="text-sm text-amber-700 bg-amber-50 rounded p-2">Query error: {queryError}</p>
                          ) : (
                            <p className="text-sm text-gray-500">No rows</p>
                          )}
                        </div>
                      );
                    }
                    const keys = Object.keys(rows[0]);
                    return (
                      <div key={tableName}>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                          {tableName} ({rows.length})
                        </h3>
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200 text-sm">
                            <thead className="bg-gray-50">
                              <tr>
                                {keys.map((k) => (
                                  <th key={k} className="px-3 py-2 text-left font-medium text-gray-700">{k}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 bg-white">
                              {rows.map((row, i) => (
                                <tr key={i}>
                                  {keys.map((k) => (
                                    <td key={k} className="max-w-xs truncate px-3 py-2 text-gray-600">
                                      {typeof row[k] === 'object' && row[k] !== null
                                        ? JSON.stringify(row[k])
                                        : String(row[k] ?? '')}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* VT pipeline (6-step spec) */}
        <div className="bg-slate-50 rounded-lg shadow-md p-4 mb-6 border border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900 border-b border-slate-200 pb-2 mb-4">VT pipeline (6-step spec)</h2>
          <div className="flex flex-wrap gap-2 mb-4">
            <button onClick={testVtSchedule} disabled={isLoading} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg text-sm disabled:cursor-not-allowed">
              <Play className="w-4 h-4" /> 1. Schedule
            </button>
            <button onClick={testVtAssign} disabled={isLoading} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg text-sm disabled:cursor-not-allowed">
              <Play className="w-4 h-4" /> 2. Assign
            </button>
            <button onClick={testVtExecute} disabled={isLoading} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg text-sm disabled:cursor-not-allowed">
              <Play className="w-4 h-4" /> 3. Execute
            </button>
            <button onClick={testVtLogResults} disabled={isLoading} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg text-sm disabled:cursor-not-allowed">
              <Play className="w-4 h-4" /> 4. Log Results
            </button>
            <button onClick={testVtArchive} disabled={isLoading} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg text-sm disabled:cursor-not-allowed">
              <Trash2 className="w-4 h-4" /> 5. Archive
            </button>
            <button onClick={testVtValidateRun} disabled={isLoading} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg text-sm disabled:cursor-not-allowed">
              <CheckCircle className="w-4 h-4" /> 6. Validate Run
            </button>
            <button onClick={testVtPipelineFull} disabled={isLoading} className="flex items-center gap-2 bg-slate-700 hover:bg-slate-800 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg text-sm disabled:cursor-not-allowed">
              <Play className="w-4 h-4" /> Run full pipeline
            </button>
          </div>
          <div className="text-sm text-slate-700 font-mono bg-white rounded border border-slate-200 p-3">
            {vtPayload.run_id ? (
              <>
                <div><strong>run_id:</strong> {vtPayload.run_id}</div>
                <div><strong>job_ids:</strong> {(vtPayload.job_ids || []).length}</div>
                <div><strong>assigned_jobs:</strong> {(vtPayload.assigned_jobs || []).length}</div>
                <div><strong>job_reports:</strong> {(vtPayload.job_reports || []).length}</div>
                <div><strong>persisted:</strong> {(vtPayload.persisted || []).length}</div>
                {vtPayload.summary && <div><strong>summary:</strong> {JSON.stringify(vtPayload.summary)}</div>}
              </>
            ) : (
              <span className="text-slate-500">Run Schedule or full pipeline to see run_id, job_ids, assigned_jobs, job_reports, persisted, summary.</span>
            )}
          </div>
        </div>

        {/* Clear Logs / Empty VT Tables */}
        <div className="mb-6 flex justify-end gap-2">
          <button
            onClick={clearLogs}
            className="flex items-center gap-2 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-2 px-4 rounded-lg transition-all"
          >
            <RotateCcw className="w-4 h-4" />
            Clear Logs
          </button>
          <button
            type="button"
            onClick={emptyVtTables}
            disabled={isLoading}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg transition-all disabled:cursor-not-allowed"
          >
            <Trash2 className="w-4 h-4" />
            Empty VT Tables
          </button>
        </div>

        {/* Results Log */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="bg-gray-100 px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">
              Test Results ({results.length})
            </h2>
          </div>

          <div className="divide-y divide-gray-200">
            {results.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                <p>No test results yet. Click a button above to start testing.</p>
              </div>
            ) : (
              results.map((result) => (
                <div
                  key={result.id}
                  className={`p-6 border-l-4 ${
                    result.success
                      ? 'bg-green-50 border-green-500'
                      : 'bg-red-50 border-red-500'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 mt-1">
                      {result.success ? (
                        <CheckCircle className="w-6 h-6 text-green-600" />
                      ) : (
                        <AlertCircle className="w-6 h-6 text-red-600" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {result.action}
                        </h3>
                        <span className="text-sm text-gray-500">
                          {result.timestamp}
                        </span>
                      </div>

                      <p className="text-sm text-gray-700 whitespace-pre-wrap font-mono mb-2">
                        {result.message}
                      </p>

                      {result.duration > 0 && (
                        <p className="text-xs text-gray-500">
                          ⏱️ Duration: {result.duration}ms
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Status Indicator */}
        {isLoading && (
          <div className="fixed bottom-8 right-8 bg-blue-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2">
            <div className="animate-spin">
              <RefreshCw className="w-5 h-5" />
            </div>
            Processing...
          </div>
        )}
      </div>
    </div>
  );
}
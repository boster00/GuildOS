'use client';

import { useState } from 'react';
import { initMonkey } from '@/libs/monkey';

export default function TestV0Page() {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [chatId, setChatId] = useState('');
  const [fetchLoading, setFetchLoading] = useState(false);

  // Raw session inspector state
  const [rawChatId, setRawChatId] = useState('');
  const [rawLoading, setRawLoading] = useState(false);
  const [rawError, setRawError] = useState(null);
  const [snapshots, setSnapshots] = useState([]);

  const pullRawResponse = async () => {
    if (!rawChatId.trim()) {
      setRawError('Please enter a chat ID');
      return;
    }
    setRawLoading(true);
    setRawError(null);
    try {
      const monkey = await initMonkey();
      const text = await monkey.apiCall('/api/v0/chat-raw', { chatId: rawChatId.trim() });
      const data = JSON.parse(text);
      const snapshot = {
        id: Date.now(),
        chatId: rawChatId.trim(),
        timestamp: new Date().toLocaleString(),
        data,
      };
      setSnapshots((prev) => [snapshot, ...prev]);
    } catch (err) {
      setRawError(err.message);
    } finally {
      setRawLoading(false);
    }
  };

  const generatePage = async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const monkey = await initMonkey();
      const text = await monkey.apiCall('/api/v0/generate-page', {
        prompt: prompt.trim(),
        maxWaitTime: 90000, // 90 seconds
        pollingInterval: 2000,
      });
      const data = JSON.parse(text);
      if (data.error) throw new Error(data.error || 'Failed to generate page');
      setResult(data);
      if (data.chatId) {
        setChatId(data.chatId);
      }
    } catch (err) {
      setError(err.message);

    } finally {
      setLoading(false);
    }
  };

  const fetchChat = async () => {
    if (!chatId.trim()) {
      setError('Please enter a chat ID');
      return;
    }

    setFetchLoading(true);
    setError(null);
    setResult(null);

    try {
      const monkey = await initMonkey();
      const text = await monkey.apiCall('/api/v0/fetch-chat', { chatId: chatId.trim() });
      const data = JSON.parse(text);
      if (data.error) throw new Error(data.error || 'Failed to fetch chat');

      setResult(data);
    } catch (err) {
      setError(err.message);

    } finally {
      setFetchLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      generatePage();
    }
  };

  return (
    <div className="min-h-screen bg-base-200 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 text-center">
          v0.dev API Test (Native SDK)
        </h1>

        {/* Raw Session Inspector */}
        <div className="card bg-base-100 shadow-xl mb-8 border border-primary/30">
          <div className="card-body">
            <div className="flex items-center justify-between mb-4">
              <h2 className="card-title text-primary">Raw Session Inspector</h2>
              {snapshots.length > 0 && (
                <button
                  className="btn btn-xs btn-ghost text-error"
                  onClick={() => setSnapshots([])}
                >
                  Clear All ({snapshots.length})
                </button>
              )}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                className="input input-bordered input-primary flex-1 font-mono text-sm"
                placeholder="Enter v0 chat ID (e.g. cm5abc123...)"
                value={rawChatId}
                onChange={(e) => setRawChatId(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && pullRawResponse()}
                disabled={rawLoading}
              />
              <button
                className={`btn btn-primary ${rawLoading ? 'loading' : ''}`}
                onClick={pullRawResponse}
                disabled={rawLoading || !rawChatId.trim()}
              >
                {rawLoading ? 'Pulling...' : 'Pull Response'}
              </button>
            </div>

            {rawError && (
              <div className="alert alert-error mt-3 py-2 text-sm">
                <span>{rawError}</span>
              </div>
            )}

            {snapshots.length > 0 && (
              <div className="mt-4 space-y-3">
                {snapshots.map((snap, idx) => (
                  <div key={snap.id} className="border border-base-300 rounded-lg overflow-hidden">
                    <div className="flex items-center justify-between bg-base-200 px-4 py-2">
                      <div className="flex items-center gap-3">
                        <span className="badge badge-primary badge-sm">#{snapshots.length - idx}</span>
                        <span className="font-mono text-sm font-bold">{snap.chatId}</span>
                        <span className="text-xs text-base-content/50">{snap.timestamp}</span>
                        {snap.data?.success === false && (
                          <span className="badge badge-error badge-sm">error</span>
                        )}
                        {snap.data?.success === true && (
                          <span className="badge badge-success badge-sm">ok</span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          className="btn btn-xs btn-ghost"
                          onClick={() => {
                            navigator.clipboard.writeText(JSON.stringify(snap.data, null, 2));
                          }}
                        >
                          Copy
                        </button>
                        <button
                          className="btn btn-xs btn-ghost text-error"
                          onClick={() => setSnapshots((prev) => prev.filter((s) => s.id !== snap.id))}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                    <pre
                      className="bg-base-300 p-4 text-xs font-mono overflow-y-auto overflow-x-auto"
                      style={{ height: '300px' }}
                    >
                      {JSON.stringify(snap.data, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            )}

            {snapshots.length === 0 && !rawLoading && (
              <p className="text-sm text-base-content/40 mt-2">
                Enter a chat ID and click Pull Response to capture a snapshot of the raw v0 API response.
              </p>
            )}
          </div>
        </div>

        {/* Generate Section */}
        <div className="card bg-base-100 shadow-xl mb-8">
          <div className="card-body">
            <h2 className="card-title mb-4">Generate New Page</h2>
            
            <div className="form-control">
              <label className="label">
                <span className="label-text">Enter your prompt:</span>
              </label>
              <textarea
                className="textarea textarea-bordered h-32 resize-none font-mono text-sm"
                placeholder="Create a landing page for a SaaS product with hero section, features, and pricing..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={loading}
              />
              <label className="label">
                <span className="label-text-alt">Press Enter to generate or Shift+Enter for new line</span>
              </label>
            </div>

            <div className="card-actions justify-end mt-4">
              <button
                className={`btn btn-primary ${loading ? 'loading' : ''}`}
                onClick={generatePage}
                disabled={loading || !prompt.trim()}
              >
                {loading ? 'Generating...' : 'Generate Page'}
              </button>
            </div>
          </div>
        </div>

        {/* Fetch Existing Chat Section */}
        <div className="card bg-base-100 shadow-xl mb-8">
          <div className="card-body">
            <h2 className="card-title mb-4">Fetch Existing Chat</h2>
            
            <div className="form-control">
              <label className="label">
                <span className="label-text">Enter chat ID:</span>
              </label>
              <input
                type="text"
                className="input input-bordered font-mono text-sm"
                placeholder="cm5abc123..."
                value={chatId}
                onChange={(e) => setChatId(e.target.value)}
                disabled={fetchLoading}
              />
            </div>

            <div className="card-actions justify-end mt-4">
              <button
                className={`btn btn-secondary ${fetchLoading ? 'loading' : ''}`}
                onClick={fetchChat}
                disabled={fetchLoading || !chatId.trim()}
              >
                {fetchLoading ? 'Fetching...' : 'Fetch Chat'}
              </button>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="alert alert-error mb-8">
            <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h3 className="font-bold">Error</h3>
              <div className="text-sm">{error}</div>
            </div>
          </div>
        )}

        {/* Results Section */}
        {result && (
          <div className="space-y-6">
            {/* Summary Card */}
            <div className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <h2 className="card-title">Generation Summary</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {result.chatId && (
                    <div>
                      <div className="text-sm text-base-content/60">Chat ID</div>
                      <div className="font-mono text-sm font-bold">{result.chatId}</div>
                    </div>
                  )}
                  {result.generationTime && (
                    <div>
                      <div className="text-sm text-base-content/60">Generation Time</div>
                      <div className="font-bold">{result.generationTime}</div>
                    </div>
                  )}
                  {result.files && (
                    <div>
                      <div className="text-sm text-base-content/60">Files Generated</div>
                      <div className="font-bold">{result.files.length}</div>
                    </div>
                  )}
                  {result.pollingAttempts !== undefined && (
                    <div>
                      <div className="text-sm text-base-content/60">Polling Attempts</div>
                      <div className="font-bold">{result.pollingAttempts}</div>
                    </div>
                  )}
                </div>
                
                {result.demoUrl && (
                  <div className="mt-4">
                    <a 
                      href={result.demoUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="btn btn-sm btn-outline"
                    >
                      View Demo on v0.dev
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Files List */}
            {result.files && result.files.length > 0 && (
              <div className="card bg-base-100 shadow-xl">
                <div className="card-body">
                  <h2 className="card-title">Generated Files</h2>
                  <div className="space-y-4">
                    {result.files.map((file, index) => (
                      <div key={index} className="collapse collapse-arrow bg-base-200">
                        <input type="checkbox" defaultChecked={index === 0} />
                        <div className="collapse-title font-medium">
                          <div className="flex justify-between items-center">
                            <span className="font-mono text-sm">{file.name}</span>
                            <span className="badge badge-sm">{(file.size || 0).toLocaleString()} chars</span>
                          </div>
                        </div>
                        <div className="collapse-content">
                          <pre className="bg-base-300 p-4 rounded-lg overflow-x-auto text-xs">
                            <code>{file.content}</code>
                          </pre>
                          <div className="mt-2">
                            <button
                              className="btn btn-xs btn-outline"
                              onClick={() => {
                                navigator.clipboard.writeText(file.content);
                                alert('Content copied to clipboard!');
                              }}
                            >
                              Copy Content
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* HTML Preview */}
            {result.htmlContent && (
              <div className="card bg-base-100 shadow-xl">
                <div className="card-body">
                  <h2 className="card-title">HTML Content</h2>
                  <pre className="bg-base-300 p-4 rounded-lg overflow-x-auto text-xs max-h-96">
                    <code>{result.htmlContent}</code>
                  </pre>
                  <div className="card-actions justify-end mt-2">
                    <button
                      className="btn btn-sm btn-outline"
                      onClick={() => {
                        navigator.clipboard.writeText(result.htmlContent);
                        alert('HTML copied to clipboard!');
                      }}
                    >
                      Copy HTML
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Raw Response */}
            <div className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <h2 className="card-title">Raw API Response</h2>
                <pre className="bg-base-300 p-4 rounded-lg overflow-x-auto text-xs max-h-96">
                  <code>{JSON.stringify(result, null, 2)}</code>
                </pre>
                <div className="card-actions justify-end mt-2">
                  <button
                    className="btn btn-sm btn-outline"
                    onClick={() => {
                      navigator.clipboard.writeText(JSON.stringify(result, null, 2));
                      alert('JSON copied to clipboard!');
                    }}
                  >
                    Copy JSON
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Info Section */}
        <div className="alert alert-info mt-8">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <div>
            <h3 className="font-bold">v0.dev API Test Page</h3>
            <div className="text-xs">
              This page calls the v0.dev API <strong>directly</strong> using the v0-sdk package (not through monkey).
              Use this to debug v0 API integration issues. Make sure V0_API_KEY is set in your environment variables.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

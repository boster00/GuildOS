'use client';

import { useState } from 'react';
import { initMonkey } from '@/libs/monkey';
import CreditCostBadge from '@/components/CreditCostBadge';

const DEFAULT_ARTICLE_ID = 'e3eac24f-f1d1-4ee0-b03e-0e8d2e93d1d5';

export default function TestV0FilesPage() {
  const [articleId, setArticleId] = useState(DEFAULT_ARTICLE_ID);
  const [demoData, setDemoData] = useState(null);
  const [demoLoading, setDemoLoading] = useState(false);
  const [generateLoading, setGenerateLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const loadDemoData = async () => {
    if (!articleId.trim()) {
      setError('Please enter an article ID');
      return;
    }
    setDemoLoading(true);
    setError(null);
    setDemoData(null);
    try {
      const monkey = await initMonkey();
      const text = await monkey.apiGet(`/api/test-v0-files/demo-data?articleId=${encodeURIComponent(articleId.trim())}`);
      const data = JSON.parse(text);
      if (data.error) throw new Error(data.error || 'Failed to load demo data');
      setDemoData(data);
    } catch (err) {
      setError(err.message);

    } finally {
      setDemoLoading(false);
    }
  };

  const generateWithFiles = async () => {
    if (!articleId.trim()) {
      setError('Please enter an article ID');
      return;
    }
    setGenerateLoading(true);
    setError(null);
    setResult(null);
    try {
      const monkey = await initMonkey();
      const text = await monkey.apiCall('/api/v0/generate-with-files', { articleId: articleId.trim() });
      const data = JSON.parse(text);
      if (data.error) throw new Error(data.error || 'Generation failed');
      setResult(data);
    } catch (err) {
      setError(err.message);

    } finally {
      setGenerateLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-base-200 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold mb-2 text-center">
          v0 with Files Test
        </h1>
        <p className="text-center text-base-content/70 mb-8">
          Simplified prompt + files (custom CSS, templates, competitor pages) instead of one big prompt.
        </p>

        {/* Article ID + actions */}
        <div className="card bg-base-100 shadow-xl mb-8">
          <div className="card-body">
            <h2 className="card-title mb-4">Demo article</h2>
            <div className="form-control">
              <label className="label">
                <span className="label-text">Article ID (must be yours)</span>
              </label>
              <input
                type="text"
                className="input input-bordered font-mono text-sm"
                placeholder={DEFAULT_ARTICLE_ID}
                value={articleId}
                onChange={(e) => setArticleId(e.target.value)}
                disabled={demoLoading || generateLoading}
              />
            </div>
            <div className="card-actions justify-end mt-4 gap-2">
              <button
                className={`btn btn-outline ${demoLoading ? 'loading' : ''}`}
                onClick={loadDemoData}
                disabled={demoLoading || generateLoading || !articleId.trim()}
              >
                {demoLoading ? 'Loading...' : 'Load demo data'}
              </button>
              <button
                className={`btn btn-primary ${generateLoading ? 'loading' : ''} inline-flex items-center gap-2`}
                onClick={generateWithFiles}
                disabled={generateLoading || !articleId.trim()}
              >
                {generateLoading ? 'Generating...' : 'Generate with files'}
                <CreditCostBadge path="/api/v0/generate-with-files" size="sm" />
              </button>
            </div>
          </div>
        </div>

        {/* Error */}
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

        {/* Demo data summary */}
        {demoData && (
          <div className="card bg-base-100 shadow-xl mb-8">
            <div className="card-body">
              <h2 className="card-title">Demo data summary</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <div className="text-sm text-base-content/60">Article ID</div>
                  <div className="font-mono text-sm font-bold">{demoData.articleId}</div>
                </div>
                <div>
                  <div className="text-sm text-base-content/60">Files</div>
                  <div className="font-bold">{demoData.summary?.fileCount ?? demoData.files?.length ?? 0}</div>
                </div>
                <div>
                  <div className="text-sm text-base-content/60">Prompt length</div>
                  <div className="font-bold">{demoData.summary?.promptLength ?? demoData.prompt?.length ?? 0} chars</div>
                </div>
              </div>
              {demoData.summary?.fileNames?.length > 0 && (
                <div>
                  <div className="text-sm text-base-content/60 mb-1">File names</div>
                  <div className="flex flex-wrap gap-2">
                    {demoData.summary.fileNames.map((name, i) => (
                      <span key={i} className="badge badge-ghost font-mono text-xs">{name}</span>
                    ))}
                  </div>
                </div>
              )}
              {demoData.prompt && (
                <div className="mt-4">
                  <div className="text-sm text-base-content/60 mb-1">Prompt (first 400 chars)</div>
                  <pre className="bg-base-200 p-3 rounded text-xs overflow-x-auto max-h-32">
                    {demoData.prompt.substring(0, 400)}
                    {demoData.prompt.length > 400 ? '...' : ''}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Generation result */}
        {result && (
          <div className="space-y-6">
            <div className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <h2 className="card-title">Generation summary</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {result.chatId && (
                    <div>
                      <div className="text-sm text-base-content/60">Chat ID</div>
                      <div className="font-mono text-sm font-bold">{result.chatId}</div>
                    </div>
                  )}
                  {result.generationTime && (
                    <div>
                      <div className="text-sm text-base-content/60">Generation time</div>
                      <div className="font-bold">{result.generationTime}</div>
                    </div>
                  )}
                  {result.files && (
                    <div>
                      <div className="text-sm text-base-content/60">Files generated</div>
                      <div className="font-bold">{result.files.length}</div>
                    </div>
                  )}
                  {result.pollingAttempts !== undefined && (
                    <div>
                      <div className="text-sm text-base-content/60">Polling attempts</div>
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
                      View demo on v0.dev
                    </a>
                  </div>
                )}
              </div>
            </div>

            {result.files && result.files.length > 0 && (
              <div className="card bg-base-100 shadow-xl">
                <div className="card-body">
                  <h2 className="card-title">Generated files</h2>
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
                              Copy content
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {result.htmlContent && (
              <div className="card bg-base-100 shadow-xl">
                <div className="card-body">
                  <h2 className="card-title">HTML content</h2>
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
          </div>
        )}

        <div className="alert alert-info mt-8">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <h3 className="font-bold">v0 with files</h3>
            <div className="text-xs">
              Uses <strong>chats.init</strong> (files) + <strong>sendMessage</strong> (short prompt) + poll. Custom CSS, templates, and competitor page contents are passed as files instead of one large prompt. Requires V0_API_KEY and an article you own (e.g. {DEFAULT_ARTICLE_ID}).
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

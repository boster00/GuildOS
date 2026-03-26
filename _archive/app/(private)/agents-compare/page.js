// ARCHIVED: Original path was app/(private)/agents-compare/page.js

"use client";
// TODO: remove — agents-compare page is obsolete

import { useState } from "react";
import { Play, Loader, Sparkles, Zap, Wrench, Brain, History } from "lucide-react";
import QuestionnaireForm from "@/libs/monkey/ui/QuestionnaireForm";
import { initMonkey } from "@/libs/monkey";

const DEFAULT_PROMPT = "Create a landing page for IHC/IF service targeting biotech preclinical R&D teams. The service offers fast turnaround (5-10 days) and has 3000+ validated antibodies.";

export default function AgentsComparePage() {
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [responseMode, setResponseMode] = useState({
    loading: false,
    output: null,
    error: null,
    startTime: null,
    endTime: null,
  });
  const [agentMode, setAgentMode] = useState({
    loading: false,
    output: null,
    error: null,
    startTime: null,
    endTime: null,
    toolCalls: [],
    steps: [],
    reasoning: [],
    sessionId: null,
  });
  const [showQuestionnaire, setShowQuestionnaire] = useState(false);
  const [questionnaireData, setQuestionnaireData] = useState(null);
  const [questionnaireMode, setQuestionnaireMode] = useState(null); // "response" or "agent"
  const [step1Output, setStep1Output] = useState(null); // Store Step 1 output for article writing
  const [articleWriting, setArticleWriting] = useState({
    loading: false,
    result: null,
    error: null,
    mode: null, // "response" or "agent"
  });

  const handleResponseMode = async () => {
    // Create mock Step 1 output from prompt
    const mockStep1Output = {
      icp: {
        name: "Biotech R&D Teams",
        description: prompt.includes("biotech") ? "Biotech preclinical R&D teams" : "Target audience",
      },
      offer: {
        name: prompt.match(/landing page for (.+?)(?: targeting|$)/i)?.[1] || "Service",
        description: prompt,
      },
      offerTypeAnalysis: {
        offerType: "transactional",
      },
      talkPoints: {
        uniqueSellingPoints: [],
        transactionalFacts: [],
      },
      hookPoints: {},
    };
    setStep1Output(mockStep1Output);

    setResponseMode({
      loading: true,
      output: null,
      error: null,
      startTime: Date.now(),
      endTime: null,
    });

    try {
      const monkey = await initMonkey();
      const text = await monkey.apiCall("/api/agents-compare/response-mode", { prompt });
      const result = JSON.parse(text);
      const endTime = Date.now();

      if (result.ok) {
        // Check if questions were returned
        if (result.output?.questions && result.output.questions.length > 0) {
          setQuestionnaireData({
            questions: result.output.questions,
            digestedInfo: result.output.digestedInfo || {},
            contextSummary: result.output.contextSummary || "",
          });
          setQuestionnaireMode("response");
          setShowQuestionnaire(true);
        }
        
        setResponseMode(prev => ({
          ...prev,
          loading: false,
          output: result.output,
          endTime,
        }));
      } else {
        setResponseMode(prev => ({
          ...prev,
          loading: false,
          error: result.error || "Unknown error",
          endTime,
        }));
      }
    } catch (error) {
      setResponseMode(prev => ({
        ...prev,
        loading: false,
        error: error.message,
        endTime: Date.now(),
      }));
    }
  };

  const handleAgentMode = async () => {
    // Create mock Step 1 output from prompt
    const mockStep1Output = {
      icp: {
        name: "Biotech R&D Teams",
        description: prompt.includes("biotech") ? "Biotech preclinical R&D teams" : "Target audience",
      },
      offer: {
        name: prompt.match(/landing page for (.+?)(?: targeting|$)/i)?.[1] || "Service",
        description: prompt,
      },
      offerTypeAnalysis: {
        offerType: "transactional",
      },
      talkPoints: {
        uniqueSellingPoints: [],
        transactionalFacts: [],
      },
      hookPoints: {},
    };
    setStep1Output(mockStep1Output);

    setAgentMode({
      loading: true,
      output: null,
      error: null,
      startTime: Date.now(),
      endTime: null,
      toolCalls: [],
      steps: [],
      reasoning: [],
      sessionId: null,
    });

    try {
      const monkey = await initMonkey();
      const text = await monkey.apiCall("/api/agents-compare/agent-mode", { prompt, stream: false });
      const result = JSON.parse(text);
      const endTime = Date.now();

      if (result.ok) {
        // Check if questions were returned
        if (result.output?.questions && result.output.questions.length > 0) {
          setQuestionnaireData({
            questions: result.output.questions,
            digestedInfo: result.output.digestedInfo || {},
            contextSummary: result.output.contextSummary || "",
          });
          setQuestionnaireMode("agent");
          setShowQuestionnaire(true);
        }
        
        setAgentMode(prev => ({
          ...prev,
          loading: false,
          output: result.output,
          toolCalls: result.toolCalls || [],
          steps: result.steps || [],
          reasoning: result.reasoning || [],
          sessionId: result.sessionId,
          endTime,
        }));
      } else {
        setAgentMode(prev => ({
          ...prev,
          loading: false,
          error: result.error || "Unknown error",
          endTime,
        }));
      }
    } catch (error) {
      setAgentMode(prev => ({
        ...prev,
        loading: false,
        error: error.message,
        endTime: Date.now(),
      }));
    }
  };

  const handleBoth = async () => {
    await Promise.all([handleResponseMode(), handleAgentMode()]);
  };

  const handleWriteArticle = async (clarificationAnswers, mode) => {
    if (!step1Output) {
      console.error("Step 1 output not available");
      return;
    }

    setArticleWriting({
      loading: true,
      result: null,
      error: null,
      mode,
    });

    try {
      const monkey = await initMonkey();
      const text = await monkey.apiCall("/api/monkey/landing-page/write-article", {
        model: "agent",
        step1Output,
        clarificationAnswers,
        pageType: "BASE_UNIVERSAL",
        useAgentMode: mode === "agent",
      });
      const result = JSON.parse(text);

      if (result.error) {
        throw new Error(result.error || "Failed to write article");
      }

      if (result.success) {
        setArticleWriting({
          loading: false,
          result: result.article,
          error: null,
          mode,
        });
      } else {
        throw new Error(result.error || "Failed to write article");
      }
    } catch (error) {
      setArticleWriting({
        loading: false,
        result: null,
        error: error.message,
        mode,
      });
    }
  };

  const getDuration = (start, end) => {
    if (!start || !end) return null;
    return ((end - start) / 1000).toFixed(2);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h1 className="card-title text-3xl mb-4">
            <Sparkles className="w-8 h-8" />
            Agents SDK vs Response Mode Comparison
          </h1>
          <p className="text-base-content/70 mb-4">
            Compare traditional response mode with agentic mode. See how agents use tools, reasoning, and session persistence.
          </p>

          {/* Prompt Input */}
          <div className="form-control">
            <label className="label">
              <span className="label-text font-semibold">Prompt</span>
            </label>
            <textarea
              className="textarea textarea-bordered h-32 font-mono text-sm"
              placeholder="Enter your prompt..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
            <label className="label">
              <span className="label-text-alt">
                Template: "Create a landing page for [SERVICE] targeting [AUDIENCE]..."
              </span>
            </label>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 mt-4">
            <button
              className="btn btn-outline flex-1"
              onClick={handleResponseMode}
              disabled={responseMode.loading || !prompt.trim()}
            >
              {responseMode.loading ? (
                <>
                  <Loader className="w-4 h-4 mr-2 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 mr-2" />
                  Response Mode Only
                </>
              )}
            </button>
            <button
              className="btn btn-primary flex-1"
              onClick={handleAgentMode}
              disabled={agentMode.loading || !prompt.trim()}
            >
              {agentMode.loading ? (
                <>
                  <Loader className="w-4 h-4 mr-2 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Brain className="w-4 h-4 mr-2" />
                  Agent Mode Only
                </>
              )}
            </button>
            <button
              className="btn btn-secondary flex-1"
              onClick={handleBoth}
              disabled={(responseMode.loading || agentMode.loading) || !prompt.trim()}
            >
              {responseMode.loading || agentMode.loading ? (
                <>
                  <Loader className="w-4 h-4 mr-2 animate-spin" />
                  Running Both...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Run Both
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Questionnaire Modal */}
      {showQuestionnaire && questionnaireData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">
                Clarification Questions ({questionnaireMode === "agent" ? "Agent Mode" : "Response Mode"})
              </h2>
              <button
                onClick={() => {
                  setShowQuestionnaire(false);
                  setQuestionnaireData(null);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <div className="p-6">
              <QuestionnaireForm
                questions={questionnaireData.questions}
                digestedInfo={questionnaireData.digestedInfo}
                onSubmit={async (answers) => {
                  setShowQuestionnaire(false);
                  await handleWriteArticle(answers, questionnaireMode);
                }}
                onCancel={() => {
                  setShowQuestionnaire(false);
                  setQuestionnaireData(null);
                }}
                isLoading={articleWriting.loading}
              />
            </div>
          </div>
        </div>
      )}

      {/* Article Writing Result */}
      {articleWriting.result && (
        <div className="card bg-base-100 shadow-xl border-2 border-success mb-6">
          <div className="card-body">
            <div className="flex items-center justify-between mb-4">
              <h2 className="card-title text-success">
                <Sparkles className="w-5 h-5" />
                Article Complete ({articleWriting.mode === "agent" ? "Agent Mode" : "Response Mode"})
              </h2>
              <button
                onClick={() => {
                  setArticleWriting({ loading: false, result: null, error: null, mode: null });
                }}
                className="btn btn-sm btn-ghost"
              >
                Close
              </button>
            </div>

            <div className="space-y-4">
              {/* Download Button */}
              <div className="flex justify-end">
                <button
                  onClick={() => {
                    const blob = new Blob([articleWriting.result.html], { type: "text/html" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `landing-page-${Date.now()}.html`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="btn btn-primary btn-sm"
                >
                  Download HTML
                </button>
              </div>

              {/* HTML Preview */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div
                  className="w-full h-[600px] border-0 overflow-auto"
                  dangerouslySetInnerHTML={{ __html: articleWriting.result.html }}
                  title="Article Preview"
                />
              </div>

              {/* Article Review */}
              {articleWriting.result.review && (
                <div className="space-y-4 mt-6">
                  <h3 className="text-lg font-semibold">Article Quality Review</h3>
                  
                  {/* Overall Quality */}
                  <div className={`alert ${
                    articleWriting.result.review.overallQuality === 'excellent' ? 'alert-success' :
                    articleWriting.result.review.overallQuality === 'good' ? 'alert-info' :
                    articleWriting.result.review.overallQuality === 'needs_improvement' ? 'alert-warning' :
                    'alert-error'
                  }`}>
                    <span className="font-semibold">Overall Quality: {articleWriting.result.review.overallQuality.toUpperCase()}</span>
                  </div>

                  {/* Issues */}
                  {articleWriting.result.review.issues && articleWriting.result.review.issues.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-semibold">Issues Found ({articleWriting.result.review.issues.length})</h4>
                      {articleWriting.result.review.issues.map((issue, idx) => (
                        <div key={idx} className={`border-l-4 p-3 rounded ${
                          issue.severity === 'critical' ? 'border-error bg-error/10' :
                          issue.severity === 'major' ? 'border-warning bg-warning/10' :
                          'border-info bg-info/10'
                        }`}>
                          <div className="flex items-start gap-2">
                            <span className={`badge badge-sm ${
                              issue.severity === 'critical' ? 'badge-error' :
                              issue.severity === 'major' ? 'badge-warning' :
                              'badge-info'
                            }`}>
                              {issue.severity}
                            </span>
                            <span className="badge badge-sm badge-outline">{issue.category}</span>
                          </div>
                          <p className="mt-2 text-sm font-medium">{issue.description}</p>
                          <p className="text-xs text-base-content/60 mt-1">
                            Affected: {issue.affectedSections.join(", ")}
                          </p>
                          <p className="text-xs mt-2 italic">💡 {issue.suggestion}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Strengths */}
                  {articleWriting.result.review.strengths && articleWriting.result.review.strengths.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-2">Strengths</h4>
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        {articleWriting.result.review.strengths.map((strength, idx) => (
                          <li key={idx} className="text-success">{strength}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Recommendations */}
                  {articleWriting.result.review.recommendations && articleWriting.result.review.recommendations.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-2">Recommendations</h4>
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        {articleWriting.result.review.recommendations.map((rec, idx) => (
                          <li key={idx}>{rec}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Metadata */}
              {articleWriting.result.metadata && (
                <details className="collapse collapse-arrow bg-base-200 mt-4">
                  <summary className="collapse-title font-medium">Article Metadata</summary>
                  <div className="collapse-content">
                    <pre className="text-xs bg-base-100 p-4 rounded overflow-auto">
                      {JSON.stringify(articleWriting.result.metadata, null, 2)}
                    </pre>
                  </div>
                </details>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Article Writing Error */}
      {articleWriting.error && (
        <div className="alert alert-error mb-6">
          <span>Error writing article: {articleWriting.error}</span>
          <button
            className="btn btn-sm btn-ghost"
            onClick={() => {
              setArticleWriting({ loading: false, result: null, error: null, mode: null });
            }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Article Writing Loading */}
      {articleWriting.loading && (
        <div className="card bg-base-100 shadow-xl border-2 border-primary mb-6">
          <div className="card-body text-center">
            <Loader className="w-8 h-8 animate-spin text-primary mx-auto mb-2" />
            <p className="text-lg font-semibold">Writing Article...</p>
            <p className="text-sm text-base-content/60">
              {articleWriting.mode === "agent"
                ? "Agent is orchestrating section writing and HTML rendering..."
                : "Generating sections and rendering HTML..."}
            </p>
          </div>
        </div>
      )}

      {/* Comparison Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Response Mode Panel */}
        <div className="card bg-base-100 shadow-xl border-2 border-base-300">
          <div className="card-body">
            <div className="flex items-center justify-between mb-4">
              <h2 className="card-title">
                <Zap className="w-5 h-5" />
                Response Mode
              </h2>
              {responseMode.endTime && responseMode.startTime && (
                <span className="badge badge-outline">
                  {getDuration(responseMode.startTime, responseMode.endTime)}s
                </span>
              )}
            </div>
            <p className="text-sm text-base-content/60 mb-4">
              Traditional single API call. Direct response, no tool usage or reasoning steps.
            </p>

            {responseMode.loading && (
              <div className="flex items-center justify-center py-8">
                <Loader className="w-8 h-8 animate-spin text-primary" />
              </div>
            )}

            {responseMode.error && (
              <div className="alert alert-error">
                <span>{responseMode.error}</span>
              </div>
            )}

            {responseMode.output && (
              <div className="space-y-4">
                <div className="bg-base-200 rounded-lg p-4">
                  <h3 className="font-semibold mb-2">Output</h3>
                  <pre className="text-xs whitespace-pre-wrap font-mono">
                    {typeof responseMode.output === "string" 
                      ? responseMode.output 
                      : JSON.stringify(responseMode.output, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            {!responseMode.loading && !responseMode.output && !responseMode.error && (
              <div className="text-center py-8 text-base-content/40">
                Click "Response Mode Only" to run
              </div>
            )}
          </div>
        </div>

        {/* Agent Mode Panel */}
        <div className="card bg-base-100 shadow-xl border-2 border-primary">
          <div className="card-body">
            <div className="flex items-center justify-between mb-4">
              <h2 className="card-title text-primary">
                <Brain className="w-5 h-5" />
                Agent Mode
              </h2>
              {agentMode.endTime && agentMode.startTime && (
                <span className="badge badge-primary">
                  {getDuration(agentMode.startTime, agentMode.endTime)}s
                </span>
              )}
            </div>
            <p className="text-sm text-base-content/60 mb-4">
              Agentic approach with tools, reasoning, and session persistence. See the agent think and act.
            </p>

            {/* Agent Features Indicators */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              {agentMode.toolCalls.length > 0 && (
                <div className="stat bg-base-200 rounded-lg p-3">
                  <div className="stat-figure text-primary">
                    <Wrench className="w-5 h-5" />
                  </div>
                  <div className="stat-title text-xs">Tool Calls</div>
                  <div className="stat-value text-lg">{agentMode.toolCalls.length}</div>
                </div>
              )}
              
              {agentMode.reasoning.length > 0 && (
                <div className="stat bg-base-200 rounded-lg p-3">
                  <div className="stat-figure text-success">
                    <Brain className="w-5 h-5" />
                  </div>
                  <div className="stat-title text-xs">Reasoning Steps</div>
                  <div className="stat-value text-lg">{agentMode.reasoning.length}</div>
                </div>
              )}

              {agentMode.sessionId && (
                <div className="stat bg-base-200 rounded-lg p-3">
                  <div className="stat-figure text-info">
                    <History className="w-5 h-5" />
                  </div>
                  <div className="stat-title text-xs">Session</div>
                  <div className="stat-value text-xs font-mono">
                    {agentMode.sessionId.substring(0, 8)}...
                  </div>
                </div>
              )}
            </div>

            {/* Agent Advantages Banner */}
            {agentMode.output && (
              <div className="alert alert-success mb-4">
                <Sparkles className="w-4 h-4" />
                <div className="text-xs">
                  <div className="font-semibold">Agent Advantages:</div>
                  <ul className="list-disc list-inside mt-1">
                    <li>Uses tools to extract structured data</li>
                    <li>Shows reasoning process step-by-step</li>
                    <li>Session persists for context across runs</li>
                    <li>Can handle multi-step workflows</li>
                  </ul>
                </div>
              </div>
            )}

            {agentMode.loading && (
              <div className="flex items-center justify-center py-8">
                <Loader className="w-8 h-8 animate-spin text-primary" />
                <span className="ml-2">Agent thinking...</span>
              </div>
            )}

            {agentMode.error && (
              <div className="alert alert-error">
                <span>{agentMode.error}</span>
              </div>
            )}

            {agentMode.output && (
              <div className="space-y-4">
                {/* Tool Calls */}
                {agentMode.toolCalls.length > 0 && (
                  <div className="bg-base-200 rounded-lg p-4 border-l-4 border-primary">
                    <h3 className="font-semibold mb-2 flex items-center">
                      <Wrench className="w-4 h-4 mr-2 text-primary" />
                      Tool Calls
                      <span className="badge badge-primary badge-sm ml-2">
                        {agentMode.toolCalls.length}
                      </span>
                    </h3>
                    <p className="text-xs text-base-content/60 mb-3">
                      Agent used tools to gather information and structure the response
                    </p>
                    <div className="space-y-2">
                      {agentMode.toolCalls.map((call, idx) => (
                        <div key={idx} className="bg-base-300 rounded p-3 text-xs border border-primary/20">
                          <div className="flex items-center justify-between mb-1">
                            <div className="font-mono font-semibold text-primary">{call.name}</div>
                            {call.duration && (
                              <span className="badge badge-ghost badge-xs">
                                {call.duration}ms
                              </span>
                            )}
                          </div>
                          {call.result && (
                            <div className="mt-2 text-base-content/70 bg-base-100 rounded p-2">
                              <div className="font-semibold mb-1">Result:</div>
                              <div className="font-mono text-xs">
                                {typeof call.result === "string" 
                                  ? call.result.substring(0, 150) + (call.result.length > 150 ? "..." : "")
                                  : JSON.stringify(call.result, null, 2).substring(0, 150) + "..."}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Reasoning Steps */}
                {agentMode.reasoning.length > 0 && (
                  <div className="bg-base-200 rounded-lg p-4 border-l-4 border-success">
                    <h3 className="font-semibold mb-2 flex items-center">
                      <Brain className="w-4 h-4 mr-2 text-success" />
                      Reasoning Steps
                      <span className="badge badge-success badge-sm ml-2">
                        {agentMode.reasoning.length}
                      </span>
                    </h3>
                    <p className="text-xs text-base-content/60 mb-3">
                      Agent's step-by-step thinking process
                    </p>
                    <div className="space-y-2">
                      {agentMode.reasoning.map((step, idx) => (
                        <div key={idx} className="bg-base-300 rounded p-3 text-xs border border-success/20">
                          <div className="flex items-start gap-2">
                            <div className="badge badge-success badge-sm mt-0.5">
                              {idx + 1}
                            </div>
                            <div className="flex-1 text-base-content/90">{step}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Final Output */}
                <div className="bg-base-200 rounded-lg p-4">
                  <h3 className="font-semibold mb-2">Final Output</h3>
                  <pre className="text-xs whitespace-pre-wrap font-mono">
                    {typeof agentMode.output === "string" 
                      ? agentMode.output 
                      : JSON.stringify(agentMode.output, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            {!agentMode.loading && !agentMode.output && !agentMode.error && (
              <div className="text-center py-8 text-base-content/40">
                Click "Agent Mode Only" to run
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

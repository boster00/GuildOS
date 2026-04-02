"use client";

import { useState, useEffect } from "react";
import { initMonkey } from "@/libs/monkey";

export default function AgentKitTestPage() {
  const [prompt, setPrompt] = useState(
    `•  service_name: ELISA CRO Service
•  icp: Biotech discovery and preclinical R&D teams
•  offer: We run your plates quickly with reliable execution so your team can focus on decisions, not troubleshooting.`
  );
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [logs, setLogs] = useState([]);
  const [icps, setIcps] = useState([]);
  const [offers, setOffers] = useState([]);
  const [loadingData, setLoadingData] = useState(false);
  const [selectedIcp, setSelectedIcp] = useState("");
  const [selectedOffer, setSelectedOffer] = useState("");
  const [selectedStateVar, setSelectedStateVar] = useState(null);
  const [showStatePanel, setShowStatePanel] = useState(true); // Open by default
  const [currentStep, setCurrentStep] = useState(null);

  // Load ICPs and Offers on mount
  useEffect(() => {
    loadData();
  }, []);

  // Update prompt when ICP or Offer selection changes
  useEffect(() => {
    if (!selectedIcp && !selectedOffer) {
      return; // Don't update if nothing is selected
    }

    const icp = icps.find((i) => i.id === selectedIcp);
    const offer = offers.find((o) => o.id === selectedOffer);

    // Get service name from offer name, or use a default
    const serviceName = offer?.name || "Service";
    
    // Build comprehensive prompt with all ICP and Offer details
    let newPrompt = `•  service_name: ${serviceName}\n`;
    
    // Add ICP details - ICP now only has name and description (per database schema)
    if (icp) {
      if (icp.name) {
        newPrompt += `•  icp: ${icp.name}\n`;
      }
      
      if (icp.description && icp.description.trim()) {
        newPrompt += `•  icp_description: ${icp.description}\n`;
      }
    }
    
    // Add Offer details - using actual field names from offers table
    if (offer) {
      if (offer.description && offer.description.trim()) {
        newPrompt += `•  offer: ${offer.description}\n`;
      }
      
      // Add transactional facts if they exist
      if (offer.transactional_facts && offer.transactional_facts.trim()) {
        newPrompt += `•  offer_transactional_facts: ${offer.transactional_facts}\n`;
      }
    }

    setPrompt(newPrompt.trim());
  }, [selectedIcp, selectedOffer, icps, offers]);

  const loadData = async () => {
    setLoadingData(true);
    try {
      const monkey = await initMonkey();
      const [icpsText, offersText] = await Promise.all([
        monkey.apiGet("/api/agent-kit-test/icps"),
        monkey.apiGet("/api/agent-kit-test/offers"),
      ]);
      const icpsData = JSON.parse(icpsText);
      const offersData = JSON.parse(offersText);
      if (icpsData.icps != null) {

        setIcps(icpsData.icps || []);
      }
      if (offersData.offers != null) {

        setOffers(offersData.offers || []);
      }
    } catch (err) {

    } finally {
      setLoadingData(false);
    }
  };

  const handleIcpSelect = (e) => {
    setSelectedIcp(e.target.value);
  };

  const handleOfferSelect = (e) => {
    setSelectedOffer(e.target.value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    setLogs([]);
    setCurrentStep({
      step: "Starting Workflow",
      template: "Initializing...",
      settings: null,
      payload: { input_as_text: prompt },
      response: null,
    });

    try {
      const monkey = await initMonkey();
      const response = await monkey.apiCallStream("/api/agent-kit-test/run-stream", {
        input_as_text: prompt,
      });

      if (!response.body) {
        throw new Error("Response body is not available");
      }

      // Read the SSE stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let currentEventType = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // Keep incomplete line in buffer

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          
          if (line.startsWith("event: ")) {
            currentEventType = line.substring(7).trim();
            continue;
          }
          
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.substring(6));
              
              // Handle different event types
              if (currentEventType === "progress" || data.step) {
                // Progress update
                const logEntry = {
                  agent: data.agent || "System",
                  message: data.message,
                  timestamp: data.timestamp || new Date().toISOString(),
                };
                setLogs((prev) => [...prev, logEntry]);

                // Update current step with result data
                if (data.result) {
                  setCurrentStep({
                    step: data.agent || "Processing",
                    template: `${data.agent || "Agent"} Agent`,
                    settings: { model: "gpt-4o" },
                    payload: data.result,
                    response: data.result,
                  });
                } else {
                  // Update step message only
                  setCurrentStep((prev) => ({
                    ...prev,
                    step: data.agent || prev.step,
                    template: `${data.agent || "Agent"} Agent`,
                  }));
                }
              } else if (currentEventType === "complete" || data.success !== undefined) {
                // Complete event
                setResult(data);
                setLogs((prev) => [
                  ...prev,
                  {
                    agent: "System",
                    message: "Workflow completed successfully",
                    timestamp: data.timestamp || new Date().toISOString(),
                  },
                ]);

                // Set final step
                if (data.state) {
                  if (data.state.sections_html?.page_html) {
                    setCurrentStep({
                      step: "HTML Conversion",
                      template: "HTML Converter Agent",
                      settings: { model: "gpt-4o" },
                      payload: data.state.sections_draft,
                      response: data.state.sections_html,
                    });
                  }
                }
              } else if (currentEventType === "error" || (data.message && data.message.includes("error"))) {
                // Error event
                setError(data.message);
                setLogs((prev) => [
                  ...prev,
                  {
                    agent: "System",
                    message: data.message,
                    timestamp: data.timestamp || new Date().toISOString(),
                  },
                ]);
              } else if (currentEventType === "start") {
                // Start event
                setLogs([{
                  agent: "System",
                  message: data.message || "Starting workflow...",
                  timestamp: data.timestamp || new Date().toISOString(),
                }]);
              }
            } catch (parseError) {

            }
          }
        }
      }
    } catch (err) {
      setError(err.message);

    } finally {
      setLoading(false);
    }
  };

  // Get state variables from result
  const getStateVariables = () => {
    if (!result?.state) return [];
    
    const state = result.state;
    const getValuePreview = (value, type) => {
      if (value === null || value === undefined) return "(null)";
      
      if (type === "string") {
        return value.length > 60 ? `${value.substring(0, 60)}...` : value;
      }
      
      if (type === "number") {
        return String(value);
      }
      
      if (type === "object") {
        if (Array.isArray(value)) {
          return `Array (${value.length} item${value.length !== 1 ? "s" : ""})`;
        }
        const keys = Object.keys(value || {});
        return `Object (${keys.length} key${keys.length !== 1 ? "s" : ""})`;
      }
      
      return String(value);
    };

    return [
      { 
        key: "service_name", 
        label: "Service Name", 
        value: state.service_name, 
        type: "string",
        preview: getValuePreview(state.service_name, "string")
      },
      { 
        key: "icp", 
        label: "ICP", 
        value: state.icp, 
        type: "string",
        preview: getValuePreview(state.icp, "string")
      },
      { 
        key: "offer", 
        label: "Offer", 
        value: state.offer, 
        type: "string",
        preview: getValuePreview(state.offer, "string")
      },
      { 
        key: "revision_count", 
        label: "Revision Count", 
        value: state.revision_count, 
        type: "number",
        preview: String(state.revision_count || 0)
      },
      { 
        key: "sections_outline", 
        label: "Sections Outline", 
        value: state.sections_outline, 
        type: "object",
        preview: getValuePreview(state.sections_outline, "object")
      },
      { 
        key: "sections_draft", 
        label: "Sections Draft", 
        value: state.sections_draft, 
        type: "object",
        preview: getValuePreview(state.sections_draft, "object")
      },
      { 
        key: "sections_html", 
        label: "Sections HTML", 
        value: state.sections_html, 
        type: "object",
        preview: getValuePreview(state.sections_html, "object")
      },
      { 
        key: "sections_feedback", 
        label: "Sections Feedback", 
        value: state.sections_feedback, 
        type: "object",
        preview: getValuePreview(state.sections_feedback, "object")
      },
    ];
  };

  const stateVariables = getStateVariables();

  return (
    <div className="min-h-screen bg-base-200 p-8 relative">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">OpenAI Agent Kit SDK Test</h1>
          <p className="text-base-content/70">
            Test the agentic workflow for generating service landing pages
          </p>
        </div>

        {/* Control Panel */}
        <div className="card bg-base-100 shadow-xl mb-6">
          <div className="card-body">
            <h2 className="card-title mb-4">Control Panel</h2>

            {/* ICP and Offer Loaders */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold">
                    Load Existing ICP (Optional)
                  </span>
                </label>
                <select
                  className="select select-bordered w-full"
                  value={selectedIcp}
                  onChange={handleIcpSelect}
                  disabled={loading || loadingData}
                >
                  <option value="">Select an ICP...</option>
                  {icps.map((icp) => (
                    <option key={icp.id} value={icp.id}>
                      {icp.name || icp.id}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold">
                    Load Existing Offer (Optional)
                  </span>
                </label>
                <select
                  className="select select-bordered w-full"
                  value={selectedOffer}
                  onChange={handleOfferSelect}
                  disabled={loading || loadingData}
                >
                  <option value="">Select an offer...</option>
                  {offers.map((offer) => (
                    <option key={offer.id} value={offer.id}>
                      {offer.name || offer.id}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            
            {loadingData && (
              <div className="alert alert-info mb-4">
                <span className="loading loading-spinner loading-sm"></span>
                <span>Loading ICPs and offers...</span>
              </div>
            )}
            
            {!loadingData && icps.length === 0 && offers.length === 0 && (
              <div className="alert alert-warning mb-4">
                <span className="text-xs">
                  No ICPs or offers found. Create them in the ICPs and Offers sections first.
                </span>
              </div>
            )}
            
            {!loadingData && (icps.length > 0 || offers.length > 0) && (
              <div className="text-xs text-base-content/50 mb-2">
                Found {icps.length} ICP{icps.length !== 1 ? 's' : ''} and {offers.length} offer{offers.length !== 1 ? 's' : ''}
              </div>
            )}
            
            <form onSubmit={handleSubmit}>
              <div className="form-control mb-4">
                <label className="label">
                  <span className="label-text font-semibold">Input Prompt</span>
                  <span className="label-text-alt">
                    Include service_name, icp, and offer
                  </span>
                </label>
                <textarea
                  className="textarea textarea-bordered h-32 font-mono text-sm"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Enter service details..."
                  disabled={loading}
                />
              </div>

              <button
                type="submit"
                className={`btn btn-primary w-full ${loading ? "loading" : ""}`}
                disabled={loading}
              >
                {loading ? "Running Workflow..." : "Generate Landing Page"}
              </button>
            </form>

            {/* Current Step Area */}
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-sm">Current Step</h3>
                {currentStep?.step && (
                  <span className="badge badge-sm badge-info">{currentStep.step}</span>
                )}
              </div>
              <div className="bg-base-200 rounded-lg border border-base-300 max-h-[200px] overflow-y-auto">
                {currentStep ? (
                  <div className="p-4 space-y-3 text-xs">
                    {currentStep.template && (
                      <div>
                        <div className="font-semibold text-primary mb-1 flex items-center gap-2">
                          <span>📝 Template:</span>
                        </div>
                        <pre className="bg-base-300 p-2 rounded text-xs overflow-x-auto whitespace-pre-wrap break-words">
                          {typeof currentStep.template === 'string' 
                            ? currentStep.template 
                            : JSON.stringify(currentStep.template, null, 2)}
                        </pre>
                      </div>
                    )}
                    {currentStep.settings && (
                      <div>
                        <div className="font-semibold text-secondary mb-1 flex items-center gap-2">
                          <span>⚙️ Settings:</span>
                        </div>
                        <pre className="bg-base-300 p-2 rounded text-xs overflow-x-auto whitespace-pre-wrap break-words">
                          {JSON.stringify(currentStep.settings, null, 2)}
                        </pre>
                      </div>
                    )}
                    {currentStep.payload && (
                      <div>
                        <div className="font-semibold text-accent mb-1 flex items-center gap-2">
                          <span>📤 Payload:</span>
                        </div>
                        <pre className="bg-base-300 p-2 rounded text-xs overflow-x-auto whitespace-pre-wrap break-words">
                          {typeof currentStep.payload === 'string' 
                            ? currentStep.payload 
                            : JSON.stringify(currentStep.payload, null, 2)}
                        </pre>
                      </div>
                    )}
                    {currentStep.response && (
                      <div>
                        <div className="font-semibold text-success mb-1 flex items-center gap-2">
                          <span>📥 Response:</span>
                        </div>
                        <pre className="bg-base-300 p-2 rounded text-xs overflow-x-auto whitespace-pre-wrap break-words">
                          {typeof currentStep.response === 'string' 
                            ? currentStep.response 
                            : JSON.stringify(currentStep.response, null, 2)}
                        </pre>
                      </div>
                    )}
                    {!currentStep.template && !currentStep.settings && !currentStep.payload && !currentStep.response && (
                      <div className="text-base-content/50 text-center py-4">
                        <div className="loading loading-spinner loading-sm mx-auto mb-2"></div>
                        <p className="text-sm">Waiting for step information...</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-base-content/50 text-center py-8">
                    <p className="text-sm">No active step</p>
                    <p className="text-xs mt-1">Step information will appear here during workflow execution</p>
                  </div>
                )}
              </div>
            </div>

            {/* Status Messages */}
            {loading && (
              <div className="alert alert-info mt-4">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  className="stroke-current shrink-0 w-6 h-6"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span>
                  Running agentic workflow... This may take 30-60 seconds.
                </span>
              </div>
            )}

            {error && (
              <div className="alert alert-error mt-4">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="stroke-current shrink-0 h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span>{error}</span>
              </div>
            )}

            {/* Process Logs */}
            {logs.length > 0 && (
              <div className="mt-4">
                <h3 className="font-semibold mb-2">Process Log:</h3>
                <div className="bg-base-300 p-4 rounded-lg max-h-48 overflow-y-auto font-mono text-xs">
                  {logs.map((log, idx) => (
                    <div key={idx} className="mb-1">
                      <span className="text-primary">[{log.agent}]</span>{" "}
                      {log.message}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Final Result - HTML Output */}
        {result && (
          <div className="card bg-base-100 shadow-xl mt-6">
            <div className="card-body">
              <div className="flex items-center justify-between mb-4">
                <h2 className="card-title text-2xl">Final Result</h2>
                <div className="flex gap-2">
                  <button
                    className="btn btn-sm btn-outline btn-primary"
                    onClick={() => {
                      const blob = new Blob([result.html], {
                        type: "text/html",
                      });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = "landing-page.html";
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                  >
                    💾 Download HTML
                  </button>
                  <button
                    className="btn btn-sm btn-outline btn-secondary"
                    onClick={() => {
                      navigator.clipboard.writeText(result.html);
                      alert("HTML copied to clipboard!");
                    }}
                  >
                    📋 Copy HTML
                  </button>
                </div>
              </div>

              {/* Metadata */}
              {result.metadata && (
                <div className="mb-4 p-4 bg-gradient-to-r from-base-200 to-base-300 rounded-lg border border-base-300">
                  <h3 className="font-semibold mb-3 text-base">Workflow Metadata</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div className="bg-base-100 p-2 rounded">
                      <div className="text-xs text-base-content/70 mb-1">Service</div>
                      <div className="font-medium">{result.metadata.service_name}</div>
                    </div>
                    <div className="bg-base-100 p-2 rounded">
                      <div className="text-xs text-base-content/70 mb-1">ICP</div>
                      <div className="font-medium truncate">{result.metadata.icp}</div>
                    </div>
                    <div className="bg-base-100 p-2 rounded">
                      <div className="text-xs text-base-content/70 mb-1">Revisions</div>
                      <div className="font-medium">{result.metadata.revision_count}</div>
                    </div>
                    <div className="bg-base-100 p-2 rounded">
                      <div className="text-xs text-base-content/70 mb-1">QA Status</div>
                      <div>
                        <span
                          className={`badge badge-sm ${
                            result.metadata.qa_status === "pass"
                              ? "badge-success"
                              : "badge-warning"
                          }`}
                        >
                          {result.metadata.qa_status}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* HTML Preview */}
              <div className="mb-4 border-2 border-base-300 rounded-lg overflow-hidden shadow-lg">
                <div className="bg-gradient-to-r from-base-300 to-base-200 p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-success"></div>
                    <span className="text-sm font-semibold">Live Preview</span>
                  </div>
                  <span className="text-xs text-base-content/70">Rendered HTML</span>
                </div>
                <div className="bg-white overflow-auto">
                  <div
                    className="w-full min-h-[800px] border-0"
                    dangerouslySetInnerHTML={{ __html: result.html }}
                    title="Generated Landing Page"
                  />
                </div>
              </div>

              {/* Raw HTML Code */}
              <details className="mt-4">
                <summary className="cursor-pointer font-semibold mb-2 text-base hover:text-primary transition-colors">
                  🔍 View Raw HTML Code
                </summary>
                <div className="mt-2 bg-base-300 rounded-lg p-4 border border-base-300">
                  <pre className="text-xs font-mono overflow-x-auto max-h-96 overflow-y-auto">
                    <code className="text-base-content">{result.html}</code>
                  </pre>
                </div>
              </details>
            </div>
          </div>
        )}

        {/* State Variables Panel - Always Visible */}
        <>
          {/* Toggle Button */}
          <button
            className="fixed right-4 top-1/2 -translate-y-1/2 btn btn-primary btn-sm z-40"
            onClick={() => setShowStatePanel(!showStatePanel)}
          >
            {showStatePanel ? "← Hide" : "State →"}
          </button>

          {/* Right Side Panel */}
          {showStatePanel && (
            <div className="fixed right-0 top-0 h-full w-80 bg-base-100 shadow-2xl z-30 overflow-y-auto">
              <div className="p-4 border-b border-base-300 sticky top-0 bg-base-100">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-lg">State Variables</h3>
                  <button
                    className="btn btn-sm btn-ghost"
                    onClick={() => setShowStatePanel(false)}
                  >
                    ✕
                  </button>
                </div>
              </div>
              <div className="p-4 space-y-2">
                {stateVariables.length > 0 ? (
                  stateVariables.map((stateVar) => (
                    <div
                      key={stateVar.key}
                      className="card bg-base-200 shadow-sm hover:shadow-md transition-all cursor-pointer hover:bg-base-300"
                      onClick={() => setSelectedStateVar(stateVar)}
                    >
                      <div className="card-body p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-semibold text-sm">{stateVar.label}</h4>
                              <span className={`badge badge-sm ${
                                stateVar.type === "string" ? "badge-info" :
                                stateVar.type === "number" ? "badge-success" :
                                "badge-warning"
                              }`}>
                                {stateVar.type}
                              </span>
                            </div>
                            <p className="text-xs text-base-content/70 break-words">
                              {stateVar.preview}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-base-content/50">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-12 w-12 mx-auto mb-4 opacity-50"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    <p className="text-sm font-medium mb-2">No State Data</p>
                    <p className="text-xs">
                      Run the workflow to see state variables here
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* State Variable Detail Modal */}
          {selectedStateVar && (
              <div 
                className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
                onClick={() => setSelectedStateVar(null)}
              >
                <div 
                  className="bg-base-100 rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="p-4 border-b border-base-300 flex items-center justify-between sticky top-0 bg-base-100">
                    <div>
                      <h3 className="font-bold text-xl">
                        {selectedStateVar.label}
                      </h3>
                      <p className="text-sm text-base-content/70 mt-1">
                        Key: <code className="text-xs bg-base-200 px-1 rounded">{selectedStateVar.key}</code> • 
                        Type: <span className="badge badge-sm badge-outline ml-1">{selectedStateVar.type}</span>
                      </p>
                    </div>
                    <button
                      className="btn btn-sm btn-ghost"
                      onClick={() => setSelectedStateVar(null)}
                    >
                      ✕
                    </button>
                  </div>
                  <div className="p-4 overflow-auto flex-1">
                    <div className="mb-4 flex gap-2 flex-wrap">
                      <button
                        className="btn btn-sm btn-outline"
                        onClick={() => {
                          navigator.clipboard.writeText(
                            JSON.stringify(selectedStateVar.value, null, 2)
                          );
                          alert("JSON copied to clipboard!");
                        }}
                      >
                        📋 Copy JSON
                      </button>
                      <button
                        className="btn btn-sm btn-outline"
                        onClick={() => {
                          const blob = new Blob(
                            [JSON.stringify(selectedStateVar.value, null, 2)],
                            { type: "application/json" }
                          );
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = `${selectedStateVar.key}.json`;
                          a.click();
                          URL.revokeObjectURL(url);
                        }}
                      >
                        💾 Download JSON
                      </button>
                    </div>
                    <div className="bg-base-300 rounded-lg p-4 overflow-auto">
                      <pre className="text-xs font-mono">
                        <code>
                          {JSON.stringify(selectedStateVar.value, null, 2)}
                        </code>
                      </pre>
                    </div>
                  </div>
                </div>
              </div>
            )}
        </>
      </div>
    </div>
  );
}

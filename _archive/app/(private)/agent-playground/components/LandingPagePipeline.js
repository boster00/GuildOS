// ARCHIVED: Original path was app/(private)/agent-playground/components/LandingPagePipeline.js

"use client";
// TODO: remove — agent-playground page is obsolete

import { useState } from "react";
import { Loader, ChevronDown, ChevronUp, CheckCircle, XCircle, Clock, FileText } from "lucide-react";
import { initMonkey } from "@/libs/monkey";

export default function LandingPagePipeline() {
  const [agenticState, setAgenticState] = useState({
    steps: [],
    currentStep: null,
    artifacts: {},
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleStartPipeline = async () => {
    setLoading(true);
    setError(null);
    
    // Initialize Step 1
    const step1 = {
      stepId: "step1_organize",
      stepName: "Organize ICP and Offer",
      status: "running",
      payload: {},
      tools: [],
      output: null,
      error: null,
    };

    setAgenticState({
      steps: [step1],
      currentStep: "step1_organize",
      artifacts: {},
    });

    try {
      const monkey = await initMonkey();
      const text = await monkey.apiCall("/api/monkey/landing-page/step1", {
        model: "agent",
        icp: {
          name: "Biotech R&D Teams",
          description: "Biotech preclinical R&D teams",
          roles: ["Research Scientists", "Lab Managers"],
          top_pains: ["Slow turnaround times", "Limited antibody selection"],
        },
        offer: {
          name: "IHC/IF Service",
          description: "IHC/IF service with fast turnaround and validated antibodies",
        },
      });
      const data = JSON.parse(text);

      if (data.error) {
        throw new Error(data.error);
      }

      // Update Step 1 with results
      setAgenticState(prev => ({
        ...prev,
        steps: prev.steps.map(step =>
          step.stepId === "step1_organize"
            ? {
                ...step,
                status: "done",
                tools: data.tools || [],
                output: data.output,
              }
            : step
        ),
        artifacts: {
          ...prev.artifacts,
          step1Output: data.output,
        },
      }));
    } catch (err) {
      setError(err.message);
      setAgenticState(prev => ({
        ...prev,
        steps: prev.steps.map(step =>
          step.stepId === "step1_organize"
            ? { ...step, status: "error", error: err.message }
            : step
        ),
      }));
    } finally {
      setLoading(false);
    }
  };

  const handleContinueToStep = async (nextStepId) => {
    setLoading(true);
    setError(null);

    try {
      let data;
      const artifacts = agenticState.artifacts;
      const monkey = await initMonkey();

      if (nextStepId === "step2_competitor") {
        // Step 2: Competitor Benchmark
        const step2 = {
          stepId: "step2_competitor",
          stepName: "Competitor Benchmark",
          status: "running",
          payload: {},
          tools: [],
          output: null,
          error: null,
        };

        setAgenticState(prev => ({
          ...prev,
          steps: [...prev.steps, step2],
          currentStep: "step2_competitor",
        }));

        const text = await monkey.apiCall("/api/monkey/landing-page/step2", {
          model: "agent",
          step1Output: artifacts.step1Output,
          pageType: "BASE_UNIVERSAL",
          maxCompetitors: 5,
        });
        data = JSON.parse(text);
      } else if (nextStepId === "step3_finalize") {
        // Step 3: Finalize Content Outline
        const step3 = {
          stepId: "step3_finalize",
          stepName: "Finalize Content Outline",
          status: "running",
          payload: {},
          tools: [],
          output: null,
          error: null,
        };

        setAgenticState(prev => ({
          ...prev,
          steps: [...prev.steps, step3],
          currentStep: "step3_finalize",
        }));

        const text = await monkey.apiCall("/api/monkey/landing-page/step3", {
          model: "agent",
          step1Output: artifacts.step1Output,
          step2Output: artifacts.step2Output,
          pageType: "BASE_UNIVERSAL",
        });
        data = JSON.parse(text);
      } else if (nextStepId === "step4_write") {
        // Step 4: Write Sections and Render HTML
        const step4 = {
          stepId: "step4_write",
          stepName: "Write Sections and Render HTML",
          status: "running",
          payload: {},
          tools: [],
          output: null,
          error: null,
        };

        setAgenticState(prev => ({
          ...prev,
          steps: [...prev.steps, step4],
          currentStep: "step4_write",
        }));

        const text = await monkey.apiCall("/api/monkey/landing-page/step4", {
          model: "agent",
          step1Output: artifacts.step1Output,
          step2Output: artifacts.step2Output,
          step3Output: artifacts.step3Output,
          includeComments: false,
        });
        data = JSON.parse(text);
      }

      if (data === undefined) {
        throw new Error("Invalid step ID");
      }

      if (data.error) {
        throw new Error(data.error);
      }

      // Update step with results
      setAgenticState(prev => ({
        ...prev,
        steps: prev.steps.map(step =>
          step.stepId === nextStepId
            ? {
                ...step,
                status: "done",
                tools: data.tools || [],
                output: data.output,
              }
            : step
        ),
        artifacts: {
          ...prev.artifacts,
          [`${nextStepId}Output`]: data.output,
        },
      }));
    } catch (err) {
      setError(err.message);
      setAgenticState(prev => ({
        ...prev,
        steps: prev.steps.map(step =>
          step.stepId === nextStepId
            ? { ...step, status: "error", error: err.message }
            : step
        ),
      }));
    } finally {
      setLoading(false);
    }
  };

  const getNextStepId = (currentStepId) => {
    const stepOrder = ["step1_organize", "step2_competitor", "step3_finalize", "step4_write"];
    const currentIndex = stepOrder.indexOf(currentStepId);
    return currentIndex < stepOrder.length - 1 ? stepOrder[currentIndex + 1] : null;
  };

  const formatStepName = (stepId) => {
    return stepId
      .replace("step", "Step ")
      .replace("_", " ")
      .split(" ")
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "done":
        return <CheckCircle className="w-5 h-5 text-success" />;
      case "error":
        return <XCircle className="w-5 h-5 text-error" />;
      case "running":
        return <Loader className="w-5 h-5 text-primary animate-spin" />;
      default:
        return <Clock className="w-5 h-5 text-base-content/40" />;
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "done":
        return <span className="badge badge-success">Done</span>;
      case "error":
        return <span className="badge badge-error">Error</span>;
      case "running":
        return <span className="badge badge-primary">Running</span>;
      default:
        return <span className="badge badge-outline">Pending</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title">
            <FileText className="w-6 h-6" />
            Landing Page Pipeline
          </h2>
          <p className="text-base-content/60">
            Step-by-step pipeline for generating landing pages with competitor benchmarking
          </p>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="alert alert-error">
          <span>Error: {error}</span>
          <button onClick={() => setError(null)} className="btn btn-sm btn-ghost">
            Dismiss
          </button>
        </div>
      )}

      {/* Start Button */}
      {agenticState.steps.length === 0 && (
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body text-center">
            <button
              onClick={handleStartPipeline}
              disabled={loading}
              className="btn btn-primary btn-lg gap-2"
            >
              {loading ? (
                <>
                  <Loader className="w-5 h-5 animate-spin" />
                  Starting...
                </>
              ) : (
                "Start Landing Page Pipeline"
              )}
            </button>
          </div>
        </div>
      )}

      {/* Steps Display */}
      {agenticState.steps.map((step, index) => {
        const step1Output = agenticState.artifacts?.step1Output;
        const showIcpOffer = (step.stepId === "step2_competitor" || step.stepId === "step3_finalize" || step.stepId === "step4_write") && step1Output;

        return (
          <div key={step.stepId} className="card bg-base-100 shadow-xl">
            <div className="card-body">
              {/* Step Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  {getStatusIcon(step.status)}
                  <div>
                    <h3 className="text-lg font-semibold">{step.stepName}</h3>
                    <p className="text-sm text-base-content/60">Step {index + 1}</p>
                  </div>
                </div>
                {getStatusBadge(step.status)}
              </div>

              {/* Expandable Sections */}
              <div className="space-y-2">
                {/* ICP & Offer Details - shown in Step 2 and later */}
                {showIcpOffer && (
                  <div className="collapse collapse-arrow bg-base-200">
                    <input type="checkbox" defaultChecked />
                    <div className="collapse-title font-medium">ICP & Offer Details</div>
                    <div className="collapse-content">
                      <div className="space-y-4 text-sm">
                        {step1Output.icp && (
                          <div>
                            <h4 className="font-semibold text-base mb-1">ICP</h4>
                            <div className="bg-base-100 p-3 rounded space-y-1">
                              <p><span className="text-base-content/60">Name:</span> {step1Output.icp.name || "—"}</p>
                              {step1Output.icp.description && (
                                <p><span className="text-base-content/60">Description:</span> {step1Output.icp.description}</p>
                              )}
                              {step1Output.icp.roles?.length > 0 && (
                                <p><span className="text-base-content/60">Roles:</span> {step1Output.icp.roles.join(", ")}</p>
                              )}
                              {step1Output.icp.top_pains?.length > 0 && (
                                <p><span className="text-base-content/60">Top pains:</span> {step1Output.icp.top_pains.join(", ")}</p>
                              )}
                            </div>
                          </div>
                        )}
                        {step1Output.offer && (
                          <div>
                            <h4 className="font-semibold text-base mb-1">Offer</h4>
                            <div className="bg-base-100 p-3 rounded space-y-1">
                              <p><span className="text-base-content/60">Name:</span> {step1Output.offer.name || "—"}</p>
                              {step1Output.offer.description && (
                                <p><span className="text-base-content/60">Description:</span> {step1Output.offer.description}</p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Payload */}
                <div className="collapse collapse-arrow bg-base-200">
                  <input type="checkbox" />
                  <div className="collapse-title font-medium">Payload</div>
                  <div className="collapse-content">
                    <pre className="text-xs bg-base-100 p-4 rounded overflow-auto">
                      {JSON.stringify(step.payload, null, 2)}
                    </pre>
                  </div>
                </div>

                {/* Tools */}
                {step.tools && step.tools.length > 0 && (
                  <div className="collapse collapse-arrow bg-base-200">
                    <input type="checkbox" />
                    <div className="collapse-title font-medium">
                      Tools ({step.tools.length})
                    </div>
                    <div className="collapse-content">
                      <div className="space-y-4">
                        {step.tools.map((tool, toolIndex) => (
                          <div key={toolIndex} className="border-l-4 border-primary pl-4">
                            <h4 className="font-semibold">{tool.toolName || `Tool ${toolIndex + 1}`}</h4>
                            {tool.input && (
                              <details className="mt-2">
                                <summary className="cursor-pointer text-sm text-base-content/60">
                                  Input
                                </summary>
                                <pre className="text-xs bg-base-100 p-2 rounded mt-2 overflow-auto">
                                  {JSON.stringify(tool.input, null, 2)}
                                </pre>
                              </details>
                            )}
                            {tool.output && (
                              <details className="mt-2">
                                <summary className="cursor-pointer text-sm text-base-content/60">
                                  Output
                                </summary>
                                <pre className="text-xs bg-base-100 p-2 rounded mt-2 overflow-auto">
                                  {JSON.stringify(tool.output, null, 2)}
                                </pre>
                              </details>
                            )}
                            {tool.error && (
                              <div className="alert alert-error mt-2">
                                <span className="text-xs">{tool.error}</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Output */}
                {step.output && (
                  <div className="collapse collapse-arrow bg-base-200">
                    <input type="checkbox" />
                    <div className="collapse-title font-medium">Output</div>
                    <div className="collapse-content">
                      <pre className="text-xs bg-base-100 p-4 rounded overflow-auto">
                        {JSON.stringify(step.output, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}

                {/* Error */}
                {step.error && (
                  <div className="alert alert-error">
                    <span>{step.error}</span>
                  </div>
                )}
              </div>

              {/* Continue Button */}
              {step.status === "done" && getNextStepId(step.stepId) && (
                <div className="mt-4">
                  <button
                    onClick={() => handleContinueToStep(getNextStepId(step.stepId))}
                    disabled={loading}
                    className="btn btn-primary btn-sm"
                  >
                    {loading ? (
                      <>
                        <Loader className="w-4 h-4 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      `Continue to ${formatStepName(getNextStepId(step.stepId))}`
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

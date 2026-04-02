"use client";

/**
 * Centralized Results Panel Component
 * Part B: Single reusable component for AI results display, selection, and feedback
 */

import React, { useState } from "react";
import { Loader, Check, X, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { ResultsUIConfig } from "./types";

interface MonkeyResultsPanelProps {
  config: ResultsUIConfig;
  // Response from monkey.runTask
  response: {
    ok: boolean;
    artifacts?: Record<string, any>;
    output?: {
      options?: any[];
      markdown?: string;
      html?: string;
    };
    errors?: Array<{ message: string; code?: string }>;
    runId?: string;
    meta?: any;
  } | null;
  // Loading state
  loading?: boolean;
  // Callback when user selects an option
  onSelect?: (selection: any) => void;
  // Callback when user provides feedback
  onFeedback?: (feedback: string, priorRun: any) => Promise<void>;
}

export default function MonkeyResultsPanel({
  config,
  response,
  loading = false,
  onSelect,
  onFeedback,
}: MonkeyResultsPanelProps) {
  const [selectedOption, setSelectedOption] = useState<any>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  // Check if response has selectable options
  const hasOptions = response?.output?.options && Array.isArray(response.output.options) && response.output.options.length > 0;
  const options = response?.output?.options || [];

  // Check if response has long-form content (markdown/html)
  const hasLongForm = response?.output?.markdown || response?.output?.html;

  const handleSelectOption = (option: any) => {
    setSelectedOption(option);
    if (onSelect) {
      onSelect(option);
    } else {
      // Apply to binding if no custom handler
      const transformed = config.binding.transform ? config.binding.transform(option) : option;
      config.binding.set(transformed);
    }
  };

  const handleApplySelection = () => {
    if (selectedOption) {
      const transformed = config.binding.transform ? config.binding.transform(selectedOption) : selectedOption;
      config.binding.set(transformed);
    }
  };

  const handleFeedback = async () => {
    if (!feedbackText.trim() || !response || !onFeedback) return;
    
    setIsRegenerating(true);
    try {
      const priorRun = {
        runId: response.runId,
        artifacts: response.artifacts,
        output: response.output,
      };
      await onFeedback(feedbackText, priorRun);
      setFeedbackText("");
      setShowFeedback(false);
    } catch (error: any) {
      alert(`Failed to regenerate: ${error.message}`);
    } finally {
      setIsRegenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 bg-base-100 rounded-lg border border-base-300">
        <div className="flex items-center gap-2">
          <Loader className="w-4 h-4 animate-spin" />
          <span className="text-sm">Generating...</span>
        </div>
      </div>
    );
  }

  if (response?.errors && response.errors.length > 0) {
    return (
      <div className="p-4 bg-error/10 rounded-lg border border-error/20">
        <div className="flex items-start gap-2">
          <X className="w-5 h-5 text-error mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-error mb-1">Error</h3>
            {response.errors.map((err, i) => (
              <p key={i} className="text-sm text-base-content/70">{err.message}</p>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!response || (!hasOptions && !hasLongForm)) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Options List (for selectable results) */}
      {hasOptions && (
        <div className="p-4 bg-base-100 rounded-lg border border-base-300">
          <h3 className="font-semibold mb-3">Select an option:</h3>
          <div className="space-y-2">
            {options.map((option, index) => {
              const isSelected = selectedOption === option;
              const displayText = typeof option === "string" ? option : (option.name || option.title || JSON.stringify(option));
              
              return (
                <div
                  key={index}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    isSelected
                      ? "border-primary bg-primary/10"
                      : "border-base-300 hover:border-primary/50 hover:bg-base-200"
                  }`}
                  onClick={() => handleSelectOption(option)}
                >
                  <div className="flex items-start gap-2">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 ${
                      isSelected ? "border-primary bg-primary" : "border-base-300"
                    }`}>
                      {isSelected && <Check className="w-3 h-3 text-primary-content" />}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm">{displayText}</p>
                      {typeof option === "object" && option.description && (
                        <p className="text-xs text-base-content/60 mt-1">{option.description}</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {selectedOption && (
            <button
              onClick={handleApplySelection}
              className="mt-3 w-full btn btn-primary btn-sm"
            >
              Apply Selection
            </button>
          )}
        </div>
      )}

      {/* Long-form Content (markdown/HTML) */}
      {hasLongForm && (
        <div className="p-4 bg-base-100 rounded-lg border border-base-300">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Generated Content</h3>
            <button
              onClick={() => setExpandedSections(prev => {
                const next = new Set(prev);
                if (next.has("content")) {
                  next.delete("content");
                } else {
                  next.add("content");
                }
                return next;
              })}
              className="btn btn-ghost btn-xs"
            >
              {expandedSections.has("content") ? (
                <><ChevronUp className="w-4 h-4" /> Collapse</>
              ) : (
                <><ChevronDown className="w-4 h-4" /> Expand</>
              )}
            </button>
          </div>
          
          {expandedSections.has("content") ? (
            <div className="space-y-2">
              {response.output.markdown && (
                <div>
                  <h4 className="text-xs font-semibold mb-1 text-base-content/60">Markdown:</h4>
                  <pre className="p-2 bg-base-200 rounded text-xs overflow-auto max-h-96">
                    {response.output.markdown}
                  </pre>
                </div>
              )}
              {response.output.html && (
                <div>
                  <h4 className="text-xs font-semibold mb-1 text-base-content/60">HTML:</h4>
                  <pre className="p-2 bg-base-200 rounded text-xs overflow-auto max-h-96">
                    {response.output.html.substring(0, 1000)}
                    {response.output.html.length > 1000 && "..."}
                  </pre>
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-base-content/70">
              {response.output.markdown && (
                <p>Markdown: {response.output.markdown.length} characters</p>
              )}
              {response.output.html && (
                <p>HTML: {response.output.html.length} characters</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Feedback Section */}
      {response && onFeedback && (
        <div className="p-4 bg-base-100 rounded-lg border border-base-300">
          {!showFeedback ? (
            <button
              onClick={() => setShowFeedback(true)}
              className="w-full btn btn-outline btn-sm"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Provide Feedback & Regenerate
            </button>
          ) : (
            <div className="space-y-2">
              <textarea
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder="What would you like to change or improve?"
                className="textarea textarea-bordered w-full text-sm min-h-[80px]"
                rows={3}
              />
              <div className="flex gap-2">
                <button
                  onClick={handleFeedback}
                  disabled={!feedbackText.trim() || isRegenerating}
                  className="btn btn-primary btn-sm flex-1"
                >
                  {isRegenerating ? (
                    <>
                      <Loader className="w-4 h-4 animate-spin mr-2" />
                      Regenerating...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Regenerate
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    setShowFeedback(false);
                    setFeedbackText("");
                  }}
                  className="btn btn-ghost btn-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


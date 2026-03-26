"use client";

import React, { useState, useCallback, useMemo } from "react";
import { Loader, AlertCircle, CheckCircle, Info, MessageSquare, Pencil, X, Maximize2 } from "lucide-react";
import { toast } from "react-hot-toast";
import { useWritingGuide } from "@/libs/content-magic/context/WritingGuideContext";
import CreditCostBadge from "@/components/CreditCostBadge";

// Per-model credit costs (minimum 2, premium feature)
const MODEL_CREDITS = {
  "openai-gpt-4o-mini": 2,
  "openai-gpt-4o": 3,
  "anthropic-claude-sonnet": 4,
  "anthropic-claude-haiku": 2,
  "google-gemini-15-pro": 3,
  "mistral-large": 3,
  "meta-llama-3-70b": 2,
};

const MODEL_LIST = [
  { id: "openai-gpt-4o-mini", label: "GPT-4o Mini", provider: "OpenAI" },
  { id: "openai-gpt-4o", label: "GPT-4o", provider: "OpenAI" },
  { id: "anthropic-claude-sonnet", label: "Claude Sonnet 4.5", provider: "Anthropic" },
  { id: "anthropic-claude-haiku", label: "Claude Haiku 4.5", provider: "Anthropic" },
  { id: "google-gemini-15-pro", label: "Gemini 1.5 Pro", provider: "Google" },
  { id: "mistral-large", label: "Mistral Large", provider: "Mistral" },
  { id: "meta-llama-3-70b", label: "Llama 3.1 70B", provider: "Meta" },
];

const FEEDBACK_MAX_CHARS = 10000;

const getSecondOpinions = {
  key: "get_second_opinions",
  pageType: ["all"],
  meta: {
    label: "Get Feedback",
    category: "write_optimize",
    description:
      "Evaluate your article with multiple AI models to get diverse, actionable feedback before finalising.",
    defaultActive: true,
  },
  DetailsUIDisplayMode: "rightside",

  is_complete: () => false,

  components: {
    ListingUI: ({ rule, context, onExecute }) => (
      <div className="flex items-center justify-between p-2 bg-white rounded border border-gray-200 hover:border-blue-300 transition-colors group cursor-pointer">
        <div className="flex-1">
          <span className="text-xs font-medium text-gray-700">{rule.meta.label}</span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onExecute?.();
          }}
          className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors opacity-0 group-hover:opacity-100"
          title="Get second opinions"
        >
          <MessageSquare className="w-4 h-4" />
        </button>
      </div>
    ),
    DetailedUI: function DetailComponent() {
      const { article, updateArticle } = useWritingGuide();

      const [criteria, setCriteria] = useState("");
      const [selectedModels, setSelectedModels] = useState(["openai-gpt-4o-mini"]);
      const [submitting, setSubmitting] = useState(false);
      const [submitError, setSubmitError] = useState(null);
      // { [modelId]: { status: 'loading'|'done'|'error', text, error, addedToFeedback, isStale } }
      const [modelResults, setModelResults] = useState({});
      // Per-model "Add to Feedback" saving state
      const [savingFeedback, setSavingFeedback] = useState({});
      // Over-limit warning per modelId
      const [overLimitWarning, setOverLimitWarning] = useState({});
      // Edit feedback popup: open state and draft text
      const [editFeedbackOpen, setEditFeedbackOpen] = useState(false);
      const [editFeedbackDraft, setEditFeedbackDraft] = useState("");
      const [savingEditFeedback, setSavingEditFeedback] = useState(false);
      // Which model's full response is shown in the popup (null = closed)
      const [expandedModel, setExpandedModel] = useState(null);

      const currentFeedback = article?.assets?.feedback || "";
      const feedbackLength = currentFeedback.length;

      const totalCost = useMemo(
        () => selectedModels.reduce((sum, id) => sum + (MODEL_CREDITS[id] || 2), 0),
        [selectedModels]
      );

      const toggleModel = useCallback((modelId) => {
        setSelectedModels((prev) =>
          prev.includes(modelId) ? prev.filter((id) => id !== modelId) : [...prev, modelId]
        );
      }, []);

      const handleSubmit = useCallback(async () => {
        if (selectedModels.length === 0) return;
        setSubmitting(true);
        setSubmitError(null);
        setOverLimitWarning({});

        // Mark selected models as loading; mark unselected existing results as stale
        setModelResults((prev) => {
          const next = { ...prev };
          // Stale any existing results not in this submission
          Object.keys(next).forEach((id) => {
            if (!selectedModels.includes(id)) {
              next[id] = { ...next[id], isStale: true };
            }
          });
          // Reset selected models to loading
          selectedModels.forEach((id) => {
            next[id] = { status: "loading", text: null, error: null, addedToFeedback: false, isStale: false };
          });
          return next;
        });

        try {
          const { initMonkey } = await import("@/libs/monkey");
          const monkey = await initMonkey();
          const responseText = await monkey.apiCall("/api/content-magic/get-second-opinions", {
            articleId: article.id,
            modelIds: selectedModels,
            criteria: criteria.trim() || null,
          });
          const data = JSON.parse(responseText);
          if (data.error) throw new Error(data.error);

          // Populate results
          setModelResults((prev) => {
            const next = { ...prev };
            selectedModels.forEach((id) => {
              const result = data.results?.[id];
              if (result?.error) {
                next[id] = { status: "error", text: null, error: result.error, addedToFeedback: false, isStale: false };
              } else {
                next[id] = { status: "done", text: result?.text || "", error: null, addedToFeedback: false, isStale: false };
              }
            });
            return next;
          });
        } catch (err) {
          setSubmitError(err.message || "Failed to get second opinions. Please try again.");
          // Mark loading models as error
          setModelResults((prev) => {
            const next = { ...prev };
            selectedModels.forEach((id) => {
              if (next[id]?.status === "loading") {
                next[id] = { status: "error", text: null, error: err.message || "Request failed", addedToFeedback: false, isStale: false };
              }
            });
            return next;
          });
        } finally {
          setSubmitting(false);
        }
      }, [article?.id, selectedModels, criteria]);

      const handleAddToFeedback = useCallback(
        async (modelId, responseText) => {
          const modelLabel = MODEL_LIST.find((m) => m.id === modelId)?.label || modelId;
          const appendText = `\n\n---\n**${modelLabel} Feedback:**\n${responseText}`;
          const newFeedback = currentFeedback + appendText;

          if (newFeedback.length > FEEDBACK_MAX_CHARS) {
            setOverLimitWarning((prev) => ({
              ...prev,
              [modelId]: {
                current: currentFeedback.length,
                adding: appendText.length,
                total: newFeedback.length,
              },
            }));
            return;
          }

          setOverLimitWarning((prev) => { const n = { ...prev }; delete n[modelId]; return n; });
          setSavingFeedback((prev) => ({ ...prev, [modelId]: true }));
          try {
            const { initMonkey } = await import("@/libs/monkey");
            const monkey = await initMonkey();
            await monkey.articleAssets.savePatch(
              article.id,
              { feedback: newFeedback },
              article.assets,
              (payload) => updateArticle({ assets: payload.assets })
            );
            setModelResults((prev) => ({
              ...prev,
              [modelId]: { ...prev[modelId], addedToFeedback: true },
            }));
            toast.success("Added to Feedback asset.");
          } catch (err) {
            toast.error("Failed to save feedback.");
          } finally {
            setSavingFeedback((prev) => { const n = { ...prev }; delete n[modelId]; return n; });
          }
        },
        [article?.id, article?.assets, currentFeedback, updateArticle]
      );

      const handleConfirmOverLimit = useCallback(
        async (modelId, responseText) => {
          const modelLabel = MODEL_LIST.find((m) => m.id === modelId)?.label || modelId;
          const appendText = `\n\n---\n**${modelLabel} Feedback:**\n${responseText}`;
          const newFeedback = currentFeedback + appendText;

          setOverLimitWarning((prev) => { const n = { ...prev }; delete n[modelId]; return n; });
          setSavingFeedback((prev) => ({ ...prev, [modelId]: true }));
          try {
            const { initMonkey } = await import("@/libs/monkey");
            const monkey = await initMonkey();
            await monkey.articleAssets.savePatch(
              article.id,
              { feedback: newFeedback },
              article.assets,
              (payload) => updateArticle({ assets: payload.assets })
            );
            setModelResults((prev) => ({
              ...prev,
              [modelId]: { ...prev[modelId], addedToFeedback: true },
            }));
            toast.success("Added to Feedback asset (over limit).");
          } catch (err) {
            toast.error("Failed to save feedback.");
          } finally {
            setSavingFeedback((prev) => { const n = { ...prev }; delete n[modelId]; return n; });
          }
        },
        [article?.id, article?.assets, currentFeedback, updateArticle]
      );

      const openEditFeedback = useCallback(() => {
        setEditFeedbackDraft(currentFeedback);
        setEditFeedbackOpen(true);
      }, [currentFeedback]);

      const handleSaveEditFeedback = useCallback(async () => {
        const trimmed = editFeedbackDraft.trim();
        if (trimmed.length > FEEDBACK_MAX_CHARS) {
          toast.error(`Feedback cannot exceed ${FEEDBACK_MAX_CHARS.toLocaleString()} characters.`);
          return;
        }
        setSavingEditFeedback(true);
        try {
          const { initMonkey } = await import("@/libs/monkey");
          const monkey = await initMonkey();
          await monkey.articleAssets.savePatch(
            article.id,
            { feedback: trimmed },
            article.assets,
            (payload) => updateArticle({ assets: payload.assets })
          );
          toast.success("Feedback saved.");
          setEditFeedbackOpen(false);
        } catch (err) {
          toast.error("Failed to save feedback.");
        } finally {
          setSavingEditFeedback(false);
        }
      }, [article?.id, article?.assets, editFeedbackDraft, updateArticle]);

      const hasAnyResults = Object.keys(modelResults).length > 0;
      const feedbackPct = Math.min(100, (feedbackLength / FEEDBACK_MAX_CHARS) * 100);
      const feedbackNearLimit = feedbackLength > FEEDBACK_MAX_CHARS * 0.8;

      return (
        <div className="space-y-5">
          {/* Feedback asset status bar */}
          {feedbackLength > 0 && (
            <div className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm ${feedbackNearLimit ? "border-amber-300 bg-amber-50" : "border-gray-200 bg-gray-50"}`}>
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <MessageSquare className={`w-4 h-4 shrink-0 ${feedbackNearLimit ? "text-amber-600" : "text-gray-500"}`} />
                <div className="flex-1 min-w-0">
                  <span className={`font-medium ${feedbackNearLimit ? "text-amber-800" : "text-gray-700"}`}>
                    Feedback Notes:
                  </span>{" "}
                  <span className={feedbackNearLimit ? "text-amber-700" : "text-gray-600"}>
                    {feedbackLength.toLocaleString()} / {FEEDBACK_MAX_CHARS.toLocaleString()} chars
                  </span>
                  <div className="mt-1 h-1.5 w-full rounded-full bg-gray-200 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${feedbackNearLimit ? "bg-amber-500" : "bg-blue-500"}`}
                      style={{ width: `${feedbackPct}%` }}
                    />
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={openEditFeedback}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 shrink-0"
              >
                <Pencil className="w-3 h-3" />
                Edit
              </button>
            </div>
          )}

          {/* Edit feedback popup */}
          {editFeedbackOpen && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
              onClick={() => !savingEditFeedback && setEditFeedbackOpen(false)}
            >
              <div
                className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 shrink-0">
                  <span className="text-sm font-semibold text-gray-800">Edit Feedback</span>
                  <button
                    type="button"
                    onClick={() => !savingEditFeedback && setEditFeedbackOpen(false)}
                    disabled={savingEditFeedback}
                    className="p-1 text-gray-400 hover:text-gray-700 rounded transition-colors disabled:opacity-50"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex-1 overflow-hidden flex flex-col px-5 py-4 min-h-0">
                  <textarea
                    value={editFeedbackDraft}
                    onChange={(e) => setEditFeedbackDraft(e.target.value)}
                    maxLength={FEEDBACK_MAX_CHARS}
                    placeholder="Your feedback notes..."
                    className="w-full flex-1 min-h-[200px] p-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    disabled={savingEditFeedback}
                  />
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-xs text-gray-500">
                      {editFeedbackDraft.length.toLocaleString()} / {FEEDBACK_MAX_CHARS.toLocaleString()} chars
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => !savingEditFeedback && setEditFeedbackOpen(false)}
                        disabled={savingEditFeedback}
                        className="px-3 py-1.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveEditFeedback}
                        disabled={savingEditFeedback}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                      >
                        {savingEditFeedback ? (
                          <><Loader className="w-3.5 h-3.5 animate-spin" /> Saving...</>
                        ) : (
                          "Save"
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Instruction callout */}
          <div className="flex gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            <Info className="w-4 h-4 mt-0.5 shrink-0 text-blue-500" />
            <p>
              This note will be the default instructions in Edit Draft.
            </p>
          </div>

          {/* Evaluation criteria */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Evaluation criteria{" "}
              <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={criteria}
              onChange={(e) => setCriteria(e.target.value)}
              placeholder="What should this article achieve? Leave blank to use your article goal (main keyword, ICP, offer)."
              className="w-full h-24 p-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              disabled={submitting}
            />
          </div>

          {/* Model selection */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Select AI models to evaluate</p>
            <div className="space-y-2">
              {MODEL_LIST.map((model) => {
                const isSelected = selectedModels.includes(model.id);
                const credits = MODEL_CREDITS[model.id] || 2;
                return (
                  <label
                    key={model.id}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${
                      isSelected
                        ? "border-blue-300 bg-blue-50"
                        : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleModel(model.id)}
                      disabled={submitting}
                      className="w-4 h-4 rounded text-blue-600 border-gray-300 focus:ring-blue-500"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-gray-800">{model.label}</span>
                      <span className="ml-2 text-xs text-gray-400">{model.provider}</span>
                    </div>
                    <CreditCostBadge cost={credits} size="sm" />
                  </label>
                );
              })}
            </div>
            {selectedModels.length === 0 && (
              <p className="mt-2 text-xs text-red-600">Select at least one model to proceed.</p>
            )}
          </div>

          {/* Submit button */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || selectedModels.length === 0}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  Evaluating...
                </>
              ) : (
                "Get Second Opinions"
              )}
              {!submitting && selectedModels.length > 0 && (
                <CreditCostBadge cost={totalCost} size="sm" className="ml-1" />
              )}
            </button>
          </div>

          {/* Submit error */}
          {submitError && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          {/* Model result divs */}
          {hasAnyResults && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Results</h3>
              {MODEL_LIST.filter((m) => modelResults[m.id]).map((model) => {
                const result = modelResults[model.id];
                const warn = overLimitWarning[model.id];
                const isSaving = !!savingFeedback[model.id];

                return (
                  <div
                    key={model.id}
                    className={`rounded-lg border ${result.isStale ? "border-gray-200 opacity-75" : "border-gray-300"} bg-white overflow-hidden`}
                  >
                    {/* Model header */}
                    <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-200">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-800">{model.label}</span>
                        <span className="text-xs text-gray-400">{model.provider}</span>
                        {result.isStale && (
                          <span className="text-xs text-gray-400 italic">(from previous run)</span>
                        )}
                      </div>
                      {result.status === "done" && (
                        <span className="flex items-center gap-1 text-xs text-green-700 font-medium">
                          <CheckCircle className="w-3.5 h-3.5" />
                          Done
                        </span>
                      )}
                      {result.status === "error" && (
                        <span className="flex items-center gap-1 text-xs text-red-600 font-medium">
                          <AlertCircle className="w-3.5 h-3.5" />
                          Failed
                        </span>
                      )}
                      {result.status === "loading" && (
                        <span className="flex items-center gap-1 text-xs text-blue-600 font-medium">
                          <Loader className="w-3.5 h-3.5 animate-spin" />
                          Evaluating...
                        </span>
                      )}
                    </div>

                    {/* Body */}
                    <div className="px-4 py-3">
                      {result.status === "loading" && (
                        <div className="flex items-center gap-2 py-4 text-sm text-gray-500">
                          <Loader className="w-4 h-4 animate-spin text-blue-500" />
                          Waiting for response from {model.label}...
                        </div>
                      )}

                      {result.status === "error" && (
                        <p className="text-sm text-red-600 py-2">{result.error}</p>
                      )}

                      {result.status === "done" && (
                        <>
                          <div
                            className="overflow-y-auto max-h-[200px] prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap text-sm leading-relaxed"
                          >
                            {result.text}
                          </div>
                          <button
                            type="button"
                            onClick={() => setExpandedModel(model.id)}
                            className="mt-2 flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            <Maximize2 className="w-3 h-3" />
                            View full response
                          </button>

                          {/* Over-limit warning */}
                          {warn && (
                            <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                              <p className="font-medium mb-1">Adding this would exceed the 10,000 character limit.</p>
                              <p>
                                Current: {warn.current.toLocaleString()} chars — Adding:{" "}
                                {warn.adding.toLocaleString()} chars — Total:{" "}
                                {warn.total.toLocaleString()} chars.
                              </p>
                              <p className="mt-1">Consider clearing some existing feedback first, or add anyway:</p>
                              <div className="flex gap-2 mt-2">
                                <button
                                  type="button"
                                  onClick={() => handleConfirmOverLimit(model.id, result.text)}
                                  disabled={isSaving}
                                  className="px-3 py-1 bg-amber-600 text-white rounded text-xs font-medium hover:bg-amber-700 disabled:opacity-50"
                                >
                                  {isSaving ? "Saving..." : "Add anyway"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setOverLimitWarning((prev) => { const n = { ...prev }; delete n[model.id]; return n; })}
                                  className="px-3 py-1 border border-amber-300 text-amber-800 rounded text-xs font-medium hover:bg-amber-100"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Add to Feedback button */}
                          {!warn && (
                            <div className="mt-3 pt-3 border-t border-gray-100">
                              {result.addedToFeedback ? (
                                <span className="flex items-center gap-1.5 text-xs text-green-700 font-medium">
                                  <CheckCircle className="w-3.5 h-3.5" />
                                  Added to Feedback
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleAddToFeedback(model.id, result.text)}
                                  disabled={isSaving}
                                  className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                                >
                                  {isSaving ? (
                                    <><Loader className="w-3 h-3 animate-spin" /> Saving...</>
                                  ) : (
                                    <><MessageSquare className="w-3 h-3" /> Add to Feedback</>
                                  )}
                                </button>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Full-response popup */}
          {expandedModel && (() => {
            const expandedModelDef = MODEL_LIST.find((x) => x.id === expandedModel);
            const expandedResult = modelResults[expandedModel];
            return (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
                onClick={() => setExpandedModel(null)}
              >
                <div
                  className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 shrink-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-800">{expandedModelDef?.label}</span>
                      <span className="text-xs text-gray-400">{expandedModelDef?.provider}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setExpandedModel(null)}
                      className="p-1 text-gray-400 hover:text-gray-700 rounded transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="overflow-y-auto px-5 py-4 prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap text-sm leading-relaxed flex-1">
                    {expandedResult?.text}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      );
    },
  },
};

export default getSecondOpinions;

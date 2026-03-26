"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { 
  Sparkles, 
  Loader, 
  ChevronDown,
  ChevronUp,
  X,
  RefreshCw
} from "lucide-react";
import { initMonkey } from "@/libs/monkey";
import { useWritingGuide } from "@/libs/content-magic/context/WritingGuideContext";
import CreditCostBadge from "@/components/CreditCostBadge";

/**
 * @typedef {Object} Prompt
 * @property {string} id
 * @property {string} text - Prompt/question text
 * @property {string} [reason] - Why this prompt matters
 * @property {string} [intentType] - commercial, informational, etc.
 * @property {boolean} included
 * @property {"high" | "low" | "done" | null} priority
 * @property {string} [aiReasoning] - Why AI assigned this priority
 * @property {boolean} dismissed - Temporary hide
 */

/**
 * @typedef {Object} ImplementationSuggestion
 * @property {string} promptId
 * @property {Object} where
 * @property {"existing_section" | "new_section" | "insert_near"} where.location
 * @property {string} [where.targetHeading]
 * @property {string} [where.targetQuote]
 * @property {string} [where.newSectionTitle]
 * @property {string} [where.afterHeading]
 * @property {"insert" | "replace" | "new_section"} how
 * @property {"text" | "paragraph_card" | "cards" | "table" | "list"} [format]
 * @property {"brief" | "explanatory"} [depth]
 * @property {string} instructions
 */

/**
 * @typedef {Object} PromptEvaluation
 * @property {string} promptId
 * @property {boolean} isSufficient
 * @property {string} [feedback]
 */

// Priority configuration
const PRIORITY_CONFIG = {
  high: { label: "High", color: "bg-purple-600 text-white hover:bg-purple-700", icon: "●" },
  low: { label: "Low", color: "bg-gray-300 text-gray-700 hover:bg-gray-400", icon: "○" },
  done: { label: "Done", color: "bg-green-600 text-white hover:bg-green-700", icon: "✓" }
};

/**
 * Effective priority: explicit priority, or "done" when GEO report says sufficient.
 * @param {{ priority?: string | null, text?: string, prompt?: string }} prompt
 * @param {Array<{ prompt: string, score?: number, score0to100?: number, isSufficient?: boolean }>} [geoPrompts]
 * @returns {"high" | "low" | "done" | null}
 */
function getEffectivePriority(prompt, geoPrompts) {
  if (prompt.priority && ["high", "low", "done"].includes(prompt.priority)) {
    return prompt.priority;
  }
  if (!Array.isArray(geoPrompts) || geoPrompts.length === 0) return null;
  const norm = (s) => (s || "").trim().toLowerCase();
  const text = norm(prompt.text || prompt.prompt || "");
  const entry = geoPrompts.find((ge) => norm(ge.prompt) === text);
  if (!entry) return null;
  const sufficient = entry.isSufficient ?? ((entry.score ?? entry.score0to100 ?? 0) >= 70);
  return sufficient ? "done" : null;
}

const implementPrompts = {
  key: "implement_prompts",
  pageType: ["all"],
  meta: {
    label: "Implement Prompts",
    category: "write_optimize",
    description: "Tips from CJ: one good way to implement prompts is pick a section that is appropirate for the prompt, and ask AI to 'make this section better match the prompt'.",
    defaultActive: true,
  },
  DetailsUIDisplayMode: "rightside",

  is_complete: (context) => {
    const completedSteps = context.assets?.completed_steps || [];
    if (completedSteps.includes("implement_prompts")) {
      return true;
    }

    const assets = context.assets || {};
    const prompts = assets.prompts || [];
    const geoPrompts = assets?.GEOReport?.rationale?.prompts;

    if (prompts.length === 0) {
      return false;
    }

    const activePrompts = prompts.filter((p) => p.included !== false && !p.dismissed);
    if (activePrompts.length === 0) {
      return true;
    }

    const unassignedPrompts = activePrompts.filter((p) => getEffectivePriority(p, geoPrompts) === null);
    if (unassignedPrompts.length > 0) {
      return false;
    }

    const highPriorityPrompts = activePrompts.filter((p) => getEffectivePriority(p, geoPrompts) === "high");
    if (highPriorityPrompts.length > 0) {
      return false;
    }

    return true;
  },

  components: {
    ListingUI: ({ rule, context, onExecute }) => {
      const isComplete = rule.is_complete && rule.is_complete(context);
      const prompts = context?.assets?.prompts || [];
      
      const highPriorityCount = prompts.filter(p => 
        p.included !== false && 
        p.priority === "high" &&
        !p.dismissed
      ).length;

      return (
        <div className="flex items-center justify-between p-2 bg-white rounded border border-purple-200 hover:border-purple-400 transition-colors group cursor-pointer">
          <div className="flex-1">
            <span className="text-xs font-medium text-gray-700">
              {isComplete && <span className="text-xs text-green-600 pr-1">✓ </span>}
              {rule.meta.label}
            </span>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onExecute();
            }}
            className="p-1 text-purple-600 hover:bg-purple-50 rounded transition-colors opacity-0 group-hover:opacity-100"
            title="Open Prompt Implementation"
          >
            <Sparkles className="w-4 h-4" />
          </button>
        </div>
      );
    },

    DetailedUI: ({ context, rule }) => {
      const { article, updateArticle, getEditorHtml } = useWritingGuide();
      
      // ========================================
      // STATE MANAGEMENT
      // ========================================
      
      const [expandedPromptId, setExpandedPromptId] = useState(null);
      const [implementationSuggestions, setImplementationSuggestions] = useState({});
      const [refreshingGeoReport, setRefreshingGeoReport] = useState(false);
      const [showLowPriority, setShowLowPriority] = useState(false);
      const [showDone, setShowDone] = useState(false);
      const [dismissedPrompts, setDismissedPrompts] = useState(new Set());
      const [loadingStates, setLoadingStates] = useState({});
      const [flashMessage, setFlashMessage] = useState(null);

      // ========================================
      // LOAD FROM ASSETS
      // ========================================
      
      const assets = context?.assets || article?.assets || {};
      
      // Migrate prompts from old format if needed
      const prompts = useMemo(() => {
        const rawPrompts = assets.prompts || [];
        return rawPrompts.map((p, idx) => {
          // Skip corrupted string entries
          if (typeof p === 'string') {
            if (p === '[object Object]') {
              return null;
            }
            // Convert plain string to prompt object
            return {
              id: `prompt-${idx}`,
              text: p,
              reason: "",
              intentType: "",
              included: true,
              priority: null,
              aiReasoning: null,
              dismissed: false
            };
          }
          
          // Keep ALL original fields and add/override priority-related fields
          return {
            ...p, // Preserve ALL original fields (origin, target, seedKeywords, etc.)
            id: p.id || `prompt-${idx}`,
            text: p.text || p.prompt || "",
            reason: p.reason || "",
            intentType: p.intentType || "",
            included: p.included !== false,
            priority: p.priority || (p.impactTier === "high" ? "high" : null),
            aiReasoning: p.aiReasoning || null,
            dismissed: p.dismissed || false
          };
        }).filter(p => p !== null); // Remove null entries from corrupted prompts
      }, [assets.prompts]);

      // Derive evaluation from GEOReport (single source of truth). 70+ = sufficient.
      const evaluationsFromGeo = useMemo(() => {
        const geoPrompts = article?.assets?.GEOReport?.rationale?.prompts;
        if (!Array.isArray(geoPrompts)) return {};
        const norm = (s) => (s || "").trim().toLowerCase();
        const map = {};
        prompts.forEach(p => {
          const promptText = norm(p.text || p.prompt || "");
          const geoEntry = geoPrompts.find(ge => norm(ge.prompt) === promptText);
          if (!geoEntry) return;
          const score = geoEntry.score ?? geoEntry.score0to100 ?? 0;
          const isSufficient = geoEntry.isSufficient ?? (score >= 70);
          map[p.id] = {
            promptId: p.id,
            isSufficient,
            feedback: isSufficient ? null : (geoEntry.recommendations || geoEntry.comment || null),
          };
        });
        return map;
      }, [article?.assets?.GEOReport?.rationale?.prompts, prompts]);

      useEffect(() => {
        setImplementationSuggestions(assets.implementationSuggestions || {});
        
        // Load dismissed prompts
        const dismissed = new Set();
        prompts.forEach(p => {
          if (p.dismissed) dismissed.add(p.id);
        });
        setDismissedPrompts(dismissed);
      }, [assets.implementationSuggestions, prompts]);

      // ========================================
      // HELPER FUNCTIONS
      // ========================================
      
      const showFlashMessage = useCallback((message, type = "info", duration = 3000) => {
        setFlashMessage({ message, type });
        if (duration > 0) {
          setTimeout(() => setFlashMessage(null), duration);
        }
      }, []);

      const saveToAssets = useCallback(async (updates) => {
        try {
          const monkey = await initMonkey();
          const articleId = context?.id || article?.id;
          const currentAssets = context?.assets || article?.assets || {};
          
          await monkey.articleAssets.savePatch(
            articleId,
            updates,
            currentAssets,
            updateArticle
          );
        } catch (err) {
        }
      }, [context, article, updateArticle]);

      // ========================================
      // CORE FUNCTIONS
      // ========================================
      
      const handlePriorityChange = useCallback(async (promptId, newPriority) => {
        const updatedPrompts = prompts.map(p => {
          if (p.id === promptId) {
            return {
              ...p,
              priority: newPriority,
              aiReasoning: null // Clear AI reasoning when manually changed
            };
          }
          return p;
        });
        
        await saveToAssets({ prompts: updatedPrompts });
        showFlashMessage("Priority updated", "info", 2000);
      }, [prompts, saveToAssets, showFlashMessage]);

      const handleDismiss = useCallback(async (promptId) => {
        const updatedPrompts = prompts.map(p => {
          if (p.id === promptId) {
            return { ...p, dismissed: true };
          }
          return p;
        });
        
        setDismissedPrompts(prev => new Set(prev).add(promptId));
        await saveToAssets({ prompts: updatedPrompts });
        showFlashMessage("Prompt dismissed", "info", 2000);
        setExpandedPromptId(null);
      }, [prompts, saveToAssets, showFlashMessage]);

      const handleSuggestImplementation = useCallback(async (promptId) => {
        const prompt = prompts.find(p => p.id === promptId);
        if (!prompt) return;
        
        setLoadingStates(prev => ({ ...prev, [promptId]: "suggesting" }));
        
        try {
          const articleHtml = getEditorHtml?.() || article?.content_html || "";
          
          const monkey = await initMonkey();
          const text = await monkey.apiCall("/api/content-magic/prompts/suggest-implementation", {
            promptId,
            prompt,
            article: { content_html: articleHtml }
          });
          const data = JSON.parse(text);
          if (data.error) throw new Error(data.error || "Failed to suggest implementation");
          const suggestion = data.suggestion;
          
          const newSuggestions = { ...implementationSuggestions, [promptId]: suggestion };
          setImplementationSuggestions(newSuggestions);
          await saveToAssets({ implementationSuggestions: newSuggestions });
          
          showFlashMessage("Implementation suggestion ready", "success");
        } catch (error) {
          showFlashMessage(`Failed: ${error.message}`, "error");
        } finally {
          setLoadingStates(prev => ({ ...prev, [promptId]: null }));
        }
      }, [prompts, getEditorHtml, article, implementationSuggestions, saveToAssets, showFlashMessage]);

      const handleRefreshGeoReport = useCallback(async () => {
        const articleId = context?.id || article?.id;
        if (!articleId) {
          showFlashMessage("Article not found", "error");
          return;
        }
        setRefreshingGeoReport(true);
        try {
          const articleHtml = getEditorHtml?.() || article?.content_html || "";
          const monkey = await initMonkey();
          const result = await monkey.articleAssets.refreshGeoReport(articleId, articleHtml);
          const meta = result.rationale?.evaluationMetadata;
          const updatedAssets = {
            ...(article?.assets || context?.assets || {}),
            GEOReport: {
              score: result.score,
              rationale: result.rationale,
              generatedAt: new Date().toISOString(),
              promptsEvaluated: result.rationale?.prompts?.length || 0,
              evaluationMetadata: meta ? { ...meta } : null,
            },
          };
          updateArticle({ assets: updatedAssets });

          if (result.suggestions && result.suggestions.length > 0) {
            const updatedPrompts = prompts.map((p) => {
              const suggestion = result.suggestions.find((s) => s.promptId === p.id);
              if (suggestion) {
                return { ...p, priority: suggestion.priority, aiReasoning: suggestion.reasoning };
              }
              return p;
            });
            await saveToAssets({ prompts: updatedPrompts });
          }

          showFlashMessage(
            result.suggestions?.length ? "GEO report and priorities updated" : "GEO report updated",
            "success"
          );
        } catch (error) {
          showFlashMessage(`Failed: ${error.message}`, "error");
        } finally {
          setRefreshingGeoReport(false);
        }
      }, [context, article, getEditorHtml, updateArticle, showFlashMessage, prompts, saveToAssets]);

      // ========================================
      // RENDER FUNCTIONS
      // ========================================
      
      const renderHeader = () => (
        <div className="px-4 py-3 bg-gradient-to-r from-purple-50 to-blue-50 border-b border-gray-200">
          <div className="flex gap-2">
            <button
              onClick={handleRefreshGeoReport}
              disabled={refreshingGeoReport}
              className="flex-1 px-3 py-2 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              title="Refresh GEO report and update priority suggestions"
            >
              {refreshingGeoReport ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  Refreshing...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Refresh GEO report
                  <CreditCostBadge path="/api/content-magic/ai-optimization-score" size="sm" />
                </>
              )}
            </button>
          </div>
          {prompts.some((p) => p.priority) && (
            <div className="mt-2 text-[10px] text-gray-500 italic">
              Priorities are suggested from the GEO evaluation. Adjust freely.
            </div>
          )}
        </div>
      );

      const renderPrioritySelector = (prompt) => (
        <div className="flex gap-2 mb-3">
          {Object.entries(PRIORITY_CONFIG).map(([key, config]) => (
            <button
              key={key}
              onClick={() => handlePriorityChange(prompt.id, key)}
              className={`flex-1 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                prompt.priority === key
                  ? config.color
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {config.label}
            </button>
          ))}
        </div>
      );

      const renderImplementationSuggestion = (suggestion) => (
        <div className="mt-3 border border-purple-200 rounded-lg p-3 bg-purple-50">
          <div className="text-xs font-semibold text-purple-900 mb-2">Suggested Implementation</div>
          <div className="space-y-2 text-xs text-gray-700">
            <div>
              <span className="font-semibold">Where:</span>{" "}
              {suggestion.where.location === "existing_section" && suggestion.where.targetHeading && (
                `Add to "${suggestion.where.targetHeading}"`
              )}
              {suggestion.where.location === "new_section" && (
                <>
                  {suggestion.where.newSectionTitle && `Create new section "${suggestion.where.newSectionTitle}"`}
                  {suggestion.where.afterHeading && ` after "${suggestion.where.afterHeading}"`}
                  {!suggestion.where.afterHeading && suggestion.where.newSectionTitle && ` (placement not specified)`}
                </>
              )}
              {suggestion.where.location === "insert_near" && suggestion.where.targetQuote && (
                `Near: "${suggestion.where.targetQuote.substring(0, 50)}..."`
              )}
            </div>
            <div>
              <span className="font-semibold">How:</span> {suggestion.how}
            </div>
            {suggestion.format && (
              <div>
                <span className="font-semibold">Format:</span> {suggestion.format}
              </div>
            )}
            {suggestion.depth && (
              <div>
                <span className="font-semibold">Depth:</span> {suggestion.depth}
              </div>
            )}
            <div className="pt-2 border-t border-purple-300">
              <span className="font-semibold">Instructions:</span>
              <p className="mt-1 text-gray-800">{suggestion.instructions}</p>
            </div>
          </div>
        </div>
      );

      const renderEvaluationFeedback = (evaluation) => (
        <div className={`mt-3 border rounded-lg p-3 ${
          evaluation.isSufficient 
            ? "border-green-200 bg-green-50" 
            : "border-yellow-200 bg-yellow-50"
        }`}>
          <div className={`text-xs font-semibold mb-2 ${evaluation.isSufficient ? "text-green-900" : "text-yellow-900"}`}>
            Evaluation (from GEO report)
          </div>
          {evaluation.isSufficient ? (
            <div className="text-xs text-green-700">
              <div className="font-medium mb-1">✓ Sufficiently answered</div>
              <div className="text-[10px]">Consider marking this prompt as Done.</div>
            </div>
          ) : (
            <div className="text-xs text-yellow-700">
              <div className="font-medium mb-1">Needs improvement</div>
              <p className="text-[10px] mt-1">{evaluation.feedback}</p>
            </div>
          )}
        </div>
      );

      const renderPromptCard = (prompt) => {
        const isExpanded = expandedPromptId === prompt.id;
        const suggestion = implementationSuggestions[prompt.id];
        const evaluation = evaluationsFromGeo[prompt.id];
        const loading = loadingStates[prompt.id];
        
        return (
          <div key={prompt.id} className="border border-gray-200 rounded-lg bg-white hover:border-purple-300 transition-colors">
            {/* Header */}
            <div 
              className="p-3 cursor-pointer flex items-center justify-between"
              onClick={() => setExpandedPromptId(isExpanded ? null : prompt.id)}
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900">{prompt.text}</div>
                {prompt.reason && !isExpanded && (
                  <div className="mt-1 text-[10px] text-gray-500 truncate">
                    {prompt.reason}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                {!isExpanded && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDismiss(prompt.id);
                    }}
                    className="p-1 hover:bg-gray-100 rounded transition-colors"
                    title="Dismiss for now"
                  >
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                )}
                <div className={`transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                </div>
              </div>
            </div>
            
            {/* Expanded content */}
            {isExpanded && (
              <div className="px-3 pb-3 border-t border-gray-200">
                {/* Prompt Details */}
                {(prompt.reason || prompt.intentType) && (
                  <div className="mt-3 p-2 bg-gray-50 rounded text-xs text-gray-700 border border-gray-200">
                    {prompt.reason && (
                      <div><span className="font-semibold">Reason:</span> {prompt.reason}</div>
                    )}
                    {prompt.intentType && (
                      <div className="mt-1"><span className="font-semibold">Intent:</span> {prompt.intentType}</div>
                    )}
                  </div>
                )}
                
                {/* AI Reasoning */}
                {prompt.aiReasoning && (
                  <div className="mt-3 p-2 bg-blue-50 rounded text-xs text-blue-800 border border-blue-200">
                    <span className="font-semibold">AI Reasoning:</span> {prompt.aiReasoning}
                  </div>
                )}
                
                {/* Priority Selector */}
                <div className="mt-3">
                  {renderPrioritySelector(prompt)}
                </div>
                
                {/* Action Buttons */}
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => handleSuggestImplementation(prompt.id)}
                    disabled={loading === "suggesting"}
                    className="flex-1 px-3 py-2 bg-purple-600 text-white text-xs font-medium rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                  >
                    {loading === "suggesting" ? (
                      <>
                        <Loader className="w-3 h-3 animate-spin" />
                        Suggesting...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3 h-3" />
                        Suggest implementation
                        <CreditCostBadge path="/api/content-magic/prompts/suggest-implementation" size="sm" />
                      </>
                    )}
                  </button>
                </div>
                
                {/* Implementation Suggestion */}
                {suggestion && renderImplementationSuggestion(suggestion)}
                
                {/* Evaluation Feedback (from GEO report; 70+ = sufficient) */}
                {evaluation ? (
                  renderEvaluationFeedback(evaluation)
                ) : (
                  <div className="mt-3 p-3 border border-gray-200 rounded-lg bg-gray-50 text-xs text-gray-600">
                    Refresh GEO report to see evaluation.
                  </div>
                )}
                
                {/* Dismiss Button */}
                <button
                  onClick={() => handleDismiss(prompt.id)}
                  className="mt-3 w-full px-3 py-1.5 bg-gray-100 text-gray-600 text-xs font-medium rounded hover:bg-gray-200 transition-colors"
                >
                  Dismiss for now
                </button>
              </div>
            )}
          </div>
        );
      };

      const renderPromptGroups = () => {
        const visiblePrompts = prompts.filter((p) => p.included !== false && !dismissedPrompts.has(p.id));
        const geoPrompts = article?.assets?.GEOReport?.rationale?.prompts;

        const highPriority = visiblePrompts.filter((p) => getEffectivePriority(p, geoPrompts) === "high");
        const lowPriority = visiblePrompts.filter((p) => getEffectivePriority(p, geoPrompts) === "low");
        const done = visiblePrompts.filter((p) => getEffectivePriority(p, geoPrompts) === "done");
        const noPriority = visiblePrompts.filter((p) => getEffectivePriority(p, geoPrompts) === null);
        
        return (
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {/* No priority / Unassigned */}
            {noPriority.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-gray-600 mb-2 px-1">
                  UNASSIGNED ({noPriority.length})
                </div>
                <div className="space-y-2">
                  {noPriority.map(prompt => renderPromptCard(prompt))}
                </div>
              </div>
            )}
            
            {/* High Priority */}
            {highPriority.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-purple-700 mb-2 px-1">
                  HIGH PRIORITY ({highPriority.length})
                </div>
                <div className="space-y-2">
                  {highPriority.map(prompt => renderPromptCard(prompt))}
                </div>
              </div>
            )}

            {/* Congrats when step is complete (same criteria as is_complete) */}
            {rule && rule.is_complete && rule.is_complete(context) && (
              <div className="mx-1 mb-3 p-3 rounded-lg bg-green-50 border border-green-200">
                <div className="text-sm font-semibold text-green-800">All high-priority prompts are done</div>
                <div className="text-xs text-green-700 mt-1">You can move on to the next step.</div>
              </div>
            )}
            
            {/* Low Priority (Collapsible) */}
            {lowPriority.length > 0 && (
              <div>
                <button
                  onClick={() => setShowLowPriority(!showLowPriority)}
                  className="w-full text-left px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded transition-colors flex items-center justify-between"
                >
                  <span className="text-xs font-semibold text-gray-700">
                    {showLowPriority ? "▼" : "▶"} Show Low-priority prompts ({lowPriority.length})
                  </span>
                </button>
                {showLowPriority && (
                  <div className="mt-2 space-y-2">
                    {lowPriority.map(prompt => renderPromptCard(prompt))}
                  </div>
                )}
              </div>
            )}
            
            {/* Done (Collapsible) */}
            {done.length > 0 && (
              <div>
                <button
                  onClick={() => setShowDone(!showDone)}
                  className="w-full text-left px-3 py-2 bg-green-50 hover:bg-green-100 rounded transition-colors flex items-center justify-between"
                >
                  <span className="text-xs font-semibold text-green-700">
                    {showDone ? "▼" : "▶"} Show Done prompts ({done.length})
                  </span>
                </button>
                {showDone && (
                  <div className="mt-2 space-y-2">
                    {done.map(prompt => renderPromptCard(prompt))}
                  </div>
                )}
              </div>
            )}
            
            {/* Empty State */}
            {visiblePrompts.length === 0 && (
              <div className="text-center py-12 text-sm text-gray-500">
                <div className="text-4xl mb-2">❓</div>
                <div>No prompts available yet.</div>
                <div className="text-xs mt-1">Run the "Research Prompts" step to generate prompts.</div>
              </div>
            )}
          </div>
        );
      };

      // ========================================
      // MAIN RENDER
      // ========================================
      
      return (
        <div className="flex flex-col h-full bg-gray-50">
          {/* Flash Message */}
          {flashMessage && (
            <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-[80] px-4 py-2 rounded-lg shadow-lg ${
              flashMessage.type === "error" ? "bg-red-100 text-red-800 border border-red-300" :
              flashMessage.type === "success" ? "bg-green-100 text-green-800 border border-green-300" :
              "bg-blue-100 text-blue-800 border border-blue-300"
            }`}>
              <div className="text-xs font-medium">{flashMessage.message}</div>
            </div>
          )}
          
          {/* Header */}
          {renderHeader()}
          
          {/* Prompt Groups */}
          {renderPromptGroups()}
        </div>
      );
    },
  },
};

export default implementPrompts;

"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { 
  Sparkles, 
  Loader, 
  ChevronDown,
  ChevronUp,
  X
} from "lucide-react";
import { initMonkey } from "@/libs/monkey";
import CreditCostBadge from "@/components/CreditCostBadge";
import { useWritingGuide } from "@/libs/content-magic/context/WritingGuideContext";

/**
 * @typedef {Object} Topic
 * @property {string} id
 * @property {string} label - Topic title
 * @property {string} [topic] - Alternative field
 * @property {string[]} sourceUrls
 * @property {string} exampleText
 * @property {string} [strategy]
 * @property {boolean} included
 * @property {"high" | "low" | "done" | null} priority
 * @property {string} [aiReasoning] - Why AI assigned this priority
 * @property {boolean} dismissed - Temporary hide
 */

/**
 * @typedef {Object} ImplementationSuggestion
 * @property {string} topicId
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
 * @typedef {Object} TopicEvaluation
 * @property {string} topicId
 * @property {boolean} isSufficient
 * @property {string} [feedback]
 */

// Priority configuration
const PRIORITY_CONFIG = {
  high: { label: "High", color: "bg-purple-600 text-white hover:bg-purple-700", icon: "●" },
  low: { label: "Low", color: "bg-gray-300 text-gray-700 hover:bg-gray-400", icon: "○" },
  done: { label: "Done", color: "bg-green-600 text-white hover:bg-green-700", icon: "✓" }
};

const implementTopics = {
  key: "implement_topics",
  pageType: ["all"],
  meta: {
    label: "Implement Topics",
    category: "write_optimize",
    description: "Recommended for highly competitive keywords; you may skip this step if your target keywords have low competition.",
    defaultActive: true,
  },
  DetailsUIDisplayMode: "rightside",

  is_complete: (context) => {
    const completedSteps = context.assets?.completed_steps || [];
    if (completedSteps.includes("implement_topics")) {
      return true;
    }
    
    const assets = context.assets || {};
    const topics = assets.topics || [];
    
    // If no topics exist at all, not complete (need to research first)
    if (topics.length === 0) {
      return false;
    }
    
    // Get all active topics (included and not dismissed)
    const activeTopics = topics.filter(t => 
      t.included !== false && 
      !t.dismissed
    );
    
    if (activeTopics.length === 0) {
      return true; // All topics dismissed, consider complete
    }
    
    // Check 1: No unassigned topics (all must have a priority: high, low, or done)
    const unassignedTopics = activeTopics.filter(t => !t.priority || t.priority === null);
    if (unassignedTopics.length > 0) {
      return false; // Still have unassigned topics
    }
    
    // Check 2: No high priority topics remaining (all high priority must be marked as done)
    const highPriorityTopics = activeTopics.filter(t => t.priority === "high");
    if (highPriorityTopics.length > 0) {
      return false; // Still have high priority topics that need to be completed
    }
    
    return true; // All topics assigned (no unassigned) and no high priority remaining
  },

  components: {
    ListingUI: ({ rule, context, onExecute }) => {
      const isComplete = rule.is_complete && rule.is_complete(context);
      const topics = context?.assets?.topics || [];
      
      const highPriorityCount = topics.filter(t => 
        t.included !== false && 
        t.priority === "high" &&
        !t.dismissed
      ).length;

      return (
        <div className="flex items-center justify-between p-2 bg-white rounded border border-purple-200 hover:border-purple-400 transition-colors group cursor-pointer">
          <div className="flex-1">
            <span className="text-xs font-medium text-gray-700">
              {isComplete && <span className="text-xs text-green-600 pr-1">✓ </span>}
              {rule.meta.label}
            </span>
            {/* {highPriorityCount > 0 && (
              <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">
                {highPriorityCount} high priority
              </span>
            )} */}
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onExecute();
            }}
            className="p-1 text-purple-600 hover:bg-purple-50 rounded transition-colors opacity-0 group-hover:opacity-100"
            title="Open Topic Implementation"
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
      
      const [expandedTopicId, setExpandedTopicId] = useState(null);
      const [implementationSuggestions, setImplementationSuggestions] = useState({});
      const [topicEvaluations, setTopicEvaluations] = useState({});
      const [showLowPriority, setShowLowPriority] = useState(false);
      const [showDone, setShowDone] = useState(false);
      const [dismissedTopics, setDismissedTopics] = useState(new Set());
      const [loadingStates, setLoadingStates] = useState({});
      const [flashMessage, setFlashMessage] = useState(null);
      const [suggestingPriorities, setSuggestingPriorities] = useState(false);

      // ========================================
      // LOAD FROM ASSETS
      // ========================================
      
      const assets = context?.assets || article?.assets || {};
      
      // Migrate topics from old format if needed
      const topics = useMemo(() => {
        const rawTopics = assets.topics || [];
        return rawTopics.map((t, idx) => {
          // Skip corrupted string entries
          if (typeof t === 'string') {
            if (t === '[object Object]') {
              return null;
            }
            // Convert plain string to topic object
            return {
              id: `topic-${idx}`,
              label: t,
              topic: t,
              sourceUrls: [],
              exampleText: "",
              strategy: "",
              included: true,
              priority: null,
              aiReasoning: null,
              dismissed: false
            };
          }
          
          // Keep ALL original fields and add/override priority-related fields
          return {
            ...t, // Preserve ALL original fields
            id: t.id || `topic-${idx}`,
            label: t.label || t.topic || "",
            topic: t.topic || t.label || "",
            sourceUrls: t.sourceUrls || (t.sourceUrl ? [t.sourceUrl] : []),
            exampleText: t.exampleText || t.example_text || "",
            strategy: t.strategy || "",
            included: t.included !== false,
            priority: t.priority || null,
            aiReasoning: t.aiReasoning || null,
            dismissed: t.dismissed || false
          };
        }).filter(t => t !== null); // Remove null entries from corrupted topics
      }, [assets.topics]);

      useEffect(() => {
        setImplementationSuggestions(assets.implementationSuggestions || {});
        setTopicEvaluations(assets.topicEvaluations || {});
        
        // Load dismissed topics
        const dismissed = new Set();
        topics.forEach(t => {
          if (t.dismissed) dismissed.add(t.id);
        });
        setDismissedTopics(dismissed);
      }, [assets.implementationSuggestions, assets.topicEvaluations, topics]);

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
      
      const handleSuggestPriorities = useCallback(async () => {
        setSuggestingPriorities(true);
        setLoadingStates({});
        
        try {
          const articleHtml = getEditorHtml?.() || article?.content_html || "";
          
          if (!articleHtml || articleHtml.trim().length < 100) {
            throw new Error("Article content is too short. Please add more content first.");
          }
          
          const monkey = await initMonkey();
          const text = await monkey.apiCall("/api/content-magic/topics/suggest-priorities", {
            topics: topics.filter(t => t.included !== false && !t.dismissed),
            article: {
              content_html: articleHtml,
              title: article?.title || ""
            },
            campaignContext: {
              icp: assets.icp || assets.icpData || null,
              offer: assets.offer || null
            }
          });
          const data = JSON.parse(text);
          if (data.error) throw new Error(data.error || "Failed to suggest priorities");
          const suggestions = data.suggestions || [];
          
          // Update topics with suggested priorities
          const updatedTopics = topics.map(t => {
            const suggestion = suggestions.find(s => s.topicId === t.id);
            if (suggestion) {
              return {
                ...t,
                priority: suggestion.priority,
                aiReasoning: suggestion.reasoning
              };
            }
            return t;
          });
          
          await saveToAssets({ topics: updatedTopics });
          showFlashMessage("Priorities suggested! You can adjust them freely.", "success");
        } catch (error) {
          showFlashMessage(`Failed to suggest priorities: ${error.message}`, "error");
        } finally {
          setSuggestingPriorities(false);
        }
      }, [topics, getEditorHtml, article, assets, saveToAssets, showFlashMessage]);

      const handlePriorityChange = useCallback(async (topicId, newPriority) => {
        const updatedTopics = topics.map(t => {
          if (t.id === topicId) {
            return {
              ...t,
              priority: newPriority,
              aiReasoning: null // Clear AI reasoning when manually changed
            };
          }
          return t;
        });
        
        await saveToAssets({ topics: updatedTopics });
        showFlashMessage("Priority updated", "info", 2000);
      }, [topics, saveToAssets, showFlashMessage]);

      const handleDismiss = useCallback(async (topicId) => {
        const updatedTopics = topics.map(t => {
          if (t.id === topicId) {
            return { ...t, dismissed: true };
          }
          return t;
        });
        
        setDismissedTopics(prev => new Set(prev).add(topicId));
        await saveToAssets({ topics: updatedTopics });
        showFlashMessage("Topic dismissed", "info", 2000);
        setExpandedTopicId(null);
      }, [topics, saveToAssets, showFlashMessage]);

      const handleSuggestImplementation = useCallback(async (topicId) => {
        const topic = topics.find(t => t.id === topicId);
        if (!topic) return;
        
        setLoadingStates(prev => ({ ...prev, [topicId]: "suggesting" }));
        
        try {
          const articleHtml = getEditorHtml?.() || article?.content_html || "";
          
          const monkey = await initMonkey();
          const text = await monkey.apiCall("/api/content-magic/topics/suggest-implementation", {
            topicId,
            topic,
            article: { content_html: articleHtml }
          });
          const data = JSON.parse(text);
          if (data.error) throw new Error(data.error || "Failed to suggest implementation");
          const suggestion = data.suggestion;
          
          const newSuggestions = { ...implementationSuggestions, [topicId]: suggestion };
          setImplementationSuggestions(newSuggestions);
          await saveToAssets({ implementationSuggestions: newSuggestions });
          
          showFlashMessage("Implementation suggestion ready", "success");
        } catch (error) {
          showFlashMessage(`Failed: ${error.message}`, "error");
        } finally {
          setLoadingStates(prev => ({ ...prev, [topicId]: null }));
        }
      }, [topics, getEditorHtml, article, implementationSuggestions, saveToAssets, showFlashMessage]);

      const handleEvaluate = useCallback(async (topicId) => {
        const topic = topics.find(t => t.id === topicId);
        if (!topic) return;
        
        setLoadingStates(prev => ({ ...prev, [topicId]: "evaluating" }));
        
        try {
          const articleHtml = getEditorHtml?.() || article?.content_html || "";
          
          const monkey = await initMonkey();
          const text = await monkey.apiCall("/api/content-magic/topics/evaluate-topic", {
            topicId,
            topic,
            article: { content_html: articleHtml }
          });
          const data = JSON.parse(text);
          if (data.error) throw new Error(data.error || "Failed to evaluate topic");
          const evaluation = data.evaluation;
          
          const newEvaluations = { ...topicEvaluations, [topicId]: evaluation };
          setTopicEvaluations(newEvaluations);
          await saveToAssets({ topicEvaluations: newEvaluations });
          
          showFlashMessage("Evaluation complete", "success");
        } catch (error) {
          showFlashMessage(`Failed: ${error.message}`, "error");
        } finally {
          setLoadingStates(prev => ({ ...prev, [topicId]: null }));
        }
      }, [topics, getEditorHtml, article, topicEvaluations, saveToAssets, showFlashMessage]);

      // ========================================
      // RENDER FUNCTIONS
      // ========================================
      
      const renderHeader = () => (
        <div className="px-4 py-3 bg-gradient-to-r from-purple-50 to-blue-50 border-b border-gray-200">
          <button
            onClick={handleSuggestPriorities}
            disabled={suggestingPriorities}
            className="w-full px-3 py-2 bg-purple-600 text-white text-xs font-medium rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {suggestingPriorities ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                Suggesting priorities...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Suggest priorities (you can adjust)</span>
                <CreditCostBadge
                  path="/api/content-magic/topics/suggest-priorities"
                  size="sm"
                />
              </>
            )}
          </button>
          {!suggestingPriorities && topics.some(t => t.priority) && (
            <div className="mt-2 text-[10px] text-gray-500 italic">
              These priorities are suggestions based on similar pages and your ICP. Adjust freely.
            </div>
          )}
        </div>
      );

      const renderPrioritySelector = (topic) => (
        <div className="flex gap-2 mb-3">
          {Object.entries(PRIORITY_CONFIG).map(([key, config]) => (
            <button
              key={key}
              onClick={() => handlePriorityChange(topic.id, key)}
              className={`flex-1 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                topic.priority === key
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
          <div className="text-xs font-semibold mb-2 ${evaluation.isSufficient ? 'text-green-900' : 'text-yellow-900'}">
            Evaluation
          </div>
          {evaluation.isSufficient ? (
            <div className="text-xs text-green-700">
              <div className="font-medium mb-1">✓ Sufficiently covered</div>
              <div className="text-[10px]">Consider marking this topic as Done.</div>
            </div>
          ) : (
            <div className="text-xs text-yellow-700">
              <div className="font-medium mb-1">Needs improvement</div>
              <p className="text-[10px] mt-1">{evaluation.feedback}</p>
            </div>
          )}
        </div>
      );

      const renderTopicCard = (topic) => {
        const isExpanded = expandedTopicId === topic.id;
        const suggestion = implementationSuggestions[topic.id];
        const evaluation = topicEvaluations[topic.id];
        const loading = loadingStates[topic.id];
        
        return (
          <div key={topic.id} className="border border-gray-200 rounded-lg bg-white hover:border-purple-300 transition-colors">
            {/* Header */}
            <div 
              className="p-3 cursor-pointer flex items-center justify-between"
              onClick={() => setExpandedTopicId(isExpanded ? null : topic.id)}
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900">{topic.label}</div>
                {/* {topic.priority && (
                  <div className="mt-1">
                    <span className={`text-[10px] px-2 py-0.5 rounded ${PRIORITY_CONFIG[topic.priority]?.color || 'bg-gray-100 text-gray-600'}`}>
                      {PRIORITY_CONFIG[topic.priority]?.icon} {PRIORITY_CONFIG[topic.priority]?.label}
                    </span>
                  </div>
                )} */}
              </div>
              <div className="flex items-center gap-2">
                {!isExpanded && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDismiss(topic.id);
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
                {/* AI Reasoning */}
                {topic.aiReasoning && (
                  <div className="mt-3 p-2 bg-blue-50 rounded text-xs text-blue-800 border border-blue-200">
                    <span className="font-semibold">AI Reasoning:</span> {topic.aiReasoning}
                  </div>
                )}
                
                {/* Priority Selector */}
                <div className="mt-3">
                  {renderPrioritySelector(topic)}
                </div>
                
                {/* Action Buttons */}
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => handleSuggestImplementation(topic.id)}
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
                        <CreditCostBadge path="/api/content-magic/topics/suggest-implementation" size="sm" />
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => handleEvaluate(topic.id)}
                    disabled={loading === "evaluating"}
                    className="flex-1 px-3 py-2 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                  >
                    {loading === "evaluating" ? (
                      <>
                        <Loader className="w-3 h-3 animate-spin" />
                        Evaluating...
                      </>
                    ) : (
                      <>
                        Evaluate implementation
                        <CreditCostBadge path="/api/content-magic/topics/evaluate-topic" size="sm" />
                      </>
                    )}
                  </button>
                </div>
                
                {/* Implementation Suggestion */}
                {suggestion && renderImplementationSuggestion(suggestion)}
                
                {/* Evaluation Feedback */}
                {evaluation && renderEvaluationFeedback(evaluation)}
                
                {/* Dismiss Button */}
                <button
                  onClick={() => handleDismiss(topic.id)}
                  className="mt-3 w-full px-3 py-1.5 bg-gray-100 text-gray-600 text-xs font-medium rounded hover:bg-gray-200 transition-colors"
                >
                  Dismiss for now
                </button>
              </div>
            )}
          </div>
        );
      };

      const renderTopicGroups = () => {
        const visibleTopics = topics.filter(t => t.included !== false && !dismissedTopics.has(t.id));
        
        const highPriority = visibleTopics.filter(t => t.priority === "high");
        const lowPriority = visibleTopics.filter(t => t.priority === "low");
        const done = visibleTopics.filter(t => t.priority === "done");
        const noPriority = visibleTopics.filter(t => !t.priority || (t.priority !== "high" && t.priority !== "low" && t.priority !== "done"));
        
        return (
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {/* No priority / Unassigned */}
            {noPriority.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-gray-600 mb-2 px-1">
                  UNASSIGNED ({noPriority.length})
                </div>
                <div className="space-y-2">
                  {noPriority.map(topic => renderTopicCard(topic))}
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
                  {highPriority.map(topic => renderTopicCard(topic))}
                </div>
              </div>
            )}

            {/* Congrats when step is complete (same criteria as is_complete) */}
            {rule && rule.is_complete && rule.is_complete(context) && (
              <div className="mx-1 mb-3 p-3 rounded-lg bg-green-50 border border-green-200">
                <div className="text-sm font-semibold text-green-800">All high-priority topics are done</div>
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
                    {showLowPriority ? "▼" : "▶"} Show Low-priority topics ({lowPriority.length})
                  </span>
                </button>
                {showLowPriority && (
                  <div className="mt-2 space-y-2">
                    {lowPriority.map(topic => renderTopicCard(topic))}
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
                    {showDone ? "▼" : "▶"} Show Done topics ({done.length})
                  </span>
                </button>
                {showDone && (
                  <div className="mt-2 space-y-2">
                    {done.map(topic => renderTopicCard(topic))}
                  </div>
                )}
              </div>
            )}
            
            {/* Empty State */}
            {visibleTopics.length === 0 && (
              <div className="text-center py-12 text-sm text-gray-500">
                <div className="text-4xl mb-2">📋</div>
                <div>No topics available yet.</div>
                <div className="text-xs mt-1">Run the "Benchmark Competitors" step to extract topics.</div>
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
          
          {/* Topic Groups */}
          {renderTopicGroups()}
        </div>
      );
    },
  },
};

export default implementTopics;

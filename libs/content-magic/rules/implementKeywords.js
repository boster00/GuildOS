"use client";

import React, { useEffect, useState, useRef, useMemo } from "react";
import { Sparkles, Loader, X, RefreshCw, Trash2 } from "lucide-react";
import { useWritingGuide } from "@/libs/content-magic/context/WritingGuideContext";
import { calculateKeywordRequirements, normalizeText, countOccurrences, calculateSeoScore } from "@/libs/content-magic/utils/calculateSeoScore";
import { initMonkey } from "@/libs/monkey";
import CreditCostBadge from "@/components/CreditCostBadge";

const implementKeywords = {
  key: "implement_keywords",
  pageType: ["all"],
  meta: {
    label: "Implement Keywords",
    category: "write_optimize",
    description: "Place keywords naturally throughout your article to meet target occurrences.",
    defaultActive: true,
    tutorialTitle: "CJGEO Tutorial 8: Optimizing SEO and AI Content Implementation Steps",
    tutorialURL: "https://www.loom.com/share/6b331ac0f0b64eeaa207d4dbe117b6b4",
  },
  DetailsUIDisplayMode: "rightside",

  is_complete: (context) => {
    const completedSteps = context.assets?.completed_steps || [];
    if (completedSteps.includes("implement_keywords")) {
      return true;
    }
    
    const assets = context.assets || {};
    const keywords = assets.keywords || [];
    const competitorPages = assets.competitorPages || [];
    const articleContent = context.content_html || '';
    
    // If we don't have the required data to calculate SEO score, return false
    if (keywords.length === 0 || competitorPages.length === 0 || !articleContent) {
      return false;
    }
    
    // Calculate SEO score
    const seoScoreResult = calculateSeoScore({
      keywords,
      competitorPages,
      articleContent,
    });
    
    // Done criteria: SEO score achieving 60+
    const seoScore = seoScoreResult?.score;
    if (seoScore !== null && seoScore !== undefined) {
      return seoScore >= 60;
    }
    
    // Fallback: if score calculation failed, check if all keywords are excluded
    return keywords.filter(k => k.included !== false).length === 0;
  },

  components: {
    ListingUI: ({ rule, context, onExecute }) => {
      const isComplete = rule.is_complete && rule.is_complete(context);

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
            title="Open Keyword Placement"
          >
            <Sparkles className="w-4 h-4" />
          </button>
        </div>
      );
    },

    DetailedUI: ({ context, rule }) => {
      const { article, updateArticle, editorRef, getEditorHtml } = useWritingGuide();
      
      // State
      const [keywords, setKeywords] = useState([]);
      const [suggestions, setSuggestions] = useState({});
      const [loading, setLoading] = useState(false);
      const [flashMessage, setFlashMessage] = useState(null);
      const [expandedKeywords, setExpandedKeywords] = useState(new Set());
      const [showDoneKeywords, setShowDoneKeywords] = useState(false);
      // Track locally applied suggestions (Set of suggestion IDs)
      const [appliedSuggestions, setAppliedSuggestions] = useState(new Set());
      // Track suggestion IDs skipped by Implement All (in headers) so we can show a note on cards
      const [skippedByImplementAll, setSkippedByImplementAll] = useState(new Set());
      
      // Ref for debouncing keyword status refresh
      const refreshTimerRef = useRef(null);

      // Flash message helper
      const showFlashMessage = (message, type = "info", duration = 3000) => {
        setFlashMessage({ message, type });
        setTimeout(() => setFlashMessage(null), duration);
      };

      // Helper to calculate individual competitor counts
      const calculateCompetitorCounts = (keyword, competitorPages) => {
        return competitorPages.map(page => {
          const normalizedContent = normalizeText(page.content || '');
          return countOccurrences(keyword, normalizedContent);
        });
      };

      // Count occurrences with partial matching (substring matching)
      const countOccurrencesPartial = (keyword, text) => {
        if (!keyword || !text) return 0;
        const normalizedKeyword = keyword.toLowerCase().trim();
        const normalizedText = normalizeText(text);
        if (!normalizedKeyword || !normalizedText) return 0;
        
        // Count substring matches (case-insensitive)
        const escapedKeyword = normalizedKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(escapedKeyword, 'gi');
        const matches = normalizedText.match(regex);
        return matches ? matches.length : 0;
      };

      // Refresh keyword status
      const refreshKeywordStatus = async () => {
        try {
          // 1. Get keywords from assets (standard array structure)
          const keywordsArray = context?.assets?.keywords || article?.assets?.keywords || [];
          
          // 2. Filter only included keywords
          const includedKeywords = keywordsArray.filter(kw => kw.included !== false);
          
          if (includedKeywords.length === 0) {
            setKeywords([]);
            return [];
          }
          
          // 3. Get article HTML for counting
          const articleHtml = getEditorHtml ? getEditorHtml() : editorRef.current?.innerHTML || '';
          
          // 4. Get competitor pages from assets
          const competitorPages = context?.assets?.competitorPages || article?.assets?.competitorPages || [];
          
          // 5. Sort keywords by length descending (longest first)
          const sortedKeywords = [...includedKeywords].sort((a, b) => {
            const textA = (a.keyword_text || a.keyword || '').length;
            const textB = (b.keyword_text || b.keyword || '').length;
            return textB - textA;
          });
          
          // 6. Use calculateKeywordRequirements from utils (with sorted keywords)
          const requirements = calculateKeywordRequirements(
            sortedKeywords,
            competitorPages,
            articleHtml
          );
          
          // 7. Process into keyword objects with status, tracking implemented keywords
          let implementedKeywordsMockString = "";
          const manuallyMarkedDone = context?.assets?.manuallyMarkedKeywordsDone || article?.assets?.manuallyMarkedKeywordsDone || [];
          
          const processedKeywords = requirements.map(req => {
            const originalKeyword = sortedKeywords.find(kw => 
              (kw.keyword_text || kw.keyword) === req.keyword
            );
            // Use target count from calculateKeywordRequirements (already rounded and capped 1-5)
            const targetCount = req.targetOccurrences || Math.max(1, Math.min(5, Math.round((req.recommendedRange.lower + req.recommendedRange.upper) / 2)));
            
            // Count occurrences in article with partial matching
            const normalizedArticle = normalizeText(articleHtml);
            const articleCount = countOccurrencesPartial(req.keyword, normalizedArticle);
            
            // Count occurrences in implemented keywords mock string
            const implementedCount = countOccurrencesPartial(req.keyword, implementedKeywordsMockString);
            
            // Total current count = article count + implemented count
            const currentCount = articleCount + implementedCount;
            
            // If keyword was recommended to be added, append to mock string
            const needed = Math.max(0, targetCount - currentCount);
            if (needed > 0) {
              // Append keyword to mock string (needed times)
              for (let i = 0; i < needed; i++) {
                implementedKeywordsMockString += " " + req.keyword;
              }
            }
            
            // Check if manually marked as done
            const isManuallyDone = manuallyMarkedDone.includes(originalKeyword?.id || req.keywordId);
            
            return {
              id: originalKeyword?.id || req.keywordId,
              keywordText: req.keyword,
              targetCount: targetCount,
              currentCount: currentCount,
              needed: needed,
              status: isManuallyDone || currentCount >= targetCount ? "done" : "pending",
              competitorRange: {
                min: req.recommendedRange.lower,
                max: req.recommendedRange.upper,
                counts: calculateCompetitorCounts(req.keyword, competitorPages)
              }
            };
          });
          
          // 8. Store all keywords, filtering happens in display
          setKeywords(processedKeywords);
          
          return processedKeywords;
        } catch (error) {
          showFlashMessage(`Error refreshing status: ${error.message}`, "error");
          return [];
        }
      };

      // Load keywords and suggestions on mount
      useEffect(() => {
        refreshKeywordStatus();
      }, [context?.assets?.keywords, article?.assets?.keywords, context?.assets?.manuallyMarkedKeywordsDone, article?.assets?.manuallyMarkedKeywordsDone]);

      // Load suggestions from assets separately - watch for assets changes
      useEffect(() => {
        const assets = context?.assets || article?.assets || {};
        const keywordSuggestions = assets.keywordSuggestions;
        
        if (keywordSuggestions && typeof keywordSuggestions === 'object') {
          const suggestionKeys = Object.keys(keywordSuggestions);
          if (suggestionKeys.length > 0) {
            setSuggestions(keywordSuggestions);
          } else {
            setSuggestions({});
          }
        } else {
          
        }
      }, [context?.assets?.keywordSuggestions, article?.assets?.keywordSuggestions]);

      // Toggle expanded keyword
      const toggleExpanded = (keywordText) => {
        setExpandedKeywords(prev => {
          const next = new Set(prev);
          if (next.has(keywordText)) {
            next.delete(keywordText);
          } else {
            next.add(keywordText);
          }
          return next;
        });
      };

      // AI Suggest Handler
      const handleAISuggest = async () => {
        setLoading(true);
        try {
          // Force refresh keyword status before generating suggestions
          const refreshedKeywords = await refreshKeywordStatus();
          
          const articleHtml = getEditorHtml ? getEditorHtml() : editorRef.current?.innerHTML || '';
          
          if (!articleHtml) {
            showFlashMessage('Article content not available', "error");
            setLoading(false);
            return;
          }
          
          // Use refreshed keywords (or fallback to current state if refresh failed)
          const allKeywords = (refreshedKeywords || keywords).filter(
            kw => kw.status !== "done" && kw.needed > 0
          );
          
          if (allKeywords.length === 0) {
            showFlashMessage("All keywords already meet their targets", "info");
            setLoading(false);
            return;
          }
          
          // Batch in groups of 50
          const batches = [];
          for (let i = 0; i < allKeywords.length; i += 50) {
            batches.push(allKeywords.slice(i, i + 50));
          }
          
          const allSuggestions = {};
          
          for (const batch of batches) {
            const monkey = await initMonkey();
            const text = await monkey.apiCall("/api/content-magic/keyword-suggestions/generate", {
              articleHtml,
              keywords: batch.map(kw => ({
                id: kw.id,
                keyword_text: kw.keywordText,
                requiredAdditions: kw.needed
              })),
              spacingMode: "natural"
            });
            const data = JSON.parse(text);
            if (data.error) throw new Error(data.error || `API request failed`);
            
            
            
            // API now returns suggestions directly as { "keyword": [{ id, fromText, toText }] }
            if (data.suggestions && typeof data.suggestions === 'object') {
              Object.assign(allSuggestions, data.suggestions);
            } else {
            }
          }
          
          setSuggestions(allSuggestions);
          setSkippedByImplementAll(new Set());
          
          // Save suggestions to assets and database (include keywords so prior removals persist)
          const assets = context?.assets || article?.assets || {};
          const articleId = article?.id || context?.id;
          
          if (!articleId) {
            showFlashMessage('Cannot save suggestions: article ID not found', "error");
            return;
          }
          
          try {
            const monkey = await initMonkey();
            await monkey.articleAssets.savePatch(
              articleId,
              {
                keywordSuggestions: allSuggestions,
                keywords: assets.keywords ?? [],
              },
              assets,
              updateArticle
            );
            showFlashMessage(`Generated and saved suggestions for ${Object.keys(allSuggestions).length} keywords`, "success");
          } catch (saveError) {
            showFlashMessage(`Suggestions generated but save failed: ${saveError.message}`, "error");
          }
        } catch (error) {
          showFlashMessage(`Error: ${error.message}`, "error");
        } finally {
          setLoading(false);
        }
      };

      // Returns true if fromText appears inside any h1–h4 in the HTML (used to skip header suggestions in Implement All).
      const isTextInsideHeader = (html, fromText) => {
        if (!html || !fromText || html.indexOf(fromText) === -1) return false;
        const div = document.createElement("div");
        div.innerHTML = html;
        const headers = div.querySelectorAll("h1, h2, h3, h4");
        for (let i = 0; i < headers.length; i++) {
          if (headers[i].textContent.includes(fromText)) return true;
        }
        return false;
      };

      // Implement All Handler
      const handleImplementAll = async () => {
        setLoading(true);
        try {
          let articleHtml = getEditorHtml ? getEditorHtml() : editorRef.current?.innerHTML || '';
          const toApply = [];
          const skippedIds = new Set();
          const allSugs = Object.values(suggestions).flat();
          for (const sug of allSugs) {
            const applicable = articleHtml.includes(sug.fromText) && !articleHtml.includes(sug.toText);
            if (!applicable) continue;
            if (isTextInsideHeader(articleHtml, sug.fromText)) {
              if (sug.id != null) skippedIds.add(sug.id);
            } else {
              toApply.push(sug);
            }
          }
          let changesCount = 0;
          for (const sug of toApply) {
            if (articleHtml.includes(sug.fromText) && !articleHtml.includes(sug.toText)) {
              articleHtml = articleHtml.replace(sug.fromText, sug.toText);
              changesCount++;
            }
          }
          setSkippedByImplementAll(skippedIds);
          
          // Update editor
          if (editorRef.current?.setHtml) {
            editorRef.current.setHtml(articleHtml);
          } else if (editorRef.current) {
            editorRef.current.innerHTML = articleHtml;
          }
          
          if (editorRef.current?.triggerChange) {
            editorRef.current.triggerChange(articleHtml);
          }
          
          // Save article content to database via monkey
          const articleId = article?.id || context?.id;
          const skippedCount = skippedIds.size;
          const successMessage = skippedCount > 0
            ? `Applied ${changesCount} changes. ${skippedCount} skipped (in headers – implement manually to keep headers short).`
            : `All keyword suggestions implemented, refreshing suggestions. Please wait.`;
          if (articleId) {
            try {
              const monkey = await initMonkey();
              await monkey.saveArticle({ articleId, contentHtml: articleHtml });
              updateArticle({ content_html: articleHtml });
              showFlashMessage(successMessage, "success", 5000);
            } catch (saveError) {
              showFlashMessage(`Applied ${changesCount} changes, but save failed: ${saveError.message}`, "error");
            }
          } else {
            showFlashMessage(successMessage, "success", 5000);
          }
          
          // Trigger SEO score refresh by dispatching custom event
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('refreshSeoScore'));
          }
          
          // Refresh keyword status and then trigger AI suggest to regenerate suggestions
          setTimeout(async () => {
            await refreshKeywordStatus();
            // Automatically trigger AI suggest to refresh suggestions after implementing all
            setTimeout(() => {
              handleAISuggest();
            }, 500);
          }, 500);
        } catch (error) {
          showFlashMessage(`Error: ${error.message}`, "error");
        } finally {
          setLoading(false);
        }
      };

      // Take Me There Handler
      const handleTakeMeThere = (suggestion, status) => {
        try {
          const editorElement = editorRef.current?.getEditorNode?.() || editorRef.current;
          if (!editorElement) {
            showFlashMessage('Editor not available', "error");
            return;
          }
          
          const searchText = status === "done" ? suggestion.toText : suggestion.fromText;
          
          // Find text in editor
          const walker = document.createTreeWalker(
            editorElement,
            NodeFilter.SHOW_TEXT,
            null,
            false
          );
          
          let node;
          while ((node = walker.nextNode())) {
            if (node.textContent.includes(searchText)) {
              const element = node.parentElement;
              element.scrollIntoView({ behavior: 'smooth', block: 'center' });
              
              // Highlight effect - bright yellow that fades away after 1 second
              const originalBg = element.style.backgroundColor;
              const originalTransition = element.style.transition;
              
              // Apply bright highlight immediately
              element.style.transition = 'none';
              element.style.backgroundColor = '#fef08a';
              
              // After a brief moment, fade out over 1 second
              setTimeout(() => {
                element.style.transition = 'background-color 1s ease-out';
                element.style.backgroundColor = originalBg || 'transparent';
                
                // Restore original transition after fade completes
                setTimeout(() => {
                  element.style.transition = originalTransition || '';
                }, 1000);
              }, 50);
              
              showFlashMessage("Found location", "success", 1500);
              return;
            }
          }
          
          showFlashMessage("Text not found in article", "error");
        } catch (error) {
          showFlashMessage(`Error: ${error.message}`, "error");
        }
      };

      // Mark keyword as done
      const handleMarkAsDone = async (keywordId) => {
        try {
          const assets = context?.assets || article?.assets || {};
          const manuallyMarkedDone = assets.manuallyMarkedKeywordsDone || [];
          
          if (!manuallyMarkedDone.includes(keywordId)) {
            const monkey = await initMonkey();
            await monkey.articleAssets.savePatch(
              article?.id || context?.id,
              {
                manuallyMarkedKeywordsDone: [...manuallyMarkedDone, keywordId],
                keywords: assets.keywords ?? [],
                keywordSuggestions: assets.keywordSuggestions ?? {},
              },
              assets,
              updateArticle
            );
            
            // Refresh keyword status
            setTimeout(() => refreshKeywordStatus(), 500);
          }
        } catch (error) {
          showFlashMessage(`Error: ${error.message}`, "error");
        }
      };

      // Remove keyword from state and asset state (no save; persists on next save)
      const handleRemoveKeyword = (keywordId, keywordText) => {
        const assets = context?.assets || article?.assets || {};
        const keywordsArray = assets.keywords || [];
        const keywordSuggestions = assets.keywordSuggestions || {};
        const manuallyMarkedDone = assets.manuallyMarkedKeywordsDone || [];

        const updatedKeywords = keywordsArray.filter(kw => {
          const idMatch = (kw.id !== undefined && kw.id === keywordId);
          const textMatch = (kw.keyword_text || kw.keyword || '').toLowerCase().trim() === (keywordText || '').toLowerCase().trim();
          return !idMatch && !textMatch;
        });

        const updatedSuggestions = { ...keywordSuggestions };
        delete updatedSuggestions[keywordText];

        const updatedManuallyMarkedDone = manuallyMarkedDone.filter(id => id !== keywordId);

        setKeywords(prev => prev.filter(kw => kw.id !== keywordId && kw.keywordText !== keywordText));
        setSuggestions(prev => {
          const next = { ...prev };
          delete next[keywordText];
          return next;
        });
        updateArticle({
          assets: {
            ...assets,
            keywords: updatedKeywords,
            keywordSuggestions: updatedSuggestions,
            manuallyMarkedKeywordsDone: updatedManuallyMarkedDone,
          },
        });
        showFlashMessage('Keyword removed; will be saved with next save', 'info', 3000);
      };

      // Refresh SEO Score and Keyword Status Handler
      const handleRefresh = async () => {
        try {
          // Trigger SEO score refresh
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('refreshSeoScore'));
          }
          
          // Refresh keyword status
          await refreshKeywordStatus();
          
          showFlashMessage('SEO score and keyword status refreshed', "success");
        } catch (error) {
          showFlashMessage(`Error refreshing: ${error.message}`, "error");
        }
      };

      // Apply/Reverse Handler
      const handleApplyReverse = async (suggestion, action, keywordText) => {
        try {
          let articleHtml = getEditorHtml ? getEditorHtml() : editorRef.current?.innerHTML || '';
          
          if (action === "apply") {
            if (!articleHtml.includes(suggestion.fromText)) {
              showFlashMessage('Original text not found in article', "error");
              return;
            }
            articleHtml = articleHtml.replace(suggestion.fromText, suggestion.toText);
          } else {
            if (!articleHtml.includes(suggestion.toText)) {
              showFlashMessage('Modified text not found in article', "error");
              return;
            }
            articleHtml = articleHtml.replace(suggestion.toText, suggestion.fromText);
          }
          
          // Update editor
          if (editorRef.current?.setHtml) {
            editorRef.current.setHtml(articleHtml);
          } else if (editorRef.current) {
            editorRef.current.innerHTML = articleHtml;
          }
          
          // Update local state to reflect applied/reversed status and check keyword completion
          setAppliedSuggestions(prev => {
            const next = new Set(prev);
            if (action === "apply") {
              next.add(suggestion.id);
            } else {
              next.delete(suggestion.id);
            }
            
            // Check if all suggestions for this keyword are done
            if (keywordText && suggestions[keywordText]) {
              const keywordSuggestions = suggestions[keywordText];
              const allDone = keywordSuggestions.every(sug => {
                // Check if applied locally (use 'next' which includes the current change)
                if (next.has(sug.id)) return true;
                // Check if exists in article (use the updated articleHtml)
                return articleHtml.includes(sug.toText);
              });
              
              // Update keyword status if all suggestions are done
              if (allDone) {
                setKeywords(prevKeywords => 
                  prevKeywords.map(kw => 
                    kw.keywordText === keywordText 
                      ? { ...kw, status: "done" }
                      : kw
                  )
                );
              } else {
                // If not all done, mark as pending (unless manually marked as done)
                setKeywords(prevKeywords => 
                  prevKeywords.map(kw => {
                    if (kw.keywordText === keywordText) {
                      const manuallyMarkedDone = context?.assets?.manuallyMarkedKeywordsDone || article?.assets?.manuallyMarkedKeywordsDone || [];
                      const isManuallyDone = manuallyMarkedDone.includes(kw.id);
                      return { ...kw, status: isManuallyDone ? "done" : "pending" };
                    }
                    return kw;
                  })
                );
              }
            }
            
            return next;
          });
        } catch (error) {
          showFlashMessage(`Error: ${error.message}`, "error");
        }
      };

      // Recommendation Card Component - Memoized to prevent unnecessary re-renders
      const RecommendationCard = React.memo(({ suggestion, keywordText }) => {
        // Calculate status using useMemo - check both article HTML and local applied state
        const status = useMemo(() => {
          // First check if it's been applied locally
          if (appliedSuggestions.has(suggestion.id)) {
            return "done";
          }
          // Otherwise check article HTML
          const articleHtml = getEditorHtml ? getEditorHtml() : editorRef.current?.innerHTML || '';
          const fromExists = articleHtml.includes(suggestion.fromText);
          const toExists = articleHtml.includes(suggestion.toText);
          return toExists ? "done" : fromExists ? "open" : "obsolete";
        }, [suggestion.id, suggestion.fromText, suggestion.toText, appliedSuggestions, getEditorHtml]);
        
        return (
          <div>
            {/* From/To text */}
            <div className="text-xs mb-2 space-y-1">
              <div className="line-through text-red-600 break-words">{suggestion.fromText}</div>
              <div className="text-green-600 break-words">{suggestion.toText}</div>
            </div>
            
            {/* Status badge */}
            <div className="mb-2">
              <span 
                className={`text-xs px-2 py-1 rounded ${
                  status === "done" ? "bg-green-100 text-green-700" :
                  status === "open" ? "bg-yellow-100 text-yellow-700" :
                  "bg-gray-100 text-gray-700"
                }`}
                title={status === "obsolete" ? "This change can no longer be applied due to other changes, generate new suggestions to refresh" : undefined}
              >
                {status}
              </span>
            </div>
            {skippedByImplementAll.has(suggestion.id) && (
              <p className="text-xs text-gray-500 mb-2">
                Skipped by Implement All: in header (implement manually to keep header short).
              </p>
            )}
            
            {/* Actions */}
            <div className="flex gap-2 flex-wrap">
              <button 
                onClick={() => handleTakeMeThere(suggestion, status)}
                className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Take me there
              </button>
              {status === "open" && (
                <button 
                  onClick={() => handleApplyReverse(suggestion, "apply", keywordText)}
                  className="text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  Apply Change
                </button>
              )}
              {status === "done" && (
                <button 
                  onClick={() => handleApplyReverse(suggestion, "reverse", keywordText)}
                  className="text-xs px-2 py-1 bg-orange-600 text-white rounded hover:bg-orange-700"
                >
                  Reverse
                </button>
              )}
            </div>
          </div>
        );
      });

      // Filter keywords based on toggle - keep expanded keywords visible even if done
      const filteredKeywords = keywords.filter(kw => 
        showDoneKeywords || 
        kw.status === "pending" || 
        expandedKeywords.has(kw.keywordText) // Keep expanded ones visible
      );

      const hasSuggestionsAvailable = Object.values(suggestions).flat().length > 0;

      return (
        <div className="p-4">
          {/* Flash Message - Fixed position to float over UI */}
          {flashMessage && (
            <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-50 p-3 rounded shadow-lg ${
              flashMessage.type === "success" ? "bg-green-100 text-green-700 border border-green-300" :
              flashMessage.type === "error" ? "bg-red-100 text-red-700 border border-red-300" :
              "bg-blue-100 text-blue-700 border border-blue-300"
            }`}>
              {flashMessage.message}
            </div>
          )}

          {/* Congrats when step is complete (same criteria as is_complete: SEO score >= 60) */}
          {rule && rule.is_complete && rule.is_complete(context) && (
            <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200">
              <div className="text-sm font-semibold text-green-800">Keyword goal met</div>
              <div className="text-xs text-green-700 mt-1">You can move on to the next step.</div>
            </div>
          )}

          {/* Top buttons and toggle */}
          <div className="space-y-2 mb-4">
            <div className="flex gap-2">
              <button 
                onClick={handleAISuggest} 
                disabled={loading}
                className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading ? <Loader className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Suggest
                <CreditCostBadge path="/api/content-magic/keyword-suggestions/generate" size="sm" className="ml-1" />
              </button>
              <button 
                onClick={handleImplementAll} 
                disabled={loading || !hasSuggestionsAvailable}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Implement All
              </button>
            </div>
            
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={showDoneKeywords}
                  onChange={(e) => setShowDoneKeywords(e.target.checked)}
                  className="rounded"
                />
                <span>Show done keywords</span>
              </label>
              {/* <button
                onClick={handleRefresh}
                disabled={loading}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Refresh SEO score and keyword status"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button> */}
            </div>
          </div>

          {/* Keywords list */}
          {loading && keywords.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Loader className="w-6 h-6 animate-spin mx-auto mb-2" />
              Loading keywords...
            </div>
          ) : filteredKeywords.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {keywords.length === 0 ? "No keywords found" : "No pending keywords"}
            </div>
          ) : (
            <div>
              {filteredKeywords.map(keyword => (
                <div key={keyword.id || keyword.keywordText}>
                  {/* Collapsed view */}
                  <div 
                    className="p-3 flex justify-between items-center hover:bg-gray-50"
                  >
                    <div 
                      className="flex-1 cursor-pointer flex justify-between items-center"
                      onClick={() => toggleExpanded(keyword.keywordText)}
                    >
                      <span className="font-medium text-sm">{keyword.keywordText}</span>
                      <div className="flex items-center gap-2">
                        {keyword.status === "done" ? (
                          <span className="text-green-600 text-sm">✓ Done</span>
                        ) : (
                          <span className="text-green-600 font-semibold">+{keyword.needed}</span>
                        )}
                        <span className="text-gray-400 text-xs">
                          {expandedKeywords.has(keyword.keywordText) ? "▼" : "▶"}
                        </span>
                      </div>
                    </div>
                    <div className="ml-2 flex items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveKeyword(keyword.id, keyword.keywordText);
                        }}
                        className="p-1 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Remove keyword"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMarkAsDone(keyword.id);
                        }}
                        className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Mark as done"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  {/* Expanded view */}
                  {expandedKeywords.has(keyword.keywordText) && (
                    <div className="p-3 space-y-3">
                      {/* Competitor range with tooltip */}
                      <div className="text-sm">
                        <span className="text-gray-700">
                          Competitor range: {keyword.competitorRange.min}-{keyword.competitorRange.max}
                        </span>
                        <span 
                          className="ml-2 cursor-help text-blue-600"
                          title={keyword.competitorRange.counts.join(', ')}
                        >
                          ⓘ
                        </span>
                      </div>

                      {/* Current count */}
                      <div className="text-sm text-gray-700">
                        Current: {keyword.currentCount} / Target: {keyword.targetCount}
                      </div>

                      {/* Recommendations */}
                      {suggestions[keyword.keywordText] && suggestions[keyword.keywordText].length > 0 ? (
                        <div>
                          <div className="text-xs font-semibold text-gray-600 uppercase mb-2">
                            Suggestions ({suggestions[keyword.keywordText].length})
                          </div>
                          {suggestions[keyword.keywordText].map(sug => (
                            <RecommendationCard 
                              key={sug.id}
                              suggestion={sug}
                              keywordText={keyword.keywordText}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="text-sm text-gray-500 italic">
                          No suggestions yet. Click "AI Suggest" to generate recommendations.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      );
    },
  },
};

export default implementKeywords;

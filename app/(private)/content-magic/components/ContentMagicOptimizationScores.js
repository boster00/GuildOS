/**
 * ContentMagicOptimizationScores Component
 * 
 * Displays SEO and AI optimization scores for research artifacts.
 * Shows evaluation metrics and explainable rationale.
 * 
 * @component
 */
"use client";
import React, { useMemo, useState, useEffect, useRef } from "react";
import { TrendingUp, Search, Sparkles, ChevronDown, ChevronUp, X, RefreshCw } from "lucide-react";
import { calculateSeoScore } from "@/libs/content-magic/utils/calculateSeoScore";
import { useWritingGuide } from "@/libs/content-magic/context/WritingGuideContext";
import { initMonkey } from "@/libs/monkey";

export default function ContentMagicOptimizationScores({ article: articleProp }) {
  const [showSeoDetails, setShowSeoDetails] = useState(false);
  const [showAiDetails, setShowAiDetails] = useState(false);
  const [seoRefreshTrigger, setSeoRefreshTrigger] = useState(0);
  const [aiRefreshTrigger, setAiRefreshTrigger] = useState(0);
  const [refreshingSeo, setRefreshingSeo] = useState(false);
  const [refreshingAi, setRefreshingAi] = useState(false);
  const [seoScoreData, setSeoScoreData] = useState(null); // Client-only calculated score
  const [isClient, setIsClient] = useState(false);
  const { article: contextArticle, updateArticle, openRuleModal, getEditorHtml } = useWritingGuide();
  
  // Use context article (most up-to-date) if available, fallback to prop
  const article = contextArticle || articleProp;

  // Mark as client-side after mount to prevent hydration mismatch
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Calculate SEO score on client side only (prevents hydration mismatch)
  useEffect(() => {
    if (!isClient || !article) {
      setSeoScoreData({ score: null, rationale: null, details: null });
      return;
    }
    
    const keywords = article.assets?.keywords || [];
    const competitorPages = article.assets?.competitorPages || [];
    const articleContent = article.content_html || '';
    
    // Only calculate if both required assets are present
    if (keywords.length === 0 || competitorPages.length === 0) {
      setSeoScoreData({ score: null, rationale: null, details: null });
      return;
    }
    
    const calculated = calculateSeoScore({
      keywords,
      competitorPages,
      articleContent,
    });
    
    setSeoScoreData(calculated);
    // Include refresh trigger to force recalculation
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClient, article?.assets?.keywords, article?.assets?.competitorPages, article?.content_html, seoRefreshTrigger]);

  // Use calculated score (client-side) or fallback to stored score (SSR-safe)
  const seoScore = isClient && seoScoreData?.score !== null 
    ? seoScoreData.score 
    : (article?.seo_score || null);
  const seoDetails = isClient ? (seoScoreData?.details || null) : null;
  
  // Load AI score and rationale from GEOReport in assets
  const geoReport = article?.assets?.GEOReport ?? null;
  const aiScore = geoReport?.score ?? article?.ai_score ?? null;
  const aiRationaleRaw = geoReport?.rationale ?? null;
  
  // Parse ai_rationale if it's a JSON string
  const aiRationale = useMemo(() => {
    if (!aiRationaleRaw) return null;
    if (typeof aiRationaleRaw === 'string') {
      try {
        return JSON.parse(aiRationaleRaw);
      } catch (e) {
        // If parsing fails, return as string (legacy format)
        return { overallRationale: aiRationaleRaw };
      }
    }
    return aiRationaleRaw;
  }, [aiRationaleRaw, aiRefreshTrigger, geoReport]);

  const getScoreColor = (score) => {
    if (!score) return "text-gray-400";
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  const getScoreBgColor = (score) => {
    if (!score) return "bg-gray-100";
    if (score >= 80) return "bg-green-50";
    if (score >= 60) return "bg-yellow-50";
    return "bg-red-50";
  };

  // Get color for individual prompt score (0-5 or 0-100 scale)
  const getPromptScoreColor = (score) => {
    // Handle both 0-5 and 0-100 scales
    const score100 = score > 5 ? score : (score * 20);
    if (score100 >= 80) return "bg-green-100 text-green-800 border-green-200";
    if (score100 >= 60) return "bg-yellow-100 text-yellow-800 border-yellow-200";
    return "bg-red-100 text-red-800 border-red-200";
  };

  // Handle removing a keyword
  const handleRemoveKeyword = async (keywordToRemove) => {
    if (!article?.id) {
      alert("Article ID not found");
      return;
    }

    try {
      const currentKeywords = article.assets?.keywords || [];
      // Actually remove the keyword from the array (not just set included: false)
      // Match by comparing keyword_text or keyword field with the keywordToRemove
      const updatedKeywords = currentKeywords.filter(kw => {
        const keywordText = kw.keyword_text || kw.keyword || '';
        const matches = keywordText.toLowerCase().trim() === keywordToRemove.toLowerCase().trim();
        if (matches) {
        }
        return !matches;
      });
      if (currentKeywords.length === updatedKeywords.length) {
        
      }

      // Update assets
      const updatedAssets = {
        ...(article.assets || {}),
        keywords: updatedKeywords,
      };

      // Save to database via monkey
      const monkey = await initMonkey();
      await monkey.articleAssets.savePatch(
        article.id,
        { keywords: updatedKeywords },
        article.assets || {},
        (payload) => updateArticle({ assets: payload.assets })
      );

      // Trigger SEO score recalculation by incrementing refresh trigger
      setSeoRefreshTrigger(prev => prev + 1);

    } catch (error) {
      alert(`Failed to remove keyword: ${error.message}`);
    }
  };

  // Handle refreshing SEO score (use current editor content so score updates without saving)
  const handleRefreshSeo = async () => {
    if (!article) return;
    const keywords = article.assets?.keywords || [];
    const competitorPages = article.assets?.competitorPages || [];
    if (keywords.length === 0 || competitorPages.length === 0) {
      setSeoScoreData({ score: null, rationale: null, details: null });
      return;
    }
    let articleContent = "";
    if (getEditorHtml) {
      const editorHtml = getEditorHtml();
      if (editorHtml && editorHtml.trim()) articleContent = editorHtml;
    }
    if (!articleContent.trim()) articleContent = article.content_html || "";
    setRefreshingSeo(true);
    try {
      const calculated = calculateSeoScore({
        keywords,
        competitorPages,
        articleContent,
      });
      setSeoScoreData(calculated);
      setSeoRefreshTrigger(prev => prev + 1);
      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (error) {
    } finally {
      setRefreshingSeo(false);
    }
  };

  // Listen for refreshSeoScore event (e.g. from implementKeywords) and recalculate using editor content
  const handleRefreshSeoRef = useRef(handleRefreshSeo);
  handleRefreshSeoRef.current = handleRefreshSeo;
  useEffect(() => {
    const handler = () => handleRefreshSeoRef.current?.();
    window.addEventListener("refreshSeoScore", handler);
    return () => window.removeEventListener("refreshSeoScore", handler);
  }, []);

  // Handle refreshing AI score
  const handleRefreshAi = async () => {
    if (!article?.id) {
      alert("Article ID not found");
      return;
    }

    // Get current article content from editor (most up-to-date) or fallback to article.content_html
    let articleContent = "";
    if (getEditorHtml) {
      const editorHtml = getEditorHtml();
      if (editorHtml && editorHtml.trim()) {
        articleContent = editorHtml;
      }
    }
    
    // Fallback to article.content_html if editor content is not available
    if (!articleContent.trim()) {
      articleContent = article.content_html || "";
    }
    
    if (!articleContent.trim()) {
      alert("Article content is empty. Please add content first.");
      return;
    }

    setRefreshingAi(true);
    try {
      const monkey = await initMonkey();
      const result = await monkey.articleAssets.refreshGeoReport(article.id, articleContent);

      // API already persists GEOReport; update local state
      const meta = result.rationale?.evaluationMetadata;
      const updatedAssets = {
        ...(article.assets || {}),
        GEOReport: {
          score: result.score,
          rationale: result.rationale,
          generatedAt: new Date().toISOString(),
          promptsEvaluated: result.rationale?.prompts?.length || 0,
          evaluationMetadata: meta ? { ...meta } : null
        }
      };
      updateArticle({ assets: updatedAssets });
      setAiRefreshTrigger(prev => prev + 1);

    } catch (error) {
      alert(`Failed to calculate AI score: ${error.message}`);
    } finally {
      setRefreshingAi(false);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 mb-3">
      <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
        <TrendingUp className="w-4 h-4" />
        Optimization Scores
      </h3>

      <div className="space-y-3">
        {/* SEO Score */}
        <div className={`rounded-lg p-3 ${getScoreBgColor(seoScore)}`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-gray-600" />
              <span className="text-xs font-medium text-gray-700">SEO Score</span>
            </div>
            <div className="flex items-center gap-2">
              {seoScore !== null && (
                <button
                  onClick={handleRefreshSeo}
                  disabled={refreshingSeo}
                  className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Refresh SEO score"
                >
                  <RefreshCw className={`w-3 h-3 ${refreshingSeo ? 'animate-spin' : ''}`} />
                </button>
              )}
              {seoScore !== null ? (
                <span className={`text-lg font-bold ${getScoreColor(seoScore)}`}>
                  {seoScore}/100
                </span>
              ) : (
                <span className="text-xs text-gray-400 italic">finish competitor and keyword research to show</span>
              )}
            </div>
          </div>
          {seoScore !== null && seoDetails && (
            <div className="mt-2">
              <button
                onClick={() => setShowSeoDetails(!showSeoDetails)}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline transition-colors"
              >
                {showSeoDetails ? (
                  <>
                    <ChevronUp className="w-3 h-3" />
                    Hide details
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3 h-3" />
                    Click to see details
                  </>
                )}
              </button>
              {showSeoDetails && (
                <div className="mt-3 pt-3 border-t border-gray-300 space-y-2">
                  <div className="text-xs text-gray-700">
                    <div className="font-semibold mb-2">
                      {seoDetails.keywordsMeetingLowerRange} out of {seoDetails.totalKeywords} keywords meet the recommended occurrence range
                    </div>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {seoDetails.keywordResults.map((result, idx) => {
                        const meetsRequirement = result.meetsLowerRange;
                        return (
                          <div
                            key={idx}
                            className={`p-2 rounded text-xs border relative ${
                              meetsRequirement
                                ? 'bg-green-50 border-green-200'
                                : 'bg-gray-50 border-gray-200'
                            }`}
                          >
                            <button
                              onClick={() => handleRemoveKeyword(result.keyword)}
                              className="absolute top-1 right-1 p-0.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Remove keyword"
                            >
                              <X className="w-3 h-3" />
                            </button>
                            <div className="font-medium text-gray-900 mb-1 pr-6">{result.keyword}</div>
                            <div className="text-gray-600 space-y-0.5">
                              <div>
                                <span className="font-medium">Range: </span>
                                <span>{result.lowerRange}-{result.upperRange}</span>
                              </div>
                              <div>
                                <span className="font-medium">Current: </span>
                                <span className={meetsRequirement ? 'text-green-600 font-semibold' : 'text-gray-700'}>
                                  {result.articleOccurrences}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {/* Button to navigate to Implement Changes step */}
                    <div className="mt-3 pt-3 border-t border-gray-300">
                      <button
                        onClick={() => openRuleModal("implement_changes")}
                        className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white text-xs font-medium py-2 px-3 rounded hover:bg-blue-700 transition-colors"
                      >
                        Take me to implementation
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* AI Score */}
        <div className={`rounded-lg p-3 ${getScoreBgColor(aiScore)}`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-gray-600" />
              <span className="text-xs font-medium text-gray-700">AI Optimization Score</span>
            </div>
            <div className="flex items-center gap-2">
              {/* Show refresh button if prompts exist, even if score is null */}
              {(aiScore !== null || (article?.assets?.prompts && article.assets.prompts.length > 0)) && (
                <button
                  onClick={handleRefreshAi}
                  disabled={refreshingAi}
                  className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Refresh AI score"
                >
                  <RefreshCw className={`w-3 h-3 ${refreshingAi ? 'animate-spin' : ''}`} />
                </button>
              )}
              {aiScore !== null ? (
                <span className={`text-lg font-bold ${getScoreColor(aiScore)}`}>
                  {aiScore}/100
                </span>
              ) : (
                <span className="text-xs text-gray-400 italic">
                  {article?.assets?.prompts && article.assets.prompts.length > 0 
                    ? (geoReport ? "report available, click refresh to regenerate" : "click refresh to generate report")
                    : "finish prompt research to show"}
                </span>
              )}
            </div>
          </div>
          {aiScore !== null && aiRationale?.prompts && Array.isArray(aiRationale.prompts) && aiRationale.prompts.length > 0 && (
            <div className="mt-2">
              <button
                onClick={() => setShowAiDetails(!showAiDetails)}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline transition-colors"
              >
                {showAiDetails ? (
                  <>
                    <ChevronUp className="w-3 h-3" />
                    Hide details
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3 h-3" />
                    Click to see details
                  </>
                )}
              </button>
              {showAiDetails && (
                <div className="mt-3 pt-3 border-t border-gray-300 space-y-3">
                  {/* {aiRationale?.overallRationale && (
                    <div className="text-xs text-gray-600 leading-relaxed mb-3 pb-3 border-b border-gray-200">
                      {aiRationale.overallRationale}
                    </div>
                  )} */}
                  <p className="text-xs text-gray-700">Goal: aim for score 80+</p>
                  <div className="text-xs text-gray-700">
                    {/* <div className="font-semibold mb-2">
                      {aiRationale.prompts.filter(p => {
                        const score100 = p.score0to100 !== undefined ? p.score0to100 : p.score;
                        return score100 >= 80;
                      }).length} out of {aiRationale.prompts.length} prompt{aiRationale.prompts.length !== 1 ? 's' : ''} scored 80 or higher
                    </div> */}
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {aiRationale.prompts.map((promptEval, idx) => (
                        <div
                          key={idx}
                          className={`p-3 rounded text-xs border ${getPromptScoreColor(promptEval.score0to100 || promptEval.score)}`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="font-medium text-gray-900 flex-1 mr-2">
                              "{promptEval.prompt}"
                            </div>
                            <div className={`px-2 py-1 rounded font-semibold whitespace-nowrap ${getPromptScoreColor(promptEval.score0to100 || promptEval.score)}`}>
                              {promptEval.score0to100 !== undefined ? promptEval.score0to100 : promptEval.score}/100
                            </div>
                          </div>
                          
                          {promptEval.comment && (
                            <div className="mt-2 text-gray-700 text-xs">
                              {promptEval.comment}
                            </div>
                          )}
                          
                          {promptEval.mostRelevantMatch && (
                            <div className="mt-2 text-gray-700">
                              <div className="font-medium mb-1 text-xs">Most relevant match:</div>
                              <div className="text-xs bg-gray-50 p-2 rounded border border-gray-200">
                                {promptEval.mostRelevantMatch}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    {/* Button to navigate to Implement Changes step */}
                    <div className="mt-3 pt-3 border-t border-gray-300">
                      <button
                        onClick={() => openRuleModal("implement_changes")}
                        className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white text-xs font-medium py-2 px-3 rounded hover:bg-blue-700 transition-colors"
                      >
                        Take me to implementation
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

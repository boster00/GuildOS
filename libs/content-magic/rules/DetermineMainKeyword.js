"use client";
import React, { useState, useEffect } from "react";
import { Search, Check, ExternalLink, Lightbulb, Save, X, Loader } from "lucide-react";
import { toast } from "react-hot-toast";
import { useWritingGuide } from "@/libs/content-magic/context/WritingGuideContext";
import { initMonkey } from "@/libs/monkey";
import CreditCostBadge from "@/components/CreditCostBadge";

const determineMainKeyword = {
  key: "determine_main_keyword",
  pageType: ["all"],
  meta: {
    label: "Determine Main Keyword",
    category: "research_plan",
    description: "Enter the keyword you want this article to rank for. Check search results to verify search intent matches your content.",
    defaultActive: true,
    tutorialTitle: "CJGEO Tutorial 2: Determining the main keyword",
    tutorialURL: "https://www.loom.com/share/80fcac589d554344b5663162f4a3cd3b",
  },
  DetailsUIDisplayMode: "fullscreen",

  is_complete: (context) => {
    return !!(context.assets?.main_keyword || context.assets?.mainKeyword);
  },

  components: {
    ListingUI: ({ rule, context, onExecute }) => {
      const isComplete = rule.is_complete && rule.is_complete(context);

      return (
        <div className="flex items-center justify-between p-2 bg-white rounded border border-blue-200 hover:border-blue-400 transition-colors group cursor-pointer">
          <div className="flex-1">
            <span className="text-xs font-medium text-gray-700">
              {isComplete && (
                <span className="text-xs text-green-600 pr-1">✓ </span>
              )}
              {rule.meta.label}
            </span>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onExecute();
            }}
            className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors opacity-0 group-hover:opacity-100"
            title="Determine Main Keyword"
          >
            <Search className="w-4 h-4" />
          </button>
        </div>
      );
    },

    DetailedUI: ({ rule, context, onUpdate }) => {
      const { updateArticle, article } = useWritingGuide();
      const mainKeyword = context.assets?.main_keyword || context.assets?.mainKeyword || '';
      const [keyword, setKeyword] = useState(mainKeyword);
      const [competitorUrl, setCompetitorUrl] = useState('');
      const [serpResults, setSerpResults] = useState([]);
      const [competitorKeywords, setCompetitorKeywords] = useState([]);
      const [isLoading, setIsLoading] = useState(false);
      const [showTutorial, setShowTutorial] = useState(true);
      const [saved, setSaved] = useState(false);
      const [inheritedFrom, setInheritedFrom] = useState(null);

      // Fetch campaign outcome on mount if available
      useEffect(() => {
        const fetchCampaignOutcome = async () => {
          if (!article?.campaign_id || keyword) return; // Skip if already have keyword
          
          try {
            const monkey = await initMonkey();
            const result = await monkey.getCampaignWithDetails(article.campaign_id);
            if (result?.campaign?.outcome) {
              setKeyword(result.campaign.outcome);
              setInheritedFrom("campaign");
            }
          } catch (error) {
          }
        };
        
        fetchCampaignOutcome();
      }, [article?.campaign_id, keyword]);

      // Initialize keyword from context - load main_keyword as default value
      useEffect(() => {
        if (mainKeyword && !keyword) {
          setKeyword(mainKeyword);
        }
      }, [mainKeyword, keyword]);

      // Search SERP by keyword (using Tavily)
      const handleSearchSerp = async () => {
        if (!keyword.trim()) {
          toast.error("Please enter a keyword first");
          return;
        }

        setIsLoading(true);
        try {
          const monkey = await initMonkey();
          const text = await monkey.apiCall('/api/content-magic/search', { query: keyword, maxResults: 5 });
          const data = JSON.parse(text);
          if (data.error) throw new Error(data.error || 'Failed to search SERP');
          
          // Transform to SerpResult format
          const results = (data.results || []).map((result, idx) => ({
            id: `serp-${Date.now()}-${idx}`,
            title: result.title || result.url,
            url: result.url,
            snippet: result.snippet || '',
          }));

          setSerpResults(results);
          setShowTutorial(false);
        } catch (error) {
          toast.error(`Failed to search: ${error.message}`);
        } finally {
          setIsLoading(false);
        }
      };

      // Fetch ranking keywords from competitor URL
      const handleFetchCompetitorKeywords = async () => {
        if (!competitorUrl.trim()) {
          toast.error("Please enter a competitor URL");
          return;
        }

        // Validate URL
        try {
          new URL(competitorUrl);
        } catch {
          toast.error("Please enter a valid URL (e.g., https://example.com)");
          return;
        }

        setIsLoading(true);
        try {
          const monkey = await initMonkey();
          const text = await monkey.apiCall('/api/dataforseo/ranking-keywords', {
            urls: [competitorUrl],
            limit: 20,
          });
          const data = JSON.parse(text);
          if (data.error) throw new Error(data.error || 'Failed to fetch ranking keywords');
          
          // Transform to keyword format
          const keywords = [];
          if (data.results && data.results.length > 0) {
            const result = data.results[0];
            
            if (result.keywords && Array.isArray(result.keywords)) {
              result.keywords.forEach((kw, idx) => {
                if (!kw.keyword || !kw.keyword.trim()) {
                  return;
                }
                
                keywords.push({
                  id: `kw-${Date.now()}-${idx}`,
                  keyword: kw.keyword,
                  searchVolume: kw.search_volume || null,
                  rank: kw.rank_absolute || null,
                  description: kw.main_intent || null,
                });
              });
            }
          }

          // Sort by search volume descending
          keywords.sort((a, b) => {
            const volA = a.searchVolume || 0;
            const volB = b.searchVolume || 0;
            return volB - volA;
          });

          setCompetitorKeywords(keywords);
        } catch (error) {
          toast.error(`Failed to fetch keywords: ${error.message}`);
        } finally {
          setIsLoading(false);
        }
      };

      // Handle saving the keyword (with optional keyword parameter)
      const handleSaveWithKeyword = async (keywordToSave) => {
        const keywordToUse = keywordToSave || keyword.trim();
        if (!keywordToUse) {
          toast.error("Please enter a keyword");
          return;
        }

        // Save to database using centralized asset manager
        if (context.id) {
          try {
            const monkey = await initMonkey();
            await monkey.articleAssets.savePatch(
              context.id,
              { main_keyword: keywordToUse },
              context.assets,
              updateArticle
            );
          } catch (error) {
          }
        } else {
          
        }

        // Show success indicator
        setSaved(true);
        
        // Auto-close after 1 second
        setTimeout(() => {
          if (onUpdate) onUpdate();
        }, 1000);
      };

      // Handle saving the keyword
      const handleSave = () => {
        handleSaveWithKeyword();
      };

      // Use a keyword from competitor list
      const handleUseCompetitorKeyword = (selectedKeyword) => {
        setKeyword(selectedKeyword);
        handleSaveWithKeyword(selectedKeyword);
      };

      // Handle checking keywords from a SERP result URL
      const handleCheckKeywordsFromResult = (url) => {
        setCompetitorUrl(url);
        // Trigger search after a brief delay to ensure state is updated
        setTimeout(() => {
          handleFetchCompetitorKeywordsForUrl(url);
        }, 100);
      };

      // Fetch keywords for a specific URL
      const handleFetchCompetitorKeywordsForUrl = async (urlToCheck) => {
        if (!urlToCheck || !urlToCheck.trim()) {
          return;
        }

        // Validate URL
        try {
          new URL(urlToCheck);
        } catch {
          toast.error("Invalid URL format");
          return;
        }

        setIsLoading(true);
        try {
          const monkey = await initMonkey();
          const text = await monkey.apiCall('/api/dataforseo/ranking-keywords', { urls: [urlToCheck], limit: 20 });
          const data = JSON.parse(text);
          if (data.error) throw new Error(data.error || 'Failed to fetch ranking keywords');

          // Transform to keyword format
          const keywords = [];
          if (data.results && data.results.length > 0) {
            const result = data.results[0];
            
            if (result.keywords && Array.isArray(result.keywords)) {
              result.keywords.forEach((kw, idx) => {
                if (!kw.keyword || !kw.keyword.trim()) {
                  return;
                }
                
                keywords.push({
                  id: `kw-${Date.now()}-${idx}`,
                  keyword: kw.keyword,
                  searchVolume: kw.search_volume || null,
                  rank: kw.rank_absolute || null,
                  description: kw.main_intent || null,
                });
              });
            }
          }

          // Sort by search volume descending
          keywords.sort((a, b) => {
            const volA = a.searchVolume || 0;
            const volB = b.searchVolume || 0;
            return volB - volA;
          });

          setCompetitorKeywords(keywords);
        } catch (error) {
          toast.error(`Failed to fetch keywords: ${error.message}`);
        } finally {
          setIsLoading(false);
        }
      };

      return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Panel: Steps */}
          <div className="space-y-8">
            {saved && (
              <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg flex items-center gap-2">
                <Check className="w-5 h-5" />
                <span>Main keyword saved successfully!</span>
              </div>
            )}

            {/* Step 1: Enter the main keyword */}
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-gray-900">1. Enter the main keyword</h2>
              {inheritedFrom === "campaign" && (
                <div className="mb-2 text-sm text-blue-600 flex items-center gap-1">
                  <span>✓</span>
                  <span>From campaign: {keyword}</span>
                </div>
              )}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={keyword}
                  onChange={(e) => {
                    setKeyword(e.target.value);
                    setInheritedFrom(null);
                    setSerpResults([]); // Clear results when keyword changes
                  }}
                  placeholder="e.g., VHH antibody discovery service"
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                />
                <button
                  onClick={handleSearchSerp}
                  disabled={isLoading || !keyword.trim()}
                  className="flex-shrink-0 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <Loader className="w-5 h-5 animate-spin" />
                      Searching...
                    </>
                  ) : (
                    <>
                      <Search className="w-5 h-5" />
                      Search
                      <CreditCostBadge path="/api/content-magic/search" size="sm" />
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Step 2: Check if this keyword pulls up the right competitors */}
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-gray-900">2. Check if this keyword pulls up the right competitors</h2>
              <p className="text-sm text-gray-600">Review the search results in the right pane after clicking "Search" in step 1.</p>
            </div>

            {/* Step 3: Save if criteria met */}
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-gray-900">3. Keep adjusting the main keyword until it pulls up similar webpages, click below to save.</h2>
              <button
                onClick={handleSave}
                disabled={!keyword.trim() || isLoading}
                className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-base"
              >
                <Save className="w-5 h-5" />
                Save Main Keyword
              </button>
            </div>

            {/* Step 4: Check competitor pages */}
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-gray-900">4. You can get some keyword inspirations by check one of the competitor pages and see what keywords they rank for.</h2>
              
            </div>
          </div>

          {/* Right Panel: Results */}
          <div className="space-y-6">
            {/* Competitor Keywords - Show first */}
            {competitorKeywords.length > 0 && (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="text-lg font-semibold text-gray-900">
                      Keywords this page ranks for ({competitorKeywords.length})
                    </h4>
                    {competitorUrl && (
                      <p className="text-xs text-gray-600 mt-1 break-all">{competitorUrl}</p>
                    )}
                  </div>
                  <button
                    onClick={() => setCompetitorKeywords([])}
                    className="ml-2 p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                    title="Close"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="max-h-[600px] overflow-y-auto divide-y divide-gray-200">
                  {competitorKeywords.map((kw) => {
                    const keywordText = kw.keyword || '';
                    const description = kw.description || '';
                    const truncatedDescription = description && description.length > 200 
                      ? description.substring(0, 200) + '...' 
                      : description;
                    
                    return (
                      <div
                        key={kw.id}
                        className="p-4 hover:bg-gray-50"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="text-base font-medium text-gray-900">{keywordText}</div>
                            {truncatedDescription && (
                              <div className="text-sm text-gray-600 mt-1" title={description}>
                                {truncatedDescription}
                              </div>
                            )}
                            <div className="flex items-center gap-4 text-sm text-gray-600 mt-2">
                              {kw.searchVolume && (
                                <span className="font-semibold">Volume: {kw.searchVolume}</span>
                              )}
                              {kw.rank && (
                                <span>Rank: {kw.rank}</span>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => handleUseCompetitorKeyword(kw.keyword)}
                            className="ml-2 px-4 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors font-medium flex items-center gap-1 flex-shrink-0"
                          >
                            <Save className="w-4 h-4" />
                            Use as Main Keyword
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Search Results - Show second */}
            {serpResults.length > 0 && (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="text-lg font-semibold text-gray-900">Search Results for "{keyword}"</h4>
                    <p className="text-sm text-gray-600 mt-1">
                      Review these results to verify they match your content goals.
                    </p>
                  </div>
                  <button
                    onClick={() => setSerpResults([])}
                    className="ml-2 p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors flex-shrink-0"
                    title="Close"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="divide-y divide-gray-200 max-h-[600px] overflow-y-auto">
                  {serpResults.map((result) => (
                    <div key={result.id} className="p-4 hover:bg-gray-50">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <a
                            href={result.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1 mb-1"
                          >
                            {result.title}
                            <ExternalLink className="w-4 h-4" />
                          </a>
                          <div className="text-xs text-gray-500 mb-1 break-all">{result.url}</div>
                          {result.snippet && (
                            <div className="text-sm text-gray-600 mt-2">{result.snippet}</div>
                          )}
                        </div>
                        <button
                          onClick={() => handleCheckKeywordsFromResult(result.url)}
                          disabled={isLoading}
                          className="ml-2 px-3 py-2 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors font-medium disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-1 flex-shrink-0"
                          title="Check keywords for this URL"
                        >
                          <Search className="w-4 h-4" />
                          Check Keywords
                          <CreditCostBadge path="/api/dataforseo/ranking-keywords" size="sm" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Empty State */}
            {serpResults.length === 0 && competitorKeywords.length === 0 && (
              <div className="flex items-center justify-center h-full min-h-[400px] text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
                <div className="text-center">
                  <Search className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-base font-medium text-gray-500">Results will appear here</p>
                  <p className="text-sm text-gray-400 mt-1">Search for a keyword or check competitor pages to see results</p>
                </div>
              </div>
            )}
          </div>
        </div>
      );
    },
  },
};

export default determineMainKeyword;


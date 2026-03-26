"use client";
import React, { useState, useEffect, useRef } from "react";
import { Search, Check, ChevronRight, ExternalLink, Sparkles, Trash2, Edit2, X } from "lucide-react";
import { toast } from "react-hot-toast";
import { useWritingGuide } from "@/libs/content-magic/context/WritingGuideContext";
import { getAllCountries, getLocationCodeFromName } from "@/libs/monkey/tools/dataForSeo";
import { initMonkey } from "@/libs/monkey";
import { triggerOutOfCreditsBanner, isOutOfCreditsError } from "@/libs/outOfCredits";
import AI_MODELS from "@/config/ai-models";
import CreditCostBadge from "@/components/CreditCostBadge";
import { buildKeywordEvaluationPrompts, buildKeywordRetryPrompt, parseKeywordEvaluationResponse } from "@/libs/content-magic/utils/buildKeywordEvaluationPrompt";

// Types (JSDoc comments for reference)
// KeywordCandidate: { id, keyword, searchVolume?, difficulty?, source: 'DataForSEO' | 'Manual', recommended?, included? }
// KeywordResearchState: { mainKeyword, candidateKeywords[], selectedKeywords[], finalKeywords[], currentStep: 1|2|3, step1Completed, step2Completed }

const researchKeywords = {
  key: "research_keywords",
  pageType: ["all"],
  meta: {
    label: "Research Keywords (SEO)",
    category: "research_plan",
    description: "Select and prioritize secondary keywords for SEO optimization. Generate keyword ideas and use our keyword evaluation tool to decide which keywords to include.",
    defaultActive: true,
    tutorialTitle: "CJGEO Tutorial 4: Mastering Keyword Research with the CJGO App",
    tutorialURL: "https://www.loom.com/share/9088300207794a8485e693a373920b98",
  },
  DetailsUIDisplayMode: "fullscreen",

  is_complete: (context) => {
    const keywords = context.assets?.keywords || [];
    return !!(keywords.length > 0);
  },

  components: {
    ListingUI: ({ rule, context, onExecute }) => {
      const isComplete = rule.is_complete && rule.is_complete(context);

      return (
        <div className="flex items-center justify-between p-2 bg-white rounded border border-purple-200 hover:border-purple-400 transition-colors group cursor-pointer">
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
            className="p-1 text-purple-600 hover:bg-purple-50 rounded transition-colors opacity-0 group-hover:opacity-100"
            title="Open Keyword Strategy"
          >
            <Search className="w-4 h-4" />
          </button>
        </div>
      );
    },

    DetailedUI: ({ rule, context, onUpdate }) => {
      const { article, updateArticle } = useWritingGuide();
      const keywordModel = AI_MODELS.LARGE_CONTEXT || AI_MODELS.ADVANCED || AI_MODELS.STANDARD;
      
      // Check if ICP and Offer are set - required for research
      // Check for direct structure (context.icp, context.icpId) and campaign context
      const hasIcp = !!(
        article?.context?.icp || 
        article?.context?.campaignSettings?.icp || 
        context?.context?.icp || 
        context?.context?.campaignSettings?.icp ||
        article?.context?.icpId || 
        context?.context?.icpId
      );
      const hasOffer = !!(
        article?.context?.offer || 
        article?.context?.campaignSettings?.offer || 
        context?.context?.offer || 
        context?.context?.campaignSettings?.offer ||
        article?.context?.offerId || 
        context?.context?.offerId || 
        article?.offer_id
      );
      
      // Show warning if ICP or Offer is missing
      if (!hasIcp || !hasOffer) {
        return (
          <div className="px-6 py-6">
            <div className="max-w-2xl mx-auto">
              <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-6 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0">
                    <svg className="w-6 h-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-yellow-900 mb-2">
                      Required Information Missing
                    </h3>
                    <p className="text-sm text-yellow-800 mb-4">
                      Before proceeding with keyword research, you need to set the following:
                    </p>
                    <ul className="list-disc list-inside space-y-2 text-sm text-yellow-800 mb-4">
                      {!hasIcp && (
                        <li>
                          <strong>ICP (Ideal Customer Profile)</strong> - Required to understand your target audience
                        </li>
                      )}
                      {!hasOffer && (
                        <li>
                          <strong>Offer</strong> - Required to understand what you're promoting
                        </li>
                      )}
                    </ul>
                    <p className="text-sm text-yellow-700 italic">
                      Please set up your ICP and Offer in the article settings before conducting keyword research.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      }
      
      // Initialize state from existing assets or defaults
      // Get main_keyword from assets (priority order: main_keyword, mainKeyword)
      const mainKeywordFromAssets = context?.assets?.main_keyword || 
                                    context?.assets?.mainKeyword || '';
      
      // Get fallback keyword from context (campaign outcome, etc.)
      const fallbackKeyword = mainKeywordFromAssets ||
                             context?.title?.split(' ').slice(0, 3).join(' ') || 
                             '';

      // Get existing keywords from assets (new flat structure)
      const existingKeywords = context?.assets?.keywords || [];
      
      // Get target_country from assets, default to "United States"
      const targetCountryFromAssets = context?.assets?.target_country || 'United States';

      const [state, setState] = useState({
        mainKeyword: mainKeywordFromAssets || fallbackKeyword,
        candidateKeywords: [],
        selectedKeywords: existingKeywords.map((kw, idx) => {
          // Handle both string format (legacy) and object format (new)
          if (typeof kw === 'string') {
            return {
              id: `existing-${idx}`,
              keyword: kw,
              keyword_text: kw,
              search_volume: null,
              region: null,
              difficulty: null,
              included: true,
            };
          } else {
            // Normalize search_volume (prioritize snake_case, but support camelCase for backward compatibility)
            const searchVolume = kw.search_volume !== undefined ? kw.search_volume : (kw.searchVolume !== undefined ? kw.searchVolume : null);
            return {
              id: kw.id || `existing-${idx}`,
              keyword: kw.keyword_text || kw.keyword || '',
              keyword_text: kw.keyword_text || kw.keyword || '',
              search_volume: searchVolume,
              searchVolume: searchVolume, // Keep camelCase for backward compatibility in UI
              region: kw.region || null,
              difficulty: kw.difficulty || null,
              included: kw.included !== undefined ? kw.included : true,
              aiReason: kw.aiReason || kw.ai_reason || null,
              aiRecommendation: kw.aiRecommendation || kw.ai_recommendation || null,
              aiDuplicateOf: kw.aiDuplicateOf || kw.ai_duplicate_of || '',
            };
          }
        }),
        finalKeywords: existingKeywords.map(kw => 
          typeof kw === 'string' ? kw : (kw.keyword_text || kw.keyword || '')
        ),
        currentStep: 1, // Always start from step 1
        step1Completed: false,
        step2Completed: false,
        // Step 2 (Horizontal) state
        competitorSearchKeyword: mainKeywordFromAssets || fallbackKeyword || '',
        competitorPages: [],
        selectedCompetitorUrl: null,
        competitorRankingKeywords: [],
      });

      const [isLoading, setIsLoading] = useState(false);
      const [isSaving, setIsSaving] = useState(false);
      const [apiResponse, setApiResponse] = useState(null); // Store API response for dev mode
      const [apiPayload, setApiPayload] = useState(null); // Store API payload for dev mode
      const [searchVolumeResponse, setSearchVolumeResponse] = useState(null); // Store search volume API response for dev mode
      const [keywordsAdded, setKeywordsAdded] = useState(false); // Track if keywords have been added
      const [hasAttemptedFetch, setHasAttemptedFetch] = useState(false); // Track if a keyword fetch has been attempted
      const [isFetchingVolumes, setIsFetchingVolumes] = useState(false);
      const [isFetchingCompetitorKeywords, setIsFetchingCompetitorKeywords] = useState(false);
      const [activeAction, setActiveAction] = useState(null); // 'vertical', 'horizontal', 'evaluate', or null
      const [targetCountry, setTargetCountry] = useState(targetCountryFromAssets);
      const [showCountryModal, setShowCountryModal] = useState(false);
      const [countrySearchQuery, setCountrySearchQuery] = useState('');
      const [availableCountries, setAvailableCountries] = useState([]);
      const keywordEvaluationInstructionsFromAssets = context?.assets?.keywordEvaluationInstructions ?? article?.assets?.keywordEvaluationInstructions ?? '';
      const keywordEvaluationInstructionsRef = useRef(null);
      const getKeywordEvaluationInstructions = () => (keywordEvaluationInstructionsRef.current?.value ?? '').trim();
      const isDev = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

      // Update candidate keywords to have included state
      useEffect(() => {
        setState(prev => ({
          ...prev,
          candidateKeywords: prev.candidateKeywords.map(kw => ({
            ...kw,
            included: kw.included !== false, // Default to true
          })),
        }));
      }, []);

      // Sync targetCountry when assets change (e.g., loaded from database)
      useEffect(() => {
        const currentTargetCountry = context?.assets?.target_country || 'United States';
        if (currentTargetCountry !== targetCountry) {
          setTargetCountry(currentTargetCountry);
        }
      }, [context?.assets?.target_country]);

      // Sync keyword evaluation instructions from assets when they change
      useEffect(() => {
        const fromAssets = context?.assets?.keywordEvaluationInstructions ?? article?.assets?.keywordEvaluationInstructions ?? '';
        if (keywordEvaluationInstructionsRef.current) {
          keywordEvaluationInstructionsRef.current.value = fromAssets || '';
        }
      }, [context?.assets?.keywordEvaluationInstructions, article?.assets?.keywordEvaluationInstructions]);

      // Step 2: Fetch Related Keywords
      const fetchRelatedKeywords = async (seedKeyword) => {
        setIsLoading(true);
        
        try {
          // Get location code from targetCountry using monkey tools
          // Returns null for Worldwide, number for countries, or undefined if not found
          const locationCode = getLocationCodeFromName(targetCountry);
          // If not found, default from env, but allow null for Worldwide
          const defaultLocationCode = process.env.DATAFORSEO_DEFAULT_LOCATION 
            ? parseInt(process.env.DATAFORSEO_DEFAULT_LOCATION, 10) || 2840 
            : 2840;
          const finalLocationCode = locationCode === undefined ? defaultLocationCode : locationCode;
          const regionLabel = targetCountry;
          // Call DataForSEO API endpoint
          const requestBody = { 
            keywords: [seedKeyword],
            location_code: finalLocationCode, // Can be null for Worldwide
            limit: 100,
            depth: 2,
          };
          const monkey = await initMonkey();
          const text = await monkey.apiCall('/api/dataforseo/related-keywords', requestBody);
          const data = JSON.parse(text);
          if (data.error) {
            throw new Error(data.error || 'Failed to fetch related keywords');
          }
          
          
          // Store response for dev mode display
          if (isDev) {
            setApiResponse(data);
          }
          // Use candidates directly from fetchKeywordCandidates (monkey workflow)
          // No local parsing needed - use the same format as playground
          const candidates = data.candidates || [];
          
          if (candidates.length === 0) {
            setIsLoading(false);
            toast.error('No related keywords found for this seed keyword. Try a more general keyword or a different region.');
            return [];
          }
          
          // Transform KeywordCandidate[] to frontend format
          // Map candidates to the format expected by the UI
          const keywords = candidates.map((candidate, index) => ({
            id: `keyword-${Date.now()}-${index}`,
            keyword: candidate.keyword,
            keyword_text: candidate.keyword,
            search_volume: candidate.volume !== null && candidate.volume !== undefined ? candidate.volume : null,
            searchVolume: candidate.volume !== null && candidate.volume !== undefined ? candidate.volume : null, // Keep camelCase for backward compatibility
            difficulty: candidate.difficulty !== null && candidate.difficulty !== undefined ? candidate.difficulty : null,
            region: candidate.region || data.region || regionLabel,
            depth: candidate.depth !== null && candidate.depth !== undefined ? candidate.depth : null,
            included: true,
          }));
          
          // Sort keywords: Primary (depth 0-1) first, then secondary (depth 2), then others
          // Within each category, sort by search volume (descending)
          keywords.sort((a, b) => {
            const depthA = a.depth !== null && a.depth !== undefined ? a.depth : 999;
            const depthB = b.depth !== null && b.depth !== undefined ? b.depth : 999;
            
            // Primary keywords (depth 0-1) come first
            const isPrimaryA = depthA === 0 || depthA === 1;
            const isPrimaryB = depthB === 0 || depthB === 1;
            
            // Secondary keywords (depth 2) come after Primary
            const isSecondaryA = depthA === 2;
            const isSecondaryB = depthB === 2;
            
            // Category priority: Primary > Secondary > Others
            if (isPrimaryA && !isPrimaryB) return -1;
            if (!isPrimaryA && isPrimaryB) return 1;
            if (isSecondaryA && !isSecondaryB && !isPrimaryA) return -1;
            if (!isSecondaryA && isSecondaryB && !isPrimaryB) return 1;
            
            // Within same category, sort by search volume (descending)
            const volumeA = a.search_volume !== null && a.search_volume !== undefined ? a.search_volume : (a.searchVolume !== null && a.searchVolume !== undefined ? a.searchVolume : 0);
            const volumeB = b.search_volume !== null && b.search_volume !== undefined ? b.search_volume : (b.searchVolume !== null && b.searchVolume !== undefined ? b.searchVolume : 0);
            
            if (volumeA !== volumeB) {
              return volumeB - volumeA; // Descending order (higher volume first)
            }
            
            // If search volumes are equal, sort alphabetically
            return a.keyword.localeCompare(b.keyword);
          });
          setIsLoading(false);
          return keywords;
        } catch (error) {
          setIsLoading(false);
          // Show user-friendly error
          toast.error(`Failed to fetch related keywords: ${error.message}`);
          return [];
        }
      };

      const handleFetchKeywords = async () => {
        // Get seed keyword from the input field (or use main keyword as fallback)
        const seedInput = document.querySelector('.seed-keyword-container input[type="text"]');
        const seedKeyword = seedInput?.value?.trim() || state.mainKeyword.trim();
        
        if (!seedKeyword) {
          toast.error("Please enter a seed keyword");
          return;
        }
        
        setHasAttemptedFetch(true); // Mark that we've attempted a fetch
        const keywords = await fetchRelatedKeywords(seedKeyword);
        setState(prev => ({
          ...prev,
          candidateKeywords: keywords,
        }));
        // Reset the "keywords added" state when fetching new keywords
        setKeywordsAdded(false);
      };

      // Step 1: Add Selected to Candidates (Vertical)
      const handleAddSelected = () => {
        const included = state.candidateKeywords.filter(kw => kw.included !== false);
        
        if (included.length === 0) {
          toast.error("Please select at least one keyword to add");
          return;
        }
        
        const newSelected = [...state.selectedKeywords];
        let addedCount = 0;
        let duplicateCount = 0;
        
        included.forEach(kw => {
          // Check for duplicates by keyword text (case-insensitive)
          const keywordLower = kw.keyword.toLowerCase().trim();
          const exists = newSelected.some(sk => sk.keyword.toLowerCase().trim() === keywordLower);
          
          if (!exists) {
            // Preserve region info when adding to selected
            newSelected.push({ 
              ...kw, 
              included: true,
              region: kw.region || targetCountry,
            });
            addedCount++;
          } else {
            duplicateCount++;
          }
        });
        
        setState(prev => ({
          ...prev,
          selectedKeywords: newSelected,
          candidateKeywords: [], // Clear candidate keywords after adding
          step1Completed: true, // Mark step 1 as completed
        }));
        
        // Hide the table and show success message
        setKeywordsAdded(true);
      };

      const handleSearchAnotherSeedKeyword = () => {
        setKeywordsAdded(false);
        setHasAttemptedFetch(false);
        setState(prev => ({
          ...prev,
          candidateKeywords: [],
          step1Completed: false,
        }));
      };

      // Step 1: Remove from Selected
      const handleRemoveSelected = async (id) => {
        const updatedState = {
          ...state,
          selectedKeywords: state.selectedKeywords.filter(kw => kw.id !== id),
        };
        
        setState(updatedState);
        
        // Auto-save when keywords are removed (using saveKeywordsToAssets function defined below)
        // Note: saveKeywordsToAssets is defined after calculateTargetOccurrence, 
        // so we'll use inline save logic here for now to maintain correct function order
        try {
          const existingAssets = article.assets || {};
          const competitorPages = existingAssets.competitorPages || [];
          
          const includedKeywords = updatedState.selectedKeywords
            .filter(kw => kw.included !== false)
            .map(kw => {
              const keywordText = kw.keyword_text || kw.keyword;
              const targetOccurrence = calculateTargetOccurrence(keywordText, competitorPages);
              
              // Ensure search_volume is preserved
              const searchVolume = kw.search_volume !== undefined ? kw.search_volume : (kw.searchVolume !== undefined ? kw.searchVolume : null);
              return {
                keyword_text: keywordText,
                search_volume: searchVolume,
                region: kw.region || null,
                difficulty: kw.difficulty || null,
                included: kw.included !== false,
                ai_reason: kw.ai_reason || kw.aiReason || null,
                target_occurrence: targetOccurrence,
              };
            });
          
          // Save to database using centralized asset manager
          const monkey = await initMonkey();
          await monkey.articleAssets.savePatch(
            article.id,
            { keywords: includedKeywords, keywordEvaluationInstructions: (getKeywordEvaluationInstructions() || existingAssets.keywordEvaluationInstructions) ?? '' },
            existingAssets,
            updateArticle
          );
        } catch (error) {
          // Don't show alert on auto-save failure, just log it
        }
      };

      // Step 2 (Horizontal): Fetch competitor pages for search keyword
      const fetchCompetitorPages = async () => {
        const searchKeyword = state.competitorSearchKeyword.trim() || state.mainKeyword.trim();
        if (!searchKeyword) {
          toast.error("Search keyword is required");
          return;
        }

        setIsLoading(true);
        // Clear previous results when searching with a new keyword
        setState(prev => ({
          ...prev,
          competitorPages: [],
          selectedCompetitorUrl: null,
          competitorRankingKeywords: [],
        }));

        try {
          const monkey = await initMonkey();
          const text = await monkey.apiCall('/api/content-magic/search', {
            query: searchKeyword,
            maxResults: 5,
          });
          const data = JSON.parse(text);
          if (data.error) throw new Error(data.error || 'Failed to fetch SERP results');
          
          // Transform to competitor pages format
          const pages = (data.results || []).map((result, idx) => ({
            id: `competitor-${Date.now()}-${idx}`,
            title: result.title || result.url,
            url: result.url,
            snippet: result.snippet || '',
          }));

          setState(prev => ({
            ...prev,
            competitorPages: pages,
          }));
        } catch (err) {
          const msg = err?.message ?? String(err);
          if (isOutOfCreditsError(err)) {
            triggerOutOfCreditsBanner();
            toast.error("Out of credits. Top up to continue.");
          } else if (msg.includes("active external calls") || msg.includes("retry later")) {
            toast.error(msg);
          } else if (msg.includes("Failed to perform metering")) {
            toast.error("Unable to complete request. You may be out of credits—check your balance or try again.");
          } else {
            toast.error(`Failed to fetch competitor pages: ${msg}`);
          }
        } finally {
          setIsLoading(false);
        }
      };

      // Step 2 (Horizontal): Select competitor page and fetch ranking keywords
      const handleSelectCompetitorPage = async (url) => {
        setState(prev => ({
          ...prev,
          selectedCompetitorUrl: url,
        }));

        setIsFetchingCompetitorKeywords(true);
        try {
          // Get location code from targetCountry using monkey tools
          // Returns null for Worldwide, number for countries, or undefined if not found
          const locationCode = getLocationCodeFromName(targetCountry);
          // If not found, default from env, but allow null for Worldwide
          const defaultLocationCode = process.env.DATAFORSEO_DEFAULT_LOCATION 
            ? parseInt(process.env.DATAFORSEO_DEFAULT_LOCATION, 10) || 2840 
            : 2840;
          const finalLocationCode = locationCode === undefined ? defaultLocationCode : locationCode;
          
          const monkey = await initMonkey();
          const text = await monkey.apiCall('/api/dataforseo/ranking-keywords', {
            urls: [url],
            limit: 100,
            location_code: finalLocationCode, // Can be null for Worldwide
          });
          const data = JSON.parse(text);
          if (data.error) throw new Error(data.error || 'Failed to fetch ranking keywords');

          // Transform API response to keyword format
          const keywords = [];
          if (data.results && Array.isArray(data.results) && data.results.length > 0) {
            const result = data.results[0];
            if (result.keywords && Array.isArray(result.keywords)) {
              result.keywords.forEach((kw, idx) => {
                keywords.push({
                  id: `competitor-kw-${Date.now()}-${idx}`,
                  keyword: kw.keyword || kw.keyword_text || '',
                  keyword_text: kw.keyword || kw.keyword_text || '',
                  searchVolume: kw.search_volume || null,
                  search_volume: kw.search_volume || null,
                  difficulty: kw.difficulty || null,
                  region: kw.region || 'USA', // Use region from API response
                  included: true,
                  source: 'competitor',
                });
              });
            }
          }

          setState(prev => ({
            ...prev,
            competitorRankingKeywords: keywords,
          }));
        } catch (err) {
          toast.error(`Failed to fetch ranking keywords: ${err.message}`);
        } finally {
          setIsFetchingCompetitorKeywords(false);
        }
      };

      // Step 2 (Horizontal): Add selected competitor keywords to selected keywords
      const handleAddCompetitorKeywords = () => {
        const included = state.competitorRankingKeywords.filter(kw => kw.included !== false);
        
        if (included.length === 0) {
          toast.error("Please select at least one keyword to add");
          return;
        }
        
        const newSelected = [...state.selectedKeywords];
        let addedCount = 0;
        
        included.forEach(kw => {
          // Check for duplicates by keyword text (case-insensitive)
          const keywordLower = kw.keyword.toLowerCase().trim();
          const exists = newSelected.some(sk => sk.keyword.toLowerCase().trim() === keywordLower);
          
          if (!exists) {
            newSelected.push({ 
              ...kw, 
              included: true,
            });
            addedCount++;
          }
        });
        
        setState(prev => ({
          ...prev,
          selectedKeywords: newSelected,
          competitorRankingKeywords: [], // Clear after adding
          step2Completed: true, // Mark step 2 as completed
        }));
        
        // Success notification is now shown in the UI instead of alert
      };

      // Step 2: Toggle Candidate Include
      const handleToggleCandidateInclude = (id) => {
        setState(prev => ({
          ...prev,
          candidateKeywords: prev.candidateKeywords.map(kw =>
            kw.id === id ? { ...kw, included: !kw.included } : kw
          ),
        }));
      };

      // Step 3: Toggle Selected Include
      const handleToggleSelectedInclude = (id) => {
        let updatedKeywords;
        
        setState(prev => {
          const updated = {
            ...prev,
            selectedKeywords: prev.selectedKeywords.map(kw =>
              kw.id === id ? { ...kw, included: kw.included !== false ? false : true } : kw
            ),
          };
          updatedKeywords = updated.selectedKeywords;
          return updated;
        });
        
        // Update article.assets after state is set (outside setState to avoid React warning)
        setTimeout(() => {
          if (article?.assets && updatedKeywords) {
            const existingAssets = article.assets || {};
            const competitorPages = existingAssets.competitorPages || [];
            
            const includedKeywords = updatedKeywords
              .filter(kw => kw.included !== false)
              .map(kw => {
                const keywordText = kw.keyword_text || kw.keyword;
                const targetOccurrence = calculateTargetOccurrence(keywordText, competitorPages);
                const searchVolume = kw.search_volume !== undefined ? kw.search_volume : (kw.searchVolume !== undefined ? kw.searchVolume : null);
                return {
                  keyword_text: keywordText,
                  search_volume: searchVolume,
                  region: kw.region || null,
                  difficulty: kw.difficulty || null,
                  included: true,
                  ai_reason: kw.ai_reason || kw.aiReason || null,
                  target_occurrence: targetOccurrence,
                };
              });
            
            updateArticle({
              assets: {
                ...existingAssets,
                keywords: includedKeywords,
                keywordEvaluationInstructions: getKeywordEvaluationInstructions() || (existingAssets.keywordEvaluationInstructions ?? '')
              }
            });
          }
        }, 0);
      };

      // Step 3: Get Search Volumes
      const handleGetSearchVolumes = async () => {
        if (state.selectedKeywords.length === 0) {
          toast.error("No keywords to get search volumes for");
          return;
        }

        setIsFetchingVolumes(true);
        setSearchVolumeResponse(null);

        try {
          const keywords = state.selectedKeywords.map(kw => kw.keyword);
          // Use DataForSEO search volume API endpoint
          const monkey = await initMonkey();
          const responseText = await monkey.apiCall('/api/dataforseo/search-volume', { keywords });
          let data;
          try {
            data = JSON.parse(responseText);
            
          } catch (parseError) {
            throw new Error(`Invalid JSON response: ${parseError.message}`);
          }
          setSearchVolumeResponse(data); // Store for dev mode display
          if (data.error) {
            throw new Error(data.error || 'Failed to fetch search volumes');
          }

          // Extract search volumes from DataForSEO response
          // Structure: results[] = [{ keyword, search_volume }, ...]
          
          
          
          const searchVolumeMap = {};
          const keywordsInResponse = new Set(); // Track which keywords were returned by API
          
          if (data.results && Array.isArray(data.results)) {
            data.results.forEach((item, index) => {
              
              if (item.keyword) {
                const keywordLower = item.keyword.toLowerCase();
                keywordsInResponse.add(keywordLower);
                // Store search volume (can be 0, which is valid - means low volume)
                // null/undefined means not returned - leave as is
                if (item.search_volume !== undefined && item.search_volume !== null) {
                  searchVolumeMap[keywordLower] = item.search_volume;
                } else {
                  // API returned the keyword but with null volume - treat as 0 (low volume)
                  searchVolumeMap[keywordLower] = 0;
                  
                }
              } else {
              }
            });
          } else {
          }
          

          // Update keywords with search volumes
          // Only update keywords that were in the API response
          // Keywords NOT in response keep their existing volume (null/undefined) to show '—'
          setState(prev => {
            const updated = prev.selectedKeywords.map(kw => {
              const keywordLower = kw.keyword.toLowerCase();
              const wasInResponse = keywordsInResponse.has(keywordLower);
              
              
              if (wasInResponse) {
                // Keyword was in API response
                const volume = searchVolumeMap[keywordLower];
                // If volume is 0 or undefined (but keyword was returned), set to 0 (will show as "low volume")
                const finalVolume = volume !== undefined ? volume : 0;
                return {
                  ...kw,
                  search_volume: finalVolume,
                  searchVolume: finalVolume, // Keep camelCase for backward compatibility in UI
                };
              } else {
                // Keyword was NOT in API response - keep existing volume (null/undefined)
                // This preserves the '—' display to show it wasn't covered by the API call
                return kw; // Don't modify - keep existing search_volume/searchVolume
              }
            });
            
            
            
            return {
              ...prev,
              selectedKeywords: updated,
            };
          });
        } catch (error) {
          toast.error(`Failed to fetch search volumes: ${error.message}`);
        } finally {
          setIsFetchingVolumes(false);
        }
      };

      // Step 3: Ask AI to Analyze
      const handleAskAI = async () => {
        if (state.selectedKeywords.length === 0) {
          toast.error("No keywords to analyze. Please add keywords first.");
          return;
        }

        setIsLoading(true);
        setApiResponse(null);
        setApiPayload(null);

        try {
          // Get offer (from article title)
          const offer = article.title || '';
          // Get ICP info
          let icpText = '';
          let icpName = '';
          let icpDesc = '';
          
          if (context?.icp && typeof context.icp === 'object') {
            icpName = context.icp?.name || '';
            icpDesc = context.icp?.description || '';
          }
          if (!icpName && context?.assets?.icp && typeof context.assets.icp === 'object') {
            icpName = context.assets.icp?.name || '';
            icpDesc = context.assets.icp?.description || '';
          }
          if (icpName || icpDesc) {
            icpText = icpName || icpDesc;
          }
          // Prepare keywords: extract, de-dupe, remove blanks; build volume map (max volume per keyword text)
          const volumeMap = {};
          for (const kw of state.selectedKeywords) {
            const text = kw.keyword?.trim();
            if (!text) continue;
            const lower = text.toLowerCase();
            const vol = kw.search_volume ?? kw.searchVolume ?? null;
            const num = vol != null ? Number(vol) : 0;
            if (volumeMap[lower] == null || num > (volumeMap[lower] ?? 0)) {
              volumeMap[lower] = num || null;
            }
          }
          const allKeywords = state.selectedKeywords
            .map(kw => kw.keyword?.trim())
            .filter(kw => kw && kw.length > 0);
          
          // De-duplicate (case-insensitive), keep one string per variant
          const uniqueKeywords = [];
          const seen = new Set();
          for (const kw of allKeywords) {
            const lower = kw.toLowerCase();
            if (!seen.has(lower)) {
              seen.add(lower);
              uniqueKeywords.push(kw);
            }
          }
          // Build candidates array with volumes for the shared helper
          const candidatesForHelper = uniqueKeywords.map(kw => ({
            keyword: kw,
            search_volume: volumeMap[kw.toLowerCase()] ?? null,
          }));
          const trimmedCustom = getKeywordEvaluationInstructions();
          // Use shared prompt builder (also used by the full-auto server route)
          const batchPrompts = buildKeywordEvaluationPrompts({
            offer,
            icpText,
            candidates: candidatesForHelper,
            customInstructions: trimmedCustom,
          });
          const batches = batchPrompts.map((prompt, i) => ({
            prompt,
            batch: uniqueKeywords.slice(i * 30, (i + 1) * 30),
          }));

          // Process each batch
          let allResults = [];
          const allPayloads = [];
          const allResponses = [];
          
          for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
            const messageWithInstructions = batches[batchIdx].prompt;

            

            const requestPayload = { 
              message: messageWithInstructions,
              // Only pass IDs, not full context or assets objects
              context: {
                id: context?.id,
                icp: typeof context?.icp === 'string' ? context.icp : undefined,
              },
            };
            let batchResults = [];
            let retryCount = 0;
            const MAX_RETRIES = 2;

            while (retryCount <= MAX_RETRIES) {
              try {
                const monkey = await initMonkey();
                const text = await monkey.apiCall('/api/ai', {
                  query: requestPayload.message,
                  model: keywordModel,
                });
                const data = JSON.parse(text);
                const aiMessage = data.message || data.response || data.result;
                
                
                allPayloads.push(requestPayload);
                allResponses.push(data);
                
                // Store for dev mode (all batches combined)
                if (isDev && batchIdx === batches.length - 1) {
                  setApiPayload({
                    batches: allPayloads,
                    totalBatches: batches.length,
                    totalKeywords: uniqueKeywords.length,
                  });
                  setApiResponse({
                    batches: allResponses,
                    totalBatches: batches.length,
                    aggregatedResults: allResults.length,
                  });
                }

                if (data?.error) {
                  throw new Error(data.error || 'Failed to analyze keywords');
                }

                if (!aiMessage) throw new Error('Empty response from AI');

                // Parse using shared helper (same logic as full-auto server route)
                const validated = parseKeywordEvaluationResponse(aiMessage);
                if (validated.length === 0) throw new Error('No JSON array found in response');

                batchResults = validated;
                break; // Success, exit retry loop
              } catch (error) {
                retryCount++;
                if (retryCount > MAX_RETRIES) {
                  // On final retry, add "Return valid JSON only" to prompt
                  requestPayload.message = requestPayload.message + '\n\nReturn valid JSON only.';
                  throw new Error(`Failed to process batch ${batchIdx + 1} after ${MAX_RETRIES + 1} attempts: ${error.message}`);
                }
                
                // Wait before retry
                await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
              }
            }

            allResults = allResults.concat(batchResults);
          }

          // Validation: Ensure results match input
          if (allResults.length !== uniqueKeywords.length) {
            // Find missing keywords
            const resultKeywords = new Set(allResults.map(r => r.keyword?.toLowerCase()));
            const missingKeywords = uniqueKeywords.filter(kw => !resultKeywords.has(kw.toLowerCase()));
            
            if (missingKeywords.length > 0) {
              // Retry only missing keywords using shared helper
              try {
                const monkey = await initMonkey();
                const retryText = await monkey.apiCall('/api/ai', {
                  query: buildKeywordRetryPrompt({ offer, icpText, missingKeywords }),
                  model: keywordModel,
                });
                const retryData = JSON.parse(retryText);
                const retryAiMessage = retryData.message || retryData.response || retryData.result;
                if (!retryData.error && retryAiMessage) {
                  const retryParsed = parseKeywordEvaluationResponse(retryAiMessage);
                  if (retryParsed.length > 0) {
                    allResults = allResults.concat(retryParsed);
                  }
                }
              } catch {
                // Retry fails silently
              }
            }
          }

          // Final validation
          const finalResults = allResults.filter(r => r.keyword);
          const finalKeywords = new Set();
          const dedupedResults = [];
          
          for (const result of finalResults) {
            const lower = result.keyword.toLowerCase();
            if (!finalKeywords.has(lower)) {
              finalKeywords.add(lower);
              dedupedResults.push(result);
            }
          }
          // Update keywords with AI recommendations
          

          let updatedCount = 0;
          let notFoundCount = 0;
          const updateLog = [];

          setState(prev => ({
            ...prev,
            selectedKeywords: prev.selectedKeywords.map(kw => {
              const aiResult = dedupedResults.find(ar => 
                ar.keyword && ar.keyword.toLowerCase() === kw.keyword.toLowerCase()
              );
              if (aiResult) {
                updatedCount++;
                const shouldInclude = aiResult.include === true || aiResult.include === 'true';
                const isDuplicate = aiResult.duplicateOf != null && aiResult.duplicateOf !== '';
                const aiReason = isDuplicate && aiResult.note
                  ? aiResult.note
                  : (aiResult.note || '');
                
                const update = {
                  ...kw,
                  included: shouldInclude,
                  aiReason,
                  aiRecommendation: isDuplicate ? 'duplicate' : (shouldInclude ? 'include' : 'exclude'),
                  aiDuplicateOf: aiResult.duplicateOf || '',
                  aiWhereBelongs: '',
                  aiImportance: '',
                };

                updateLog.push({
                  keyword: kw.keyword,
                  originalInclude: kw.included,
                  aiInclude: aiResult.include,
                  aiIncludeType: typeof aiResult.include,
                  shouldInclude,
                  finalInclude: update.included,
                  aiRecommendation: update.aiRecommendation,
                  note: aiResult.note,
                });

                return update;
              }
              notFoundCount++;
              
              return kw;
            }),
          }));

          

          const keptCount = dedupedResults.filter(ar => 
            ar.include === true || ar.include === 'true'
          ).length;
          toast.success(`AI analysis complete. ${keptCount} keyword(s) recommended to include.`);
        } catch (error) {
          toast.error(`Failed to analyze keywords: ${error.message}`);
        } finally {
          setIsLoading(false);
        }
      };

      // Calculate target occurrence count for a keyword against competitor pages
      const calculateTargetOccurrence = (keywordText, competitorPages) => {
        if (!competitorPages || competitorPages.length === 0) {
          return { lower: 1, upper: 1 }; // Default if no competitor pages
        }

        const keywordLower = keywordText.toLowerCase().trim();
        const counts = [];

        // Count keyword in each competitor page content
        competitorPages.forEach(page => {
          const content = (page.content || page.markdown || '').toLowerCase();
          // Count occurrences (case-insensitive, whole word)
          const regex = new RegExp(`\\b${keywordLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
          const matches = content.match(regex);
          const count = matches ? matches.length : 0;
          counts.push(count);
        });

        if (counts.length === 0 || counts.every(c => c === 0)) {
          return { lower: 1, upper: 1 }; // Default if no matches found
        }

        // Calculate average (rounded down, no smaller than 1)
        const sum = counts.reduce((acc, c) => acc + c, 0);
        const average = Math.floor(sum / counts.length);
        const lower = Math.max(1, average);

        // Highest count = upper range, but ensure it's not lower than lower range
        const upperRaw = Math.max(...counts);
        const upper = Math.max(lower, upperRaw);

        return { lower, upper };
      };

      // Count keyword occurrences in article content
      const countKeywordInArticle = (keywordText, articleContent) => {
        if (!keywordText || !articleContent) return 0;
        
        // Normalize article content: strip HTML tags
        const normalizeText = (text) => {
          if (!text) return '';
          if (typeof document !== 'undefined') {
            const tmp = document.createElement('DIV');
            tmp.innerHTML = text;
            return (tmp.textContent || tmp.innerText || '').toLowerCase().replace(/\s+/g, ' ').trim();
          } else {
            return text.replace(/<[^>]*>/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
          }
        };

        const normalizedContent = normalizeText(articleContent);
        const keywordLower = keywordText.toLowerCase().trim();
        
        if (!keywordLower) return 0;
        
        // Count occurrences (case-insensitive, whole word)
        const escapedKeyword = keywordLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b${escapedKeyword}\\b`, 'gi');
        const matches = normalizedContent.match(regex);
        return matches ? matches.length : 0;
      };

      // Helper function to save keywords (reusable for auto-save and manual save)
      const saveKeywordsToAssets = async (keywordsToSave = null, showAlert = true, instructionsOverride = null) => {
        if (!article?.id) {
          if (showAlert) toast.error("Article ID not found");
          return;
        }

        // Use provided keywords or current state
        const keywordsForSave = keywordsToSave || state.selectedKeywords;

        // Get competitor pages from assets (from benchmarkCompetitors step)
        // Format: [{ url: string, domain: string, title: string, content: string, savedAt: string }]
        const existingAssets = article.assets || {};
        const competitorPages = existingAssets.competitorPages || [];

        // Calculate target occurrence for each keyword
        const includedKeywords = keywordsForSave
          .filter(kw => kw.included !== false)
          .map(kw => {
            const keywordText = kw.keyword_text || kw.keyword;
            const targetOccurrence = calculateTargetOccurrence(keywordText, competitorPages);
            
            // Ensure search_volume is preserved (prioritize snake_case, support camelCase for backward compatibility)
            const searchVolume = kw.search_volume !== undefined ? kw.search_volume : (kw.searchVolume !== undefined ? kw.searchVolume : null);
            return {
              keyword_text: keywordText,
              search_volume: searchVolume,
              region: kw.region || null,
              difficulty: kw.difficulty || null,
              included: kw.included !== false,
              ai_reason: kw.ai_reason || kw.aiReason || null,
              ai_recommendation: kw.aiRecommendation || kw.ai_recommendation || null,
              ai_duplicate_of: kw.aiDuplicateOf || kw.ai_duplicate_of || null,
              target_occurrence: targetOccurrence, // Add target occurrence range
            };
          });

        const instructionsToSave = (instructionsOverride !== null && instructionsOverride !== undefined)
          ? String(instructionsOverride).trim()
          : (existingAssets.keywordEvaluationInstructions ?? '');

        // Save using centralized asset manager
        const monkey = await initMonkey();
        const updatedAssets = await monkey.articleAssets.savePatch(
          article.id,
          { keywords: includedKeywords, keywordEvaluationInstructions: instructionsToSave },
          existingAssets,
          updateArticle
        );

        return { success: true, includedKeywords, updatedAssets };
      };

      // Step 3: Save Keywords (manual save button)
      const handleSaveKeywords = async () => {
        if (!article?.id) {
          toast.error("Article ID not found");
          return;
        }

        setIsSaving(true);
        try {
          const result = await saveKeywordsToAssets(state.selectedKeywords, true, getKeywordEvaluationInstructions());
          
          if (!result) {
            return; // Error already handled in saveKeywordsToAssets
          }

          if (result.includedKeywords.length === 0) {
            toast.error("Please select at least one keyword to save");
            return;
          }

          setState(prev => ({
            ...prev,
            finalKeywords: result.includedKeywords,
            step2Completed: true,
            currentStep: 3,
          }));

          // Close the panel
          if (onUpdate) {
            onUpdate();
          }

          toast.success("Keywords saved successfully!");
        } catch (error) {
          toast.error(`Failed to save keywords: ${error.message}`);
        } finally {
          setIsSaving(false);
        }
      };

      // Handle action button clicks
      const handleActionClick = (action) => {
        setActiveAction(action);
      };

      // Handle opening country selection modal
      const handleOpenCountryModal = () => {
        setShowCountryModal(true);
        setCountrySearchQuery('');
        // Load countries on demand when modal opens
        if (availableCountries.length === 0) {
          const countries = getAllCountries();
          setAvailableCountries(countries);
        }
      };

      // Handle closing country selection modal
      const handleCloseCountryModal = () => {
        setShowCountryModal(false);
        setCountrySearchQuery('');
      };

      // Handle country selection
      const handleSelectCountry = async (countryName) => {
        setTargetCountry(countryName);
        handleCloseCountryModal();

        // Save to assets.target_country
        try {
          const monkey = await initMonkey();
          await monkey.articleAssets.savePatch(
            article.id,
            { target_country: countryName },
            article.assets,
            updateArticle
          );
        } catch (error) {
          toast.error(`Failed to save country preference: ${error.message}`);
        }
      };

      // Filter countries based on search query
      const filteredCountries = availableCountries.filter(country =>
        country.name.toLowerCase().includes(countrySearchQuery.toLowerCase())
      );

      return (
        <div className="px-6 py-6">
          <div className="flex gap-6 h-[calc(100vh-200px)]">
            {/* Left Panel - Region & Actions (header/description from RuleDetailPanel) */}
            <div className="w-1/2 flex-shrink-0 border-r border-gray-200 pr-6 overflow-y-auto">
              <div className="space-y-6">
                <div className="space-y-4">
                  {/* Region of Interest */}
                  <div className="flex items-center gap-2 pt-2">
                    <span className="text-sm text-gray-600">Region of Interest:</span>
                    <span className="text-sm font-medium text-gray-900">{targetCountry}</span>
                    <button
                      onClick={handleOpenCountryModal}
                      className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                      title="Change region"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-3">
                  <h3 className="text-base font-semibold text-gray-900">Actions</h3>
                  <button
                    onClick={() => handleActionClick('vertical')}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors cursor-pointer ${
                      activeAction === 'vertical'
                        ? 'bg-blue-600 text-white'
                        : 'bg-blue-50 border border-blue-200 text-gray-900 hover:bg-blue-100'
                    }`}
                  >
                    <Search className="w-5 h-5 flex-shrink-0" />
                    <div>
                      <div className="font-medium">Perform Vertical Keyword Research</div>
                      <div className={`text-xs mt-0.5 ${activeAction === 'vertical' ? 'text-blue-100' : 'text-gray-600'}`}>
                        Find keywords directly related to your main keyword
                      </div>
                    </div>
                  </button>
                  
                  <button
                    onClick={() => handleActionClick('horizontal')}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                      activeAction === 'horizontal'
                        ? 'bg-purple-600 text-white'
                        : 'bg-purple-50 border border-purple-200 text-gray-900 hover:bg-purple-100'
                    }`}
                  >
                    <Search className="w-5 h-5 flex-shrink-0" />
                    <div>
                      <div className="font-medium">Perform Horizontal Keyword Research</div>
                      <div className={`text-xs mt-0.5 ${activeAction === 'horizontal' ? 'text-purple-100' : 'text-gray-600'}`}>
                        Find keywords competitor pages rank for
                      </div>
                    </div>
                  </button>
                  
                  <button
                    onClick={() => handleActionClick('evaluate')}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors cursor-pointer ${
                      activeAction === 'evaluate'
                        ? 'bg-green-600 text-white'
                        : 'bg-green-50 border border-green-200 text-gray-900 hover:bg-green-100'
                    }`}
                  >
                    <Sparkles className="w-5 h-5 flex-shrink-0" />
                    <div>
                      <div className="font-medium">Evaluate Keywords Relevance</div>
                      <div className={`text-xs mt-0.5 ${activeAction === 'evaluate' ? 'text-green-100' : 'text-gray-600'}`}>
                        Use AI to evaluate which keywords to include
                      </div>
                    </div>
                  </button>
                </div>

                {/* Selected Keywords */}
                <div>
                  <h3 className="text-base font-semibold text-gray-900 mb-3">Selected Keywords</h3>
                  {state.selectedKeywords.length > 0 ? (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <div className="space-y-1 max-h-96 overflow-y-auto">
                        {state.selectedKeywords.map((kw) => {
                          // Calculate occurrence range and current count
                          const competitorPages = article?.assets?.competitorPages || [];
                          const articleContent = article?.content_html || '';
                          const keywordText = kw.keyword_text || kw.keyword || '';
                          
                          const occurrenceRange = calculateTargetOccurrence(keywordText, competitorPages);
                          const currentCount = countKeywordInArticle(keywordText, articleContent);
                          
                          // Check if keyword meets requirement (within lower-upper range)
                          const meetsRequirement = currentCount >= occurrenceRange.lower && 
                                                   currentCount <= occurrenceRange.upper;
                          
                          // Only show range info if competitor pages exist
                          const showRangeInfo = competitorPages.length > 0;
                          
                          return (
                            <div
                              key={kw.id}
                              className={`flex items-center justify-between text-sm text-gray-700 rounded p-2 border ${
                                meetsRequirement && showRangeInfo
                                  ? 'bg-green-50 border-green-300'
                                  : 'bg-white border-gray-200'
                              }`}
                            >
                              <div className="flex-1 min-w-0">
                                <div className="font-medium truncate">{kw.keyword}</div>
                                <div className="text-gray-500 text-xs mt-0.5 space-y-0.5">
                                  {(() => {
                                    const volume = kw.searchVolume || kw.search_volume;
                                    if (volume === null || volume === undefined) {
                                      return null; // Don't show if not returned from API
                                    } else if (volume === 0) {
                                      return <div className="text-gray-500 italic">Vol: &lt;10</div>;
                                    } else {
                                      return <div>Vol: {volume}</div>;
                                    }
                                  })()}
                                  {kw.difficulty && (
                                    <div>Diff: {Math.round(kw.difficulty)}</div>
                                  )}
                                  {showRangeInfo && (
                                    <div className="mt-1">
                                      <span className="font-medium">Range: </span>
                                      <span>{occurrenceRange.lower}-{occurrenceRange.upper}</span>
                                      <span className="mx-1">•</span>
                                      <span className="font-medium">Current: </span>
                                      <span className={meetsRequirement ? 'text-green-600 font-semibold' : 'text-gray-700'}>
                                        {currentCount}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                              <button
                                onClick={() => handleRemoveSelected(kw.id)}
                                className="ml-2 p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors flex-shrink-0"
                                title="Remove"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center text-sm text-gray-500">
                      No keywords selected yet. Use the actions above to find keywords.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Panel - Dynamic Results */}
            <div className="w-1/2 flex-shrink-0 pl-6 overflow-y-auto space-y-6">
              {/* Vertical Keyword Research */}
              {activeAction === 'vertical' && (
                <>
                  {/* Show success notification only when keywords are added */}
                  {keywordsAdded ? (
                    <div className="flex flex-col items-center justify-center min-h-[400px] space-y-6">
                      <div className="border-2 border-green-400 rounded-lg bg-green-50 p-8 w-full max-w-md">
                        <div className="flex flex-col items-center gap-4">
                          <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center">
                            <Check className="w-8 h-8 text-white" />
                          </div>
                          <div className="text-center">
                            <h4 className="text-xl font-semibold text-green-800 mb-2">
                              Keywords added successfully!
                            </h4>
                            <p className="text-sm text-green-700">
                              The selected keywords have been added to your list.
                            </p>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={handleSearchAnotherSeedKeyword}
                        className="w-full max-w-md px-6 py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors font-medium flex items-center justify-center gap-2"
                      >
                        <Search className="w-5 h-5" />
                        Search another seed keyword
                      </button>
                      <button
                        onClick={() => handleActionClick('horizontal')}
                        className="w-full max-w-md px-6 py-4 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-semibold text-lg flex items-center justify-center gap-2 shadow-lg"
                      >
                        <ChevronRight className="w-5 h-5" />
                        Next Step
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div>
                        <h2 className="text-xl font-semibold text-gray-900 mb-3">Vertical Keyword Research</h2>
                        <p className="text-sm text-gray-600 mb-4">
                          Find keywords directly related to your main keyword. Review the results below and select the keywords you want to add to your list.
                        </p>
                      </div>
                      
                      {/* Seed Keyword */}
                      <div className="seed-keyword-container">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Seed keyword
                        </label>
                        <input
                          type="text"
                          defaultValue={state.mainKeyword}
                          placeholder={state.mainKeyword || 'Enter seed keyword'}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <p className="mt-1 text-xs text-gray-500">
                          Defaults to your main keyword: <strong>{state.mainKeyword || 'Not set'}</strong>. You can change it to search for related keywords.
                        </p>
                      </div>

                      {/* Search Button */}
                      <button
                        onClick={handleFetchKeywords}
                        disabled={isLoading}
                        className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:bg-blue-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {isLoading ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Fetching keywords...
                          </>
                        ) : (
                          <>
                            <Search className="w-4 h-4" />
                            Search for Related Keywords
                            <CreditCostBadge path="/api/dataforseo/related-keywords" size="sm" />
                          </>
                        )}
                      </button>

                      {/* Candidate Keywords Table */}
                      {state.candidateKeywords.length > 0 && (
                        <div className="space-y-4">
                          <h3 className="text-sm font-semibold text-gray-700">Candidate Keywords</h3>
                          <div className="border border-gray-200 rounded-lg overflow-hidden">
                            <table className="w-full text-sm">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 w-12">
                                    <input
                                      type="checkbox"
                                      checked={state.candidateKeywords.every(kw => kw.included !== false)}
                                      onChange={(e) => {
                                        setState(prev => ({
                                          ...prev,
                                          candidateKeywords: prev.candidateKeywords.map(kw => ({
                                            ...kw,
                                            included: e.target.checked,
                                          })),
                                        }));
                                      }}
                                      className="rounded"
                                    />
                                  </th>
                                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Keyword</th>
                                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Search Volume</th>
                                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Difficulty</th>
                                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Region</th>
                                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Relevance</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-200">
                                {state.candidateKeywords.map((kw) => (
                                  <tr key={kw.id} className="hover:bg-gray-50">
                                    <td className="px-3 py-2">
                                      <input
                                        type="checkbox"
                                        checked={kw.included !== false}
                                        onChange={() => handleToggleCandidateInclude(kw.id)}
                                        className="rounded"
                                      />
                                    </td>
                                    <td className="px-3 py-2 font-medium">{kw.keyword}</td>
                                    <td className="px-3 py-2 text-gray-600">
                                      {(() => {
                                        const volume = kw.volume || kw.search_volume || kw.searchVolume;
                                        if (volume === null || volume === undefined) {
                                          return '—';
                                        } else if (volume === 0) {
                                          return <span className="text-gray-500 italic">&lt;10</span>;
                                        } else {
                                          return volume;
                                        }
                                      })()}
                                    </td>
                                    <td className="px-3 py-2 text-gray-600">{kw.difficulty !== null && kw.difficulty !== undefined ? Math.round(kw.difficulty) : '—'}</td>
                                    <td className="px-3 py-2 text-gray-600">{kw.region || '—'}</td>
                                    <td className="px-3 py-2 text-gray-600">
                                      {(() => {
                                        const depth = kw.depth;
                                        if (depth === null || depth === undefined) {
                                          return '—';
                                        } else if (depth === 0 || depth === 1) {
                                          return 'Primary';
                                        } else if (depth === 2) {
                                          return 'secondary';
                                        } else {
                                          return `depth ${depth}`;
                                        }
                                      })()}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          <button
                            onClick={handleAddSelected}
                            className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
                          >
                            Add selected keywords to Selected Keywords
                          </button>
                        </div>
                      )}

                      {/* Dev Mode: Display Full Payload and Response (below table) */}
                      {isDev && (apiPayload || apiResponse) && (
                        <div className="mt-4 space-y-4">
                          {apiPayload && (
                            <div className="border border-blue-300 rounded-lg bg-blue-50 p-4">
                              <h4 className="text-sm font-semibold text-blue-800 mb-2">
                                [DEV] Full Request Payload:
                              </h4>
                              <pre className="text-xs text-blue-900 bg-white border border-blue-200 rounded p-3 overflow-auto max-h-96 break-all whitespace-pre-wrap">
                                {JSON.stringify(apiPayload, null, 2)}
                              </pre>
                            </div>
                          )}
                          {apiResponse && (
                            <div className="border border-yellow-300 rounded-lg bg-yellow-50 p-4">
                              <h4 className="text-sm font-semibold text-yellow-800 mb-2">
                                [DEV] Full AI API Response:
                              </h4>
                              <pre className="text-xs text-yellow-900 bg-white border border-yellow-200 rounded p-3 overflow-auto max-h-96 break-all whitespace-pre-wrap">
                                {JSON.stringify(apiResponse, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* Horizontal Keyword Research */}
              {activeAction === 'horizontal' && (
                <>
                  {/* Show success notification only when step 2 is completed */}
                  {state.step2Completed ? (
                    <div className="flex flex-col items-center justify-center min-h-[400px] space-y-6">
                      <div className="border-2 border-green-400 rounded-lg bg-green-50 p-8 w-full max-w-md">
                        <div className="flex flex-col items-center gap-4">
                          <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center">
                            <Check className="w-8 h-8 text-white" />
                          </div>
                          <div className="text-center">
                            <h4 className="text-xl font-semibold text-green-800 mb-2">
                              Keywords added successfully!
                            </h4>
                            <p className="text-sm text-green-700">
                              The selected keywords have been added to your list.
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="w-full max-w-md space-y-3">
                        <button
                          onClick={() => {
                            setState(prev => ({
                              ...prev,
                              selectedCompetitorUrl: null,
                              competitorRankingKeywords: [],
                              step2Completed: false,
                            }));
                          }}
                          className="w-full px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors font-medium"
                        >
                          Study another competitor
                        </button>
                        <button
                          onClick={() => handleActionClick('evaluate')}
                          className="w-full px-6 py-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold text-lg flex items-center justify-center gap-2 shadow-lg"
                        >
                          <ChevronRight className="w-5 h-5" />
                          Next Step
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                        <h2 className="text-xl font-semibold text-gray-900 mb-2">Horizontal Keyword Research</h2>
                        <p className="text-sm text-gray-700 leading-relaxed">
                          Sees what <strong>top ranking pages</strong> for the main keyword also rank for. This is useful in discovering contextually related, yet semantically not as obvious keywords that should naturally be addressed for best vectorizability and AI understanding. For example, a page ranking for "peptide synthesis" might also rank for "protein expression" or "custom antibodies".
                        </p>
                      </div>
                      
                      <div>
                        <p className="text-sm text-gray-600 mb-4">
                          Find keywords by analyzing what competitor pages are ranking for. We'll show you the top 5 competitor pages for your search keyword, then you can select one to see all the keywords it ranks for. Select keywords to add them to your list.
                        </p>
                      </div>

                      {/* Search Keyword Input */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Search keyword
                        </label>
                        <input
                          type="text"
                          value={state.competitorSearchKeyword || state.mainKeyword || ''}
                          onChange={(e) => {
                            setState(prev => ({
                              ...prev,
                              competitorSearchKeyword: e.target.value,
                            }));
                          }}
                          placeholder={state.mainKeyword || 'Enter search keyword'}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <p className="mt-1 text-xs text-gray-500">
                          Defaults to your main keyword, but you can change it to search for different competitor pages.
                        </p>
                      </div>

                      {/* Fetch Competitor Pages Button - Always Visible */}
                      <div>
                        <button
                          onClick={fetchCompetitorPages}
                          disabled={isLoading || (!state.competitorSearchKeyword.trim() && !state.mainKeyword.trim())}
                          className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:bg-blue-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                          {isLoading ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              Fetching competitor pages...
                            </>
                          ) : (
                            <>
                              <Search className="w-4 h-4" />
                              Get Top 5 Competitor Pages
                              <CreditCostBadge path="/api/content-magic/search" size="sm" />
                            </>
                          )}
                        </button>
                      </div>

                      {/* Competitor Pages List */}
                      {state.competitorPages.length > 0 && !state.selectedCompetitorUrl && (
                        <div className="space-y-4">
                          <h3 className="text-sm font-semibold text-gray-700">Select a competitor page to analyze</h3>
                          <div className="border border-gray-200 rounded-lg overflow-hidden">
                            <div className="divide-y divide-gray-200">
                              {state.competitorPages.map((page) => (
                                <button
                                  key={page.id}
                                  onClick={() => handleSelectCompetitorPage(page.url)}
                                  className="w-full text-left p-4 hover:bg-gray-50 transition-colors flex items-center justify-between gap-2"
                                >
                                  <div className="min-w-0 flex-1">
                                    <div className="font-medium text-gray-900 mb-1">{page.title}</div>
                                    <div className="text-xs text-gray-500 break-all mb-2">{page.url}</div>
                                    {page.snippet && (
                                      <div className="text-xs text-gray-600 line-clamp-2">{page.snippet}</div>
                                    )}
                                  </div>
                                  <CreditCostBadge path="/api/dataforseo/ranking-keywords" size="sm" className="shrink-0" />
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Competitor Ranking Keywords */}
                      {state.selectedCompetitorUrl && (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-gray-700">
                              Keywords this page ranks for
                            </h3>
                            <button
                              onClick={() => setState(prev => ({ ...prev, selectedCompetitorUrl: null, competitorRankingKeywords: [] }))}
                              className="text-xs text-gray-500 hover:text-gray-700"
                            >
                              Select different page
                            </button>
                          </div>
                          
                          {isFetchingCompetitorKeywords ? (
                            <div className="text-center py-8">
                              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                              <p className="text-sm text-gray-600">Fetching ranking keywords...</p>
                            </div>
                          ) : state.competitorRankingKeywords.length > 0 ? (
                            <>
                              <div className="border border-gray-200 rounded-lg overflow-hidden">
                                <table className="w-full text-sm">
                                  <thead className="bg-gray-50">
                                    <tr>
                                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 w-12">
                                        <input
                                          type="checkbox"
                                          checked={state.competitorRankingKeywords.every(kw => kw.included !== false)}
                                          onChange={(e) => {
                                            setState(prev => ({
                                              ...prev,
                                              competitorRankingKeywords: prev.competitorRankingKeywords.map(kw => ({
                                                ...kw,
                                                included: e.target.checked,
                                              })),
                                            }));
                                          }}
                                          className="rounded"
                                        />
                                      </th>
                                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Keyword</th>
                                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Search Volume</th>
                                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Difficulty</th>
                                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Region</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-200">
                                    {state.competitorRankingKeywords.map((kw) => (
                                      <tr key={kw.id} className="hover:bg-gray-50">
                                        <td className="px-3 py-2">
                                          <input
                                            type="checkbox"
                                            checked={kw.included !== false}
                                            onChange={() => {
                                              setState(prev => ({
                                                ...prev,
                                                competitorRankingKeywords: prev.competitorRankingKeywords.map(k =>
                                                  k.id === kw.id ? { ...k, included: !k.included } : k
                                                ),
                                              }));
                                            }}
                                            className="rounded"
                                          />
                                        </td>
                                        <td className="px-3 py-2 font-medium">{kw.keyword}</td>
                                        <td className="px-3 py-2 text-gray-600">
                                          {(() => {
                                            const volume = kw.searchVolume || kw.search_volume;
                                            if (volume === null || volume === undefined) {
                                              return '—'; // Not returned from API - not covered
                                            } else if (volume === 0) {
                                              return <span className="text-gray-500 italic">&lt;10</span>; // 0 or no volume from API
                                            } else {
                                              return volume; // Actual volume number
                                            }
                                          })()}
                                        </td>
                                        <td className="px-3 py-2 text-gray-600">{kw.difficulty !== null && kw.difficulty !== undefined ? Math.round(kw.difficulty) : '—'}</td>
                                        <td className="px-3 py-2 text-gray-600">{kw.region || '—'}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                              <button
                                onClick={handleAddCompetitorKeywords}
                                className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
                              >
                                Add selected keywords to Selected Keywords
                              </button>
                            </>
                          ) : (
                            <div className="text-center py-8 text-gray-500">
                              <p className="text-sm">No ranking keywords found for this page.</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* Evaluate Keywords */}
              {activeAction === 'evaluate' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 mb-3">Evaluate Keywords Relevance</h2>
                    <p className="text-sm text-gray-600 mb-4">
                      Use AI to evaluate each keyword's relevance, importance, and where it should be used in your article.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Custom instructions for keyword evaluation (optional)
                    </label>
                    <textarea
                      ref={keywordEvaluationInstructionsRef}
                      defaultValue={keywordEvaluationInstructionsFromAssets}
                      placeholder="e.g. Prefer keywords that suggest intent to buy; downrank informational-only phrases."
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
                    />
                  </div>

                  {/* AI Analysis Button */}
                  <button
                    onClick={handleAskAI}
                    disabled={isLoading || state.selectedKeywords.length === 0}
                    className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isLoading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        Evaluate Keywords with AI
                        <CreditCostBadge path="/api/ai" size="sm" />
                      </>
                    )}
                  </button>
                  <p className="text-xs text-gray-500">
                    {state.selectedKeywords.some(kw => kw.aiRecommendation || kw.aiImportance || kw.aiWhereBelongs) ? (
                      <>The response is back. Please finalize your choices and click the Save button at the end.</>
                    ) : (
                      <>AI will evaluate each keyword against your article's context, original vision, title, full text, and content ideas. It will provide recommendations, importance ratings, and suggest where each keyword should be used in your article.</>
                    )}
                  </p>

                  {/* Selected Keywords Table */}
                  {state.selectedKeywords.length > 0 && (() => {
                    // Check if any keyword has AI evaluation data
                    const hasAIData = state.selectedKeywords.some(kw => 
                      kw.aiRecommendation || kw.aiImportance || kw.aiWhereBelongs
                    );
                    
                    return (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <colgroup>
                        <col style={{ width: '48px' }} />
                        <col style={{ width: hasAIData ? '15%' : '25%' }} />
                        <col style={{ width: '120px' }} />
                        <col style={{ width: '100px' }} />
                        <col style={{ width: '100px' }} />
                        {hasAIData && <col style={{ width: '15%' }} />}
                        {hasAIData && <col style={{ width: '15%' }} />}
                        {hasAIData && <col style={{ width: '15%' }} />}
                      </colgroup>
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">
                            <input
                              type="checkbox"
                              checked={state.selectedKeywords.every(kw => kw.included !== false)}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                let updatedKeywords;
                                
                                setState(prev => {
                                  const updated = {
                                    ...prev,
                                    selectedKeywords: prev.selectedKeywords.map(kw => ({
                                      ...kw,
                                      included: checked,
                                    })),
                                  };
                                  updatedKeywords = updated.selectedKeywords;
                                  return updated;
                                });
                                
                                // Update article.assets after state is set
                                setTimeout(() => {
                                  if (article?.assets) {
                                    const existingAssets = article.assets || {};
                                    
                                    if (checked && updatedKeywords) {
                                      const competitorPages = existingAssets.competitorPages || [];
                                      const includedKeywords = updatedKeywords
                                        .filter(kw => kw.included !== false)
                                        .map(kw => {
                                          const keywordText = kw.keyword_text || kw.keyword;
                                          const targetOccurrence = calculateTargetOccurrence(keywordText, competitorPages);
                                          const searchVolume = kw.search_volume !== undefined ? kw.search_volume : (kw.searchVolume !== undefined ? kw.searchVolume : null);
                                          return {
                                            keyword_text: keywordText,
                                            search_volume: searchVolume,
                                            region: kw.region || null,
                                            difficulty: kw.difficulty || null,
                                            included: true,
                                            ai_reason: kw.ai_reason || kw.aiReason || null,
                                            target_occurrence: targetOccurrence,
                                          };
                                        });
                                      
                                      updateArticle({
                                        assets: {
                                          ...existingAssets,
                                          keywords: includedKeywords,
                                          keywordEvaluationInstructions: getKeywordEvaluationInstructions() || (existingAssets.keywordEvaluationInstructions ?? '')
                                        }
                                      });
                                    } else {
                                      // If unchecking all, clear keywords
                                      updateArticle({
                                        assets: {
                                          ...existingAssets,
                                          keywords: [],
                                          keywordEvaluationInstructions: getKeywordEvaluationInstructions() || (existingAssets.keywordEvaluationInstructions ?? '')
                                        }
                                      });
                                    }
                                  }
                                }, 0);
                              }}
                              className="rounded"
                            />
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Keyword</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Search Volume</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Difficulty</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Region</th>
                          {hasAIData && <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Recommendation</th>}
                          {hasAIData && <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Importance</th>}
                          {hasAIData && <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Where Belongs</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {state.selectedKeywords.map((kw) => {
                          const isIncluded = kw.included !== false;
                          return (
                            <tr 
                              key={kw.id} 
                              className={`hover:bg-gray-50 ${!isIncluded ? 'opacity-60' : ''}`}
                              style={!isIncluded ? { textDecoration: 'line-through' } : {}}
                            >
                            <td className="px-3 py-2">
                              <input
                                type="checkbox"
                                checked={isIncluded}
                                onChange={() => handleToggleSelectedInclude(kw.id)}
                                className="rounded"
                              />
                            </td>
                              <td className="px-3 py-2 font-medium">
                                <div className="flex flex-col gap-1">
                                  <span className="font-medium">{kw.keyword}</span>
                                  {kw.aiReason && (
                                    <span className="text-xs text-gray-500 italic break-words line-clamp-2">
                                      {kw.aiReason}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-3 py-2 text-gray-600">
                                {(() => {
                                  const volume = kw.searchVolume || kw.search_volume;
                                  if (volume === null || volume === undefined) {
                                    return '—'; // Not returned from API - not covered
                                  } else if (volume === 0) {
                                    return <span className="text-gray-500 italic">low volume</span>; // 0 or no volume from API
                                  } else {
                                    return volume; // Actual volume number
                                  }
                                })()}
                              </td>
                              <td className="px-3 py-2 text-gray-600">{kw.difficulty !== null && kw.difficulty !== undefined ? Math.round(kw.difficulty) : '—'}</td>
                              <td className="px-3 py-2 text-gray-600">{kw.region || '—'}</td>
                              {hasAIData && (
                                <td className="px-3 py-2">
                                  {kw.aiRecommendation ? (
                                    <span className={`px-2 py-1 text-xs rounded-full ${
                                      kw.aiRecommendation.toLowerCase() === 'include' 
                                        ? 'bg-green-100 text-green-700' 
                                        : kw.aiRecommendation.toLowerCase() === 'duplicate'
                                        ? 'bg-amber-100 text-amber-800'
                                        : 'bg-red-100 text-red-700'
                                    }`}>
                                      {kw.aiRecommendation}
                                      {kw.aiDuplicateOf && (
                                        <span className="ml-1 font-medium">→ keep: {kw.aiDuplicateOf}</span>
                                      )}
                                    </span>
                                  ) : '—'}
                                </td>
                              )}
                              {hasAIData && (
                                <td className="px-3 py-2">
                                  {kw.aiImportance ? (
                                    <span className={`px-2 py-1 text-xs rounded-full ${
                                      kw.aiImportance.toLowerCase() === 'high' 
                                        ? 'bg-purple-100 text-purple-700'
                                        : kw.aiImportance.toLowerCase() === 'medium'
                                        ? 'bg-blue-100 text-blue-700'
                                        : 'bg-gray-100 text-gray-700'
                                    }`}>
                                      {kw.aiImportance}
                                    </span>
                                  ) : '—'}
                                </td>
                              )}
                              {hasAIData && (
                                <td className="px-3 py-2 text-gray-600 text-xs">
                                  {kw.aiWhereBelongs || '—'}
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    </div>
                  </div>
                  );
                  })()}

                      {/* Save Button */}
                  <button
                    onClick={handleSaveKeywords}
                    disabled={isSaving || state.selectedKeywords.filter(kw => kw.included !== false).length === 0}
                    className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isSaving ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        Save keywords
                      </>
                    )}
                  </button>

                  {/* Dev Mode: Display Full Search Volume API Response (below Save button) */}
                  {isDev && searchVolumeResponse && (
                    <div className="mt-4 border border-yellow-300 rounded-lg bg-yellow-50 p-4">
                      <h4 className="text-sm font-semibold text-yellow-800 mb-2">
                        [DEV] Full Search Volume API Response:
                      </h4>
                      <pre className="text-xs text-yellow-900 bg-white border border-yellow-200 rounded p-3 overflow-auto max-h-96 break-all whitespace-pre-wrap">
                        {JSON.stringify(searchVolumeResponse, null, 2)}
                      </pre>
                    </div>
                  )}

                  {/* Dev Mode: Display Full Payload and Response (below Save button) */}
                  {isDev && (apiPayload || apiResponse) && (
                    <div className="mt-4 space-y-4">
                      {apiPayload && (
                        <div className="border border-blue-300 rounded-lg bg-blue-50 p-4">
                          <h4 className="text-sm font-semibold text-blue-800 mb-2">
                            [DEV] Full Request Payload:
                          </h4>
                          <pre className="text-xs text-blue-900 bg-white border border-blue-200 rounded p-3 overflow-auto max-h-96 break-all whitespace-pre-wrap">
                            {JSON.stringify(apiPayload, null, 2)}
                          </pre>
                        </div>
                      )}
                      {apiResponse && (
                        <div className="border border-yellow-300 rounded-lg bg-yellow-50 p-4">
                          <h4 className="text-sm font-semibold text-yellow-800 mb-2">
                            [DEV] Full AI API Response:
                          </h4>
                          <pre className="text-xs text-yellow-900 bg-white border border-yellow-200 rounded p-3 overflow-auto max-h-96 break-all whitespace-pre-wrap">
                            {JSON.stringify(apiResponse, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Empty State - No Action Selected */}
              {!activeAction && (
                <div className="flex items-center justify-center h-full min-h-[400px] text-gray-400">
                  <div className="text-center">
                    <Search className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p className="text-base font-medium text-gray-500">Select an action to begin</p>
                    <p className="text-sm text-gray-400 mt-1">Choose an action from the left panel to start keyword research</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Country Selection Modal */}
          {showCountryModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={handleCloseCountryModal}>
              <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                {/* Modal Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900">Select Region</h3>
                  <button
                    onClick={handleCloseCountryModal}
                    className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Search Box */}
                <div className="p-4 border-b border-gray-200">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search countries..."
                      value={countrySearchQuery}
                      onChange={(e) => setCountrySearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      autoFocus
                    />
                  </div>
                </div>

                {/* Country List */}
                <div className="flex-1 overflow-y-auto p-2">
                  {filteredCountries.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <p>No countries found</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {filteredCountries.map((country) => (
                        <button
                          key={country.code}
                          onClick={() => handleSelectCountry(country.name)}
                          className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
                            targetCountry === country.name
                              ? 'bg-purple-100 text-purple-900 font-medium'
                              : 'hover:bg-gray-100 text-gray-700'
                          }`}
                        >
                          {country.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      );
    },
  },
};

export default researchKeywords;

"use client";
import React, { useState, useEffect } from "react";
import { Link2, Search, Sparkles, Check, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "react-hot-toast";
import { useWritingGuide } from "@/libs/content-magic/context/WritingGuideContext";
import config from "@/config";
import { initMonkey } from "@/libs/monkey";
import AI_MODELS from "@/config/ai-models";
import CreditCostBadge from "@/components/CreditCostBadge";

const researchInternalLinks = {
  key: "research_internal_links",
  pageType: ["all"],
  meta: {
    label: "Research Internal Links (optional)",
    category: "research_plan",
    description: "Research and plan internal linking opportunities for SEO and navigation.",
    defaultActive: true,
    tutorialTitle: "CJGEO Tutorial 6: Mastering Internal Links for SEO Success 🚀",
    tutorialURL: "https://www.loom.com/share/b14271ad72c5485b97f366abf94dd3b5",
  },
  DetailsUIDisplayMode: "fullscreen",

  is_complete: (context) => {
    return !!(context.assets?.internal_links?.length > 0);
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
            title="Open Internal Links Research"
          >
            <Link2 className="w-4 h-4" />
          </button>
        </div>
      );
    },

    DetailedUI: ({ rule, context, onUpdate }) => {
      const { article, updateArticle } = useWritingGuide();
      const analysisModel = AI_MODELS.LARGE_CONTEXT || AI_MODELS.ADVANCED || AI_MODELS.STANDARD;

      // Get context data
      const campaignId = article?.campaign_id || context?.campaign_id;
      const mainKeyword = context?.assets?.main_keyword || 
                        context?.assets?.mainKeyword || '';
      const articleTitle = context?.title || '';
      const articleContent = context?.content_html || context?.content || '';
      const articleText = articleContent.replace(/<[^>]*>/g, '').trim();

      // Extract domain from article URL if available
      const extractDomainFromUrl = (url) => {
        if (!url) return '';
        try {
          const urlObj = new URL(url);
          return urlObj.hostname.replace(/^www\./, '');
        } catch (e) {
          // If URL parsing fails, try to extract domain manually
          const match = url.match(/https?:\/\/(?:www\.)?([^\/]+)/);
          return match ? match[1] : '';
        }
      };

      const articleUrl = article?.source_url || context?.source_url || '';
      const defaultDomain = extractDomainFromUrl(articleUrl) || '';

      const [currentStep, setCurrentStep] = useState(1);
      const [searchDomain, setSearchDomain] = useState(defaultDomain);
      const [campaignArticles, setCampaignArticles] = useState([]);
      const [searchResults, setSearchResults] = useState([]);
      const [allOpportunities, setAllOpportunities] = useState([]);
      const [isLoadingCampaign, setIsLoadingCampaign] = useState(false);
      const [isLoadingSearch, setIsLoadingSearch] = useState(false);
      const [isEvaluating, setIsEvaluating] = useState(false);
      const [isSaving, setIsSaving] = useState(false);

      // Load existing internal links plan
      const existingLinksPlan = context?.assets?.internal_links || [];

      // Step 1: Fetch campaign articles
      const fetchCampaignArticles = async () => {
        if (!campaignId) {
          toast.error("No campaign associated with this article");
          return;
        }

        setIsLoadingCampaign(true);
        try {
          const monkey = await initMonkey();
          const text = await monkey.apiCall('/api/content-magic/campaign-articles', {
            campaignId,
            excludeArticleId: article?.id,
          });
          const data = JSON.parse(text);
          if (data.error) throw new Error(data.error || 'Failed to fetch campaign articles');
          setCampaignArticles(data.articles || []);
        } catch (error) {
          toast.error(`Failed to fetch campaign articles: ${error.message}`);
        } finally {
          setIsLoadingCampaign(false);
        }
      };

      // Step 1: Search site:domain.com + main keyword
      const searchSitePages = async () => {
        if (!mainKeyword.trim()) {
          toast.error("Main keyword is required for site search");
          return;
        }

        if (!searchDomain.trim()) {
          toast.error("Domain is required for site search");
          return;
        }

        setIsLoadingSearch(true);
        try {
          const searchQuery = `site:${searchDomain.trim()} ${mainKeyword}`;

          const monkey = await initMonkey();
          const text = await monkey.apiCall('/api/content-magic/search', {
            query: searchQuery,
            maxResults: 10,
          });
          const data = JSON.parse(text);
          if (data.error) throw new Error(data.error || 'Failed to search site pages');
          setSearchResults(data.results || []);
        } catch (error) {
          toast.error(`Failed to search site pages: ${error.message}`);
        } finally {
          setIsLoadingSearch(false);
        }
      };

      // Step 2: Evaluate with AI
      const evaluateLinks = async () => {
        // Combine all opportunities
        const combined = [
          ...campaignArticles.map(art => ({
            id: `campaign-${art.id}`,
            title: art.title,
            url: art.source_url || null,
            source: 'campaign',
            articleId: art.id,
          })),
          ...searchResults.map((result, idx) => ({
            id: `search-${idx}`,
            title: result.title,
            url: result.url,
            source: 'search',
          })),
        ];

        if (combined.length === 0) {
          toast.error("No articles found to evaluate. Please complete Step 1 first.");
          return;
        }

        setIsEvaluating(true);
        try {
          // Check which articles are phase 1, 2, or 3 (valuable pages)
          const valuablePages = combined.filter(opp => {
            // Check if article type indicates it's a phase 1, 2, or 3 page
            // This would need to be determined from the article data or campaign context
            // For now, we'll let AI determine based on context
            return true; // Will be evaluated by AI
          });

          const message = `You are an SEO expert evaluating internal linking opportunities for an article.

Current Article:
- Title: ${articleTitle}
- Main Keyword: ${mainKeyword}
- Content (first 3000 chars): ${articleText.substring(0, 3000)}${articleText.length > 3000 ? '...' : ''}

IMPORTANT DEFINITIONS:
- "Success" = A page that ranks HIGH in site:domain.com search results (top 10 results). These pages have proven SEO performance and authority.
- "Value" = A page that is a Phase 1, 2, or 3 page (pillar pages, cluster pages, or high-priority landing pages). These are strategically important pages in the content strategy.

LINKING STRATEGY & BEST PRACTICES:
1. OUTBOUND LINKS (this article → other pages):
   - Link TO the most VALUABLE pages (Phase 1, 2, or 3 pages, landing pages) FROM this article
   - Recommended: 3-5 outbound links per article (quality over quantity)
   - Links should be contextually relevant and natural
   - Prioritize linking to pages that provide additional value to the reader

2. INBOUND LINKS (other pages → this article):
   - Get links FROM SUCCESSFUL pages (high-ranking in site search) TO this article
   - This boosts this article's ranking power by receiving link equity from authoritative pages
   - Recommended: 2-4 inbound link opportunities per article
   - Focus on pages that already rank well and have traffic

3. QUALITY OVER QUANTITY:
   - Too many links can dilute link equity and appear spammy
   - Each link should serve a clear purpose (user value or SEO value)
   - Links should feel natural and contextually appropriate

Potential Linking Opportunities:
${combined.map((opp, idx) => `${idx + 1}. ${opp.title}${opp.url ? ` (${opp.url})` : ' (No URL yet)'}`).join('\n')}

For each opportunity, evaluate:
1. Should we create a link? (yes/no) - Be selective, recommend only the best opportunities
2. If yes, what type of link?
   - "inbound": Other page should link TO this article (recommended for pages that rank HIGH in site search - successful pages)
   - "outbound": This article should link TO that page (recommended for Phase 1/2/3 pages or valuable landing pages)
3. If outbound, suggest WHERE in this article to place the link:
   - Suggest an existing word/phrase to link from, OR
   - Suggest a small phrase or sentence to add that makes the link natural

IMPORTANT: Be selective! Recommend:
- Maximum 3-5 outbound links total
- Maximum 2-4 inbound link opportunities total
- Only the highest quality, most relevant opportunities

Return a JSON array where each item has:
{
  "index": 1, // index in the list above (1-based)
  "recommend": true/false, // whether to create a link (be selective!)
  "linkType": "inbound" | "outbound" | null, // type of link if recommended
  "reason": "brief explanation of why this link makes sense, mentioning if it's a 'successful' page (high ranking) or 'valuable' page (phase 1/2/3)",
  "anchorText": "text to use for the link (if outbound)",
  "placement": "where in the article to place the link (if outbound, e.g. 'in the introduction section', 'near the mention of X', 'add after sentence about Y')"
}

Return ONLY valid JSON array, no other text.`;

          const monkey = await initMonkey();
          const text = await monkey.apiCall('/api/ai', {
            query: message,
            model: analysisModel,
          });
          const data = JSON.parse(text);
          const aiMessage = data.message || data.response || data.result;
          if (data.error) throw new Error(data.error || 'Failed to evaluate links');

          // Parse AI response
          let aiResults = [];
          let rawResponse = '';
          
          if (aiMessage) {
            rawResponse = aiMessage;
            
            try {
              const trimmed = rawResponse.trim();
              if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
                aiResults = JSON.parse(trimmed);
              } else {
                const jsonBlockMatch = rawResponse.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/);
                if (jsonBlockMatch) {
                  aiResults = JSON.parse(jsonBlockMatch[1].trim());
                } else {
                  const jsonMatch = rawResponse.match(/\[[\s\S]*\]/);
                  if (jsonMatch) {
                    aiResults = JSON.parse(jsonMatch[0]);
                  }
                }
              }
            } catch (parseError) {
              toast.error(`Failed to parse AI response: ${parseError.message}`);
              setIsEvaluating(false);
              return;
            }
          }

          if (!Array.isArray(aiResults) || aiResults.length === 0) {
            toast.error('AI did not return a valid evaluation. Please try again.');
            setIsEvaluating(false);
            return;
          }

          // Map AI results to opportunities
          const evaluated = combined.map((opp, idx) => {
            const aiResult = aiResults.find(r => r.index === idx + 1);
            if (!aiResult) {
              return {
                ...opp,
                linkType: 'none',
                reason: '',
                anchorText: '',
                placement: '',
              };
            }

            return {
              ...opp,
              linkType: aiResult.recommend ? (aiResult.linkType || 'none') : 'none',
              reason: aiResult.reason || '',
              anchorText: aiResult.anchorText || '',
              placement: aiResult.placement || '',
            };
          });

          setAllOpportunities(evaluated);
          setCurrentStep(2);
        } catch (error) {
          toast.error(`Failed to evaluate links: ${error.message}`);
        } finally {
          setIsEvaluating(false);
        }
      };

      // Save internal links plan
      const handleSave = async () => {
        if (!article?.id) {
          toast.error("Article ID not found");
          return;
        }

        const selectedLinks = allOpportunities.filter(opp => opp.linkType !== 'none');
        
        setIsSaving(true);
        try {
          const existingAssets = article.assets || {};

          const internalLinksData = selectedLinks.map(opp => ({
            title: opp.title,
            url: opp.url,
            linkType: opp.linkType,
            reason: opp.reason,
            anchorText: opp.anchorText,
            placement: opp.placement,
            source: opp.source,
            articleId: opp.articleId,
          }));

          const monkey = await initMonkey();
          await monkey.articleAssets.savePatch(
            article.id,
            { internal_links: internalLinksData },
            existingAssets,
            updateArticle
          );

          toast.success("Internal links plan saved successfully!");
          if (onUpdate) onUpdate();
        } catch (error) {
          toast.error(`Failed to save: ${error.message}`);
        } finally {
          setIsSaving(false);
        }
      };

      // Update link type for an opportunity
      const handleUpdateLinkType = (id, linkType) => {
        setAllOpportunities(prev =>
          prev.map(opp => opp.id === id ? { ...opp, linkType } : opp)
        );
      };

      return (
        <div className="px-6 py-6">
          <div className="flex gap-6 h-full">
            {/* Left Panel - Steps */}
            <div className="w-80 flex-shrink-0 border-r border-gray-200 pr-6">
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 uppercase mb-3">
                    Steps
                  </h3>
                  <div className="space-y-2">
                    <button
                      onClick={() => setCurrentStep(1)}
                      className={`w-full flex items-center gap-2 px-3 py-2.5 rounded text-sm font-medium transition-colors text-left ${
                        currentStep === 1
                          ? 'bg-blue-50 border border-blue-200'
                          : 'text-gray-500 hover:bg-gray-50 border border-transparent'
                      }`}
                    >
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${
                        currentStep === 1
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 text-gray-600'
                      }`}>
                        1
                      </div>
                      <span>Get List of Articles</span>
                    </button>
                    <button
                      onClick={() => setCurrentStep(2)}
                      disabled={allOpportunities.length === 0}
                      className={`w-full flex items-center gap-2 px-3 py-2.5 rounded text-sm font-medium transition-colors text-left ${
                        currentStep === 2
                          ? 'bg-blue-50 border border-blue-200'
                          : 'text-gray-500 hover:bg-gray-50 border border-transparent'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${
                        currentStep === 2
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 text-gray-600'
                      }`}>
                        2
                      </div>
                      <span>Evaluate Links</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Panel - Content */}
            <div className="flex-1 space-y-6">
              {/* Step 1: Get List of Articles */}
              {currentStep === 1 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">
                      Step 1: Get List of Articles
                    </h2>
                    <p className="text-sm text-gray-600 mb-4">
                      Gather articles from your campaign and existing site pages to identify linking opportunities.
                    </p>
                  </div>

                  {/* Campaign Articles */}
                  <div className="border border-gray-200 rounded-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-semibold text-gray-700">
                        1. Campaign Articles
                      </h3>
                      <button
                        onClick={fetchCampaignArticles}
                        disabled={isLoadingCampaign || !campaignId}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {isLoadingCampaign ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Loading...
                          </>
                        ) : (
                          <>
                            <Search className="w-4 h-4" />
                            Load Campaign Articles
                          </>
                        )}
                      </button>
                    </div>
                    {campaignArticles.length > 0 ? (
                      <div className="space-y-2">
                        {campaignArticles.map((art) => (
                          <div
                            key={art.id}
                            className="border border-gray-200 rounded p-3 bg-gray-50"
                          >
                            <div className="font-medium text-sm text-gray-900">{art.title}</div>
                            <div className="text-xs text-gray-500 mt-1">
                              {art.source_url ? (
                                <a href={art.source_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1">
                                  {art.source_url}
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              ) : (
                                <span>No URL yet</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">
                        {!campaignId ? 'No campaign associated with this article.' : 'Click "Load Campaign Articles" to fetch articles from the same campaign.'}
                      </p>
                    )}
                  </div>

                  {/* Site Search */}
                  <div className="border border-gray-200 rounded-lg p-6">
                    <h3 className="text-sm font-semibold text-gray-700 mb-4">
                      2. Site Search Results
                    </h3>
                    
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Domain
                      </label>
                      <input
                        type="text"
                        value={searchDomain}
                        onChange={(e) => setSearchDomain(e.target.value)}
                        placeholder="example.com"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        {defaultDomain ? `Default extracted from article URL. You can change it.` : 'Enter the domain to search (e.g., example.com)'}
                      </p>
                    </div>

                    <button
                      onClick={searchSitePages}
                      disabled={isLoadingSearch || !mainKeyword.trim() || !searchDomain.trim()}
                      className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isLoadingSearch ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Searching...
                        </>
                      ) : (
                        <>
                          <Search className="w-4 h-4" />
                          Search Site Pages
                          <CreditCostBadge path="/api/content-magic/search" size="sm" />
                        </>
                      )}
                    </button>
                    {searchResults.length > 0 ? (
                      <div className="space-y-2">
                        {searchResults.map((result, idx) => (
                          <div
                            key={idx}
                            className="border border-gray-200 rounded p-3 bg-gray-50"
                          >
                            <div className="font-medium text-sm text-gray-900">{result.title}</div>
                            <div className="text-xs text-gray-500 mt-1">
                              <a href={result.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1">
                                {result.url}
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 mt-4">
                        {!mainKeyword.trim() 
                          ? 'Main keyword is required for site search.' 
                          : !searchDomain.trim()
                          ? 'Enter a domain above to search.'
                          : `Click "Search Site Pages" to find pages on ${searchDomain} related to "${mainKeyword}".`}
                      </p>
                    )}
                  </div>

                  {/* Proceed to Step 2 */}
                  {(campaignArticles.length > 0 || searchResults.length > 0) && (
                    <button
                      onClick={evaluateLinks}
                      disabled={isEvaluating}
                      className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isEvaluating ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Evaluating...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          Evaluate Links with AI
                          <CreditCostBadge path="/api/ai" size="sm" />
                        </>
                      )}
                    </button>
                  )}
                </div>
              )}

              {/* Step 2: Evaluate Links */}
              {currentStep === 2 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">
                      Step 2: Evaluate Where to Create Internal Links
                    </h2>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                      <h3 className="text-sm font-semibold text-blue-900 mb-2">Internal Linking Strategy</h3>
                      <div className="text-sm text-blue-800 space-y-2">
                        <div>
                          <strong>Definitions:</strong>
                          <ul className="list-disc list-inside ml-2 mt-1 space-y-1">
                            <li><strong>Success:</strong> A page that ranks high in site search results (top 10). These pages have proven SEO performance.</li>
                            <li><strong>Value:</strong> A Phase 1, 2, or 3 page (pillar pages, cluster pages, or high-priority landing pages). These are strategically important.</li>
                          </ul>
                        </div>
                        <div>
                          <strong>Best Practices:</strong>
                          <ul className="list-disc list-inside ml-2 mt-1 space-y-1">
                            <li><strong>Outbound Links (this article → other pages):</strong> Link TO valuable pages (Phase 1/2/3, landing pages). Recommended: 3-5 links per article.</li>
                            <li><strong>Inbound Links (other pages → this article):</strong> Get links FROM successful pages (high-ranking) TO boost this article's ranking. Recommended: 2-4 opportunities.</li>
                            <li><strong>Quality over Quantity:</strong> Too many links can dilute link equity. Each link should serve a clear purpose and feel natural.</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 mb-4">
                      AI has evaluated all opportunities based on the strategy above. Review and adjust the recommendations below. Remember: be selective and focus on quality over quantity.
                    </p>
                  </div>

                  {allOpportunities.length > 0 ? (
                    <div className="space-y-4">
                      {allOpportunities.map((opp) => (
                        <div
                          key={opp.id}
                          className="border border-gray-200 rounded-lg p-4"
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <h4 className="font-medium text-gray-900 mb-1">{opp.title}</h4>
                              <div className="text-xs text-gray-500 mb-2">
                                {opp.url ? (
                                  <a href={opp.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1">
                                    {opp.url}
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                ) : (
                                  <span>No URL yet</span>
                                )}
                              </div>
                              {opp.reason && (
                                <p className="text-xs text-gray-600 italic mb-2">{opp.reason}</p>
                              )}
                              {opp.linkType === 'outbound' && opp.placement && (
                                <p className="text-xs text-gray-600">
                                  <span className="font-medium">Placement:</span> {opp.placement}
                                </p>
                              )}
                              {opp.linkType === 'outbound' && opp.anchorText && (
                                <p className="text-xs text-gray-600">
                                  <span className="font-medium">Anchor text:</span> "{opp.anchorText}"
                                </p>
                              )}
                            </div>
                            <div className="flex gap-2 ml-4">
                              <button
                                onClick={() => handleUpdateLinkType(opp.id, 'none')}
                                className={`px-3 py-1.5 text-xs rounded transition-colors ${
                                  opp.linkType === 'none'
                                    ? 'bg-gray-200 text-gray-700'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                              >
                                No Link
                              </button>
                              <button
                                onClick={() => handleUpdateLinkType(opp.id, 'inbound')}
                                className={`px-3 py-1.5 text-xs rounded transition-colors ${
                                  opp.linkType === 'inbound'
                                    ? 'bg-green-200 text-green-700'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                              >
                                Inbound
                              </button>
                              <button
                                onClick={() => handleUpdateLinkType(opp.id, 'outbound')}
                                className={`px-3 py-1.5 text-xs rounded transition-colors ${
                                  opp.linkType === 'outbound'
                                    ? 'bg-blue-200 text-blue-700'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                              >
                                Outbound
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No opportunities found. Please complete Step 1 first.</p>
                  )}

                  {/* Save Button */}
                  <button
                    onClick={handleSave}
                    disabled={isSaving || allOpportunities.filter(opp => opp.linkType !== 'none').length === 0}
                    className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        Save Internal Links Plan
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    },
  },
};

export default researchInternalLinks;

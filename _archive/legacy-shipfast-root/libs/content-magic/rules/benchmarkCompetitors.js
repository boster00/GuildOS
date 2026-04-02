"use client";
import React, { useState, useEffect, useRef } from "react";
import { Search, Check, ExternalLink, Sparkles, FileText, ChevronRight, Loader, Save, X, Trash2, AlertCircle, Plus } from "lucide-react";
import { toast } from "react-hot-toast";
import { useWritingGuide } from "@/libs/content-magic/context/WritingGuideContext";
import { initMonkey } from "@/libs/monkey";
import { triggerOutOfCreditsBanner, isOutOfCreditsError } from "@/libs/outOfCredits";
import AI_MODELS from "@/config/ai-models";
import CreditCostBadge from "@/components/CreditCostBadge";

/** Normalize URL for deduplication: same origin+path = same page (ignore query/hash, trailing slash). */
function normalizeCompetitorUrl(url) {
  if (!url || typeof url !== "string") return "";
  try {
    const u = new URL(url.trim());
    const path = u.pathname.replace(/\/+$/, "") || "/";
    return `${u.origin.toLowerCase()}${path}`.toLowerCase();
  } catch {
    return String(url).trim().toLowerCase();
  }
}

/** Deduplicate competitor page list by normalized URL; keep first occurrence. */
function deduplicateCompetitorPages(pages) {
  if (!Array.isArray(pages) || pages.length === 0) return pages;
  const seen = new Set();
  return pages.filter((p) => {
    const norm = normalizeCompetitorUrl(p?.url);
    if (!norm || seen.has(norm)) return false;
    seen.add(norm);
    return true;
  });
}

const benchmarkCompetitors = {
  key: "benchmark_competitors",
  pageType: ["all"],
  meta: {
    label: "Benchmark Competitors",
    category: "research_plan",
    description: "Extract topic ideas from competitor pages ranking for your main keyword.",
    defaultActive: true,
    tutorialTitle: "CJGEO Tutorial 3: Benchmarking Competitors: A Step-by-Step Guide 📊",
    tutorialURL: "https://www.loom.com/share/af0975181b2f4e7aa1a8dc90b23cf621",
  },
  DetailsUIDisplayMode: "fullscreen",

  is_complete: (context) => {
    const topics = context.assets?.topics;
    // Support both old format (array of strings) and new format (array of objects)
    if (!topics || !Array.isArray(topics) || topics.length === 0) {
      return false;
    }
    // Check if at least one topic has a non-empty topic text
    return topics.some(t => {
      if (typeof t === 'string') {
        return t.trim().length > 0;
      }
      if (typeof t === 'object' && t !== null) {
        const topicText = t.topic || t.label || t.title || t.name || '';
        return typeof topicText === 'string' && topicText.trim().length > 0;
      }
      return false;
    });
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
            title="Open Competitor Content Ideas"
          >
            <Sparkles className="w-4 h-4" />
          </button>
        </div>
      );
    },

    DetailedUI: ({ rule, context, onUpdate }) => {
      const { updateArticle, article } = useWritingGuide();
      const largeContextModel = AI_MODELS.LARGE_CONTEXT || AI_MODELS.ADVANCED || AI_MODELS.STANDARD;
      
      // Get main keyword from various possible locations
      const initialMainKeyword = context.assets?.main_keyword || 
                                 context.assets?.mainKeyword || 
                                 '';
      
      // Get ICP and Offer info from context
      const icpName = context.icp?.name || article?.icp?.name || '';
      const icpDescription = context.icp?.description || article?.icp?.description || '';
      const offerName = context.offer?.name || article?.offer?.name || '';
      const offerDescription = context.offer?.description || article?.offer?.description || '';
      const articleTitle = context.title || article?.title || '';
      const articleBody = context.content_html || article?.content_html || '';

      // Strip HTML tags from article body for AI analysis
      const stripHtmlTags = (html) => {
        if (!html) return '';
        const tmp = document.createElement('DIV');
        tmp.innerHTML = html;
        return tmp.textContent || tmp.innerText || '';
      };

      // State for the simplified two-step flow
      const [currentStep, setCurrentStep] = useState(1);
      const [mainKeyword, setMainKeyword] = useState(initialMainKeyword);
      const [searchResults, setSearchResults] = useState([]); // Search results (now used directly, not added to separate list)
      const [selectedPagesForAnalysis, setSelectedPagesForAnalysis] = useState([]); // Selected page IDs from search results
      const [topicSuggestions, setTopicSuggestions] = useState([]); // All topics (existing + newly discovered)
      const [isLoading, setIsLoading] = useState(false);
      const [saving, setSaving] = useState(false);
      const [error, setError] = useState(null);
      const [extractionPhase, setExtractionPhase] = useState('idle'); // 'idle' | 'extracting' | 'evaluating' | 'complete'

      // Ephemeral storage for competitor markdown (not persisted)
      // Format: [{ url: string, markdown: string }]
      const [competitorMarkdowns, setCompetitorMarkdowns] = useState([]);
      const [showMarkdownModal, setShowMarkdownModal] = useState(false);
      const [selectedMarkdownUrl, setSelectedMarkdownUrl] = useState('');
      const [selectedMarkdownContent, setSelectedMarkdownContent] = useState('');
      
      // Saved competitor pages (persisted in assets)
      // Format: [{ url: string, domain: string, title: string, content: string, savedAt: string }]
      const [savedCompetitorPages, setSavedCompetitorPages] = useState([]);
      const [showCompetitorPageModal, setShowCompetitorPageModal] = useState(false);
      const [selectedCompetitorPage, setSelectedCompetitorPage] = useState(null);
      const [showManualContentModal, setShowManualContentModal] = useState(false);
      const [manualContentUrl, setManualContentUrl] = useState('');
      const [manualContentValue, setManualContentValue] = useState('');
      const [topicGranularity, setTopicGranularity] = useState(12); // Target number of topics (5-50)
      // URLs currently being fetched for content (show Loading + spinner until extract completes)
      const [contentLoadingUrls, setContentLoadingUrls] = useState([]);
      // Add topic dropdown and form
      const [showAddTopicDropdown, setShowAddTopicDropdown] = useState(false);
      const [addTopicTopic, setAddTopicTopic] = useState('');
      const [addTopicRelevance, setAddTopicRelevance] = useState('high');
      const [addTopicFitness, setAddTopicFitness] = useState('high');
      const [addTopicNotes, setAddTopicNotes] = useState('');
      const [addTopicSources, setAddTopicSources] = useState('');
      const addTopicDropdownRef = useRef(null);
      const topicEvaluationInstructionsFromAssets = context?.assets?.topicEvaluationInstructions ?? article?.assets?.topicEvaluationInstructions ?? '';
      const [topicEvaluationInstructions, setTopicEvaluationInstructions] = useState(topicEvaluationInstructionsFromAssets);
      const lastTopicEvaluationInstructionsFromAssetsRef = useRef(topicEvaluationInstructionsFromAssets);

      // Initialize selected pages for analysis (all selected by default when search results are fetched)
      useEffect(() => {
        if (searchResults.length > 0 && selectedPagesForAnalysis.length === 0) {
          // Auto-select all search results (up to 5)
          const allIds = searchResults.slice(0, 5).map(r => r.id);
          setSelectedPagesForAnalysis(allIds);
        }
      }, [searchResults]);

      // Removed auto-start evaluation - user must manually click "Evaluate selected topics" button

      // Load existing competitor pages from assets on mount (deduplicate by URL when loading)
      // Use article + context as deps so we run when either loads or updates; read from both for robustness
      useEffect(() => {
        const assets = context?.assets ?? article?.assets;
        const savedPages = assets?.competitorPages;
        if (savedPages && Array.isArray(savedPages) && savedPages.length > 0) {
          const deduped = deduplicateCompetitorPages(savedPages);
          setSavedCompetitorPages(prev => {
            if (prev.length > 0) return prev; // Don't overwrite if pages already exist
            return deduped;
          });
          
          // Also populate competitorMarkdowns for analysis (dedupe by normalized URL)
          setCompetitorMarkdowns(prev => {
            const existingNorm = new Set(prev.map(m => normalizeCompetitorUrl(m.url)));
            const newMarkdowns = deduped
              .filter(page => page.content && !existingNorm.has(normalizeCompetitorUrl(page.url)))
              .map(page => ({
                url: page.url,
                markdown: page.content,
              }));
            return [...prev, ...newMarkdowns];
          });
        }
      }, [article, context, context?.assets, article?.assets]); // Load when article/context or assets change

      // Sync topic evaluation instructions from assets when they change (avoid overwriting user edits)
      useEffect(() => {
        const fromAssets = context?.assets?.topicEvaluationInstructions ?? article?.assets?.topicEvaluationInstructions ?? '';
        if (lastTopicEvaluationInstructionsFromAssetsRef.current !== fromAssets) {
          lastTopicEvaluationInstructionsFromAssetsRef.current = fromAssets;
          setTopicEvaluationInstructions(fromAssets || '');
        }
      }, [context?.assets?.topicEvaluationInstructions, article?.assets?.topicEvaluationInstructions]);

      // Load existing topics from assets on mount
      useEffect(() => {
        const savedTopics = context.assets?.topics;
        if (savedTopics && Array.isArray(savedTopics) && savedTopics.length > 0) {
          // Only load if we don't have topics yet
          setTopicSuggestions(prev => {
            if (prev.length > 0) return prev; // Don't overwrite if topics already exist
            
            const getTopicText = (topicData) => {
              if (typeof topicData === 'string') return topicData;
              return (
                topicData.topic ||
                topicData.label ||
                topicData.title ||
                topicData.name ||
                topicData.id ||
                'Untitled topic'
              );
            };

            // Convert saved topics to topicSuggestions format
            return savedTopics.map((topic, idx) => {
              // Handle both old format (string) and new format (object)
              const topicData = typeof topic === 'string' 
                ? { topic, sourceUrl: '', exampleText: '', notes: '' }
                : topic;
              
              return {
                id: `existing-topic-${idx}-${Date.now()}`,
                topic: getTopicText(topicData),
                sourceUrls: topicData.sourceUrl ? [topicData.sourceUrl] : [],
                exampleText: topicData.exampleText || topicData.notes || topicData.label || '',
                notes: topicData.notes || '',
                relevance: topicData.relevance || undefined,
                fitness: topicData.fitness || undefined,
                selected: true, // All existing topics are selected by default
                isExisting: true, // Flag to identify existing topics
              };
            });
          });
        }
      }, [context.assets?.topics]); // Load when assets change

      // Close add-topic dropdown when clicking outside
      useEffect(() => {
        const handleMouseDown = (e) => {
          if (addTopicDropdownRef.current && !addTopicDropdownRef.current.contains(e.target)) {
            setShowAddTopicDropdown(false);
          }
        };
        document.addEventListener('mousedown', handleMouseDown);
        return () => document.removeEventListener('mousedown', handleMouseDown);
      }, []);

      // Step 1: Fetch SERP results for main keyword and auto-fetch contents
      const fetchSerpForMainKeyword = async () => {
        if (!mainKeyword.trim()) {
          setError("Main keyword is required");
          return;
        }

        setIsLoading(true);
        setError(null);
        try {
          const monkey = await initMonkey();
          const text = await monkey.apiCall('/api/content-magic/search', {
            query: mainKeyword,
            maxResults: 5,
          });
          const data = JSON.parse(text);
          
          // Transform to search results format
          const results = (data.results || []).map((result, idx) => ({
            id: `search-result-${Date.now()}-${idx}`,
            title: result.title || result.url,
            url: result.url,
            snippet: result.snippet || '',
          }));

          setSearchResults(results);
          setSelectedPagesForAnalysis(results.slice(0, 5).map(r => r.id)); // Auto-select all (up to 5)

          // Auto-fetch contents for all results
          // Check existing saved pages by normalized URL to avoid duplicate crawls
          const existingNormUrls = new Set(savedCompetitorPages.map(p => normalizeCompetitorUrl(p.url)));
          const urlsToFetch = results
            .map(r => r.url)
            .filter(url => !existingNormUrls.has(normalizeCompetitorUrl(url)));
          
          const newMarkdowns = [];
          const newSavedPages = [];
          
          // Show Loading on content buttons for URLs we're about to fetch
          if (urlsToFetch.length > 0) {
            setContentLoadingUrls(urlsToFetch);
          }
          
          // Use saved content for pages that already exist (match by normalized URL)
          results.forEach(result => {
            const existingPage = savedCompetitorPages.find(saved => normalizeCompetitorUrl(saved.url) === normalizeCompetitorUrl(result.url));
            if (existingPage) {
              newMarkdowns.push({
                url: existingPage.url,
                markdown: existingPage.content,
              });
            }
          });
          
          // Fetch only new pages
          if (urlsToFetch.length > 0) {
            try {
              const monkeyExtract = await initMonkey();
              const extractText = await monkeyExtract.apiCall('/api/content-magic/extract', { urls: urlsToFetch });
              const extractData = JSON.parse(extractText);
              if (extractData) {
                if (extractData.pages && Array.isArray(extractData.pages)) {
                  const seenNorm = new Set();
                  extractData.pages.forEach((page) => {
                    if (page.success && page.content) {
                      const norm = normalizeCompetitorUrl(page.url);
                      if (seenNorm.has(norm)) return; // deduplicate within new pages
                      seenNorm.add(norm);
                      const urlObj = new URL(page.url);
                      const domain = urlObj.hostname.replace('www.', '');
                      const result = results.find(r => normalizeCompetitorUrl(r.url) === norm);
                      
                      newMarkdowns.push({
                        url: page.url,
                        markdown: page.content,
                      });
                      
                      newSavedPages.push({
                        url: page.url,
                        domain: domain,
                        title: result?.title || page.url,
                        content: page.content,
                        savedAt: new Date().toISOString(),
                      });
                    }
                  });
                }
              }
            } catch (fetchErr) {
              // Continue even if auto-fetch fails - user can manually add content
            } finally {
              setContentLoadingUrls(prev => prev.filter(u => !urlsToFetch.some(f => normalizeCompetitorUrl(f) === normalizeCompetitorUrl(u))));
            }

            // Add placeholders for URLs we attempted but got no content (so they appear in step 2 with yellow "Paste content" button)
            const succeededNorm = new Set(newSavedPages.map(p => normalizeCompetitorUrl(p.url)));
            urlsToFetch.forEach((url) => {
              const norm = normalizeCompetitorUrl(url);
              if (succeededNorm.has(norm)) return;
              succeededNorm.add(norm);
              const result = results.find(r => normalizeCompetitorUrl(r.url) === norm);
              try {
                const urlObj = new URL(url);
                const domain = urlObj.hostname.replace('www.', '');
                newSavedPages.push({
                  url: url,
                  domain: domain,
                  title: result?.title || url,
                  content: '',
                  savedAt: new Date().toISOString(),
                });
              } catch (e) {
                newSavedPages.push({
                  url: url,
                  domain: url,
                  title: result?.title || url,
                  content: '',
                  savedAt: new Date().toISOString(),
                });
              }
            });
          }
          
          // Update markdowns (combine existing and new; deduplicate by normalized URL)
          setCompetitorMarkdowns(prev => {
            const combined = [...prev];
            const prevNorm = new Set(combined.map(m => normalizeCompetitorUrl(m.url)));
            newMarkdowns.forEach(newMd => {
              const norm = normalizeCompetitorUrl(newMd.url);
              if (!prevNorm.has(norm)) {
                prevNorm.add(norm);
                combined.push(newMd);
              }
            });
            return combined;
          });
          
          // Save new competitor pages to assets (deduplicate when new pages come back)
          const uniqueNewPages = deduplicateCompetitorPages(newSavedPages).filter(
            page => !existingNormUrls.has(normalizeCompetitorUrl(page.url))
          );
          if (uniqueNewPages.length > 0 && article?.id) {
            try {
              const existingAssets = article.assets || {};
              const existingCompetitorPages = existingAssets.competitorPages || [];
              const updatedCompetitorPages = deduplicateCompetitorPages([...existingCompetitorPages, ...uniqueNewPages]);
              
              // Save using centralized asset manager
              const monkey = await initMonkey();
              const savedAssets = await monkey.articleAssets.savePatch(
                article.id,
                { competitorPages: updatedCompetitorPages },
                existingAssets,
                updateArticle
              );
              
              setSavedCompetitorPages(updatedCompetitorPages);
            } catch (saveErr) {
            }
          }

          // Move to step 2 after fetching
          setCurrentStep(2);
        } catch (err) {
          const msg = err?.message ?? String(err);
          if (isOutOfCreditsError(err)) {
            triggerOutOfCreditsBanner();
            toast.error("Out of credits. Top up to continue.");
          } else if (msg.includes("active external calls") || msg.includes("retry later")) {
            setError(msg);
          } else if (msg.includes("Failed to perform metering")) {
            setError("Unable to complete request. You may be out of credits—check your balance or try again.");
          } else {
            setError(`Failed to fetch competitor pages: ${msg}`);
          }
        } finally {
          setIsLoading(false);
        }
      };

      // Toggle page selection for analysis
      const togglePageForAnalysis = (id) => {
        setSelectedPagesForAnalysis(prev => {
          if (prev.includes(id)) {
            return prev.filter(pid => pid !== id);
          } else {
            if (prev.length >= 5) {
              setError("You can select a maximum of 5 pages for analysis");
              return prev;
            }
            return [...prev, id];
          }
        });
      };

      // Helper: Get markdown for a URL
      const getMarkdownForUrl = (url) => {
        const norm = normalizeCompetitorUrl(url);
        const markdownEntry = competitorMarkdowns.find(m => m.url === url || normalizeCompetitorUrl(m.url) === norm);
        return markdownEntry ? markdownEntry.markdown : null;
      };

      // Fetch markdown for selected pages (bulk)
      const fetchMarkdownForPages = async (pageIds) => {
        const pages = searchResults.filter(p => pageIds.includes(p.id));
        
        // Filter out URLs that already have markdown
        const urlsToFetch = pages
          .map(p => p.url)
          .filter(url => !getMarkdownForUrl(url));

        if (urlsToFetch.length === 0) {
          // All markdowns already fetched, return existing data
          const markdownMap = {};
          competitorMarkdowns.forEach(m => {
            markdownMap[m.url] = m.markdown;
          });
          return markdownMap;
        }

        setIsLoading(true);
        setError(null);
        try {
          const monkey = await initMonkey();
          const text = await monkey.apiCall('/api/content-magic/extract', { urls: urlsToFetch });
          const data = JSON.parse(text);
          const newMarkdowns = [];
          const failedUrls = [];

          // Map results to markdown array
          if (data.pages && Array.isArray(data.pages)) {
            data.pages.forEach((page) => {
              if (page.success && page.content) {
                newMarkdowns.push({
                  url: page.url,
                  markdown: page.content,
                });
              } else {
                // Track failed URLs
                failedUrls.push(page.url);
              }
            });
          }

          // Auto-deselect pages that failed to fetch content
          if (failedUrls.length > 0) {
            setSelectedPagesForAnalysis(prev => {
              const failedPageIds = searchResults
                .filter(p => failedUrls.includes(p.url))
                .map(p => p.id);
              return prev.filter(id => !failedPageIds.includes(id));
            });
          }

          // Add new markdowns to state (merge with existing)
          setCompetitorMarkdowns(prev => {
            const existingUrls = new Set(prev.map(m => m.url));
            const uniqueNew = newMarkdowns.filter(m => !existingUrls.has(m.url));
            return [...prev, ...uniqueNew];
          });

          // Return markdown map for immediate use
          const markdownMap = {};
          [...competitorMarkdowns, ...newMarkdowns].forEach(m => {
            markdownMap[m.url] = m.markdown;
          });
          return markdownMap;
        } catch (err) {
          setError(`Failed to fetch page markdown: ${err.message}`);
          return {};
        } finally {
          setIsLoading(false);
        }
      };

      // Show markdown in popup
      const showMarkdownPopup = (url) => {
        const markdown = getMarkdownForUrl(url);
        if (markdown) {
          setSelectedMarkdownUrl(url);
          setSelectedMarkdownContent(markdown);
          setShowMarkdownModal(true);
        }
      };

      // Open manual content entry modal
      const openManualContentModal = (url) => {
        const existingContent = getMarkdownForUrl(url) || '';
        setManualContentUrl(url);
        setManualContentValue(existingContent);
        setShowManualContentModal(true);
      };

      // Save manually entered content
      const saveManualContent = async () => {
        if (!manualContentUrl || !manualContentValue.trim()) {
          setError("Please enter some content");
          return;
        }

        // Check if this is a saved competitor page or a search result (match by normalized URL)
        const manualNorm = normalizeCompetitorUrl(manualContentUrl);
        const savedPage = savedCompetitorPages.find(p => normalizeCompetitorUrl(p.url) === manualNorm);
        
        if (savedPage) {
          // Update saved competitor page content (update all entries with same normalized URL)
          const updatedPages = savedCompetitorPages.map(p => 
            normalizeCompetitorUrl(p.url) === manualNorm
              ? { ...p, content: manualContentValue.trim() }
              : p
          );
          const deduped = deduplicateCompetitorPages(updatedPages);
          setSavedCompetitorPages(deduped);
          
          // Save to database (persist deduplicated list)
          if (article?.id) {
            try {
              const monkey = await initMonkey();
              await monkey.articleAssets.savePatch(
                article.id,
                { competitorPages: deduped },
                article.assets || {},
                updateArticle
              );
            } catch (err) {
              setError(`Failed to save: ${err.message}`);
            }
          }
        } else {
          // Add or update the markdown for this URL (search results); match by normalized URL to avoid duplicates
          setCompetitorMarkdowns(prev => {
            const manualNorm = normalizeCompetitorUrl(manualContentUrl);
            const existing = prev.find(m => normalizeCompetitorUrl(m.url) === manualNorm);
            if (existing) {
              return prev.map(m =>
                normalizeCompetitorUrl(m.url) === manualNorm
                  ? { ...m, url: manualContentUrl, markdown: manualContentValue.trim() }
                  : m
              );
            }
            return [...prev, { url: manualContentUrl, markdown: manualContentValue.trim() }];
          });

          // Auto-select the page for analysis
          const page = searchResults.find(p => p.url === manualContentUrl);
          if (page && !selectedPagesForAnalysis.includes(page.id)) {
            setSelectedPagesForAnalysis(prev => [...prev, page.id]);
          }
        }

        // Close modal and reset
        setShowManualContentModal(false);
        setManualContentUrl('');
        setManualContentValue('');
      };

      // Extract topics from competitor pages using AI
      const extractTopicsFromCompetitors = async (pageIds, markdownData, pagesOverride = null) => {
        const pages = pagesOverride || searchResults.filter(p => pageIds.includes(p.id));
        
        // Prepare context for AI
        const articleText = stripHtmlTags(articleBody);
        
        const prompt = `You are analyzing competitor pages to extract abstract content purposes/intentions for an article.

🎯 CRITICAL TARGET: You MUST extract EXACTLY ${topicGranularity} topics (acceptable range: ${Math.max(5, Math.floor(topicGranularity * 0.8))}-${Math.min(50, Math.ceil(topicGranularity * 1.2))}). This is a REQUIREMENT, not a suggestion. Count your topics before returning.

CRITICAL EVIDENCE HIERARCHY:
The main keyword ("${mainKeyword}") and article title ("${articleTitle}") are the PRIMARY evidence for determining the article's intent and what topics are relevant.

The ICP description and Offer description serve as CONSTRAINTS, not demands. They provide context for who the article is for and what it's about, but the article addresses a SPECIFIC ASPECT of the ICP/offer, not all their needs. Do not interpret every detail in the ICP/offer as a requirement for topic inclusion.

Article Context:
- Title: ${articleTitle} [PRIMARY EVIDENCE]
- Main Keyword: ${mainKeyword} [PRIMARY EVIDENCE]
- ICP: ${icpName}${icpDescription ? ` - ${icpDescription}` : ''} [CONSTRAINT]
${offerName ? `- Offer: ${offerName}${offerDescription ? ` - ${offerDescription}` : ''} [CONSTRAINT]` : ''}
${articleText ? `- Current Article Content (first 2000 chars): ${articleText.substring(0, 2000)}` : ''}

Competitor Pages to Analyze:
${pages.map((p, idx) => {
          const markdown = markdownData[p.url] || getMarkdownForUrl(p.url) || '';
          return `
Page ${idx + 1}:
- Title: ${p.title}
- URL: ${p.url}
- Content: ${markdown ? markdown.substring(0, 3000) : 'Content not available'}
`;
        }).join('\n')}

Your task:
Extract SPECIFIC, actionable content strategies with concrete implementation details. Your goal is to:
1. Make topics SPECIFIC - include the HOW or a concrete detail
2. Add strategy commentary - explain WHY this approach works (2-3 sentences on psychological/competitive effectiveness)
3. Extract example text - show a specific example (200-300 characters) demonstrating this implementation

CRITICAL - Phrase topics from the END CUSTOMER's perspective:
- Write what the customer gets, experiences, or can do—NOT what the business provides, facilitates, or does for them.
- The topic label should read like a benefit or capability from the customer's point of view (e.g. "Apply discount codes at checkout" not "Providing easy application of promo codes"; "Clear turnaround times and rush options" not "Addressing turnaround time with day guarantees").
❌ BAD (business perspective): "Establishing credibility through certifications", "Offering 24/7 support", "Facilitating easy application of promo codes"
✅ GOOD (customer perspective): "Trust signals like certifications you can verify", "Support available whenever you need it", "Apply discount codes easily at checkout"

CRITICAL - Topics must include specific tactics (still from customer perspective):
❌ BAD: "Establish credibility", "Demonstrate expertise" (too generic)
✅ GOOD: "Peer-reviewed citations you can check", "Specific day guarantees and rush options when you're in a hurry"

Content Filtering:
- IGNORE navigational content (menus, breadcrumbs, site navigation)
- IGNORE footer content (footer links, copyright notices, footer navigation)
- IGNORE any content that appears to be global/shared across pages (headers, sidebars with general links, cookie notices, etc.)
- FOCUS on the main page content - the unique, page-specific content that addresses the topic
- Only extract purposes from content that is specific to the page being analyzed

Important:
- The "topic" field must be phrased from the end customer's perspective (what they get or experience), not the business's (what the company provides). It should be an abstract purpose/intention that can be applied to the article without being anchored to specific source details
- The "exampleText" should show the specific way it was mentioned in the source (this is what you previously called "topic")

DEDUPLICATION:
- Deduplicate overly similar topics by combining them. If two topics serve essentially the same purpose with similar tactics, merge them into one comprehensive topic.
- Focus on distinctness: topics should represent different purposes, approaches, or tactics—not slight variations of the same concept.

${topicGranularity >= 20 
  ? `- CRITICAL: With a target of ${topicGranularity} topics, extract MORE GRANULAR and DISTINCT topics rather than combining them
- When high granularity is requested (${topicGranularity} topics), create separate topics for different approaches, tactics, or implementations even if they serve similar purposes
- Extract distinct topics for: different proof points, different certifications, different value propositions, different use cases, different customer segments, different pain points addressed
- Only combine topics if they are truly identical in approach and implementation
- Aim for maximum granularity to reach the target of ${topicGranularity} topics`
  : `- Combine similar purposes from different pages into single topics when they represent the same approach
- If two pages both talk about how awesome their company is, phrase from customer view: e.g. "Reasons to trust this provider" (not "Company achievements" or business-centric phrasing)`}

Return a JSON array with SPECIFIC topics and strategy commentary:
[
  {
    "topic": "From end-customer perspective: benefit or capability with concrete detail (e.g., 'Accuracy backed by ISO 15189 you can verify', 'Dedicated PhD-level support when you need it')",
    "strategy": "2-3 sentences explaining WHY this approach works and its competitive advantage",
    "sourceUrls": ["https://example.com/page1", "https://example.com/page2"],
    "exampleText": "Specific example from source showing this implementation (200-300 chars)",
    "keyTactics": ["short phrase 1", "specific detail 2", "certification 3"]
  }
]

CRITICAL REQUIREMENTS FOR TOPIC COUNT:
- You MUST extract EXACTLY ${topicGranularity} topics (target: ${topicGranularity}, acceptable range: ${Math.max(5, Math.floor(topicGranularity * 0.8))}-${Math.min(50, Math.ceil(topicGranularity * 1.2))})
- The target count of ${topicGranularity} topics is a REQUIREMENT, not a suggestion
- If you find fewer distinct topics, extract more granular variations (different tactics, different proof points, different implementations)
- If you find more topics, prioritize the most valuable and specific ones to reach exactly ${topicGranularity}
- DO NOT return fewer than ${Math.max(5, Math.floor(topicGranularity * 0.8))} topics
- DO NOT return more than ${Math.min(50, Math.ceil(topicGranularity * 1.2))} topics
- Count your topics before returning - ensure you have approximately ${topicGranularity} topics in your response

Guidelines:
- Anchor each topic to a concrete tactic, certification, number, or proof point
- Strategy field explains the psychological/rhetorical effectiveness
- keyTactics should be 2-5 word phrases that signal value/credibility immediately
- Avoid generic topics that could apply to any product/service
- Each topic should be distinct and actionable

CRITICAL JSON FORMATTING REQUIREMENTS:
- Return ONLY a valid JSON array, no markdown code blocks, no explanatory text
- Ensure all strings are properly escaped (use \\" for quotes inside strings)
- Do NOT include trailing commas
- Ensure all brackets and braces are properly closed
- Each object must have all required fields: topic, strategy, sourceUrls, exampleText, keyTactics
- Validate your JSON before returning - it must be parseable

Return ONLY valid JSON array with approximately ${topicGranularity} topics, no other text.`;
        const trimmedExtractCustom = (topicEvaluationInstructions || '').trim();
        const extractPromptWithInstructions = trimmedExtractCustom
          ? `${prompt}\n\nAdditional instructions from the user:\n${trimmedExtractCustom}`
          : prompt;

        try {
          const monkey = await initMonkey();
          const text = await monkey.apiCall('/api/ai', {
            query: extractPromptWithInstructions,
            model: largeContextModel,
          });
          const data = JSON.parse(text);
          const aiMessage = data.message || data.response || data.result;
          
          // Parse AI response
          let topics = [];
          if (aiMessage) {
            try {
              const trimmed = aiMessage.trim();
              let jsonText = trimmed;
              
              // Extract JSON from markdown code blocks if present
              const jsonBlockMatch = trimmed.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/);
              if (jsonBlockMatch) {
                jsonText = jsonBlockMatch[1].trim();
              } else if (trimmed.startsWith('[')) {
                // Try to find the JSON array - look for the first [ and try to find matching ]
                let bracketCount = 0;
                let startIdx = trimmed.indexOf('[');
                if (startIdx !== -1) {
                  let endIdx = startIdx;
                  for (let i = startIdx; i < trimmed.length; i++) {
                    if (trimmed[i] === '[') bracketCount++;
                    if (trimmed[i] === ']') bracketCount--;
                    if (bracketCount === 0) {
                      endIdx = i;
                      break;
                    }
                  }
                  if (bracketCount === 0) {
                    jsonText = trimmed.substring(startIdx, endIdx + 1);
                  }
                }
              }

              // Try to fix common JSON issues before parsing
              let fixedJson = jsonText;
              
              // Remove trailing commas before closing brackets/braces
              fixedJson = fixedJson.replace(/,(\s*[}\]])/g, '$1');
              
              // Try parsing
              let parsed;
              try {
                parsed = JSON.parse(fixedJson);
              } catch (firstError) {
                // If first attempt fails, try more aggressive fixes
                
                
                // Try to extract individual objects using a more robust regex
                // Match objects that start with { and try to find matching }
                const validObjects = [];
                let currentPos = 0;
                let depth = 0;
                let objStart = -1;
                let inString = false;
                let escapeNext = false;
                
                for (let i = 0; i < fixedJson.length; i++) {
                  const char = fixedJson[i];
                  
                  if (escapeNext) {
                    escapeNext = false;
                    continue;
                  }
                  
                  if (char === '\\') {
                    escapeNext = true;
                    continue;
                  }
                  
                  if (char === '"' && !escapeNext) {
                    inString = !inString;
                    continue;
                  }
                  
                  if (!inString) {
                    if (char === '{') {
                      if (depth === 0) {
                        objStart = i;
                      }
                      depth++;
                    } else if (char === '}') {
                      depth--;
                      if (depth === 0 && objStart !== -1) {
                        // Found a complete object
                        const objStr = fixedJson.substring(objStart, i + 1);
                        try {
                          const obj = JSON.parse(objStr);
                          validObjects.push(obj);
                        } catch (e) {
                          // Try to fix common issues in this object
                          try {
                            let fixedObjStr = objStr
                              .replace(/,(\s*[}\]])/g, '$1') // Remove trailing commas
                              .replace(/([^\\])"/g, '$1\\"') // Escape unescaped quotes (basic attempt)
                              .replace(/^"/, '\\"') // Escape first quote if needed
                              .replace(/"$/g, '\\"'); // Escape last quote if needed
                            
                            // If that doesn't work, try a simpler approach: extract just the fields we need
                            const topicMatch = objStr.match(/"topic"\s*:\s*"([^"]*)"/);
                            const strategyMatch = objStr.match(/"strategy"\s*:\s*"([^"]*)"/);
                            const exampleMatch = objStr.match(/"exampleText"\s*:\s*"([^"]*)"/);
                            const sourceUrlsMatch = objStr.match(/"sourceUrls"\s*:\s*(\[[^\]]*\])/);
                            const keyTacticsMatch = objStr.match(/"keyTactics"\s*:\s*(\[[^\]]*\])/);
                            
                            if (topicMatch) {
                              validObjects.push({
                                topic: topicMatch[1] || '',
                                strategy: strategyMatch ? strategyMatch[1] || '' : '',
                                exampleText: exampleMatch ? exampleMatch[1] || '' : '',
                                sourceUrls: sourceUrlsMatch ? JSON.parse(sourceUrlsMatch[1]) : [],
                                keyTactics: keyTacticsMatch ? JSON.parse(keyTacticsMatch[1]) : []
                              });
                            }
                          } catch (fixError) {
                            
                          }
                        }
                        objStart = -1;
                      }
                    }
                  }
                }
                
                if (validObjects.length > 0) {
                  parsed = validObjects;
                } else {
                  throw firstError;
                }
              }

              topics = Array.isArray(parsed) ? parsed : [];
              
              if (topics.length === 0) {
                
              }
            } catch (parseError) {
              
              throw new Error(`Failed to parse AI response: ${parseError.message}. The AI may have returned malformed JSON. Please try again.`);
            }
          }

          // Transform to TopicSuggestion format with strategy and key tactics
          const suggestions = topics.map((topic, idx) => ({
            id: `topic-${Date.now()}-${idx}`,
            topic: topic.topic || '',
            strategy: topic.strategy || '', // Include strategy commentary
            keyTactics: topic.keyTactics || [], // Include key tactical phrases
            sourceUrls: Array.isArray(topic.sourceUrls) ? topic.sourceUrls : [],
            exampleText: topic.exampleText || '',
            selected: false,
          }));

          // Validate topic count
          const minExpected = Math.max(5, Math.floor(topicGranularity * 0.8));
          const maxExpected = Math.min(50, Math.ceil(topicGranularity * 1.2));
          
          if (suggestions.length < minExpected) {
            const shortfall = minExpected - suggestions.length;
            
            // Store warning message to show user
            suggestions._warning = `Only ${suggestions.length} topics extracted (target: ${topicGranularity}). The AI may need more distinct content or a lower granularity setting.`;
          } else if (suggestions.length > maxExpected) {
            
          }

          return suggestions;
        } catch (err) {
          throw err;
        }
      };

      // Analyze selected competitors
      const analyzeSelectedCompetitors = async () => {
        if (selectedPagesForAnalysis.length === 0) {
          setError("Please select at least one page to analyze");
          return;
        }

        if (selectedPagesForAnalysis.length > 5) {
          setError("Please select a maximum of 5 pages to analyze");
          return;
        }

        setIsLoading(true);
        setError(null);
        
        try {
          // Fetch markdown for selected pages (bulk, only if not already fetched)
          const markdownData = await fetchMarkdownForPages(selectedPagesForAnalysis);
          
          // Extract topics using AI
          const suggestions = await extractTopicsFromCompetitors(selectedPagesForAnalysis, markdownData);
          
          // Check for warning about topic count
          if (suggestions._warning) {
            setError(suggestions._warning);
            // Remove the warning property before processing
            delete suggestions._warning;
          }
          
          // Merge new suggestions with existing topics (don't replace existing ones)
          setTopicSuggestions(prev => {
            // Keep existing topics (those with isExisting flag)
            const existingTopics = prev.filter(t => t.isExisting);
            // Add new suggestions (mark them as not existing, all selected by default)
            const newSuggestions = suggestions.map(s => ({ ...s, isExisting: false, selected: true }));
            // Combine both
            return [...existingTopics, ...newSuggestions];
          });

          // Stay in step 2 to show topics
        } catch (err) {
          setError(`Failed to analyze competitors: ${err.message}`);
        } finally {
          setIsLoading(false);
        }
      };

      // Initialize selected saved pages when entering Step 2 (only pages that have content, so failed-crawl pages stay unchecked)
      useEffect(() => {
        if (currentStep === 2 && selectedSavedPages.length === 0 && savedCompetitorPages.length > 0) {
          const withContent = savedCompetitorPages.filter(p => p.content && String(p.content).trim());
          const pagesToSelect = withContent.slice(0, 5).map(p => p.url);
          setSelectedSavedPages(pagesToSelect);
        }
      }, [currentStep, savedCompetitorPages]);

      // Combined analyze and evaluate flow for Step 2
      const analyzeAndEvaluate = async () => {
        setIsLoading(true);
        setError(null);
        setExtractionPhase('extracting');

        try {
          // Step 1: Extract topics from selected saved competitor pages
          const pagesToAnalyze = savedCompetitorPages.filter(p => selectedSavedPages.includes(p.url)).slice(0, 5);
          
          if (pagesToAnalyze.length === 0) {
            setError("Please select at least one competitor page to analyze");
            setIsLoading(false);
            setExtractionPhase('idle');
            return;
          }

          const pagesMissingContent = pagesToAnalyze.filter(p => !p.content || !String(p.content).trim());
          if (pagesMissingContent.length > 0) {
            setError(
              "Some selected pages are missing content. Open each page in your browser, copy the relevant page content, then paste it here using the \"Paste content\" button next to that page. Analysis will run only when all selected pages have content."
            );
            setIsLoading(false);
            setExtractionPhase('idle');
            return;
          }

          // Prepare markdown data from saved pages
          const markdownData = {};
          pagesToAnalyze.forEach(page => {
            if (page.content) {
              markdownData[page.url] = page.content;
            }
          });

          // Create temporary page IDs for extraction
          const tempPageIds = pagesToAnalyze.map((_, idx) => `saved-page-${idx}`);

          // Mock searchResults for extraction (use saved pages)
          const tempSearchResults = pagesToAnalyze.map((page, idx) => ({
            id: `saved-page-${idx}`,
            url: page.url,
            title: page.title,
          }));

          // Extract topics (pass tempSearchResults as override)
          const suggestions = await extractTopicsFromCompetitors(tempPageIds, markdownData, tempSearchResults);
          
          // Check for warning about topic count
          if (suggestions._warning) {
            setError(suggestions._warning);
            delete suggestions._warning;
          }

          // Merge new suggestions with existing topics
          setTopicSuggestions(prev => {
            // Keep existing topics (those with isExisting flag)
            const existingTopics = prev.filter(t => t.isExisting);
            // Add new suggestions (mark them as not existing, all selected by default)
            const newSuggestions = suggestions.map(s => ({ ...s, isExisting: false, selected: true }));
            // Combine both
            return [...existingTopics, ...newSuggestions];
          });

          // Step 2: Show interim progress and evaluate
          setExtractionPhase('evaluating');
          
          // Wait a moment to show the progress message
          await new Promise(resolve => setTimeout(resolve, 500));

          // Gather all topics to evaluate (both new and existing)
          const allTopicsToEvaluate = [
            ...suggestions.map(s => ({ ...s, isExisting: false, selected: true })),
            ...(context.assets?.topics || []).map((topic, idx) => ({
              id: `existing-topic-${idx}-${Date.now()}`,
              topic: typeof topic === 'string' ? topic : (topic.topic || topic.label || ''),
              sourceUrls: typeof topic === 'object' && topic.sourceUrl ? [topic.sourceUrl] : [],
              exampleText: typeof topic === 'object' ? (topic.exampleText || '') : '',
              notes: typeof topic === 'object' ? (topic.notes || '') : '',
              selected: true,
              isExisting: true,
            }))
          ];

          // Call evaluation on all topics
          await evaluateAllTopics(allTopicsToEvaluate);

          setExtractionPhase('complete');
        } catch (err) {
          setError(`Failed to analyze and evaluate: ${err.message}`);
          setExtractionPhase('idle');
        } finally {
          setIsLoading(false);
        }
      };

      // State for selected saved pages in Step 2
      const [selectedSavedPages, setSelectedSavedPages] = useState([]);

      // Evaluate all topics (new + existing)
      const evaluateAllTopics = async (topicsToEvaluate) => {
        if (!topicsToEvaluate || topicsToEvaluate.length === 0) {
          return;
        }

        const articleText = stripHtmlTags(articleBody);
        const todayDate = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

        const prompt = `You are evaluating content topic ideas for relevance and fitness to an article.

Today's date: ${todayDate}
When judging recency or time-sensitive relevance of topics (e.g. "latest", "current", "2024"), use this date. Do not assume the current year is 2024.

Article Context:
- Title: ${articleTitle}
- ICP: ${icpName}${icpDescription ? ` - ${icpDescription}` : ''}
${offerName ? `- Offer: ${offerName}${offerDescription ? ` - ${offerDescription}` : ''}` : ''}
- Main Keyword: ${mainKeyword}
${articleText ? `- Current Article Content: ${articleText.substring(0, 3000)}` : ''}

CRITICAL EVALUATION HIERARCHY:
1. PRIMARY: Relevance to the main keyword ("${mainKeyword}") and alignment with the article title ("${articleTitle}")
2. SECONDARY: Fit with ICP needs ("${icpName}") - as CONSTRAINTS to ensure appropriateness, NOT as comprehensive coverage demands
3. Value it would add to the article's focused purpose

IMPORTANT: The ICP description and Offer description serve as CONSTRAINTS, not demands. They provide context for who the article is for, but the article addresses a SPECIFIC ASPECT of the ICP/offer, not all their needs. Do not interpret every detail in the ICP/offer as a requirement for topic inclusion.

Topics to Evaluate:
${topicsToEvaluate.map((topic, idx) => `
${idx + 1}. ${topic.topic}
   Sources: ${topic.sourceUrls ? topic.sourceUrls.join(', ') : 'N/A'}
   Example: ${topic.exampleText || 'N/A'}
`).join('\n')}

Your task:
Evaluate each topic based on the criteria above. You MUST eliminate at least 1 topic (mark as relevance/fitness low and explain why in notes). There is no upper limit—eliminate as many as you genuinely find weak, redundant, or off-target. If multiple topics are overly similar (same purpose, similar tactics), flag them in your notes and recommend keeping only the most comprehensive version.
${(topicEvaluationInstructions || '').trim() ? `

Additional instructions from the user (follow these closely):
${(topicEvaluationInstructions || '').trim()}
` : ''}

Return a JSON array with evaluations:
[
  {
    "topic": "Topic description",
    "relevance": "high" | "medium" | "low",
    "fitness": "high" | "medium" | "low",
    "notes": "Brief explanation of why this topic is relevant/not relevant. If duplicate, mention which other topic it duplicates."
  }
]

Return ONLY valid JSON array, no other text.`;

        try {
          const monkey = await initMonkey();
          const text = await monkey.apiCall('/api/ai', {
            query: prompt,
            model: largeContextModel,
          });
          const data = JSON.parse(text);
          const aiMessage = data.message || data.response || data.result;

          // Parse AI response
          let evaluations = [];
          if (aiMessage) {
            try {
              const trimmed = aiMessage.trim();
              let jsonText = trimmed;

              // Try to extract JSON from markdown code blocks
              const jsonBlockMatch = trimmed.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/);
              if (jsonBlockMatch) {
                jsonText = jsonBlockMatch[1].trim();
              } else if (trimmed.startsWith('[')) {
                // Try to find JSON array in the text
                const jsonMatch = trimmed.match(/\[[\s\S]*\]/);
                if (jsonMatch) {
                  jsonText = jsonMatch[0];
                }
              }

              const parsed = JSON.parse(jsonText);
              evaluations = Array.isArray(parsed) ? parsed : [];
            } catch (parseError) {
              throw new Error('Failed to parse AI response. Please try again.');
            }
          }

          // Update topics with evaluation data
          setTopicSuggestions(prev => {
            return prev.map(topic => {
              // Find matching evaluation
              const evaluation = evaluations.find(e => {
                const evalTopic = (e.topic || '').trim().toLowerCase();
                const topicText = topic.topic.trim().toLowerCase();
                return evalTopic === topicText || evalTopic.includes(topicText) || topicText.includes(evalTopic);
              });
              
              if (evaluation) {
                const rel = (evaluation.relevance || 'medium').toLowerCase();
                const fit = (evaluation.fitness || 'medium').toLowerCase();
                // Deselect by default when ranked low on both criteria
                const lowOnBoth = rel === 'low' && fit === 'low';

                return {
                  ...topic,
                  relevance: evaluation.relevance || 'medium',
                  fitness: evaluation.fitness || 'medium',
                  notes: evaluation.notes || '',
                  selected: lowOnBoth ? false : topic.selected,
                };
              }
              
              return topic;
            });
          });
        } catch (err) {
          throw err;
        }
      };

      const handleReevaluate = async () => {
        setIsLoading(true);
        setError(null);
        try {
          await evaluateAllTopics(topicSuggestions);
        } catch (err) {
          setError(`Failed to reevaluate: ${err.message}`);
        } finally {
          setIsLoading(false);
        }
      };

      // Step 3: Evaluate selected topics
      const evaluateSelectedTopics = async () => {
        const selectedTopics = topicSuggestions.filter(t => t.selected);
        if (selectedTopics.length === 0) {
          setError("Please select at least one topic to evaluate");
          return;
        }

        // Store topics to evaluate before clearing state
        const topicsToEvaluate = [...selectedTopics];

        // Uncheck all topics before evaluation
        // setTopicSuggestions(prev => prev.map(t => ({ ...t, selected: false })));

        setIsLoading(true);
        setError(null);

        const articleText = stripHtmlTags(articleBody);
        const todayDate = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

        const prompt = `You are evaluating content topic ideas for relevance and fitness to an article.

Today's date: ${todayDate}
When judging recency or time-sensitive relevance of topics (e.g. "latest", "current", "2024"), use this date. Do not assume the current year is 2024.

Article Context:
- Title: ${articleTitle}
- ICP: ${icpName}${icpDescription ? ` - ${icpDescription}` : ''}
${offerName ? `- Offer: ${offerName}${offerDescription ? ` - ${offerDescription}` : ''}` : ''}
- Main Keyword: ${mainKeyword}
${articleText ? `- Current Article Content: ${articleText.substring(0, 3000)}` : ''}

Topics to Evaluate:
${topicsToEvaluate.map((topic, idx) => `
${idx + 1}. ${topic.topic}
   Sources: ${topic.sourceUrls.join(', ')}
   Example: ${topic.exampleText}
`).join('\n')}

Your task:
Evaluate each topic for:
1. Relevance to the main keyword
2. Alignment with ICP needs
3. Fit with the article's current content and purpose
4. Value it would add to the article

Return a JSON array with evaluations:
[
  {
    "topic": "Topic description",
    "relevance": "high" | "medium" | "low",
    "fitness": "high" | "medium" | "low",
    "notes": "Brief explanation of why this topic is relevant/not relevant"
  }
]

Return ONLY valid JSON array, no other text.`;
        const trimmedTopicCustomSel = (topicEvaluationInstructions || '').trim();
        const promptWithInstructionsSel = trimmedTopicCustomSel
          ? `${prompt}\n\nAdditional instructions from the user:\n${trimmedTopicCustomSel}`
          : prompt;

        try {
          const monkey = await initMonkey();
          const text = await monkey.apiCall('/api/ai', {
            query: promptWithInstructionsSel,
            model: largeContextModel,
          });
          const data = JSON.parse(text);
          const aiMessage = data.message || data.response || data.result;

          // Log the raw response for debugging
          // Parse AI response
          let evaluations = [];
          if (aiMessage) {
            try {
              const trimmed = aiMessage.trim();
              
              
              let jsonText = trimmed;
              
              // Try to extract JSON from markdown code blocks
              const jsonBlockMatch = trimmed.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/);
              if (jsonBlockMatch) {
                jsonText = jsonBlockMatch[1].trim();
              } else if (trimmed.startsWith('[')) {
                // Try to find JSON array in the text
                const jsonMatch = trimmed.match(/\[[\s\S]*\]/);
                if (jsonMatch) {
                  jsonText = jsonMatch[0];
                }
              }

              
              
              const parsed = JSON.parse(jsonText);
              evaluations = Array.isArray(parsed) ? parsed : [];
            } catch (parseError) {
              throw new Error('Failed to parse AI response. Please try again.');
            }
          } else {
          }

          // Helper function to update a topic with evaluation data
          const updateTopicWithEvaluation = (topic, topicsToEvaluate, evaluations) => {
            // Check if this topic was in the topicsToEvaluate (being evaluated)
            const wasEvaluated = topicsToEvaluate.some(st => st.id === topic.id);
            
            // Preserve the current selection state for all topics
            const currentSelection = topic.selected;
            
            if (wasEvaluated) {
              // Find matching evaluation
              const evaluation = evaluations.find(e => {
                const evalTopic = (e.topic || '').trim().toLowerCase();
                const topicText = topic.topic.trim().toLowerCase();
                return evalTopic === topicText || evalTopic.includes(topicText) || topicText.includes(evalTopic);
              });
              const rel = (evaluation?.relevance || 'medium').toLowerCase();
              const fit = (evaluation?.fitness || 'medium').toLowerCase();
              // Deselect by default when ranked low on both criteria
              const lowOnBoth = rel === 'low' && fit === 'low';
              const selectedAfterEval = lowOnBoth ? false : currentSelection;

              return {
                ...topic,
                relevance: evaluation?.relevance || 'medium',
                fitness: evaluation?.fitness || 'medium',
                notes: evaluation?.notes || '',
                selected: selectedAfterEval,
              };
            }
            
            // Not being evaluated, keep current state (don't change selection)
            return {
              ...topic,
              selected: currentSelection, // Preserve current selection state
            };
          };

          // Update all topics with evaluation data
          const updatedSuggestions = topicSuggestions.map(topic => 
            updateTopicWithEvaluation(topic, topicsToEvaluate, evaluations)
          );
          setTopicSuggestions(updatedSuggestions);
        } catch (err) {
          // On error, restore selected state so table doesn't disappear
          setTopicSuggestions(prev => prev.map(t => {
            const wasSelected = topicsToEvaluate.some(tt => tt.id === t.id);
            return wasSelected ? { ...t, selected: true } : t;
          }));
          setError(`Failed to evaluate topics: ${err.message}`);
        } finally {
          setIsLoading(false);
        }
      };

      // Step 3: Save selected topics
      const handleSaveTopics = async () => {
        const finalTopics = topicSuggestions
          .filter(t => t.selected)
          .map(t => ({
            label: t.topic, // Use 'label' as the standard field name
            topic: t.topic, // Keep for backward compatibility
            strategy: t.strategy || '', // Include strategy commentary
            keyTactics: t.keyTactics || [], // Include key tactical phrases
            sourceUrl: (t.sourceUrls && t.sourceUrls.length > 0) ? t.sourceUrls[0] : '',
            exampleText: t.exampleText || '',
            notes: t.notes || t.strategy || '', // Fallback to strategy if notes empty
          }));

        if (finalTopics.length === 0) {
          setError("Please select at least one topic to adopt");
          return;
        }

        setSaving(true);
        setError(null);

        try {
          // Save to database using centralized asset manager
          if (context.id || article?.id) {
            const articleId = context.id || article?.id;
            const monkey = await initMonkey();
            const instructionsToSave = (topicEvaluationInstructions || '').trim();
            await monkey.articleAssets.savePatch(
              articleId,
              { topics: finalTopics, topicEvaluationInstructions: instructionsToSave },
              context.assets,
              updateArticle
            );
          }

          // Close and return
          if (onUpdate) {
            onUpdate();
          }
        } catch (err) {
          setError(`Failed to save topics: ${err.message}`);
        } finally {
          setSaving(false);
        }
      };

      const toggleTopicSelection = (id) => {
        const topic = topicSuggestions.find(t => t.id === id);
        if (!topic) return;

        let updatedTopics;
        setTopicSuggestions(prev => {
          const updated = prev.map(t => 
            t.id === id ? { ...t, selected: !t.selected } : t
          );
          updatedTopics = updated;
          return updated;
        });
        
        // Update article.assets after state is set (outside setState to avoid React warning)
        setTimeout(() => {
          if ((article?.assets || context?.assets) && updatedTopics) {
            const finalTopics = updatedTopics
              .filter(t => t.selected)
              .map(t => ({
                label: t.topic,
                topic: t.topic,
                strategy: t.strategy || '',
                keyTactics: t.keyTactics || [],
                sourceUrl: (t.sourceUrls && t.sourceUrls.length > 0) ? t.sourceUrls[0] : '',
                exampleText: t.exampleText || '',
                notes: t.notes || t.strategy || '',
              }));
            
            const existingAssets = article?.assets || context?.assets || {};
            updateArticle({
              assets: {
                ...existingAssets,
                topics: finalTopics
              }
            });
          }
        }, 0);
      };

      const toggleAllTopics = () => {
        // Only toggle newly discovered topics in Step 2 (not existing ones)
        const newTopics = topicSuggestions.filter(t => !t.isExisting);
        const allSelected = newTopics.length > 0 && newTopics.every(t => t.selected);
        
        let updatedTopics;
        setTopicSuggestions(prev => {
          const updated = allSelected
            ? prev.map(t => t.isExisting ? t : { ...t, selected: false })
            : prev.map(t => t.isExisting ? t : { ...t, selected: true });
          updatedTopics = updated;
          return updated;
        });
        
        // Update article.assets after state is set (outside setState to avoid React warning)
        setTimeout(() => {
          if ((article?.assets || context?.assets) && updatedTopics) {
            const finalTopics = updatedTopics
              .filter(t => t.selected)
              .map(t => ({
                label: t.topic,
                topic: t.topic,
                strategy: t.strategy || '',
                keyTactics: t.keyTactics || [],
                sourceUrl: (t.sourceUrls && t.sourceUrls.length > 0) ? t.sourceUrls[0] : '',
                exampleText: t.exampleText || '',
                notes: t.notes || t.strategy || '',
              }));
            
            const existingAssets = article?.assets || context?.assets || {};
            updateArticle({
              assets: {
                ...existingAssets,
                topics: finalTopics
              }
            });
          }
        }, 0);
      };

      const removeSelectedTopic = (id) => {
        setTopicSuggestions(prev => prev.map(t => t.id === id ? { ...t, selected: false } : t));
      };

      // Map a topic suggestion to the payload shape used in assets and save
      const topicToPayload = (t) => ({
        label: t.topic,
        topic: t.topic,
        strategy: t.strategy || '',
        keyTactics: t.keyTactics || [],
        sourceUrl: (t.sourceUrls && t.sourceUrls.length > 0) ? t.sourceUrls[0] : '',
        exampleText: t.exampleText || '',
        notes: t.notes || t.strategy || '',
      });

      const handleAddTopic = () => {
        const topicText = addTopicTopic?.trim();
        if (!topicText) {
          setError('Topic is required');
          return;
        }
        setError(null);
        const sourceUrls = (addTopicSources || '')
          .split(/[\n,]+/)
          .map(s => s.trim())
          .filter(Boolean);
        const newTopic = {
          id: `manual-topic-${Date.now()}`,
          topic: topicText,
          relevance: addTopicRelevance || 'high',
          fitness: addTopicFitness || 'high',
          notes: addTopicNotes || '',
          sourceUrls,
          strategy: '',
          keyTactics: [],
          exampleText: addTopicNotes || '',
          selected: true,
          isExisting: false,
        };
        setTopicSuggestions(prev => [...prev, newTopic]);
        const currentSelected = topicSuggestions.filter(t => t.selected).map(topicToPayload);
        const finalTopics = [...currentSelected, topicToPayload(newTopic)];
        const existingAssets = article?.assets || context?.assets || {};
        updateArticle({
          assets: {
            ...existingAssets,
            topics: finalTopics,
          },
        });
        setAddTopicTopic('');
        setAddTopicRelevance('high');
        setAddTopicFitness('high');
        setAddTopicNotes('');
        setAddTopicSources('');
        setShowAddTopicDropdown(false);
      };

      // Remove competitor page (by normalized URL so duplicates are removed)
      const removeCompetitorPage = async (urlToRemove) => {
        const removeNorm = normalizeCompetitorUrl(urlToRemove);
        const updatedPages = deduplicateCompetitorPages(
          savedCompetitorPages.filter(page => normalizeCompetitorUrl(page.url) !== removeNorm)
        );
        setSavedCompetitorPages(updatedPages);
        
        setCompetitorMarkdowns(prev => prev.filter(m => normalizeCompetitorUrl(m.url) !== removeNorm));
        
        if (article?.id) {
          try {
            const monkey = await initMonkey();
            await monkey.articleAssets.savePatch(
              article.id,
              { competitorPages: updatedPages },
              article.assets,
              updateArticle
            );
          } catch (err) {
          }
        }
      };

      const truncateTitle = (title, maxLength = 65) => {
        if (!title) return '';
        return title.length > maxLength ? title.substring(0, maxLength) + '...' : title;
      };

      const truncateSnippet = (snippet, maxLength = 300) => {
        if (!snippet) return '';
        return snippet.length > maxLength ? snippet.substring(0, maxLength) + '...' : snippet;
      };

      // Step 2 is enabled if we have selected pages from step 1 OR existing competitor pages with content
      const hasCompetitorPagesWithContent = savedCompetitorPages.some(
        (p) => p?.content && String(p.content).trim().length > 0
      );
      const step2Enabled = hasCompetitorPagesWithContent || selectedPagesForAnalysis.length > 0;

      return (
        <div className="flex h-full">
          {/* Left Sidebar - Step List & Selected Items */}
          <div className="w-80 bg-gray-50 border-r border-gray-200 p-4 space-y-6 overflow-y-auto">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Competitor Content Ideas</h3>
            
            {/* Step Navigation */}
            <div className="space-y-2">
              <button
                onClick={() => setCurrentStep(1)}
                className={`w-full text-left px-3 py-2 rounded text-sm flex items-center gap-2 ${
                  currentStep === 1
                    ? 'bg-blue-100 text-blue-900 font-medium'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                  currentStep === 1 ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-600'
                }`}>
                  1
                </span>
                Search & select competitors
              </button>

              <button
                onClick={() => setCurrentStep(2)}
                disabled={!step2Enabled}
                className={`w-full text-left px-3 py-2 rounded text-sm flex items-center gap-2 ${
                  currentStep === 2
                    ? 'bg-blue-100 text-blue-900 font-medium'
                    : !step2Enabled
                    ? 'text-gray-400 cursor-not-allowed'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                  currentStep === 2 ? 'bg-blue-600 text-white' : 
                  !step2Enabled ? 'bg-gray-200 text-gray-400' : 'bg-gray-300 text-gray-600'
                }`}>
                  2
                </span>
                Extract & evaluate topics
              </button>
            </div>

            {/* Selected Topics */}
            {topicSuggestions.filter(t => t.selected).length > 0 && (
              <div className="border-t border-gray-200 pt-4">
                <h4 className="text-xs font-semibold text-gray-900 mb-2">Selected Topics</h4>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {topicSuggestions.filter(t => t.selected).map((topic) => (
                    <div key={topic.id} className="bg-white border border-gray-200 rounded p-2 text-xs">
                      <div className="font-medium text-gray-900 mb-1">{topic.topic}</div>
                      {topic.exampleText && (
                        <div className="text-gray-600 mb-2 italic">"{truncateSnippet(topic.exampleText, 300)}"</div>
                      )}
                      <button
                        onClick={() => removeSelectedTopic(topic.id)}
                        className="text-red-600 hover:text-red-800 flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Panel - Active Step Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {error && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            {/* Step 1: Search and Auto-fetch Contents */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">1. Search & select competitors</h2>
                  <p className="text-sm text-gray-600 mb-4">
                    Search for competitor pages. We'll automatically fetch their contents and prepare them for analysis.
                  </p>
                </div>

                {/* Main Keyword Input */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Main Keyword
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={mainKeyword}
                      onChange={(e) => setMainKeyword(e.target.value)}
                      placeholder="e.g., VHH antibody discovery service"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <button
                      onClick={fetchSerpForMainKeyword}
                      disabled={isLoading || !mainKeyword.trim()}
                      className="flex-shrink-0 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {isLoading ? (
                        <>
                          <Loader className="w-4 h-4 animate-spin" />
                          Searching...
                        </>
                      ) : (
                        <>
                          <Search className="w-4 h-4" />
                          Search
                          <CreditCostBadge path="/api/content-magic/search" size="sm" />
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Search Results - Select pages to add to competitors list */}
                {searchResults.length > 0 && (
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                      <h4 className="text-sm font-semibold text-gray-900">
                        Select pages to add to competitors list (up to 5)
                      </h4>
                      <p className="text-xs text-gray-600 mt-1">
                        {selectedPagesForAnalysis.length} selected
                      </p>
                    </div>
                    <div className="divide-y divide-gray-200">
                      {searchResults
                        .filter(page => {
                          // Filter out pages that already exist in savedCompetitorPages (by normalized URL)
                          const pageNorm = normalizeCompetitorUrl(page.url);
                          return !savedCompetitorPages.some(saved => normalizeCompetitorUrl(saved.url) === pageNorm && saved.content);
                        })
                        .map((page) => {
                          const isSelected = selectedPagesForAnalysis.includes(page.id);
                          const isDisabled = !isSelected && selectedPagesForAnalysis.length >= 5;
                          const hasMarkdown = !!getMarkdownForUrl(page.url);
                          const isLoadingContent = contentLoadingUrls.some(u => normalizeCompetitorUrl(u) === normalizeCompetitorUrl(page.url));
                          return (
                            <div key={page.id} className={`p-3 ${isDisabled ? 'opacity-50' : ''}`}>
                              <div className="flex items-start gap-3">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => togglePageForAnalysis(page.id)}
                                  disabled={isDisabled}
                                  className="mt-1 w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                />
                                <div className="flex-1">
                                  <div className="font-medium text-sm text-gray-900">{page.title}</div>
                                  <div className="flex items-center gap-2">
                                    <div className="text-xs text-gray-500 break-all">{page.url}</div>
                                    <a
                                      href={page.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
                                      title="Open link in new tab"
                                    >
                                      <ExternalLink className="w-3 h-3" />
                                    </a>
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  {isLoadingContent ? (
                                    <span
                                      className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded inline-flex items-center gap-1"
                                      title="Fetching page content..."
                                    >
                                      <Loader className="w-3 h-3 animate-spin flex-shrink-0" />
                                      Loading
                                    </span>
                                  ) : hasMarkdown ? (
                                    <button
                                      onClick={() => showMarkdownPopup(page.url)}
                                      className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors flex items-center gap-1"
                                    >
                                      <FileText className="w-3 h-3" />
                                      Show content
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => openManualContentModal(page.url)}
                                      className="px-2 py-1 text-xs bg-orange-100 text-orange-700 rounded hover:bg-orange-200 transition-colors flex items-center gap-1"
                                      title="Content not available - click to paste manually"
                                    >
                                      <FileText className="w-3 h-3" />
                                      Paste content
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}

                {/* Previously Saved Competitor Pages */}
                {savedCompetitorPages.length > 0 && (
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                      <h4 className="text-sm font-semibold text-gray-900">
                        Previously saved competitor pages
                      </h4>
                      <p className="text-xs text-gray-600 mt-1">
                        {savedCompetitorPages.length} page(s) already saved
                      </p>
                    </div>
                    <div className="divide-y divide-gray-200">
                      {savedCompetitorPages.map((page, idx) => {
                        let domain = page.domain;
                        if (!domain && page.url) {
                          try {
                            const urlObj = new URL(page.url);
                            domain = urlObj.hostname.replace('www.', '');
                          } catch (e) {
                            domain = page.url;
                          }
                        }
                        return (
                          <div key={idx} className="p-3">
                            <div className="flex items-start gap-3">
                              <Check className="w-4 h-4 text-green-600 mt-1 flex-shrink-0" />
                              <div className="flex-1">
                                <div className="font-medium text-sm text-gray-900">{page.title || domain || page.url}</div>
                                <div className="flex items-center gap-2">
                                  <div className="text-xs text-gray-500 truncate">{domain || page.url}</div>
                                  <a
                                    href={page.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
                                    title="Open link in new tab"
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => {
                                    setManualContentUrl(page.url);
                                    setManualContentValue(page.content || '');
                                    setShowManualContentModal(true);
                                  }}
                                  className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors flex items-center gap-1"
                                  title="View/edit content"
                                >
                                  <FileText className="w-3 h-3" />
                                  View content
                                </button>
                                <button
                                  onClick={() => removeCompetitorPage(page.url)}
                                  className="text-red-600 hover:text-red-800 flex-shrink-0"
                                  title="Remove competitor page"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 flex justify-end">
                      <button
                        onClick={() => setCurrentStep(2)}
                        disabled={!savedCompetitorPages.some((p) => p?.content && String(p.content).trim().length > 0)}
                        className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        <ChevronRight className="w-4 h-4" />
                        Proceed to Step 2
                      </button>
                    </div>
                  </div>
                )}

                {/* Proceed to Analyze Button */}
                {searchResults.length > 0 && selectedPagesForAnalysis.length > 0 && (
                  <div className="flex justify-end">
                    <button
                      onClick={async () => {
                        // Save selected pages to competitorPages before proceeding
                        setIsLoading(true);
                        setError(null);
                        try {
                          const selectedPages = searchResults
                            .filter(r => selectedPagesForAnalysis.includes(r.id))
                            .filter(r => getMarkdownForUrl(r.url)); // Only include pages with content

                          if (selectedPages.length === 0) {
                            setError("Selected pages don't have content yet. Please paste content or wait for auto-fetch to complete.");
                            setIsLoading(false);
                            return;
                          }

                          // Prepare pages to save; deduplicate when new pages come back (by normalized URL)
                          const pagesToAdd = selectedPages.map(page => {
                            const urlObj = new URL(page.url);
                            const domain = urlObj.hostname.replace('www.', '');
                            return {
                              url: page.url,
                              domain: domain,
                              title: page.title || page.url,
                              content: getMarkdownForUrl(page.url),
                              savedAt: new Date().toISOString(),
                            };
                          });
                          const uniqueNewPages = deduplicateCompetitorPages(pagesToAdd).filter(
                            p => !savedCompetitorPages.some(saved => normalizeCompetitorUrl(saved.url) === normalizeCompetitorUrl(p.url))
                          );
                          const updatedCompetitorPages = deduplicateCompetitorPages([...savedCompetitorPages, ...uniqueNewPages]);

                          // Save to database
                          if (article?.id) {
                            const monkey = await initMonkey();
                            await monkey.articleAssets.savePatch(
                              article.id,
                              { competitorPages: updatedCompetitorPages },
                              article.assets || {},
                              updateArticle
                            );
                          }

                          setSavedCompetitorPages(updatedCompetitorPages);
                          setCurrentStep(2);
                        } catch (err) {
                          setError(`Failed to save competitor pages: ${err.message}`);
                        } finally {
                          setIsLoading(false);
                        }
                      }}
                      disabled={isLoading || selectedPagesForAnalysis.length === 0}
                      className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {isLoading ? (
                        <>
                          <Loader className="w-4 h-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <ChevronRight className="w-4 h-4" />
                          Proceed to analyze
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Step 2: Extract & Evaluate Topics (Combined) */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">2. Extract & evaluate topics</h2>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                    <p className="text-sm text-gray-800 leading-relaxed font-medium mb-2 flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                      <span>Important: This step extracts topics from competitors and evaluates them for fit.</span>
                    </p>
                    <p className="text-sm text-gray-700 leading-relaxed">
                      Review the AI evaluation carefully and decide which topics to include. The AI assessment provides relevance and fitness scores based on your main keyword and article title (primary), with ICP/offer as constraints (secondary). Use your judgment to make final decisions.
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">
                    Custom instructions for topic evaluation (optional)
                  </label>
                  <textarea
                    value={topicEvaluationInstructions}
                    onChange={(e) => setTopicEvaluationInstructions(e.target.value)}
                    placeholder="e.g. Prefer topics that support a comparison table; avoid how-to steps."
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
                  />
                  {extractionPhase === 'complete' && (
                    <div className="mt-3">
                      <button
                        onClick={handleReevaluate}
                        disabled={isLoading}
                        className="px-4 py-2 bg-purple-100 text-purple-800 rounded-lg hover:bg-purple-200 transition-colors font-medium disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {isLoading ? (
                          <>
                            <Loader className="w-4 h-4 animate-spin" />
                            Evaluating...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4" />
                            Reevaluate with custom instructions
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {/* Select Saved Competitor Pages for Analysis */}
                {extractionPhase === 'idle' && savedCompetitorPages.length > 0 && (
                  <>
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                        <h4 className="text-sm font-semibold text-gray-900">
                          Select competitor pages to analyze (up to 5)
                        </h4>
                        <p className="text-xs text-gray-600 mt-1">
                          {selectedSavedPages.length} selected
                        </p>
                      </div>
                      <div className="divide-y divide-gray-200">
                        {savedCompetitorPages.map((page, idx) => {
                          const isSelected = selectedSavedPages.includes(page.url);
                          const isDisabled = !isSelected && selectedSavedPages.length >= 5;
                          let domain = page.domain;
                          if (!domain && page.url) {
                            try {
                              const urlObj = new URL(page.url);
                              domain = urlObj.hostname.replace('www.', '');
                            } catch (e) {
                              domain = page.url;
                            }
                          }
                          return (
                            <div key={idx} className={`p-3 ${isDisabled ? 'opacity-50' : ''}`}>
                              <div className="flex items-start gap-3">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => {
                                    if (isSelected) {
                                      setSelectedSavedPages(prev => prev.filter(url => url !== page.url));
                                    } else {
                                      if (selectedSavedPages.length < 5) {
                                        setSelectedSavedPages(prev => [...prev, page.url]);
                                      } else {
                                        setError("You can select a maximum of 5 pages for analysis");
                                      }
                                    }
                                  }}
                                  disabled={isDisabled}
                                  className="mt-1 w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                />
                                <div className="flex-1">
                                  <div className="font-medium text-sm text-gray-900">{page.title || domain || page.url}</div>
                                  <div className="flex items-center gap-2">
                                    <div className="text-xs text-gray-500 truncate">{domain || page.url}</div>
                                    <a
                                      href={page.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
                                      title="Open link in new tab"
                                    >
                                      <ExternalLink className="w-3 h-3" />
                                    </a>
                                  </div>
                                </div>
                                {page.content && String(page.content).trim() ? (
                                  <button
                                    onClick={() => {
                                      setManualContentUrl(page.url);
                                      setManualContentValue(page.content || '');
                                      setShowManualContentModal(true);
                                    }}
                                    className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors flex items-center gap-1"
                                    title="View/edit content"
                                  >
                                    <FileText className="w-3 h-3" />
                                    View content
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => {
                                      setManualContentUrl(page.url);
                                      setManualContentValue(page.content || '');
                                      setShowManualContentModal(true);
                                    }}
                                    className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded hover:bg-yellow-200 transition-colors flex items-center gap-1"
                                    title="Content not available - click to paste manually"
                                  >
                                    <FileText className="w-3 h-3" />
                                    Paste content
                                  </button>
                                )}
                                <button
                                  onClick={() => {
                                    setSelectedSavedPages(prev => prev.filter(u => u !== page.url));
                                    removeCompetitorPage(page.url);
                                  }}
                                  className="text-red-600 hover:text-red-800 flex-shrink-0"
                                  title="Remove from competitors"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Number of topics slider */}
                    <div className="border border-gray-200 rounded-lg p-4">
                      <label className="block text-sm font-medium text-gray-900 mb-2">
                        Target number of topics
                      </label>
                      <div className="flex items-center gap-4">
                        <input
                          type="range"
                          min={5}
                          max={50}
                          value={topicGranularity}
                          onChange={(e) => setTopicGranularity(Number(e.target.value))}
                          className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                        />
                        <span className="text-sm font-medium text-gray-700 w-8">{topicGranularity}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        How many distinct topics to extract from competitor pages (5–50)
                      </p>
                    </div>

                    {/* Analyze Button */}
                    <div className="flex justify-end">
                      <button
                        onClick={analyzeAndEvaluate}
                        disabled={isLoading || selectedSavedPages.length === 0}
                        className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {isLoading ? (
                          <>
                            <Loader className="w-4 h-4 animate-spin" />
                            Analyzing...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4" />
                            Analyze selected competitors
                            <CreditCostBadge path="/api/ai" size="sm" />
                          </>
                        )}
                      </button>
                    </div>
                  </>
                )}

                {/* Progress Messages */}
                {extractionPhase === 'extracting' && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center gap-3">
                    <Loader className="w-5 h-5 animate-spin text-blue-600" />
                    <div>
                      <p className="text-sm font-medium text-blue-900">Extracting topics from competitor pages...</p>
                      <p className="text-xs text-blue-700 mt-1">Analyzing {selectedSavedPages.length} competitor page(s)</p>
                    </div>
                  </div>
                )}

                {extractionPhase === 'evaluating' && (
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 flex items-center gap-3">
                    <Loader className="w-5 h-5 animate-spin text-purple-600" />
                    <div>
                      <p className="text-sm font-medium text-purple-900">Topics extracted ({topicSuggestions.filter(t => !t.isExisting).length} found), evaluating fitness now...</p>
                      <p className="text-xs text-purple-700 mt-1">Evaluating relevance and fitness against your main keyword and article title</p>
                    </div>
                  </div>
                )}

                {/* New Topics to Add */}
                {extractionPhase === 'complete' && topicSuggestions.filter(t => !t.isExisting).length > 0 && (
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="bg-green-50 px-4 py-2 border-b border-green-200">
                      <h4 className="text-sm font-semibold text-green-900">
                        New topics to add ({topicSuggestions.filter(t => !t.isExisting).length})
                      </h4>
                      <p className="text-xs text-green-700 mt-1">Extracted from competitor analysis</p>
                    </div>
                    <div className="divide-y divide-gray-200">
                      <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-700">
                        <div className="col-span-1 flex items-center">
                          <input
                            type="checkbox"
                            checked={topicSuggestions.filter(t => !t.isExisting).length > 0 && topicSuggestions.filter(t => !t.isExisting).every(t => t.selected)}
                            onChange={toggleAllTopics}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                            title="Select all new topics"
                          />
                        </div>
                        <div className="col-span-3">Topic</div>
                        <div className="col-span-2">Relevance</div>
                        <div className="col-span-2">Fitness</div>
                        <div className="col-span-3">Notes</div>
                        <div className="col-span-1">Sources</div>
                      </div>
                      {topicSuggestions.filter(t => !t.isExisting).map((topic) => (
                        <div key={topic.id} className="grid grid-cols-12 gap-2 px-4 py-3 hover:bg-gray-50">
                          <div className="col-span-1 flex items-center">
                            <input
                              type="checkbox"
                              checked={topic.selected}
                              onChange={() => toggleTopicSelection(topic.id)}
                              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                            />
                          </div>
                          <div className="col-span-3 text-sm font-medium text-gray-900">{topic.topic}</div>
                          <div className="col-span-2">
                            {topic.relevance ? (
                              <span className={`text-xs px-2 py-1 rounded ${
                                topic.relevance === 'high' ? 'bg-green-100 text-green-800' :
                                topic.relevance === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {topic.relevance}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400">Evaluating...</span>
                            )}
                          </div>
                          <div className="col-span-2">
                            {topic.fitness ? (
                              <span className={`text-xs px-2 py-1 rounded ${
                                topic.fitness === 'high' ? 'bg-green-100 text-green-800' :
                                topic.fitness === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {topic.fitness}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400">Evaluating...</span>
                            )}
                          </div>
                          <div className="col-span-3 text-xs text-gray-600">{topic.notes || '-'}</div>
                          <div className="col-span-1 flex items-center gap-1 flex-wrap">
                            {topic.sourceUrls && topic.sourceUrls.length > 0 ? (
                              topic.sourceUrls.map((url, idx) => (
                                <a
                                  key={idx}
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-800 transition-colors"
                                  title={url}
                                >
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              ))
                            ) : (
                              <span className="text-xs text-gray-400">-</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Existing Topics */}
                {extractionPhase === 'complete' && topicSuggestions.filter(t => t.isExisting).length > 0 && (
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="bg-blue-50 px-4 py-2 border-b border-blue-200">
                      <h4 className="text-sm font-semibold text-blue-900">
                        Existing topics ({topicSuggestions.filter(t => t.isExisting).length})
                      </h4>
                      <p className="text-xs text-blue-700 mt-1">Previously saved from earlier analyses</p>
                    </div>
                    <div className="divide-y divide-gray-200">
                      <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-700">
                        <div className="col-span-1">Keep</div>
                        <div className="col-span-3">Topic</div>
                        <div className="col-span-2">Relevance</div>
                        <div className="col-span-2">Fitness</div>
                        <div className="col-span-3">Notes</div>
                        <div className="col-span-1">Sources</div>
                      </div>
                      {topicSuggestions.filter(t => t.isExisting).map((topic) => (
                        <div key={topic.id} className="grid grid-cols-12 gap-2 px-4 py-3 hover:bg-gray-50">
                          <div className="col-span-1 flex items-center">
                            <input
                              type="checkbox"
                              checked={topic.selected}
                              onChange={() => toggleTopicSelection(topic.id)}
                              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                            />
                          </div>
                          <div className="col-span-3 text-sm font-medium text-gray-900">{topic.topic}</div>
                          <div className="col-span-2">
                            {topic.relevance ? (
                              <span className={`text-xs px-2 py-1 rounded ${
                                topic.relevance === 'high' ? 'bg-green-100 text-green-800' :
                                topic.relevance === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {topic.relevance}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400">Evaluating...</span>
                            )}
                          </div>
                          <div className="col-span-2">
                            {topic.fitness ? (
                              <span className={`text-xs px-2 py-1 rounded ${
                                topic.fitness === 'high' ? 'bg-green-100 text-green-800' :
                                topic.fitness === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {topic.fitness}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400">Evaluating...</span>
                            )}
                          </div>
                          <div className="col-span-3 text-xs text-gray-600">{topic.notes || '-'}</div>
                          <div className="col-span-1 flex items-center gap-1 flex-wrap">
                            {topic.sourceUrls && topic.sourceUrls.length > 0 ? (
                              topic.sourceUrls.map((url, idx) => (
                                <a
                                  key={idx}
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-800 transition-colors"
                                  title={url}
                                >
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              ))
                            ) : (
                              <span className="text-xs text-gray-400">-</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Save Topics / Add topic bar */}
                {extractionPhase === 'complete' && (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <p className="text-sm text-gray-700 mb-4">
                      Selected topics: <strong>{topicSuggestions.filter(t => t.selected).length}</strong>
                    </p>
                    <div className="flex justify-end items-center gap-2 flex-wrap">
                      <div className="relative" ref={addTopicDropdownRef}>
                        <button
                          type="button"
                          onClick={() => setShowAddTopicDropdown(prev => !prev)}
                          className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors font-medium flex items-center gap-2"
                        >
                          <Plus className="w-4 h-4" />
                          Add topic
                        </button>
                        {showAddTopicDropdown && (
                          <div className="absolute top-full left-0 mt-1 z-50 min-w-[320px] bg-white border border-gray-200 rounded-lg shadow-lg p-4">
                            <div className="space-y-3">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Topic</label>
                                <input
                                  type="text"
                                  value={addTopicTopic}
                                  onChange={(e) => setAddTopicTopic(e.target.value)}
                                  placeholder="e.g., Clear turnaround times and rush options"
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Relevance (optional)</label>
                                <select
                                  value={addTopicRelevance}
                                  onChange={(e) => setAddTopicRelevance(e.target.value)}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                                >
                                  <option value="high">high</option>
                                  <option value="medium">medium</option>
                                  <option value="low">low</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Fitness (optional)</label>
                                <select
                                  value={addTopicFitness}
                                  onChange={(e) => setAddTopicFitness(e.target.value)}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                                >
                                  <option value="high">high</option>
                                  <option value="medium">medium</option>
                                  <option value="low">low</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
                                <textarea
                                  value={addTopicNotes}
                                  onChange={(e) => setAddTopicNotes(e.target.value)}
                                  rows={2}
                                  placeholder="Optional notes"
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Sources (optional)</label>
                                <textarea
                                  value={addTopicSources}
                                  onChange={(e) => setAddTopicSources(e.target.value)}
                                  rows={2}
                                  placeholder="One URL per line or comma-separated"
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                                />
                              </div>
                              <div className="flex justify-end gap-2 pt-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setShowAddTopicDropdown(false);
                                    setAddTopicTopic('');
                                    setAddTopicRelevance('high');
                                    setAddTopicFitness('high');
                                    setAddTopicNotes('');
                                    setAddTopicSources('');
                                  }}
                                  className="px-3 py-1.5 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={handleAddTopic}
                                  className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                                >
                                  Add
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                      <button
                        onClick={handleSaveTopics}
                        disabled={saving || topicSuggestions.filter(t => t.selected).length === 0}
                        className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {saving ? (
                          <>
                            <Loader className="w-4 h-4 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4" />
                            Save topics
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Markdown Popup Modal */}
            {showMarkdownModal && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col m-4">
                  <div className="flex items-center justify-between p-4 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900">Page Content</h3>
                    <div className="flex items-center gap-2">
                      <a
                        href={selectedMarkdownUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800"
                        title={selectedMarkdownUrl}
                      >
                        <ExternalLink className="w-5 h-5" />
                      </a>
                      <button
                        onClick={() => {
                          setShowMarkdownModal(false);
                          setSelectedMarkdownUrl('');
                          setSelectedMarkdownContent('');
                        }}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4">
                    <div className="text-xs text-gray-500 mb-2 break-all">{selectedMarkdownUrl}</div>
                    <pre className="whitespace-pre-wrap text-sm text-gray-700 font-mono bg-gray-50 p-4 rounded border border-gray-200">
                      {selectedMarkdownContent}
                    </pre>
                  </div>
                </div>
              </div>
            )}

            {/* Manual Content Entry Modal */}
            {showManualContentModal && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col m-4">
                  <div className="flex items-center justify-between p-4 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900">Manually Add Page Content</h3>
                    <button
                      onClick={() => {
                        setShowManualContentModal(false);
                        setManualContentUrl('');
                        setManualContentValue('');
                      }}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <h4 className="text-sm font-semibold text-blue-900 mb-2">Instructions:</h4>
                      <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                        <li>Open the competitor page in a new tab: <a href={manualContentUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-1">
                          Open page <ExternalLink className="w-3 h-3 inline" />
                        </a></li>
                        <li>Select and copy all the main content text from the page (excluding navigation, footer, etc.)</li>
                        <li>Paste the content into the text area below</li>
                        <li>Click "Save Content" to use this content for analysis</li>
                      </ol>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Page URL:
                      </label>
                      <div className="text-sm text-gray-600 break-all bg-gray-50 p-2 rounded border border-gray-200">
                        {manualContentUrl}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Page Content: <span className="text-gray-500 font-normal">(paste the text content here)</span>
                      </label>
                      <textarea
                        value={manualContentValue}
                        onChange={(e) => setManualContentValue(e.target.value)}
                        placeholder="Paste the page content here..."
                        className="w-full h-64 p-3 border border-gray-300 rounded-lg font-mono text-sm resize-y focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Characters: {manualContentValue.length}
                      </p>
                    </div>
                  </div>
                  <div className="flex justify-end gap-3 p-4 border-t border-gray-200">
                    <button
                      onClick={() => {
                        setShowManualContentModal(false);
                        setManualContentUrl('');
                        setManualContentValue('');
                      }}
                      className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={saveManualContent}
                      disabled={!manualContentValue.trim()}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      <Save className="w-4 h-4" />
                      Save Content
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Competitor Page Content Modal */}
            {showCompetitorPageModal && selectedCompetitorPage && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
                  <div className="flex items-center justify-between p-4 border-b border-gray-200">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-gray-900 truncate">{selectedCompetitorPage.title}</h3>
                      <p className="text-sm text-gray-500 truncate mt-1">{selectedCompetitorPage.url}</p>
                    </div>
                    <button
                      onClick={() => {
                        setShowCompetitorPageModal(false);
                        setSelectedCompetitorPage(null);
                      }}
                      className="ml-4 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors flex-shrink-0"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4">
                    <div className="prose prose-sm max-w-none">
                      <pre className="whitespace-pre-wrap text-xs text-gray-700 font-mono bg-gray-50 p-4 rounded border border-gray-200">
                        {selectedCompetitorPage.content}
                      </pre>
                    </div>
                  </div>
                  <div className="flex justify-end gap-3 p-4 border-t border-gray-200">
                    <a
                      href={selectedCompetitorPage.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-2"
                    >
                      Open in new tab
                      <ExternalLink className="w-4 h-4" />
                    </a>
                    <button
                      onClick={() => {
                        setShowCompetitorPageModal(false);
                        setSelectedCompetitorPage(null);
                      }}
                      className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      );
    },
  },
};

export default benchmarkCompetitors;

"use client";
import React, { useState, useCallback } from "react";
import { Image, Loader, ChevronDown, ChevronUp, Sparkles, Copy, Check, AlertCircle, Info } from "lucide-react";
import { toast } from "react-hot-toast";
import { useWritingGuide } from "@/libs/content-magic/context/WritingGuideContext";

// Universal Enrichment Opportunities (UEOs) Registry
const UEO_REGISTRY = [
  // QUICK WINS
  {
    id: 'decision-guide',
    name: 'Decision guide',
    description: 'A structured guide helping visitors make informed decisions. Helps with conversion and reduces bounce rate.',
    category: 'quick_win',
    outputType: 'content',
    tags: ['conversion', 'ux', 'engagement'],
    exampleUse: 'After the main value proposition, before the CTA section'
  },
  {
    id: 'pros-cons-list',
    name: 'Pros & cons list',
    description: 'A balanced comparison list showing advantages and limitations. Builds trust and helps with decision-making.',
    category: 'quick_win',
    outputType: 'content',
    tags: ['trust', 'transparency', 'conversion'],
    exampleUse: 'Within the main content section, after explaining the solution'
  },
  {
    id: 'compare-vs-competitors',
    name: 'Compare with competitors',
    description: 'A comparison table highlighting your unique advantages over major competitors. Differentiates your offering.',
    category: 'quick_win',
    outputType: 'content',
    tags: ['differentiation', 'competitive', 'conversion'],
    exampleUse: 'After the main features section, before pricing'
  },
  {
    id: 'faqs-internal-links',
    name: 'FAQs with internal links',
    description: 'Frequently asked questions with links to related pages. Improves SEO, user experience, and site navigation.',
    category: 'quick_win',
    outputType: 'content',
    tags: ['seo', 'navigation', 'engagement'],
    exampleUse: 'At the bottom of the page, before footer'
  },
  {
    id: 'key-facts-panel',
    name: 'Key facts bullet panel',
    description: 'A scannable panel highlighting critical information. Improves readability and helps users quickly grasp essentials.',
    category: 'quick_win',
    outputType: 'content',
    tags: ['readability', 'scannability', 'ux'],
    exampleUse: 'In the sidebar or as a highlighted box within the content'
  },
  {
    id: 'prompt-like-headings',
    name: 'Prompt-like headings',
    description: 'Headings written in a question or action format that match search intent. Improves SEO and user engagement.',
    category: 'quick_win',
    outputType: 'prompt',
    tags: ['seo', 'headings', 'intent'],
    exampleUse: 'Throughout the article, replacing generic headings'
  },
  {
    id: 'location-clarifier',
    name: 'Location clarifier',
    description: 'Clear information about service areas, locations, or availability. Reduces confusion and improves relevance.',
    category: 'quick_win',
    outputType: 'content',
    tags: ['local-seo', 'clarity', 'conversion'],
    exampleUse: 'Near the top of the page, after the headline'
  },
  // AI ASSISTED UEOs
  {
    id: 'interactive-comparison-tabs',
    name: 'Interactive comparison (tab content) copy',
    description: 'Tabbed comparison content that helps users explore different options. Requires thoughtful structure and clear value propositions.',
    category: 'ai_assisted',
    outputType: 'content',
    tags: ['engagement', 'interactive', 'conversion'],
    exampleUse: 'As a dedicated section, replacing or supplementing static comparison content'
  },
  {
    id: 'use-case-vignettes',
    name: 'Use case vignette snippets',
    description: 'Short, relatable scenarios showing how your solution solves specific problems. Builds empathy and demonstrates value.',
    category: 'ai_assisted',
    outputType: 'content',
    tags: ['storytelling', 'empathy', 'conversion'],
    exampleUse: 'Scattered throughout the content, or as a dedicated "How it works" section'
  },
  {
    id: 'misconceptions-corrections',
    name: 'Misconceptions & corrections block',
    description: 'Addresses common misunderstandings about your service or industry. Builds trust and preempts objections.',
    category: 'ai_assisted',
    outputType: 'content',
    tags: ['trust', 'objection-handling', 'education'],
    exampleUse: 'After the main value proposition, before detailed features'
  },
  {
    id: 'pain-mistake-fix-patterns',
    name: 'Pain → mistake → fix patterns',
    description: 'Structured content showing common mistakes and how your solution prevents or fixes them. Demonstrates expertise.',
    category: 'ai_assisted',
    outputType: 'content',
    tags: ['expertise', 'education', 'conversion'],
    exampleUse: 'Within the main content, as case study-like sections'
  },
  {
    id: 'people-also-ask-cluster',
    name: 'People also ask cluster',
    description: 'A section addressing related questions users might have. Improves SEO and provides comprehensive information.',
    category: 'ai_assisted',
    outputType: 'content',
    tags: ['seo', 'comprehensiveness', 'engagement'],
    exampleUse: 'After the main content, before FAQs or conclusion'
  },
  {
    id: 'self-contained-qa-blocks',
    name: 'Self-contained Q&A answer blocks',
    description: 'Standalone Q&A blocks that can be used in rich snippets or featured snippets. Optimized for voice search and featured results.',
    category: 'ai_assisted',
    outputType: 'content',
    tags: ['seo', 'featured-snippets', 'voice-search'],
    exampleUse: 'Throughout the content, or as a dedicated Q&A section'
  },
  // FOOD FOR THOUGHT
  {
    id: 'sticky-cta',
    name: 'Sticky CTA idea',
    description: 'A call-to-action that remains visible as users scroll. Increases conversion opportunities without being intrusive.',
    category: 'food_for_thought',
    outputType: 'prompt',
    tags: ['conversion', 'ux', 'cta'],
    exampleUse: 'As a floating element or fixed position element'
  },
  {
    id: 'meet-team-bios',
    name: 'Meet the team bios',
    description: 'Short bios of key team members. Builds trust, humanizes the brand, and can improve E-E-A-T signals.',
    category: 'food_for_thought',
    outputType: 'prompt',
    tags: ['trust', 'eeat', 'brand'],
    exampleUse: 'As a dedicated "About" or "Team" section'
  },
  {
    id: 'downloadables',
    name: 'Downloadables',
    description: 'Offer downloadable resources (checklists, guides, templates) in exchange for contact information. Generates leads.',
    category: 'food_for_thought',
    outputType: 'prompt',
    tags: ['lead-gen', 'value-add', 'conversion'],
    exampleUse: 'As a sidebar widget or inline content upgrade'
  },
  {
    id: 'micro-copy-tooltips',
    name: 'Micro-copy tooltips',
    description: 'Helpful tooltips explaining technical terms or providing additional context. Improves accessibility and user understanding.',
    category: 'food_for_thought',
    outputType: 'prompt',
    tags: ['ux', 'accessibility', 'education'],
    exampleUse: 'On technical terms, pricing elements, or complex features'
  },
  {
    id: 'social-proof-widget',
    name: 'Social proof widget',
    description: 'Dynamic display of recent activity, testimonials, or user counts. Builds trust and creates urgency.',
    category: 'food_for_thought',
    outputType: 'prompt',
    tags: ['trust', 'social-proof', 'conversion'],
    exampleUse: 'In the sidebar, header, or as a floating element'
  },
  {
    id: 'progress-indicator',
    name: 'Progress indicator',
    description: 'Visual indicator showing reading progress or completion status. Improves engagement and reduces bounce rate.',
    category: 'food_for_thought',
    outputType: 'prompt',
    tags: ['engagement', 'ux', 'retention'],
    exampleUse: 'As a top-of-page progress bar or reading time indicator'
  },
  {
    id: 'related-content-suggestions',
    name: 'Related content suggestions',
    description: 'Smart suggestions for related articles or resources. Increases time on site and improves navigation.',
    category: 'food_for_thought',
    outputType: 'prompt',
    tags: ['engagement', 'navigation', 'seo'],
    exampleUse: 'At the end of the article, before footer'
  },
  {
    id: 'interactive-calculator',
    name: 'Interactive calculator/widget',
    description: 'A tool that helps users calculate value, savings, or outcomes. Highly engaging and demonstrates expertise.',
    category: 'food_for_thought',
    outputType: 'prompt',
    tags: ['engagement', 'value-demo', 'conversion'],
    exampleUse: 'As a dedicated section or sidebar widget'
  }
];

const enrichOptimizeUx = {
  key: "enrich_optimize_ux",
  pageType: ["all"],
  meta: {
    label: "Apply UEOs",
    category: "write_optimize",
    description: "Universal Enrichment Opportunities: Get AI-generated content snippets and prompts to enhance UX, SEO, and AI visibility.",
    defaultActive: true,
  },
  DetailsUIDisplayMode: "rightside",

  is_complete: (context) => {
    const completedSteps = context.assets?.completed_steps || [];
    return completedSteps.includes("enrich_optimize_ux");
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
            title="Enrich and Optimize UX"
          >
            <Image className="w-4 h-4" />
          </button>
        </div>
      );
    },

    DetailedUI: ({ rule, context, onUpdate }) => {
      const { updateArticle, getEditorHtml, article } = useWritingGuide();
      const [activeTab, setActiveTab] = useState('quick_win');
      const [expandedUeos, setExpandedUeos] = useState(new Set());
      const [suggestions, setSuggestions] = useState(
        context.assets?.ueo?.suggestions || {}
      );
      const [loadingUeos, setLoadingUeos] = useState(new Set());
      const [copiedIds, setCopiedIds] = useState(new Set());

      const quickWins = UEO_REGISTRY.filter(ueo => ueo.category === 'quick_win');
      const aiAssisted = UEO_REGISTRY.filter(ueo => ueo.category === 'ai_assisted');
      const foodForThought = UEO_REGISTRY.filter(ueo => ueo.category === 'food_for_thought');

      const toggleUeoExpansion = useCallback((ueoId) => {
        setExpandedUeos(prev => {
          const next = new Set(prev);
          if (next.has(ueoId)) {
            next.delete(ueoId);
          } else {
            next.add(ueoId);
          }
          return next;
        });
      }, []);

      const handleGenerateSuggestion = useCallback(async (ueoId) => {
        const ueo = UEO_REGISTRY.find(u => u.id === ueoId);
        if (!ueo) return;

        setLoadingUeos(prev => new Set(prev).add(ueoId));

        try {
          // Get article content
          const articleContent = getEditorHtml() || context.content_html || context.content || '';
          const articleTitle = context.title || article?.title || 'Untitled';

          // Build campaign context from article/context (ICP from context.icpId)
          const icpId = context?.context?.icpId || article?.context?.icpId;
          const campaignContext = {
            icp: icpId ? {
              id: icpId,
              name: context.icp?.name || context.icpName || article?.icp?.name || '',
              mindset: context.icp?.mindset || article?.icp?.mindset || '',
            } : null,
            title: articleTitle,
            pageType: context.pageType || context.type || article?.type || article?.pageType || '',
          };

          const { initMonkey } = await import('@/libs/monkey');
          const monkey = await initMonkey();
          const text = await monkey.apiCall('/api/content-magic/ueo/suggest', {
            ueoId,
            ueoName: ueo.name,
            ueoDescription: ueo.description,
            ueoCategory: ueo.category,
            ueoOutputType: ueo.outputType,
            article: {
              title: articleTitle,
              content: articleContent,
            },
            campaignContext,
          });
          const data = JSON.parse(text);
          if (data.error) throw new Error(data.error || 'Failed to generate suggestion');
          const newSuggestions = {
            ...suggestions,
            [ueoId]: data,
          };
          setSuggestions(newSuggestions);

          // Save to assets
          const currentAssets = context.assets || {};
          updateArticle({
            assets: {
              ...currentAssets,
              ueo: {
                ...(currentAssets.ueo || {}),
                suggestions: newSuggestions,
              },
            },
          });
        } catch (error) {
          toast.error(`Failed to generate suggestion: ${error.message}`);
        } finally {
          setLoadingUeos(prev => {
            const next = new Set(prev);
            next.delete(ueoId);
            return next;
          });
        }
      }, [context, article, getEditorHtml, updateArticle, suggestions]);

      const handleCopy = useCallback(async (ueoId, text) => {
        try {
          await navigator.clipboard.writeText(text);
          setCopiedIds(prev => new Set(prev).add(ueoId));
          setTimeout(() => {
            setCopiedIds(prev => {
              const next = new Set(prev);
              next.delete(ueoId);
              return next;
            });
          }, 2000);
        } catch (error) {
          toast.error('Failed to copy to clipboard');
        }
      }, []);

      const renderUeoItem = (ueo) => {
        const hasSuggestion = !!suggestions[ueo.id];
        const isExpanded = expandedUeos.has(ueo.id);
        const isLoading = loadingUeos.has(ueo.id);
        const isCopied = copiedIds.has(ueo.id);

        return (
          <div key={ueo.id} className="border border-gray-200 rounded-lg mb-2 bg-white">
            {/* UEO Header */}
            <div className="p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-sm font-semibold text-gray-900">{ueo.name}</h4>
                    {hasSuggestion && (
                      <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 rounded">
                        Suggestion ready
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-600 mb-2">{ueo.description}</p>
                  {ueo.exampleUse && (
                    <p className="text-xs text-gray-500 italic">Example: {ueo.exampleUse}</p>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 mt-2">
                {ueo.category !== 'food_for_thought' && (
                  <button
                    onClick={() => handleGenerateSuggestion(ueo.id)}
                    disabled={isLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors"
                  >
                    {isLoading ? (
                      <>
                        <Loader className="w-3 h-3 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3 h-3" />
                        Generate suggestion
                      </>
                    )}
                  </button>
                )}
                {hasSuggestion && (
                  <button
                    onClick={() => toggleUeoExpansion(ueo.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
                  >
                    {isExpanded ? (
                      <>
                        <ChevronUp className="w-3 h-3" />
                        Hide
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-3 h-3" />
                        View suggestion
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Expanded Suggestion View */}
            {isExpanded && hasSuggestion && (
              <div className="border-t border-gray-200 p-3 bg-gray-50">
                <div className="space-y-3">
                  {/* Summary */}
                  {suggestions[ueo.id].summary && (
                    <div>
                      <h5 className="text-xs font-semibold text-gray-700 mb-1">Why this helps:</h5>
                      <p className="text-xs text-gray-600">{suggestions[ueo.id].summary}</p>
                    </div>
                  )}

                  {/* Title (if provided) */}
                  {suggestions[ueo.id].title && (
                    <div>
                      <h5 className="text-xs font-semibold text-gray-700 mb-1">Suggested title:</h5>
                      <p className="text-xs text-gray-900 font-medium">{suggestions[ueo.id].title}</p>
                    </div>
                  )}

                  {/* Body */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <div>
                        <h5 className="text-xs font-semibold text-gray-700">
                          {suggestions[ueo.id].suggestionType === 'content_snippet' 
                            ? 'HTML content (ready to paste):' 
                            : 'Prompt template:'}
                        </h5>
                        {suggestions[ueo.id].suggestionType === 'content_snippet' && (
                          <p className="text-xs text-gray-500 mt-0.5">Copy and paste this HTML directly into your editor</p>
                        )}
                      </div>
                      <button
                        onClick={() => handleCopy(ueo.id, suggestions[ueo.id].body)}
                        className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded transition-colors"
                      >
                        {isCopied ? (
                          <>
                            <Check className="w-3 h-3" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            Copy
                          </>
                        )}
                      </button>
                    </div>
                    <div className="bg-white border border-gray-300 rounded p-2 max-h-48 overflow-y-auto">
                      <pre className="text-xs text-gray-800 whitespace-pre-wrap font-mono">
                        {suggestions[ueo.id].body}
                      </pre>
                    </div>
                  </div>

                  {/* Notes */}
                  {suggestions[ueo.id].notes && (
                    <div className="bg-amber-50 border border-amber-200 rounded p-2">
                      <div className="flex items-start gap-1.5">
                        <Info className="w-3 h-3 text-amber-600 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-800">{suggestions[ueo.id].notes}</p>
                      </div>
                    </div>
                  )}

                  {/* User Responsibility Note */}
                  <div className="bg-blue-50 border border-blue-200 rounded p-2">
                    <div className="flex items-start gap-1.5">
                      <AlertCircle className="w-3 h-3 text-blue-600 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-blue-800">
                        <strong>Review and adapt</strong> this {suggestions[ueo.id].suggestionType === 'content_snippet' ? 'snippet' : 'prompt'} before adding it to your page. Do not paste blindly.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      };

      return (
        <div className="space-y-6">
          {/* Header */}
          <div className="p-3 border-b border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-purple-600" />
              <h3 className="text-sm font-semibold text-gray-900">Universal Enrichment Opportunities</h3>
            </div>
            <p className="text-xs text-gray-600 mb-2">
              Optional content enhancements to improve UX, SEO, and AI visibility. CJGEO suggests content or prompts; you review and apply them manually.
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded p-2">
              <div className="flex items-start gap-1.5">
                <AlertCircle className="w-3 h-3 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800">
                  <strong>Your responsibility:</strong> Review every suggestion. Not all UEOs fit every page or buyer mindset. You gate and adapt these ideas to your context.
                </p>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab('quick_win')}
              className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
                activeTab === 'quick_win'
                  ? 'bg-purple-50 text-purple-700 border-b-2 border-purple-600'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              Quick wins ({quickWins.length})
            </button>
            <button
              onClick={() => setActiveTab('ai_assisted')}
              className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
                activeTab === 'ai_assisted'
                  ? 'bg-purple-50 text-purple-700 border-b-2 border-purple-600'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              AI assisted ({aiAssisted.length})
            </button>
            <button
              onClick={() => setActiveTab('food_for_thought')}
              className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
                activeTab === 'food_for_thought'
                  ? 'bg-purple-50 text-purple-700 border-b-2 border-purple-600'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              Food for thought ({foodForThought.length})
            </button>
          </div>

          {/* Tab Content */}
          <div className="p-3 max-h-[60vh] overflow-y-auto">
            {activeTab === 'quick_win' && (
              <div>
                <p className="text-xs text-gray-600 mb-3">
                  Simple, high-impact enrichments that AI can support with straightforward snippets or prompts.
                </p>
                <div className="space-y-2">
                  {quickWins.map(ueo => renderUeoItem(ueo))}
                </div>
              </div>
            )}

            {activeTab === 'ai_assisted' && (
              <div>
                <p className="text-xs text-gray-600 mb-3">
                  More nuanced enrichments where AI can help generate a good starting point. These are stronger starting points, not drop-in final blocks.
                </p>
                <div className="space-y-2">
                  {aiAssisted.map(ueo => renderUeoItem(ueo))}
                </div>
              </div>
            )}

            {activeTab === 'food_for_thought' && (
              <div>
                <p className="text-xs text-gray-600 mb-3">
                  Ideas and inspiration only. No generation buttons. These are prompts for your creativity.
                </p>
                <div className="space-y-2">
                  {foodForThought.map(ueo => (
                    <div key={ueo.id} className="border border-gray-200 rounded-lg p-3 bg-white">
                      <h4 className="text-sm font-semibold text-gray-900 mb-1">{ueo.name}</h4>
                      <p className="text-xs text-gray-600 mb-2">{ueo.description}</p>
                      {ueo.exampleUse && (
                        <p className="text-xs text-gray-500 italic">Example: {ueo.exampleUse}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Mark as Complete */}
          {(() => {
            const completedSteps = context.assets?.completed_steps || [];
            const isComplete = completedSteps.includes("enrich_optimize_ux");
            
            if (isComplete) {
              return (
                <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg text-center">
                  ✓ This step is marked as complete
                </div>
              );
            }
            
            return (
              <button
                onClick={async () => {
                  const currentAssets = context.assets || {};
                  const currentCompletedSteps = currentAssets.completed_steps || [];
                  if (!currentCompletedSteps.includes("enrich_optimize_ux")) {
                    updateArticle({
                      assets: {
                        ...currentAssets,
                        completed_steps: [...currentCompletedSteps, "enrich_optimize_ux"],
                      },
                    });
                  }
                }}
                className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Mark as Complete
              </button>
            );
          })()}
        </div>
      );
    },
  },
};

export default enrichOptimizeUx;


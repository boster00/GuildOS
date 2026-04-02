"use client";

import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { FileText, Loader, AlertCircle, ExternalLink, ChevronDown } from "lucide-react";
import { toast } from "react-hot-toast";
import { useWritingGuide } from "@/libs/content-magic/context/WritingGuideContext";
import { createClient } from "@/libs/supabase/client";
import { findResultHtmlFile } from "@/libs/content-magic/outlineAssembly";
import { extractEditorContent } from "@/libs/content-magic/utils/extractEditorContent";
import { buildAdoptedHtmlForShadow } from "@/libs/content-magic/utils/adoptDraftNew";
import { fetchCampaignContext } from "@/libs/content-magic/utils/campaignContextCache";
import { initOffers } from "@/libs/offers/class";
import CreditCostBadge from "@/components/CreditCostBadge";
import { renderShadowDOM } from "@/libs/content-magic/utils/renderShadowDOM";

// Asset configuration with formatting rules (whitelist for security)
// ICP and Offer (with transactional_facts) are default context; others are optional assets
const ASSET_CONFIGS = [
  {
    key: 'icp',
    label: 'ICP (Ideal Customer Profile)',
    path: 'context.icp',
    format: (value) => {
      if (!value || typeof value !== 'object') return '';
      const name = value.name || value.title || '';
      const desc = value.description || value.desc || '';
      if (!name && !desc) return '';
      let text = 'ICP (Ideal Customer Profile):\n';
      if (name) text += `${name}\n`;
      if (desc) text += `${desc}\n`;
      return text + '\n';
    }
  },
  {
    key: 'offer',
    label: 'Offer details (incl. transactional facts)',
    path: 'context.offer',
    format: (value) => {
      if (!value || typeof value !== 'object') return '';
      const name = value.name || value.title || '';
      const desc = value.description || value.desc || '';
      const transactionalFacts = value.transactional_facts || value.transactionalFacts || '';
      if (!name && !desc && !transactionalFacts) return '';
      let text = 'Offer:\n';
      if (name) text += `Name: ${name}\n`;
      if (desc) text += `Description: ${desc}\n`;
      if (transactionalFacts) text += `Transactional facts (key details for the page):\n${transactionalFacts}\n`;
      return text + '\n';
    }
  },
  {
    key: 'main_keyword',
    label: 'Main Keyword',
    path: 'assets.main_keyword',
    format: (value) => `Main Keyword: ${value}\n\n`
  },
  {
    key: 'topics',
    label: 'Topics',
    path: 'assets.topics',
    format: (value) => {
      if (!Array.isArray(value) || value.length === 0) return '';
      let text = `Topics to Cover:\n`;
      value.forEach(t => {
        const topicText = t.topic || t.label || t.title || '';
        if (topicText) text += `- ${topicText}\n`;
      });
      return text + '\n';
    }
  },
  {
    key: 'keywords',
    label: 'Keywords',
    path: 'assets.keywords',
    format: (value) => {
      if (!Array.isArray(value) || value.length === 0) return '';
      let text = `Keywords to Incorporate:\n`;
      value.forEach(kw => {
        const kwText = kw.keyword_text || kw.keyword || '';
        if (kwText) text += `- ${kwText}\n`;
      });
      return text + '\n';
    }
  },
  {
    key: 'prompts',
    label: 'Target Prompts',
    path: 'assets.prompts',
    format: (value) => {
      if (!Array.isArray(value) || value.length === 0) return '';
      let text = `Prompts to Address:\n`;
      value.forEach(p => {
        const promptText = p.prompt || p.text || '';
        if (promptText) text += `- ${promptText}\n`;
      });
      return text + '\n';
    }
  }
];

// Default prompts by template type
const DEFAULT_PROMPTS = {
  infer_from_competitors: "Generate a webpage based on provided competitor pages and context information using classic web structure patterns. Analyze competitor structure, section coverage, content depth, and messaging strategy, then generate a differentiated outline tailored to our ICP and offer. Benchmark competitors for topic coverage and section order rather than word count. Include recommended visual modules (hero media, diagrams, proof visuals) as placeholders where appropriate. Target 6–10 sections (maximum 10).",
  landing_page: "Generate a conversion-focused landing page outline using classic landing page structure: hero (headline, subheadline, primary CTA, supporting visual), problem or pain amplification, solution overview, key benefits, feature highlights, social proof, objection handling or FAQ, and final CTA. Include at least one visual or media module (image, diagram, or video placeholder). Focus on clear value proposition, conversion flow, and decision clarity.",
  informational: "Generate an informational page outline using classic educational content structure: introduction and context setting, core concept explanation, how it works or process explanation, practical guidance or how-to, common mistakes or pitfalls, decision guidance or when to use, FAQ, and next steps or related resources. Include suggested visual aids such as diagrams, charts, or workflow illustrations as placeholders. Optimize for clarity, search intent coverage, and user understanding.",
  product_category: "Generate a product category or catalog page outline using classic ecommerce category structure: category hero and value proposition, category explanation or buying context, filter and navigation strategy, product listing grid structure, featured or recommended product groupings, how to choose or comparison guidance, trust signals or policies, and clear browse or quote CTAs. Include category hero imagery and product card image requirements as placeholders. Optimize for browsing, comparison, and product discovery.",
  product_details: "Generate a product details page outline using classic product detail page structure: hero with product name, positioning, primary CTA, and required image gallery or media module (gallery can include product images, packaging, workflow visuals, or validation figures as placeholders), product overview or description, feature and benefit breakdown, specifications or technical details table, visual evidence or validation media section, use cases or applications, social proof or reviews, FAQ, and final CTA. Focus on single product conversion and decision confidence.",
  homepage: "Generate a homepage outline using classic homepage structure: hero with primary value proposition, primary CTA, and supporting visual, audience or use-case routing section, core offerings or solution pillars, differentiators or key benefits, proof and credibility signals, how it works or process overview, featured products/services/resources, and final CTA. Include hero visual and at least one supporting visual module placeholder. Support browse, demo, or contact goals.",
  lead_landing_page: "Generate a lead-capture landing page outline using classic lead generation structure: hero with offer value statement, supporting visual of the asset or result, single primary form CTA, what the user receives or offer contents, who the offer is for, benefit summary, trust signals or proof, FAQ including privacy reassurance, and final CTA reinforcement. Optimize strictly for form submission and clarity of value exchange.",
  trial_sign_up: "Generate a trial or sign-up page outline using classic SaaS trial conversion structure: hero with trial value statement, product screenshot or demo visual placeholder, primary trial CTA, what happens after signup or onboarding steps, key benefits and use cases, time-to-value explanation placeholder, proof or testimonials, pricing or billing clarity placeholder if applicable, FAQ including cancellation or support, and final trial CTA. Focus on reducing signup friction and increasing trial starts."
};

const createOutline = {
  key: "create_outline",
  assetKeys: ["icp", "offer", "main_keyword", "topics", "keywords", "prompts"],
  pageType: ["all"],
  meta: {
    label: "Edit Draft",
    category: "write_optimize",
    description: "Generate a comprehensive draft for your article using AI. You can generate a new draft from competitors or improve your existing draft—choose a tab and configure below.",
    defaultActive: true,
    tutorialTitle: "CJGEO Tutorial 7.1: creating a new draft",
    tutorialURL: "https://www.loom.com/share/619c66b751ad4330a081fe70bc60c0a9",
  },
  DetailsUIDisplayMode: "fullscreen",

  is_complete: (context) => {
    // Check if the editor contains multiple (>1) sections.
    const html = context?.content_html;
    if (!html || typeof html !== 'string') return false;

    // A "section" is generally an <h2> or <section> in the HTML structure.
    // We'll count the number of <h2> or <section> tags in the HTML.

    // Match <h2> tags
    const h2Matches = html.match(/<h2\b[^>]*>/gi) || [];
    // Match <section> tags
    const sectionMatches = html.match(/<section\b[^>]*>/gi) || [];

    const numSections = h2Matches.length + sectionMatches.length;

    return numSections > 1;
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
            title="Edit Draft"
          >
            <FileText className="w-4 h-4" />
          </button>
        </div>
      );
    },

    DetailedUI: ({ rule, context, onUpdate }) => {
      const { article, updateArticle, setEditorHtml, closeRuleModal, customCssEnabled } = useWritingGuide();
      const previewContainerRef = useRef(null);
      /** Start time (ms) for poll scheduling: first auto-poll 30s after this moment. */
      const pollAnchorMsRef = useRef(Date.now());
      const failedDismissedRef = useRef(false);

      const FAIL_GRACE_MS = 3 * 60 * 1000;
      const POLL_INTERVAL_MS = 30_000;
      const FIRST_POLL_AFTER_ANCHOR_MS = 30_000;
      const KICK_THRESHOLD_MS = 15 * 60 * 1000;

      // Get result HTML from outline.files (exclude input files: competitor, current-page, custom-templates, reference)
      const getOutlineHtmlFromFiles = (outline) => {
        if (!outline?.files || !Array.isArray(outline.files)) return null;
        const resultHtml = findResultHtmlFile(outline.files);
        return resultHtml?.content ?? null;
      };

      // Get value from article using dot notation path
      // Fallback: ICP and offer can come from assets (directIcp/directOffer) when fetched by context.icpId/offerId
      const getAssetValue = (path) => {
        let value = path.split('.').reduce((obj, key) => obj?.[key], article);
        if (!value && path === 'context.icp') {
          value = article?.assets?.directIcp || article?.assets?.campaignContext?.icp;
        }
        if (!value && path === 'context.offer') {
          value = article?.assets?.directOffer || article?.assets?.campaignContext?.offer;
        }
        return value;
      };

      // Available assets: always show all 6 (ICP, Offer, Main Keyword, Topics, Keywords, Target Prompts)
      const availableAssets = useMemo(() => [...ASSET_CONFIGS], []);

      // State management
      const [selectedCompetitors, setSelectedCompetitors] = useState([]);
      const [selectedAssets, setSelectedAssets] = useState(
        availableAssets.map(a => a.key) // All checked by default
      );
      const [contextPrompt, setContextPrompt] = useState('');
      const [templateType, setTemplateType] = useState('infer_from_competitors');
      const [userPrompt, setUserPrompt] = useState(DEFAULT_PROMPTS.infer_from_competitors);
      const [loading, setLoading] = useState(false);
      const [isRendering, setIsRendering] = useState(false);
      const [renderStartTime, setRenderStartTime] = useState(null);
      const [refreshing, setRefreshing] = useState(false);
      const [result, setResult] = useState(null);
      /** Shown in UI only for improve-tab validation (not network/API errors). */
      const [formError, setFormError] = useState(null);
      const [rendering, setRendering] = useState(false);
      const [includeStyles, setIncludeStyles] = useState(true);
      const [useCustomTemplates, setUseCustomTemplates] = useState(false);
      const [allowGeneratingCustomCss, setAllowGeneratingCustomCss] = useState(false);
      const [allowImageGeneration, setAllowImageGeneration] = useState(false);
      const [fileMode] = useState(true); // Always on; toggle hidden for now
      const [customTemplatesAvailable, setCustomTemplatesAvailable] = useState(false);
      const [showNoTemplatesPopup, setShowNoTemplatesPopup] = useState(false);
      const [showFeedbackModal, setShowFeedbackModal] = useState(false);
      const [feedbackMessage, setFeedbackMessage] = useState('');
      const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
      const [retrying, setRetrying] = useState(false);
      const [feedbackError, setFeedbackError] = useState(null);
      const [sessionHydrated, setSessionHydrated] = useState(false);
      const [lastKickAtMs, setLastKickAtMs] = useState(null);
      const [kicking, setKicking] = useState(false);
      /** Bumps when kick cooldown ends so showKickTheBox can recompute. */
      const [kickCooldownTick, setKickCooldownTick] = useState(0);

      const logDraftNetworkError = useCallback((step, err) => {
        const msg = err?.message ?? String(err);
        console.log('[Edit Draft]', step, msg);
      }, []);
      // Edit Draft tabs: generate (new draft) | improve (existing draft)
      const [activeTab, setActiveTab] = useState('generate');
      const [improvementInstructions, setImprovementInstructions] = useState('');
      const [improveCoverageOption, setImproveCoverageOption] = useState('instructions_only'); // 'instructions_only' | 'also_cover_assets'

      // Competitor pages from assets
      const competitorPages = useMemo(() => {
        return article?.assets?.competitorPages || [];
      }, [article]);

      // Current page content for Improve Existing Draft workflow
      const currentPageContent = useMemo(() => {
        const html = article?.content_html || '';
        if (!html || typeof html !== 'string' || html.trim().length === 0) return '';
        return extractEditorContent(html);
      }, [article?.content_html]);

      const applyOutlineToWorkflow = useCallback((outline) => {
        if (!outline || typeof outline !== 'object' || Object.keys(outline).length === 0) {
          setIsRendering(false);
          setResult(null);
          return;
        }
        const st = outline.status;
        const hasIndexHtml =
          Array.isArray(outline.files) && outline.files.some((f) => f?.name === 'index.html');
        const sessionStartMs =
          outline.startedAt || outline.queued_at
            ? new Date(outline.startedAt || outline.queued_at).getTime()
            : Date.now();

        if (st === 'failed') {
          if (failedDismissedRef.current) {
            setResult(null);
            setIsRendering(false);
            return;
          }
          const age =
            outline.startedAt || outline.queued_at
              ? Date.now() - sessionStartMs
              : FAIL_GRACE_MS;
          if (age < FAIL_GRACE_MS) {
            setIsRendering(true);
            setRenderStartTime(outline.startedAt || outline.queued_at);
            pollAnchorMsRef.current = Math.min(pollAnchorMsRef.current, sessionStartMs);
            setResult(null);
            return;
          }
          setResult(outline);
          setIsRendering(false);
          return;
        }

        if (st === 'rendering' || st === 'queued' || st === 'sending') {
          setIsRendering(true);
          setRenderStartTime(outline.startedAt);
          pollAnchorMsRef.current = Math.min(pollAnchorMsRef.current, sessionStartMs);
          setResult({ ...outline, files: [], content_html: undefined });
          return;
        }

        if (st === 'completed') {
          if (hasIndexHtml) {
            setResult(outline);
            setIsRendering(false);
          } else {
            setIsRendering(true);
            setRenderStartTime(outline.startedAt);
            pollAnchorMsRef.current = sessionStartMs;
          }
          return;
        }

        if ((outline.demoUrl || outline.demo || outline.url) && hasIndexHtml) {
          setResult({
            ...outline,
            status: 'completed',
            demoUrl: outline.demoUrl || outline.demo || outline.url,
          });
          setIsRendering(false);
        } else if ((outline.demoUrl || outline.demo || outline.url) && !hasIndexHtml) {
          setIsRendering(true);
          setRenderStartTime(outline.startedAt);
          pollAnchorMsRef.current = sessionStartMs;
        } else {
          setIsRendering(false);
          setResult(null);
        }
      }, []);

      // Check if rendering session is stale (>20 minutes)
      const isRenderingStale = useMemo(() => {
        if (!isRendering || !renderStartTime) return false;
        
        try {
          const startTime = new Date(renderStartTime);
          const now = new Date();
          const diffMs = now - startTime;
          const twentyMinutesMs = 20 * 60 * 1000; // 20 minutes in milliseconds
          
          return diffMs > twentyMinutesMs;
        } catch (err) {

          return false;
        }
      }, [isRendering, renderStartTime]);

      const showKickTheBox = useMemo(() => {
        void kickCooldownTick;
        if (!isRendering || loading) return false;
        const o = article?.outline;
        const chatId = result?.chatId || o?.chatId;
        if (!chatId || !o) return false;
        const anchor = o.queued_at || o.startedAt;
        if (!anchor) return false;
        const anchorMs = new Date(anchor).getTime();
        if (Number.isNaN(anchorMs)) return false;
        if (Date.now() - anchorMs <= KICK_THRESHOLD_MS) return false;
        if (lastKickAtMs != null && Date.now() - lastKickAtMs < KICK_THRESHOLD_MS) {
          return false;
        }
        return true;
      }, [
        isRendering,
        loading,
        article?.outline,
        article?.outline?.queued_at,
        article?.outline?.startedAt,
        result?.chatId,
        lastKickAtMs,
        kickCooldownTick,
      ]);

      useEffect(() => {
        if (!isRendering || lastKickAtMs == null) return;
        const remaining = lastKickAtMs + KICK_THRESHOLD_MS - Date.now();
        if (remaining <= 0) return;
        const t = setTimeout(() => setKickCooldownTick((x) => x + 1), remaining + 500);
        return () => clearTimeout(t);
      }, [isRendering, lastKickAtMs]);

      useEffect(() => {
        setLastKickAtMs(null);
      }, [article?.outline?.queued_at]);

      // Fetch ICP and Offer for Step 2 "Configure Context"
      // Sources: (1) campaign context when campaign_id exists, (2) direct fetch by context.icpId/offerId when article-linked
      useEffect(() => {
        const hasIcp = article?.context?.icp || article?.assets?.campaignContext?.icp;
        const hasOffer = article?.context?.offer || article?.assets?.campaignContext?.offer;
        const icpId = article?.context?.icpId;
        const offerId = article?.context?.offerId || article?.offer_id;

        let cancelled = false;
        (async () => {
          try {
            const updates = { context: { ...(article?.context || {}) } };

            // Campaign path: fetch campaign context when campaign_id exists and we're missing ICP/offer
            if (article?.campaign_id && (!hasIcp || !hasOffer) && article?.assets?.campaignContext?.campaignId !== article.campaign_id) {
              const contextData = await fetchCampaignContext(article.campaign_id, article);
              if (cancelled) return;
              if (contextData) {
                if (!hasIcp && contextData.icp) updates.context.icp = contextData.icp;
                if (!hasOffer && contextData.offer) updates.context.offer = contextData.offer;
                updates.assets = { ...(article?.assets || {}), campaignContext: contextData };
              }
            }

            // Article-linked path: fetch ICP by context.icpId when EDIT CONTEXT has ICP selected
            if (!hasIcp && icpId) {
              const supabase = createClient();
              const { data: { user } } = await supabase.auth.getUser();
              if (user && !cancelled) {
                const { data: icp } = await supabase.from("icps").select("*").eq("id", icpId).eq("user_id", user.id).single();
                if (icp) updates.context.icp = icp;
              }
            }

            // Article-linked path: fetch Offer by offerId when EDIT CONTEXT has Offer selected
            if (!hasOffer && offerId) {
              const offersInst = await initOffers();
              if (!cancelled) {
                const offer = await offersInst.get(offerId);
                if (offer) updates.context.offer = offer;
              }
            }

            const hasUpdates = (updates.context.icp && !hasIcp) || (updates.context.offer && !hasOffer) || updates.assets;
            if (hasUpdates && !cancelled) {
              updateArticle(updates);
            }
          } catch (err) {
            if (!cancelled) { void err; }
          }
        })();
        return () => { cancelled = true; };
      }, [article?.campaign_id, article?.context?.icpId, article?.context?.offerId, article?.offer_id, article?.context?.icp, article?.context?.offer, article?.assets?.campaignContext, updateArticle]);

      // Initialize selected competitors when component mounts (auto-select top 3 only)
      // Skip default when restoring from outline so user's saved selection (including "none") is preserved
      useEffect(() => {
        if (competitorPages.length === 0 || selectedCompetitors.length > 0) return;
        const fromOutline = article?.outline?.selectedCompetitors;
        if (Array.isArray(fromOutline)) return;
        const top3 = competitorPages.slice(0, 3).map((p) => p.url);
        setSelectedCompetitors(top3);
      }, [competitorPages, article?.outline?.selectedCompetitors]);

      // Build context prompt when selected assets change
      const buildContextPrompt = useCallback((assetKeys) => {
        let prompt = '';
        
        ASSET_CONFIGS.forEach(config => {
          if (!assetKeys.includes(config.key)) return;
          
          const value = getAssetValue(config.path);
          if (!value || (Array.isArray(value) && value.length === 0)) return;
          
          prompt += config.format(value);
        });
        
        return prompt;
      }, [article]);

      // When ICP or Offer become available, include them in selected assets by default (so default context contains them)
      useEffect(() => {
        const icpOfferKeys = ['icp', 'offer'];
        const hasNew = availableAssets.some(a => icpOfferKeys.includes(a.key));
        if (!hasNew) return;
        setSelectedAssets(prev => {
          const next = new Set(prev);
          availableAssets.forEach(a => { if (icpOfferKeys.includes(a.key)) next.add(a.key); });
          return next.size === prev.length ? prev : [...next];
        });
      }, [availableAssets]);

      // Update context prompt when selected assets change
      useEffect(() => {
        const newPrompt = buildContextPrompt(selectedAssets);
        setContextPrompt(newPrompt);
      }, [selectedAssets, buildContextPrompt]);

      // Update user prompt when template type changes
      useEffect(() => {
        setUserPrompt(DEFAULT_PROMPTS[templateType] || DEFAULT_PROMPTS.infer_from_competitors);
      }, [templateType]);

      // Check if user has custom templates (for toggle)
      useEffect(() => {
        let cancelled = false;
        (async () => {
          try {
            const { initMonkey } = await import('@/libs/monkey');
            const monkey = await initMonkey();
            const text = await monkey.apiGet('/api/templates/list-custom');
            const data = JSON.parse(text);
            if (!cancelled && data.success && Array.isArray(data.templates)) {
              setCustomTemplatesAvailable(data.templates.length > 0);
            }
          } catch (err) {
            if (!cancelled) setCustomTemplatesAvailable(false);
          }
        })();
        return () => { cancelled = true; };
      }, []);

      // Hydrate: DB status, then optional v0 pull when chatId exists (single path vs old double effect)
      useEffect(() => {
        if (!article?.id) return;
        let cancelled = false;
        setSessionHydrated(false);
        (async () => {
          try {
            const { initMonkey } = await import('@/libs/monkey');
            const monkey = await initMonkey();
            let text = await monkey.apiCall('/api/content-magic/outline-status', {
              articleId: article.id,
            });
            let data = JSON.parse(text);
            if (cancelled) return;
            if (data.error) throw new Error(data.error || 'Failed to check status');
            if (data.outline != null) {
              updateArticle({ outline: data.outline });
            }
            const o = data.outline;
            if (o?.chatId) {
              const t2 = await monkey.apiCall('/api/content-magic/outline-status', {
                articleId: article.id,
                initialCheck: true,
              });
              const d2 = JSON.parse(t2);
              if (cancelled) return;
              if (!d2.error && d2.outline != null) {
                updateArticle({ outline: d2.outline });
              }
            }
          } catch (err) {
            if (!cancelled) logDraftNetworkError('hydrate / outline-status', err);
          } finally {
            if (!cancelled) setSessionHydrated(true);
          }
        })();
        return () => {
          cancelled = true;
        };
      }, [article?.id, updateArticle, logDraftNetworkError]);

      // Derive workflow + form fields from canonical article.outline
      useEffect(() => {
        const outline = article?.outline;
        if (!outline || typeof outline !== 'object' || Object.keys(outline).length === 0) {
          applyOutlineToWorkflow(null);
          return;
        }
        applyOutlineToWorkflow(outline);

        const inFlight = ['rendering', 'queued', 'sending'].includes(outline.status || '');
        if (!inFlight) {
          if (outline.selectedCompetitors && Array.isArray(outline.selectedCompetitors)) {
            setSelectedCompetitors(outline.selectedCompetitors);
          }
          if (outline.selectedAssets && Array.isArray(outline.selectedAssets)) {
            setSelectedAssets(outline.selectedAssets);
          }
          if (outline.prompt) {
            setUserPrompt(outline.prompt);
          }
          if (outline.contextPrompt) {
            setContextPrompt(outline.contextPrompt);
          }
          if (outline.activeTab === 'improve' || outline.activeTab === 'generate') {
            setActiveTab(outline.activeTab);
          }
          setImprovementInstructions(article?.assets?.feedback ?? '');
          if (
            outline.improveCoverageOption === 'instructions_only' ||
            outline.improveCoverageOption === 'also_cover_assets'
          ) {
            setImproveCoverageOption(outline.improveCoverageOption);
          }
        }
      }, [article?.outline, article?.assets?.feedback, applyOutlineToWorkflow]);

      // When switching to improve tab, default the textarea to feedback asset if empty
      useEffect(() => {
        if (activeTab !== 'improve') return;
        setImprovementInstructions((prev) => (prev === '' ? (article?.assets?.feedback ?? '') : prev));
      }, [activeTab, article?.assets?.feedback]);

      // Draft preview: render shadow DOM when we have raw HTML from outline.files
      useEffect(() => {
        const rawHtml = getOutlineHtmlFromFiles(result);
        const container = previewContainerRef.current;
        if (!rawHtml || !container) {
          if (container) container.innerHTML = '';
          return;
        }
        let cancelled = false;
        (async () => {
          try {
            const host = await renderShadowDOM(rawHtml, { loadCustomCss: customCssEnabled });
            if (cancelled || !previewContainerRef.current) return;
            previewContainerRef.current.innerHTML = '';
            previewContainerRef.current.appendChild(host);
          } catch (err) {
            if (!cancelled) { void err; }
          }
        })();
        return () => { cancelled = true; };
      }, [result?.files, customCssEnabled]);

      // Toggle competitor selection
      const toggleCompetitor = (url) => {
        setSelectedCompetitors(prev => 
          prev.includes(url) 
            ? prev.filter(u => u !== url)
            : [...prev, url]
        );
      };

      // Toggle asset selection
      const toggleAsset = (key) => {
        setSelectedAssets(prev => 
          prev.includes(key)
            ? prev.filter(k => k !== key)
            : [...prev, key]
        );
      };

      // Fetch competitor content
      const fetchCompetitorContents = async (urls) => {
        // For now, return the content from competitorPages if available
        return urls.map(url => {
          const page = competitorPages.find(p => p.url === url);
          return page?.content || '';
        });
      };

      // Single submit handler for both Generate and Improve – one code path, one place for state change
      const handleSubmit = async () => {
        if (activeTab === 'improve') {
          const trimmed = (improvementInstructions || '').trim();
          if (!trimmed) {
            setFormError('Please describe how you would like the current draft improved.');
            return;
          }
          if (!currentPageContent || currentPageContent.length < 50) {
            setFormError('Please generate an initial draft first before using the improve feature.');
            return;
          }
        }

        setFormError(null);
        failedDismissedRef.current = false;
        pollAnchorMsRef.current = Date.now();
        const requestId = crypto.randomUUID();

        try {
          let payload;
          if (activeTab === 'generate') {
            const competitorContents = await fetchCompetitorContents(selectedCompetitors);
            payload = {
              articleId: article.id,
              userPrompt,
              contextPrompt,
              competitorUrls: selectedCompetitors,
              competitorContents,
              selectedAssets,
              useCustomTemplates: useCustomTemplates && customTemplatesAvailable,
              allowGeneratingCustomCss: Boolean(useCustomTemplates && customTemplatesAvailable && allowGeneratingCustomCss),
              allowImageGeneration,
              fileMode,
              request_id: requestId,
            };
          } else {
            payload = {
              articleId: article.id,
              mode: 'improve',
              improvementInstructions: (improvementInstructions || '').trim(),
              contextPrompt,
              currentPageContent,
              improveCoverageOption,
              selectedAssets,
              useCustomTemplates: useCustomTemplates && customTemplatesAvailable,
              allowGeneratingCustomCss: Boolean(useCustomTemplates && customTemplatesAvailable && allowGeneratingCustomCss),
              allowImageGeneration,
              fileMode,
              request_id: requestId,
            };

          }

          // Keep button in hard loading state (no optimistic rendering) until chatId is confirmed in DB.
          setLoading(true);

          const { initMonkey } = await import('@/libs/monkey');
          const monkey = await initMonkey();

          const text = await monkey.apiCall('/api/content-magic/generate-outline', payload);
          const data = JSON.parse(text);
          if (data.error) throw new Error(data.error || 'Failed to start generation');

          // ── Poll outline-status (chatIdCheckOnly) until chatId confirmed in DB ──
          // Fast early attempts, then back off. Hard cap 90 seconds.
          const POLL_SCHEDULE_MS = [500, 500, 500, 3000, 3000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000];
          const POLL_HARD_CAP_MS = 90_000;
          const pollStart = Date.now();
          let confirmedChatId = data.chatId || null;

          if (!confirmedChatId) {
            // chatId not in the API response yet — poll DB until it appears
            for (const delayMs of POLL_SCHEDULE_MS) {
              if (Date.now() - pollStart > POLL_HARD_CAP_MS) break;
              const jitter = Math.floor(Math.random() * 300);
              await new Promise(r => setTimeout(r, delayMs + jitter));

              try {
                const pollText = await monkey.apiCall('/api/content-magic/outline-status', {
                  articleId: article.id,
                  chatIdCheckOnly: true,
                });
                const pollData = JSON.parse(pollText);
                if (pollData.chatId) {
                  confirmedChatId = pollData.chatId;

                  break;
                }
                if (pollData.status === 'failed') {
                  throw new Error('Session failed to initialize. Please try again.');
                }
              } catch (pollErr) {
                // Network glitch mid-poll — keep trying until hard cap
                
              }
            }
          }

          // ── chatId confirmed (or timed out gracefully) — transition to rendering ──
          const startedAt = new Date().toISOString();
          const renderingOutline = activeTab === 'generate'
            ? {
                status: 'rendering',
                startedAt,
                activeTab: 'generate',
                prompt: userPrompt,
                contextPrompt,
                selectedCompetitors,
                selectedAssets,
                fileMode,
                ...(confirmedChatId && { chatId: confirmedChatId }),
              }
            : {
                status: 'rendering',
                startedAt,
                activeTab: 'improve',
                improvementInstructions: (improvementInstructions || '').trim(),
                improveCoverageOption,
                contextPrompt,
                selectedAssets,
                fileMode,
                ...(confirmedChatId && { chatId: confirmedChatId }),
              };

          setLoading(false);
          setIsRendering(true);
          setRenderStartTime(startedAt);
          updateArticle({ outline: renderingOutline });
        } catch (err) {
          logDraftNetworkError('generate-outline / session init', err);
          setLoading(false);
          setIsRendering(false);
        }
      };

      const handleRefresh = useCallback(
        async ({ initialCheck = false } = {}) => {
          if (!article?.id) return;
          setRefreshing(true);
          try {
            const { initMonkey } = await import('@/libs/monkey');
            const monkey = await initMonkey();
            const text = await monkey.apiCall('/api/content-magic/outline-status', {
              articleId: article.id,
              initialCheck,
            });
            const data = JSON.parse(text);
            if (data.error) throw new Error(data.error || 'Failed to check status');
            if (data.outline != null) {
              updateArticle({ outline: data.outline });
            }
          } catch (err) {
            logDraftNetworkError(
              initialCheck ? 'outline-status (v0 pull)' : 'outline-status (poll)',
              err
            );
          } finally {
            setRefreshing(false);
          }
        },
        [article?.id, updateArticle, logDraftNetworkError]
      );

      useEffect(() => {
        if (!isRendering) return;
        const anchor = pollAnchorMsRef.current;
        const elapsed = Date.now() - anchor;
        const firstDelay = Math.max(0, FIRST_POLL_AFTER_ANCHOR_MS - elapsed);
        let intervalId;
        const timeoutId = setTimeout(() => {
          handleRefresh();
          intervalId = setInterval(() => handleRefresh(), POLL_INTERVAL_MS);
        }, firstDelay);
        return () => {
          clearTimeout(timeoutId);
          if (intervalId) clearInterval(intervalId);
        };
      }, [isRendering, handleRefresh]);

      /**
       * Adopt completed draft into the editor (shadow-safe CSS via buildAdoptedHtmlForShadow).
       *
       * LEGACY (removed from UI, slated for deletion): Old flow was processCssScoping →
       * extractEditorContent → markAdoptedDraftStyles — see POST /api/content-magic/adopt-draft.
       */
      const handleAdoptDraft = async () => {
        const contentFromFiles = getOutlineHtmlFromFiles(result);
        if (!contentFromFiles) {
          logDraftNetworkError('adopt-draft', new Error('No HTML file found in outline files.'));
          return;
        }
        setRendering(true);
        try {
          let finalHtml = buildAdoptedHtmlForShadow(contentFromFiles);
          if (result.files && result.files.length > 0) {
            try {
              const { uploadV0Images } = await import('@/libs/content-magic/utils/uploadV0Images');
              const pathMapping = await uploadV0Images(result.files);
              if (Object.keys(pathMapping).length > 0) {
                const { replaceImagePaths } = await import('@/libs/content-magic/utils/replaceImagePaths');
                finalHtml = replaceImagePaths(finalHtml, pathMapping);
              }
            } catch (imageError) {
              void imageError;
            }
          }
          if (!finalHtml.includes('<section')) {
            finalHtml = `<section class="">${finalHtml}</section>`;
          }
          setEditorHtml(finalHtml);
          updateArticle({ content_html: finalHtml });
          toast.success(`Draft adopted successfully! ${finalHtml.length} characters added to your editor.`);
          closeRuleModal();
        } catch (err) {
          logDraftNetworkError('adopt-draft', err);
        } finally {
          setRendering(false);
        }
      };

      const handleSubmitFeedback = async () => {
        if (!feedbackMessage.trim()) {
          setFeedbackError('Please enter your feedback.');
          return;
        }
        const chatId = result?.chatId || article?.outline?.chatId;
        if (!chatId) {
          setFeedbackError('Chat session not found. Please regenerate the draft before sending feedback.');
          return;
        }
        setFeedbackSubmitting(true);
        setFeedbackError(null);
        try {
          const { initMonkey } = await import('@/libs/monkey');
          const monkey = await initMonkey();
          const responseText = await monkey.apiCall('/api/content-magic/outline-feedback', {
            articleId: article.id,
            chatId,
            message: feedbackMessage.trim(),
          });
          const data = JSON.parse(responseText);
          if (data.error) throw new Error(data.error || 'Failed to submit feedback');

          if (data.status === 'rendering') {
            pollAnchorMsRef.current = Date.now();
            setIsRendering(true);
            setRenderStartTime(new Date().toISOString());
            setResult(null);
            const renderingOutline = {
              status: 'rendering',
              chatId: data.chatId ?? chatId,
              startedAt: new Date().toISOString(),
              feedbackSubmittedAt: new Date().toISOString(),
              lastFeedbackMessage: feedbackMessage.trim(),
            };
            updateArticle({ outline: renderingOutline });
          }

          setFeedbackMessage('');
          setShowFeedbackModal(false);
        } catch (err) {
          logDraftNetworkError('outline-feedback', err);
        } finally {
          setFeedbackSubmitting(false);
        }
      };

      const handleRetry = async () => {
        const chatId = result?.chatId || article?.outline?.chatId;
        if (!chatId) {
          logDraftNetworkError('retry same session', new Error('No chat session found.'));
          return;
        }
        setRetrying(true);
        try {
          const { initMonkey } = await import('@/libs/monkey');
          const monkey = await initMonkey();
          const retryStartedAt = new Date().toISOString();
          const text = await monkey.apiCall('/api/content-magic/outline-feedback', {
            articleId: article.id,
            chatId,
            message: 'Seems like latestVersion failed to generate, try it again',
          });
          const data = JSON.parse(text);
          if (data.error) throw new Error(data.error);
          if (data.status === 'rendering') {
            pollAnchorMsRef.current = Date.now();
            const renderingOutline = {
              status: 'rendering',
              chatId,
              startedAt: retryStartedAt,
              retryStartedAt,
            };
            setIsRendering(true);
            setRenderStartTime(retryStartedAt);
            setResult(null);
            updateArticle({ outline: renderingOutline });
          }
        } catch (err) {
          logDraftNetworkError('retry same session (outline-feedback)', err);
        } finally {
          setRetrying(false);
        }
      };

      const handleKickTheBox = async () => {
        const chatId = result?.chatId || article?.outline?.chatId;
        if (!article?.id || !chatId) {
          logDraftNetworkError('kick-the-box', new Error('No chat session'));
          return;
        }
        setKicking(true);
        try {
          const { initMonkey } = await import('@/libs/monkey');
          const monkey = await initMonkey();
          const responseText = await monkey.apiCall('/api/content-magic/outline-feedback', {
            articleId: article.id,
            chatId,
            message: 'continue',
          });
          const data = JSON.parse(responseText);
          if (data.error) throw new Error(data.error);
          setLastKickAtMs(Date.now());
          setKickCooldownTick((x) => x + 1);
          void handleRefresh();
        } catch (err) {
          logDraftNetworkError('kick-the-box', err);
        } finally {
          setKicking(false);
        }
      };

      const handleDismissFailed = () => {
        failedDismissedRef.current = true;
        setResult(null);
        setIsRendering(false);
        setFormError(null);
      };

      const uiPhase = useMemo(() => {
        if (!sessionHydrated) return 'hydrating';
        if (loading) return 'submitting';
        if (isRendering && !isRenderingStale) return 'working';
        if (isRendering && isRenderingStale) return 'stale';
        if (result?.status === 'failed') return 'failed';
        if (result?.status === 'completed') return 'preview';
        return 'idle';
      }, [
        sessionHydrated,
        loading,
        isRendering,
        isRenderingStale,
        result?.status,
      ]);

      // Format timestamp
      const formatTimestamp = (timestamp) => {
        if (!timestamp) return 'Unknown';
        try {
          return new Date(timestamp).toLocaleString();
        } catch {
          return timestamp;
        }
      };

      return (
        <>
          <div
            className="flex flex-col h-full bg-gray-50 overflow-y-auto"
            data-draft-phase={uiPhase}
          >
          {/* Tabs - header/description shown by RuleDetailPanel */}
          <div className="p-6 border-b border-gray-200 bg-white">
            <div className="flex gap-1 border-b border-gray-200 -mb-px">
              <button
                type="button"
                onClick={() => {
                  setFormError(null);
                  setActiveTab('generate');
                }}
                className={`px-4 py-2 font-medium rounded-t border-b-2 transition-colors ${
                  activeTab === 'generate'
                    ? 'border-blue-500 text-blue-600 bg-blue-50'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                Generate New Draft
              </button>
              <button
                type="button"
                onClick={() => {
                  setFormError(null);
                  setActiveTab('improve');
                }}
                className={`px-4 py-2 font-medium rounded-t border-b-2 transition-colors ${
                  activeTab === 'improve'
                    ? 'border-blue-500 text-blue-600 bg-blue-50'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                Improve Existing Draft
              </button>
            </div>
          </div>

          {/* Main Content - Full Width Sections */}
          <div className="flex-1 p-6 space-y-6">

            {/* Step 1 Generate: Competitor Pages Selection */}
            {activeTab === 'generate' && competitorPages.length > 0 && (
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">1. Select Competitor Pages</h3>
                    <span className="text-sm text-gray-500">
                      {selectedCompetitors.length} of {competitorPages.length} selected
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-4">
                    Choose which competitor pages to include for reference (top 3 selected by default)
                  </p>
                  
                  {/* Scrollable container - shows ~4 items at a time */}
                  <div className="space-y-2 max-h-80 overflow-y-auto pr-2 border border-gray-200 rounded-lg p-2">
                    {competitorPages.map((page, idx) => (
                      <label 
                        key={idx}
                        className="flex items-start gap-3 p-3 hover:bg-gray-50 rounded cursor-pointer transition-colors border border-gray-100 bg-white"
                      >
                        <input 
                          type="checkbox" 
                          checked={selectedCompetitors.includes(page.url)}
                          onChange={() => toggleCompetitor(page.url)}
                          className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 truncate">{page.title || 'Untitled'}</div>
                          <div className="text-xs text-gray-500 truncate">{page.url}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Step 1 Improve: Improvement Instructions */}
            {activeTab === 'improve' && (
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
                <div className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">1. How would you like the current draft improved?</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Describe the improvements you&apos;d like to make to your existing draft.
                  </p>
                  {currentPageContent.length < 50 ? (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                      Please generate an initial draft first before using the improve feature. Your current page has no or very little content.
                    </div>
                  ) : (
                    <textarea
                      value={improvementInstructions}
                      onChange={(e) => setImprovementInstructions(e.target.value)}
                      placeholder="E.g., Make the tone more professional, add more technical details, restructure the introduction..."
                      className="w-full h-48 p-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    />
                  )}
                </div>
              </div>
            )}

            {/* Section 2: Context Configuration (shared) */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">2. Configure Context</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Select which assets to include in the context (changes update the textarea below)
                </p>
                
                {/* Asset Selection Checkboxes */}
                {availableAssets.length > 0 ? (
                  <div className="flex flex-wrap gap-3 mb-4 p-3 bg-gray-50 rounded border border-gray-100">
                    {availableAssets.map(config => (
                      <label key={config.key} className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={selectedAssets.includes(config.key)}
                          onChange={() => toggleAsset(config.key)}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">{config.label}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded text-sm text-gray-800">
                    No assets available. Complete earlier steps to generate context.
                  </div>
                )}
                
                {/* Context Prompt Textarea */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Context Prompt (auto-generated from selected assets)
                  </label>
                  <textarea 
                    value={contextPrompt}
                    onChange={(e) => setContextPrompt(e.target.value)}
                    className="w-full h-48 p-3 border border-gray-300 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    placeholder="Select assets above to auto-generate context, or type your own..."
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Edit freely - changes won't affect checkboxes (one-way sync from checkboxes to text)
                  </p>
                </div>
              </div>
            </div>

            {/* Step 3 Generate: Generation Settings */}
            {activeTab === 'generate' && (
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
                <div className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">3. Generation Settings</h3>
                  
                  {/* Template Selection */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Page Template
                    </label>
                    <select 
                      value={templateType}
                      onChange={(e) => setTemplateType(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="infer_from_competitors">Infer from Competitors</option>
                      <option value="landing_page">Landing Page</option>
                      <option value="informational">Informational</option>
                      <option value="product_category">Product Category</option>
                      <option value="product_details">Product Details</option>
                      <option value="homepage">Homepage</option>
                      <option value="lead_landing_page">Lead Landing Page</option>
                      <option value="trial_sign_up">Trial Sign Up</option>
                    </select>
                  </div>
                  
                  {/* User Prompt Textarea */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Your Prompt
                    </label>
                    <textarea 
                      value={userPrompt}
                      onChange={(e) => setUserPrompt(e.target.value)}
                      className="w-full h-32 p-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                      placeholder="Describe what you want to generate..."
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 3 Improve: Improvement Scope */}
            {activeTab === 'improve' && (
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
                <div className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">3. Improvement Scope</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Choose how comprehensive the improvement should be.
                  </p>
                  <div className="space-y-3">
                    <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                      <input
                        type="radio"
                        name="improveCoverage"
                        value="instructions_only"
                        checked={improveCoverageOption === 'instructions_only'}
                        onChange={(e) => setImproveCoverageOption(e.target.value)}
                        className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <div>
                        <div className="font-medium text-gray-900">Only do what I instructed</div>
                        <div className="text-sm text-gray-600">
                          Focus only on the improvement instructions provided above.
                        </div>
                      </div>
                    </label>
                    <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                      <input
                        type="radio"
                        name="improveCoverage"
                        value="also_cover_assets"
                        checked={improveCoverageOption === 'also_cover_assets'}
                        onChange={(e) => setImproveCoverageOption(e.target.value)}
                        className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <div>
                        <div className="font-medium text-gray-900">Also try to cover all topics, keywords, prompts in step 2</div>
                        <div className="text-sm text-gray-600">
                          Apply improvements AND incorporate selected context assets where relevant.
                        </div>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Generate/Improve Button + Custom templates toggle + Allow image generation toggle (file mode always on, toggle hidden) */}
            <div className="flex flex-wrap items-center justify-end gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-sm text-gray-700">Use custom templates</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={useCustomTemplates}
                  onClick={() => {
                    if (useCustomTemplates) {
                      setUseCustomTemplates(false);
                      setAllowGeneratingCustomCss(false);
                      return;
                    }
                    if (!customTemplatesAvailable) {
                      setShowNoTemplatesPopup(true);
                      return;
                    }
                    setUseCustomTemplates(true);
                  }}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${useCustomTemplates ? 'bg-blue-600' : 'bg-gray-200'}`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition ${useCustomTemplates ? 'translate-x-5' : 'translate-x-1'}`}
                  />
                </button>
              </label>
              {useCustomTemplates && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <span className="text-sm text-gray-700">Allow generating custom CSS</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={allowGeneratingCustomCss}
                    onClick={() => setAllowGeneratingCustomCss(prev => !prev)}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${allowGeneratingCustomCss ? 'bg-blue-600' : 'bg-gray-200'}`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition ${allowGeneratingCustomCss ? 'translate-x-5' : 'translate-x-1'}`}
                    />
                  </button>
                </label>
              )}
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-sm text-gray-700">Allow image generation</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={allowImageGeneration}
                  onClick={() => setAllowImageGeneration(prev => !prev)}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${allowImageGeneration ? 'bg-blue-600' : 'bg-gray-200'}`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition ${allowImageGeneration ? 'translate-x-5' : 'translate-x-1'}`}
                  />
                </button>
              </label>
              {activeTab === 'generate' ? (
                <button
                  onClick={handleSubmit}
                  disabled={
                    !sessionHydrated ||
                    loading ||
                    (isRendering && !isRenderingStale)
                  }
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-base shadow-sm"
                >
                  {loading ? (
                    <>
                      <Loader className="w-5 h-5 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <FileText className="w-5 h-5" />
                      Generate Draft
                      <CreditCostBadge path="/api/content-magic/generate-outline" size="sm" className="ml-1" />
                    </>
                  )}
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={
                    !sessionHydrated ||
                    loading ||
                    (isRendering && !isRenderingStale) ||
                    !(improvementInstructions || '').trim() ||
                    currentPageContent.length < 50
                  }
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-base shadow-sm"
                >
                  {loading ? (
                    <>
                      <Loader className="w-5 h-5 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <FileText className="w-5 h-5" />
                      Improve Draft
                      <CreditCostBadge path="/api/content-magic/generate-outline" size="sm" className="ml-1" />
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Popup: no custom templates - link to settings */}
            {showNoTemplatesPopup && (
              <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40" onClick={() => setShowNoTemplatesPopup(false)}>
                <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No custom templates</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Set up custom templates first. Then you can use them here to generate the webpage.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <a
                      href="/settings/page-templates"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                    >
                      Open Page templates settings
                    </a>
                    <button
                      type="button"
                      onClick={() => setShowNoTemplatesPopup(false)}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm font-medium"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            )}

            {formError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-semibold text-red-900 mb-1">Error</h4>
                    <p className="text-sm text-red-800">{formError}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Rendering Status - show during submit (loading) OR while waiting for result (isRendering) */}
            {(loading || isRendering) && (
              <div
                className={`${
                  showKickTheBox
                    ? 'bg-amber-50 border-amber-200'
                    : isRenderingStale
                      ? 'bg-yellow-50 border-yellow-200'
                      : 'bg-blue-50 border-blue-200'
                } border rounded-lg p-4`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-3">
                  {showKickTheBox ? (
                    <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  ) : isRenderingStale ? (
                    <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  ) : (
                    <Loader className="w-5 h-5 text-blue-600 animate-spin flex-shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0 flex-1">
                    {loading ? (
                      <>
                        <h4 className="font-semibold text-blue-900 mb-1">Initializing Writing Session</h4>
                        <p className="text-sm text-blue-800 mb-2">
                          Creating your session and confirming it is saved. This takes a few seconds — please keep this tab open until you see &quot;Draft Generation In Progress&quot; below.
                        </p>
                      </>
                    ) : showKickTheBox ? (
                      <>
                        <h4 className="font-semibold text-amber-900 mb-1">Generation seems stuck</h4>
                        <p className="text-sm text-amber-900 mb-2">
                          Page generation is taking longer than expected. Try the universal fix —{' '}
                          <strong>kick the box</strong>: we send a short &quot;continue&quot; nudge to the generator. You can use this again after 15 minutes if needed.
                        </p>
                        <p className="text-xs text-amber-800">
                          Session queued:{' '}
                          {formatTimestamp(article?.outline?.queued_at || article?.outline?.startedAt)}
                        </p>
                      </>
                    ) : isRenderingStale ? (
                      <>
                        <h4 className="font-semibold text-yellow-900 mb-1">Generation Taking Too Long</h4>
                        <p className="text-sm text-yellow-800 mb-2">
                          It has been more than 20 minutes since the generation started. The previous request likely failed. You can start a new request using the button above.
                        </p>
                        <p className="text-xs text-yellow-700">
                          Started: {formatTimestamp(renderStartTime)}
                        </p>
                      </>
                    ) : (
                      <>
                        <h4 className="font-semibold text-blue-900 mb-1">Draft Generation In Progress</h4>
                        <p className="text-sm text-blue-800 mb-2">
                          This typically takes 3-15 minutes and longer if using custom template or more competitor contents provided. You can safely leave this page and come back later.
                        </p>
                        <p className="text-xs text-blue-700">
                          Started: {formatTimestamp(renderStartTime)}
                        </p>
                      </>
                    )}
                  </div>
                  <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleRefresh}
                      disabled={refreshing || loading}
                      className={`px-4 py-2 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
                        showKickTheBox
                          ? 'bg-amber-700 hover:bg-amber-800'
                          : isRenderingStale
                            ? 'bg-yellow-600 hover:bg-yellow-700'
                            : 'bg-blue-600 hover:bg-blue-700'
                      }`}
                    >
                      {refreshing ? 'Checking...' : 'Refresh Status'}
                    </button>
                    {showKickTheBox && (
                      <button
                        type="button"
                        onClick={handleKickTheBox}
                        disabled={kicking || refreshing || loading}
                        className="px-4 py-2 border-2 border-amber-800 text-amber-900 rounded-lg text-sm font-medium hover:bg-amber-100 transition-colors disabled:opacity-50"
                      >
                        {kicking ? 'Kicking…' : 'Kick the box'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {result?.status === 'failed' && !isRendering && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                <h4 className="font-semibold text-red-900">Draft generation failed</h4>
                <p className="mt-1 text-sm text-red-800">
                  {result.last_error === 'completed but no index.html'
                    ? 'Generation finished but no HTML output was found.'
                    : result.last_error?.startsWith('stale')
                      ? 'Timed out with no activity from the generator.'
                      : result.last_error?.includes('task-stopped')
                        ? 'Generation was stopped before completing.'
                        : result.last_error || result.error || 'Unknown error.'}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleDismissFailed}
                    className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                  >
                    Dismiss
                  </button>
                  {(result?.chatId || article?.outline?.chatId) && (
                    <button
                      type="button"
                      onClick={handleRetry}
                      disabled={retrying || !sessionHydrated}
                      className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                    >
                      {retrying ? 'Retrying…' : 'Retry same session'}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Results Section - Preview */}
            {result?.status === 'completed' && (
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">Draft Preview</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        Generated in {result.generationTime || (result.startedAt && result.completedAt
                          ? `${((new Date(result.completedAt) - new Date(result.startedAt)) / 1000).toFixed(1)}s`
                          : 'N/A')}
                        {result.completedAt && (
                          <>
                            {' · '}
                            <span title={new Date(result.completedAt).toISOString()}>
                              Updated {new Date(result.completedAt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
                            </span>
                          </>
                        )}
                      </p>
                      {result.lastFeedbackMessage && (
                        <p className="text-sm text-gray-500 mt-0.5">
                          Last Feedback Msg: {(() => {
                            const msg = String(result.lastFeedbackMessage);
                            return msg.length > 150 ? msg.slice(0, 150) + '…' : msg;
                          })()}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 bg-green-100 text-green-800 text-sm font-medium rounded-full">
                        Completed
                      </span>
                    </div>
                  </div>
                  
                  {/* Preview: Shadow DOM (matches AI edit preview / editor) */}
                  {getOutlineHtmlFromFiles(result) ? (
                    <div ref={previewContainerRef} className="relative w-full bg-white rounded-lg border border-gray-300 overflow-auto" style={{height: '80vh'}} />
                  ) : (
                    <div className="flex flex-col items-center justify-center py-16 px-6 rounded-lg border-2 border-dashed border-amber-200 bg-amber-50/80">
                      <Loader className="w-16 h-16 text-amber-600 animate-spin mb-4" aria-hidden="true" />
                      <h4 className="text-lg font-semibold text-amber-900 mb-1">Preview is being prepared</h4>
                      <p className="text-sm text-amber-800/90">Check back in a few minutes.</p>
                    </div>
                  )}
                  
                  {/* Action Button: show only when we have HTML from outline.files (index.html) */}
                  <div className="flex flex-wrap items-center gap-3 mt-4">
                    {getOutlineHtmlFromFiles(result) && (
                      <>
                        <div className="flex flex-wrap items-center gap-3">
                          <button
                            type="button"
                            onClick={handleAdoptDraft}
                            disabled={rendering}
                            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-sm"
                          >
                            {rendering ? (
                              <>
                                <Loader className="w-5 h-5 animate-spin" />
                                Adopting draft...
                              </>
                            ) : (
                              <>
                                <FileText className="w-5 h-5" />
                                Adopt Draft
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => {
                              setFeedbackMessage(article?.assets?.feedback || '');
                              setFeedbackError(null);
                              setShowFeedbackModal(true);
                            }}
                            className="flex items-center gap-2 px-5 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium shadow-sm"
                            disabled={!sessionHydrated || feedbackSubmitting || rendering}
                          >
                            Provide feedback
                            <CreditCostBadge path="/api/content-magic/outline-feedback" size="sm" className="ml-1" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>

                </div>
              </div>
            )}
          </div>
          </div>
          {showFeedbackModal && (
          <div
            className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4"
            onClick={() => {
              if (!feedbackSubmitting) {
                setShowFeedbackModal(false);
              }
            }}
          >
            <div
              className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Provide feedback</h3>
              <p className="text-sm text-gray-600 mb-3">
                How would you like the current draft to be improved?
              </p>
              {article?.assets?.feedback && (
                <div className="mb-3 rounded border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
                  Pre-loaded from your Feedback asset — edit before sending.
                </div>
              )}
              {feedbackError && (
                <div className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {feedbackError}
                </div>
              )}
              <textarea
                value={feedbackMessage}
                onChange={(e) => setFeedbackMessage(e.target.value)}
                placeholder="E.g., Add a pricing section, increase detail in the workflow step, fix CTA copy..."
                className="w-full h-32 p-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                disabled={feedbackSubmitting}
              />
              <p className="text-xs text-gray-500 mt-2">
                Tip: If you have made manual edits in the editor, use{' '}
                <strong>Improve Existing Article</strong> mode instead — the draft generator cannot see changes made directly in the editor.
              </p>
              <div className="flex justify-end gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => {
                    if (!feedbackSubmitting) setShowFeedbackModal(false);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm font-medium disabled:opacity-50"
                  disabled={feedbackSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmitFeedback}
                  disabled={feedbackSubmitting}
                  className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium flex items-center gap-2 disabled:opacity-50"
                >
                  {feedbackSubmitting ? (
                    <>
                      <Loader className="w-4 h-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      Submit feedback
                      <CreditCostBadge path="/api/content-magic/outline-feedback" size="sm" className="ml-1" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
          )}
        </>
    );
  },
  },
};

export default createOutline;

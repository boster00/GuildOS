"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Sparkles, Check, Lock, Unlock, ArrowLeft, X, XCircle } from "lucide-react";
import { initCampaigns } from "@/libs/campaigns/class";
import { initOffers } from "@/libs/offers/class";
import { createClient } from "@/libs/supabase/client";
import { initMonkey } from "@/libs/monkey";
import AI_MODELS from "@/config/ai-models";
import ExpandPanel from "./ExpandPanel";
import CreditCostBadge from "@/components/CreditCostBadge";

// ============================================
// 🎨 AI PROMPT TEMPLATES
// ============================================
// These prompts power the AI suggestions in the campaign setup wizard.
// Edit these to improve AI output quality and alignment with your needs.
// ============================================

const PROMPT_TEMPLATES = {
  
  /**
   * Campaign Name Suggestions
   * Generates 3 alternative names based on offer, ICP, and competitive analysis
   * Output: JSON array of 3 strings
   */
  campaignName: (offerName, offerDescription, icpName) => `I need to name this offer/article. Current offer details:
Offer: ${offerName || 'Unknown'}
Description: ${offerDescription || 'No description'}
Target ICP: ${icpName || 'Unknown'}

Task: Research how competitors in this space call their products and suggest 3 alternatives.

Requirements:
- Accurately describe the offer (match commercial norms + search volume)
- For each suggestion, provide: the name and a brief comment on pros/cons
- Consider what this ICP would search for
- Balance SEO-friendliness with clarity

Return ONLY a JSON array of 3 name strings (just the names, comments can be added in your thinking).
Format: ["Name Option 1", "Name Option 2", "Name Option 3"]`,

  /**
   * ICP (Ideal Customer Profile) Suggestions
   * Generates 3 different ICP profiles with profitability and messaging insights
   * Output: JSON array of 3 objects with "name" and "description" fields
   */
  icpSuggestion: (offerName, offerDescription) => `Based on this offer: "${offerName}"
Description: ${offerDescription}

What kind of customers might be interested in this product line? 

Return ONLY a JSON array of 3 objects with "name" and "description" fields.
Format: [
  {"name": "ICP Name 1", "description": "details as above instructed"},
  {"name": "ICP Name 2", "description": "details as above instructed"},
  {"name": "ICP Name 3", "description": "details as above instructed"}
]`,

  /**
   * Outcome Keyword Generation
   * Creates 3 search-friendly outcome keywords (2-4 words) that customers would Google
   * Keywords represent the transformation/impact customers desire and have search volume potential
   * Output: JSON array of 3 keyword phrases
   */
  outcome: (icpName, offerName, offerDescription) => `CRITICAL TASK: Generate the main keyword that people will use to search for this specific offer on Google.

ICP: ${icpName || 'customers'}
Offer: ${offerName || 'this solution'}
Offer Description: ${offerDescription || 'No description'}

YOUR PRIMARY GOAL: Identify the exact search query people would type into Google when they are actively looking for this specific offer/service/product.

This keyword must:
1. Be what customers actually type into Google when searching FOR THIS OFFER (not just a general outcome)
2. Match the language and terminology people use when looking for this specific solution
3. Be the main search term people would use to find this offer (not a secondary or related term)
4. Have search volume potential (common search patterns for this type of offer)
5. Be a SHORT KEYWORD PHRASE (2-4 words, NOT a full sentence)

CRITICAL REQUIREMENTS:
- Think: "If someone wants to find THIS OFFER, what exact words would they type into Google?"
- Focus on search terms that directly lead to finding this offer/service
- Use the exact terminology and phrasing that people searching for this offer would use
- This is the PRIMARY keyword people use to search FOR THIS OFFER, not a general topic or outcome
- Examples for "Custom Peptide Synthesis Service": "custom peptide synthesis", "peptide synthesis service", "peptide synthesis company"
- Examples for "Antibody Conjugation Kit": "antibody conjugation kit", "protein conjugation kit", "antibody labeling kit"

Return ONLY a JSON array of 3 main keyword phrases that people would use to search for this offer.
Format: ["main keyword 1", "main keyword 2", "main keyword 3"]`,

  /**
   * Peace of Mind / Promise / Guarantee
   * Generates 3 statements that address buyer concerns and reduce purchase risk
   * Output: JSON array of 3 strings (1 sentence each)
   */
  peaceOfMind: (icpName, offerName, offerDescription) => `What are common concerns or reasons this ICP might NOT buy? What peace of mind can we offer?

ICP: ${icpName || 'customers'}
Offer: ${offerName || 'this offer'}
Offer Description: ${offerDescription || 'No description'}

Generate 3 peace-of-mind statements that address buyer concerns and reduce purchase risk.

Think about:
- What might make them hesitate?
- What guarantees or assurances would help them decide?
- What support or safety nets can be offered?

Requirements:
- Specific and concrete (1 sentence)
- Addresses real concerns this ICP would have
- Examples: "30-day money-back guarantee", "Free technical support included", "Satisfaction guaranteed or replacement kit"

Return ONLY a JSON array of 3 promise/guarantee strings.
Format: ["Promise 1", "Promise 2", "Promise 3"]`,

  /**
   * Transactional Facts Generator
   * Creates comprehensive "don't make them ask" details for offers
   * Returns a single detailed checklist with realistic placeholder values
   * Output: Plain text string with line breaks
   */
  transactionalFacts: (offerName, offerDescription) => `Given this offer: "${offerName}"
Description: ${offerDescription}
List transactional facts the user must know BEFORE buying.  
Think: price, size, lead time, formats, compatibility, steps, etc.  
Do NOT include marketing benefits or features — only factual logistics.  

Return as a checklist with each point separated by \\n. Do not use ** for bolding. `,

  /**
   * Campaign Roadmap Generation
   * Determines which phases are needed based on offer complexity and buyer journey
   * Output: Simple JSON object with explanation and phase choices
   */
  roadmap: (offerName, offerDescription, icpName, icpDescription, campaignName, outcome, peaceOfMind) => `You are planning a 3-phase content campaign for this offer.

Campaign settings:

- Offer name: ${offerName || 'Not specified'}
- Offer description: ${offerDescription || 'No description'}
- ICP name: ${icpName || 'Not specified'}
- ICP description: ${icpDescription || 'No description'}
- Campaign name: ${campaignName || 'Not specified'}
- Outcome / keyword: ${outcome || 'Not specified'}
- Promise / guarantee: ${peaceOfMind || 'Not specified'}

Phases:

- Phase 1: Landing page (always included, no need to mention in output).

- Phase 2: Decision guide (mid-funnel).

- Phase 3: Outcome pillar (how-to guide).

Your job:

Decide if Phase 2 and Phase 3 are actually needed for THIS campaign,

and which format to use for Phase 2.

General rules (keep in mind, do not output them):

- Turn Phase 2 OFF when the offer is simple, low-risk, low-ticket,

  and buyers mostly just need a trustworthy landing page to decide.

- Turn Phase 2 ON when buyers compare options or approaches,

  the decision is medium/high stakes, or internal approval is likely.

  - Use "scenario_listicle" when buyers are not very familiar with solution types

    and need "If you're in situation A, do X" style guidance.

  - Use "comparison_guide" when buyers already know the main solution types

    and want to weigh tradeoffs ("X vs Y vs Z").

- Turn Phase 3 ON when the desired outcome involves a multi-step journey,

  skills, or process (habits, complex B2B workflows, scientific work, etc.).

- Turn Phase 3 OFF when the outcome is simple or one-off

  (impulse buys, simple products, no real "how to" journey).

OUTPUT FORMAT (IMPORTANT):

Return ONLY a JSON object with exactly these 3 keys:

{

  "explanation": "<one or two sentences, specific about why Phase 2 and Phase 3 are on/off and which Phase 2 format you chose>",

  "phase2_choice": "<one of: none | scenario_listicle | comparison_guide>",

  "phase3_choice": "<one of: none | outcome_pillar>"

}

Do NOT add any extra keys, text, or markdown.

`

};

// ============================================
// 🎯 END PROMPT TEMPLATES
// ============================================

// ============================================
// 🤖 AI MODEL CONFIGURATION
// ============================================
// Configure which AI model to use for each suggestion type.
// Models: 'gpt-5.1' (most advanced), 'gpt-4o' (fast & cost-effective)
// ============================================

const AI_CONFIG = {
  name: {
    model: AI_MODELS.STANDARD, // Standard model for creative naming
    template: PROMPT_TEMPLATES.campaignName,
    description: 'Campaign name suggestions'
  },
  icp: {
    model: AI_MODELS.ADVANCED, // Advanced model for ICP analysis
    template: PROMPT_TEMPLATES.icpSuggestion,
    description: 'ICP suggestions with profitability and messaging insights'
  },
  outcome: {
    model: AI_MODELS.STANDARD, // Standard model for creative phrases
    template: PROMPT_TEMPLATES.outcome,
    description: 'Outcome phrase generation'
  },
  peace_of_mind: {
    model: AI_MODELS.STANDARD, // Standard model for guarantee statements
    template: PROMPT_TEMPLATES.peaceOfMind,
    description: 'Peace of mind / guarantee statements'
  },
  transactional_facts: {
    model: AI_MODELS.STANDARD, // Standard model for factual checklists
    template: PROMPT_TEMPLATES.transactionalFacts,
    description: 'Transactional facts checklist'
  },
  roadmap: {
    model: AI_MODELS.ADVANCED, // Advanced model for strategic roadmap planning
    template: PROMPT_TEMPLATES.roadmap,
    description: 'Campaign roadmap generation (phase enablement)'
  }
};

// ============================================
// 🎯 END AI MODEL CONFIGURATION
// ============================================

// Simple Components
function Button({ children, className = "", variant = "default", onClick, disabled = false, type = "button" }) {
  const baseClasses = "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";
  
  const variants = {
    default: "bg-blue-600 text-white hover:bg-blue-700 focus-visible:ring-blue-600",
    outline: "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus-visible:ring-blue-600",
    ghost: "text-gray-700 hover:bg-gray-100 focus-visible:ring-blue-600",
  };

  return (
    <button
      type={type}
      className={`${baseClasses} ${variants[variant]} px-4 py-2 gap-2 ${className}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

function Input({ label, className = "", ...props }) {
  return (
    <div className="mb-4">
      {label && <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>}
      <input
        className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600 ${className}`}
        {...props}
      />
    </div>
  );
}

function Textarea({ label, ...props }) {
  return (
    <div className="mb-4">
      {label && <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>}
      <textarea
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600 min-h-[100px]"
        {...props}
      />
    </div>
  );
}

function Select({ label, children, ...props }) {
  return (
    <div className="mb-4">
      {label && <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>}
      <select
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
        {...props}
      >
        {children}
      </select>
    </div>
  );
}

// Phase Map Component
// Pointing Finger Indicator Component
function PointingFingerIndicator() {
  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes point-bounce {
          0%, 100% {
            transform: translateX(0px);
          }
          50% {
            transform: translateX(8px);
          }
        }
        .pointing-finger {
          animation: point-bounce 1.5s ease-in-out infinite;
        }
      `}} />
      <div className="absolute -left-40 top-1/2 -translate-y-1/2 flex items-center gap-2 z-10">
        <div className="pointing-finger text-3xl">
          👉
        </div>
        <div className="bg-orange-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-lg whitespace-nowrap">
          Do this next
        </div>
      </div>
    </>
  );
}

function PhaseMapNode({ phase, isActive, isComplete, isLocked, isDisabled, isNext, onClick, articleTitle, articleId, onDissociate }) {
  // Updated icons to better match purposes:
  // Phase 1: Foundation/transactional/getting things done (building blocks, foundation)
  // Phase 2: Sorting through options/analytical and strategic (scales, decision)
  // Phase 3: Achieving goals/inspirational (mountain peak, achievement)
  const icons = {
    1: "🏗️", // Building/construction - foundation, transactional
    2: "⚖️", // Scales - analytical, decision-making, strategic
    3: "⛰️"  // Mountain - achievement, goals, inspirational
  };

  const labels = {
    1: "Help them buy",
    2: "Help them decide",
    3: "Help them achieve"
  };

  const phaseNames = {
    1: "PHASE 1",
    2: "PHASE 2",
    3: "PHASE 3"
  };

  const handleMainIconClick = (e) => {
    e.stopPropagation();
    if (isLocked || isDisabled) return;
    
    // If article is associated, open in new tab
    if (articleId) {
      window.open(`/content-magic/${articleId}`, '_blank');
    } else {
      // No article yet, use existing behavior
      onClick?.();
    }
  };

  const handleDissociateClick = async (e) => {
    e.stopPropagation();
    if (!articleId || !onDissociate) return;
    
    if (confirm('Are you sure you want to dissociate this article from this phase? The article will remain in Content Magic but will no longer be linked to this campaign phase. You can add it back later if needed.')) {
      await onDissociate(articleId);
    }
  };

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        {isNext && <PointingFingerIndicator />}
        {/* Dissociate button - positioned outside the main box, to the right of top right corner */}
        {articleId && phase >= 1 && phase <= 3 && (
          <button
            onClick={handleDissociateClick}
            className="absolute -top-1 -right-1 bg-red-500 hover:bg-red-600 rounded-full p-1 shadow-md transition-colors z-10"
            title="Dissociate article from this phase"
          >
            <XCircle className="w-3 h-3 text-white" />
          </button>
        )}
        <div
          onClick={handleMainIconClick}
          className={`
            w-32 h-32 rounded-lg border-4 flex flex-col items-center justify-center
            transition-all duration-300 relative
            ${isComplete ? 'border-green-500 bg-green-50 opacity-60' : ''}
            ${isNext ? 'border-orange-500 bg-orange-50 shadow-2xl scale-110 ring-4 ring-orange-200' : ''}
            ${isActive && !isNext ? 'border-blue-500 bg-blue-50 shadow-lg scale-105' : ''}
            ${isLocked ? 'border-gray-300 bg-gray-100 opacity-40' : ''}
            ${isDisabled ? 'border-gray-300 bg-gray-100 opacity-30' : ''}
            ${!isActive && !isComplete && !isLocked && !isDisabled && !isNext ? 'border-gray-300 bg-white hover:border-blue-400 cursor-pointer opacity-60' : ''}
            ${isLocked || isDisabled ? '' : 'cursor-pointer'}
          `}
        >
          <div className="text-4xl mb-2 relative">
            {icons[phase]}
            {isLocked && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Lock className="w-6 h-6 text-gray-500" />
              </div>
            )}
            {isComplete && (
              <div className="absolute -top-2 -right-2 bg-green-500 rounded-full p-1">
                <Check className="w-4 h-4 text-white" />
              </div>
            )}
          </div>
          <div className="text-xs font-semibold text-gray-600">{phaseNames[phase]}</div>
          <div className="text-xs text-gray-500 text-center px-2">{labels[phase]}</div>
          {isDisabled && (
          <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2">
            <span className="bg-gray-400 text-white text-xs px-2 py-0.5 rounded">
              Disabled
            </span>
          </div>
        )}
          {isActive && !isDisabled && !isNext && (
            <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
              <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded-full">
                Unlocked!
              </span>
            </div>
          )}
        </div>
      </div>
      {articleTitle && (
        <div className="mt-2 text-xs text-center text-gray-600 max-w-[130px] truncate">
          {articleTitle}
        </div>
      )}
    </div>
  );
}

// EXPAND Map Node Component (formerly Content Cluster)
function ExpandMapNode({ isLocked, isComplete, isNext, onClick, satelliteCount }) {
  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        {isNext && <PointingFingerIndicator />}
        <div
          onClick={!isLocked ? onClick : undefined}
          className={`
            w-32 h-32 rounded-lg border-4 flex flex-col items-center justify-center
            transition-all duration-300 relative
            ${isComplete ? 'border-green-500 bg-green-50 opacity-60' : ''}
            ${isNext ? 'border-orange-500 bg-orange-50 shadow-2xl scale-110 ring-4 ring-orange-200' : ''}
            ${!isLocked && !isComplete && !isNext ? 'border-purple-500 bg-purple-50 shadow-lg hover:scale-110 opacity-60' : ''}
            ${isLocked ? 'border-gray-300 bg-gray-100 opacity-40' : ''}
            ${isLocked ? '' : 'cursor-pointer'}
          `}
        >
          <div className="text-4xl mb-2 relative">
            🛰️ {/* Satellite icon representing pillar-to-satellite relationship */}
            {isLocked && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Lock className="w-6 h-6 text-gray-500" />
              </div>
            )}
            {isComplete && (
              <div className="absolute -top-2 -right-2 bg-green-500 rounded-full p-1">
                <Check className="w-4 h-4 text-white" />
              </div>
            )}
          </div>
          <div className="text-xs font-semibold text-gray-600">EXPAND</div>
          <div className="text-xs text-gray-500 text-center px-2">Build Your Visibility Cluster</div>
          {satelliteCount > 0 && (
            <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 bg-purple-500 text-white text-xs px-2 py-0.5 rounded-full">
              {satelliteCount}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CampaignSettings({ campaignId, campaign: initialCampaign, onSaved, onPhaseClick }) {
  const router = useRouter();
  const supabase = createClient();
  
  const [campaignsInstance, setCampaignsInstance] = useState(null);
  const [offersInstance, setOffersInstance] = useState(null);
  const [campaign, setCampaign] = useState(initialCampaign); // Local state for campaign
  const [icps, setIcps] = useState([]);
  const [offers, setOffers] = useState([]);
  const [icpsLoaded, setIcpsLoaded] = useState(false);
  const [offersLoaded, setOffersLoaded] = useState(false);
  const [isLoadingIcps, setIsLoadingIcps] = useState(false);
  const [isLoadingOffers, setIsLoadingOffers] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showCongrats, setShowCongrats] = useState(false);
  const [newlyCreatedCampaignId, setNewlyCreatedCampaignId] = useState(null); // Store ID of newly created campaign for delayed redirect
  const [showNewOfferForm, setShowNewOfferForm] = useState(false);
    const [showEditOfferForm, setShowEditOfferForm] = useState(false);
    const [showNewIcpForm, setShowNewIcpForm] = useState(false);
  const [isEditMode] = useState(!!campaignId);
  const [isSettingsCollapsed, setIsSettingsCollapsed] = useState(!!campaignId); // Collapse settings in edit mode by default
  const [isGenerating, setIsGenerating] = useState(false);
    const [generatingField, setGeneratingField] = useState(null);
    const [aiSuggestions, setAiSuggestions] = useState([]);
    const [showAISuggestions, setShowAISuggestions] = useState(null); // 'name' | 'outcome' | 'peace_of_mind' | null
    
    // Feedback state - store per field
    const [feedbackText, setFeedbackText] = useState({}); // { field: "feedback text" }
    const [showFeedbackInput, setShowFeedbackInput] = useState({}); // { field: true/false }
    const [originalPrompts, setOriginalPrompts] = useState({}); // { field: "original prompt" }
    const [previousSuggestions, setPreviousSuggestions] = useState({}); // { field: [...] }

  const [formData, setFormData] = useState({
    name: "",
    icp_id: "",
    offer_id: "",
    outcome: "",
    peace_of_mind: "",
    status: "planning"
  });
  
  // Roadmap state
  const [campaignRoadmap, setCampaignRoadmap] = useState(null); // Stores the full roadmap JSON
  const [isGeneratingRoadmap, setIsGeneratingRoadmap] = useState(false);
  // Radio button selections for roadmap
  const [phase2Selection, setPhase2Selection] = useState("skip"); // "skip" | "listicle" | "guide"
  const [phase3Selection, setPhase3Selection] = useState("skip"); // "skip" | "pillar"
  
  // EXPAND panel state
  const [showExpandPanel, setShowExpandPanel] = useState(false);
  const [selectedStrategies, setSelectedStrategies] = useState(["deep_dive", "case_study"]); // Default selected
  const [isGeneratingIdeas, setIsGeneratingIdeas] = useState(false);

  const [newOffer, setNewOffer] = useState({
    name: "",
    description: "",
    transactional_facts: ""
  });
  const [newIcp, setNewIcp] = useState({
    name: "",
    description: ""
  });

  useEffect(() => {
    initialize();
  }, []);

  // Reload campaign from database on mount and when campaignId changes
  const isLoadingCampaignRef = useRef(false);
  useEffect(() => {
    const reloadCampaign = async () => {
      // Prevent concurrent calls
      if (isLoadingCampaignRef.current) {
        return;
      }
      
      if (campaignId && campaignsInstance) {
        isLoadingCampaignRef.current = true;
        try {
          const freshCampaign = await campaignsInstance.getWithDetails(campaignId);
          if (freshCampaign) {
            // Update local campaign state
            setCampaign(freshCampaign);
            // Update form data with fresh campaign data
            setFormData({
              name: freshCampaign.name || "",
              icp_id: freshCampaign.icp_id || "",
              offer_id: freshCampaign.offer_id || "",
              outcome: freshCampaign.outcome || "",
              peace_of_mind: freshCampaign.peace_of_mind || "",
              status: freshCampaign.status || "planning"
            });
            // Load roadmap if it exists
            if (freshCampaign.campaign_roadmap) {
              setCampaignRoadmap(freshCampaign.campaign_roadmap);
              // Set radio button selections based on roadmap (new format)
              const roadmap = freshCampaign.campaign_roadmap;
              if (roadmap.phase2_choice === 'none') {
                setPhase2Selection('skip');
              } else if (roadmap.phase2_choice === 'scenario_listicle') {
                setPhase2Selection('listicle');
              } else if (roadmap.phase2_choice === 'comparison_guide') {
                setPhase2Selection('guide');
              }
              
              if (roadmap.phase3_choice === 'none') {
                setPhase3Selection('skip');
              } else if (roadmap.phase3_choice === 'outcome_pillar') {
                setPhase3Selection('pillar');
              }
            }
          }
        } catch (error) {
        }
      } else if (initialCampaign) {
        // Fallback to prop if no campaignId
        setCampaign(initialCampaign);
        setFormData({
          name: initialCampaign.name || "",
          icp_id: initialCampaign.icp_id || "",
          offer_id: initialCampaign.offer_id || "",
          outcome: initialCampaign.outcome || "",
          peace_of_mind: initialCampaign.peace_of_mind || "",
          status: initialCampaign.status || "planning"
        });
        // Load roadmap if it exists
        if (initialCampaign.campaign_roadmap) {
          setCampaignRoadmap(initialCampaign.campaign_roadmap);
          // Set radio button selections based on roadmap (new format)
          const roadmap = initialCampaign.campaign_roadmap;
          if (roadmap.phase2_choice === 'none') {
            setPhase2Selection('skip');
          } else if (roadmap.phase2_choice === 'scenario_listicle') {
            setPhase2Selection('listicle');
          } else if (roadmap.phase2_choice === 'comparison_guide') {
            setPhase2Selection('guide');
          }
          
          if (roadmap.phase3_choice === 'none') {
            setPhase3Selection('skip');
          } else if (roadmap.phase3_choice === 'outcome_pillar') {
            setPhase3Selection('pillar');
          }
        }
      }
    };

    if (campaignsInstance) {
      reloadCampaign();
    }
  }, [campaignId, campaignsInstance]); // Reload when campaignId or campaignsInstance changes


  useEffect(() => {
  }, [isGenerating, generatingField, showAISuggestions, aiSuggestions]);

  // Load ICPs on-demand
  const loadIcps = async () => {
    if (icpsLoaded || isLoadingIcps) return;
    
    setIsLoadingIcps(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: icpsData } = await supabase
          .from("icps")
          .select("id, name, description")
          .eq("user_id", user.id)
          .order("name");
        
        setIcps(icpsData || []);
        setIcpsLoaded(true);
      }
    } catch (error) {
    } finally {
      setIsLoadingIcps(false);
    }
  };

  // Load Offers on-demand
  const loadOffers = async () => {
    if (offersLoaded || isLoadingOffers || !offersInstance) return;
    
    setIsLoadingOffers(true);
    try {
      const offersData = await offersInstance.list();
      setOffers(offersData || []);
      setOffersLoaded(true);
    } catch (error) {
    } finally {
      setIsLoadingOffers(false);
    }
  };

  const initialize = async () => {
    try {
      setIsLoading(true);
      
      const [campaignsInst, offersInst] = await Promise.all([
        initCampaigns(),
        initOffers()
      ]);
      
      setCampaignsInstance(campaignsInst);
      setOffersInstance(offersInst);

      // Offers and ICPs will be loaded on-demand when user opens the dropdown

    } catch (error) {
      alert("Failed to load data. Please refresh the page.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));


    
    
    if (field === "offer_id" && value && !isEditMode) {
      const selectedOffer = offers.find(o => o.id === value);
      if (selectedOffer && !formData.name) {
        setFormData(prev => ({ ...prev, name: selectedOffer.name }));
      }
    }
  };
  const handleAIGenerate = async (field) => {
    // For ICP suggestions, we only need an offer (since we're creating a NEW ICP)
    if (field === 'icp') {
      if (!formData.offer_id) {
        alert("Please select an Offer first to generate ICP suggestions");
        return;
      }
    } else if (field === 'transactional_facts') {
      // For transactional facts, we only need the offer name and description in the form
      // No ICP or existing offer selection required
      if (!newOffer.name || !newOffer.description) {
        alert("Please enter Offer name and description first to generate transactional details");
        return;
      }
    } else {
      // For other fields, we need both ICP and Offer
      if (!formData.icp_id || !formData.offer_id) {
        alert("Please select ICP and Offer first to generate AI suggestions");
        return;
      }
    }
  
    try {
      setIsGenerating(true);
      setGeneratingField(field);
      setShowAISuggestions(null);
  
      const selectedIcp = icps.find(i => i.id === formData.icp_id);
      const selectedOffer = offers.find(o => o.id === formData.offer_id);
      // Get AI configuration for this field
      const aiConfig = AI_CONFIG[field];
      if (!aiConfig) {
        throw new Error(`No AI configuration found for field: ${field}`);
      }
      // Use agentic pipelines for supported fields
      if (field === "icp") {
        // Use ICP_SUGGEST agentic pipeline (light agentic)
        if (!selectedOffer) {
          alert("Please select an offer first");
          return;
        }
        const monkey = await initMonkey();
        const text = await monkey.apiCall("/api/monkey/run-task", {
          taskType: "ICP_SUGGEST",
          model: aiConfig.model === "gpt-4o" ? "high" : "mid", // Map to monkey model tier
          campaignContext: {
            offer: {
              name: selectedOffer.name,
              description: selectedOffer.description,
            },
          },
          userInput: {
            query: `Suggest ideal customer profiles for offer: "${selectedOffer.name}"`,
          },
        });
        const data = JSON.parse(text);
        if (data.error) {
          throw new Error(data.error || "AI generation failed");
        }
        if (!data.ok || !data.artifacts?.icpCandidates?.icps) {
          throw new Error(data.errors?.[0]?.message || "Failed to generate ICP suggestions");
        }

        // Map agentic pipeline output to UI format: {name, description}
        const icpCandidates = data.artifacts.icpCandidates.icps || [];
        const suggestions = icpCandidates.map((icp) => ({
          name: icp.name,
          description: icp.who || icp.whyFit || "No description available",
        }));

        setOriginalPrompts(prev => ({ ...prev, [field]: `Agentic ICP pipeline (${icpCandidates.length} ICPs generated)` }));
        const processedSuggestions = processAIResponse(field, suggestions);
        setAiSuggestions(processedSuggestions);
        setPreviousSuggestions(prev => ({ ...prev, [field]: processedSuggestions }));
        setShowAISuggestions(field);
      } else if (field === "outcome") {
        // Use KEYWORD_OUTCOME_SUGGEST agentic pipeline
        const monkey = await initMonkey();
        const text = await monkey.apiCall("/api/monkey/run-task", {
          taskType: "KEYWORD_OUTCOME_SUGGEST",
          model: aiConfig.model === "gpt-4o" ? "high" : "mid",
          campaignContext: {
            icp: { name: selectedIcp?.name },
            offer: {
              name: selectedOffer?.name,
              description: selectedOffer?.description,
            },
          },
          userInput: {
            query: `Generate outcome keywords for ICP: "${selectedIcp?.name}" and Offer: "${selectedOffer?.name}"`,
          },
        });
        const data = JSON.parse(text);
        if (data.error) throw new Error(data.error || "AI generation failed");
        if (!data.ok || !data.artifacts?.keywordOutcome) {
          throw new Error(data.errors?.[0]?.message || "Failed to generate keyword outcome");
        }

        // Map agentic pipeline output to UI format: array of 3 keyword phrases
        const outcome = data.artifacts.keywordOutcome;
        const suggestions = [
          outcome.primaryKeyword,
          ...(outcome.secondaryKeywords || []).slice(0, 2),
        ].filter(Boolean).slice(0, 3);

        setOriginalPrompts(prev => ({ ...prev, [field]: `Agentic keyword outcome pipeline` }));
        const processedSuggestions = processAIResponse(field, suggestions);
        setAiSuggestions(processedSuggestions);
        setPreviousSuggestions(prev => ({ ...prev, [field]: processedSuggestions }));
        setShowAISuggestions(field);
      } else if (field === "peace_of_mind") {
        // Use PROMISE_SUGGEST agentic pipeline
        const monkey = await initMonkey();
        const text = await monkey.apiCall("/api/monkey/run-task", {
          taskType: "PROMISE_SUGGEST",
          model: aiConfig.model === "gpt-4o" ? "high" : "mid",
          campaignContext: {
            icp: { name: selectedIcp?.name },
            offer: {
              name: selectedOffer?.name,
              description: selectedOffer?.description,
            },
          },
          userInput: {
            query: `Generate peace of mind promises for ICP: "${selectedIcp?.name}" and Offer: "${selectedOffer?.name}"`,
          },
        });
        const data = JSON.parse(text);
        if (!data.ok || !data.artifacts?.promiseOptions?.options) {
          throw new Error(data.errors?.[0]?.message || "Failed to generate promises");
        }

        // Map agentic pipeline output to UI format: array of 3 promise strings
        const promiseOptions = data.artifacts.promiseOptions.options || [];
        const suggestions = promiseOptions.slice(0, 3).map((p) => p.promise);

        setOriginalPrompts(prev => ({ ...prev, [field]: `Agentic promise pipeline` }));
        const processedSuggestions = processAIResponse(field, suggestions);
        setAiSuggestions(processedSuggestions);
        setPreviousSuggestions(prev => ({ ...prev, [field]: processedSuggestions }));
        setShowAISuggestions(field);
      } else {
        // Fallback to old /api/ai for unsupported fields (name, transactional_facts)
        let prompt = "";
        
        if (field === "name") {
          prompt = aiConfig.template(
            selectedOffer?.name,
            selectedOffer?.description,
            selectedIcp?.name
          );
        } else if (field === "transactional_facts") {
          // For transactional facts, use newOffer being edited, not selectedOffer
          prompt = aiConfig.template(
            newOffer.name,
            newOffer.description
          );
        }
  
        
        const monkey = await initMonkey();
        const text = await monkey.apiCall("/api/ai", {
          query: prompt,
          vendor: "ChatGPT",
          model: aiConfig.model
        });
        const data = JSON.parse(text);
        if (data.error) {
          throw new Error(data.error || "AI generation failed");
        }
        let suggestions = [];
        try {
          let responseText = data.response || data.result || "";
          // Strip markdown code fences if present
          if (typeof responseText === 'string') {
            // Remove ```json ... ``` or ``` ... ```
            responseText = responseText.replace(/```(?:json)?\s*\n?/g, '').trim();
          }
          
          const parsed = JSON.parse(responseText);
          suggestions = Array.isArray(parsed) ? parsed : [responseText];
        } catch (parseError) {
          const responseText = data.response || data.result || "";
          suggestions = [responseText];
        }
        // Store original prompt and suggestions for feedback functionality
        setOriginalPrompts(prev => ({ ...prev, [field]: prompt }));
        
        // Process response using reusable function
        const processedSuggestions = processAIResponse(field, suggestions);
        setAiSuggestions(processedSuggestions);
        setPreviousSuggestions(prev => ({ ...prev, [field]: processedSuggestions }));
        
        setShowAISuggestions(field);
      }
  
    } catch (error) {
      alert(`Failed to generate AI suggestion: ${error.message}`);
    } finally {
      setIsGenerating(false);
      setGeneratingField(null);
    }
  };
  
  /**
   * Reusable function to process AI response based on field type
   * Extracted to avoid duplication between handleAIGenerate and handleAIGenerateWithFeedback
   * @param {string} field - The field name
   * @param {any[]} suggestions - Raw suggestions array from AI
   * @returns {any[]} Processed suggestions array
   */
  const processAIResponse = useCallback((field, suggestions) => {
    if (field === 'icp') {
      const filteredSuggestions = suggestions.filter(s => {
        const isValid = s && typeof s === 'object' && s.name;
        return isValid;
      });
      return filteredSuggestions;
    } else if (field === 'transactional_facts') {
      let finalSuggestion;
      if (Array.isArray(suggestions) && suggestions.length > 0) {
        if (suggestions.length === 1 && typeof suggestions[0] === 'string') {
          finalSuggestion = suggestions[0].trim();
        } else {
          finalSuggestion = suggestions.map(s => {
            if (typeof s === 'string') return s.trim();
            if (typeof s === 'object' && s !== null) {
              return JSON.stringify(s, null, 2)
                .replace(/[{}]/g, '')
                .replace(/"/g, '')
                .replace(/,\s*$/gm, '')
                .trim();
            }
            return '';
          }).filter(Boolean).join('\n\n---\n\n');
        }
      } else if (typeof suggestions === 'string') {
        finalSuggestion = suggestions.trim();
      } else {
        finalSuggestion = '';
      }
      return finalSuggestion ? [finalSuggestion] : [];
    } else {
      const filteredSuggestions = suggestions.filter(s => {
        const isValidString = typeof s === 'string' && s.trim().length > 0;
        return isValidString;
      });
      return filteredSuggestions;
    }
  }, []);

  /**
   * Reusable function to generate AI suggestions with user feedback
   * Can be called from any AI suggest button that wants feedback functionality
   * @param {string} field - The field name (e.g., 'icp', 'name', 'outcome')
   * @param {string} userFeedback - The user's feedback text
   */
  const handleAIGenerateWithFeedback = async (field, userFeedback) => {
    if (!userFeedback || !userFeedback.trim()) {
      alert("Please enter feedback before submitting");
      return;
    }

    const prevSuggestions = previousSuggestions[field] || [];

    try {
      setIsGenerating(true);
      setGeneratingField(field);
      setShowAISuggestions(null);

      const selectedIcp = icps.find(i => i.id === formData.icp_id);
      const selectedOffer = offers.find(o => o.id === formData.offer_id);
      const aiConfig = AI_CONFIG[field];
      
      if (!aiConfig) {
        throw new Error(`No AI configuration found for field: ${field}`);
      }

      // Use agentic pipelines for supported fields with feedback
      if (field === "icp") {
        if (!selectedOffer) {
          alert("Please select an offer first");
          return;
        }
        
        const prevSuggestionsText = Array.isArray(prevSuggestions)
          ? prevSuggestions.map((s, i) => `${i + 1}. ${s.name || JSON.stringify(s)}`).join('\n')
          : String(prevSuggestions);
        
        const monkey = await initMonkey();
        const text = await monkey.apiCall("/api/monkey/run-task", {
          taskType: "ICP_SUGGEST",
          model: aiConfig.model === "gpt-4o" ? "high" : "mid",
          campaignContext: {
            offer: {
              name: selectedOffer.name,
              description: selectedOffer.description,
            },
          },
          userInput: {
            query: `Suggest ideal customer profiles for offer: "${selectedOffer.name}". Previous suggestions: ${prevSuggestionsText}. User feedback: ${userFeedback.trim()}`,
          },
          constraints: {
            feedback: userFeedback.trim(),
            previousSuggestions: prevSuggestions,
          },
        });
        const data = JSON.parse(text);
        if (!data.ok || !data.artifacts?.icpCandidates?.icps) {
          throw new Error(data.errors?.[0]?.message || "Failed to generate ICP suggestions");
        }

        const icpCandidates = data.artifacts.icpCandidates.icps || [];
        const suggestions = icpCandidates.map((icp) => ({
          name: icp.name,
          description: icp.who || icp.whyFit || "No description available",
        }));

        setOriginalPrompts(prev => ({ ...prev, [field]: `Agentic ICP pipeline with feedback` }));
        const processedSuggestions = processAIResponse(field, suggestions);
        setAiSuggestions(processedSuggestions);
        setPreviousSuggestions(prev => ({ ...prev, [field]: processedSuggestions }));
        setShowAISuggestions(field);
        setIsGenerating(false);
        setGeneratingField(null);
        return;

      } else if (field === "outcome") {
        const prevSuggestionsText = Array.isArray(prevSuggestions) ? prevSuggestions.join(', ') : String(prevSuggestions);
        const monkey = await initMonkey();
        const text = await monkey.apiCall("/api/monkey/run-task", {
          taskType: "KEYWORD_OUTCOME_SUGGEST",
          model: aiConfig.model === "gpt-4o" ? "high" : "mid",
          campaignContext: {
            icp: { name: selectedIcp?.name },
            offer: { name: selectedOffer?.name, description: selectedOffer?.description },
          },
          userInput: {
            query: `Generate outcome keywords. Previous: ${prevSuggestionsText}. User feedback: ${userFeedback.trim()}`,
          },
          constraints: {
            feedback: userFeedback.trim(),
            previousSuggestions: prevSuggestions,
          },
        });
        const data = JSON.parse(text);
        if (!data.ok || !data.artifacts?.keywordOutcome) {
          throw new Error(data.errors?.[0]?.message || "Failed to generate keyword outcome");
        }

        const outcome = data.artifacts.keywordOutcome;
        const suggestions = [
          outcome.primaryKeyword,
          ...(outcome.secondaryKeywords || []).slice(0, 2),
        ].filter(Boolean).slice(0, 3);

        setOriginalPrompts(prev => ({ ...prev, [field]: `Agentic keyword outcome pipeline with feedback` }));
        const processedSuggestions = processAIResponse(field, suggestions);
        setAiSuggestions(processedSuggestions);
        setPreviousSuggestions(prev => ({ ...prev, [field]: processedSuggestions }));
        setShowAISuggestions(field);
        setIsGenerating(false);
        setGeneratingField(null);
        return;

      } else if (field === "peace_of_mind") {
        const prevSuggestionsText = Array.isArray(prevSuggestions) ? prevSuggestions.join(', ') : String(prevSuggestions);
        
        const monkey = await initMonkey();
        const text = await monkey.apiCall("/api/monkey/run-task", {
          taskType: "PROMISE_SUGGEST",
          model: aiConfig.model === "gpt-4o" ? "high" : "mid",
          campaignContext: {
            icp: { name: selectedIcp?.name },
            offer: { name: selectedOffer?.name, description: selectedOffer?.description },
          },
          userInput: {
            query: `Generate peace of mind promises. Previous: ${prevSuggestionsText}. User feedback: ${userFeedback.trim()}`,
          },
          constraints: {
            feedback: userFeedback.trim(),
            previousSuggestions: prevSuggestions,
          },
        });
        const data = JSON.parse(text);
        if (!data.ok || !data.artifacts?.promiseOptions?.options) {
          throw new Error(data.errors?.[0]?.message || "Failed to generate promises");
        }

        const promiseOptions = data.artifacts.promiseOptions.options || [];
        const suggestions = promiseOptions.slice(0, 3).map((p) => p.promise);

        setOriginalPrompts(prev => ({ ...prev, [field]: `Agentic promise pipeline with feedback` }));
        const processedSuggestions = processAIResponse(field, suggestions);
        setAiSuggestions(processedSuggestions);
        setPreviousSuggestions(prev => ({ ...prev, [field]: processedSuggestions }));
        setShowAISuggestions(field);
        setIsGenerating(false);
        setGeneratingField(null);
        return;
      }

      // Fallback to old /api/ai for unsupported fields (name, transactional_facts, roadmap)
      const originalPrompt = originalPrompts[field];
      if (!originalPrompt) {
        alert("Unable to generate feedback suggestions. Please generate initial suggestions first.");
        setIsGenerating(false);
        setGeneratingField(null);
        return;
      }

      // Build feedback prompt for old API
      const previousSuggestionsText = Array.isArray(prevSuggestions)
        ? prevSuggestions.map((s, i) => {
            if (typeof s === 'object' && s !== null) {
              return `${i + 1}. ${JSON.stringify(s)}`;
            }
            return `${i + 1}. ${s}`;
          }).join('\n')
        : String(prevSuggestions);

      const feedbackPrompt = `Previous AI suggestions for this request:
${previousSuggestionsText}

User's feedback for previous results: ${userFeedback.trim()}

Original request:
${originalPrompt}

Based on the user's feedback above, please generate new suggestions that address their concerns. Retain the same response format as the original request.`;

      
      const monkey = await initMonkey();
      const text = await monkey.apiCall("/api/ai", {
        query: feedbackPrompt,
        vendor: "ChatGPT",
        model: aiConfig.model
      });
      const data = JSON.parse(text);
      if (data.error) {
        throw new Error(data.error || "AI generation failed");
      }
      let suggestions = [];
      let responseText = data.response || data.result || "";
      // Special handling for roadmap - it returns explanation + JSON, not just JSON
      if (field === 'roadmap') {
        // For roadmap, keep the raw response text (don't try to parse as JSON)
        suggestions = [responseText];
      } else {
        try {
          // Strip markdown code fences if present
          if (typeof responseText === 'string') {
            responseText = responseText.replace(/```(?:json)?\s*\n?/g, '').trim();
          }

          const parsed = JSON.parse(responseText);
          suggestions = Array.isArray(parsed) ? parsed : [responseText];
        } catch (parseError) {
          suggestions = [responseText];
        }
      }
      // Special handling for roadmap - parse explanation and JSON
      if (field === 'roadmap') {
        let explanation = "";
        let roadmap = null;
        
        // The response should be a string with EXPLANATION and ROADMAP_JSON sections
        const roadmapResponseText = Array.isArray(suggestions) && suggestions.length > 0 
          ? suggestions[0] 
          : String(suggestions);
        
        if (typeof roadmapResponseText === 'string') {
          const explanationMatch = roadmapResponseText.match(/EXPLANATION:\s*([\s\S]*?)(?=\n---|ROADMAP_JSON:|$)/i);
          const jsonMatch = roadmapResponseText.match(/ROADMAP_JSON:\s*([\s\S]*?)(?=\n---|$)/i);
          
          if (explanationMatch) {
            explanation = explanationMatch[1].trim();
          }
          
          if (jsonMatch) {
            let jsonText = jsonMatch[1].trim();
            jsonText = jsonText.replace(/```(?:json)?\s*\n?/g, '').replace(/```\s*$/g, '').trim();
            roadmap = JSON.parse(jsonText);
          }
        }
        
        if (roadmap) {
          setCampaignRoadmap(roadmap);
          // Update radio button selections
          if (roadmap.phase2?.enabled) {
            setPhase2Selection(roadmap.phase2.mode === 'scenario_listicle' ? 'listicle' : 'guide');
          } else {
            setPhase2Selection('skip');
          }
          if (roadmap.phase3?.enabled) {
            setPhase3Selection('pillar');
          } else {
            setPhase3Selection('skip');
          }
          const displayText = explanation || "Roadmap generated successfully";
          setAiSuggestions([displayText]);
          setPreviousSuggestions(prev => ({ ...prev, [field]: [displayText] }));
        } else {
          // Fallback to regular processing
          const processedSuggestions = processAIResponse(field, suggestions);
          setAiSuggestions(processedSuggestions);
          setPreviousSuggestions(prev => ({ ...prev, [field]: processedSuggestions }));
        }
      } else {
        // Process response using reusable function for other fields
        const processedSuggestions = processAIResponse(field, suggestions);
        setAiSuggestions(processedSuggestions);
        setPreviousSuggestions(prev => ({ ...prev, [field]: processedSuggestions }));
      }

      setShowAISuggestions(field);
      setShowFeedbackInput(prev => ({ ...prev, [field]: false }));
      setFeedbackText(prev => ({ ...prev, [field]: "" }));
    } catch (error) {
      alert(`Failed to generate AI suggestion: ${error.message}`);
    } finally {
      setIsGenerating(false);
      setGeneratingField(null);
    }
  };

  /**
   * Reusable Feedback UI Component
   * Can be added to any AI suggestions dropdown
   * @param {string} field - The field name
   * @returns {React.ReactNode} Feedback UI JSX
   */
  const renderFeedbackSection = useCallback((field) => {
    return (
      <div className="pt-2 mt-2 border-t border-blue-300">
        <p className="text-xs text-gray-600 mb-2">Or provide feedback to generate new options</p>
        
        {!showFeedbackInput[field] ? (
          <button
            onClick={() => setShowFeedbackInput(prev => ({ ...prev, [field]: true }))}
            className="w-full text-center p-2 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded border border-blue-200 transition-colors"
          >
            Provide Feedback
          </button>
        ) : (
          <div className="space-y-2">
            <textarea
              value={feedbackText[field] || ''}
              onChange={(e) => setFeedbackText(prev => ({ ...prev, [field]: e.target.value }))}
              placeholder="What would you like to change or improve?"
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded min-h-[60px]"
              rows={3}
            />
            <div className="flex gap-2">
              <button
                onClick={() => handleAIGenerateWithFeedback(field, feedbackText[field] || '')}
                disabled={isGenerating || !feedbackText[field]?.trim()}
                className="flex-1 px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
              >
                {isGenerating && generatingField === field ? "Generating..." : "Refresh Suggestions"}
                <CreditCostBadge path="/api/ai" size="sm" />
              </button>
              <button
                onClick={() => {
                  setShowFeedbackInput(prev => ({ ...prev, [field]: false }));
                  setFeedbackText(prev => ({ ...prev, [field]: "" }));
                }}
                className="px-3 py-1 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }, [showFeedbackInput, feedbackText, isGenerating, generatingField, handleAIGenerateWithFeedback]);

  const handleSelectSuggestion = (field, suggestion) => {
    if (field === "icp") {
      // For ICP, suggestion is an object with name and description
      setNewIcp({
        name: suggestion.name,
        description: suggestion.description
      });
      setShowNewIcpForm(true);
    } else if (field === "transactional_facts") {
      // For transactional facts, update the newOffer state with instruction line
      const instructionLine = "⚠️ Replace the following with actual facts of your offer:\n\n";
      setNewOffer(prev => ({
        ...prev,
        transactional_facts: instructionLine + suggestion
      }));
    } else if (field === "roadmap") {
      // For roadmap, the JSON is already stored in campaignRoadmap
      // Radio buttons are already updated in handleGenerateRoadmap
      // Just close the dropdown
    } else {
      // For other fields, suggestion is a string
      handleChange(field, suggestion);
    }
    
    setShowAISuggestions(null);
    setAiSuggestions([]);
    // Clear feedback state when suggestion is selected
    setShowFeedbackInput(prev => ({ ...prev, [field]: false }));
    setFeedbackText(prev => ({ ...prev, [field]: "" }));
  };

  const handleCreateOffer = async () => {
    if (!newOffer.name.trim()) {
      alert("Offer name is required");
      return;
    }
    if (!newOffer.description.trim()) {
      alert("Offer description is required");
      return;
    }

    try {
      const offerData = {
        name: newOffer.name,
        description: newOffer.description,
        transactional_facts: newOffer.transactional_facts
      };
      
      const createdOffer = await offersInstance.create(offerData);
      setOffers(prev => [...prev, createdOffer]);
      setFormData(prev => ({ ...prev, offer_id: createdOffer.id }));
      setNewOffer({ 
        name: "", 
        description: "",
        transactional_facts: ""
      });
      setShowNewOfferForm(false);
      alert("Offer created successfully!");
    } catch (error) {
      alert("Failed to create offer. Please try again.");
    }
  };
  const handleEditOffer = () => {
    const selectedOffer = offers.find(o => o.id === formData.offer_id);
    if (!selectedOffer) {
      alert("Please select an offer to edit");
      return;
    }
    
    // Load the selected offer into the newOffer state for editing
    setNewOffer({
        name: selectedOffer.name || "",
        description: selectedOffer.description || "",
        transactional_facts: typeof selectedOffer.transactional_facts === 'string' 
            ? selectedOffer.transactional_facts 
            : (selectedOffer.transactional_facts ? JSON.stringify(selectedOffer.transactional_facts, null, 2) : "")
    });
    
    setShowNewOfferForm(false);
    setShowEditOfferForm(true);
  };

  const handleUpdateOffer = async () => {
    if (!formData.offer_id) {
      alert("No offer selected");
      return;
    }
    if (!newOffer.name.trim()) {
      alert("Offer name is required");
      return;
    }
    if (!newOffer.description.trim()) {
      alert("Offer description is required");
      return;
    }

    try {
      const offerData = {
        name: newOffer.name,
        description: newOffer.description,
        transactional_facts: newOffer.transactional_facts
      };
      
      const updatedOffer = await offersInstance.update(formData.offer_id, offerData);
      
      // Update the offers list
      setOffers(prev => prev.map(o => o.id === formData.offer_id ? updatedOffer : o));
      
      // Reset form
      setNewOffer({ 
        name: "", 
        description: "",
        transactional_facts: ""
      });
      setShowEditOfferForm(false);
      alert("Offer updated successfully!");
    } catch (error) {
      alert("Failed to update offer. Please try again.");
    }
  };
  const handleCreateIcp = async () => {
    if (!newIcp.name.trim()) {
      alert("ICP name is required");
      return;
    }
    if (!newIcp.description.trim()) {
      alert("ICP description is required");
      return;
    }

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        alert("Please log in to create an ICP");
        return;
      }

      const icpData = {
        user_id: user.id,
        name: newIcp.name,
        description: newIcp.description
      };
      
      const { data: createdIcp, error } = await supabase
        .from('icps')
        .insert([icpData])
        .select()
        .single();
      
      if (error) throw error;
      
      setIcps(prev => [...prev, createdIcp]);
      setFormData(prev => ({ ...prev, icp_id: createdIcp.id }));
      setNewIcp({ name: "", description: "" });
      setShowNewIcpForm(false);
      alert("ICP created successfully!");
    } catch (error) {
      alert("Failed to create ICP. Please try again.");
    }
  };

  const handleGenerateRoadmap = async () => {
    if (!formData.icp_id || !formData.offer_id || !formData.name) {
      alert("Please complete ICP, Offer, and Campaign Name first");
      return;
    }

    try {
      setIsGenerating(true);
      setGeneratingField('roadmap');
      setIsGeneratingRoadmap(true);
      setShowAISuggestions(null);
      
      const selectedIcp = icps.find(i => i.id === formData.icp_id);
      const selectedOffer = offers.find(o => o.id === formData.offer_id);
      const aiConfig = AI_CONFIG.roadmap;
      const monkey = await initMonkey();
      const text = await monkey.apiCall("/api/monkey/run-task", {
        taskType: "CAMPAIGN_ROADMAP_PLAN",
        model: aiConfig.model === "gpt-4o" ? "high" : "agent", // Use agent for roadmap (agentic)
        campaignContext: {
          offer: {
            name: selectedOffer?.name,
            description: selectedOffer?.description,
          },
          icp: {
            name: selectedIcp?.name,
            description: selectedIcp?.description,
          },
          campaign: { name: formData.name },
          outcome: formData.outcome,
          promise: formData.peace_of_mind,
        },
        userInput: {
          query: `Generate campaign roadmap for campaign: "${formData.name}" with offer: "${selectedOffer?.name}" and ICP: "${selectedIcp?.name}"`,
        },
      });
      const data = JSON.parse(text);
      if (data.error) throw new Error(data.error || "AI generation failed");
      if (!data.ok || !data.artifacts?.campaignRoadmap) {
        throw new Error(data.errors?.[0]?.message || "Failed to generate roadmap");
      }

      const campaignRoadmap = data.artifacts.campaignRoadmap;
      
      // Map agentic pipeline output (phases[]) to UI format {explanation, phase2_choice, phase3_choice}
      // The new roadmap has phases with assets, but UI expects phase2_choice and phase3_choice
      // We need to infer phase choices from the phases array
      let phase2_choice = "none";
      let phase3_choice = "none";
      let explanation = "";
      
      if (campaignRoadmap.phases && Array.isArray(campaignRoadmap.phases)) {
        // Check if Phase 2 assets exist
        const phase2 = campaignRoadmap.phases.find(p => p.id === "phase2" || p.name?.toLowerCase().includes("decision") || p.name?.toLowerCase().includes("mid-funnel"));
        if (phase2 && phase2.assets && phase2.assets.length > 0) {
          // Determine format from asset types or names
          const hasComparison = phase2.assets.some(a => 
            a.type?.toLowerCase().includes("comparison") || 
            a.title?.toLowerCase().includes("vs") ||
            a.title?.toLowerCase().includes("compare")
          );
          phase2_choice = hasComparison ? "comparison_guide" : "scenario_listicle";
        }
        
        // Check if Phase 3 assets exist
        const phase3 = campaignRoadmap.phases.find(p => p.id === "phase3" || p.name?.toLowerCase().includes("outcome") || p.name?.toLowerCase().includes("pillar"));
        if (phase3 && phase3.assets && phase3.assets.length > 0) {
          phase3_choice = "outcome_pillar";
        }
        
        // Build explanation from differentiation notes or phase objectives
        const notes = campaignRoadmap.differentiationNotes || [];
        explanation = notes.length > 0 
          ? notes.join(" ") 
          : campaignRoadmap.phases.map(p => p.objective).filter(Boolean).join(". ");
      }
      
      // Fallback explanation if empty
      if (!explanation) {
        explanation = `Roadmap generated with Phase 2: ${phase2_choice === "none" ? "disabled" : phase2_choice}, Phase 3: ${phase3_choice === "none" ? "disabled" : phase3_choice}`;
      }
      
      const roadmap = {
        explanation,
        phase2_choice,
        phase3_choice,
      };
      // Store the roadmap JSON
      setCampaignRoadmap(roadmap);
      
      // Update radio button selections based on AI response
      if (roadmap.phase2_choice === 'none') {
        setPhase2Selection('skip');
      } else if (roadmap.phase2_choice === 'scenario_listicle') {
        setPhase2Selection('listicle');
      } else if (roadmap.phase2_choice === 'comparison_guide') {
        setPhase2Selection('guide');
      }
      
      if (roadmap.phase3_choice === 'none') {
        setPhase3Selection('skip');
      } else if (roadmap.phase3_choice === 'outcome_pillar') {
        setPhase3Selection('pillar');
      }
      
      // Store original prompt and suggestions for feedback functionality
      setOriginalPrompts(prev => ({ ...prev, roadmap: "Agentic campaign roadmap pipeline" }));
      setPreviousSuggestions(prev => ({ ...prev, roadmap: [roadmap.explanation] }));
      
      // Show suggestions dropdown with the explanation
      setAiSuggestions([roadmap.explanation]);
      setShowAISuggestions('roadmap');
      
    } catch (error) {
      alert(`Failed to generate roadmap: ${error.message}`);
    } finally {
      setIsGenerating(false);
      setGeneratingField(null);
      setIsGeneratingRoadmap(false);
    }
  };

  const handlePhase2Change = (value) => {
    setPhase2Selection(value);
    // Update roadmap JSON when radio button changes
    setCampaignRoadmap(prev => {
      if (!prev) return null;
      const updated = { ...prev };
      // Map radio button value to phase2_choice
      if (value === "skip") {
        updated.phase2_choice = "none";
      } else if (value === "listicle") {
        updated.phase2_choice = "scenario_listicle";
      } else if (value === "guide") {
        updated.phase2_choice = "comparison_guide";
      }
      return updated;
    });
  };

  const handlePhase3Change = (value) => {
    setPhase3Selection(value);
    // Update roadmap JSON when radio button changes
    setCampaignRoadmap(prev => {
      if (!prev) return null;
      const updated = { ...prev };
      // Map radio button value to phase3_choice
      if (value === "skip") {
        updated.phase3_choice = "none";
      } else if (value === "pillar") {
        updated.phase3_choice = "outcome_pillar";
      }
      return updated;
    });
  };

  const calculateProgress = () => {
    // Only fields 1-4 are required: ICP, Offer, Name, Outcome
    // peace_of_mind and roadmap are optional
    const requiredFields = ['icp_id', 'offer_id', 'name', 'outcome'];
    const completed = requiredFields.filter(field => {
      const value = formData[field];
      if (!value) return false;
      const stringValue = typeof value === 'string' ? value : String(value);
      return stringValue.trim().length > 0;
    }).length;
    return Math.round((completed / requiredFields.length) * 100);
  };

  const canSubmit = () => {
    return formData.icp_id && formData.offer_id && formData.name;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!canSubmit()) {
      alert("Please complete required fields: ICP, Offer, and Campaign Name");
      return;
    }
  
    try {
      setIsSaving(true);
      
      // Build roadmap from current state if it exists
      // If roadmap was generated by AI, use it; otherwise build from radio button selections
      let finalRoadmap = campaignRoadmap;
      if (!finalRoadmap && (phase2Selection !== "skip" || phase3Selection !== "skip")) {
        // Build roadmap from manual selections
        finalRoadmap = {
          explanation: "Manually configured roadmap",
          phase2_choice: phase2Selection === "skip" ? "none" : (phase2Selection === "listicle" ? "scenario_listicle" : "comparison_guide"),
          phase3_choice: phase3Selection === "skip" ? "none" : "outcome_pillar"
        };
      }
      
      // Include roadmap in form data if it exists
      const dataToSave = {
        ...formData,
        ...(finalRoadmap && { campaign_roadmap: finalRoadmap })
      };
      
      if (isEditMode && campaignId) {
        // Update existing campaign
        await campaignsInstance.update(campaignId, dataToSave);
        const updatedCampaign = await campaignsInstance.getWithDetails(campaignId);
        // Update local campaign state
        setCampaign(updatedCampaign);
        // Don't show congratulations for existing campaigns
        onSaved(updatedCampaign);
      } else {
        // Create new campaign
        const newCampaign = await campaignsInstance.create(dataToSave);
        const fullCampaign = await campaignsInstance.getWithDetails(newCampaign.id);
        // Update local campaign state
        setCampaign(fullCampaign);
        // Store campaign ID for redirect when user clicks Phase 1 button
        setNewlyCreatedCampaignId(newCampaign.id);
        // Show congratulations modal only for new campaigns
        setShowCongrats(true);
        onSaved(fullCampaign);
      }
    } catch (error) {
      alert("Failed to save campaign. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveDraft = async () => {
    try {
      setIsSaving(true);
      const draftData = { ...formData, status: "planning" };
      
      if (isEditMode && campaignId) {
        await campaignsInstance.update(campaignId, draftData);
        alert("Draft saved!");
      } else {
        const newCampaign = await campaignsInstance.create(draftData);
        // Store campaign ID for future redirect
        setNewlyCreatedCampaignId(newCampaign.id);
        alert("Draft saved!");
      }
    } catch (error) {
      alert("Failed to save draft. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const progress = calculateProgress();
  const isComplete = progress === 100;

  // Get article titles for each phase (metadata only)
  const getPhaseArticle = (phase) => {
    if (!campaign?.articleMetadata) return null;
    return campaign.articleMetadata.find(a => a.campaign_phase === phase);
  };

  const phase1Article = getPhaseArticle(1);
  const phase2Article = getPhaseArticle(2);
  const phase3Article = getPhaseArticle(3);

  // Handle dissociating an article from a phase
  const handleDissociateArticle = async (articleId) => {
    try {
      const monkey = await initMonkey();
      const text = await monkey.apiCall("/api/campaigns/dissociate-article", { articleId });
      const data = JSON.parse(text);
      if (data.error) throw new Error(data.error || "Failed to dissociate article");

      // Reload campaign to refresh articleMetadata
      if (campaignId && campaignsInstance) {
        const freshCampaign = await campaignsInstance.getWithDetails(campaignId);
        if (freshCampaign) {
          setCampaign(freshCampaign);
        }
      }
    } catch (error) {
      alert("Failed to dissociate article. Please try again.");
    }
  };

  // Determine which phases are enabled (not skipped/disabled)
  const isPhase2Enabled = campaignRoadmap?.phase2_choice !== 'none' && phase2Selection !== "skip";
  const isPhase3Enabled = campaignRoadmap?.phase3_choice !== 'none' && phase3Selection !== "skip";
  // Phase 1 is always enabled

  // Check if all enabled phases have articles
  const allEnabledPhasesComplete = !!phase1Article && 
    (!isPhase2Enabled || !!phase2Article) && 
    (!isPhase3Enabled || !!phase3Article);

  // Determine which node is "next" to create
  const determineNextNode = () => {
    // 1. If settings not complete -> Settings is next (but we don't show indicator on settings)
    if (!isComplete) return null;
    
    // 2. If phase1 not created -> Phase 1 is next
    if (!phase1Article) return 'phase1';
    
    // 3. If phase2 enabled and not created -> Phase 2 is next
    if (isPhase2Enabled && !phase2Article) return 'phase2';
    
    // 4. If phase3 enabled and not created -> Phase 3 is next
    if (isPhase3Enabled && !phase3Article) return 'phase3';
    
    // 5. If all phases complete -> Expand is next
    if (allEnabledPhasesComplete) return 'expand';
    
    return null;
  };

  const nextNode = determineNextNode();

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto p-8">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="max-w-7xl mx-auto p-8">
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <Link href="/campaigns">
          <Button variant="outline" className="px-3 py-2">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-gray-900">
            {isEditMode ? "✏️ Edit Campaign" : "🎯 Create New Campaign"}
          </h1>
          <p className="text-gray-600 mt-2">Level 1: Foundation Phase</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* LEFT: Campaign Progress Map */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold mb-6 text-center">Campaign Progress Map</h3>
            
            <div className="flex flex-col items-center space-y-6">
              {/* Settings Node (START) */}
              <div className="flex flex-col items-center">
                <div className="mb-2 text-center">
                  <span className="text-xs font-medium text-gray-600">START</span>
                </div>
                <div className="relative">
                  {!isComplete && <PointingFingerIndicator />}
                  <div
                    className={`
                      w-32 h-32 rounded-lg border-4 flex flex-col items-center justify-center
                      transition-all duration-300 relative
                      ${isComplete ? 'border-green-500 bg-green-50 opacity-60' : 'border-orange-500 bg-orange-50 shadow-2xl scale-110 ring-4 ring-orange-200'}
                      cursor-default
                    `}
                  >
                    <div className="text-4xl mb-2">⚙️</div>
                    <div className="text-xs font-bold text-gray-700 text-center">SETTINGS</div>
                    {isComplete && (
                      <div className="absolute -top-2 -right-2 bg-green-500 text-white rounded-full w-8 h-8 flex items-center justify-center text-xs font-bold">
                        ✓
                      </div>
                    )}
                  </div>
                </div>
                <div className="w-px h-8 bg-gray-300"></div>
                {isComplete ? (
                  <Unlock className="w-5 h-5 text-green-500" />
                ) : (
                  <Lock className="w-5 h-5 text-gray-400" />
                )}
              </div>

              {/* Phase 1 */}
              <div className="flex flex-col items-center">
                <div className="w-px h-8 bg-gray-300"></div>
                <PhaseMapNode 
                  phase={1} 
                  isActive={isComplete && !phase1Article}
                  isComplete={!!phase1Article}
                  isLocked={!isEditMode && !isComplete}
                  isNext={nextNode === 'phase1'}
                  onClick={() => onPhaseClick(1)}
                  articleTitle={phase1Article?.title}
                  articleId={phase1Article?.id}
                  onDissociate={handleDissociateArticle}
                />
                <div className="w-px h-8 bg-gray-300"></div>
                {phase1Article ? (
                  <Unlock className="w-5 h-5 text-green-500" />
                ) : (
                  <Lock className="w-5 h-5 text-gray-400" />
                )}
              </div>

              {/* Phase 2 */}
              <div className="flex flex-col items-center">
                <div className="w-px h-8 bg-gray-300"></div>
                <PhaseMapNode 
                  phase={2} 
                  isLocked={!isComplete || !phase1Article}
                  isComplete={!!phase2Article}
                  isDisabled={campaignRoadmap?.phase2_choice === 'none' || phase2Selection === "skip"}
                  isNext={nextNode === 'phase2'}
                  onClick={() => onPhaseClick(2)}
                  articleTitle={phase2Article?.title}
                  articleId={phase2Article?.id}
                  onDissociate={handleDissociateArticle}
                />
                <div className="w-px h-8 bg-gray-300"></div>
                {phase2Article ? (
                  <Unlock className="w-5 h-5 text-green-500" />
                ) : campaignRoadmap?.phase2_choice === 'none' || phase2Selection === "skip" ? (
                  <span className="text-xs text-gray-400">Disabled</span>
                ) : (
                  <Lock className="w-5 h-5 text-gray-400" />
                )}
              </div>

              {/* Phase 3 */}
              <div className="flex flex-col items-center">
                <div className="w-px h-8 bg-gray-300"></div>
                <PhaseMapNode 
                  phase={3} 
                  isLocked={!isComplete || !phase1Article || !phase2Article}
                  isComplete={!!phase3Article}
                  isDisabled={campaignRoadmap?.phase3_choice === 'none' || phase3Selection === "skip"}
                  isNext={nextNode === 'phase3'}
                  onClick={() => onPhaseClick(3)}
                  articleTitle={phase3Article?.title}
                  articleId={phase3Article?.id}
                  onDissociate={handleDissociateArticle}
                />
                <div className="w-px h-8 bg-gray-300"></div>
                {phase3Article ? (
                  <Unlock className="w-5 h-5 text-green-500" />
                ) : campaignRoadmap?.phase3_choice === 'none' || phase3Selection === "skip" ? (
                  <span className="text-xs text-gray-400">Disabled</span>
                ) : (
                  <Lock className="w-5 h-5 text-gray-400" />
                )}
              </div>

              {/* EXPAND (Satellite Articles) */}
              <div className="flex flex-col items-center">
                <div className="w-px h-8 bg-gray-300"></div>
                <ExpandMapNode 
                  isLocked={!isComplete || !allEnabledPhasesComplete}
                  isComplete={false} // Will be true when satellite articles exist
                  isNext={nextNode === 'expand'}
                  onClick={() => setShowExpandPanel(true)}
                  satelliteCount={0} // TODO: Load actual count
                />
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: Settings Form */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">📜 Campaign Context</h3>
              {isEditMode && isSettingsCollapsed && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsSettingsCollapsed(false)}
                  className="text-sm"
                >
                  Edit Campaign Context
                </Button>
              )}
            </div>

            {isSettingsCollapsed ? (
              /* Collapsed View - Show Summary */
              <div className="space-y-4">
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <div>
                    <span className="text-sm font-medium text-gray-600">Campaign Name:</span>
                    <p className="text-gray-900">{campaign?.name || 'Not set'}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-600">Offer:</span>
                    <p className="text-gray-900">{campaign?.offer?.name || 'Not set'}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-600">Target Audience:</span>
                    <p className="text-gray-900">{campaign?.icp?.name || 'Not set'}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-600">Main Keyword:</span>
                    <p className="text-gray-900">{campaign?.outcome || 'Not set'}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-600">Promise:</span>
                    <p className="text-gray-900">{campaign?.peace_of_mind || 'Not set'}</p>
                  </div>
                </div>
              </div>
            ) : (
              /* Expanded View - Show Full Form */
              <form onSubmit={handleSubmit}>

                              {/* Step 1: Choose Offer */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">1️⃣</span>
                  <h4 className="font-semibold text-gray-900">Select Your Offer</h4>
                  {formData.offer_id && <Check className="w-5 h-5 text-green-500" />}
                </div>
                <p className="text-sm text-gray-600 mb-3">What are you selling?</p>
                <Select
                  value={formData.offer_id}
                  onChange={(e) => handleChange('offer_id', e.target.value)}
                  onFocus={loadOffers}
                  disabled={isLoadingOffers}
                >
                  <option value="">{isLoadingOffers ? "Loading offers..." : "Select Offer..."}</option>
                  {offers.map(offer => (
                    <option key={offer.id} value={offer.id}>
                      {offer.name}
                    </option>
                  ))}
                </Select>
                
                {/* Action Buttons */}
                {!showNewOfferForm && !showEditOfferForm && (
                  <div className="flex gap-2 mt-2">
                    <Button
                      type="button"
                      variant="ghost"
                      className="text-sm"
                      onClick={() => {
                        setShowEditOfferForm(false);
                        setShowNewOfferForm(true);
                      }}
                    >
                      + Create New Offer
                    </Button>
                    {formData.offer_id && (
                      <Button
                        type="button"
                        variant="ghost"
                        className="text-sm"
                        onClick={handleEditOffer}
                      >
                        ✏️ Edit Selected Offer
                      </Button>
                    )}
                  </div>
                )}
                                {/* Create New Offer Form */}
                                {showNewOfferForm && (
                  <div className="mt-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
                    <h5 className="font-medium mb-3">Create New Offer</h5>
                    
                    <Input
                      label="Offer Name *"
                      value={newOffer.name}
                      onChange={(e) => setNewOffer(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g., Antibody Conjugation Kits"
                    />
                    
                    <Textarea
                      label="Description (USPs, positioning, elevator pitch) *"
                      value={newOffer.description}
                      onChange={(e) => setNewOffer(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="What makes your offer unique? USPs, positioning, why choose you..."
                    />
                    
                    <div className="mt-4 mb-4">
                      <h6 className="text-sm font-semibold text-gray-700 mb-2">
                        Transactional Details ("Don't Make Them Ask")
                      </h6>
                      <p className="text-xs text-gray-600 mb-3">
                        Include details customers need to know before purchasing: price, size, lead time, availability, storage requirements, warranty, compatible equipment, etc.
                      </p>
                      
                      <Textarea
                        value={newOffer.transactional_facts}
                        onChange={(e) => setNewOffer(prev => ({ 
                          ...prev, 
                          transactional_facts: e.target.value
                        }))}
                        placeholder="e.g., Price: $199/kit, Size: 50 tests/kit, Lead Time: Ships in 2-3 days, Storage: 4°C"
                        rows={4}
                      />
                      
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => handleAIGenerate('transactional_facts')}
                        disabled={isGenerating || !newOffer.name || !newOffer.description}
                        className="w-full mt-2"
                      >
                        {isGenerating && generatingField === 'transactional_facts' ? (
                          <>
                            <Sparkles className="w-4 h-4 animate-spin" />
                            Generating Suggestions...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4" />
                            AI Suggest Transactional Details
                            <CreditCostBadge path="/api/ai" size="sm" />
                          </>
                        )}
                      </Button>
                      
                      {/* AI Suggestions Dropdown for Transactional Facts */}
                      {showAISuggestions === 'transactional_facts' && aiSuggestions.length > 0 && (
                        <div className="mt-3 p-4 border border-blue-200 rounded-lg bg-blue-50">
                          <div className="flex items-center justify-between mb-3">
                            <h5 className="font-semibold text-blue-900 text-sm">AI Suggested Transactional Details</h5>
                            <button
                              onClick={() => {
                                setShowAISuggestions(null);
                                setShowFeedbackInput(prev => ({ ...prev, transactional_facts: false }));
                                setFeedbackText(prev => ({ ...prev, transactional_facts: "" }));
                              }}
                              className="text-blue-600 hover:text-blue-800"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="space-y-2">
                            {aiSuggestions.map((suggestion, index) => (
                              <button
                                key={index}
                                onClick={() => handleSelectSuggestion('transactional_facts', suggestion)}
                                className="w-full text-left p-3 bg-white border border-blue-200 rounded hover:border-blue-400 hover:bg-blue-50 transition-colors"
                              >
                                <pre className="text-xs text-gray-900 whitespace-pre-wrap font-sans">
                                  {suggestion}
                                </pre>
                              </button>
                            ))}
                            
                            {/* Feedback Section - Reusable */}
                            {renderFeedbackSection('transactional_facts')}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex gap-2">
                      <Button type="button" onClick={handleCreateOffer}>Create Offer</Button>
                      <Button type="button" variant="outline" onClick={() => setShowNewOfferForm(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
                
                {/* Edit Offer Form */}
                {showEditOfferForm && (
                  <div className="mt-4 p-4 border border-blue-200 rounded-lg bg-blue-50">
                    <h5 className="font-medium mb-3">Edit Offer</h5>
                    
                    <Input
                      label="Offer Name *"
                      value={newOffer.name}
                      onChange={(e) => setNewOffer(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g., Antibody Conjugation Kits"
                    />
                    
                    <Textarea
                      label="Description (USPs, positioning, elevator pitch) *"
                      value={newOffer.description}
                      onChange={(e) => setNewOffer(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="What makes your offer unique? USPs, positioning, why choose you..."
                    />
                    
                    <div className="mt-4 mb-4">
                      <h6 className="text-sm font-semibold text-gray-700 mb-2">
                        Transactional Details ("Don't Make Them Ask")
                      </h6>
                      <p className="text-xs text-gray-600 mb-3">
                        Include details customers need to know before purchasing: price, size, lead time, availability, storage requirements, warranty, compatible equipment, etc.
                      </p>
                      
                      <Textarea
                        value={newOffer.transactional_facts}
                        onChange={(e) => setNewOffer(prev => ({ 
                          ...prev, 
                          transactional_facts: e.target.value
                        }))}
                        placeholder="e.g., Price: $199/kit, Size: 50 tests/kit, Lead Time: Ships in 2-3 days, Storage: 4°C"
                        rows={4}
                      />
                      
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => handleAIGenerate('transactional_facts')}
                        disabled={isGenerating || !newOffer.name || !newOffer.description}
                        className="w-full mt-2"
                      >
                        {isGenerating && generatingField === 'transactional_facts' ? (
                          <>
                            <Sparkles className="w-4 h-4 animate-spin" />
                            Generating Suggestions...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4" />
                            AI Suggest Comprehensive Details
                            <CreditCostBadge path="/api/ai" size="sm" />
                          </>
                        )}
                      </Button>
                      
                      {/* AI Suggestions Dropdown for Transactional Facts in Edit Form */}
                      {showAISuggestions === 'transactional_facts' && aiSuggestions.length > 0 && (
                        <div className="mt-3 p-4 border border-blue-200 rounded-lg bg-blue-50">
                          <div className="flex items-center justify-between mb-3">
                            <h5 className="font-semibold text-blue-900 text-sm">AI Suggested Transactional Details</h5>
                            <button
                              onClick={() => {
                                setShowAISuggestions(null);
                                setShowFeedbackInput(prev => ({ ...prev, transactional_facts: false }));
                                setFeedbackText(prev => ({ ...prev, transactional_facts: "" }));
                              }}
                              className="text-blue-600 hover:text-blue-800"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="space-y-2">
                            {aiSuggestions.map((suggestion, index) => (
                              <button
                                key={index}
                                onClick={() => handleSelectSuggestion('transactional_facts', suggestion)}
                                className="w-full text-left p-3 bg-white border border-blue-200 rounded hover:border-blue-400 hover:bg-blue-50 transition-colors"
                              >
                                <pre className="text-xs text-gray-900 whitespace-pre-wrap font-sans">
                                  {suggestion}
                                </pre>
                              </button>
                            ))}
                            
                            {/* Feedback Section - Reusable */}
                            {renderFeedbackSection('transactional_facts')}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex gap-2">
                      <Button type="button" onClick={handleUpdateOffer}>Update Offer</Button>
                      <Button type="button" variant="outline" onClick={() => {
                        setShowEditOfferForm(false);
                        setNewOffer({ 
                          name: "", 
                          description: "",
                          transactional_facts: ""
                        });
                      }}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Step 2: Choose ICP */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">2️⃣</span>
                  <h4 className="font-semibold text-gray-900">Select Your Audience</h4>
                  {formData.icp_id && <Check className="w-5 h-5 text-green-500" />}
                </div>
                <p className="text-sm text-gray-600 mb-3">Who is this campaign for?</p>
                <Select
                  value={formData.icp_id}
                  onChange={(e) => handleChange('icp_id', e.target.value)}
                  onFocus={loadIcps}
                  disabled={isLoadingIcps}
                >
                  <option value="">{isLoadingIcps ? "Loading ICPs..." : "Select ICP..."}</option>
                  {icps.map(icp => (
                    <option key={icp.id} value={icp.id}>
                      {icp.name}
                    </option>
                  ))}
                </Select>
                
                {/* Action Buttons */}
                {!showNewIcpForm && (
                  <div className="flex gap-2 mt-2">
                    <Button
                      type="button"
                      variant="ghost"
                      className="text-sm"
                      onClick={() => setShowNewIcpForm(true)}
                    >
                      + Create New ICP
                    </Button>
                  </div>
                )}
                
                {/* Create New ICP Form */}
                {showNewIcpForm && (
                  <div className="mt-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
                    <h5 className="font-medium mb-3">Create New ICP</h5>
                    
                    {/* Offer Context Reference */}
                    {formData.offer_id && offers.find(o => o.id === formData.offer_id) && (
                      <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded">
                        <p className="text-xs font-semibold text-blue-900 mb-1">Selected Offer Context:</p>
                        <p className="text-sm text-blue-800">
                          <strong>{offers.find(o => o.id === formData.offer_id)?.name}</strong>
                        </p>
                        {offers.find(o => o.id === formData.offer_id)?.description && (
                          <p className="text-xs text-blue-700 mt-1">
                            {offers.find(o => o.id === formData.offer_id)?.description}
                          </p>
                        )}
                      </div>
                    )}
                    
                    <Input
                      label="ICP Name *"
                      value={newIcp.name}
                      onChange={(e) => setNewIcp(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g., Academic Research Scientists"
                    />
                    
                    <Textarea
                      label="Description *"
                      value={newIcp.description}
                      onChange={(e) => setNewIcp(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Who they are, what they want, what challenges they face..."
                      rows={4}
                    />
                    
                    {/* AI Suggest Button */}
                    <div className="mb-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => handleAIGenerate('icp')}
                        disabled={isGenerating || !formData.offer_id}
                        className="w-full"
                      >
                        {isGenerating && generatingField === 'icp' ? (
                          <>
                            <Sparkles className="w-4 h-4 animate-spin" />
                            Generating ICP Suggestions...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4" />
                            AI Suggest ICP Based on Offer
                            <CreditCostBadge path="/api/ai" size="sm" className="ml-1" />
                          </>
                        )}
                      </Button>
                    </div>
                    
                    {/* AI Suggestions Dropdown for ICP */}
                    {showAISuggestions === 'icp' && aiSuggestions.length > 0 && (
                      <div className="mb-4 p-4 border border-blue-200 rounded-lg bg-blue-50">
                        <div className="flex items-center justify-between mb-3">
                          <h5 className="font-semibold text-blue-900 text-sm">AI Suggested ICPs</h5>
                          <button
                            onClick={() => {
                              setShowAISuggestions(null);
                              setShowFeedbackInput(prev => ({ ...prev, icp: false }));
                              setFeedbackText(prev => ({ ...prev, icp: "" }));
                            }}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="space-y-2">
                          {aiSuggestions.map((suggestion, index) => (
                            <button
                              key={index}
                              onClick={() => handleSelectSuggestion('icp', suggestion)}
                              className="w-full text-left p-3 bg-white border border-blue-200 rounded hover:border-blue-400 hover:bg-blue-50 transition-colors"
                            >
                              <div className="font-semibold text-gray-900 mb-1">
                                {suggestion.name}
                              </div>
                              <div className="text-sm text-gray-600">
                                {suggestion.description}
                              </div>
                            </button>
                          ))}
                          
                          {/* Feedback Section - Reusable */}
                          {renderFeedbackSection('icp')}
                        </div>
                      </div>
                    )}
                    
                    <div className="flex gap-2">
                      <Button type="button" onClick={handleCreateIcp}>Create ICP</Button>
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => {
                          setShowNewIcpForm(false);
                          setNewIcp({ name: "", description: "" });
                          setShowAISuggestions(null);
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Step 3: Campaign Name */}
                <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                    <span className="text-2xl">3️⃣</span>
                    <h4 className="font-semibold text-gray-900">Name Your Campaign</h4>
                    {formData.name && <Check className="w-5 h-5 text-green-500" />}
                </div>
                
                <Input
                    placeholder="e.g., Academic PI Labs - Conjugation Kits"
                    value={formData.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                />
                
                {/* AI Suggest Button - Separate Row */}
                <Button
                type="button"
                variant="outline"
                onClick={() => {
                    handleAIGenerate('name');
                }}
                disabled={isGenerating || !formData.icp_id || !formData.offer_id}
                className="w-full"
                >
                {isGenerating && generatingField === 'name' ? (
                    <>
                    <Sparkles className="w-4 h-4 animate-spin" />
                    Generating...
                    </>
                ) : (
                    <>
                    <Sparkles className="w-4 h-4" />
                    AI Suggest
                    <CreditCostBadge path="/api/ai" size="sm" />
                    </>
                )}
                </Button>
                
                {/* AI Suggestions Dropdown */}
                {showAISuggestions === 'name' && aiSuggestions.length > 0 && (
                  <div className="mb-4 p-4 border border-blue-200 rounded-lg bg-blue-50">
                    <div className="flex items-center justify-between mb-3">
                      <h5 className="font-semibold text-blue-900 text-sm">AI Suggested Names</h5>
                      <button
                        onClick={() => {
                            setShowAISuggestions(null);
                            setShowFeedbackInput(prev => ({ ...prev, name: false }));
                            setFeedbackText(prev => ({ ...prev, name: "" }));
                        }}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="space-y-2">
                        {aiSuggestions.map((suggestion, index) => (
                        <button
                            key={index}
                            onClick={() => handleSelectSuggestion('name', suggestion)}
                            className="w-full text-left p-3 bg-white border border-blue-200 rounded hover:border-blue-400 hover:bg-blue-50 transition-colors text-sm"
                        >
                            {suggestion}
                        </button>
                        ))}
                        
                        {/* Feedback Section - Reusable */}
                        {renderFeedbackSection('name')}
                    </div>
                  </div>
                )}
</div>

                            {/* Step 4: Outcome */}
                            <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">4️⃣</span>
                  <h4 className="font-semibold text-gray-900">Decide the Main Keyword</h4>
                  {formData.outcome && <Check className="w-5 h-5 text-green-500" />}
                </div>
                <p className="text-sm text-gray-600 mb-3">What outcome do customers want? What would the customers call it/search for it?</p>
                <p className="text-xs text-gray-500 mb-3 italic">Don't worry—you can change this later if needed.</p>
                
                <Input
                  placeholder="e.g., Easier multicolor immunofluorescence staining"
                  value={formData.outcome}
                  onChange={(e) => handleChange('outcome', e.target.value)}
                />
                
                {/* AI Suggest Button - Separate Row */}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleAIGenerate('outcome')}
                  disabled={isGenerating || !formData.icp_id || !formData.offer_id}
                  className="w-full"
                >
                  {isGenerating && generatingField === 'outcome' ? (
                    <>
                      <Sparkles className="w-4 h-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      AI Suggest
                      <CreditCostBadge path="/api/ai" size="sm" />
                    </>
                  )}
                </Button>
                
                {/* AI Suggestions Dropdown */}
                {showAISuggestions === 'outcome' && aiSuggestions.length > 0 && (
                  <div className="mt-3 p-4 border border-blue-200 rounded-lg bg-blue-50">
                    <div className="flex items-center justify-between mb-3">
                      <h5 className="font-semibold text-blue-900 text-sm">AI Suggestions</h5>
                      <button
                        onClick={() => {
                          setShowAISuggestions(null);
                          setShowFeedbackInput(prev => ({ ...prev, outcome: false }));
                          setFeedbackText(prev => ({ ...prev, outcome: "" }));
                        }}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="space-y-2">
                      {aiSuggestions.map((suggestion, index) => (
                        <button
                          key={index}
                          onClick={() => handleSelectSuggestion('outcome', suggestion)}
                          className="w-full text-left p-3 bg-white border border-blue-200 rounded hover:border-blue-400 hover:bg-blue-50 transition-colors text-sm"
                        >
                          {suggestion}
                        </button>
                      ))}
                      
                      {/* Feedback Section - Reusable */}
                      {renderFeedbackSection('outcome')}
                    </div>
                  </div>
                )}
              </div>

                            {/* Step 5: Peace of Mind */}
                            <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">5️⃣</span>
                  <h4 className="font-semibold text-gray-900">Set Your Promise</h4>
                  {formData.peace_of_mind && <Check className="w-5 h-5 text-green-500" />}
                </div>
                <p className="text-sm text-gray-600 mb-3">What guarantee or peace of mind do you offer?</p>
                
                <Input
                  placeholder="e.g., 30-day money-back guarantee, Technical support included"
                  value={formData.peace_of_mind}
                  onChange={(e) => handleChange('peace_of_mind', e.target.value)}
                />
                
                {/* AI Suggest Button - Separate Row */}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleAIGenerate('peace_of_mind')}
                  disabled={isGenerating || !formData.icp_id || !formData.offer_id}
                  className="w-full"
                >
                  {isGenerating && generatingField === 'peace_of_mind' ? (
                    <>
                      <Sparkles className="w-4 h-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      AI Suggest
                    </>
                  )}
                </Button>
                
                {/* AI Suggestions Dropdown */}
                {showAISuggestions === 'peace_of_mind' && aiSuggestions.length > 0 && (
                  <div className="mt-3 p-4 border border-blue-200 rounded-lg bg-blue-50">
                    <div className="flex items-center justify-between mb-3">
                      <h5 className="font-semibold text-blue-900 text-sm">AI Suggestions</h5>
                      <button
                        onClick={() => {
                          setShowAISuggestions(null);
                          setShowFeedbackInput(prev => ({ ...prev, peace_of_mind: false }));
                          setFeedbackText(prev => ({ ...prev, peace_of_mind: "" }));
                        }}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="space-y-2">
                      {aiSuggestions.map((suggestion, index) => (
                        <button
                          key={index}
                          onClick={() => handleSelectSuggestion('peace_of_mind', suggestion)}
                          className="w-full text-left p-3 bg-white border border-blue-200 rounded hover:border-blue-400 hover:bg-blue-50 transition-colors text-sm"
                        >
                          {suggestion}
                        </button>
                      ))}
                      
                      {/* Feedback Section - Reusable */}
                      {renderFeedbackSection('peace_of_mind')}
                    </div>
                  </div>
                )}
              </div>

              {/* Step 6: Campaign Roadmap */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">6️⃣</span>
                  <h4 className="font-semibold text-gray-900">Plan Your Campaign Roadmap</h4>
                  {(phase2Selection !== "skip" || phase3Selection !== "skip") && <Check className="w-5 h-5 text-green-500" />}
                </div>
                
                {/* Phase 1 Selection */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phase 1: Help them buy
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-gray-50 rounded opacity-75">
                      <input
                        type="radio"
                        name="phase1"
                        value="include"
                        checked={true}
                        disabled
                        className="w-4 h-4"
                      />
                      <span className="text-sm">Always include</span>
                    </label>
                  </div>
                </div>

                {/* Phase 2 Selection */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phase 2: Help them decide
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-gray-50 rounded">
                      <input
                        type="radio"
                        name="phase2"
                        value="listicle"
                        checked={phase2Selection === "listicle"}
                        onChange={(e) => handlePhase2Change(e.target.value)}
                        className="w-4 h-4"
                      />
                      <span className="text-sm">Use listicle to help user sort through their options</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-gray-50 rounded">
                      <input
                        type="radio"
                        name="phase2"
                        value="guide"
                        checked={phase2Selection === "guide"}
                        onChange={(e) => handlePhase2Change(e.target.value)}
                        className="w-4 h-4"
                      />
                      <span className="text-sm">Use guide to compare details amongst options</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-gray-50 rounded">
                      <input
                        type="radio"
                        name="phase2"
                        value="skip"
                        checked={phase2Selection === "skip"}
                        onChange={(e) => handlePhase2Change(e.target.value)}
                        className="w-4 h-4"
                      />
                      <span className="text-sm">Skip phase 2</span>
                    </label>
                  </div>
                </div>

                {/* Phase 3 Selection */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phase 3: Help them discover
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-gray-50 rounded">
                      <input
                        type="radio"
                        name="phase3"
                        value="pillar"
                        checked={phase3Selection === "pillar"}
                        onChange={(e) => handlePhase3Change(e.target.value)}
                        className="w-4 h-4"
                      />
                      <span className="text-sm">Write a pillar page "how to achieve [their outcome]"</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-gray-50 rounded">
                      <input
                        type="radio"
                        name="phase3"
                        value="skip"
                        checked={phase3Selection === "skip"}
                        onChange={(e) => handlePhase3Change(e.target.value)}
                        className="w-4 h-4"
                      />
                      <span className="text-sm">Skip phase 3</span>
                    </label>
                  </div>
                </div>

                {/* AI Suggest Button - Separate Row */}
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleGenerateRoadmap}
                  disabled={(isGenerating && generatingField === 'roadmap') || !formData.icp_id || !formData.offer_id || !formData.name}
                  className="w-full"
                >
                  {(isGenerating && generatingField === 'roadmap') ? (
                    <>
                      <Sparkles className="w-4 h-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      AI Suggest
                    </>
                  )}
                </Button>
                
                {/* AI Suggestions Dropdown */}
                {showAISuggestions === 'roadmap' && aiSuggestions.length > 0 && (
                  <div className="mt-3 p-4 border border-blue-200 rounded-lg bg-blue-50">
                    <div className="flex items-center justify-between mb-3">
                      <h5 className="font-semibold text-blue-900 text-sm">AI Roadmap Recommendation</h5>
                      <button
                        onClick={() => {
                          setShowAISuggestions(null);
                          setShowFeedbackInput(prev => ({ ...prev, roadmap: false }));
                          setFeedbackText(prev => ({ ...prev, roadmap: "" }));
                        }}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="space-y-2">
                      {aiSuggestions.map((suggestion, index) => (
                        <div
                          key={index}
                          className="w-full text-left p-3 bg-white border border-blue-200 rounded text-sm whitespace-pre-wrap"
                        >
                          {suggestion}
                        </div>
                      ))}
                      
                      <div className="pt-2 mt-2 border-t border-blue-300">
                        <p className="text-xs text-blue-700 italic">
                          ✓ Radio buttons above have been updated based on this recommendation.
                        </p>
                      </div>
                      
                      {/* Feedback Section - Reusable */}
                      {renderFeedbackSection('roadmap')}
                    </div>
                  </div>
                )}
              </div>

              {/* Progress Bar */}
              <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-700">Settings Progress</span>
                  <span className="text-sm font-bold text-blue-600">{progress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
                {isComplete && (
                  <div className="mt-3 text-sm text-green-700 flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    <span>Settings complete! Click Phase 1 on the map to start.</span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 justify-between">
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSaveDraft}
                    disabled={isSaving || !formData.name}
                  >
                    Save Draft
                  </Button>
                  {isEditMode && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setIsSettingsCollapsed(true)}
                    >
                      Collapse
                    </Button>
                  )}
                </div>
                <Button
                  type="submit"
                  disabled={!canSubmit() || isSaving}
                >
                  {isSaving 
                    ? "Saving..." 
                    : isEditMode 
                      ? "Save Settings" 
                      : "Create New Campaign"
                  }
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </form>
            )}
          </div>
        </div>
      </div>
    </div>

    {/* Congratulations Modal */}
    {showCongrats && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-8 text-center">
          {/* Celebration Icon */}
          <div className="mb-6">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Congratulations!
            </h2>
            <p className="text-lg text-gray-700">
              You've completed the campaign settings!
            </p>
          </div>

          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-left">
            <p className="text-sm text-gray-700 mb-3">
              <strong>Next Steps:</strong>
            </p>
            <ol className="text-sm text-gray-600 space-y-2">
              <li className="flex items-start">
                <span className="font-semibold mr-2">1.</span>
                <span>Review the <strong>Campaign Progress Map</strong></span>
              </li>
              <li className="flex items-start">
                <span className="font-semibold mr-2">2.</span>
                <span>Click on <strong>🏘️ Phase 1</strong> to start creating content</span>
              </li>
            </ol>
          </div>

          {/* Action Button */}
          <Button
            onClick={() => {
              // Redirect to the editing URL
              if (newlyCreatedCampaignId) {
                router.replace(`/campaigns/${newlyCreatedCampaignId}`);
              }
            }}
            className="w-full"
          >
            Continue to Campaign
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>
    )}

    {/* EXPAND Panel */}
    <ExpandPanel
      campaignId={campaignId}
      campaign={campaign}
      isOpen={showExpandPanel}
      onClose={() => setShowExpandPanel(false)}
      onNewArticle={(articleId) => {
        if (onPhaseClick) {
          onPhaseClick('expand', articleId);
        }
      }}
    />
    </>
  );
}
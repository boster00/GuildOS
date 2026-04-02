/**
 * ContentMagicWizard Component
 * 
 * Simplified wizard for creating a new research project/article.
 * Collects: Article Title, Offer, and ICP (with AI-assisted creation).
 * 
 * @component
 */
"use client"
import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader, Sparkles, X, Check } from "lucide-react";
import { createClient } from "@/libs/supabase/client";
import { initOffers } from "@/libs/offers/class";
import { initMonkey } from "@/libs/monkey";
import AI_MODELS from "@/config/ai-models";
import CreditCostBadge from "@/components/CreditCostBadge";

// AI Prompt Templates (similar to CampaignSettings)
const PROMPT_TEMPLATES = {
  icpSuggestion: (offerName, offerDescription) => `Based on this offer: "${offerName}"
Description: ${offerDescription}

What kind of customers might be interested in this product line? 

Return ONLY a JSON array of 3 objects with "name" and "description" fields.
Format: [
  {"name": "ICP Name 1", "description": "details as above instructed"},
  {"name": "ICP Name 2", "description": "details as above instructed"},
  {"name": "ICP Name 3", "description": "details as above instructed"}
]`,
  transactionalFacts: (offerName, offerDescription) => `Given this offer: "${offerName}"
Description: ${offerDescription}
List transactional facts the user must know BEFORE buying.  
Think: price, size, lead time, formats, compatibility, steps, etc.  
Do NOT include marketing benefits or features — only factual logistics.  

Return as a checklist with each point separated by \\n. Do not use ** for bolding. `,
};

const AI_CONFIG = {
  icp: {
    model: AI_MODELS.ADVANCED,
    template: PROMPT_TEMPLATES.icpSuggestion,
  },
  transactional_facts: {
    model: AI_MODELS.STANDARD,
    template: PROMPT_TEMPLATES.transactionalFacts,
  },
};

export default function ContentMagicWizard() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [icps, setIcps] = useState([]);
  const [offers, setOffers] = useState([]);
  const [offersInstance, setOffersInstance] = useState(null);
  const [error, setError] = useState(null);
  const [icpsLoaded, setIcpsLoaded] = useState(false);
  const [offersLoaded, setOffersLoaded] = useState(false);
  const [isLoadingIcps, setIsLoadingIcps] = useState(false);
  const [isLoadingOffers, setIsLoadingOffers] = useState(false);
  
  // Form fields
  const [articleTitle, setArticleTitle] = useState("");
  const [selectedIcp, setSelectedIcp] = useState("");
  const [selectedOffer, setSelectedOffer] = useState("");
  
  // Create new offer/ICP forms
  const [showNewOfferForm, setShowNewOfferForm] = useState(false);
  const [showNewIcpForm, setShowNewIcpForm] = useState(false);
  const [newOffer, setNewOffer] = useState({
    name: "",
    description: "",
    transactional_facts: ""
  });
  const [newIcp, setNewIcp] = useState({
    name: "",
    description: ""
  });
  
  // AI suggestions state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingField, setGeneratingField] = useState(null);
  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [showAISuggestions, setShowAISuggestions] = useState(null);
  const [feedbackText, setFeedbackText] = useState({});
  const [showFeedbackInput, setShowFeedbackInput] = useState({});
  const [previousSuggestions, setPreviousSuggestions] = useState({});

  // Initialize offers instance
  useEffect(() => {
    const initialize = async () => {
      try {
        const offersInst = await initOffers();
        setOffersInstance(offersInst);
      } catch (error) {
      }
    };
    initialize();
  }, []);
  
  // Load ICPs on-demand
  const loadIcps = useCallback(async () => {
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
  }, [icpsLoaded, isLoadingIcps, supabase]);

  // Load Offers on-demand
  const loadOffers = useCallback(async () => {
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
  }, [offersLoaded, isLoadingOffers, offersInstance]);

  // Load offers and ICPs on mount
  useEffect(() => {
    // Load ICPs immediately on mount
    loadIcps();
    
    // Load offers once offersInstance is ready
    if (offersInstance) {
      loadOffers();
    }
  }, [offersInstance, loadIcps, loadOffers]);

  // AI Generation handler
  const handleAIGenerate = async (field) => {
    if (field === 'icp') {
      if (!selectedOffer) {
        alert("Please select an Offer first to generate ICP suggestions");
        return;
      }
    } else if (field === 'transactional_facts') {
      if (!newOffer.name || !newOffer.description) {
        alert("Please enter Offer name and description first");
        return;
      }
    }
    
    try {
      setIsGenerating(true);
      setGeneratingField(field);
      setShowAISuggestions(null);
      
      const selectedOfferData = offers.find(o => o.id === selectedOffer);
      const aiConfig = AI_CONFIG[field];
      
      if (field === "icp") {
        const monkey = await initMonkey();
        const text = await monkey.apiCall("/api/monkey/run-task", {
          taskType: "ICP_SUGGEST",
          model: aiConfig.model === "gpt-4o" ? "high" : "mid",
          campaignContext: {
            offer: {
              name: selectedOfferData.name,
              description: selectedOfferData.description,
            },
          },
          userInput: {
            query: `Suggest ideal customer profiles for offer: "${selectedOfferData.name}"`,
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

        setAiSuggestions(suggestions);
        setPreviousSuggestions(prev => ({ ...prev, [field]: suggestions }));
        setShowAISuggestions(field);
        
      } else if (field === "transactional_facts") {
        const prompt = aiConfig.template(newOffer.name, newOffer.description);
        const monkey = await initMonkey();
        const text = await monkey.apiCall("/api/ai", {
          query: prompt,
          vendor: "ChatGPT",
          model: aiConfig.model,
        });
        const data = JSON.parse(text);
        let responseText = data.response || data.result || "";
        
        // Parse response (should be plain text with line breaks)
        const suggestions = [responseText.trim()];
        setAiSuggestions(suggestions);
        setPreviousSuggestions(prev => ({ ...prev, [field]: suggestions }));
        setShowAISuggestions(field);
      }
    } catch (error) {
      alert(`Failed to generate AI suggestion: ${error.message}`);
    } finally {
      setIsGenerating(false);
      setGeneratingField(null);
    }
  };

  // Handle selecting AI suggestion
  const handleSelectSuggestion = (field, suggestion) => {
    if (field === "icp") {
      setNewIcp({
        name: suggestion.name,
        description: suggestion.description
      });
      setShowNewIcpForm(true);
    } else if (field === "transactional_facts") {
      const instructionLine = "⚠️ Replace the following with actual facts of your offer:\n\n";
      setNewOffer(prev => ({
        ...prev,
        transactional_facts: instructionLine + suggestion
      }));
    }
    
    setShowAISuggestions(null);
    setAiSuggestions([]);
    setShowFeedbackInput(prev => ({ ...prev, [field]: false }));
    setFeedbackText(prev => ({ ...prev, [field]: "" }));
  };

  // Create new offer
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
      if (!offersInstance) {
        alert("Offers module not initialized. Please refresh the page.");
        return;
      }
      
      const offerData = {
        name: newOffer.name,
        description: newOffer.description,
        transactional_facts: newOffer.transactional_facts
      };
      
      const createdOffer = await offersInstance.create(offerData);
      setOffers(prev => [...prev, createdOffer]);
      setSelectedOffer(createdOffer.id);
      setNewOffer({ 
        name: "", 
        description: "",
        transactional_facts: ""
      });
      setShowNewOfferForm(false);
      setShowAISuggestions(null);
    } catch (error) {
      alert("Failed to create offer. Please try again.");
    }
  };

  // Create new ICP
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
      setSelectedIcp(createdIcp.id);
      setNewIcp({ name: "", description: "" });
      setShowNewIcpForm(false);
      setShowAISuggestions(null);
    } catch (error) {
      alert("Failed to create ICP. Please try again.");
    }
  };

  // Determine if form is ready - only title is required
  const isReady = articleTitle.trim();

  const handleCreate = async () => {
    if (!isReady) return;

    setLoading(true);
    setError(null);

    try {
      const monkey = await initMonkey();
      const text = await monkey.apiCall("/api/content-magic/create", {
        startMode: "new",
        pageType: "other",
        mainTopic: articleTitle.trim(),
        icpId: selectedIcp || null,
        offerId: selectedOffer || null,
      });
      const data = JSON.parse(text);
      const articleId = data.articleId;
      if (!articleId) throw new Error(data.error || "Failed to create article");
      router.push(`/content-magic/${articleId}`);
    } catch (err) {
      setError(err.message || "Failed to create article");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Create New Article</h1>
          <p className="text-slate-600">Enter the basic information to get started</p>
          <p className="text-xs text-slate-500 mt-2">Offer and ICP help tailor research to your audience and product.</p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-900">{error}</p>
            </div>
          </div>
        )}

        {/* Form */}
        <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
          {/* Article Title */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Article Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g., Complete Guide to Workflow Automation"
              value={articleTitle}
              onChange={(e) => setArticleTitle(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
            />
          </div>

          {/* Offer Selection - Reordered to be before ICP */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Offer <span className="text-slate-400 text-xs">(Optional)</span>
            </label>
            <select
              value={selectedOffer}
              onChange={(e) => setSelectedOffer(e.target.value)}
              onFocus={loadOffers}
              disabled={isLoadingOffers}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">{isLoadingOffers ? "Loading offers..." : "Select Offer..."}</option>
              {offers.map((offer) => (
                <option key={offer.id} value={offer.id}>
                  {offer.name}
                </option>
              ))}
            </select>
            
            {/* Action Buttons */}
            {!showNewOfferForm && (
              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowNewOfferForm(true);
                    setShowNewIcpForm(false);
                  }}
                  className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  <span>+</span> Create New Offer
                </button>
              </div>
            )}
            
            {/* Create New Offer Form */}
            {showNewOfferForm && (
              <div className="mt-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
                <h5 className="font-medium mb-3">Create New Offer</h5>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Offer Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={newOffer.name}
                      onChange={(e) => setNewOffer(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g., Antibody Conjugation Kits"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={newOffer.description}
                      onChange={(e) => setNewOffer(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="What makes your offer unique? USPs, positioning, why choose you..."
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Transactional Details (Optional)
                    </label>
                    <p className="text-xs text-gray-600 mb-2">
                      Details customers need: price, size, lead time, etc.
                    </p>
                    <textarea
                      value={newOffer.transactional_facts}
                      onChange={(e) => setNewOffer(prev => ({ ...prev, transactional_facts: e.target.value }))}
                      placeholder="e.g., Price: $199/kit, Size: 50 tests/kit, Lead Time: Ships in 2-3 days"
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                    <button
                      type="button"
                      onClick={() => handleAIGenerate('transactional_facts')}
                      disabled={isGenerating || !newOffer.name || !newOffer.description}
                      className="mt-2 w-full px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isGenerating && generatingField === 'transactional_facts' ? (
                        <>
                          <Loader className="w-4 h-4 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          AI Suggest Transactional Details
                          <CreditCostBadge path="/api/ai" size="sm" />
                        </>
                      )}
                    </button>
                    
                    {/* AI Suggestions for Transactional Facts */}
                    {showAISuggestions === 'transactional_facts' && aiSuggestions.length > 0 && (
                      <div className="mt-3 p-4 border border-blue-200 rounded-lg bg-blue-50">
                        <div className="flex items-center justify-between mb-3">
                          <h5 className="font-semibold text-blue-900 text-sm">AI Suggested Details</h5>
                          <button
                            onClick={() => {
                              setShowAISuggestions(null);
                              setAiSuggestions([]);
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
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex gap-2 mt-4">
                  <button
                    type="button"
                    onClick={handleCreateOffer}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Create Offer
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowNewOfferForm(false);
                      setNewOffer({ name: "", description: "", transactional_facts: "" });
                      setShowAISuggestions(null);
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ICP Selection - After Offer */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              ICP (Ideal Customer Profile) <span className="text-slate-400 text-xs">(Optional)</span>
            </label>
            <select
              value={selectedIcp}
              onChange={(e) => setSelectedIcp(e.target.value)}
              onFocus={loadIcps}
              disabled={isLoadingIcps}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">{isLoadingIcps ? "Loading ICPs..." : "Select ICP..."}</option>
              {icps.map((icp) => (
                <option key={icp.id} value={icp.id}>
                  {icp.name}
                </option>
              ))}
            </select>
            
            {/* Action Buttons */}
            {!showNewIcpForm && (
              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowNewIcpForm(true);
                    setShowNewOfferForm(false);
                  }}
                  className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  <span>+</span> Create New ICP
                </button>
              </div>
            )}
            
            {/* Create New ICP Form */}
            {showNewIcpForm && (
              <div className="mt-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
                <h5 className="font-medium mb-3">Create New ICP</h5>
                
                {/* Offer Context Reference */}
                {selectedOffer && offers.find(o => o.id === selectedOffer) && (
                  <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded">
                    <p className="text-xs font-semibold text-blue-900 mb-1">Selected Offer Context:</p>
                    <p className="text-sm text-blue-800">
                      <strong>{offers.find(o => o.id === selectedOffer)?.name}</strong>
                    </p>
                    {offers.find(o => o.id === selectedOffer)?.description && (
                      <p className="text-xs text-blue-700 mt-1">
                        {offers.find(o => o.id === selectedOffer)?.description}
                      </p>
                    )}
                  </div>
                )}
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      ICP Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={newIcp.name}
                      onChange={(e) => setNewIcp(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g., Academic Research Scientists"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={newIcp.description}
                      onChange={(e) => setNewIcp(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Who they are, what they want, what challenges they face..."
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                  
                  {/* AI Suggest Button */}
                  <button
                    type="button"
                    onClick={() => handleAIGenerate('icp')}
                    disabled={isGenerating || !selectedOffer}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isGenerating && generatingField === 'icp' ? (
                      <>
                        <Loader className="w-4 h-4 animate-spin" />
                        Generating ICP Suggestions...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        AI Suggest ICP Based on Offer
                        <CreditCostBadge path="/api/ai" size="sm" className="ml-1" />
                      </>
                    )}
                  </button>
                  
                  {/* AI Suggestions for ICP */}
                  {showAISuggestions === 'icp' && aiSuggestions.length > 0 && (
                    <div className="p-4 border border-blue-200 rounded-lg bg-blue-50">
                      <div className="flex items-center justify-between mb-3">
                        <h5 className="font-semibold text-blue-900 text-sm">AI Suggested ICPs</h5>
                        <button
                          onClick={() => {
                            setShowAISuggestions(null);
                            setAiSuggestions([]);
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
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="flex gap-2 mt-4">
                  <button
                    type="button"
                    onClick={handleCreateIcp}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Create ICP
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowNewIcpForm(false);
                      setNewIcp({ name: "", description: "" });
                      setShowAISuggestions(null);
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Create Button */}
          <div className="pt-4">
            <button
              onClick={handleCreate}
              disabled={!isReady || loading}
              className={`w-full py-3 px-4 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all ${
                isReady && !loading
                  ? "bg-blue-600 text-white hover:bg-blue-700 cursor-pointer"
                  : "bg-gray-300 text-gray-600 cursor-not-allowed"
              }`}
            >
              {loading ? (
                <>
                  <Loader className="w-5 h-5 animate-spin" />
                  Creating Article...
                </>
              ) : (
                "Create Article"
              )}
            </button>
            <p className="text-xs text-slate-500 mt-2 text-center">
              After creating, you'll be taken to the article editor where you can add content and start research.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";
import React, { useState, useEffect } from "react";
import { ChevronDown, ChevronUp, Check } from "lucide-react";
import { createClient } from "@/libs/supabase/client";
import { fetchCampaignContext } from "@/libs/content-magic/utils/campaignContextCache";
import { initOffers } from "@/libs/offers/class";
import { initMonkey } from "@/libs/monkey";

export default function ContentMagicContextCard({ article, onSave }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [userIcps, setUserIcps] = useState([]);
  const [loadingIcps, setLoadingIcps] = useState(false);
  const [userOffers, setUserOffers] = useState([]);
  const [loadingOffers, setLoadingOffers] = useState(false);
  const [offersInstance, setOffersInstance] = useState(null);
  const [campaignContext, setCampaignContext] = useState(null);
  const [loadingCampaign, setLoadingCampaign] = useState(false);
  const [icpName, setIcpName] = useState("");
  const [saving, setSaving] = useState(false);
  const [editData, setEditData] = useState({
    icp_id: article?.context?.icpId || "",
    icp_name: "",
    offerId: article?.context?.offerId || article?.offer_id || "",
  });

  // Fetch campaign context and user ICPs on component mount
  useEffect(() => {
    // Check if campaign context already exists in article assets
    const existingCampaignContext = article?.assets?.campaignContext;
    if (existingCampaignContext && existingCampaignContext.campaignId) {
      // Use cached context - no API call needed
      setCampaignContext(existingCampaignContext);
      setLoadingCampaign(false);
    } else if (article?.campaign_id) {
      // Only fetch if campaign_id exists and context not in assets
      loadCampaignContext();
    } else {
      setCampaignContext(null);
      setLoadingCampaign(false);
    }
    fetchUserIcps();
    initializeOffers();
  }, [article?.campaign_id, article?.assets?.campaignContext?.campaignId]); // Use campaignId for stable dependency

  // Initialize offers instance
  const initializeOffers = async () => {
    try {
      const offersInst = await initOffers();
      setOffersInstance(offersInst);
      fetchUserOffers(offersInst);
    } catch (error) {

    }
  };

  const fetchUserOffers = async (instance = offersInstance) => {
    if (!instance) return;
    
    setLoadingOffers(true);
    try {
      const offersData = await instance.list();
      setUserOffers(offersData || []);
      
      // Load offer from context if available
      const offerId = article?.context?.offerId || article?.offer_id || "";
      if (offerId) {
        const selectedOffer = offersData?.find(offer => offer.id === offerId);
        if (selectedOffer) {
          setEditData(prev => ({
            ...prev,
            offerId: offerId,
          }));
        }
      }
    } catch (err) {

    } finally {
      setLoadingOffers(false);
    }
  };

  const loadCampaignContext = async () => {
    if (!article?.campaign_id) {
      return;
    }

    setLoadingCampaign(true);
    try {
      // Use cached fetch with deduplication
      const contextData = await fetchCampaignContext(article.campaign_id, article);
      
      if (contextData) {
        setCampaignContext(contextData);
        
        // Store in article assets for future use
        const updatedAssets = {
          ...(article?.assets || {}),
          campaignContext: contextData,
        };
        
        // Update in-memory state (if onSave is available)
        if (onSave) {
          onSave({
            assets: updatedAssets,
          });
        }
        
        // Persist to database (async, don't wait)
        initMonkey().then(monkey =>
          monkey.articleAssets.savePatch(article.id, { campaignContext: contextData }, article?.assets || {}, (payload) => onSave?.({ assets: payload.assets }))
        ).catch(saveErr => {

        });
      }
    } catch (err) {

    } finally {
      setLoadingCampaign(false);
    }
  };

  const fetchUserIcps = async () => {
    setLoadingIcps(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const { data, error } = await supabase
          .from("icps")
          .select("id, name")
          .eq("user_id", user.id)
          .order("name");
        
        if (!error && data) {
          setUserIcps(data);
          
          // Extract ICP from context
          if (article?.context?.icpId) {
            const selectedIcp = data.find(icp => icp.id === article.context.icpId);
            if (selectedIcp) {
              setIcpName(selectedIcp.name);
              setEditData(prev => ({
                ...prev,
                icp_id: article.context.icpId,
                icp_name: selectedIcp.name,
              }));
            }
          }
        }
      }
    } catch (err) {

    } finally {
      setLoadingIcps(false);
    }
  };

  const handleEditChange = (field, value) => {
    setEditData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleIcpSelect = (icpId, icpName) => {
    setEditData(prev => ({
      ...prev,
      icp_id: icpId,
      icp_name: icpName,
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setIsExpanded(false);
    try {
      const monkey = await initMonkey();
      await monkey.saveArticle({
        articleId: article.id,
        icpId: editData.icp_id || null,
        offerId: editData.offerId || null,
      });
      if (onSave) onSave();
    } catch (err) {

      alert("Failed to save context: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    const originalOfferId = article?.context?.offerId || article?.offer_id || "";
    const originalIcpId = article?.context?.icpId || "";
    const selectedIcp = originalIcpId ? userIcps.find(icp => icp.id === originalIcpId) : null;
    setEditData(prev => ({
      ...prev,
      icp_id: originalIcpId,
      icp_name: selectedIcp?.name || "",
      offerId: originalOfferId,
    }));
    setIsExpanded(false);
  };

  // Determine what to show based on campaign context
  const hasCampaignContext = campaignContext && (campaignContext.icp || campaignContext.offer);
  const displayIcpName = hasCampaignContext 
    ? (campaignContext.icp?.name || "—")
    : (editData?.name || icpName || "—");
  const displayOfferName = hasCampaignContext 
    ? (campaignContext.offer?.name || "—")
    : "—";
  
  // Get offer display name
  const getOfferDisplayName = () => {
    if (hasCampaignContext && campaignContext.offer) {
      return campaignContext.offer.name || "—";
    }
    const offerId = editData.offerId || article?.context?.offerId || article?.offer_id || "";
    if (offerId) {
      const selectedOffer = userOffers.find(offer => offer.id === offerId);
      return selectedOffer?.name || "—";
    }
    return "—";
  };
  const displayOfferNameEdit = getOfferDisplayName();

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm mb-4">
      {/* Collapsed Brief View */}
      {!isExpanded && (
        <div
          className="p-3 cursor-pointer hover:bg-gray-50 transition-colors"
          onClick={() => setIsExpanded(true)}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-gray-500 uppercase mb-1">
                {hasCampaignContext ? "Campaign Context" : "Context"}
              </div>
              
              {/* ICP */}
              <div className="text-sm text-gray-700 truncate mb-1">
                <span className="font-medium">{displayIcpName}</span>
              </div>
              
              {/* Offer */}
              <div className="text-sm text-gray-700 truncate mb-1">
                <span className="font-medium">{hasCampaignContext ? displayOfferName : displayOfferNameEdit}</span>
              </div>
            </div>
            <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0 ml-2" />
          </div>
        </div>
      )}

      {/* Expanded View */}
      {isExpanded && (
        <div className="p-4 max-h-96 overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-gray-500 uppercase">
              {hasCampaignContext ? "Campaign Context" : "Edit Context"}
            </span>
            <button
              onClick={() => setIsExpanded(false)}
              className="p-1 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
              title="Collapse"
            >
              <ChevronUp className="w-4 h-4 text-gray-600" />
            </button>
          </div>

          {/* Campaign Context Display */}
          {hasCampaignContext && (
            <div className="space-y-3 mb-4 pb-4 border-b border-gray-200">
              {loadingCampaign ? (
                <div className="text-sm text-gray-500">Loading campaign context...</div>
              ) : (
                <>
                  {/* ICP Details */}
                  {campaignContext.icp && (
                    <div>
                      <label className="text-xs font-semibold text-gray-600 uppercase block mb-1">
                        ICP
                      </label>
                      <div className="text-sm text-gray-900 font-medium mb-1">
                        {campaignContext.icp.name}
                      </div>
                      {campaignContext.icp.description && (
                        <div className="text-xs text-gray-600">
                          {campaignContext.icp.description}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Offer Details */}
                  {campaignContext.offer && (
                    <div>
                      <label className="text-xs font-semibold text-gray-600 uppercase block mb-1">
                        Offer
                      </label>
                      <div className="text-sm text-gray-900 font-medium mb-1">
                        {campaignContext.offer.name}
                      </div>
                      {campaignContext.offer.description && (
                        <div className="text-xs text-gray-600">
                          {campaignContext.offer.description}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Edit Context Fields (only show if not campaign context) */}
          {!hasCampaignContext && (
            <>
              <div className="space-y-3">
                {/* ICP Dropdown */}
                <div>
                  <label className="text-xs font-semibold text-gray-600 uppercase block mb-1">
                    Target ICP
                  </label>
                  {loadingIcps ? (
                    <div className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 text-gray-500">
                      Loading ICPs...
                    </div>
                  ) : (
                    <select
                      value={editData.icp_id}
                      onChange={e => {
                        const selectedIcp = userIcps.find(icp => icp.id === e.target.value);
                        if (selectedIcp) {
                          handleIcpSelect(selectedIcp.id, selectedIcp.name);
                        } else {
                          handleIcpSelect("", "");
                        }
                      }}
                      className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="">Select an ICP</option>
                      {userIcps.map(icp => (
                        <option key={icp.id} value={icp.id}>
                          {icp.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                
                {/* Offer Dropdown */}
                <div>
                  <label className="text-xs font-semibold text-gray-600 uppercase block mb-1">
                    Offer
                  </label>
                  {loadingOffers ? (
                    <div className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 text-gray-500">
                      Loading offers...
                    </div>
                  ) : (
                    <select
                      value={editData.offerId}
                      onChange={e => handleEditChange('offerId', e.target.value)}
                      className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="">Select an offer</option>
                      {userOffers.map(offer => (
                        <option key={offer.id} value={offer.id}>
                          {offer.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 mt-4">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white text-sm font-medium py-2 rounded hover:bg-blue-700 transition-colors disabled:bg-blue-400"
                >
                  <Check className="w-4 h-4" />
                  {saving ? "Saving..." : "Save"}
                </button>
                <button
                  onClick={handleCancel}
                  className="flex-1 bg-gray-200 text-gray-700 text-sm font-medium py-2 rounded hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
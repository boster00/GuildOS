"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { initCampaigns } from "@/libs/campaigns/class";
import CampaignSettings from "./CampaignSettings";
import CampaignArticleOutline from "./CampaignArticleOutline";
import CampaignSatelliteArticles from "./CampaignSatelliteArticles";

export default function CampaignWizard({ campaignId = null }) {
  const router = useRouter();
  const [campaign, setCampaign] = useState(null);
  const [isLoading, setIsLoading] = useState(!!campaignId);
  const [currentView, setCurrentView] = useState("settings"); // "settings" | "phase1" | "phase2" | "phase3" | "satellite" | "expand"
  const [selectedPhase, setSelectedPhase] = useState(null);
  const [selectedArticleId, setSelectedArticleId] = useState(null);

  // Load existing campaign if editing
  useEffect(() => {
    if (campaignId) {
      loadCampaign();
    }
  }, [campaignId]);

  const loadCampaign = async (idToLoad = campaignId, showLoading = true) => {
    try {
      if (showLoading) {
        setIsLoading(true);
      }
      const campaignsInstance = await initCampaigns();
      const data = await campaignsInstance.getWithDetails(idToLoad);
      if (!data) {
        alert("Campaign not found");
        router.push("/campaigns");
        return;
      }
      
      setCampaign(data);
      return data;
    } catch (error) {
      alert("Failed to load campaign");
      router.push("/campaigns");
    } finally {
      if (showLoading) {
        setIsLoading(false);
      }
    }
  };

  const handleSettingsSaved = async (savedCampaign) => {
    // Reload campaign to get full details including ICP and Offer
    // Pass false to avoid showing loading spinner (prevents "reload" feeling)
    if (savedCampaign?.id) {
      await loadCampaign(savedCampaign.id, false);
    } else {
      setCampaign(savedCampaign);
    }
    setCurrentView("settings"); // Stay on settings but show unlocked phases
  };

  const handlePhaseClick = (phase, articleId = null) => {
    if (!campaign) return;
    if (phase === 'satellite') {
      setCurrentView('satellite');
      setSelectedPhase(null);
    } else if (phase === 'expand') {
      setSelectedPhase('Expand');
      setSelectedArticleId(articleId);
      setCurrentView('expand');
    } else {
      setSelectedPhase(phase);
      setCurrentView(`phase${phase}`);
    }
  };

  const handleBackToSettings = () => {
    setCurrentView("settings");
    setSelectedPhase(null);
    setSelectedArticleId(null);
  };

  const handleArticleSaved = async () => {
    // No need to reload campaign - article content is managed within CampaignArticleOutline
    // Just navigate back to settings
    handleBackToSettings();
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto p-8">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading campaign...</p>
          </div>
        </div>
      </div>
    );
  }

  // Show settings or article outline based on current view
  if (currentView === "settings") {
    return (
      <CampaignSettings
        campaignId={campaignId}
        campaign={campaign}
        onSaved={handleSettingsSaved}
        onPhaseClick={handlePhaseClick}
      />
    );
  }

  // Show satellite articles view
  if (currentView === "satellite") {
    return (
      <CampaignSatelliteArticles
        campaign={campaign}
        onBack={handleBackToSettings}
      />
    );
  }

  // Show article outline for selected phase (including Expand)
  // Use key to force remount when phase or campaign changes
  return (
    <CampaignArticleOutline
      key={`${campaign?.id}-phase-${selectedPhase}-${selectedArticleId || 'new'}`}
      campaign={campaign}
      phase={selectedPhase}
      articleId={selectedArticleId}
      onBack={handleBackToSettings}
      onSaved={handleArticleSaved}
    />
  );
}
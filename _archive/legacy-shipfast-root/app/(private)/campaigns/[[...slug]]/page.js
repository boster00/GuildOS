"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import CampaignsList from "../components/CampaignsList";
import CampaignWizard from "../components/CampaignWizard";
import { ContentIdeasLabProvider } from "../context/ContentIdeasLabContext";

export default function CampaignsDynamicPage() {
  const router = useRouter();
  
  // MVP: Campaigns module disabled - redirect to content-magic
  useEffect(() => {
    router.push('/content-magic');
  }, [router]);
  
  /* MVP - Disabled - Original code preserved below
  const params = useParams();
  const slug = params.slug || [];

  // Handle different URL patterns
  if (slug.length === 0) {
    // URL: /campaigns - Main listing
    return (
      <ContentIdeasLabProvider>
        <CampaignsList />
      </ContentIdeasLabProvider>
    );
  }

  if (slug.length === 1) {
    const [firstParam] = slug;
    
    if (firstParam === "new") {
      // URL: /campaigns/new - Create new campaign
      return (
        <ContentIdeasLabProvider>
          <CampaignWizard />
        </ContentIdeasLabProvider>
      );
    } else {
      // URL: /campaigns/[campaign_id] - Edit existing campaign
      const campaignId = firstParam;
      return (
        <ContentIdeasLabProvider>
          <CampaignWizard campaignId={campaignId} />
        </ContentIdeasLabProvider>
      );
    }
  }

  // 404 for unknown routes
  return (
    <ContentIdeasLabProvider>
      <div className="max-w-2xl mx-auto p-8 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Page Not Found</h1>
        <p className="text-gray-600">The requested campaign page could not be found.</p>
      </div>
    </ContentIdeasLabProvider>
  );
  */
  
  return (
    <div className="max-w-2xl mx-auto p-8 text-center">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Redirecting...</h1>
      <p className="text-gray-600">Campaigns module is not available in MVP.</p>
    </div>
  );
}
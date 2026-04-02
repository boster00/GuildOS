/**
 * Tool to fetch Campaign with ICP and Offer details in a single request
 * Works both server-side and client-side
 */

import { createClient as createClientClient } from "@/libs/supabase/client";
import { log } from "../ui/logger";

export interface CampaignWithDetails {
  id: string;
  name: string;
  icp_id?: string;
  offer_id?: string;
  outcome?: string;
  peace_of_mind?: string;
  roadmap?: any;
  status?: string;
  [key: string]: any;
  icp?: {
    id: string;
    name: string;
    description?: string;
    [key: string]: any;
  } | null;
  offer?: {
    id: string;
    name: string;
    description?: string;
    transactional_facts?: string;
    [key: string]: any;
  } | null;
}

/**
 * Fetch a campaign with its associated ICP and Offer in a single optimized request
 * @param campaignId - The campaign ID to fetch
 * @param userId - Optional user ID for authorization (required for client-side)
 * @param isServerSide - Whether this is being called server-side (default: true)
 */
export async function fetchCampaignWithDetails(
  campaignId: string,
  userId?: string,
  isServerSide: boolean = true
): Promise<CampaignWithDetails | null> {
  log(`[fetchCampaignWithDetails] Fetching campaign ${campaignId} with ICP and Offer...`);

  try {
    let supabase;
    // Double-check we're actually server-side to prevent Next.js from analyzing server imports
    if (isServerSide && typeof window === 'undefined') {
      // Dynamic import for server-side only to avoid bundling in client components
      const serverModule = await import("@/libs/supabase/server");
      supabase = await serverModule.createClient();
    } else {
      // Client-side: use client Supabase instance
      supabase = createClientClient();
    }

    // Get user if not provided (for server-side)
    let currentUserId = userId;
    if (!currentUserId && isServerSide && typeof window === 'undefined') {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("Unauthorized: User not authenticated");
      }
      currentUserId = user.id;
    }

    // Fetch campaign
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("*")
      .eq("id", campaignId)
      .eq("user_id", currentUserId || "")
      .single();

    if (campaignError || !campaign) {
      log(`[fetchCampaignWithDetails] Campaign not found or error: ${campaignError?.message}`);
      return null;
    }

    // Fetch ICP and Offer in parallel
    const [icpResult, offerResult] = await Promise.allSettled([
      campaign.icp_id
        ? supabase
            .from("icps")
            .select("*")
            .eq("id", campaign.icp_id)
            .single()
        : Promise.resolve({ data: null, error: null }),
      campaign.offer_id
        ? supabase
            .from("offers")
            .select("*")
            .eq("id", campaign.offer_id)
            .single()
        : Promise.resolve({ data: null, error: null }),
    ]);

    const icp = icpResult.status === "fulfilled" && icpResult.value.data ? icpResult.value.data : null;
    const offer = offerResult.status === "fulfilled" && offerResult.value.data ? offerResult.value.data : null;

    log(`[fetchCampaignWithDetails] Successfully loaded campaign with ${icp ? "ICP" : "no ICP"} and ${offer ? "Offer" : "no Offer"}`);

    return {
      ...campaign,
      icp,
      offer,
    };
  } catch (error: any) {
    log(`[fetchCampaignWithDetails] Error fetching campaign: ${error.message}`);
    throw error;
  }
}

/**
 * Fetch multiple campaigns with their ICP and Offer details
 * @param campaignIds - Array of campaign IDs to fetch
 * @param userId - Optional user ID for authorization (required for client-side)
 * @param isServerSide - Whether this is being called server-side (default: true)
 */
export async function fetchCampaignsWithDetails(
  campaignIds: string[],
  userId?: string,
  isServerSide: boolean = true
): Promise<CampaignWithDetails[]> {
  log(`[fetchCampaignsWithDetails] Fetching ${campaignIds.length} campaigns with ICP and Offer...`);

  try {
    let supabase;
    // Double-check we're actually server-side to prevent Next.js from analyzing server imports
    if (isServerSide && typeof window === 'undefined') {
      // Dynamic import for server-side only to avoid bundling in client components
      const serverModule = await import("@/libs/supabase/server");
      supabase = await serverModule.createClient();
    } else {
      // Client-side: use client Supabase instance
      supabase = createClientClient();
    }

    // Get user if not provided (for server-side)
    let currentUserId = userId;
    if (!currentUserId && isServerSide && typeof window === 'undefined') {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("Unauthorized: User not authenticated");
      }
      currentUserId = user.id;
    }

    // Fetch all campaigns
    const { data: campaigns, error: campaignsError } = await supabase
      .from("campaigns")
      .select("*")
      .in("id", campaignIds)
      .eq("user_id", currentUserId || "");

    if (campaignsError || !campaigns || campaigns.length === 0) {
      log(`[fetchCampaignsWithDetails] No campaigns found or error: ${campaignsError?.message}`);
      return [];
    }

    // Collect unique ICP and Offer IDs
    const icpIds = [...new Set(campaigns.map(c => c.icp_id).filter(Boolean))];
    const offerIds = [...new Set(campaigns.map(c => c.offer_id).filter(Boolean))];

    // Fetch all ICPs and Offers in parallel
    const [icpsResult, offersResult] = await Promise.allSettled([
      icpIds.length > 0
        ? supabase
            .from("icps")
            .select("*")
            .in("id", icpIds)
        : Promise.resolve({ data: [], error: null }),
      offerIds.length > 0
        ? supabase
            .from("offers")
            .select("*")
            .in("id", offerIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    const icps = icpsResult.status === "fulfilled" && icpsResult.value.data ? icpsResult.value.data : [];
    const offers = offersResult.status === "fulfilled" && offersResult.value.data ? offersResult.value.data : [];

    // Create lookup maps
    const icpMap = new Map(icps.map(icp => [icp.id, icp]));
    const offerMap = new Map(offers.map(offer => [offer.id, offer]));

    // Enrich campaigns with ICP and Offer data
    const enrichedCampaigns = campaigns.map(campaign => ({
      ...campaign,
      icp: campaign.icp_id ? icpMap.get(campaign.icp_id) || null : null,
      offer: campaign.offer_id ? offerMap.get(campaign.offer_id) || null : null,
    }));

    log(`[fetchCampaignsWithDetails] Successfully loaded ${enrichedCampaigns.length} campaigns with details`);

    return enrichedCampaigns;
  } catch (error: any) {
    log(`[fetchCampaignsWithDetails] Error fetching campaigns: ${error.message}`);
    throw error;
  }
}

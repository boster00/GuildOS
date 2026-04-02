/**
 * Campaign Context Cache
 * Provides in-memory caching and request deduplication for campaign context fetching
 */

import { initMonkey } from "@/libs/monkey";

// In-memory cache: campaignId -> { context, timestamp }
const cache = new Map();

// Pending requests: campaignId -> Promise
const pendingRequests = new Map();

// Cache TTL: 5 minutes
const CACHE_TTL = 5 * 60 * 1000;

/**
 * Fetch campaign context with caching and deduplication
 * @param {string} campaignId - Campaign ID
 * @param {object} article - Article object (to check for cached context in assets)
 * @returns {Promise<object|null>} Campaign context or null
 */
export async function fetchCampaignContext(campaignId, article = null) {
  if (!campaignId) {
    return null;
  }

  // Check if context exists in article assets first (database cache)
  if (article?.assets?.campaignContext?.campaignId === campaignId) {

    // Update in-memory cache
    cache.set(campaignId, {
      context: article.assets.campaignContext,
      timestamp: Date.now(),
    });
    return article.assets.campaignContext;
  }

  // Check in-memory cache
  const cached = cache.get(campaignId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {

    return cached.context;
  }

  // Check if there's already a pending request for this campaign
  const pending = pendingRequests.get(campaignId);
  if (pending) {

    return pending;
  }

  // Create new request

  const requestPromise = (async () => {
    try {
      const monkey = await initMonkey();
      const result = await monkey.getCampaignWithDetails(campaignId);
      const campaign = result?.campaign;

      if (campaign) {
        const contextData = {
          campaignId: campaign.id,
          campaignName: campaign.name,
          icp: campaign.icp,
          offer: campaign.offer,
          outcome: campaign.outcome,
          peaceOfMind: campaign.peace_of_mind,
        };

        // Store in cache
        cache.set(campaignId, {
          context: contextData,
          timestamp: Date.now(),
        });

        return contextData;
      }

      return null;
    } catch (err) {

      return null;
    } finally {
      // Remove from pending requests
      pendingRequests.delete(campaignId);
    }
  })();

  // Store pending request
  pendingRequests.set(campaignId, requestPromise);

  return requestPromise;
}

/**
 * Clear cache for a specific campaign or all campaigns
 * @param {string|null} campaignId - Campaign ID to clear, or null to clear all
 */
export function clearCampaignCache(campaignId = null) {
  if (campaignId) {
    cache.delete(campaignId);
    pendingRequests.delete(campaignId);

  } else {
    cache.clear();
    pendingRequests.clear();

  }
}

/**
 * Get cache stats for debugging
 */
export function getCacheStats() {
  return {
    cacheSize: cache.size,
    pendingRequests: pendingRequests.size,
    cachedCampaigns: Array.from(cache.keys()),
  };
}

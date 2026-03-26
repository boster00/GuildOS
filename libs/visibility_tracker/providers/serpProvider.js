/**
 * SERP provider for visibility tracker - wraps DataForSEO getSERP.
 * CRITICAL: domain parameter is required for rank extraction.
 */

import { getSERP } from "@/libs/monkey/tools/dataForSeo";

function getLocationCode(location) {
  if (location === "US") {
    const code =
      process.env.NEXT_PUBLIC_DATAFORSEO_DEFAULT_LOCATION ||
      process.env.DATAFORSEO_DEFAULT_LOCATION ||
      "2840";
    return parseInt(code, 10) || 2840;
  }
  return 2840;
}

function getItemsFromResponse(serpResult) {
  if (!serpResult?.tasks?.[0]?.result) return null;
  const result = serpResult.tasks[0].result;
  if (Array.isArray(result) && result.length > 0 && result[0].items) {
    return result[0].items;
  }
  return Array.isArray(result) ? result : null;
}

function extractRank(serpResult, domain) {
  const items = getItemsFromResponse(serpResult);
  if (!items) {
    return null;
  }

  const normalizedDomain = domain
    .toLowerCase()
    .replace(/^(https?:\/\/)?(www\.)?/, "");

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.type === "organic") {
      const itemDomain = (item.domain || "").toLowerCase();
      if (
        itemDomain.includes(normalizedDomain) ||
        normalizedDomain.includes(itemDomain)
      ) {
        const rank = item.rank_absolute ?? i + 1;
        return rank;
      }
    }
  }
  return null;
}

function extractBestUrl(serpResult, domain) {
  const items = getItemsFromResponse(serpResult);
  if (!items) return null;

  const normalizedDomain = domain
    .toLowerCase()
    .replace(/^(https?:\/\/)?(www\.)?/, "");

  for (const item of items) {
    if (item.type === "organic") {
      const itemDomain = (item.domain || "").toLowerCase();
      if (
        itemDomain.includes(normalizedDomain) ||
        normalizedDomain.includes(itemDomain)
      ) {
        return item.url || null;
      }
    }
  }
  return null;
}

function extractSerpFeatures(serpResult) {
  const features = {
    featured_snippet: false,
    local_pack: false,
    people_also_ask: false,
    ai_overview: false,
  };

  const items = getItemsFromResponse(serpResult);
  if (!items) return features;

  for (const item of items) {
    if (item.type === "featured_snippet") features.featured_snippet = true;
    if (item.type === "local_pack") features.local_pack = true;
    if (item.type === "people_also_ask") features.people_also_ask = true;
    if (item.type === "ai_overview") features.ai_overview = true;
  }
  return features;
}

/**
 * Fetch SERP for a keyword and extract rank/best URL for the given domain.
 * @param {Object} opts - { keyword, domain, location?, device?, numResults? }
 * @returns {Promise<{ rank, bestUrl, features, raw }>}
 */
export async function fetchSerp({
  keyword,
  domain,
  location = "US",
  device = "desktop",
  numResults = 100,
}) {
  try {
    const locationCode = getLocationCode(location);

    const result = await getSERP(keyword, {
      locationCode,
      device,
      depth: numResults,
      fullResponse: true,
    });

    const rank = extractRank(result, domain);
    const bestUrl = extractBestUrl(result, domain);
    const features = extractSerpFeatures(result);
    return {
      rank,
      bestUrl,
      features,
      raw: result,
    };
  } catch (error) {
    throw error;
  }
}

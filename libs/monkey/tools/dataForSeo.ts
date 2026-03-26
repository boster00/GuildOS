/**
 * DataForSEO tool wrapper for server-side API calls
 * Gracefully degrades if credentials are not configured
 */

import { log } from "../ui/logger";
import { initMonkey } from "../../monkey";

export interface KeywordCandidate {
  keyword: string;
  volume?: number;
  difficulty?: number;
  intent?: string;
  region?: string; // Region name (e.g., "United States", "United Kingdom")
  depth?: number; // Depth level (0-4) indicating how far from the seed keyword
}

export interface KeywordCandidatesResult {
  candidates: KeywordCandidate[];
  isToolVerified: boolean;
  notes?: string;
  region?: string; // Region name (e.g., "United States", "United Kingdom")
}

export interface SerpCompetitor {
  title: string;
  url: string;
  snippet?: string;
}

export interface SerpCompetitorsResult {
  items: SerpCompetitor[];
  isToolVerified: boolean;
  notes?: string;
}

/**
 * Get DataForSEO credentials from environment
 * @returns {Object} { login, password, auth } or null if not configured
 */
function getDataForSeoAuth() {
  const login = process.env.DATAFORSEO_LOGIN;
  const password = process.env.DATAFORSEO_PASSWORD;

  if (!login || !password) {
    return null;
  }

  const auth = Buffer.from(`${login}:${password}`).toString("base64");
  return { login, password, auth };
}

/**
 * Normalize competition/difficulty metrics to a canonical 0-100 scale
 * Handles competition (0-1), competition_index (0-1), and keyword_difficulty (0-100)
 * @param competition - Competition value (0-1 scale, can be string or number)
 * @param competitionIndex - Competition index value (0-1 scale)
 * @param keywordDifficulty - Keyword difficulty value (0-100 scale, already normalized)
 * @returns Normalized difficulty (0-100) or undefined if no values available
 */
function normalizeDifficulty(
  competition?: string | number | null,
  competitionIndex?: number | null,
  keywordDifficulty?: number | null
): number | undefined {
  // Prefer keyword_difficulty if available (already 0-100 scale)
  if (keywordDifficulty !== null && keywordDifficulty !== undefined) {
    return keywordDifficulty;
  }

  // Try competition (0-1 scale) - can be string or number
  if (competition !== null && competition !== undefined) {
    const compValue = typeof competition === 'string' ? parseFloat(competition) : competition;
    if (!isNaN(compValue) && compValue >= 0 && compValue <= 1) {
      return compValue * 100; // Convert 0-1 to 0-100
    }
  }

  // Fallback to competition_index (0-1 scale)
  if (competitionIndex !== null && competitionIndex !== undefined) {
    if (competitionIndex >= 0 && competitionIndex <= 1) {
      return competitionIndex * 100; // Convert 0-1 to 0-100
    }
  }

  return undefined;
}

/**
 * Get default location code from environment variable
 * Falls back to 2840 (United States) if not set
 */
function getDefaultLocationCode(): number {
  const envCode = process.env.DATAFORSEO_DEFAULT_LOCATION;
  if (envCode) {
    const parsed = parseInt(envCode, 10);
    if (!isNaN(parsed)) {
      return parsed;
    }
  }
  return 2840; // Fallback to United States
}

/**
 * Location code to country name mapping
 * Source: DataForSEO location codes (most commonly used)
 */
export const LOCATION_MAP: Record<number, string> = {
  2840: "United States",
  2826: "United Kingdom",
  2124: "Canada",
  2125: "Australia",
  2126: "New Zealand",
  2127: "Japan",
  2128: "South Korea",
  2129: "China",
  2130: "India",
  2131: "Brazil",
  2132: "Mexico",
  2133: "Argentina",
  2134: "Chile",
  2135: "Colombia",
  2136: "Peru",
  2137: "Venezuela",
  2036: "Czech Republic",
  2039: "Denmark",
  2040: "Finland",
  2041: "France",
  2042: "Germany",
  2043: "Greece",
  2044: "Hungary",
  2045: "Iceland",
  2046: "Ireland",
  2047: "Italy",
  2048: "Latvia",
  2049: "Lithuania",
  2050: "Luxembourg",
  2051: "Malta",
  2052: "Netherlands",
  2053: "Norway",
  2054: "Poland",
  2055: "Portugal",
  2056: "Romania",
  2057: "Slovakia",
  2058: "Slovenia",
  2059: "Spain",
  2060: "Sweden",
  2061: "Switzerland",
  2062: "Austria",
  2063: "Belgium",
  2064: "Bulgaria",
  2065: "Croatia",
  2066: "Cyprus",
  2067: "Estonia",
  2138: "South Africa",
  2139: "Egypt",
  2140: "Nigeria",
  2141: "Kenya",
  2142: "Morocco",
};

/**
 * Map DataForSEO location code to region name
 * Common location codes: 2840 = United States, 2826 = United Kingdom, etc.
 * @param locationCode - DataForSEO location code
 * @returns Region name or undefined if not found
 */
export function getLocationName(locationCode: number): string | undefined {
  return LOCATION_MAP[locationCode];
}

/**
 * Get all available countries as an array of { code, name } objects
 * @returns Array of country objects sorted by name
 */
export function getAllCountries(): Array<{ code: number; name: string }> {
  const countries = Object.entries(LOCATION_MAP)
    .map(([code, name]) => ({ 
      code: parseInt(code, 10), 
      name 
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return countries;
}

/**
 * Get location code from country name
 * @param countryName - Country name
 * @returns Location code or undefined if not found
 */
export function getLocationCodeFromName(countryName: string): number | undefined {
  const entry = Object.entries(LOCATION_MAP).find(
    ([_, name]) => name.toLowerCase() === countryName.toLowerCase()
  );
  return entry ? parseInt(entry[0], 10) : undefined;
}

/**
 * Call DataForSEO related keywords API and return raw response
 * Used by API routes that need to transform the response themselves
 */
export async function callDataForSeoRelatedKeywordsApi(
  keywords: string[],
  locationCode: number | null = getDefaultLocationCode(), // Default from env, null for Worldwide
  languageCode: string = "en",
  depth: number = 0,
  limit: number = 100
): Promise<any> {
  const authInfo = getDataForSeoAuth();
  if (!authInfo) {
    throw new Error("DataForSEO not configured. Set DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD in environment.");
  }

  // Validate depth (0-4)
  const validDepth = Math.max(0, Math.min(4, depth));
  // Validate limit (1-1000)
  const validLimit = Math.max(1, Math.min(1000, limit));

  const response = await fetch(
    "https://api.dataforseo.com/v3/dataforseo_labs/google/related_keywords/live",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${authInfo.auth}`,
      },
      body: JSON.stringify(
        keywords.map((keyword) => {
          const payload: any = {
            keyword: keyword,
            language_code: languageCode,
            depth: validDepth,
            limit: validLimit,
            include_serp_info: false,
            include_clickstream_data: false,
          };
          // Only include location_code if it's not null (for Worldwide, omit it)
          if (locationCode !== null) {
            payload.location_code = locationCode;
          }
          return payload;
        })
      ),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    let errorData;
    try {
      errorData = JSON.parse(errorText);
    } catch (e) {
      errorData = { error: errorText };
    }
    throw new Error(`DataForSEO API error: ${errorData.error?.message || errorData.message || response.statusText}`);
  }

  const data = await response.json();
  return data;
}

/**
 * Fetch keyword candidates using DataForSEO related keywords API
 */
export async function fetchKeywordCandidates(
  seeds: string[],
  locationCode: number | null = getDefaultLocationCode(), // Default from env, null for Worldwide
  languageCode: string = "en",
  depth: number = 0, // 0-4, increases expansion (0 = direct related, higher = more expansion)
  limit: number = 100 // Limit per seed keyword (max 1000)
): Promise<KeywordCandidatesResult> {
  const authInfo = getDataForSeoAuth();
  if (!authInfo) {
    log("[dataForSeo] DataForSEO credentials not configured, returning unverified results");
    return {
      candidates: [],
      isToolVerified: false,
      notes: "DataForSEO not configured. Set DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD in environment.",
    };
  }

  try {
    // Validate depth (0-4)
    const validDepth = Math.max(0, Math.min(4, depth));
    // Validate limit (1-1000)
    const validLimit = Math.max(1, Math.min(1000, limit));

    const response = await fetch(
      "https://api.dataforseo.com/v3/dataforseo_labs/google/related_keywords/live",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${authInfo.auth}`,
        },
        body: JSON.stringify(
          seeds.map((keyword) => {
            const payload: any = {
              keyword: keyword,
              language_code: languageCode,
              depth: validDepth,
              limit: validLimit,
              include_serp_info: false,
              include_clickstream_data: false,
            };
            // Only include location_code if it's not null (for Worldwide, omit it)
            if (locationCode !== null) {
              payload.location_code = locationCode;
            }
            return payload;
          })
        ),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      log(`[dataForSeo] DataForSEO API error: ${errorText}`);
      return {
        candidates: [],
        isToolVerified: false,
        notes: `DataForSEO API error: ${response.statusText}`,
      };
    }

    const data = await response.json();

    // Transform DataForSEO response to our format
    const candidates: KeywordCandidate[] = [];
    
    // Extract region from response if available, otherwise use mapping function
    let region: string | undefined = undefined;
    
    // Check if location_name or location_name_en is available in the response
    if (data.tasks && Array.isArray(data.tasks) && data.tasks.length > 0) {
      const firstTask = data.tasks[0];
      if (firstTask.result && Array.isArray(firstTask.result) && firstTask.result.length > 0) {
        const firstResult = firstTask.result[0];
        // Check for location_name, location_name_en, or location fields
        if (firstResult.location_name) {
          region = firstResult.location_name;
        } else if (firstResult.location_name_en) {
          region = firstResult.location_name_en;
        } else if (firstResult.location?.location_name) {
          region = firstResult.location.location_name;
        } else if (firstResult.location?.location_name_en) {
          region = firstResult.location.location_name_en;
        }
      }
    }
    
    // If region not found in response, use mapping function
    if (!region) {
      if (locationCode === null) {
        region = "Worldwide";
      } else {
        region = getLocationName(locationCode);
      }
    }

    if (data.tasks && Array.isArray(data.tasks)) {
      data.tasks.forEach((task: any) => {
        if (task.result && Array.isArray(task.result) && task.result.length > 0) {
          task.result.forEach((resultItem: any) => {
            // Add seed keyword if available from seed_keyword_data
            // Note: seed_keyword_data might be null, in which case the seed keyword will be in items[] array
            if (resultItem.seed_keyword_data) {
              const seedKeywordData = resultItem.seed_keyword_data;
              const keywordInfo = seedKeywordData.keyword_info || {};
              const keywordProperties = seedKeywordData.keyword_properties || resultItem.seed_keyword_properties || {};
              
              const seedKeywordText = keywordInfo.keyword || resultItem.seed_keyword || "";
              
              if (seedKeywordText) {
                const searchVolume = keywordInfo.search_volume !== null && keywordInfo.search_volume !== undefined 
                  ? keywordInfo.search_volume 
                  : undefined;
                
                // Extract keyword_difficulty (0-100) from keyword_properties, fallback to competition_index (0-1) * 100
                let difficulty: number | undefined = undefined;
                if (keywordProperties.keyword_difficulty !== null && keywordProperties.keyword_difficulty !== undefined) {
                  difficulty = keywordProperties.keyword_difficulty; // Already 0-100 scale
                } else if (keywordInfo.competition_index !== null && keywordInfo.competition_index !== undefined) {
                  difficulty = keywordInfo.competition_index * 100; // Convert 0-1 to 0-100
                }
                
                // Extract depth from seed_keyword_data if available, otherwise default to 0
                const seedDepth = resultItem.depth !== null && resultItem.depth !== undefined ? resultItem.depth : 0;
                
                candidates.push({
                  keyword: seedKeywordText,
                  volume: searchVolume,
                  difficulty: difficulty,
                  intent: keywordInfo.intent || keywordInfo.search_intent_info?.main_intent || undefined,
                  region: region,
                  depth: seedDepth,
                });
              }
            }

            // Add related keywords from items[] array
            // Each item in items[] represents a keyword with full data (search_volume, keyword_difficulty, depth)
            if (resultItem.items && Array.isArray(resultItem.items)) {
              resultItem.items.forEach((item: any) => {
                if (item.keyword_data) {
                  const keywordData = item.keyword_data;
                  const keywordInfo = keywordData.keyword_info || {};
                  const keywordProperties = keywordData.keyword_properties || {};
                  
                  // Get the keyword text
                  const keywordText = keywordInfo.keyword || keywordData.keyword || "";
                  
                  if (keywordText) {
                    // Extract search_volume from keyword_info
                    const searchVolume = keywordInfo.search_volume !== null && keywordInfo.search_volume !== undefined 
                      ? keywordInfo.search_volume 
                      : undefined;
                    
                    // Extract keyword_difficulty (0-100) from keyword_properties, fallback to competition_index (0-1) * 100
                    let difficulty: number | undefined = undefined;
                    if (keywordProperties.keyword_difficulty !== null && keywordProperties.keyword_difficulty !== undefined) {
                      difficulty = keywordProperties.keyword_difficulty; // Already 0-100 scale
                    } else if (keywordInfo.competition_index !== null && keywordInfo.competition_index !== undefined) {
                      difficulty = keywordInfo.competition_index * 100; // Convert 0-1 to 0-100
                    }
                    
                    // Extract depth from item (0-4, indicating how far from the seed keyword)
                    const itemDepth = item.depth !== null && item.depth !== undefined ? item.depth : undefined;
                    
                    candidates.push({
                      keyword: keywordText,
                      volume: searchVolume,
                      difficulty: difficulty,
                      intent: keywordInfo.intent || keywordInfo.search_intent_info?.main_intent || undefined,
                      region: region,
                      depth: itemDepth,
                    });
                  }
                }
              });
            }
          });
        }
      });
    }

    // Remove duplicates based on keyword
    const uniqueCandidates = Array.from(
      new Map(candidates.map((c) => [c.keyword.toLowerCase(), c])).values()
    );

    log(`[dataForSeo] Fetched ${uniqueCandidates.length} unique keyword candidates from DataForSEO`);

    return {
      candidates: uniqueCandidates,
      isToolVerified: true,
      region: region,
    };
  } catch (error: any) {
    log(`[dataForSeo] Error fetching keyword candidates: ${error.message}`);
    return {
      candidates: [],
      isToolVerified: false,
      notes: `Error: ${error.message}`,
    };
  }
}

/**
 * Fetch SERP competitors using Tavily via monkey.webSearch (primary) or DataForSEO (fallback)
 */
export async function fetchSerpCompetitors(
  query: string,
  locationCode: number = getDefaultLocationCode(), // Default from env
  languageCode: string = "en"
): Promise<SerpCompetitorsResult> {
  // Try Tavily first (faster and more reliable)
  try {
    const monkey = await initMonkey();
    
    log(`[dataForSeo] Attempting Tavily search for SERP competitors: "${query}"`);
    const tavilyResults = await monkey.webSearch(query, { maxResults: 20 });
    
    if (tavilyResults && tavilyResults.length > 0) {
      const items: SerpCompetitor[] = tavilyResults.map((result: any) => ({
        title: result.title || result.url || "Untitled",
        url: result.url,
        snippet: result.content || result.snippet || undefined,
      }));
      
      log(`[dataForSeo] ✅ Tavily search successful: found ${items.length} results`);
      return {
        items,
        isToolVerified: true,
        notes: "Fetched via Tavily",
      };
    }
    
    log(`[dataForSeo] Tavily search returned no results, falling back to DataForSEO...`);
  } catch (error: any) {
    log(`[dataForSeo] Tavily search failed: ${error.message}, falling back to DataForSEO...`);
  }
  
  // Fallback to DataForSEO
  return fetchSerpCompetitorsDataForSEO(query, locationCode, languageCode);
}

/**
 * Fetch SERP competitors using DataForSEO SERP API (fallback method)
 */
async function fetchSerpCompetitorsDataForSEO(
  query: string,
  locationCode: number = getDefaultLocationCode(), // Default from env
  languageCode: string = "en"
): Promise<SerpCompetitorsResult> {
  const authInfo = getDataForSeoAuth();
  if (!authInfo) {
    log("[dataForSeo] DataForSEO credentials not configured, returning unverified results");
    return {
      items: [],
      isToolVerified: false,
      notes: "DataForSEO not configured. Set DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD in environment.",
    };
  }

  try {

    const payload = [
      {
        keyword: query,
        location_code: locationCode,
        language_code: languageCode,
        depth: 20, // Get top 20 results
        device: "desktop",
        os: "windows",
      },
    ];

    log(`[dataForSeo] DataForSEO SERP request payload:`, {
      query,
      locationCode,
      languageCode,
      payload: JSON.stringify(payload, null, 2),
    });

    // Step 1: Post a task to get SERP results
    const taskPostResponse = await fetch(
      "https://api.dataforseo.com/v3/serp/google/organic/task_post",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${authInfo.auth}`,
        },
        body: JSON.stringify(payload),
      }
    );

    if (!taskPostResponse.ok) {
      const errorText = await taskPostResponse.text();
      let errorDetails: any = {};
      try {
        errorDetails = JSON.parse(errorText);
      } catch {
        errorDetails = { raw: errorText };
      }
      
      log(`[dataForSeo] DataForSEO SERP task_post error:`, {
        status: taskPostResponse.status,
        statusText: taskPostResponse.statusText,
        errorDetails,
        payload: JSON.stringify(payload, null, 2),
      });
      
      return {
        items: [],
        isToolVerified: false,
        notes: `DataForSEO API error: ${taskPostResponse.statusText} - ${errorText.substring(0, 200)}`,
      };
    }

    const taskData = await taskPostResponse.json();
    const taskId = taskData.tasks?.[0]?.id;

    if (!taskId) {
      return {
        items: [],
        isToolVerified: false,
        notes: "Failed to create SERP task",
      };
    }

    // Step 2: Wait a bit and then get results (simple polling)
    await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2 seconds

    const taskGetResponse = await fetch(
      `https://api.dataforseo.com/v3/serp/google/organic/task_get/${taskId}`,
      {
        method: "GET",
        headers: {
          Authorization: `Basic ${authInfo.auth}`,
        },
      }
    );

    if (!taskGetResponse.ok) {
      const errorText = await taskGetResponse.text();
      let errorDetails: any = {};
      try {
        errorDetails = JSON.parse(errorText);
      } catch {
        errorDetails = { raw: errorText };
      }
      
      log(`[dataForSeo] DataForSEO SERP task_get error:`, {
        status: taskGetResponse.status,
        statusText: taskGetResponse.statusText,
        errorDetails,
        taskId,
      });
      
      return {
        items: [],
        isToolVerified: false,
        notes: `DataForSEO API error: ${taskGetResponse.statusText} - ${errorText.substring(0, 200)}`,
      };
    }

    const resultData = await taskGetResponse.json();

    // Transform DataForSEO response to our format
    const items: SerpCompetitor[] = [];

    if (resultData.tasks && Array.isArray(resultData.tasks)) {
      resultData.tasks.forEach((task: any) => {
        if (task.result && Array.isArray(task.result) && task.result.length > 0) {
          task.result.forEach((resultItem: any) => {
            if (resultItem.items && Array.isArray(resultItem.items)) {
              resultItem.items.forEach((item: any) => {
                if (item.type === "organic") {
                  items.push({
                    title: item.title || "",
                    url: item.url || "",
                    snippet: item.snippet || undefined,
                  });
                }
              });
            }
          });
        }
      });
    }

    log(`[dataForSeo] Fetched ${items.length} SERP competitors from DataForSEO`);

    return {
      items,
      isToolVerified: true,
    };
  } catch (error: any) {
    log(`[dataForSeo] Error fetching SERP competitors: ${error.message}`);
    return {
      items: [],
      isToolVerified: false,
      notes: `Error: ${error.message}`,
    };
  }
}

/**
 * Fetch search volumes for keywords using DataForSEO bulk search volume API
 */
export interface SearchVolumeResult {
  keyword: string;
  search_volume: number;
}

export interface SearchVolumesResult {
  results: SearchVolumeResult[];
  isToolVerified: boolean;
  notes?: string;
}

export async function fetchSearchVolumes(
  keywords: string[],
  locationCode: number = getDefaultLocationCode() // Default from env
  // locationCode: number = 0, // Default to Worldwide
): Promise<SearchVolumesResult> {
  const authInfo = getDataForSeoAuth();
  if (!authInfo) {
    log("[dataForSeo] DataForSEO credentials not configured, returning unverified results");
    return {
      results: [],
      isToolVerified: false,
      notes: "DataForSEO not configured. Set DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD in environment.",
    };
  }

  try {
    // DataForSEO API endpoint for bulk search volume
    // Using clickstream_data bulk_search_volume endpoint (supports up to 1000 keywords per request)
    const response = await fetch(
      "https://api.dataforseo.com/v3/keywords_data/clickstream_data/bulk_search_volume/live",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${authInfo.auth}`,
        },
        body: JSON.stringify([
          {
            location_code: locationCode,
            keywords: keywords, // Array of keywords (up to 1000)
          },
        ]),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      log(`[dataForSeo] DataForSEO search volume API error: ${errorText}`);
      return {
        results: [],
        isToolVerified: false,
        notes: `DataForSEO API error: ${response.statusText}`,
      };
    }

    const data = await response.json();

    // Transform DataForSEO response to our format
    // DataForSEO returns: { tasks: [{ result: [{ items: [{ keyword, search_volume, monthly_searches }] }] }] }
    // Structure: tasks[].result[] (array of location results) -> result[].items[] (array of keyword items)
    const results: SearchVolumeResult[] = [];
    if (data.tasks && Array.isArray(data.tasks)) {
      data.tasks.forEach((task: any) => {
        
        if (task.result && Array.isArray(task.result)) {
          // Each result is a location group with items array
          task.result.forEach((locationResult: any) => {
            if (locationResult.items && Array.isArray(locationResult.items)) {
              locationResult.items.forEach((item: any) => {
                results.push({
                  keyword: item.keyword || "",
                  search_volume: item.search_volume || 0,
                });
              });
            }
          });
        }
      });
    }

    log(`[dataForSeo] Fetched search volumes for ${results.length} keywords from DataForSEO`);

    return {
      results,
      isToolVerified: true,
    };
  } catch (error: any) {
    log(`[dataForSeo] Error fetching search volumes: ${error.message}`);
    return {
      results: [],
      isToolVerified: false,
      notes: `Error: ${error.message}`,
    };
  }
}

/**
 * Fetch ranking keywords for URLs using DataForSEO ranked keywords API
 */
export interface RankingKeyword {
  keyword: string;
  position?: number | null;
  rank_absolute?: number | null;
  search_volume: number;
  cpc?: number | null;
  competition?: number | string | null; // Raw competition value (0-1 scale, can be number or string, kept for backward compatibility)
  competition_index?: number | null; // Raw competition_index value (0-1 scale, kept for backward compatibility)
  difficulty?: number; // Canonical difficulty metric (0-100 scale) - normalized from competition/competition_index/keyword_difficulty
  region?: string; // Region name (e.g., "United States", "United Kingdom")
  main_intent?: string | null;
}

export interface RankingKeywordsResult {
  url: string;
  keywords: RankingKeyword[];
  total_keywords: number;
  total_available?: number;
}

export interface RankingKeywordsResponse {
  results: RankingKeywordsResult[];
  cost?: number;
  taskCosts?: number[];
  isToolVerified: boolean;
  notes?: string;
}

export async function fetchRankingKeywords(
  urls: string[],
  limit: number = 20,
  locationCode: number | null = getDefaultLocationCode(), // Default from env, null for Worldwide
): Promise<RankingKeywordsResponse> {
  const authInfo = getDataForSeoAuth();
  if (!authInfo) {
    log("[dataForSeo] DataForSEO credentials not configured, returning unverified results");
    return {
      results: [],
      isToolVerified: false,
      notes: "DataForSEO not configured. Set DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD in environment.",
    };
  }

  try {
    // Helper function to extract domain from URL
    const extractDomain = (urlStr: string): string => {
      try {
        const url = new URL(urlStr);
        return url.hostname.replace(/^www\./, ""); // Remove www. prefix
      } catch (e) {
        // If URL parsing fails, try to extract domain manually
        return urlStr.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
      }
    };

    // Helper function to extract relative path from URL
    const extractRelativePath = (urlStr: string): string => {
      try {
        const url = new URL(urlStr);
        return url.pathname || "/";
      } catch (e) {
        return "/";
      }
    };

    // DataForSEO Labs API endpoint for ranked keywords (includes positions)
    const requestPayloads = urls.map((url) => {
      const domain = extractDomain(url);
      const relativePath = extractRelativePath(url);

      // Build filters array with proper format
      const filters: any[] = [
        ["ranked_serp_element.serp_item.rank_absolute", "<=", 20]
      ];

      // Add filter for specific URL path if provided (not just domain root)
      if (relativePath && relativePath !== "/") {
        filters.push("and");
        filters.push(["ranked_serp_element.serp_item.relative_url", "=", relativePath]);
      }

      const payload: any = {
        target: domain,
        language_name: "English",
        limit: limit,
        load_rank_absolute: true,
        historical_serp_mode: "live", // Only live data
        order_by: [
          "keyword_data.keyword_info.search_volume,DESC",
          "ranked_serp_element.serp_item.rank_absolute,ASC"
        ],
        filters: filters,
      };
      // Only include location_code if it's not null (for Worldwide, omit it)
      if (locationCode !== null) {
        payload.location_code = locationCode;
      }
      return payload;
    });

    // Log payload before API call
    log(`[dataForSeo] Ranked keywords API request payload:`, JSON.stringify(requestPayloads, null, 2));
    log(`[dataForSeo] Request parameters:`, {
      urls,
      limit,
      locationCode,
      payloadCount: requestPayloads.length,
    });

    const response = await fetch(
      "https://api.dataforseo.com/v3/dataforseo_labs/google/ranked_keywords/live",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${authInfo.auth}`,
        },
        body: JSON.stringify(requestPayloads),
      }
    );

    // Get raw response text first
    const responseText = await response.text();
    
    // Log raw response text
    log(`[dataForSeo] Ranked keywords API response status: ${response.status} ${response.statusText}`);
    log(`[dataForSeo] Ranked keywords API raw response text (first 5000 chars):`, responseText.substring(0, 5000));
    if (responseText.length > 5000) {
      log(`[dataForSeo] ... (response continues, total length: ${responseText.length} chars)`);
    }

    if (!response.ok) {
      log(`[dataForSeo] DataForSEO ranking keywords API error: ${responseText}`);
      return {
        results: [],
        isToolVerified: false,
        notes: `DataForSEO API error: ${response.statusText}`,
      };
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      log(`[dataForSeo] Failed to parse response JSON: ${e}`);
      log(`[dataForSeo] Response text: ${responseText}`);
      return {
        results: [],
        isToolVerified: false,
        notes: `Failed to parse API response: ${e}`,
      };
    }

    // Log parsed response structure
    log(`[dataForSeo] Parsed response structure:`, {
      hasTasks: !!data.tasks,
      tasksLength: data.tasks?.length,
      firstTaskHasResult: !!data.tasks?.[0]?.result,
      firstTaskResultLength: data.tasks?.[0]?.result?.length,
      firstTaskResultType: typeof data.tasks?.[0]?.result,
    });

    // Extract region from response if available, otherwise use mapping function
    let region: string | undefined = undefined;
    
    // Check if location_name or location_name_en is available in the response
    if (data.tasks && Array.isArray(data.tasks) && data.tasks.length > 0) {
      const firstTask = data.tasks[0];
      if (firstTask.result && Array.isArray(firstTask.result) && firstTask.result.length > 0) {
        const firstResult = firstTask.result[0];
        // Check for location_name, location_name_en, or location fields
        if (firstResult.location_name) {
          region = firstResult.location_name;
        } else if (firstResult.location_name_en) {
          region = firstResult.location_name_en;
        } else if (firstResult.location?.location_name) {
          region = firstResult.location.location_name;
        } else if (firstResult.location?.location_name_en) {
          region = firstResult.location.location_name_en;
        }
      }
    }
    
    // If region not found in response, use mapping function
    if (!region) {
      if (locationCode === null) {
        region = "Worldwide";
      } else {
        region = getLocationName(locationCode);
      }
    }

    // Transform DataForSEO response to our format
    const results: RankingKeywordsResult[] = [];
    if (data.tasks && Array.isArray(data.tasks)) {
      data.tasks.forEach((task: any, index: number) => {
        log(`[dataForSeo] Processing task ${index}:`, {
          hasResult: !!task.result,
          resultType: typeof task.result,
          isArray: Array.isArray(task.result),
          resultLength: Array.isArray(task.result) ? task.result.length : 'N/A',
          taskKeys: Object.keys(task),
        });

        const keywords: RankingKeyword[] = [];
        // The actual items are in task.result[0].items[] (not directly in task.result[])
        if (task.result && Array.isArray(task.result) && task.result.length > 0) {
          const resultData = task.result[0];
          const items = resultData.items || [];

          log(`[dataForSeo] Task ${index} result data:`, {
            hasItems: !!resultData.items,
            itemsIsArray: Array.isArray(resultData.items),
            itemsLength: Array.isArray(resultData.items) ? resultData.items.length : 'N/A',
            resultDataKeys: Object.keys(resultData),
            firstItem: resultData.items?.[0] ? JSON.stringify(resultData.items[0], null, 2).substring(0, 1000) : null,
          });

          // Apply limit to results (results are sorted by search_volume DESC, rank_absolute ASC)
          const limitedItems = items.slice(0, limit);

          log(`[dataForSeo] Processing ${limitedItems.length} items for task ${index} (from ${items.length} total)`);

          limitedItems.forEach((item: any, itemIndex: number) => {
            // Extract keyword from keyword_data
            const keywordText = item.keyword_data?.keyword || "";

            // Extract search volume and competition from keyword_info
            const keywordInfo = item.keyword_data?.keyword_info || {};
            const searchVolume = keywordInfo.search_volume || 0;
            const competition = keywordInfo.competition || null;
            const competitionIndex = keywordInfo.competition_index || null;
            const cpc = keywordInfo.cpc || null;

            // Extract keyword_difficulty from keyword_properties (if available)
            const keywordProperties = item.keyword_data?.keyword_properties || {};
            const keywordDifficulty = keywordProperties.keyword_difficulty || null;

            // Normalize competition/difficulty to canonical 0-100 scale
            const difficulty = normalizeDifficulty(competition, competitionIndex, keywordDifficulty);

            // Extract intent from search_intent_info
            const searchIntentInfo = item.keyword_data?.search_intent_info || {};
            const mainIntent = searchIntentInfo.main_intent || null;

            // Extract position/rank from ranked_serp_element
            let rankAbsolute: number | null = null;
            if (item.ranked_serp_element?.serp_item) {
              const serpItem = item.ranked_serp_element.serp_item;
              if (serpItem.rank_absolute !== undefined) {
                rankAbsolute = serpItem.rank_absolute;
              } else if (serpItem.rank_group !== undefined) {
                rankAbsolute = serpItem.rank_group + 1; // rank_group is 0-indexed, position is 1-indexed
              }
            }

            // Filter out keywords ranked position > 20
            if (rankAbsolute !== null && rankAbsolute > 20) {
              return; // Skip this keyword
            }

            // Only add non-empty keywords
            if (keywordText) {
              keywords.push({
                keyword: keywordText,
                position: rankAbsolute, // Keep position for backward compatibility
                rank_absolute: rankAbsolute,
                search_volume: searchVolume,
                cpc: cpc,
                competition: competition, // Keep raw value for backward compatibility
                competition_index: competitionIndex, // Keep raw value for backward compatibility
                difficulty: difficulty, // Canonical normalized metric (0-100)
                region: region, // Region name (e.g., "United States")
                main_intent: mainIntent,
              });
            } else {
              log(`[dataForSeo] Task ${index} item ${itemIndex}: Empty keyword, skipping. Item structure:`, JSON.stringify(item, null, 2).substring(0, 500));
            }
          });

          log(`[dataForSeo] Task ${index} extracted ${keywords.length} keywords`);
        } else {
          log(`[dataForSeo] Task ${index}: No result or empty result array. Task structure:`, JSON.stringify(task, null, 2).substring(0, 1000));
        }

        results.push({
          url: urls[index],
          keywords: keywords,
          total_keywords: keywords.length,
          total_available: task.result?.[0]?.items?.length || 0, // Total available before limit
        });
      });
    }

    // Extract cost from response
    const totalCost = data.cost || 0;
    const taskCosts = data.tasks?.map((task: any) => task.cost || 0) || [];

    log(`[dataForSeo] Fetched ranking keywords for ${results.length} URL(s) from DataForSEO`);
    log(`[dataForSeo] Summary:`, {
      totalResults: results.length,
      totalKeywords: results.reduce((sum, r) => sum + r.total_keywords, 0),
      totalAvailable: results.reduce((sum, r) => sum + (r.total_available || 0), 0),
      cost: totalCost,
    });

    return {
      results,
      cost: totalCost,
      taskCosts: taskCosts,
      isToolVerified: true,
    };
  } catch (error: any) {
    log(`[dataForSeo] Error fetching ranking keywords: ${error.message}`);
    return {
      results: [],
      isToolVerified: false,
      notes: `Error: ${error.message}`,
    };
  }
}

/**
 * Fetch keyword position for a specific keyword and URL
 */
export interface KeywordPositionResult {
  keyword: string;
  url: string;
  position: number | null;
  found: boolean;
  result?: {
    title: string;
    url: string;
    domain: string;
    description?: string;
  };
}

export async function fetchKeywordPosition(
  keyword: string,
  url: string,
  locationCode: number = getDefaultLocationCode(), // Default from env
  languageCode: string = "en"
): Promise<KeywordPositionResult> {
  const authInfo = getDataForSeoAuth();
  if (!authInfo) {
    log("[dataForSeo] DataForSEO credentials not configured");
    throw new Error("DataForSEO not configured. Set DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD in environment.");
  }

  try {
    // Step 1: Post a task to get SERP results
    const taskPostResponse = await fetch(
      "https://api.dataforseo.com/v3/serp/google/organic/task_post",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${authInfo.auth}`,
        },
        body: JSON.stringify([
          {
            keyword: keyword,
            location_code: locationCode,
            language_code: languageCode,
            depth: 100, // Get top 100 results
            device: "desktop",
            os: "windows",
          },
        ]),
      }
    );

    if (!taskPostResponse.ok) {
      const errorText = await taskPostResponse.text();
      log(`[dataForSeo] DataForSEO SERP task_post error: ${errorText}`);
      throw new Error(`DataForSEO API error: ${taskPostResponse.statusText}`);
    }

    const taskData = await taskPostResponse.json();
    const taskId = taskData.tasks?.[0]?.id;

    if (!taskId) {
      throw new Error("Failed to create SERP task");
    }

    // Step 2: Wait a bit and then get results
    await new Promise((resolve) => setTimeout(resolve, 3000)); // Wait 3 seconds

    const taskGetResponse = await fetch(
      `https://api.dataforseo.com/v3/serp/google/organic/task_get/${taskId}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${authInfo.auth}`,
        },
      }
    );

    if (!taskGetResponse.ok) {
      const errorText = await taskGetResponse.text();
      log(`[dataForSeo] DataForSEO SERP task_get error: ${errorText}`);
      throw new Error(`DataForSEO API error: ${taskGetResponse.statusText}`);
    }

    const serpData = await taskGetResponse.json();

    // Find the position of the URL in the results
    let position: number | null = null;
    let foundResult: { title: string; url: string; domain: string; description?: string } | undefined = undefined;

    // Normalize URLs for comparison (remove trailing slashes, www, etc.)
    const normalizeUrl = (urlStr: string): string => {
      try {
        const urlObj = new URL(urlStr);
        let normalized = `${urlObj.protocol}//${urlObj.hostname}${urlObj.pathname}`;
        normalized = normalized.replace(/\/$/, ""); // Remove trailing slash
        normalized = normalized.toLowerCase();
        return normalized;
      } catch (e) {
        return urlStr.toLowerCase();
      }
    };

    if (serpData.tasks && serpData.tasks.length > 0) {
      const task = serpData.tasks[0];
      if (task.result && Array.isArray(task.result)) {
        const targetUrlNormalized = normalizeUrl(url);

        for (let i = 0; i < task.result.length; i++) {
          const item = task.result[i];
          if (item.url) {
            const itemUrlNormalized = normalizeUrl(item.url);
            if (itemUrlNormalized === targetUrlNormalized || itemUrlNormalized.includes(targetUrlNormalized) || targetUrlNormalized.includes(itemUrlNormalized)) {
              position = i + 1; // Position is 1-indexed
              foundResult = {
                title: item.title || "",
                url: item.url || "",
                domain: item.domain || "",
                description: item.description || undefined,
              };
              break;
            }
          }
        }
      }
    }

    log(`[dataForSeo] Fetched keyword position for "${keyword}" and URL "${url}": ${position || "not found"}`);

    return {
      keyword,
      url,
      position,
      found: position !== null,
      result: foundResult,
    };
  } catch (error: any) {
    log(`[dataForSeo] Error fetching keyword position: ${error.message}`);
    throw error;
  }
}

/**
 * Get SERP (Search Engine Results Page) organic results for a keyword
 */
export interface SerpOrganicResult {
  title: string;
  url: string;
  snippet?: string;
  position: number;
  domain?: string;
}

export interface SerpResult {
  keyword: string;
  location_code: number;
  language_code: string;
  results: SerpOrganicResult[];
  total_results?: number;
}

export interface SerpOptions {
  locationCode?: number; // Default: 0 (worldwide)
  languageCode?: string; // Default: "en"
  depth?: number; // Number of results to fetch (default: 100)
  device?: "desktop" | "mobile"; // Default: "desktop"
  fullResponse?: boolean; // If true, returns full DataForSEO response object
}

/**
 * Get SERP organic results for a keyword
 * @param keyword - The keyword to search for
 * @param options - Optional parameters (locationCode, languageCode, depth, device, fullResponse)
 * @returns Abbreviated SERP results by default, or full response if fullResponse is true
 */
export async function getSERP(
  keyword: string,
  options: SerpOptions = {}
): Promise<SerpResult | any> {
  const {
    locationCode = getDefaultLocationCode(), // Default from env
    languageCode = "en",
    depth = 100,
    device = "desktop",
    fullResponse = false,
  } = options;

  const authInfo = getDataForSeoAuth();
  if (!authInfo) {
    log("[dataForSeo] DataForSEO credentials not configured");
    throw new Error("DataForSEO not configured. Set DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD in environment.");
  }

  try {
    // Use live/advanced endpoint (single POST, immediate results) - same as test-dataforseo page.
    // task_post/task_get was returning 40400 "Not Found" for the worker.
    const payload = [
      {
        keyword,
        location_code: locationCode,
        language_code: languageCode,
        depth,
        device,
        os: "windows",
      },
    ];

    const liveResponse = await fetch(
      "https://api.dataforseo.com/v3/serp/google/organic/live/advanced",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${authInfo.auth}`,
        },
        body: JSON.stringify(payload),
      }
    );

    if (!liveResponse.ok) {
      const errorText = await liveResponse.text();
      log(`[dataForSeo] DataForSEO SERP live/advanced error: ${errorText}`);
      throw new Error(`DataForSEO API error: ${liveResponse.statusText}`);
    }

    const serpData = await liveResponse.json();

    // Handle API-level errors (e.g. 40400 Not Found from wrong endpoint)
    if (serpData.status_code && serpData.status_code !== 20000) {
      const msg = serpData.status_message || `status_code ${serpData.status_code}`;
      log(`[dataForSeo] DataForSEO SERP API error: ${msg}`);
      throw new Error(`DataForSEO SERP: ${msg}`);
    }
    if (serpData.tasks_error > 0 && (!serpData.tasks || serpData.tasks.length === 0)) {
      throw new Error("DataForSEO SERP: no tasks returned (tasks_error > 0)");
    }

    // If fullResponse is requested, return the parsed JSON object as-is
    if (fullResponse) {
      log(`[dataForSeo] Returning full SERP response for keyword: "${keyword}"`);
      return serpData;
    }

    // Otherwise, return abbreviated format.
    // Live/advanced: task.result is array of pages, each page has .items (array of organic, featured_snippet, etc.)
    const results: SerpOrganicResult[] = [];
    if (serpData.tasks && serpData.tasks.length > 0) {
      const task = serpData.tasks[0];
      if (task.result && Array.isArray(task.result)) {
        let position = 0;
        for (const page of task.result) {
          const items = page.items || [];
          for (const item of items) {
            if (item.type === "organic") {
              position += 1;
              results.push({
                title: item.title || "",
                url: item.url || "",
                snippet: item.snippet || item.description || undefined,
                position,
                domain: item.domain || undefined,
              });
            }
          }
        }
      }
    }

    log(`[dataForSeo] Fetched ${results.length} SERP organic results for keyword: "${keyword}"`);

    return {
      keyword,
      location_code: locationCode,
      language_code: languageCode,
      results,
      total_results: results.length,
    };
  } catch (error: any) {
    log(`[dataForSeo] Error fetching SERP: ${error.message}`);
    throw error;
  }
}

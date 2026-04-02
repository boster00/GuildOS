/**
 * Normalize text by stripping HTML tags and converting to lowercase
 * Works in both browser and server environments
 * @param {string} text - Text to normalize
 * @returns {string} Normalized text
 */
export function normalizeText(text) {
  if (!text) return '';
  const plainText = text
    .replace(/<[^>]*>/g, '')
    .replace(/&[^;]+;/g, ' ');
  return plainText.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Count keyword occurrences in text (case-insensitive, whole word matching)
 * @param {string} keyword - Keyword to count
 * @param {string} text - Text to search in
 * @returns {number} Number of occurrences
 */
export function countOccurrences(keyword, text) {
  if (!keyword || !text) return 0;
  const normalizedKeyword = keyword.toLowerCase().trim();
  if (!normalizedKeyword) return 0;
  
  // Use word boundary regex to match whole words only
  // Escape special regex characters in keyword
  const escapedKeyword = normalizedKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`\\b${escapedKeyword}\\b`, 'gi');
  const matches = text.match(regex);
  return matches ? matches.length : 0;
}

/**
 * Count keyword occurrences with partial matching (substring matching)
 * Used to prevent overstuffing - e.g., "peptide synthesis services" counts as "peptide synthesis service"
 * @param {string} keyword - Keyword to count
 * @param {string} text - Text to search in
 * @returns {number} Number of occurrences
 */
export function countOccurrencesPartial(keyword, text) {
  if (!keyword || !text) return 0;
  const normalizedKeyword = keyword.toLowerCase().trim();
  const normalizedText = normalizeText(text);
  if (!normalizedKeyword || !normalizedText) return 0;
  
  // Count substring matches (case-insensitive)
  const escapedKeyword = normalizedKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(escapedKeyword, 'gi');
  const matches = normalizedText.match(regex);
  return matches ? matches.length : 0;
}

/**
 * Calculate recommended occurrence range for a keyword based on competitor pages
 * @param {string} keywordText - The keyword text
 * @param {Array} competitorPages - Array of competitor page objects with content
 * @returns {Object} { lower: number, upper: number }
 */
export function calculateRecommendedRange(keywordText, competitorPages) {
  if (!competitorPages || !Array.isArray(competitorPages) || competitorPages.length === 0) {
    return { lower: 1, upper: 1, average: 1 };
  }

  // Count occurrences in each competitor page
  const competitorOccurrences = competitorPages.map(page => {
    const pageContent = page.content || '';
    const normalizedPageContent = normalizeText(pageContent);
    return countOccurrences(keywordText, normalizedPageContent);
  });

  // Calculate recommended range
  const totalOccurrences = competitorOccurrences.reduce((sum, count) => sum + count, 0);
  const averageOccurrences = competitorOccurrences.length > 0 
    ? totalOccurrences / competitorOccurrences.length 
    : 0;
  const lowerRange = Math.max(1, Math.floor(averageOccurrences));
  const upperRangeRaw = competitorOccurrences.length > 0 
    ? Math.max(...competitorOccurrences) 
    : 0;
  // Ensure upper range is not lower than lower range
  const upperRange = Math.max(lowerRange, upperRangeRaw);

  return { lower: lowerRange, upper: upperRange, average: averageOccurrences };
}

/**
 * Calculate keyword requirements (recommended range, current occurrences, required additions)
 * Uses smart ranking to prevent overstuffing: sorts by length (longest first) and tracks
 * planned implementations in a mock string to account for longer tail keywords containing shorter ones.
 * @param {Array} keywords - Array of keyword objects with keyword_text
 * @param {Array} competitorPages - Array of competitor page objects with content
 * @param {string} articleContent - HTML or text content of the current article
 * @returns {Array} Array of keyword requirement objects
 */
export function calculateKeywordRequirements(keywords, competitorPages, articleContent) {
  if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
    return [];
  }

  if (!articleContent || typeof articleContent !== 'string') {
    return [];
  }

  const normalizedArticleContent = normalizeText(articleContent);

  // Filter and sort keywords by length (descending) - longest first to prevent overstuffing
  const filteredKeywords = keywords
    .filter(kw => {
      // Only process keywords that are included and have keyword_text
      const keywordText = kw.keyword_text || kw.keyword;
      return kw.included !== false && keywordText && keywordText.trim().length > 0;
    })
    .sort((a, b) => {
      const textA = (a.keyword_text || a.keyword || '').length;
      const textB = (b.keyword_text || b.keyword || '').length;
      return textB - textA; // Descending order (longest first)
    });

  // Track planned implementations to prevent overstuffing
  let implementedKeywordsMockString = "";

  return filteredKeywords.map(kw => {
      const keywordText = (kw.keyword_text || kw.keyword || '').trim();
      
      // Calculate recommended range from competitor pages
      const { lower, upper, average } = calculateRecommendedRange(keywordText, competitorPages || []);
      
      // Calculate target occurrences as average from competitors (rounded to nearest integer), capped 1-5
      const targetOccurrences = Math.max(1, Math.min(5, Math.round(average)));
      
      // Count occurrences in article with partial matching
      const articleCount = countOccurrencesPartial(keywordText, normalizedArticleContent);
      
      // Count occurrences in implemented keywords mock string (to account for longer tail keywords)
      const implementedCount = countOccurrencesPartial(keywordText, implementedKeywordsMockString);
      
      // Total current count = article count + implemented count
      const currentOccurrences = articleCount + implementedCount;
      
      // Calculate required additions
      const requiredAdditions = Math.min(3, Math.max(0, targetOccurrences - currentOccurrences));
      
      // If keyword needs to be added, append to mock string (requiredAdditions times)
      if (requiredAdditions > 0) {
        for (let i = 0; i < requiredAdditions; i++) {
          implementedKeywordsMockString += " " + keywordText;
        }
      }
      
      return {
        keyword: keywordText,
        keywordId: kw.id,
        recommendedRange: { lower, upper, average },
        targetOccurrences,
        currentOccurrences,
        requiredAdditions,
      };
    });
}

/**
 * Calculate SEO score based on keyword occurrences in article vs competitor pages
 * 
 * Algorithm:
 * 1. For each keyword, count occurrences in each competitor page
 * 2. Calculate recommended range:
 *    - Lower range = average of occurrences (rounded down), minimum 1
 *    - Upper range = highest occurrence count in any competitor page
 * 3. Count occurrences of each keyword in the current article
 * 4. Score = percentage of keywords that meet the lower range (at least lower range occurrences)
 * 
 * @param {Object} params
 * @param {Array} params.keywords - Array of keyword objects with keyword_text
 * @param {Array} params.competitorPages - Array of competitor page objects with content
 * @param {string} params.articleContent - HTML or text content of the current article
 * @returns {Object} { score: number (0-100), rationale: string, details: Object }
 */
export function calculateSeoScore({ keywords, competitorPages, articleContent }) {
  // Validation: both assets must be present
  if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
    return {
      score: null,
      rationale: "Keywords asset is required to calculate SEO score",
      details: null,
    };
  }

  if (!competitorPages || !Array.isArray(competitorPages) || competitorPages.length === 0) {
    return {
      score: null,
      rationale: "Competitor pages asset is required to calculate SEO score",
      details: null,
    };
  }

  if (!articleContent || typeof articleContent !== 'string') {
    return {
      score: null,
      rationale: "Article content is required to calculate SEO score",
      details: null,
    };
  }

  const normalizedArticleContent = normalizeText(articleContent);

  // Filter and sort keywords by length (descending) - longest first to prevent overstuffing
  const filteredKeywords = keywords
    .filter(kw => {
      // Only process keywords that are included and have keyword_text
      const keywordText = kw.keyword_text || kw.keyword;
      return kw.included !== false && keywordText && keywordText.trim().length > 0;
    })
    .sort((a, b) => {
      const textA = (a.keyword_text || a.keyword || '').length;
      const textB = (b.keyword_text || b.keyword || '').length;
      return textB - textA; // Descending order (longest first)
    });

  // Track planned implementations to prevent overstuffing
  let implementedKeywordsMockString = "";

  // Process each keyword
  const keywordResults = filteredKeywords.map(kw => {
      const keywordText = (kw.keyword_text || kw.keyword || '').trim();
      
      // Calculate recommended range using helper function
      const { lower: lowerRange, upper: upperRange, average } = calculateRecommendedRange(keywordText, competitorPages);
      
      // Calculate target occurrences as average from competitors (rounded to nearest integer), capped 1-5
      const targetOccurrences = Math.max(1, Math.min(5, Math.round(average)));
      
      // Count occurrences in each competitor page (for details)
      const competitorOccurrences = competitorPages.map(page => {
        const pageContent = page.content || '';
        const normalizedPageContent = normalizeText(pageContent);
        return countOccurrences(keywordText, normalizedPageContent);
      });

      // Count occurrences in current article with partial matching
      const articleCount = countOccurrencesPartial(keywordText, normalizedArticleContent);
      
      // Count occurrences in implemented keywords mock string (to account for longer tail keywords)
      const implementedCount = countOccurrencesPartial(keywordText, implementedKeywordsMockString);
      
      // Total current count = article count + implemented count
      const articleOccurrences = articleCount + implementedCount;
      
      // Calculate required additions
      const requiredAdditions = Math.min(3, Math.max(0, targetOccurrences - articleOccurrences));
      
      // If keyword needs to be added, append to mock string (requiredAdditions times)
      if (requiredAdditions > 0) {
        for (let i = 0; i < requiredAdditions; i++) {
          implementedKeywordsMockString += " " + keywordText;
        }
      }

      // Check if keyword meets the lower range requirement
      const meetsLowerRange = articleOccurrences >= lowerRange;

      return {
        keyword: keywordText,
        competitorOccurrences,
        lowerRange,
        upperRange,
        articleOccurrences,
        meetsLowerRange,
      };
    });

  if (keywordResults.length === 0) {
    return {
      score: null,
      rationale: "No valid keywords found to calculate SEO score",
      details: null,
    };
  }

  // Calculate score: percentage of keywords meeting lower range
  const keywordsMeetingLowerRange = keywordResults.filter(r => r.meetsLowerRange).length;
  const totalKeywords = keywordResults.length;
  const score = Math.round((keywordsMeetingLowerRange / totalKeywords) * 100);

  // Build rationale
  const rationale = `${keywordsMeetingLowerRange} out of ${totalKeywords} keywords meet the recommended occurrence range based on competitor analysis.`;

  // Build details for debugging/display
  const details = {
    totalKeywords,
    keywordsMeetingLowerRange,
    keywordsNotMeetingLowerRange: totalKeywords - keywordsMeetingLowerRange,
    keywordResults: keywordResults.map(r => ({
      keyword: r.keyword,
      lowerRange: r.lowerRange,
      upperRange: r.upperRange,
      articleOccurrences: r.articleOccurrences,
      meetsLowerRange: r.meetsLowerRange,
      competitorOccurrences: r.competitorOccurrences,
    })),
  };

  return {
    score,
    rationale,
    details,
  };
}

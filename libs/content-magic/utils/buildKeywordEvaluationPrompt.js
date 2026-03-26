/**
 * Server-safe keyword evaluation prompt builder.
 * Extracted from libs/content-magic/rules/researchKeywords.js (handleAskAI).
 * Used by both the UI component and the full-auto server route.
 */

const BATCH_SIZE = 30;

/**
 * Build keyword evaluation prompt(s) for a list of candidates.
 * Returns an array of prompt strings (one per batch of BATCH_SIZE keywords).
 *
 * @param {{ offer: string, icpText?: string, candidates: Array<{keyword: string, search_volume?: number|null}>, customInstructions?: string }} params
 * @returns {string[]} Array of prompt strings (batched)
 */
export function buildKeywordEvaluationPrompts({ offer, icpText = '', candidates, customInstructions = '' }) {
  const todayDate = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  // Build volume map (max volume per lowercase keyword)
  const volumeMap = {};
  for (const c of candidates) {
    const text = c.keyword?.trim();
    if (!text) continue;
    const lower = text.toLowerCase();
    const vol = c.search_volume != null ? Number(c.search_volume) : 0;
    if (volumeMap[lower] == null || vol > (volumeMap[lower] ?? 0)) {
      volumeMap[lower] = vol || null;
    }
  }

  // Deduplicate candidates (case-insensitive)
  const seen = new Set();
  const unique = [];
  for (const c of candidates) {
    const text = c.keyword?.trim();
    if (!text) continue;
    const lower = text.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      unique.push(text);
    }
  }

  // Split into batches
  const batches = [];
  for (let i = 0; i < unique.length; i += BATCH_SIZE) {
    batches.push(unique.slice(i, i + BATCH_SIZE));
  }

  return batches.map(batch => {
    const keywordsWithVolume = batch.map(kw => {
      const vol = volumeMap[kw.toLowerCase()];
      return vol != null && vol > 0 ? `${kw} (search volume: ${vol})` : kw;
    });
    const keywordsBatch = keywordsWithVolume.join('\n');

    const message = `Evaluate keywords for relevance to this offer page.

Today's date: ${todayDate}
When judging recency or time-sensitive relevance (e.g. "latest", "current year", "2024"), use this date. Do not assume the current year is 2024.

Context:
- Offer: ${offer}
${icpText ? `- ICP: ${icpText}` : ''}

Keywords (with search volume when known):
${keywordsBatch}

Deduplication: Identify keywords that are overly similar and would cause keyword stuffing if both were implemented (e.g. same words different order, plural vs singular, minor variants). For each such group, keep the keyword with higher search volume; mark the others as duplicates. Set include: false, duplicateOf: "exact keyword you kept", and note: "duplicate of [keyword] - recommend removal". If search volumes are equal or unknown, keep the one that reads more naturally.

Output:
Return ONLY a valid JSON array. For each keyword, include:
{"keyword":"string","include":true|false,"note":"3-5 words" or for duplicates "duplicate of X - recommend removal"}
Optionally for duplicates only: "duplicateOf":"exact keyword kept"

Rules:
- Include all keywords in the output
- For non-duplicates: note must be 3-5 words max explaining why include or exclude
- For duplicates: set include false, duplicateOf to the keyword you kept, note "duplicate of [keyword] - recommend removal"
- No commentary outside the JSON array`;

    return customInstructions
      ? `${message}\n\nAdditional instructions from the user:\n${customInstructions}`
      : message;
  });
}

/**
 * Build a retry prompt for keywords that were missed in the main evaluation.
 *
 * @param {{ offer: string, icpText?: string, missingKeywords: string[] }} params
 * @returns {string}
 */
export function buildKeywordRetryPrompt({ offer, icpText = '', missingKeywords }) {
  return `Evaluate keywords for relevance to this offer page.

Context:
- Offer: ${offer}
${icpText ? `- ICP: ${icpText}` : ''}

Keywords:
${missingKeywords.join(', ')}

Output:
Return ONLY a valid JSON array. For each keyword, include:
{"keyword":"string","include":true|false,"note":"3-5 words"}

Rules:
- Include all keywords in the output
- Note must be 3-5 words max explaining why include or exclude
- No extra fields
- No commentary outside the JSON array`;
}

/**
 * Parse the JSON array from an AI keyword evaluation response.
 * Returns array of { keyword, include, note, duplicateOf? } or [] on parse error.
 *
 * @param {string} aiText
 * @returns {Array<{keyword: string, include: boolean, note: string, duplicateOf?: string}>}
 */
export function parseKeywordEvaluationResponse(aiText) {
  if (!aiText) return [];
  const raw = aiText.trim();

  let parsed = null;
  try {
    if (raw.startsWith('[') && raw.endsWith(']')) {
      parsed = JSON.parse(raw);
    } else {
      const jsonBlockMatch = raw.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/);
      if (jsonBlockMatch) {
        parsed = JSON.parse(jsonBlockMatch[1].trim());
      } else {
        const jsonMatch = raw.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        }
      }
    }
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) return [];

  // Validate note length (3-5 words for non-duplicates)
  return parsed
    .filter(item => item && item.keyword)
    .map(item => {
      const isDuplicate = item.duplicateOf != null && item.duplicateOf !== '';
      let note = item.note || '';
      if (note && !isDuplicate) {
        const words = note.trim().split(/\s+/);
        if (words.length > 5) note = words.slice(0, 5).join(' ');
      }
      return {
        keyword: item.keyword,
        include: item.include === true || item.include === 'true',
        note,
        ...(item.duplicateOf ? { duplicateOf: item.duplicateOf } : {}),
      };
    });
}

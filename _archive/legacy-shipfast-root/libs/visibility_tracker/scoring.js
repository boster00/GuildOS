/**
 * Visibility scoring - SEO (CTR curve) and AI (mention/citation).
 * Domain for AI must be passed explicitly (not from result object).
 */

export function calculateSeoVisibility(serpResults) {
  const ctrCurve = {
    1: 0.3,
    2: 0.16,
    3: 0.11,
    4: 0.08,
    5: 0.06,
    6: 0.05,
    7: 0.04,
    8: 0.03,
    9: 0.03,
    10: 0.02,
    11: 0.015,
    12: 0.015,
    13: 0.01,
    14: 0.01,
    15: 0.01,
    16: 0.005,
    17: 0.005,
    18: 0.005,
    19: 0.005,
    20: 0.005,
  };

  const list = Array.isArray(serpResults) ? serpResults : [];
  if (list.length === 0) return 0;

  const totalPossibleScore = list.length * ctrCurve[1];
  const actualScore = list.reduce((sum, result) => {
    const rank = result.rank;
    if (!rank || rank < 1) return sum;
    const ctr = ctrCurve[rank] || 0;
    return sum + ctr;
  }, 0);

  const visibility = (actualScore / totalPossibleScore) * 100;
  
  return Math.round(visibility * 100) / 100;
}

export function calculateAiVisibility(aiResults, domain) {
  const list = Array.isArray(aiResults) ? aiResults : [];
  if (list.length === 0) return 0;

  const scores = list.map((result) => {
    const citations = result.citations || [];
    const hasDomainCitation = citations.some((c) =>
      String(c).toLowerCase().includes((domain || "").toLowerCase())
    );

    if (hasDomainCitation) {
      return 1.0;
    }
    if (result.mentions_domain) {
      return 0.7;
    }
    if (result.mentions_brand) {
      return 0.4;
    }
    return 0;
  });

  const avgScore =
    scores.reduce((a, b) => a + b, 0) / scores.length;
  const visibility = avgScore * 100;
  
  return Math.round(visibility * 100) / 100;
}

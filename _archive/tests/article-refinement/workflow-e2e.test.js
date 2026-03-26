// ARCHIVED: Original path was tests/article-refinement/workflow-e2e.test.js

import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * End-to-end workflow test
 * Tests the complete refinement workflow from step 1 to step 9
 */
describe('Article Refinement Workflow E2E', () => {
  let articleId = 'test-article-id';
  let refinementState = {};

  beforeEach(() => {
    vi.clearAllMocks();
    refinementState = {};
  });

  it('should complete full workflow from step 1 to step 9', async () => {
    // Step 1: Author Insights
    const step1Request = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({
        articleId,
        authorInsights: 'Test insights: must include X, avoid Y',
      }),
    });

    // Mock the step 1 endpoint
    const { POST: step1POST } = await import('@/app/api/content-magic/article-refinement/step-1-summarize-insights/route');
    const step1Response = await step1POST(step1Request);
    const step1Data = await step1Response.json();

    expect(step1Response.status).toBe(200);
    expect(step1Data.brief).toBeDefined();
    refinementState.refinementBrief = step1Data.brief;

    // Step 2: Keyword Strategy
    const step2Request = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({
        articleId,
        candidateKeywords: [
          { keyword: 'keyword 1', volume: 1000 },
          { keyword: 'keyword 2', volume: 500 },
        ],
      }),
    });

    const { POST: step2POST } = await import('@/app/api/content-magic/article-refinement/step-2-keyword-strategy/route');
    const step2Response = await step2POST(step2Request);
    const step2Data = await step2Response.json();

    expect(step2Response.status).toBe(200);
    expect(step2Data.strategy).toBeDefined();
    refinementState.keywordStrategy = step2Data.strategy;

    // Step 3: Q&A Targeting
    const step3Request = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ articleId }),
    });

    const { POST: step3POST } = await import('@/app/api/content-magic/article-refinement/step-3-qa-targeting/route');
    const step3Response = await step3POST(step3Request);
    const step3Data = await step3Response.json();

    expect(step3Response.status).toBe(200);
    expect(step3Data.qaTargets).toBeDefined();
    refinementState.qaTargets = { questions: step3Data.qaTargets };

    // Step 4: Competitor Mining
    const step4Request = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({
        articleId,
        competitorSummaries: 'Competitor content here',
      }),
    });

    const { POST: step4POST } = await import('@/app/api/content-magic/article-refinement/step-4-competitor-mining/route');
    const step4Response = await step4POST(step4Request);
    const step4Data = await step4Response.json();

    expect(step4Response.status).toBe(200);
    expect(step4Data.ideas).toBeDefined();
    refinementState.competitorIdeas = { ideas: step4Data.ideas };

    // Step 5: Placement Suggestions
    const step5Request = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ articleId }),
    });

    const { POST: step5POST } = await import('@/app/api/content-magic/article-refinement/step-5-placement-suggestions/route');
    const step5Response = await step5POST(step5Request);
    const step5Data = await step5Response.json();

    expect(step5Response.status).toBe(200);
    expect(step5Data.placements).toBeDefined();
    refinementState.placementSuggestions = { placements: step5Data.placements };

    // Step 6: Change Checklist
    const step6Request = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ articleId }),
    });

    const { POST: step6POST } = await import('@/app/api/content-magic/article-refinement/step-6-change-checklist/route');
    const step6Response = await step6POST(step6Request);
    const step6Data = await step6Response.json();

    expect(step6Response.status).toBe(200);
    expect(step6Data.checklist).toBeDefined();
    refinementState.changeChecklist = { items: step6Data.checklist };

    // Step 7: Implement Changes
    const step7Request = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ articleId }),
    });

    const { POST: step7POST } = await import('@/app/api/content-magic/article-refinement/step-7-implement-changes/route');
    const step7Response = await step7POST(step7Request);
    const step7Data = await step7Response.json();

    expect(step7Response.status).toBe(200);
    expect(step7Data.updatedArticle).toBeDefined();
    refinementState.implementationResult = {
      updatedArticle: step7Data.updatedArticle,
      changelog: step7Data.changelog,
    };

    // Step 8: Internal Linking
    const step8Request = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({
        articleId,
        domain: 'example.com',
      }),
    });

    const { POST: step8POST } = await import('@/app/api/content-magic/article-refinement/step-8-internal-linking/route');
    const step8Response = await step8POST(step8Request);
    const step8Data = await step8Response.json();

    expect(step8Response.status).toBe(200);
    expect(step8Data.linksPlan).toBeDefined();
    refinementState.internalLinksPlan = step8Data.linksPlan;

    // Step 9: Final Review
    const step9Request = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ articleId }),
    });

    const { POST: step9POST } = await import('@/app/api/content-magic/article-refinement/step-9-final-review/route');
    const step9Response = await step9POST(step9Request);
    const step9Data = await step9Response.json();

    expect(step9Response.status).toBe(200);
    expect(step9Data.review).toBeDefined();
    refinementState.finalReview = step9Data.review;

    // Verify complete workflow state
    expect(refinementState).toHaveProperty('refinementBrief');
    expect(refinementState).toHaveProperty('keywordStrategy');
    expect(refinementState).toHaveProperty('qaTargets');
    expect(refinementState).toHaveProperty('competitorIdeas');
    expect(refinementState).toHaveProperty('placementSuggestions');
    expect(refinementState).toHaveProperty('changeChecklist');
    expect(refinementState).toHaveProperty('implementationResult');
    expect(refinementState).toHaveProperty('internalLinksPlan');
    expect(refinementState).toHaveProperty('finalReview');
  });
});


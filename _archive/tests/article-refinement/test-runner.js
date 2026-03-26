// ARCHIVED: Original path was tests/article-refinement/test-runner.js

/**
 * Manual Test Runner for Article Refinement Workflow
 * 
 * This script can be used to manually test the workflow with real API calls
 * Run with: node tests/article-refinement/test-runner.js
 */

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
const TEST_ARTICLE_ID = process.env.TEST_ARTICLE_ID || 'your-article-id-here';

async function testStep(stepNumber, stepName, endpoint, payload) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Step ${stepNumber}: ${stepName}`);
  console.log('='.repeat(60));
  
  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Add auth headers if needed
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (response.ok) {
      console.log('✅ Success');
      console.log('Response:', JSON.stringify(data, null, 2));
      return data;
    } else {
      console.log('❌ Error:', data.error);
      return null;
    }
  } catch (error) {
    console.log('❌ Exception:', error.message);
    return null;
  }
}

async function runWorkflow() {
  console.log('🚀 Starting Article Refinement Workflow Test');
  console.log(`Testing article: ${TEST_ARTICLE_ID}`);
  console.log(`Base URL: ${BASE_URL}`);

  const results = {};

  // Step 1: Author Insights
  results.step1 = await testStep(
    1,
    'Author Insights & Brief',
    '/api/content-magic/article-refinement/step-1-summarize-insights',
    {
      articleId: TEST_ARTICLE_ID,
      authorInsights: 'Test insights: must include X, avoid Y, nice to have Z',
    }
  );

  // Step 2: Keyword Strategy
  results.step2 = await testStep(
    2,
    'Secondary Keyword Strategy',
    '/api/content-magic/article-refinement/step-2-keyword-strategy',
    {
      articleId: TEST_ARTICLE_ID,
      candidateKeywords: [
        { keyword: 'test keyword 1', volume: 1000 },
        { keyword: 'test keyword 2', volume: 500 },
      ],
    }
  );

  // Step 3: Q&A Targeting
  results.step3 = await testStep(
    3,
    'Q&A Targeting',
    '/api/content-magic/article-refinement/step-3-qa-targeting',
    {
      articleId: TEST_ARTICLE_ID,
    }
  );

  // Step 4: Competitor Mining
  results.step4 = await testStep(
    4,
    'Competitor Content Mining',
    '/api/content-magic/article-refinement/step-4-competitor-mining',
    {
      articleId: TEST_ARTICLE_ID,
      competitorSummaries: 'Competitor content summary here',
    }
  );

  // Step 5: Placement Suggestions
  results.step5 = await testStep(
    5,
    'Placement Suggestions',
    '/api/content-magic/article-refinement/step-5-placement-suggestions',
    {
      articleId: TEST_ARTICLE_ID,
    }
  );

  // Step 6: Change Checklist
  results.step6 = await testStep(
    6,
    'Change Checklist',
    '/api/content-magic/article-refinement/step-6-change-checklist',
    {
      articleId: TEST_ARTICLE_ID,
    }
  );

  // Step 7: Implement Changes
  results.step7 = await testStep(
    7,
    'Implement Changes',
    '/api/content-magic/article-refinement/step-7-implement-changes',
    {
      articleId: TEST_ARTICLE_ID,
    }
  );

  // Step 8: Internal Linking
  results.step8 = await testStep(
    8,
    'Internal Linking',
    '/api/content-magic/article-refinement/step-8-internal-linking',
    {
      articleId: TEST_ARTICLE_ID,
      domain: 'example.com',
    }
  );

  // Step 9: Final Review
  results.step9 = await testStep(
    9,
    'Final Review',
    '/api/content-magic/article-refinement/step-9-final-review',
    {
      articleId: TEST_ARTICLE_ID,
    }
  );

  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('📊 Test Summary');
  console.log('='.repeat(60));
  
  const steps = [
    'Author Insights', 'Keyword Strategy', 'Q&A Targeting',
    'Competitor Mining', 'Placement Suggestions', 'Change Checklist',
    'Implement Changes', 'Internal Linking', 'Final Review'
  ];

  steps.forEach((step, index) => {
    const result = results[`step${index + 1}`];
    const status = result ? '✅' : '❌';
    console.log(`${status} Step ${index + 1}: ${step}`);
  });

  const successCount = Object.values(results).filter(r => r !== null).length;
  console.log(`\n${successCount}/9 steps completed successfully`);
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runWorkflow().catch(console.error);
}

export { runWorkflow, testStep };


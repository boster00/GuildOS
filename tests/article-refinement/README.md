# Article Refinement Workflow Tests

This directory contains comprehensive tests for the Article Refinement Workflow system.

## Test Structure

- **Individual Step Tests**: Each API endpoint has its own test file
  - `step-1-summarize-insights.test.js`
  - `step-2-keyword-strategy.test.js`
  - `step-3-qa-targeting.test.js`
  - `step-4-competitor-mining.test.js`
  - `step-5-placement-suggestions.test.js`
  - `step-6-change-checklist.test.js`
  - `step-7-implement-changes.test.js`
  - `step-8-internal-linking.test.js`
  - `step-9-final-review.test.js`

- **Utility Tests**: `utils.test.js` - Tests helper functions
- **E2E Tests**: `workflow-e2e.test.js` - Full workflow integration test

## Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test tests/article-refinement/step-1-summarize-insights.test.js

# Run with coverage
npm test -- --coverage

# Run in watch mode
npm test -- --watch
```

## Test Mocks

The tests use mocked:
- **Supabase Client**: Returns test data without hitting real database
- **LLM (Monkey)**: Returns predictable JSON responses based on prompt content
- **Environment Variables**: Test values set in `tests/setup.js`

## Adding New Tests

When adding new functionality:

1. Create a test file following the naming pattern: `step-X-feature.test.js`
2. Import the route handler: `import { POST } from '@/app/api/.../route'`
3. Mock any external dependencies
4. Test both success and error cases
5. Verify response structure and status codes

## Test Coverage Goals

- ✅ All API endpoints tested
- ✅ Error handling tested
- ✅ Authentication/authorization tested
- ✅ Data validation tested
- ✅ E2E workflow tested
- ✅ Utility functions tested


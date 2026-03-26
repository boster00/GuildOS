# Article Refinement Workflow - Test Setup Guide

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install --save-dev vitest @vitest/ui
   ```

2. **Run tests:**
   ```bash
   npm test
   ```

3. **Run tests with UI:**
   ```bash
   npm run test:ui
   ```

4. **Run tests with coverage:**
   ```bash
   npm run test:coverage
   ```

## Test Structure

### Unit Tests
- **Individual Step Tests**: Test each API endpoint in isolation
- **Utility Tests**: Test helper functions (extractOutlineFromHtml, parseFinalReview)

### Integration Tests
- **E2E Workflow Test**: Tests the complete workflow from step 1 to step 9

## Test Mocks

The test suite uses mocks for:
- **Supabase Client**: Returns test data without hitting real database
- **LLM (Monkey)**: Returns predictable JSON responses
- **Environment Variables**: Test values

## Manual Testing

For manual testing with real API calls, use the test runner:

```bash
# Set environment variables
export TEST_BASE_URL=http://localhost:3000
export TEST_ARTICLE_ID=your-article-id

# Run manual test
node tests/article-refinement/test-runner.js
```

## Writing New Tests

1. Create test file: `tests/article-refinement/step-X-feature.test.js`
2. Import route handler: `import { POST } from '@/app/api/.../route'`
3. Mock dependencies in `tests/setup.js` if needed
4. Test success and error cases
5. Verify response structure

## Test Coverage

Current coverage includes:
- ✅ All 9 API endpoints
- ✅ Error handling
- ✅ Authentication checks
- ✅ Data validation
- ✅ Utility functions
- ✅ E2E workflow

## Troubleshooting

**Tests fail with import errors:**
- Make sure `vitest.config.js` has correct path aliases
- Check that `tests/setup.js` is properly configured

**Mock not working:**
- Verify mocks are set up in `tests/setup.js`
- Check that `vi.mock()` is called before imports

**LLM responses not parsing:**
- Check mock responses in `tests/setup.js`
- Verify JSON structure matches expected format


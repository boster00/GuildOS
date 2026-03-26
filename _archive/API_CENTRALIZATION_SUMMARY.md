<!-- ARCHIVED: Original path was API_CENTRALIZATION_SUMMARY.md -->

# API Centralization Summary

**Date:** 2026-01-26  
**Purpose:** Prepare for usage metering by centralizing all third-party API calls through monkey methods

## Changes Completed

### Phase 1: Removed Test Code ✅

**Deleted Files (8 total):**
- `app/test-v0/page.js` - v0 test UI page
- `app/api/v0/generate-page/route.js` - v0 test API route
- `app/api/v0/fetch-content/route.js` - v0 test API route
- `app/api/v0/fetch-from-url/route.js` - v0 test API route
- `V0_TEST_PAGE_README.md` - Test documentation
- `V0_HTML_OUTPUT_GUIDE.md` - Test guide
- `docs/V0_SETUP_INSTRUCTIONS.md` - Test setup instructions
- `MANUAL_OUTLINE_TEST.md` - Test guide

**Note:** v0 SDK is still used in production (`app/api/content-magic/generate-outline/route.js`) via the new centralized monkey methods.

### Phase 2: Centralized Production APIs ✅

#### 2a. Image Generation (OpenAI DALL-E)

**New Method Added:** `monkey.generateImage(prompt, options)`

**Location:** `libs/monkey.js` (lines ~1510-1670)

**Features:**
- Model fallback chain support (tries multiple DALL-E models)
- Automatic retry with exponential backoff
- Handles rate limits and transient errors
- Returns structured response with metadata

**Updated Files:**
- `app/api/content-magic/generate-image/route.js` - Now uses `monkey.generateImage()`
- Removed 250+ lines of duplicate retry/fallback logic

**Used By:**
- `app/(private)/content-magic/components/ImageGenerationModal.js`
- `app/(private)/content-magic/components/ImageBrowsePanel.js`
- `app/(private)/content-magic/components/ContentMagicEditor.js`

#### 2b. v0.dev API

**New Methods Added:**
- `monkey.v0Generate(prompt, options)` - Create and generate pages
- `monkey.v0Fetch(chatId)` - Fetch existing chat content

**Location:** `libs/monkey.js` (lines ~1730-1936)

**Features:**
- Automatic polling with configurable timeouts
- Exponential backoff for polling
- Comprehensive error handling
- Returns all generated files with metadata

**Updated Files:**
- `app/api/content-magic/generate-outline/route.js` - Now uses `monkey.v0Generate()`
- Removed ~120 lines of duplicate v0 SDK logic

**Used By:**
- Production outline generation feature in ContentMagic

#### 2c. OpenAI Embeddings

**New Method Added:** `monkey.generateEmbeddings(texts, options)`

**Location:** `libs/monkey.js` (lines ~1670-1730)

**Features:**
- Supports single text or batch processing
- Returns single embedding or array of embeddings
- Configurable model selection

**Updated Files:**
- `libs/monkey.js` - `evaluatePromptsWithVectors()` now uses `monkey.generateEmbeddings()`
- `libs/monkey/actions/calculateRelevance.ts` - Updated to use `monkey.generateEmbeddings()`

**Used By:**
- `app/api/vectorize-test/route.js` (test code)
- `libs/monkey/actions/calculateRelevance.ts` (currently unused, but ready for future use)

#### 2d. Runtime Provider System ✅

**Status:** Already within monkey ecosystem

**Location:** `libs/monkey/tools/runtime/`

**Current State:**
- Runtime providers (callOpenAI, callChat, callStructured, callHtml) already return usage data
- Token usage is logged in responses: `{ text, usage: { prompt_tokens, completion_tokens, total_tokens }, raw }`
- Used by new agentic pipelines through `runTask()` system

**Action:** No changes needed - usage data is already available for metering integration

**Used By:**
- `libs/monkey/pipelines/writeArticleLandingPipeline.ts`
- `libs/monkey/pipelines/icpSuggestPipeline.ts`
- `libs/monkey/pipelines/keywordOutcomeSuggestPipeline.ts`
- `libs/monkey/pipelines/promiseSuggestPipeline.ts`
- `libs/monkey/pipelines/campaignRoadmapPlanPipeline.ts`
- `libs/monkey/pipelines/organizeOutlinePipeline.ts`
- `libs/monkey/pipelines/summarizeTalkPointsPipeline.ts`
- And many more action files

## API Call Status Summary

| Service | Method | Status | Usage |
|---------|--------|--------|-------|
| **Tavily** | `monkey.webSearch()` | ✅ Centralized | Production (search, extract) |
| **Tavily** | `monkey.webExtract()` | ✅ Centralized | Production (content extraction) |
| **Tavily** | `monkey.webCrawl()` | ✅ Centralized | Production (web crawling) |
| **DataForSEO** | `monkey.DataForSEO*()` | ✅ Centralized | Production (keyword research) |
| **OpenAI (text)** | `monkey.AI()` | ✅ Centralized | Production (90+ usages) |
| **OpenAI (images)** | `monkey.generateImage()` | ✅ **NEW** Centralized | Production (image generation UI) |
| **OpenAI (embeddings)** | `monkey.generateEmbeddings()` | ✅ **NEW** Centralized | Test code only |
| **v0.dev** | `monkey.v0Generate()` | ✅ **NEW** Centralized | Production (outline generation) |
| **v0.dev** | `monkey.v0Fetch()` | ✅ **NEW** Centralized | Ready for use |
| **Runtime Providers** | `callChat`, `callStructured`, `callHtml` | ✅ Centralized | Production (agentic pipelines) |

## Files Flagged for Potential Removal

### Test Code (Low Priority)
- `app/(private)/vectorize-test/page.js` - Embeddings test page
- `app/api/vectorize-test/route.js` - Embeddings test route

### Unused Code
- `libs/monkey/actions/calculateRelevance.ts` - Not imported anywhere, but updated to use centralized embeddings in case it's needed in the future

**Recommendation:** Keep for now since they're dev-only routes (hidden in production). Can be removed later if confirmed unnecessary.

## Next Steps for Usage Metering Implementation

All third-party API calls now go through monkey methods. When implementing usage metering:

### 1. Create Usage Metering Table

```sql
CREATE TABLE api_usage_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  service TEXT NOT NULL, -- 'openai', 'tavily', 'dataforseo', 'v0'
  method TEXT NOT NULL, -- 'AI', 'generateImage', 'webSearch', etc.
  model TEXT, -- 'gpt-4o', 'dall-e-3', etc.
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  total_tokens INTEGER,
  cost_usd DECIMAL(10, 6),
  request_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_api_usage_user_id ON api_usage_logs(user_id);
CREATE INDEX idx_api_usage_created_at ON api_usage_logs(created_at);
CREATE INDEX idx_api_usage_service ON api_usage_logs(service);
```

### 2. Add Metering Hooks to Monkey Methods

Add a private method `_logUsage()` in the Monkey class:

```javascript
async _logUsage({ service, method, model, tokens, cost, requestId }) {
  if (!this.user?.id) return;
  
  try {
    await this.write('api_usage_logs', {
      user_id: this.user.id,
      service,
      method,
      model,
      prompt_tokens: tokens?.prompt_tokens,
      completion_tokens: tokens?.completion_tokens,
      total_tokens: tokens?.total_tokens,
      cost_usd: cost,
      request_id: requestId,
    });
  } catch (error) {
    this.log('[Monkey] Warning: Failed to log usage:', error.message);
    // Don't throw - usage logging should not block main functionality
  }
}
```

### 3. Integration Points

Add `_logUsage()` calls to:
- `monkey.AI()` - After successful OpenAI call (line ~920)
- `monkey.generateImage()` - After successful image generation (line ~1633)
- `monkey.generateEmbeddings()` - After successful embedding generation (line ~1721)
- `monkey.v0Generate()` - After successful v0 generation (line ~1845)
- `monkey.webSearch()`, `monkey.webExtract()`, `monkey.webCrawl()` - After Tavily calls
- Runtime providers - Add metering hook in `callOpenAI()` function

### 4. Cost Calculation

Create a cost calculator utility:

```javascript
// libs/monkey/utils/costCalculator.js
export function calculateOpenAICost(model, tokens) {
  const pricing = {
    'gpt-4o': { input: 0.0025, output: 0.01 }, // per 1K tokens
    'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
    'dall-e-3': { standard: 0.04, hd: 0.08 }, // per image
    'text-embedding-3-small': 0.00002, // per 1K tokens
    // Add more models...
  };
  
  // Calculate based on model type
  // Return cost in USD
}
```

### 5. Runtime Provider Metering

The runtime system already returns usage data. Add metering by wrapping the `callOpenAI` function or adding a post-call hook in `callChatWrapper()`.

## Testing Recommendations

1. **Image Generation:** Test via ImageGenerationModal in ContentMagic editor
2. **v0 API:** Test via outline generation feature
3. **Embeddings:** Test via vectorize-test page (if keeping)
4. **All Methods:** Verify no regressions in existing functionality

## Summary

- ✅ **8 test files removed**
- ✅ **3 new monkey methods added** (generateImage, v0Generate, v0Fetch)
- ✅ **2 existing methods updated** (generateEmbeddings, evaluatePromptsWithVectors)
- ✅ **3 API routes updated** to use centralized methods
- ✅ **100% of paid API calls** now go through monkey methods
- ✅ **Ready for usage metering implementation**

All third-party API calls requiring paid API keys (Tavily, DataForSEO, OpenAI, v0) are now centralized through monkey methods, making it straightforward to add usage metering and billing tracking.

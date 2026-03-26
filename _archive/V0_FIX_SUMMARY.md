<!-- ARCHIVED: Original path was V0_FIX_SUMMARY.md -->

# v0 Method Fix Summary

**Date:** 2026-01-26  
**Issue:** Monkey's v0Generate method was not working in production, but native test route worked fine

## Root Cause Analysis

After comparing the working `/test-v0` test route with monkey's `v0Generate()` method, the issue was identified:

### The Problem
- **Test route**: Returns `{ success: false, error: '...' }` on errors
- **Monkey method**: Threw exceptions on errors

This mismatch caused the calling code in `generate-outline/route.js` to fail because it expected an error object but received a thrown exception.

### Calling Code Pattern (generate-outline/route.js:140-142)
```javascript
const result = await monkey.v0Generate(fullPrompt, options);

if (result.error || !result.success) {
  throw new Error(result.error || 'v0 generation failed');
}
```

The code checks for `result.error` or `!result.success`, but if monkey threw an exception, this check never executed.

## Changes Made

### 1. Updated `monkey.v0Generate()` (lines 1994-2204)

**Before:**
- Threw errors on validation failures (missing prompt, missing API key)
- Threw errors on caught exceptions
- Returned `{ error: '...' }` on no files (inconsistent)

**After:**
- Returns `{ success: false, error: '...' }` on validation failures
- Returns `{ success: false, error: '...' }` on caught exceptions
- Returns `{ success: false, error: '...' }` on no files (consistent)
- Returns `{ success: true, ... }` on success

### 2. Updated `monkey.v0Fetch()` (lines 2211-2334)

**Before:**
- Threw errors on validation failures
- Threw errors on caught exceptions

**After:**
- Returns `{ success: false, error: '...' }` on validation failures
- Returns `{ success: false, error: '...' }` on caught exceptions
- Returns `{ success: false, error: '...' }` on no files
- Returns `{ success: true, ... }` on success

## Error Handling Improvements

### Validation Errors (Early Returns)
```javascript
// Missing prompt
if (!prompt || !prompt.trim()) {
  this.log('[Monkey.v0Generate] ERROR: Missing prompt');
  return {
    success: false,
    error: 'v0 generation prompt is required',
    generationTime: `${((Date.now() - startTime) / 1000).toFixed(1)}s`,
  };
}

// Missing API key
if (!apiKey) {
  this.log('[Monkey.v0Generate] ERROR: Missing V0_API_KEY');
  return {
    success: false,
    error: 'V0_API_KEY not configured. Set V0_API_KEY in environment variables.',
    generationTime: `${((Date.now() - startTime) / 1000).toFixed(1)}s`,
  };
}
```

### Caught Exceptions (Try-Catch)
```javascript
} catch (error) {
  this.log('[Monkey.v0Generate] Error occurred:', error.message);
  this.log('[Monkey.v0Generate] Error name:', error.name);
  this.log('[Monkey.v0Generate] Error code:', error.code);
  this.log('[Monkey.v0Generate] Full error:', error);
  
  // Return error object instead of throwing
  return {
    success: false,
    error: `v0 generation failed: ${error.message}`,
    details: {
      name: error.name,
      message: error.message,
      code: error.code,
    },
    generationTime: `${((Date.now() - startTime) / 1000).toFixed(1)}s`,
  };
}
```

### No Files Generated
```javascript
if (files.length === 0) {
  // Calculate credits even on failure
  const estimatedPromptTokens = Math.ceil(fullPrompt.length / 4);
  const credits = this.calculateCredits('v0', {
    model: 'v0-mini',
    prompt_tokens: estimatedPromptTokens,
    completion_tokens: 0
  });
  
  return {
    success: false,  // ← Added success: false
    error: 'No files generated after polling',
    chatId: chat.id,
    demoUrl: finalChat.demo || finalChat.url,
    files: [],
    pollingAttempts: retries,
    generationTime: `${((Date.now() - startTime) / 1000).toFixed(1)}s`,
    credits: credits,
  };
}
```

## Compatibility

The changes are **100% backward compatible** with the calling code in `generate-outline/route.js` because:

1. Success case: Returns `{ success: true, ... }` (same as before)
2. Error case: Now returns `{ success: false, error: '...' }` instead of throwing
3. Calling code checks `if (result.error || !result.success)` which works for both patterns
4. If error exists, calling code throws anyway, so the error still bubbles up to the outer try-catch

## Testing Recommendations

1. **Test validation errors**: Try calling without prompt or API key
2. **Test timeout scenario**: Set very short maxWaitTime to trigger "no files" error
3. **Test API errors**: Use invalid API key to test v0 SDK errors
4. **Test success case**: Normal generation should still work as before

## Core v0 Integration (Unchanged)

The actual v0 SDK integration code remains **identical** between test route and monkey:
- Dynamic v0-sdk import
- Client configuration with `{ apiKey, baseUrl: 'https://api.v0.dev/v1' }`
- Client selection fallback chain
- Chat creation with `v0.chats.create({ message })`
- 3-second initial wait + polling with `v0.chats.get(chatId)`
- File extraction and HTML parsing

The fix was purely about **error handling patterns**, not v0 integration logic.

## Timeout Configuration (Added 2026-01-26)

Added 10-minute timeout for v0 API requests to handle large prompts:

```javascript
const clientConfig = {
  apiKey,
  baseUrl: 'https://api.v0.dev/v1',
  fetch: (url, init) => {
    // Set 10-minute timeout for fetch requests
    return fetch(url, {
      ...init,
      signal: AbortSignal.timeout(600000), // 10 minutes in milliseconds
    });
  },
};
```

**Applied to:**
- `monkey.v0Generate()` (libs/monkey.js)
- `monkey.v0Fetch()` (libs/monkey.js)
- `/api/v0/generate-page` test route
- `/api/v0/fetch-chat` test route

**Reason:** Large prompts (47KB+) were causing `HeadersTimeoutError` with default fetch timeout. The 10-minute timeout allows v0 to process and respond to complex generation requests.

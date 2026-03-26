<!-- ARCHIVED: Original path was CREDIT_SYSTEM_IMPLEMENTATION.md -->

# Credit System Implementation

**Date:** 2026-01-26  
**Purpose:** Implement CJGEO credit calculation and tracking for all API calls

## Overview

**Credit Definition:** 1 credit = $0.10 USD worth of API cost

All API responses now include a `credits` field indicating how many CJGEO credits the action consumed.

## Implementation Details

### 1. Markups Configuration

**Location:** `libs/monkey.js` constructor (lines ~30-40)

```javascript
this.markups = {
  openai_text: 0,        // GPT-4o, GPT-4o-mini, etc.
  openai_image: 0,       // DALL-E 3, gpt-image models
  openai_embedding: 0,   // text-embedding-3-small, etc.
  tavily_search: 0,      // Tavily search API
  tavily_extract: 0,     // Tavily extract API
  dataforseo: 0,         // DataForSEO SERP API
  v0: 0,                 // v0.dev API
  runtime: 0,            // Runtime provider calls
};
```

**Markup Values:**
- `0` = No markup (1 USD cost = 1 USD credit)
- `1` = 100% markup (1 USD cost = 2 USD credit)
- Set manually in code as needed

### 2. Credit Calculation Function

**Location:** `libs/monkey.js` (lines ~368-505)

**Method:** `monkey.calculateCredits(type, params)`

**Supported Types:**
- `'openai_text'` - GPT models (GPT-4o, GPT-4o-mini, etc.)
- `'openai_image'` - DALL-E 3, gpt-image models
- `'openai_embedding'` - text-embedding-3-small
- `'tavily_search'` - Tavily search API
- `'tavily_extract'` - Tavily extract API
- `'dataforseo'` - DataForSEO SERP API
- `'v0'` - v0.dev API (v0-mini, v0-pro, v0-max)
- `'runtime'` - Runtime provider calls (callChat, callStructured, callHtml)

### 3. Pricing Reference (2025)

**OpenAI:**
- GPT-4o: Input $5/1M tokens, Output $15/1M tokens
- GPT-4o-mini: Input $0.15/1M tokens, Output $0.60/1M tokens
- GPT-4-turbo: Input $10/1M tokens, Output $30/1M tokens
- GPT-3.5-turbo: Input $0.50/1M tokens, Output $1.50/1M tokens
- DALL-E 3: $0.04/image (standard), $0.08/image (HD)
- Embeddings: $0.02/1M tokens (text-embedding-3-small)

**Tavily:**
- Search: $0.005/search (basic), $0.01/search (advanced)
- Extract: $0.001/URL (basic), $0.002/URL (advanced)

**DataForSEO:**
- SERP API: $0.0006/SERP (standard), $0.0012/SERP (priority)

**v0.dev:**
- v0-mini: Input $0.50/1M tokens, Output $2/1M tokens
- v0-pro: Input $1.50/1M tokens, Output $7.50/1M tokens
- v0-max: Input $2/1M tokens, Output $10/1M tokens

## Credits in API Responses

### Methods Returning Objects (credits field added)

1. **`monkey.AI()`** - When `returnMetadata: true`
   ```javascript
   {
     output: "...",
     credits: 0.1234,
     metadata: { tokenUsage, duration, model }
   }
   ```

2. **`monkey.generateImage()`**
   ```javascript
   {
     images: [...],
     model: "dall-e-3",
     requestId: "...",
     credits: 0.4  // $0.04 / $0.10 = 0.4 credits
   }
   ```

3. **`monkey.v0Generate()`**
   ```javascript
   {
     success: true,
     chatId: "...",
     htmlContent: "...",
     files: [...],
     credits: 0.05  // Estimated based on tokens
   }
   ```

4. **`monkey.v0Fetch()`**
   ```javascript
   {
     success: true,
     chatId: "...",
     htmlContent: "...",
     files: [...],
     credits: 0.001  // Minimal read cost
   }
   ```

5. **`evaluatePromptsWithVectors()`**
   ```javascript
   {
     results: [...],
     credits: 0.02,  // Total embedding credits
     timing: {...},
     chunksCount: 10
   }
   ```

6. **Runtime Providers:**
   - `callChat()` → `ChatResponse.credits`
   - `callStructured()` → `StructuredCallResult.credits`
   - `callHtml()` → `HtmlCallResult.credits`

### Methods Returning Simple Values

For methods that return arrays or strings, credits are stored differently:

1. **`monkey.webSearch()`**, **`monkey.webExtract()`**, **`monkey.webCrawl()`**
   - Credits added as `_credits` property on the results array
   - Example: `results._credits = 0.05`

2. **`monkey.AI()`** (normal return, not returnMetadata)
   - Credits stored in `monkey.lastCredits` property
   - Access via: `const credits = monkey.lastCredits;`

3. **`monkey.generateEmbeddings()`**
   - Credits logged but not returned (method returns arrays/numbers)
   - Access via: `monkey.lastCredits` after call

## Usage Examples

### Example 1: Getting credits from monkey.AI()

```javascript
const monkey = await initMonkey();

// Method 1: Use returnMetadata
const result = await monkey.AI("Hello", { returnMetadata: true });
console.log(`Credits used: ${result.credits}`);

// Method 2: Check lastCredits
const output = await monkey.AI("Hello");
const credits = monkey.lastCredits;
console.log(`Credits used: ${credits}`);
```

### Example 2: Getting credits from image generation

```javascript
const result = await monkey.generateImage("A beautiful sunset");
console.log(`Credits used: ${result.credits}`);
console.log(`Images: ${result.images.length}`);
```

### Example 3: Getting credits from Tavily search

```javascript
const results = await monkey.webSearch("AI tools");
const credits = results._credits;
console.log(`Credits used: ${credits}`);
console.log(`Results: ${results.length}`);
```

### Example 4: Getting credits from runtime calls

```javascript
const result = await callStructured("agent", messages, { schema });
if (result.ok) {
  console.log(`Credits used: ${result.credits}`);
  console.log(`Data:`, result.data);
}
```

## Credit Calculation Formula

```javascript
// 1. Calculate base cost in USD
costUSD = calculateBaseCost(type, params);

// 2. Apply markup
markup = this.markups[type] || 0;
costWithMarkup = costUSD * (1 + markup);

// 3. Convert to credits (1 credit = $0.10 USD)
credits = costWithMarkup / 0.10;

// 4. Round to 4 decimal places
return Math.round(credits * 10000) / 10000;
```

## Example Credit Calculations

### OpenAI GPT-4o
- 10,000 prompt tokens + 5,000 completion tokens
- Cost: (10,000/1M * $5) + (5,000/1M * $15) = $0.05 + $0.075 = $0.125
- Credits: $0.125 / $0.10 = **1.25 credits**

### DALL-E 3 Image
- 1 image, standard quality
- Cost: $0.04
- Credits: $0.04 / $0.10 = **0.4 credits**

### Tavily Search
- 1 basic search
- Cost: $0.005
- Credits: $0.005 / $0.10 = **0.05 credits**

### v0-mini Generation
- 50,000 prompt tokens + 100,000 completion tokens
- Cost: (50,000/1M * $0.50) + (100,000/1M * $2) = $0.025 + $0.20 = $0.225
- Credits: $0.225 / $0.10 = **2.25 credits**

## Next Steps

1. **Add credits to DataForSEO API routes** - These methods use `apiCall()` which routes to API endpoints. Credits should be calculated in the API route handlers.

2. **Database logging** - When ready, add `_logUsage()` method to store credits in database for billing.

3. **Update markups** - Manually adjust `this.markups` object values as needed for pricing strategy.

4. **Testing** - Verify credits are calculated correctly for all API types in production scenarios.

## Files Modified

- `libs/monkey.js` - Added markups, calculateCredits(), credits to responses
- `libs/monkey/tools/runtime/providers/openai.ts` - Added credits to ChatResponse
- `libs/monkey/tools/runtime/callStructured.ts` - Added credits to StructuredCallResult
- `libs/monkey/tools/runtime/callHtml.ts` - Added credits to HtmlCallResult

## Notes

- Credits are rounded to 4 decimal places for precision
- Markups default to 0 (no markup) - adjust manually as needed
- For methods returning simple values, use `monkey.lastCredits` or check `_credits` property on arrays
- All pricing is based on 2025 API pricing - update as needed when pricing changes

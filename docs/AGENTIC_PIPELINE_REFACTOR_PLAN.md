# Agentic Pipeline Refactor Plan: Talk Points & Section Planning

## Overview
Refactor the agentic pipeline to:
1. Replace "topics" section with "Assets" display in Plan Outline
2. Remove clarification questions step
3. Add talk points interpretation step
4. Enhance competitor research to generate talk points
5. Add section planning step that maps talk points to topics
6. Output section-by-section notes before writing

## Current Pipeline Flow

```
Step 1: Interpret Intent (IntentModel)
Step 2: Collect & Validate Competitors
Step 3: Benchmark Competitors (Coverage)
Step 4: Choose Sections (ChosenSection[])
Step 5: Write Sections (SectionContent[])
Step 6: Render HTML
```

## Proposed New Pipeline Flow

```
Step 1: Interpret Intent (IntentModel)
Step 2: Interpret Talk Points (NEW)
  - Input: campaign context, ALL assets, user prompt
  - Output: TalkPoints[]
Step 3: Collect & Validate Competitors
Step 4: Benchmark Competitors + Extract Talk Points (ENHANCED)
  - Output: Coverage + CompetitorTalkPoints[]
Step 5: Plan Sections (NEW)
  - Input: TalkPoints (from Step 2 + Step 4), Coverage
  - Output: SectionPlan[] (main topics + mapped talk points + notes per section)
Step 6: Choose Sections (MODIFIED)
  - Input: SectionPlan[] (instead of just Coverage)
  - Output: ChosenSection[] (with section notes from planning)
Step 7: Write Sections (UNCHANGED)
  - Input: ChosenSection[] (now includes notes)
  - Output: SectionContent[]
Step 8: Render HTML (UNCHANGED)
```

## Detailed Changes

### Step 2: Interpret Talk Points (NEW)

**Location:** `libs/monkey/pipelines/writeArticleLandingPipeline.ts`

**Function:** `interpretTalkPoints()`

**Input:**
- `campaignContext`: Full campaign context (ICP, offer, etc.)
- `allAssets`: All campaign assets (from `campaignContext.assets` or similar)
- `userPrompt`: Original user prompt/request

**Output:**
```typescript
interface TalkPoint {
  point: string;           // The actual talk point
  category: "usp" | "pain" | "benefit" | "proof" | "process" | "differentiator" | "other";
  source: "campaign" | "assets" | "user_prompt";
  priority: "high" | "medium" | "low";
  relatedAssets?: string[]; // Asset keys this point relates to
}

interface TalkPointsResult {
  talkPoints: TalkPoint[];
  summary: string; // Summary of what was interpreted
}
```

**Implementation:**
- Use `callStructured` with schema for TalkPoint[]
- Analyze campaign context (ICP, offer, USPs, etc.)
- Analyze all assets (case studies, testimonials, features, etc.)
- Extract key messages, benefits, pain points, differentiators
- Categorize and prioritize talk points

### Step 4: Benchmark Competitors + Extract Talk Points (ENHANCED)

**Location:** `libs/monkey/pipelines/writeArticleLandingPipeline.ts` (modify `benchmarkCompetitors()`)

**Enhancement:**
- After mapping competitor pages to sections, also extract talk points from competitor content
- Use LLM to identify key messages, value propositions, pain points addressed

**New Output:**
```typescript
interface CompetitorTalkPoint {
  point: string;
  category: "usp" | "pain" | "benefit" | "proof" | "process" | "differentiator" | "other";
  sourceUrl: string;
  sectionType?: SectionType; // Which section it appeared in
  confidence: number;
}

interface EnhancedBenchmarkResult extends CompetitorBenchmarkResult {
  competitorTalkPoints: CompetitorTalkPoint[];
}
```

### Step 5: Plan Sections (NEW)

**Location:** `libs/monkey/pipelines/writeArticleLandingPipeline.ts`

**Function:** `planSections()`

**Input:**
- `talkPoints`: Combined talk points from Step 2 and Step 4
- `coverage`: Competitor coverage from Step 4
- `pageType`: MarketingPageType
- `intentModel`: IntentModel from Step 1

**Output:**
```typescript
interface SectionPlan {
  sectionType: SectionType;
  mainTopic: string;              // Main topic/heading for this section
  talkPoints: TalkPoint[];        // Talk points mapped to this section
  notes: string;                   // Section-specific notes/guidance
  suggestedFormat?: string;        // Suggested format from planning
  rationale: {
    whyThisTopic: string;
    talkPointMapping: string;     // Why these talk points belong here
  };
}

interface SectionPlanningResult {
  sectionPlans: SectionPlan[];
  summary: string;
}
```

**Implementation:**
- Use `callStructured` to:
  1. Identify main topics/sections needed
  2. Map talk points to appropriate sections
  3. Generate section-specific notes
  4. Suggest formats based on talk point types

### Step 6: Choose Sections (MODIFIED)

**Location:** `libs/monkey/pipelines/writeArticleLandingPipeline.ts` (modify `chooseSections()`)

**Changes:**
- Accept `SectionPlan[]` as input (in addition to existing inputs)
- Use section plans to inform section selection
- Include section notes in `ChosenSection.rationale.notes`

**Modified Output:**
```typescript
interface ChosenSection {
  sectionType: SectionType;
  format: string;
  rationale: {
    registryReason: string;
    icpOfferReason?: string;
    competitorEvidenceRefs?: Array<{...}>;
    notes?: string;  // NEW: Section notes from planning
    mainTopic?: string; // NEW: Main topic from planning
  };
}
```

### Plan Outline UI Changes

**Location:** `app/(private)/agent-playground/components/` (or wherever Plan Outline is displayed)

**Changes:**
- Replace "Topics" section with "Assets" section
- Display ALL campaign assets (from `campaignContext.assets`)
- Show asset types, keys, and previews
- Allow expanding/collapsing asset details

**Files to modify:**
- Find component that displays Step 3 results (chosen sections)
- Replace topics display with assets display
- May need to check `app/(private)/agent-playground/components/LandingPagePipeline.js` or similar

## Code Responsibility Map (For Semi-Manual Approach)

### 1. Talk Points Interpretation

**Primary File:** `libs/monkey/pipelines/writeArticleLandingPipeline.ts`
- Function: `interpretTalkPoints()` (NEW)
- Lines: ~200-300 (new function)
- Dependencies: `callStructured`, `intentModelSchema` (may need new schema)

**Supporting Files:**
- `libs/monkey/references/marketingPageSchemas.ts` - Add `talkPointSchema`
- `libs/monkey/references/marketingTypes.ts` - Add `TalkPoint`, `TalkPointsResult` types

**Manual Override Location:**
- Can manually create `TalkPoint[]` array
- Pass directly to Step 5 (planSections)

### 2. Competitor Talk Points Extraction

**Primary File:** `libs/monkey/pipelines/writeArticleLandingPipeline.ts`
- Function: `benchmarkCompetitors()` (MODIFY)
- Current lines: ~624-732
- Add talk point extraction after section mapping

**Supporting Files:**
- `libs/monkey/actions/competitorMapToSections.ts` - May need to enhance to extract talk points
- Or create new: `libs/monkey/actions/extractCompetitorTalkPoints.ts`

**Manual Override Location:**
- Can manually create `CompetitorTalkPoint[]` array
- Merge with campaign talk points before Step 5

### 3. Section Planning

**Primary File:** `libs/monkey/pipelines/writeArticleLandingPipeline.ts`
- Function: `planSections()` (NEW)
- Lines: ~850-950 (new function, after chooseSections)
- Dependencies: `callStructured`, new `sectionPlanSchema`

**Supporting Files:**
- `libs/monkey/references/marketingPageSchemas.ts` - Add `sectionPlanSchema`
- `libs/monkey/references/marketingTypes.ts` - Add `SectionPlan`, `SectionPlanningResult` types

**Manual Override Location:**
- Can manually create `SectionPlan[]` array
- Each plan should have: sectionType, mainTopic, talkPoints[], notes
- Pass directly to Step 6 (chooseSections)

### 4. Section Selection (Modified)

**Primary File:** `libs/monkey/pipelines/writeArticleLandingPipeline.ts`
- Function: `chooseSections()` (MODIFY)
- Current lines: ~865-1019
- Changes: Accept `SectionPlan[]`, use plans to inform selection, include notes

**Manual Override Location:**
- Can manually create `ChosenSection[]` with notes
- Notes will be passed to Step 7 (writeSections)

### 5. Section Writing (Unchanged but Enhanced)

**Primary File:** `libs/monkey/pipelines/writeArticleLandingPipeline.ts`
- Function: `writeSections()` (ENHANCE)
- Current lines: ~1029-1150
- Changes: Use `chosen.rationale.notes` in prompts

**Manual Override Location:**
- Can manually edit `SectionContent[]` after generation
- Or manually create entire `SectionContent[]` array

### 6. Plan Outline UI - Assets Display

**Primary File:** `app/(private)/agent-playground/components/LandingPagePipeline.js` (or similar)
- Find where Step 3 results are displayed
- Replace topics section with assets section

**Supporting Files:**
- May need new component: `app/(private)/agent-playground/components/AssetsDisplay.js`
- Or modify existing component that shows chosen sections

**Manual Override Location:**
- Can manually edit UI component to show assets instead of topics
- Assets should come from `campaignContext.assets` or `runState.artifacts.assets`

### 7. Remove Clarification Questions

**Primary File:** `libs/monkey/pipelines/writeArticleLandingPipeline.ts`
- Remove any calls to `generateClarificationQuestions()`
- Remove Step 2 clarification questions (if it exists as separate step)
- Current flow doesn't show clarification questions as separate step, so may already be removed

**Files to check:**
- `libs/monkey/actions/generateClarificationQuestions.ts` - Keep file but don't call it
- Check if clarification questions are called anywhere in pipeline

## Implementation Order

1. **Add Talk Points types and schemas**
   - `libs/monkey/references/marketingTypes.ts` - Add types
   - `libs/monkey/references/marketingPageSchemas.ts` - Add schemas

2. **Implement Step 2: Interpret Talk Points**
   - Create `interpretTalkPoints()` function
   - Integrate into pipeline after Step 1

3. **Enhance Step 4: Extract Competitor Talk Points**
   - Modify `benchmarkCompetitors()` to extract talk points
   - Merge with campaign talk points

4. **Implement Step 5: Plan Sections**
   - Create `planSections()` function
   - Integrate into pipeline after Step 4

5. **Modify Step 6: Choose Sections**
   - Update `chooseSections()` to accept and use `SectionPlan[]`
   - Include notes in `ChosenSection.rationale`

6. **Enhance Step 7: Write Sections**
   - Update `writeSections()` to use section notes

7. **Update Plan Outline UI**
   - Replace topics with assets display
   - Update component that shows Step 3/5 results

8. **Remove Clarification Questions**
   - Remove any calls to clarification questions
   - Clean up unused code

## Testing Strategy

1. Test talk points interpretation with various campaign contexts
2. Test competitor talk point extraction
3. Test section planning with different talk point combinations
4. Test section selection with section plans
5. Test section writing with notes
6. Test UI changes for assets display

## Rollback Plan

If agentic approach doesn't work:
1. Keep all new types and schemas
2. Create manual input functions for:
   - Talk points (manual array creation)
   - Section plans (manual array creation)
3. Use manual arrays instead of LLM calls
4. Keep UI changes for assets display

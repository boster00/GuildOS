# Code Responsibility Map: Agentic Pipeline Refactor

This map shows exactly which code files and functions are responsible for each part of the pipeline, enabling semi-manual intervention if needed.

## Pipeline Flow Overview

```
Step 1: Interpret Intent
  ↓
Step 2: Interpret Talk Points (NEW)
  ↓
Step 3: Collect & Validate Competitors
  ↓
Step 4: Benchmark + Extract Competitor Talk Points
  ↓
Step 5: Plan Sections (NEW)
  ↓
Step 6: Choose Sections (MODIFIED)
  ↓
Step 7: Write Sections
  ↓
Step 8: Render HTML
```

## Step-by-Step Code Map

### Step 1: Interpret Intent

**File:** `libs/monkey/pipelines/writeArticleLandingPipeline.ts`
- **Function:** `interpretIntent()` (lines ~75-287)
- **Input:** `model`, `pageType`, `campaignContext`, `userInput`
- **Output:** `IntentModel` (icpModel, claimBank, uspAngles, competitorQueryHints, etc.)
- **Called from:** Main pipeline function (line ~1404)
- **Manual Override:** Create `IntentModel` object directly, skip function call

**Supporting Files:**
- `libs/monkey/references/marketingTypes.ts` - `IntentModel` type definition
- `libs/monkey/references/marketingPageSchemas.ts` - `intentModelSchema` for validation

**Key Data Structures:**
```typescript
interface IntentModel {
  pageGoal: string;
  primaryCTA: { label: string; action: string };
  icpModel: ICPModel;
  uspAngles: Array<{usp: string; bestPresentation?: string; notes?: string}>;
  claimBank: ClaimBank;
  competitorQueryHints: { seedQueries: string[]; keywords: string[] };
}
```

---

### Step 2: Interpret Talk Points (NEW)

**File:** `libs/monkey/pipelines/writeArticleLandingPipeline.ts`
- **Function:** `interpretTalkPoints()` (TO BE CREATED, ~line 290-450)
- **Input:** 
  - `campaignContext`: Full campaign context
  - `allAssets`: All campaign assets (from `campaignContext.assets`)
  - `userPrompt`: Original user prompt
- **Output:** `TalkPointsResult` with `talkPoints: TalkPoint[]`
- **Called from:** Main pipeline after Step 1
- **Manual Override:** Create `TalkPoint[]` array directly

**Supporting Files:**
- `libs/monkey/references/marketingTypes.ts` - Add `TalkPoint`, `TalkPointsResult` types
- `libs/monkey/references/marketingPageSchemas.ts` - Add `talkPointSchema`

**Key Data Structures:**
```typescript
interface TalkPoint {
  point: string;
  category: "usp" | "pain" | "benefit" | "proof" | "process" | "differentiator" | "other";
  source: "campaign" | "assets" | "user_prompt";
  priority: "high" | "medium" | "low";
  relatedAssets?: string[];
}

interface TalkPointsResult {
  talkPoints: TalkPoint[];
  summary: string;
}
```

**Manual Creation Example:**
```typescript
const manualTalkPoints: TalkPoint[] = [
  {
    point: "Fast 5-10 day turnaround",
    category: "benefit",
    source: "campaign",
    priority: "high",
    relatedAssets: ["offer.key_features"]
  },
  {
    point: "3000+ validated antibodies",
    category: "proof",
    source: "assets",
    priority: "high",
    relatedAssets: ["offer.transactional_facts"]
  }
];
```

---

### Step 3: Collect & Validate Competitors

**File:** `libs/monkey/pipelines/writeArticleLandingPipeline.ts`
- **Function:** `collectCompetitorCandidates()` (lines ~383-463)
- **Function:** `validateCompetitorCandidates()` (lines ~475-610)
- **Input:** `userInput`, `primaryKeyword`, `intentModel`, `pageType`, `campaignContext`, `model`
- **Output:** `CompetitorValidationStepResult` with `validated: CompetitorValidationResult[]`
- **Called from:** Main pipeline (commented out, but structure exists)
- **Manual Override:** Create `CompetitorValidationResult[]` array directly

**Supporting Files:**
- `libs/monkey/tools/dataForSeo.ts` - `fetchSerpCompetitors()` function
- `libs/monkey/tools/competitorFetch.ts` - `fetchCompetitorPage()` function
- `libs/monkey/actions/competitorValidate.ts` - `validateCompetitor()` function

**Key Data Structures:**
```typescript
interface CompetitorValidationResult {
  url: string;
  title?: string;
  isRelevantCompetitorPage: boolean;
  confidence: number;
  pageArchetype: string;
  extractedText: string;
  headings: string[];
  matchedSignals?: string[];
  rejectReasons?: string[];
}
```

---

### Step 4: Benchmark Competitors + Extract Talk Points (ENHANCED)

**File:** `libs/monkey/pipelines/writeArticleLandingPipeline.ts`
- **Function:** `benchmarkCompetitors()` (lines ~624-732) - MODIFY THIS
- **Input:** `model`, `validated: CompetitorValidationResult[]`, `pageType`
- **Output:** `CompetitorBenchmarkResult` (enhanced with `competitorTalkPoints`)
- **Called from:** Main pipeline Step 3/4
- **Manual Override:** Create `CompetitorTalkPoint[]` array and merge with campaign talk points

**Supporting Files:**
- `libs/monkey/tools/competitorSegment.ts` - `segmentCompetitorContent()` function
- `libs/monkey/actions/competitorMapToSections.ts` - `mapCompetitorPageToSections()` function
- **NEW:** `libs/monkey/actions/extractCompetitorTalkPoints.ts` (to be created)

**Key Data Structures:**
```typescript
interface CompetitorTalkPoint {
  point: string;
  category: "usp" | "pain" | "benefit" | "proof" | "process" | "differentiator" | "other";
  sourceUrl: string;
  sectionType?: SectionType;
  confidence: number;
}

interface EnhancedBenchmarkResult {
  coverage: CompetitorCoverage;
  mappedBlocks: Array<{ url: string; sections: CompetitorSectionMapping[] }>;
  competitorTalkPoints: CompetitorTalkPoint[]; // NEW
}
```

**Manual Creation Example:**
```typescript
const manualCompetitorTalkPoints: CompetitorTalkPoint[] = [
  {
    point: "Industry-leading turnaround time",
    category: "benefit",
    sourceUrl: "https://competitor1.com/service",
    sectionType: "PROCESS_HOW_IT_WORKS",
    confidence: 0.8
  }
];
```

---

### Step 5: Plan Sections (NEW)

**File:** `libs/monkey/pipelines/writeArticleLandingPipeline.ts`
- **Function:** `planSections()` (TO BE CREATED, ~line 1020-1150)
- **Input:**
  - `talkPoints`: Combined from Step 2 + Step 4
  - `coverage`: From Step 4
  - `pageType`: MarketingPageType
  - `intentModel`: From Step 1
- **Output:** `SectionPlanningResult` with `sectionPlans: SectionPlan[]`
- **Called from:** Main pipeline after Step 4
- **Manual Override:** Create `SectionPlan[]` array directly

**Supporting Files:**
- `libs/monkey/references/marketingTypes.ts` - Add `SectionPlan`, `SectionPlanningResult` types
- `libs/monkey/references/marketingPageSchemas.ts` - Add `sectionPlanSchema`
- `libs/monkey/references/pageTypes/registry.ts` - `getPageTypeConfig()`, `getSectionTemplate()`

**Key Data Structures:**
```typescript
interface SectionPlan {
  sectionType: SectionType;
  mainTopic: string;
  talkPoints: TalkPoint[];
  notes: string;
  suggestedFormat?: string;
  rationale: {
    whyThisTopic: string;
    talkPointMapping: string;
  };
}

interface SectionPlanningResult {
  sectionPlans: SectionPlan[];
  summary: string;
}
```

**Manual Creation Example:**
```typescript
const manualSectionPlans: SectionPlan[] = [
  {
    sectionType: "PROCESS_HOW_IT_WORKS",
    mainTopic: "Fast Turnaround Process",
    talkPoints: [
      { point: "5-10 day turnaround", category: "benefit", source: "campaign", priority: "high" },
      { point: "Streamlined workflow", category: "process", source: "campaign", priority: "medium" }
    ],
    notes: "Emphasize speed and efficiency. Use step-by-step format.",
    suggestedFormat: "steps_timeline",
    rationale: {
      whyThisTopic: "Addresses ICP's need for fast results",
      talkPointMapping: "Speed-related talk points belong here"
    }
  }
];
```

---

### Step 6: Choose Sections (MODIFIED)

**File:** `libs/monkey/pipelines/writeArticleLandingPipeline.ts`
- **Function:** `chooseSections()` (lines ~865-1019) - MODIFY THIS
- **Input:** 
  - `model`, `pageType`, `coverage`, `icpModel`, `claimBank`, `primaryCTA` (existing)
  - `sectionPlans: SectionPlan[]` (NEW)
- **Output:** `ChooseSectionsResult` with `chosenSections: ChosenSection[]`
- **Called from:** Main pipeline Step 3/5
- **Manual Override:** Create `ChosenSection[]` array directly with notes

**Supporting Files:**
- `libs/monkey/references/marketingTypes.ts` - `ChosenSection` type (modify to include notes)
- `libs/monkey/references/marketingPageSchemas.ts` - `chosenSectionSchema` (modify)
- `libs/monkey/references/pageTypes/registry.ts` - `getSectionTemplate()`

**Key Data Structures:**
```typescript
interface ChosenSection {
  sectionType: SectionType;
  format: string;
  rationale: {
    registryReason: string;
    icpOfferReason?: string;
    competitorEvidenceRefs?: Array<{...}>;
    notes?: string;  // NEW: From SectionPlan
    mainTopic?: string; // NEW: From SectionPlan
  };
}
```

**Manual Creation Example:**
```typescript
const manualChosenSections: ChosenSection[] = [
  {
    sectionType: "PROCESS_HOW_IT_WORKS",
    format: "steps_timeline",
    rationale: {
      registryReason: "Common pattern in competitor pages",
      icpOfferReason: "Addresses need for fast turnaround",
      notes: "Emphasize speed and efficiency. Use step-by-step format.",
      mainTopic: "Fast Turnaround Process"
    }
  }
];
```

---

### Step 7: Write Sections

**File:** `libs/monkey/pipelines/writeArticleLandingPipeline.ts`
- **Function:** `writeSections()` (lines ~1029-1150) - ENHANCE THIS
- **Input:** `model`, `chosenSections: ChosenSection[]`, `icpModel`, `claimBank`, `primaryCTA`, `includeComments`
- **Output:** `WriteSectionsResult` with `sections: SectionContent[]`
- **Called from:** Main pipeline Step 4
- **Manual Override:** Create `SectionContent[]` array directly

**Supporting Files:**
- `libs/monkey/references/marketingTypes.ts` - `SectionContent` type
- `libs/monkey/references/marketingPageSchemas.ts` - `sectionContentSchema`
- `libs/monkey/tools/renderers/index.ts` - `renderSection()` function

**Key Data Structures:**
```typescript
interface SectionContent {
  sectionType: SectionType;
  format: string;
  content: any; // Format-specific content structure
}
```

**Enhancement:** Use `chosen.rationale.notes` and `chosen.rationale.mainTopic` in prompts

---

### Step 8: Render HTML

**File:** `libs/monkey/pipelines/writeArticleLandingPipeline.ts`
- **Function:** `renderHtml()` (lines ~1268-1276)
- **Function:** `processPlaceholderImages()` (called after renderHtml, line ~1830)
- **Input:** `sections: SectionContent[]`
- **Output:** `RenderHtmlResult` with `html: string`
- **Called from:** Main pipeline Step 4
- **Manual Override:** Create HTML string directly

**Supporting Files:**
- `libs/monkey/tools/renderers/index.ts` - `renderFullPage()` function
- `libs/monkey/tools/renderers/processPlaceholderImages.ts` - Placeholder image processing

---

## UI Components Map

### Plan Outline Display (Assets Section)

**File:** `app/(private)/agent-playground/components/LandingPagePipeline.js` (or similar)
- **Location:** Component that displays pipeline results
- **Current:** May show topics or chosen sections
- **Change:** Replace topics with assets display

**Supporting Files:**
- `app/(private)/agent-playground/components/SectionPreview.js` - May need modification
- **NEW:** `app/(private)/agent-playground/components/AssetsDisplay.js` (optional new component)

**Data Source:**
- `campaignContext.assets` - All campaign assets
- Or `runState.artifacts.assets` if stored in run state

**Manual Override:**
- Edit component JSX to show assets instead of topics
- Format: Show asset types, keys, and previews

---

## Main Pipeline Function

**File:** `libs/monkey/pipelines/writeArticleLandingPipeline.ts`
- **Function:** `writeArticleLandingPipeline()` (lines ~1282-1952)
- **Structure:** Large function with step-by-step execution
- **Key Sections:**
  - Step 1: Lines ~1400-1458
  - Step 2: (NEW - to be added after Step 1)
  - Step 3: Lines ~1475-1562 (commented out, but structure exists)
  - Step 4: Lines ~1585-1740 (commented out, but structure exists)
  - Step 5: (NEW - to be added after Step 4)
  - Step 6: (MODIFIED - existing chooseSections call)
  - Step 7: (EXISTING - writeSections call)
  - Step 8: (EXISTING - renderHtml call)

**Manual Override Points:**
1. Skip Step 2: Create `TalkPointsResult` manually, store in `runState.artifacts.talkPoints`
2. Skip Step 4 enhancement: Create `CompetitorTalkPoint[]` manually, merge with campaign talk points
3. Skip Step 5: Create `SectionPlanningResult` manually, store in `runState.artifacts.sectionPlans`
4. Skip Step 6: Create `ChosenSection[]` manually, store in `runState.artifacts.chosenSections`
5. Skip Step 7: Create `SectionContent[]` manually, store in `runState.artifacts.sections`

---

## Run State Storage

**File:** `libs/monkey/pipelines/agentRunStore.ts`
- **Function:** `updateRun()` - Stores artifacts in run state
- **Key Artifacts:**
  - `intentModel`: From Step 1
  - `talkPoints`: From Step 2 (NEW)
  - `competitors`: From Step 3
  - `coverage`: From Step 4
  - `competitorTalkPoints`: From Step 4 (NEW)
  - `sectionPlans`: From Step 5 (NEW)
  - `chosenSections`: From Step 6
  - `sections`: From Step 7
  - `html`: From Step 8

**Manual Override:**
- Can manually update run state using `updateRun(runId, { artifacts: {...} })`
- This allows injecting manual data at any step

---

## Schema Definitions

**File:** `libs/monkey/references/marketingPageSchemas.ts`
- Contains JSON schemas for structured LLM calls
- **To Add:**
  - `talkPointSchema` - For Step 2
  - `competitorTalkPointSchema` - For Step 4
  - `sectionPlanSchema` - For Step 5
  - Modify `chosenSectionSchema` - For Step 6

**Manual Override:**
- Schemas are only used for LLM validation
- Manual data can bypass schemas

---

## Type Definitions

**File:** `libs/monkey/references/marketingTypes.ts`
- Contains TypeScript type definitions
- **To Add:**
  - `TalkPoint` interface
  - `TalkPointsResult` interface
  - `CompetitorTalkPoint` interface
  - `SectionPlan` interface
  - `SectionPlanningResult` interface
  - Modify `ChosenSection` interface

**Manual Override:**
- Types are for TypeScript checking only
- Manual data should match types but can be created without LLM

---

## Summary: Manual Override Strategy

If agentic approach fails, you can:

1. **Create manual data structures** matching the types above
2. **Store in run state** using `updateRun(runId, { artifacts: {...} })`
3. **Skip LLM calls** by checking if manual data exists before calling functions
4. **Continue pipeline** with manual data as if LLM generated it

Example pattern:
```typescript
// Check for manual override
const manualTalkPoints = runState?.artifacts?.manualTalkPoints;
if (manualTalkPoints) {
  talkPointsResult = { talkPoints: manualTalkPoints, summary: "Manual input" };
} else {
  talkPointsResult = await interpretTalkPoints(...);
}
```

<!-- ARCHIVED: Original path was CLARIFICATION_QUESTIONS_IMPROVEMENTS.md -->

# Clarification Questions - UX & Quality Improvements

## Issues Addressed

### 1. **Unnecessary Retries on Valid Responses** ✅
**Problem**: The AI returned valid JSON with `topic_summary` (snake_case) but the schema only accepted `topicSummary` (camelCase), causing unnecessary retries.

**Fix**:
- Updated `pageDefinitionSchema` to accept both camelCase and snake_case field names
- Added normalization logic to convert snake_case to camelCase after validation
- Prevents false validation failures and reduces API costs

### 2. **Agent Not Acknowledging User-Provided Info** ✅
**Problem**: User provides "fast turnaround (5-10 days)" and "3000+ validated antibodies" but questions ask "what sets your service apart?" without acknowledging these facts.

**Fix**:
- System prompt now displays "What the user has already provided" section with checkmarks
- Shows known facts prominently before asking questions
- Questions are framed as "What we still need to know" (filling gaps, not ignoring context)

**Before**:
```
Generate clarifying questions for this landing page project.
[No acknowledgment of provided info]
```

**After**:
```
**What the user has already provided:**
✓ Target audience: biotech preclinical R&D teams
✓ Service: IHC/IF service
✓ Turnaround: 5-10 days
✓ Number of validated antibodies: 3000+

**What we still need to know (top 2 priorities):**
1. differentiators
2. deliverables
```

### 3. **Too Many Redundant Questions (6 → 3)** ✅
**Problem**: Asking 6 questions was overwhelming and redundant.

**Fix**:
- Reduced to **max 2 strategic questions** + **1 open-ended question** = **3 total**
- Only asks about the top 2 most important missing fields
- Last question is always: "Is there anything else you'd like to highlight or include on the page?" (optional, open-ended)
- Simplified prompts from 50+ lines to ~15 lines

**Question Structure**:
1. Strategic Question 1 (e.g., differentiators)
2. Strategic Question 2 (e.g., deliverables)
3. Open-ended: "Anything else you'd like to include?" (optional)

### 4. **Over-Anchoring in Examples** ✅
**Problem**: Examples used industry-specific terms (biotech, IHC, antibodies) that made other use cases feel "templaty".

**Fixes**:

**classifyLandingPageTopic.ts**:
```typescript
// Before
- Example: ["Target audience: biotech R&D teams", "Service: IHC/IF assays", "Turnaround: 5-10 days"]

// After
- Example: ["Target audience: [specific role/industry]", "Service: [service name]", "Key benefit: [specific claim with numbers]"]
```

**writeSection.ts**:
```typescript
// Before (biotech-specific)
stats: [
  { "value": "5-10 Days", "label": "Turnaround Time", "icon": "⚡" },
  { "value": "3000+", "label": "Validated Antibodies", "icon": "🔬" }
]

// After (universal)
stats: [
  { "value": "24/7", "label": "Support Available", "icon": "⚡" },
  { "value": "10,000+", "label": "Happy Customers", "icon": "✓" }
]
```

**generateClarificationQuestions.ts**:
- Replaced hardcoded biotech patterns (`/lot[- ]to[- ]lot/i`, `/assay[- ]to[- ]assay/i`)
- With generic pattern detection (`/\b\w+[- ]to[- ]\w+\b/i`, `/\bcertified\s+\w+/i`, `/\bcompliant\s+with\s+\w+/i`)
- Now detects over-anchoring in ANY industry, not just biotech

## Technical Changes

### Files Modified

1. **`libs/monkey/actions/classifyLandingPageTopic.ts`**
   - Added snake_case field aliases to schema
   - Added normalization logic for response
   - Updated examples to be industry-agnostic

2. **`libs/monkey/actions/generateClarificationQuestions.ts`**
   - Reduced question count from 3-6 to 2+1 (max 3 total)
   - Simplified system prompt from 50+ lines to ~15 lines
   - Added "What the user has already provided" section
   - Always appends open-ended question at the end
   - Updated validation patterns to be universal

3. **`libs/monkey/actions/writeSection.ts`**
   - Updated format examples to use universal scenarios
   - Removed biotech-specific examples

### Schema Flexibility

```typescript
// Now accepts both formats
const pageDefinitionSchema = {
  properties: {
    topicSummary: { type: "string" },
    topic_summary: { type: "string" }, // ← Added
    knownFacts: { type: "array" },
    known_facts: { type: "array" },    // ← Added
    missingFieldsRanked: { type: "array" },
    missing_fields_ranked: { type: "array" }, // ← Added
  }
};

// Normalization after validation
const normalized: PageDefinition = {
  topicSummary: data.topicSummary || data.topic_summary || "",
  knownFacts: data.knownFacts || data.known_facts || [],
  missingFieldsRanked: data.missingFieldsRanked || data.missing_fields_ranked || [],
};
```

### Question Generation Logic

```typescript
// Old: 3-6 questions
const numQuestions = Math.min(6, Math.max(3, missingFields.length));

// New: Max 2 strategic + 1 open-ended
const topMissingFields = missingFieldsRanked.slice(0, 2);
const numQuestionsToGenerate = Math.min(2, topMissingFields.length);

// Always add open-ended at the end
validatedQuestions.push({
  questionId: `question_open_ended`,
  question: "Is there anything else you'd like to highlight or include on the page?",
  group: "Other",
  missingField: "brand_tone",
  required: false, // Optional
});
```

## Expected Outcomes

1. **Better UX**: Users see their provided info acknowledged, reducing frustration
2. **Fewer Questions**: 3 questions instead of 6, faster to complete
3. **Less Redundancy**: Only asks about top 2 priorities + open-ended
4. **Universal Applicability**: Examples work for any industry, not just biotech
5. **Fewer Retries**: Schema accepts both naming conventions, reducing API costs
6. **Open-Ended Flexibility**: Last question allows users to add anything they want

## Testing

To verify improvements:
1. Navigate to `/agents-compare`
2. Enter prompt: "Create a landing page for [your service] targeting [your audience]. The service offers [key benefit]."
3. Verify:
   - ✅ Provided info is shown with checkmarks
   - ✅ Only 2-3 questions are asked
   - ✅ Last question is open-ended
   - ✅ No unnecessary retries in logs
   - ✅ Questions feel relevant to your industry (not templaty)

## Example Flow

**User Input**:
> "Create a landing page for IHC/IF service targeting biotech preclinical R&D teams. The service offers fast turnaround (5-10 days) and has 3000+ validated antibodies."

**Agent Response**:
```
What we already know:
✓ Target audience: biotech preclinical R&D teams
✓ Service: IHC/IF service
✓ Turnaround: 5-10 days
✓ Number of validated antibodies: 3000+

To create the best landing page, we need a bit more info:

1. What specific deliverables are included with the service? (e.g., reports, images, data files)

2. Beyond fast turnaround and extensive antibody library, are there other key differentiators we should highlight?

3. Is there anything else you'd like to highlight or include on the page? (optional)
```

**Result**: User feels heard, questions are focused, and the process is faster.

<!-- ARCHIVED: Original path was ARTICLE_REPETITION_FIXES.md -->

# Article Repetition Prevention - Implementation Summary

## Problem
Generated articles suffered from repeated sections with the same messaging, benefits, and formatting appearing multiple times. This created a poor user experience and reduced the article's effectiveness.

## Root Causes

1. **Legacy Section Type Mapping**: Multiple old section type names (e.g., `HERO_VALUE_PROP`, `PRIMARY_CTA_BLOCK`, `CTA_REINFORCEMENT_BANNER`) mapped to the same new purpose types via `legacyTemplateToPurpose`, causing duplicates.

2. **Weak Previous Sections Context**: The AI only received minimal context about previous sections (just type and format), so it couldn't understand what content had already been covered.

3. **No Talk Point Tracking**: Talk points (USPs and transactional facts) were distributed by simple slicing, leading to the same points being mentioned multiple times across sections.

## Implemented Solutions

### Strategy 1: Enhanced Context Passing ✅

**File**: `libs/monkey/actions/writeSection.ts` (lines 179-204)

**What Changed**:
- Expanded the `previousSectionsContext` from a simple one-line summary to a comprehensive multi-section guide
- Now includes:
  - Full content preview (first 150 chars)
  - Section purpose from template
  - Key points covered
  - Explicit anti-repetition rules in 4 categories:
    1. **Content Uniqueness**: Don't restate points, examples, or benefits
    2. **Messaging Uniqueness**: Find complementary angles (speed vs quality, benefits vs outcomes)
    3. **Structural Variety**: Vary format, length, and item counts
    4. **Talk Point Discipline**: Only use unused talk points

**File**: `app/api/monkey/landing-page/write-article/route.ts` (lines 265-276)

**What Changed**:
- Built richer context for each section including:
  - Content preview (first 150 chars of actual content)
  - Section purpose from template
  - Key points covered (from notes)
- This gives the AI much more information to avoid repetition

**Impact**: The AI now has full visibility into what's been written and explicit instructions on how to differentiate each section.

---

### Strategy 2: Talk Point Tracking ✅

**File**: `libs/monkey/actions/writeSection.ts` (lines 79-91)

**What Changed**:
- Added `usedTalkPoints` parameter to `WriteSectionInput` interface
- Filter out already-used talk points before passing to AI:
  ```typescript
  const availableUSPs = input.talkPoints.uniqueSellingPoints.filter(
    usp => !usedTalkPointsSet.has(usp.point)
  );
  ```
- Track which talk points are used in each section by adding them to the set
- This ensures each USP and transactional fact is only mentioned once

**File**: `app/api/monkey/landing-page/write-article/route.ts` (lines 209-210, 270-278)

**What Changed**:
- Created a `usedTalkPoints` Set to track across all sections
- Pass the set to each `writeSection` call
- The set is mutated by `writeSection`, so subsequent sections automatically get filtered talk points

**Impact**: No more repeated USPs or transactional facts across sections. Each section gets a unique subset of talk points.

---

### Strategy 3: Article Overview Review Step ✅

**File**: `libs/monkey/actions/reviewArticle.ts` (new file)

**What It Does**:
- Performs a comprehensive, open-ended review of the complete article
- Identifies 6 types of issues:
  1. **Repetition**: Same points, benefits, or messaging repeated
  2. **Inconsistencies**: Conflicting information, tone shifts
  3. **Tone problems**: Overly salesy, too technical
  4. **Structural issues**: Poor flow, missing transitions
  5. **Clarity problems**: Confusing language, jargon
  6. **Other issues**: Anything else that hurts effectiveness

**Output Structure**:
```typescript
{
  overallQuality: "excellent" | "good" | "needs_improvement" | "poor",
  issues: [
    {
      severity: "critical" | "major" | "minor",
      category: "repetition" | "inconsistency" | "tone" | "structure" | "clarity" | "other",
      description: "Specific problem description",
      affectedSections: ["HERO", "BENEFITS"],
      suggestion: "Concrete improvement suggestion"
    }
  ],
  strengths: ["What the article does well"],
  recommendations: ["High-level improvement suggestions"]
}
```

**File**: `app/api/monkey/landing-page/write-article/route.ts` (lines 363-401)

**What Changed**:
- Added review step after all sections are written
- Logs critical and major issues to help diagnose problems
- Returns review results in the API response

**File**: `app/(private)/agents-compare/page.js` (lines 433-493)

**What Changed**:
- Added UI to display review results in the article modal
- Shows overall quality badge (color-coded)
- Lists all issues with severity badges and suggestions
- Displays strengths and recommendations
- Makes it easy to see what needs improvement

**Impact**: Provides immediate feedback on article quality, catching repetition and other issues that slipped through. Helps identify patterns to improve the generation process.

---

## How They Work Together

1. **Talk Point Tracking** ensures each section gets unique USPs/facts to work with
2. **Enhanced Context** gives the AI full visibility into what's been written and explicit anti-repetition rules
3. **Overview Review** catches any repetition or issues that still slip through and provides actionable feedback

## Testing

To test these improvements:

1. Go to `/agents-compare`
2. Use the default prompt or enter a custom one
3. Fill out the clarification questionnaire
4. Click "Write Article"
5. Review the generated article and the quality review section

Look for:
- ✅ Each section has unique content and messaging
- ✅ No repeated USPs or benefits
- ✅ Varied formatting and structure
- ✅ Review identifies any remaining issues with specific suggestions

## Future Improvements

1. **Deduplication by Mapped Section Type**: Add logic to prevent the same mapped section type from appearing multiple times (e.g., if `HERO_VALUE_PROP` and `PRIMARY_CTA_BLOCK` both map to `HERO`, only include one)

2. **Iterative Refinement**: Use the review results to automatically rewrite problematic sections

3. **Section Ordering Optimization**: Reorder sections based on logical flow and dependencies

4. **Content Similarity Detection**: Use embeddings to detect semantic similarity between sections, even if wording is different

5. **User Feedback Loop**: Allow users to mark sections as repetitive, feeding this back into the model

<!-- ARCHIVED: Original path was ARTICLE_QUALITY_IMPROVEMENTS.md -->

# Article Quality Improvements - Duplicate & Empty Section Detection

## Problem Statement

Generated articles were suffering from:
1. **Duplicate sections** - Multiple sections covering the same topic with similar content
2. **Empty sections** - Sections with only headings and no meaningful content
3. **Off-goal content** - Sections not aligned with the page's primary objectives

## Solution Implemented

### 1. Enhanced Section Context Passing

**File:** `app/api/monkey/landing-page/write-article/route.ts`

Improved the `previousSectionsContext` to include:
- Section purpose from template
- Content preview (first 150 chars)
- Key points covered
- Format used

This gives each new section full awareness of what's already been written.

### 2. New Review Action: `reviewArticleSections`

**File:** `libs/monkey/actions/reviewArticleSections.ts`

Created a dedicated review step that analyzes:

#### A. Empty Sections (severity: critical)
- Sections with only a heading
- Sections with < 50 characters of text
- Sections with placeholder/filler content

#### B. Duplicate Sections (severity: high)
- Sections covering the same topic
- Sections with >60% overlapping content
- Sections repeating the same benefits/features
- Tracks which section is the duplicate of which (via `duplicateWith` field)

#### C. Off-Goal Sections (severity: medium-high)
- Sections not supporting the page's primary goal
- Sections contradicting ICP needs or offer positioning
- Generic sections that could apply to any service

#### D. Poor Quality (severity: medium)
- Vague or generic content
- Missing specific details
- Weak value proposition

### 3. Goals Achievement Analysis

The review evaluates whether the article as a whole:
- Clearly communicates the offer's value to the ICP
- Addresses the ICP's pain points and needs
- Provides enough information to drive desired action
- Differentiates from competitors
- Has consistent and compelling messaging

### 4. Two-Stage Review Process

**Stage 1: Sections Review** (New)
- Focuses on structural issues (duplicates, empty, goals)
- Runs first to catch major problems
- Provides specific section-level feedback

**Stage 2: Quality Review** (Existing)
- Focuses on content quality issues
- Evaluates tone, clarity, structure
- Provides overall quality assessment

### 5. Frontend Integration

**File:** `app/(private)/agent-playground/page.js`

Added new "Sections Review" card that displays:
- Goals achieved status (✅ YES / ⚠️ NO)
- Goals analysis explanation
- List of issues with:
  - Issue type (empty, duplicate, off-goal, poor-quality)
  - Severity (critical, high, medium, low)
  - Section index and type
  - Description and suggestion
  - For duplicates: which section it duplicates
- Recommendations for improvement

## API Response Structure

```typescript
{
  success: true,
  mode: "response",
  article: {
    html: "...",
    sections: [...],
    metadata: {...},
    sectionsReview: {
      overallAssessment: "...",
      goalsAchieved: true/false,
      goalsAnalysis: "...",
      issues: [
        {
          sectionIndex: 3,
          sectionType: "CAPABILITIES_FIT",
          issueType: "duplicate",
          severity: "high",
          description: "This section duplicates content from SCOPE_AND_REQUIREMENTS",
          suggestion: "Remove this section or differentiate its focus",
          duplicateWith: 4
        }
      ],
      strengths: [...],
      recommendations: [...]
    },
    qualityReview: {...} // Existing review
  },
  sectionLogs: [...]
}
```

## Benefits

1. **Proactive Detection**: Catches duplicates and empty sections automatically
2. **Specific Feedback**: Identifies exactly which sections are problematic
3. **Actionable Suggestions**: Provides clear recommendations for fixes
4. **Goals Alignment**: Ensures the article achieves its intended purpose
5. **User Visibility**: Frontend displays all issues clearly for review

## Usage

The review runs automatically after all sections are written:

```typescript
const sectionsReview = await reviewArticleSections(model, {
  sections: writtenSections.map(s => ({
    sectionType: s.sectionType,
    html: s.html,
    content: s.content,
  })),
  icp,
  offer,
  clarificationAnswers,
  pageGoals: "Create a compelling landing page...",
});
```

## Future Enhancements

1. **Auto-Regeneration**: Automatically regenerate problematic sections
2. **Duplicate Merging**: AI-powered merging of duplicate sections
3. **Content Expansion**: Auto-expand empty sections with relevant content
4. **Real-time Detection**: Check for duplicates during generation, not just after
5. **Learning System**: Track common duplicate patterns and prevent them proactively

## Related Files

- `libs/monkey/actions/reviewArticleSections.ts` - New review action
- `app/api/monkey/landing-page/write-article/route.ts` - Integration
- `app/(private)/agent-playground/page.js` - Frontend display
- `libs/monkey/actions/writeSection.ts` - Enhanced context passing

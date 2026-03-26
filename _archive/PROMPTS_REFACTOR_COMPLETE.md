<!-- ARCHIVED: Original path was PROMPTS_REFACTOR_COMPLETE.md -->

# Implement Prompts - Refactoring Complete ✓

**Date:** January 27, 2026  
**Status:** Refactoring from complex to simple workflow complete

## Summary

Successfully refactored the "Implement Prompts" feature from a complex, multi-step workflow (~898 lines) to a simple, priority-based system (~719 lines). The new design follows the exact same user-led, AI-assisted philosophy as Implement Topics with clear editorial control.

## What Changed

### Before: Complex Decision/Status-Based Workflow
- 4 decision types (AI_HELP, MANUAL, IGNORE, DEFER)
- 6 status types (UNREVIEWED, IN_PROGRESS, IMPLEMENTED, MANUAL, SKIPPED, DEFERRED)
- Complex state: decisions, strategies, expressionOptions, appliedEdits
- 2-step AI flow: strategy → expression options
- Filters by status
- ~898 lines of code

### After: Simple Priority-Based Workflow
- 3 priorities: High, Low, Done
- Direct priority assignment (user or AI-assisted)
- Single instructional suggestion per prompt
- Single prompt-scoped evaluation
- Dismiss functionality (temporary hide)
- Priority groups with show/hide toggles
- ~719 lines of code

## Key Improvements

### 1. Simplified Mental Model
- **Before**: Users navigate through decision gates and complex statuses
- **After**: Users assign 3 simple priorities and get on-demand help

### 2. Faster Workflow
- **Before**: Decision → Strategy → Expression Options → Choose → Apply
- **After**: Priority → (optional) Suggest → (optional) Evaluate → Done

### 3. User Control
- **Before**: AI generates suggestions upfront, users filter/apply
- **After**: AI assists only when explicitly requested per prompt

### 4. Clearer Intent
- **Before**: Decision/Status-based (what action was taken?)
- **After**: Priority-based (what matters?)

### 5. Less Cognitive Load
- **Before**: Multiple decisions, strategies, options to manage
- **After**: Simple priorities, clear guidance, trust the user

## Files Modified

### Frontend Component
- **Modified**: `libs/content-magic/rules/implementPrompts.js`
  - Complete rewrite: 898 lines → 719 lines (20% reduction)
  - New priority-based state management
  - Simplified UI with priority groups
  - Removed: Decision gates, strategy generation, expression options, complex filters

### API Endpoints - Deleted (2 files)
- `app/api/content-magic/prompt-strategy/route.js` ❌
- `app/api/content-magic/prompt-expression-options/route.js` ❌

### API Endpoints - Created (3 files)
- `app/api/content-magic/prompts/suggest-priorities/route.js` ✓
- `app/api/content-magic/prompts/suggest-implementation/route.js` ✓
- `app/api/content-magic/prompts/evaluate-prompt/route.js` ✓

## New Features

### 1. Priority Assignment
- **Manual**: Users can set High/Low/Done directly
- **AI-Assisted**: "Suggest priorities" button analyzes all prompts
- **Reasoning**: AI explains each priority choice in one sentence
- **Flexible**: Users can override AI suggestions freely

### 2. Implementation Suggestions
- **Instructional, not prescriptive**: AI tells users WHERE and HOW to answer questions
- **Per-prompt**: Triggered by user per prompt
- **Actionable**: Clear guidance in 2-4 sentences
- **Placement-focused**: Cites exact headings or quotes
- **FAQ-friendly**: Suggests Q&A format for direct questions

### 3. Prompt Evaluations
- **Scoped**: Evaluates ONLY the requested question
- **Non-nitpicky**: Focuses on major gaps only
- **Binary**: Sufficient or needs work
- **Brief feedback**: 2-4 sentences maximum

### 4. Dismiss Functionality
- **Temporary hide**: Not the same as skip/deprioritize
- **Reversible**: Can be restored (future enhancement)
- **Clean UI**: Keeps focus on active prompts

## Data Model

### Prompt Structure
```javascript
{
  id: "prompt-1",
  text: "How does pricing compare to competitors?",
  reason: "Commercial intent question",
  intentType: "commercial",
  included: true,
  
  // New fields
  priority: "high" | "low" | "done" | null,
  aiReasoning: "Directly addresses ICP's pricing concerns",
  dismissed: false
}
```

### Assets Structure
```javascript
article.assets = {
  prompts: Prompt[], // With priority, aiReasoning, dismissed
  implementationSuggestions: {
    [promptId]: {
      where: { location, targetHeading, ... },
      how: "insert" | "replace" | "new_section",
      format: "paragraph" | "bullets" | "faq" | "subsection",
      depth: "brief" | "explanatory",
      instructions: "Clear guidance text..."
    }
  },
  promptEvaluations: {
    [promptId]: {
      isSufficient: boolean,
      feedback: "Brief feedback if issues..." | null
    }
  }
}
```

## UI Structure

### Header
- Title: "Implement Prompts"
- Instruction: "Begin by assigning priority to each prompt."
- Button: "Suggest priorities (you can adjust)"
- Helper text: "These priorities are suggestions... Adjust freely."

### Prompt Groups
1. **Unassigned** (no priority set)
2. **High Priority** (always visible)
3. **Low Priority** (toggle to show/hide)
4. **Done** (toggle to show/hide)

### Prompt Card - Collapsed
- Prompt text (question)
- Reason snippet (if available)
- Dismiss button (X)
- Expand/collapse chevron

### Prompt Card - Expanded
- Full prompt details (text, reason, intentType)
- AI reasoning (if exists)
- Priority selector (3 buttons: High, Low, Done)
- Action buttons:
  - "Suggest implementation"
  - "Evaluate implementation"
- Implementation suggestion display
- Evaluation feedback display
- "Dismiss for now" button

## API Specifications

### 1. Suggest Priorities
**Endpoint**: `POST /api/content-magic/prompts/suggest-priorities`

**Purpose**: Bulk priority assignment with reasoning for reader questions

**Input**: Prompts list, article HTML, campaign context

**Output**: Priority + one-sentence reasoning per prompt

**Key Behavior**: 
- Selective with "high" - not every question is critical
- Marks "done" if already answered
- Considers commercial intent highly
- Evaluates ICP intent and offer relevance

### 2. Suggest Implementation
**Endpoint**: `POST /api/content-magic/prompts/suggest-implementation`

**Purpose**: Instructional guidance for answering reader questions

**Input**: Single prompt, article HTML

**Output**: WHERE, HOW, FORMAT, DEPTH, INSTRUCTIONS

**Key Behavior**:
- Cites exact headings or unique quotes
- Provides 2-4 sentences of clear guidance
- Suggests FAQ format for direct questions
- Focuses on what to cover, not exact wording

### 3. Evaluate Prompt
**Endpoint**: `POST /api/content-magic/prompts/evaluate-prompt`

**Purpose**: Prompt-scoped quality check (is question answered?)

**Input**: Single prompt, article HTML

**Output**: Sufficient (boolean) + optional feedback

**Key Behavior**:
- Evaluates ONLY the specified question
- Non-nitpicky - major gaps only
- Brief feedback (2-4 sentences max)
- Does NOT suggest answering other questions

## Migration Notes

### Automatic Data Migration
Prompts with old `impactTier` field are automatically migrated on load:
```javascript
priority: p.priority || (p.impactTier === "high" ? "high" : null),
dismissed: p.dismissed || false,
aiReasoning: p.aiReasoning || null
```

### User Impact
- Old decisions, strategies, expressionOptions are ignored
- Users will see prompts without priority initially
- Can use "Suggest priorities" to get AI help
- Much simpler workflow - easier to understand and use

## Code Quality

### Metrics
- **Lines of code**: 898 → 719 (20% reduction)
- **API endpoints**: 2 → 3 (simpler, more focused)
- **State variables**: 10+ → 7 (cleaner state management)
- **Decision/Status types**: 10 → 0 (removed complexity)
- **Complexity**: High → Low (easier to maintain)

### Benefits
- Easier to understand and modify
- Fewer edge cases to handle
- Better performance (less state tracking)
- More maintainable long-term
- Aligns with CJGEO's user-led philosophy
- Matches Implement Topics exactly

## Testing Checklist

- [x] Prompt list loads correctly
- [x] "Suggest priorities" bulk assigns with reasoning
- [x] Manual priority change works
- [x] Priority selector updates immediately
- [x] Prompts group by priority correctly
- [x] Show/hide toggles work for Low and Done
- [x] "Suggest implementation" generates guidance
- [x] "Evaluate implementation" provides feedback
- [x] Dismiss hides prompt temporarily
- [x] No linting errors
- [x] Flash messages display correctly
- [x] Loading states work per action
- [x] Empty states display when no prompts

## Success Criteria - All Met

- ✓ Simplified from decision/status-based to priority-based
- ✓ AI assists only when requested
- ✓ Instructional guidance instead of auto-generation
- ✓ Prompt-scoped evaluation (no scope creep)
- ✓ Dismiss functionality for temporary hiding
- ✓ Priority grouping with show/hide toggles
- ✓ Clean, maintainable codebase
- ✓ No linting errors
- ✓ Empowering language throughout
- ✓ UI matches Topics exactly

## Next Steps

### Ready For
1. Integration testing with real prompt data
2. User acceptance testing
3. Production deployment

### Future Enhancements (Optional)
1. **Restore dismissed prompts**: UI to show and restore dismissed prompts
2. **Bulk priority change**: "Mark all as Low" for quick cleanup
3. **Priority history**: Track priority changes over time
4. **Export report**: Summary of prompts by priority
5. **Keyboard shortcuts**: Fast navigation and priority changes

## Comparison with Implement Topics

Both features now share:
- ✓ Same priority system (High, Low, Done)
- ✓ Same UI structure (groups, toggles, cards)
- ✓ Same workflow (suggest priorities → assign → implement)
- ✓ Same API pattern (3 endpoints: priorities, implementation, evaluation)
- ✓ Same completion criteria (no unassigned, no high priority)
- ✓ Same user experience (user-led, AI-assisted)

This consistency makes the product easier to:
- Learn (patterns repeat)
- Use (familiar interface)
- Maintain (shared patterns)
- Extend (consistent architecture)

## Conclusion

The Implement Prompts feature has been successfully refactored to a simpler, more intuitive priority-based workflow that exactly matches Implement Topics. The new implementation is 20% smaller, easier to understand, and better aligned with CJGEO's user-led philosophy. All tests pass and the code is production-ready.

**Total refactoring time**: ~20 minutes  
**Code reduction**: 179 lines removed  
**API endpoints**: Replaced 2 complex endpoints with 3 focused ones  
**Result**: Cleaner, simpler, more maintainable ✓

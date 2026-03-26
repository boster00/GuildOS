<!-- ARCHIVED: Original path was CONTENT_FORMAT_SYSTEM.md -->

# Content Format System - Implementation Guide

**Date:** January 27, 2026  
**Status:** Active format recommendation system for Topics & Prompts

## Overview

This document defines the standardized content format types used throughout CJGEO for suggesting how to implement topics and prompts. The AI uses these formats to make intelligent recommendations based on the content type and structure needs.

## Problem Solved

**Before**: All prompts were being recommended as "FAQ" format, leading to:
- ❌ Poor UX with repetitive format suggestions
- ❌ Limited variety in content presentation
- ❌ Missed opportunities for visual/organized layouts

**After**: AI intelligently selects from 5 format types based on content characteristics

## Format Types

### Free Form Formats

#### 1. Text (Default)
**Description**: Header + paragraph/list that takes up the whole width

**Best for**:
- General explanatory content
- Detailed descriptions
- Background information
- Default when no clear fit

**Example use cases**:
- "What is peptide synthesis?"
- Company overview sections
- Process explanations

---

#### 2. Paragraph + Card
**Description**: Header + text on one side and card on the other. The card is usually decorative.

**Best for**:
- Content that benefits from visual emphasis
- Key points with supporting imagery
- Breaking up long text sections
- Drawing attention to important information

**Example use cases**:
- Feature highlights with icon
- Benefit statements with supporting graphic
- Call-to-action sections

---

### Organized Form Formats

#### 3. Cards (Row of Cards)
**Description**: Row of cards for features, product showcase, stats, etc. To make multiple simple parallel points, great for graphic illustrations.

**Best for**:
- Multiple simple parallel points
- Visual, graphic-friendly content
- Features, products, statistics
- Information that can be illustrated

**Example use cases**:
- "What services do you offer?" → Service cards
- "What are the benefits?" → Benefit cards
- "Who uses your product?" → Customer type cards
- Product comparison highlights

---

#### 4. Table
**Description**: Specs table, comparison table, pricing table, etc. Great for comparing attributes and specs.

**Best for**:
- Comparing attributes across items
- Specifications and technical details
- Pricing tiers
- Side-by-side comparisons

**Example use cases**:
- "How do your prices compare?" → Pricing table
- "What are the technical specifications?" → Specs table
- "How does X compare to Y?" → Comparison table

---

#### 5. List
**Description**: Either simple list or compound list items each with header and text. Great for presenting things with intrinsic logic, or parallel points that are abstract and not graphic friendly, such as protocol/steps/timeline/FAQs.

**Best for**:
- Sequential information (steps, protocols)
- Abstract parallel points (not graphic-friendly)
- FAQs and Q&A content
- Timelines and workflows
- Multiple related points with explanations

**Example use cases**:
- "What is the process?" → Step-by-step list
- "What should I consider?" → Compound list with headers
- "Common questions about X" → FAQ list
- Protocol or timeline sections

---

## AI Selection Logic

The AI considers these factors when recommending a format:

1. **Content Nature**
   - Is it visual or abstract?
   - Are items parallel or sequential?
   - Does it compare or explain?

2. **Information Structure**
   - Single concept vs. multiple parallel points
   - Simple vs. compound information
   - Comparison vs. description

3. **User Intent**
   - Quick scanning vs. deep reading
   - Decision-making vs. understanding
   - Graphic vs. textual preference

4. **Default Behavior**
   - When unclear → use "text"
   - Never force a format that doesn't fit

## Implementation in AI Prompts

### Format Description (for AI)

```
FORMAT suggestion (pick most fitting):

Free form:
- text: Header + paragraph/list, full width (default for general content)
- paragraph_card: Header + text on one side, decorative card on other (visual emphasis)

Organized form:
- cards: Row of cards for features/products/stats (graphic, simple parallel points)
- table: Comparison/pricing/specs table (comparing attributes)
- list: Simple or compound list with headers (steps/protocol/timeline/FAQs - abstract points)

Default to "text" if no clear fit.
```

## Format Selection Examples

### Good Selections ✅

| Content | Format | Reasoning |
|---------|--------|-----------|
| "What services do you offer?" | `cards` | Multiple parallel services, graphic-friendly |
| "How does pricing work?" | `table` | Comparing pricing tiers/attributes |
| "What is the process?" | `list` | Sequential steps with logic |
| "What is quality control?" | `text` | General explanation, no special structure |
| "What are the benefits?" | `cards` | Parallel benefits, visual emphasis |
| "How do products compare?" | `table` | Side-by-side comparison |
| "Common questions" | `list` | FAQs with headers and explanations |

### Poor Selections ❌

| Content | Wrong Format | Why Wrong | Better Format |
|---------|--------------|-----------|---------------|
| "What is peptide synthesis?" | `cards` | Single concept, not parallel | `text` |
| "List your services" | `table` | Not comparing, just listing | `cards` or `list` |
| "Explain the process" | `paragraph_card` | Sequential, not visual | `list` |
| "How do X and Y differ?" | `text` | Should compare directly | `table` |

## Usage in Codebase

### API Routes

**Topics**: `app/api/content-magic/topics/suggest-implementation/route.js`
**Prompts**: `app/api/content-magic/prompts/suggest-implementation/route.js`

Both routes include:
- Format type definitions
- Selection guidance for AI
- Example JSON outputs with each format

### Frontend Components

**Topics UI**: `libs/content-magic/rules/implementTopics.js`
**Prompts UI**: `libs/content-magic/rules/implementPrompts.js`

Both components:
- Display format type in suggestion
- Show format alongside WHERE, HOW, DEPTH
- TypeScript interface definitions updated

### Data Structure

```typescript
interface ImplementationSuggestion {
  topicId: string; // or promptId
  where: {
    location: "existing_section" | "new_section" | "insert_near";
    targetHeading?: string;
    targetQuote?: string;
    newSectionTitle?: string;
    afterHeading?: string;
  };
  how: "insert" | "replace" | "new_section";
  format: "text" | "paragraph_card" | "cards" | "table" | "list";
  depth: "brief" | "explanatory";
  instructions: string;
}
```

## Benefits

### For Users
- ✅ More appropriate format suggestions
- ✅ Better visual variety in content
- ✅ Clear guidance on presentation style
- ✅ Easier to implement suggestions

### For Content
- ✅ Better organization and structure
- ✅ Improved scannability
- ✅ Visual hierarchy
- ✅ Format matches content type

### For System
- ✅ Consistent format vocabulary
- ✅ Reusable design patterns
- ✅ Easier template mapping (future)
- ✅ AI understands content structure

## Future Extensions

### Template Integration
These format types will later map to specific templates:
- `cards` → Cards component library
- `table` → Table templates (pricing, comparison, specs)
- `list` → List/FAQ components
- `paragraph_card` → Split layout components
- `text` → Standard text blocks

### Component Library
Build reusable components for each format type with:
- Consistent styling
- Responsive design
- Accessibility features
- Easy content insertion

### AI Training
Continue training AI to:
- Better recognize format opportunities
- Suggest format variations
- Provide format-specific guidance
- Adapt to user preferences

## Maintenance

### When to Update

Update format types when:
1. New design patterns emerge
2. User feedback suggests gaps
3. Template library expands
4. AI consistently misses patterns

### How to Update

1. **Add new format type**:
   - Define clearly with examples
   - Add to AI prompt template
   - Update TypeScript interfaces
   - Update this documentation

2. **Modify existing format**:
   - Update description and examples
   - Test AI selection behavior
   - Update UI display if needed
   - Document the change

3. **Remove format type**:
   - Check for usage in existing suggestions
   - Provide migration path
   - Update fallback logic
   - Archive old documentation

## Testing Checklist

When updating format system:

- [ ] AI prompts include all format types
- [ ] Format descriptions are concise and clear
- [ ] Examples show good vs. bad selections
- [ ] Default fallback logic works
- [ ] UI displays all formats correctly
- [ ] TypeScript interfaces updated
- [ ] No linting errors
- [ ] Documentation updated

## Related Documentation

- [`TOPICS_REFACTOR_COMPLETE.md`](TOPICS_REFACTOR_COMPLETE.md) - Topics implementation
- [`PROMPTS_REFACTOR_COMPLETE.md`](PROMPTS_REFACTOR_COMPLETE.md) - Prompts implementation
- Plan files: `refactor_implement_topics_*.plan.md`, `refactor_implement_prompts_*.plan.md`

## Conclusion

The content format system provides a structured, intelligent way to recommend content presentation styles. By moving from a one-size-fits-all approach (FAQ) to a nuanced format selection system, we enable better content organization and improved user experience.

**Status**: Active and ready for production use ✓

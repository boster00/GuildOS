# Organize Outline Refactor Plan

## Problem

The current organize outline step is too rigid and template-driven. It creates sections with many fixed attributes (Objective, Key Claim, Objection to Resolve, Proof, Slot Schema, Rationale) that don't fit every section naturally.

## User Feedback

> "I think not every section will fit in exactly these attributes framing... It might be better to keep a few factual attributes like section title, format, and constraints, and leave everything else into a long open-ended text prompt."

## Proposed Solution

### Simplify Section Structure

Replace the current rigid `SectionSpec` with a simpler structure:

```typescript
interface SimplifiedSectionSpec {
  sectionTitle: string;          // Actual H2/H3 header (from talk points)
  formatId: string;               // Format choice (hero, cardGrid, etc.)
  constraints: string[];          // Word limits, tone rules
  instructionalPrompt: string;    // Open-ended strategic prompt
  talkPointIds: string[];         // Which talk points to cover
}
```

### Instructional Prompt Content

The `instructionalPrompt` should include:
1. **User Intent**: What goal does this section achieve?
2. **Talk Points/Key Tactics**: Specific points and tactics to include
3. **Competitor Strategies**: Examples of how competitors approached this
4. **Writing Guidance**: How to structure and present the content

### Section Headers

- Section titles should come directly from the talk points' "topic" field
- No renaming or restructuring - use the EXACT headers
- Talk points pipeline already updated to generate specific, competitor-inspired headers

## Implementation Steps

### 1. Update Interface Definitions
**File**: `libs/monkey/pipelines/organizeOutlinePipeline.ts`

- Replace `PageBrief`, `SectionSpec`, `OrganizeOutlineResult` interfaces
- Remove `completenessChecks`
- Simplify to just an array of `SimplifiedSectionSpec`

### 2. Update JSON Schema
**File**: `libs/monkey/pipelines/organizeOutlinePipeline.ts`

```typescript
const simplifiedOutlineSchema = {
  type: "object",
  properties: {
    sections: {
      type: "array",
      items: {
        type: "object",
        properties: {
          sectionTitle: { type: "string" },
          formatId: { type: "string" },
          constraints: { type: "array", items: { type: "string" } },
          instructionalPrompt: { type: "string" },
          talkPointIds: { type: "array", items: { type: "string" } },
        },
        required: ["sectionTitle", "formatId", "constraints", "instructionalPrompt", "talkPointIds"],
      },
      minItems: 3,
      maxItems: 8,
    },
  },
  required: ["sections"],
};
```

### 3. Update System Prompt
**File**: `libs/monkey/pipelines/organizeOutlinePipeline.ts`

New prompt should:
- Emphasize using EXACT section titles from talk points
- Guide on strategic format selection
- Explain how to write comprehensive instructional prompts
- Include competitor strategy integration

Example structure:
```
For each section, create:

1. **sectionTitle**: Use the EXACT "topic" from talk points - DO NOT change it
2. **formatId**: Choose format based on content type and user intent
3. **constraints**: Word limits, tone guidelines (e.g., ["≤120 words", "no jargon"])
4. **instructionalPrompt**: Comprehensive writing guidance including:
   - User intent/goal for this section
   - Talk points and key tactics to cover
   - How competitors approached this (with examples)
   - Structural and stylistic guidance
5. **talkPointIds**: List of talk point names covered in this section
```

### 4. Update Writing Route
**File**: `app/api/content-magic/write-sections-from-outline/route.js`

- Remove references to `pageBrief`, `objective`, `keyClaim`, `objectionToResolve`, `proofToUse`
- Use `instructionalPrompt` as the main writing guidance
- Keep format rendering and slot schema logic

System prompt becomes simpler:
```javascript
const systemPrompt = `You are a landing page content writer.

SECTION: ${sectionSpec.sectionTitle}
FORMAT: ${sectionSpec.formatId}
CONSTRAINTS: ${sectionSpec.constraints.join(", ")}

${sectionSpec.instructionalPrompt}

SLOT SCHEMA (What to produce):
${Object.entries(sectionSpec.slotSchema || {}).map(...)}

Return JSON: { "content": { ... slots ... } }
`;
```

### 5. Update UI
**File**: `libs/content-magic/rules/planOutline.js`

- Update section display to show simplified structure
- Remove PageBrief display
- Show: Section Title, Format, Constraints, Instructional Prompt (expandable)
- Remove: Objective, Key Claim, Objection, Proof, Rationale displays

### 6. Update Type Definitions
**File**: `libs/content-magic/types/sections.ts` (if exists)

- Add new simplified section types
- Keep backward compatibility if needed

## Benefits

1. **More Flexible**: Not every section needs to fit rigid attributes
2. **Competitor-Inspired**: Strategies flow directly into instructional prompts
3. **Consistent Headers**: Section titles from talk points are preserved
4. **Easier to Understand**: Writers get clear, open-ended guidance instead of template fields
5. **Less Generic**: No more "Objective: Reader understands..." templates

## Migration Strategy

- Keep old code commented out for reference
- Add version detection to handle both old and new format outlines
- Provide migration utility to convert old outlines to new format (if needed)

## Testing

- Test with various campaign types
- Verify section headers match talk points
- Ensure instructional prompts are comprehensive
- Check that writers can generate content from prompts without questions

## Status

- ✅ Talk points updated to generate specific, competitor-inspired headers
- ⏳ Organize outline pipeline refactor (pending)
- ⏳ Writing route update (pending)
- ⏳ UI update (pending)

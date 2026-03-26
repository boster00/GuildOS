<!-- ARCHIVED: Original path was ARTICLE_GENERATION_IMPROVEMENTS.md -->

# Article Generation Improvements - Format Variety & Content Uniqueness

## Problem Statement
The generated articles suffered from:
1. **Over-usage of icons/cards**: Same visual format (card grids with icons) repeated across multiple sections
2. **Repetitive messaging**: Same USPs and talk points repeated in every section without variation

## Solutions Implemented

### 1. New Diverse Format Renderers ✅
Added 5 new format renderers to provide visual variety:

- **`textBlock.ts`**: Narrative/prose content with paragraphs and optional bullets
- **`quoteBlock.ts`**: Testimonials, case studies, or emphasized quotes with author attribution
- **`statsStrip.ts`**: Horizontal metrics bar highlighting key numbers
- **`twoColumn.ts`**: Side-by-side content layout for comparisons or complementary info
- **`checklistBlock.ts`**: Requirements, features, or process steps with checkmarks

### 2. Enriched Format Library ✅
Updated `registry.ts` to include diverse format options for each section type:

**Before**: `["card_grid_icon_advanced", "icon_list_gradient", "card_grid_hover", ...]`
**After**: `["two_column_split", "checklist_block", "card_grid_icon", "comparison_table"]`

Key changes:
- **HERO_VALUE_PROP**: Added `text_block_prose`, `two_column_split` alongside `stats_strip_inline`
- **BENEFITS_LIST_OR_CARDS**: Now starts with `two_column_split`, `checklist_block` before card options
- **TRUST_OR_PROCESS_TRUST**: Prioritizes `stats_strip`, `quote_block`, `text_block_prose`
- **OBJECTION_FAQ**: Uses `faq_accordion`, `two_column_text`, `text_block`
- **CTA_REINFORCEMENT_BANNER**: Includes `text_block`, `checklist_block` for variety

### 3. Smart Format Rotation Logic ✅
Implemented in `write-article/route.ts`:

```typescript
// Track used formats to ensure variety
const usedFormats = new Set<string>();
const formatCategories = {
  card: ["card_grid", "card_grid_icon", "card_grid_numbered"],
  icon: ["icon_list", "icon_list_gradient"],
  table: ["comparison_table", "pricing_table", "table"],
  narrative: ["text_block", "text_block_prose", "narrative_block"],
  visual: ["stats_strip", "quote_block", "checklist_block", "two_column_split"],
};
```

**Selection Algorithm**:
1. Try to find a format that hasn't been used yet
2. If all formats used, prefer non-card/icon formats
3. Track format categories to ensure visual diversity
4. Log selected format and category for debugging

**Result**: Each section uses a different format, ensuring the same rich format (cards, icon lists, tables) appears only once.

### 4. Talk Points Distribution ✅
Implemented smart allocation to avoid repetition:

```typescript
// Distribute talk points across sections
const uspsPerSection = Math.max(1, Math.ceil(usps.length / totalSections));
const sectionTalkPoints = {
  uniqueSellingPoints: usps.slice(startIdx, endIdx),
  transactionalFacts: i === 0 ? facts : [], // Only first section
};
```

**Benefits**:
- Each section gets a subset of USPs (not all of them)
- Transactional facts only appear in the first section
- Prevents message fatigue from repetition

### 5. Section Context Awareness ✅
Enhanced `writeSection.ts` to pass context of previously written sections:

```typescript
const previousSectionsContext = writtenSections.map((s, idx) => 
  `${idx + 1}. ${s.sectionType} (${s.content.format}) - ${s.content.notes}`
).join("\n");
```

**Prompt Enhancement**:
```
CRITICAL - AVOID REPETITION:
- This section's unique purpose: [purpose]
- Do NOT repeat content, messaging, or examples from previous sections
- Find a NEW angle or focus that complements what's already written
- If USPs were covered in previous sections, present them from a different perspective
- Each section should add NEW value and insights
- Vary your presentation style from previous sections
```

**Result**: AI is explicitly instructed to avoid repeating content and to find new angles.

## Technical Details

### New Renderer Integration
All new renderers are integrated into `libs/monkey/tools/renderers/index.ts`:

```typescript
case "text_block":
case "text_block_prose":
case "narrative_block":
  return renderTextBlock(sectionType, content);

case "quote_block":
case "quote_cards":
case "testimonial_block":
  return renderQuoteBlock(sectionType, format, content);

// ... etc
```

### Format Categories
Formats are now categorized for intelligent rotation:
- **card**: Card-based layouts
- **icon**: Icon-heavy lists
- **table**: Comparison/pricing tables
- **narrative**: Text-focused blocks
- **visual**: Stats, quotes, checklists, two-column

## Expected Outcomes

1. **Visual Variety**: Articles will use 5-7 different visual formats instead of repeating cards/icons
2. **Content Uniqueness**: Each section will present different aspects of the offer, not repeat the same USPs
3. **Better Scannability**: Mix of narrative, visual, and structured content keeps readers engaged
4. **Maintained Quality**: Rich, detailed content is preserved while eliminating repetition

## Testing

To test the improvements:
1. Navigate to `/agents-compare`
2. Fill out the clarification questionnaire
3. Submit to generate an article
4. Verify:
   - Each section uses a different format
   - No section repeats the same card/icon layout
   - Content messaging varies across sections
   - Overall article feels cohesive but not repetitive

## Files Modified

- ✅ `libs/monkey/tools/renderers/textBlock.ts` (NEW)
- ✅ `libs/monkey/tools/renderers/quoteBlock.ts` (NEW)
- ✅ `libs/monkey/tools/renderers/statsStrip.ts` (NEW)
- ✅ `libs/monkey/tools/renderers/twoColumn.ts` (NEW)
- ✅ `libs/monkey/tools/renderers/checklistBlock.ts` (NEW)
- ✅ `libs/monkey/tools/renderers/index.ts` (UPDATED)
- ✅ `libs/monkey/references/pageTypes/registry.ts` (UPDATED)
- ✅ `libs/monkey/actions/writeSection.ts` (UPDATED)
- ✅ `app/api/monkey/landing-page/write-article/route.ts` (UPDATED)

## Next Steps

1. Test the article generation with various offers/ICPs
2. Monitor logs to verify format rotation is working
3. Gather user feedback on content variety
4. Fine-tune format selection algorithm if needed
5. Consider adding more specialized renderers (video embeds, interactive demos, etc.)

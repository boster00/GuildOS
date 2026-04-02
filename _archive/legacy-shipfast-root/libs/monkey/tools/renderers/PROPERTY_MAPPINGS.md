# Renderer Property Name Mappings

This document lists all the property names that each renderer accepts, to ensure the AI's output structure matches what the renderers expect.

## General Pattern

All renderers accept multiple property names for the same data to handle variations in AI output. The pattern is:
```typescript
const items = content.items || content.cards || content.badges || [];
```

## Renderer Property Mappings

### 1. Card Grid (`renderCardGrid`)
**Formats:** `card_grid`, `card_grid_icon`, `card_grid_numbered`, `card_grid_with_image`, `card_grid_icon_advanced`, `card_grid_numbered_gradient`, `icon_list`, `icon_list_steps`, `icon_list_gradient`, `icon_list_advanced`, `badge_row`, `badge_row_advanced`, `logo_grid`, `logo_grid_advanced`, `grouped_card_sections`, `grouped_card_sections_advanced`

**Properties:**
- `heading` or `title` → Section heading
- `items` or `cards` or `badges` or `icons` or `benefits` or `features` → Array of items
- `columns` → Number of columns (default: 3)

**Item properties:**
- `title` or `heading` or `name` → Item title
- `description` or `text` → Item description
- `icon` → Item icon (auto-added if format includes "icon")
- `number` → Item number (for numbered formats)

---

### 2. Steps Timeline (`renderStepsTimeline`)
**Formats:** `steps_timeline`, `steps_timeline_icon`, `steps_timeline_icon_advanced`

**Properties:**
- `heading` or `title` → Section heading
- `steps` or `items` → Array of steps

**Step properties:**
- `title` or `heading` or `name` → Step title
- `description` or `text` → Step description
- `icon` → Step icon (defaults to step number)

---

### 3. FAQ Accordion (`renderFaqAccordion`)
**Formats:** `faq_accordion`, `faq_two_column`

**Properties:**
- `heading` or `title` → Section heading (default: "Frequently Asked Questions")
- `items` or `faqs` → Array of FAQ items

**FAQ item properties:**
- `question` or `q` → Question text
- `answer` or `a` → Answer text

---

### 4. Table (`renderTable`)
**Formats:** `table`, `comparison_table`, `comparison_table_icon`, `comparison_table_features`, `comparison_table_scope`, `comparison_table_deliverables`, `pricing_table`, `pricing_table_icon`, `table_advanced`

**Properties:**
- `heading` or `title` → Section heading
- `rows` or `items` → Array of rows
- `columns` → Array of column headers
- `tiers` or `items` → For pricing tables

---

### 5. CTA Banner (`renderCtaBanner`)
**Formats:** `cta_banner`, `cta_banner_with_icons`, `cta_button`

**Properties:**
- `heading` or `title` → CTA heading
- `text` or `description` → CTA description
- `cta` or `primaryCTA` → CTA button object `{ text, url }`
- `bullets` or `recap` → Array of bullet points

---

### 6. Form Block (`renderFormBlock`)
**Formats:** `form_block`, `form_block_advanced`, `booking_widget`, `multi_step_form`, `cta_banner_with_form`

**Properties:**
- `heading` or `title` → Form heading (default: "Get Started")
- `description` → Form description
- `fields` → Array of form fields
- `submitText` or `cta.text` → Submit button text

---

### 7. Label-Value Table (`renderLabelValue`)
**Formats:** `label_value_table`, `two_column_table_icon`, `two_column_table_icon_advanced`

**Properties:**
- `heading` or `title` → Section heading
- `items` or `rows` or `specs` or `details` → Array of label-value pairs

**Item properties:**
- `label` or `name` → Label text
- `value` or `description` → Value text

---

### 8. Text Block (`renderTextBlock`)
**Formats:** `text_block`, `text_block_prose`, `narrative_block`

**Properties:**
- `heading` or `title` → Section heading
- `subheading` → Section subheading
- `paragraphs` or `text` or `body` or `content` → Array of paragraphs or single text string
- `bullets` or `points` → Array of bullet points

---

### 9. Quote Block (`renderQuoteBlock`)
**Formats:** `quote_block`, `quote_cards`, `quote_cards_advanced`, `testimonial_block`, `proof_tiles_gradient`

**Properties:**
- `heading` or `title` → Section heading
- `quotes` or `items` or `testimonials` or `cases` → Array of quotes

**Quote properties:**
- `text` or `quote` → Quote text
- `author` → Author name
- `role` or `title` → Author role
- `company` → Author company

---

### 10. Stats Strip (`renderStatsStrip`)
**Formats:** `stats_strip`, `stats_strip_inline`, `metrics_bar`

**Properties:**
- `heading` or `title` → Section heading
- `stats` or `items` or `metrics` or `numbers` → Array of stats

**Stat properties:**
- `value` or `number` → Stat value
- `label` or `description` → Stat label
- `icon` → Stat icon

---

### 11. Two Column (`renderTwoColumn`)
**Formats:** `two_column_split`, `two_column_text`

**Properties:**
- `heading` or `title` → Section heading
- `leftColumn` or `left` → Left column object
- `rightColumn` or `right` → Right column object

**Column properties:**
- `title` or `heading` → Column heading
- `text` or `description` → Column text
- `bullets` → Array of bullet points

---

### 12. Checklist Block (`renderChecklistBlock`)
**Formats:** `checklist_block`, `checklist_icon`, `checklist_icon_advanced`, `requirements_list`

**Properties:**
- `heading` or `title` → Section heading
- `subheading` → Section subheading
- `items` or `checklist` or `requirements` or `features` → Array of checklist items

**Item properties:**
- `text` or `label` → Item text (or string directly)
- `checked` → Boolean (default: true)

---

### 13. Hero (`renderHero`)
**Formats:** `hero_block`, `hero_block_two_column`

**Properties:**
- `heading` or `h1` → Hero heading (default: "Welcome")
- `subheading` or `subhead` → Hero subheading
- `bullets` or `iconList` → Array of bullet points
- `cta` or `primaryCTA` → CTA button object `{ text, url }`
- `imagePrompt` → Image placeholder description

---

## AI Prompt Guidelines

When instructing the AI to generate section content, specify the expected property names based on the format:

**Example for badge_row_advanced:**
```json
{
  "heading": "Our Credentials & Expertise",
  "badges": [
    { "title": "ISO 9001", "description": "Certified processes" },
    { "title": "CLIA", "description": "Laboratory accreditation" }
  ]
}
```

**Example for steps_timeline_icon_advanced:**
```json
{
  "heading": "How Our Service Works",
  "steps": [
    { "title": "Submit Samples", "description": "Send us your samples..." },
    { "title": "Analysis", "description": "We perform IHC/IF..." }
  ]
}
```

## Debugging Empty Sections

If a section renders with only a heading:
1. Check the logs for `[renderSection] Section X with format Y only has heading`
2. The AI likely used a property name not in the mapping (e.g., `credentials` instead of `badges`)
3. Add the new property name to the appropriate renderer
4. Update this document

## Future Improvements

Consider adding a schema validation layer that:
1. Detects unknown property names
2. Auto-maps common variations (e.g., `credential` → `badge`)
3. Logs suggestions for renderer updates

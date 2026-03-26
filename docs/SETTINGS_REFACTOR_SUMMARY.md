# Settings UI Refactor Summary

## Overview
Refactored the `/settings` page to focus solely on template customization, removing all API key management UI.

## Changes Made

### 1. Settings Page (`app/(private)/settings/page.js`)
- **Removed**: All API key provider settings (OpenAI, Gemini, Perplexity, Claude)
- **Removed**: Tab navigation, form components, and provider-specific UI
- **Simplified**: Now only renders the new `TemplateManagementTab` component
- Page now focuses on: "Customize component templates and page configurations for your content"

### 2. New Template Management UI (`app/(private)/settings/components/TemplateManagementTab.js`)
A comprehensive template customization interface with:

#### Features:
- **Page Type Tabs**: Horizontal navigation showing all marketing page types (e.g., QUOTE_CONSULTATION_SERVICE, DEMO_TRIAL_SAAS, HOMEPAGE, etc.)
- **Section List**: Shows recommended and optional sections for the selected page type
- **Format Selection**: Displays available HTML format options for each section
- **HTML Editor**: Full-featured editor for customizing template HTML
- **Live Preview**: Real-time preview of template changes
- **Save/Reset**: Save customizations or reset to defaults

#### Data Flow:
1. Loads page types from `libs/monkey/references/pageTypes/registry.ts`
2. Uses `MarketingPageType` enum and `PAGE_TYPE_CONFIGS` for page structure
3. Uses `SECTION_TEMPLATES` for section metadata
4. Loads HTML templates from `libs/monkey/tools/renderers/templates.ts`
5. Saves customizations to `profiles.json.customizations.componentHtmlTemplates`

### 3. Monkey.js Enhancements (`libs/monkey.js`)
Added three new functions for template customization:

#### `loadPageTypeConfigs()`
- Loads marketing page type configurations
- Merges default configs with user customizations from `profiles.json.customizations.pageTypes`
- Returns complete page type configuration with recommended/optional sections

#### `savePageTypeConfig(pageType, config)`
- Saves user customizations for page type configurations
- Updates `profiles.json.customizations.pageTypes[pageType]`
- Allows customizing which sections are recommended/optional for each page type

#### `loadSectionTemplates()`
- Loads section template metadata
- Merges defaults with user customizations from `profiles.json.customizations.sectionTemplates`
- Returns section purposes, inclusion rules, boundaries, anti-patterns, and recommended formats

## Database Structure

### profiles.json.customizations
```json
{
  "customizations": {
    "pageTypes": {
      "QUOTE_CONSULTATION_SERVICE": {
        "recommended_sections": ["HERO_VALUE_PROP", "BENEFITS_FEATURES", ...],
        "optional_sections": ["FAQ", "PRICING", ...],
        "updatedAt": "2026-01-23T..."
      }
    },
    "sectionTemplates": {
      "HERO_VALUE_PROP": {
        "purpose": "Custom purpose...",
        "recommended_formats": ["hero", "text_block", ...],
        "updatedAt": "2026-01-23T..."
      }
    },
    "componentHtmlTemplates": {
      "HERO_VALUE_PROP_hero": "<section>Custom HTML...</section>",
      "BENEFITS_FEATURES_card_grid": "<section>Custom HTML...</section>"
    },
    "components": {
      // Existing component customizations (from old ComponentCustomizationTab)
      "hero-centered": {
        "html": "<section>...</section>",
        "enabled": true,
        "updatedAt": "2026-01-23T..."
      }
    }
  }
}
```

## Template System Architecture

### Two Template Systems Coexist:

1. **Content Magic Components** (`libs/content-magic/components/registry.js`)
   - Used by the content editor
   - Pre-built HTML sections (hero-centered, features-grid, etc.)
   - Managed by existing `ComponentCustomizationTab` (still available if needed)

2. **Monkey Marketing Templates** (`libs/monkey/`)
   - Used by article/landing page generation pipelines
   - Format-based templates (hero, cardGrid, stepsTimeline, etc.)
   - Managed by new `TemplateManagementTab`

### Merge Strategy
For all template types:
1. Load defaults from registry files
2. Fetch user customizations from `profiles.json.customizations`
3. **Merge with user customizations taking priority**
4. Return merged configuration

This ensures:
- Defaults are always available
- Users can override specific templates
- Changes persist across sessions
- Easy to reset to defaults

## Testing the Implementation

To test the new settings page:

1. **Navigate to `/settings`**
   - Should see clean UI with only template management
   - No API key fields visible

2. **Select a Page Type**
   - Click on any page type tab (e.g., DEMO_TRIAL_SAAS)
   - Should see recommended and optional sections in left sidebar

3. **Select a Section**
   - Click on a section (e.g., HERO_VALUE_PROP)
   - Should see available formats as buttons

4. **Select a Format**
   - Click on a format (e.g., hero)
   - Should see HTML editor with default template
   - Should see live preview on the right

5. **Customize Template**
   - Edit HTML in the editor
   - Preview should update in real-time
   - Click "Save" to persist changes

6. **Verify Persistence**
   - Reload the page
   - Navigate to the same section/format
   - Custom HTML should still be loaded

7. **Reset to Default**
   - Click "Reset" button
   - Should restore original template HTML

## Migration Notes

### No Breaking Changes
- Old `ComponentCustomizationTab` still exists and works
- Existing component customizations remain intact
- New customizations use separate keys in profiles.json

### If Full Migration Desired
To completely remove old API key settings:
- Old `ComponentCustomizationTab.js` can be kept or removed
- Old settings module (`libs/settings/class.js`) is no longer used by settings page
- API keys are now managed server-side only

## Next Steps (Optional Enhancements)

1. **Add Page Type Configuration Editor**
   - UI to customize which sections are recommended/optional per page type
   - Drag-and-drop section ordering

2. **Section Template Metadata Editor**
   - Edit purposes, inclusion rules, boundaries, anti-patterns
   - Customize recommended formats per section

3. **Template Import/Export**
   - Export customizations as JSON
   - Import template sets from files

4. **Template Marketplace**
   - Share templates with other users
   - Browse and install community templates

5. **Version Control**
   - Track template change history
   - Revert to previous versions

## Files Changed
- ✅ `app/(private)/settings/page.js` - Simplified to template-only
- ✅ `app/(private)/settings/components/TemplateManagementTab.js` - New component
- ✅ `libs/monkey.js` - Added 3 new functions
- ✅ `docs/SETTINGS_REFACTOR_SUMMARY.md` - This documentation

## Files Preserved
- `app/(private)/settings/components/ComponentCustomizationTab.js` - Still available
- `libs/content-magic/components/registry.js` - Unchanged
- `libs/monkey/references/pageTypes/registry.ts` - Unchanged (source of truth)
- `libs/monkey/tools/renderers/templates.ts` - Unchanged (HTML templates)

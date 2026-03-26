# Import Features Documentation

## Overview

Two new import features have been added to enhance template and CSS management:

1. **Import Templates from Live Page** - Extract section elements from HTML/URLs and save as templates
2. **Import CSS from Example Page** - Extract CSS files and inline styles from HTML/URLs

## Feature 1: Import Templates from Live Page

### Location
**Settings > Page Templates > "Import from Page" button**

### Purpose
Extract multiple `<section>` elements from a webpage or HTML code and save each section as an individual template.

### How to Use

1. Navigate to **Settings > Page Templates**
2. Click the **"Import from Page"** button (purple button next to "Create New Template")
3. Choose input method:
   - **Enter URL**: Provide a URL to fetch HTML from a live page
   - **Paste HTML**: Directly paste HTML code
4. Click **"Fetch & Parse"** (for URL) or **"Parse Sections"** (for HTML)
5. Review the extracted sections in the preview
6. Click **"Import Templates"** to save all sections

### Requirements

- HTML must contain `<section>` elements
- Must have at least 2 sections (single sections are not supported)
- Each section will be saved as a separate template

### Template Naming Convention

Templates are automatically named with the format:
```
template-[timestamp]-[4-digit-random]
```

Example: `template-1738095961262-7342`

### Template Properties

Each imported template is saved with:
```javascript
{
  id: "template-1738095961262-7342",
  html: "<section>...</section>",
  name: "template-1738095961262-7342",
  category: "custom",
  isCustom: true,
  createdAt: "2026-01-28T18:26:01.262Z",
  updatedAt: "2026-01-28T18:26:01.262Z",
  isUserCreated: true
}
```

### Error Messages

| Error | Meaning |
|-------|---------|
| "No section elements found" | HTML does not contain any `<section>` tags |
| "Only one section found" | HTML contains only 1 section (need 2+) |
| "Failed to fetch URL" | Unable to retrieve HTML from the provided URL |

### Example Usage

**Sample HTML to Import:**
```html
<section class="hero">
  <h1>Welcome</h1>
  <p>Hero section content</p>
</section>

<section class="features">
  <h2>Features</h2>
  <ul>
    <li>Feature 1</li>
    <li>Feature 2</li>
  </ul>
</section>

<section class="cta">
  <h2>Get Started</h2>
  <button>Sign Up</button>
</section>
```

This would create 3 separate templates, one for each section.

---

## Feature 2: Import CSS from Example Page

### Location
**Settings > Custom CSS > "Import from Page" button**

### Purpose
Extract CSS file links and inline styles from a webpage or HTML code and load them into the CSS editor for manual review and saving.

### How to Use

1. Navigate to **Settings > Custom CSS**
2. Click the **"Import from Page"** button (purple button in External CSS Links section)
3. Choose input method:
   - **Enter URL**: Provide a URL to fetch HTML from a live page
   - **Paste HTML**: Directly paste HTML code
4. Click **"Fetch & Extract"** (for URL) or **"Extract CSS"** (for HTML)
5. Review the extracted CSS:
   - **CSS File Links**: Shows all `<link>` tags with stylesheets
   - **Inline Styles**: Shows combined content from all `<style>` tags
6. Click **"Load CSS into Editor"** to populate the UI
7. Review the imported CSS
8. Click **"Save Links"** and **"Save CSS"** to persist changes

### What Gets Extracted

#### CSS File Links
- All `<link rel="stylesheet" href="...">` tags
- Added to the **External CSS Links** section

#### Inline Styles
- All `<style>...</style>` tag contents
- Combined and appended to the **Custom CSS** textarea

### Important Notes

- Imported CSS is NOT automatically saved
- You must manually review and save using the existing save buttons
- The 50KB size limit still applies to custom CSS
- Imported inline styles are appended to existing CSS (not replaced)

### Example Usage

**Sample HTML to Import:**
```html
<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="https://example.com/styles.css">
  <link rel="stylesheet" href="https://example.com/theme.css">
  
  <style>
    .hero {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 4rem 2rem;
      color: white;
    }
  </style>
  
  <style>
    .features {
      padding: 4rem 2rem;
      background: #f7fafc;
    }
  </style>
</head>
<body>
  <!-- content -->
</body>
</html>
```

**Result:**
- External CSS Links: `https://example.com/styles.css`, `https://example.com/theme.css`
- Inline Styles: Combined content from both `<style>` tags

---

## API Endpoints

### POST /api/templates/import

Extract sections from HTML and optionally save as templates.

**Request Body:**
```json
{
  "html": "<section>...</section><section>...</section>",
  "saveTemplates": false  // true to save, false to just extract
}
```

**Response (extraction only):**
```json
{
  "success": true,
  "sections": [
    { "html": "<section>...</section>", "preview": "..." }
  ],
  "count": 2
}
```

**Response (save templates):**
```json
{
  "success": true,
  "count": 2,
  "templateIds": ["template-123-4567", "template-123-8901"],
  "message": "Successfully imported 2 templates"
}
```

### POST /api/settings/extract-css

Extract CSS links and inline styles from HTML.

**Request Body:**
```json
{
  "html": "<html>...</html>"
}
```

**Response:**
```json
{
  "success": true,
  "links": ["https://example.com/styles.css"],
  "inlineStyles": ".hero { ... }",
  "summary": {
    "linksCount": 1,
    "inlineStylesLength": 123
  }
}
```

---

## Testing

### Unit Tests

Run the unit tests to verify the logic:

```bash
node tests/import-features-api.test.js
```

Tests cover:
- Section extraction from HTML
- CSS link extraction
- Inline style extraction
- Template ID generation
- Validation logic

### Manual Testing

Use the provided test HTML file:

```
tests/import-features-test.html
```

This file contains:
- 4 sections (hero, features, testimonials, cta)
- 1 external CSS link
- 2 inline style blocks

**Test Template Import:**
1. Open the test HTML in a browser
2. Copy the URL or HTML source
3. Use "Import from Page" in Page Templates
4. Verify 4 templates are created

**Test CSS Import:**
1. Use the same test HTML
2. Use "Import from Page" in Custom CSS
3. Verify 1 CSS link is added
4. Verify inline styles are added to textarea

---

## File Structure

### New Files Created

```
app/
├── api/
│   ├── templates/
│   │   └── import/
│   │       └── route.js              # Template import API
│   └── settings/
│       └── extract-css/
│           └── route.js              # CSS extraction API
└── (private)/
    └── settings/
        ├── page-templates/
        │   └── components/
        │       └── ImportTemplateDialog.js  # Template import UI
        └── custom-css/
            └── components/
                └── ImportCSSDialog.js       # CSS import UI
```

### Modified Files

```
app/(private)/settings/
├── page-templates/page.js            # Added import button & dialog
└── custom-css/page.js                # Added import button & dialog
```

### Test Files

```
tests/
├── import-features-test.html         # Sample HTML for testing
└── import-features-api.test.js       # Unit tests
```

---

## Technical Details

### Template ID Generation

```javascript
const generateTemplateId = () => {
  const timestamp = Date.now();
  const random = Math.floor(1000 + Math.random() * 9000);
  return `template-${timestamp}-${random}`;
};
```

### Section Extraction Regex

```javascript
const sectionRegex = /<section[\s\S]*?<\/section>/gi;
```

### CSS Link Extraction Regex

```javascript
const linkRegex = /<link[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>|<link[^>]*href=["']([^"']+)["'][^>]*rel=["']stylesheet["'][^>]*>/gi;
```

### Inline Style Extraction Regex

```javascript
const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
```

---

## Advanced Usage Tips

### Template Import

1. **Clean HTML First**: Remove unnecessary wrapper divs before importing for cleaner templates
2. **Section Structure**: Ensure each section is self-contained with proper HTML structure
3. **Batch Processing**: Import multiple pages and organize templates later
4. **Preview Before Import**: Always review extracted sections before importing

### CSS Import

1. **Start Fresh**: Consider starting with a clean CSS textarea when importing
2. **Check Size Limit**: Monitor the 50KB limit after importing inline styles
3. **External Links**: Test external CSS links to ensure they're accessible
4. **Manual Review**: Always review imported CSS before saving

---

## Troubleshooting

### Template Import Issues

**Problem**: "No section elements found"
- **Solution**: Ensure HTML contains `<section>` tags, not just `<div>` elements

**Problem**: "Only one section found"
- **Solution**: Add more sections or use the regular "Create Template" feature for single sections

**Problem**: Templates don't appear after import
- **Solution**: Refresh the page or check browser console for errors

### CSS Import Issues

**Problem**: "No CSS found"
- **Solution**: Verify HTML contains `<link>` or `<style>` tags

**Problem**: CSS too large after import
- **Solution**: Manually trim unnecessary styles or split across multiple saves

**Problem**: External CSS links don't work
- **Solution**: Ensure URLs are accessible and use HTTPS

---

## Best Practices

1. **Always Preview**: Review extracted content before importing
2. **Test After Import**: Verify templates and CSS work as expected
3. **Backup First**: Export current templates/CSS before bulk imports
4. **Clean Code**: Remove unnecessary HTML/CSS before importing
5. **Naming Convention**: Rename imported templates to meaningful names after import
6. **Version Control**: Keep track of imported templates for easier management

---

## Future Enhancements

Potential improvements for consideration:
- Rename templates during import
- Select specific sections to import (not all)
- CSS minification before import
- Import from multiple URLs at once
- Template preview before saving
- Bulk edit imported templates

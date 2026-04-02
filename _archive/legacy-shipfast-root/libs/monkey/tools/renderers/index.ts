/**
 * HTML Renderer Dispatcher
 * Renders section JSON into HTML using format-specific templates
 */

import { SectionContent } from "../../references/marketingTypes";
import { renderHero } from "./hero";
import { renderCardGrid } from "./cardGrid";
import { renderTable } from "./table";
import { renderStepsTimeline } from "./stepsTimeline";
import { renderFaqAccordion } from "./faqAccordion";
import { renderQuoteBlock } from "./quoteBlock";
// New consolidated renderers
import { renderContentSection } from "./contentSection";
import { renderKeyValueList } from "./keyValueList";
import { renderConversionBlock } from "./conversionBlock";
// Legacy renderers (kept for backward compatibility)
import { renderCtaBanner } from "./ctaBanner";
import { renderFormBlock } from "./formBlock";
import { renderLabelValue } from "./labelValue";
import { renderTextBlock } from "./textBlock";
import { renderStatsStrip } from "./statsStrip";
import { renderTwoColumn } from "./twoColumn";
import { renderChecklistBlock } from "./checklistBlock";

export interface RenderOptions {
  theme?: "default" | "minimalist";
}

export function renderSection(section: SectionContent, options: RenderOptions = {}): string {
  const { sectionType, format, content } = section;
  const theme = options.theme || "default";

  // Enhanced debug logging for content structure
  if (process.env.NODE_ENV === "development" && content && typeof content === "object") {
    const contentKeys = Object.keys(content);
    
    // Log all content keys for debugging
    
    
    // Warn if suspiciously few keys
    if (contentKeys.length === 1 && contentKeys[0] === "heading") {
    }
    
    // Warn if content object is empty
    if (contentKeys.length === 0) {
    }
    
    // Log property access attempts (for common properties)
    const commonProps = ['heading', 'subheading', 'bullets', 'cta', 'items', 'cards', 'steps'];
    const availableCommonProps = commonProps.filter(prop => content[prop] !== undefined);
    if (availableCommonProps.length > 0) {
    }
  }

  // Extract variant from content if present (for new canonical formats)
  // Support both: content.layout/content.variant/content.type (old structure) 
  // and section-level variant (if SectionContent is extended)
  const layout = (section as any)?.variant || content?.layout || content?.variant;
  const conversionType = (section as any)?.variant || content?.type;
  
  // Handle special case: if conversionType is undefined, check if variant indicates conversionBlock type
  let actualConversionType = conversionType;
  if (!actualConversionType && format === "conversionBlock") {
    actualConversionType = layout; // For conversionBlock, variant might be in layout
  }
  
  // Route to format-specific renderer
  // New canonical formats first
  switch (format) {
    // New canonical formats
    case "hero":
      return renderHero(sectionType, content, theme);
    
    case "contentSection":
      return renderContentSection(sectionType, content, theme, layout || "single");
    
    case "keyValueList":
      const kvVariant = layout || "labelValue";
      return renderKeyValueList(sectionType, content, theme, kvVariant);
    
    case "conversionBlock":
      const cbType = actualConversionType || conversionType || layout || "cta";
      return renderConversionBlock(sectionType, content, theme, cbType);
    
    // Legacy format mappings for backward compatibility
    case "hero_block_two_column":
    case "hero_block":
      return renderHero(sectionType, content, theme);
    
    case "card_grid":
    case "card_grid_icon":
    case "card_grid_numbered":
    case "card_grid_with_image":
    case "card_grid_icon_advanced":
    case "card_grid_numbered_gradient":
    case "icon_list":
    case "icon_list_steps":
    case "icon_list_gradient":
    case "icon_list_advanced":
    case "badge_row":
    case "badge_row_advanced":
    case "logo_grid":
    case "logo_grid_advanced":
    case "grouped_card_sections":
    case "grouped_card_sections_advanced":
      return renderCardGrid(sectionType, format, content, theme);
    
    case "table":
    case "comparison_table":
    case "comparison_table_icon":
    case "comparison_table_features":
    case "comparison_table_scope":
    case "comparison_table_deliverables":
    case "pricing_table":
    case "pricing_table_icon":
    case "table_advanced":
      return renderTable(sectionType, format, content, theme);
    
    case "steps_timeline":
    case "steps_timeline_icon":
    case "steps_timeline_icon_advanced":
      return renderStepsTimeline(sectionType, content, theme);
    
    case "faq_accordion":
    case "faq_two_column":
      return renderFaqAccordion(sectionType, content, theme);
    
    // Legacy format mappings - map to new canonical formats
    case "cta_banner":
    case "cta_banner_with_icons":
    case "cta_button":
      return renderConversionBlock(sectionType, content, theme, "cta");
    
    case "form_block":
    case "form_block_advanced":
    case "booking_widget":
    case "multi_step_form":
    case "cta_banner_with_form":
      return renderConversionBlock(sectionType, content, theme, "form");
    
    case "label_value_table":
    case "two_column_table_icon":
    case "two_column_table_icon_advanced":
      return renderKeyValueList(sectionType, content, theme, "labelValue");
    
    case "text_block":
    case "text_block_prose":
    case "narrative_block":
      return renderContentSection(sectionType, content, theme, "single");
    
    case "quote_block":
    case "quote_cards":
    case "quote_cards_advanced":
    case "testimonial_block":
    case "proof_tiles_gradient":
      return renderQuoteBlock(sectionType, format, content, theme);
    
    case "stats_strip":
    case "stats_strip_inline":
    case "metrics_bar":
      return renderKeyValueList(sectionType, content, theme, "stats");
    
    case "two_column_split":
    case "two_column_text":
      return renderContentSection(sectionType, content, theme, "twoColumn");
    
    case "checklist_block":
    case "checklist_icon":
    case "checklist_icon_advanced":
    case "requirements_list":
      return renderKeyValueList(sectionType, content, theme, "checklist");
    
    // Additional legacy renderers for backward compatibility
    case "textBlock":
      return renderContentSection(sectionType, content, theme, "single");
    case "twoColumn":
      return renderContentSection(sectionType, content, theme, "twoColumn");
    case "labelValue":
      return renderKeyValueList(sectionType, content, theme, "labelValue");
    case "checklistBlock":
      return renderKeyValueList(sectionType, content, theme, "checklist");
    case "statsStrip":
      return renderKeyValueList(sectionType, content, theme, "stats");
    case "formBlock":
      return renderConversionBlock(sectionType, content, theme, "form");
    case "ctaBanner":
      return renderConversionBlock(sectionType, content, theme, "cta");
    
    default:
      // Fallback: generic card grid
      return renderCardGrid(sectionType, "card_grid", content, theme);
  }
}

export function renderFullPage(sections: SectionContent[], options: RenderOptions = {}): string {
  const theme = options.theme || "default";
  const htmlSections = sections.map((section, index) => {
    const html = renderSection(section, { theme });
    return `<!-- Section ${index + 1}: ${section.sectionType} -->\n${html}`;
  });

  // Tailwind CDN configuration with theme-specific customization
  const tailwindConfig = theme === "minimalist"
    ? `
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            primary: '#000000',
            secondary: '#ffffff',
          }
        }
      }
    }
  `
    : `
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            primary: '#3b82f6',
            secondary: '#2563eb',
          }
        }
      }
    }
  `;

  return `<!DOCTYPE html>
<html lang="en" data-theme="${theme}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Landing Page</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    ${tailwindConfig}
  </script>
  <style>
    /* Theme-specific custom styles */
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
  </style>
</head>
<body class="${theme === 'minimalist' ? 'bg-white text-black' : 'bg-gray-50 text-gray-900'}">
${htmlSections.join("\n\n")}
</body>
</html>`;
}

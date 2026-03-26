// ARCHIVED: Original path was libs/content-magic/utils/cleanHtmlMarkers.ts

/**
 * Remove markdown code block markers from HTML content
 */
export function cleanHtmlMarkers(html: string): string {
  if (!html || typeof html !== 'string') {
    console.log('[cleanHtmlMarkers] Invalid input:', { type: typeof html, value: html });
    return html;
  }
  
  // Log before replace
  const beforeReplace = html.substring(0, 100);
  console.log('[cleanHtmlMarkers] Before replace (first 100 chars):', beforeReplace);
  
  // Perform replacements
  let cleaned = html;
  
  // Remove opening ```html (case-insensitive, at start of string)
  const htmlMarkerRegex = /^```html\s*/i;
  if (htmlMarkerRegex.test(cleaned)) {
    cleaned = cleaned.replace(htmlMarkerRegex, '');
    console.log('[cleanHtmlMarkers] Removed opening ```html marker');
  } else {
    console.log('[cleanHtmlMarkers] No opening ```html marker found');
  }
  
  // Remove opening ``` (at start of string, after potential ```html removal)
  const openingMarkerRegex = /^```\s*/;
  if (openingMarkerRegex.test(cleaned)) {
    cleaned = cleaned.replace(openingMarkerRegex, '');
    console.log('[cleanHtmlMarkers] Removed opening ``` marker');
  } else {
    console.log('[cleanHtmlMarkers] No opening ``` marker found');
  }
  
  // Remove closing ``` (at end of string)
  const closingMarkerRegex = /\s*```$/;
  if (closingMarkerRegex.test(cleaned)) {
    cleaned = cleaned.replace(closingMarkerRegex, '');
    console.log('[cleanHtmlMarkers] Removed closing ``` marker');
  } else {
    console.log('[cleanHtmlMarkers] No closing ``` marker found');
  }
  
  // Trim and log after replace
  const afterReplace = cleaned.trim();
  const afterReplacePreview = afterReplace.substring(0, 100);
  console.log('[cleanHtmlMarkers] After replace (first 100 chars):', afterReplacePreview);
  console.log('[cleanHtmlMarkers] Success:', html !== afterReplace);
  
  return afterReplace;
}

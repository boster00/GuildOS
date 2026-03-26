// ARCHIVED: Original path was libs/content-magic/pageTypes.js

import pageTypeConfig from './pageTypes.json';

/**
 * Get page type configuration by type key
 * @param {string} type - The page type key (e.g., 'blog-info', 'product-page')
 * @returns {object} Page type configuration
 */
export function getPageType(type) {
  console.log("[libs/content-magic/pageTypes.js] getPageType");
  return pageTypeConfig?.pageTypes?.[type] || null;
}

/**
 * Get just the overview for a page type
 * @param {string} type - The page type key
 * @returns {string} Overview description
 */
export function getPageOverview(type) {
  console.log("[libs/content-magic/pageTypes.js] getPageOverview");
  const pageType = pageTypeConfig?.pageTypes?.[type];
  return pageType ? pageType.overview : null;
}

/**
 * Get best practices for a page type
 * @param {string} type - The page type key
 * @returns {array} Array of best practice strings
 */
export function getPageBestPractices(type) {
  console.log("[libs/content-magic/pageTypes.js] getPageBestPractices");
  const pageType = pageTypeConfig?.pageTypes?.[type];
  return pageType ? pageType.bestPractices : [];
}

/**
 * Get audits to ignore for a page type
 * @param {string} type - The page type key
 * @returns {array} Array of audit keys to skip
 */
export function getAuditsToIgnore(type) {
  console.log("[libs/content-magic/pageTypes.js] getAuditsToIgnore");
  const pageType = pageTypeConfig?.pageTypes?.[type];
  return pageType ? pageType.auditsToIgnore : [];
}

/**
 * Get section templates (key topics) for a page type
 * @param {string} type - The page type key
 * @returns {array} Array of template objects with title, format, and description, or empty array if key_topics is a string
 */
export function getPageTemplates(type) {
  console.log("[libs/content-magic/pageTypes.js] getPageTemplates");
  const pageType = pageTypeConfig?.pageTypes?.[type];
  if (!pageType || !pageType.key_topics) return [];
  // If key_topics is a string (new format), return empty array
  if (typeof pageType.key_topics === 'string') return [];
  // If key_topics is an array (old format), return it
  return Array.isArray(pageType.key_topics) ? pageType.key_topics : [];
}

/**
 * Get format example HTML by format name
 * @param {string} format - The format name (e.g., 'Paragraph', 'Cards/Grid')
 * @returns {string} HTML string for the format example
 */
export function getFormatExample(format) {
  console.log("[libs/content-magic/pageTypes.js] getFormatExample");
  return pageTypeConfig?.formatExamples?.[format] || "";
}

/**
 * Get all available page types
 * @returns {array} Array of page type objects with label and key
 */
export function getAllPageTypes() {
  console.log("[libs/content-magic/pageTypes.js] getAllPageTypes");
  if (!pageTypeConfig?.pageTypes) return [];
  return Object.entries(pageTypeConfig.pageTypes).map(([key, value]) => ({
    key,
    label: value.label,
  }));
}

/**
 * Get all available formats
 * @returns {array} Array of format names
 */
export function getAllFormats() {
  console.log("[libs/content-magic/pageTypes.js] getAllFormats");
  return pageTypeConfig?.formatExamples 
    ? Object.keys(pageTypeConfig.formatExamples)
    : [];
}

/**
 * Get the starter outline for a page type as HTML
 * @param {string} type - The page type key
 * @returns {string} HTML outline to populate editor, or null if key_topics is a string
 */
export function getPageOutlineHtml(type) {
  console.log("[libs/content-magic/pageTypes.js] getPageOutlineHtml");
  const pageType = pageTypeConfig?.pageTypes?.[type];
  if (!pageType || !pageType.key_topics) return null;
  
  // If key_topics is a string (new format), return null (user should use AI suggestions)
  if (typeof pageType.key_topics === 'string') return null;
  
  // If key_topics is an array (old format), generate HTML
  if (!Array.isArray(pageType.key_topics)) return null;
  
  // Generate HTML from key_topics
  let html = '';
  pageType.key_topics.forEach((topic, index) => {
    const sectionKey = `section_${topic.title.toLowerCase().replace(/\s+/g, '_').replace(/[^\w_]/g, '')}`;
    html += `<h2>${topic.title}</h2>\n`;
    html += `<p>${topic.description}</p>\n`;
    html += `<p><em>Format: ${topic.format}</em></p>\n`;
    html += `\n`;
  });
  
  return html;
}

/**
 * Get the starter outline for a page type as structured data
 * @param {string} type - The page type key
 * @returns {array} Array of section objects with title, format, and description, or empty array if key_topics is a string
 */
export function getPageOutline(type) {
  console.log("[libs/content-magic/pageTypes.js] getPageOutline");
  const pageType = pageTypeConfig?.pageTypes?.[type];
  if (!pageType || !pageType.key_topics) return [];
  
  // If key_topics is a string (new format), return empty array (user should use AI suggestions)
  if (typeof pageType.key_topics === 'string') return [];
  
  // If key_topics is an array (old format), transform to outline sections
  if (!Array.isArray(pageType.key_topics)) return [];
  
  // Transform key_topics to outline sections with generated keys
  return pageType.key_topics.map((topic) => {
    const sectionKey = `section_${topic.title.toLowerCase().replace(/\s+/g, '_').replace(/[^\w_]/g, '')}`;
    return {
      key: sectionKey,
      title: topic.title,
      format: topic.format,
      description: topic.description,
    };
  });
}


export default pageTypeConfig;
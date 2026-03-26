// ARCHIVED: Original path was libs/content-magic/utils/addSectionKeysToHtml.ts

/**
 * Add section keys and data attributes to HTML content
 */

import { generateSectionKey } from './sectionKeys';
import { detectSectionFormat, inferSectionPurpose } from './sectionFormatDetection';
import { Section } from '../types/sections';

/**
 * Extract structured sections from HTML
 * @param html - The HTML content
 * @returns Array of structured sections
 */
export function extractStructuredSections(html: string): Section[] {
  if (!html || typeof html !== 'string') {
    return [];
  }
  
  const sections: Section[] = [];
  const headingRegex = /<h([1-6])[^>]*>(.*?)<\/h[1-6]>/gi;
  let match;
  let position = 0;
  
  while ((match = headingRegex.exec(html)) !== null) {
    const level = parseInt(match[1]);
    const fullMatch = match[0];
    const titleText = match[2].replace(/<[^>]*>/g, '').trim();
    
    if (!titleText) continue;
    
    // Extract data-section-key if present
    const dataKeyMatch = fullMatch.match(/data-section-key=["']([^"']+)["']/i);
    const existingKey = dataKeyMatch ? dataKeyMatch[1] : null;
    
    // Generate key: use existing or generate from title
    const key = existingKey || generateSectionKey(titleText);
    
    // Extract section HTML (from this heading to next heading or end)
    const headingIndex = match.index || 0;
    const nextHeadingMatch = headingRegex.exec(html);
    const sectionEnd = nextHeadingMatch ? (nextHeadingMatch.index || html.length) : html.length;
    const sectionHtml = html.substring(headingIndex, sectionEnd);
    
    // Detect format and purpose
    const format = detectSectionFormat(sectionHtml);
    const purpose = inferSectionPurpose(sectionHtml);
    
    sections.push({
      key,
      title: titleText,
      format,
      purpose: purpose || undefined,
      level,
      position: position++,
    });
    
    // Reset regex lastIndex for next iteration
    headingRegex.lastIndex = headingIndex + fullMatch.length;
  }
  
  return sections;
}

/**
 * Add data-section-key attributes to headings in HTML
 * @param html - The HTML content
 * @returns HTML with data-section-key attributes added
 */
export function addSectionKeysToHtml(html: string): string {
  if (!html || typeof html !== 'string') {
    return html;
  }
  
  let processedHtml = html;
  const headingRegex = /<h([1-6])([^>]*)>(.*?)<\/h[1-6]>/gi;
  const processedKeys = new Set<string>();
  
  // First pass: collect all headings and their keys
  const headings: Array<{
    fullMatch: string;
    level: string;
    attrs: string;
    titleText: string;
    titleHtml: string; // Original HTML content to preserve
    index: number;
    key: string;
  }> = [];
  
  let match;
  while ((match = headingRegex.exec(html)) !== null) {
    const level = match[1];
    const attrs = match[2] || '';
    const titleHtml = match[3] || '';
    const titleText = titleHtml.replace(/<[^>]*>/g, '').trim();
    const fullMatch = match[0];
    
    if (!titleText) continue;
    
    // Check if data-section-key already exists
    const existingKeyMatch = attrs.match(/data-section-key=["']([^"']+)["']/i);
    let key: string;
    
    if (existingKeyMatch) {
      key = existingKeyMatch[1];
    } else {
      // Generate key and ensure uniqueness
      key = generateSectionKey(titleText);
      let uniqueKey = key;
      let counter = 1;
      while (processedKeys.has(uniqueKey)) {
        uniqueKey = `${key}_${counter++}`;
      }
      key = uniqueKey;
      processedKeys.add(key);
    }
    
    headings.push({
      fullMatch,
      level,
      attrs,
      titleText,
      titleHtml, // Store original HTML content
      index: match.index || 0,
      key,
    });
  }
  
  // Second pass: replace headings with data attributes (process in reverse to preserve indices)
  for (let i = headings.length - 1; i >= 0; i--) {
    const heading = headings[i];
    
    // Check if data-section-key already exists
    if (heading.attrs.includes('data-section-key=')) {
      continue; // Skip if already has the attribute
    }
    
    // Add data-section-key attribute
    const newAttrs = heading.attrs.trim() 
      ? `${heading.attrs.trim()} data-section-key="${heading.key}"`
      : `data-section-key="${heading.key}"`;
    
    // Preserve original title HTML content (may contain nested HTML tags)
    const newHeading = `<h${heading.level} ${newAttrs}>${heading.titleHtml}</h${heading.level}>`;
    
    // Replace in reverse order to preserve indices
    processedHtml = processedHtml.substring(0, heading.index) + 
                    newHeading + 
                    processedHtml.substring(heading.index + heading.fullMatch.length);
  }
  
  return processedHtml;
}

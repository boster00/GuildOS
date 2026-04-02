/**
 * Extract section outlines from HTML/markdown content
 * Extracts headers and ~25 words after each header as preview
 */

import { log } from "../ui/logger";

export interface SectionOutline {
  heading: string;
  level: number; // 1 for H1, 2 for H2, etc.
  preview: string; // ~25 words after header
  position: number; // order in document
}

export interface PageSectionOutline {
  url: string;
  title: string;
  sections: SectionOutline[];
}

/**
 * Extract ~25 words after a given position in text
 */
function extractPreviewWords(text: string, startPos: number, wordCount: number = 25): string {
  // Find the start of the next word after startPos
  let pos = startPos;
  while (pos < text.length && /\s/.test(text[pos])) {
    pos++;
  }
  
  // Extract words
  const words: string[] = [];
  let currentWord = "";
  let wordStart = pos;
  
  for (let i = pos; i < text.length && words.length < wordCount; i++) {
    const char = text[i];
    
    if (/\s/.test(char)) {
      if (currentWord.length > 0) {
        words.push(currentWord);
        currentWord = "";
      }
    } else {
      currentWord += char;
    }
  }
  
  // Add the last word if we hit the limit
  if (currentWord.length > 0 && words.length < wordCount) {
    words.push(currentWord);
  }
  
  return words.join(" ").trim();
}

/**
 * Extract section outlines from HTML content
 */
export function extractSectionOutlinesFromHtml(
  url: string,
  title: string,
  htmlContent: string
): PageSectionOutline {
  log(`[extractSectionOutlines] Extracting section outlines from HTML for: ${url}`);
  
  const sections: SectionOutline[] = [];
  
  // Remove script and style tags
  const cleanedHtml = htmlContent
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "");
  
  // Extract all headers (H1-H6) with their positions
  const headerRegex = /<(h[1-6])[^>]*>([\s\S]*?)<\/h[1-6]>/gi;
  const headerMatches: Array<{
    level: number;
    text: string;
    fullMatch: string;
    index: number;
  }> = [];
  
  let match;
  while ((match = headerRegex.exec(cleanedHtml)) !== null) {
    const level = parseInt(match[1].substring(1)); // Extract number from h1, h2, etc.
    const text = match[2].replace(/<[^>]+>/g, "").trim(); // Remove nested HTML tags
    
    if (text && text.length > 0) {
      headerMatches.push({
        level,
        text,
        fullMatch: match[0],
        index: match.index,
      });
    }
  }
  
  // Sort by position in document
  headerMatches.sort((a, b) => a.index - b.index);
  
  // Extract preview text for each header
  // Remove HTML tags for preview extraction
  const textContent = cleanedHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  
  headerMatches.forEach((header, idx) => {
    // Find the position of this header's text in the cleaned text content
    // We'll use the header's position in HTML as approximation
    const headerTextPos = textContent.indexOf(header.text, Math.max(0, header.index - 100));
    
    let previewStartPos = headerTextPos + header.text.length;
    if (previewStartPos < 0) {
      // Fallback: use position after header match
      previewStartPos = header.index + header.fullMatch.length;
    }
    
    const preview = extractPreviewWords(textContent, previewStartPos, 25);
    
    sections.push({
      heading: header.text,
      level: header.level,
      preview: preview || "", // Empty if no preview found
      position: idx + 1,
    });
  });
  
  log(`[extractSectionOutlines] Extracted ${sections.length} sections from ${url}`);
  
  return {
    url,
    title,
    sections,
  };
}

/**
 * Extract section outlines from markdown content
 */
export function extractSectionOutlinesFromMarkdown(
  url: string,
  title: string,
  markdownContent: string
): PageSectionOutline {
  log(`[extractSectionOutlines] Extracting section outlines from markdown for: ${url}`);
  
  const sections: SectionOutline[] = [];
  
  // Markdown header regex: # H1, ## H2, etc.
  const headerRegex = /^(#{1,6})\s+(.+)$/gm;
  const headerMatches: Array<{
    level: number;
    text: string;
    index: number;
  }> = [];
  
  let match;
  while ((match = headerRegex.exec(markdownContent)) !== null) {
    const level = match[1].length; // Number of # characters
    const text = match[2].trim();
    
    if (text && text.length > 0) {
      headerMatches.push({
        level,
        text,
        index: match.index,
      });
    }
  }
  
  // Sort by position
  headerMatches.sort((a, b) => a.index - b.index);
  
  // Extract preview text for each header
  headerMatches.forEach((header, idx) => {
    const previewStartPos = header.index + header.text.length + header.level + 1; // +1 for space
    const preview = extractPreviewWords(markdownContent, previewStartPos, 25);
    
    sections.push({
      heading: header.text,
      level: header.level,
      preview: preview || "",
      position: idx + 1,
    });
  });
  
  log(`[extractSectionOutlines] Extracted ${sections.length} sections from markdown for ${url}`);
  
  return {
    url,
    title,
    sections,
  };
}

/**
 * Main function to extract section outlines from HTML or markdown
 */
export function extractSectionOutlines(
  url: string,
  title: string,
  htmlContent: string,
  markdownContent?: string
): PageSectionOutline {
  // Prefer markdown if available, otherwise use HTML
  if (markdownContent) {
    return extractSectionOutlinesFromMarkdown(url, title, markdownContent);
  }
  
  return extractSectionOutlinesFromHtml(url, title, htmlContent);
}

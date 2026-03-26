// Utility functions for Article Refinement (JavaScript version for API routes)
import monkey from "@/libs/monkey";
import { generateSectionKey } from '../utils/sectionKeys';
import { detectSectionFormat, inferSectionPurpose } from '../utils/sectionFormatDetection';

/**
 * Call LLM and parse JSON response
 */
export async function callLLMAndParseJSON(prompt, options = {}) {
  try {
    const response = await monkey.AI(prompt, {
      forceJson: options.forceJson ?? true,
      vendor: "openai",
      model: process.env.AI_MODEL_STANDARD || "gpt-4o",
    });

    // Try to extract JSON if response is a string
    if (typeof response === 'string') {
      // Look for JSON in code blocks
      const jsonMatch = response.match(/```(?:json)?\s*(\{[\s\S]*\}|\[[\s\S]*\])\s*```/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1]);
      }
      
      // Look for JSON object/array directly
      const directMatch = response.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
      if (directMatch) {
        return JSON.parse(directMatch[1]);
      }
      
      // If it's just JSON, parse it
      try {
        return JSON.parse(response);
      } catch {
        throw new Error("Failed to parse JSON from LLM response");
      }
    }

    return response;
  } catch (error) {
    throw error;
  }
}

/**
 * Parse final review feedback from text format
 */
export function parseFinalReview(text) {
  const lines = text.split('\n').filter(line => line.trim());
  
  // Extract score
  const scoreMatch = text.match(/Score:\s*(\d+)\/100/i);
  const score = scoreMatch ? parseInt(scoreMatch[1]) : 0;
  
  // Extract verdict
  const verdictMatch = text.match(/Verdict:\s*(Good|Meh|Bad)/i);
  const verdict = (verdictMatch ? verdictMatch[1] : 'Meh');
  
  // Parse feedback rows
  const feedbackRows = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('!')) {
      const match = trimmed.match(/!\s*(.+?):\s*(.+)/);
      if (match) {
        feedbackRows.push({
          type: 'must_fix',
          label: match[1].trim(),
          text: match[2].trim(),
        });
      }
    } else if (trimmed.startsWith('✅')) {
      const match = trimmed.match(/✅\s*(.+?):\s*(.+)/);
      if (match) {
        feedbackRows.push({
          type: 'strength',
          label: match[1].trim(),
          text: match[2].trim(),
        });
      }
    } else if (trimmed.startsWith('→')) {
      const match = trimmed.match(/→\s*(.+?):\s*(.+)/);
      if (match) {
        feedbackRows.push({
          type: 'suggestion',
          label: match[1].trim(),
          text: match[2].trim(),
        });
      }
    }
  }
  
  return { score, verdict, feedbackRows };
}

/**
 * Extract outline sections from HTML content
 * Returns full structure with key, title, format, and purpose
 */
export function extractOutlineFromHtml(html) {
  if (!html || typeof html !== 'string') {
    return [];
  }
  
  const sections = [];
  const headingRegex = /<h([1-6])([^>]*)>(.*?)<\/h[1-6]>/gi;
  let match;
  let position = 0;
  
  while ((match = headingRegex.exec(html)) !== null) {
    const level = parseInt(match[1]);
    const attrs = match[2] || '';
    const titleHtml = match[3] || '';
    const titleText = titleHtml.replace(/<[^>]*>/g, '').trim();
    const fullMatch = match[0];
    
    if (!titleText) continue;
    
    // Extract data-section-key if present (hybrid approach)
    const dataKeyMatch = attrs.match(/data-section-key=["']([^"']+)["']/i);
    const existingKey = dataKeyMatch ? dataKeyMatch[1] : null;
    
    // Generate key: use existing or auto-generate from heading
    const key = existingKey || generateSectionKey(titleText);
    
    // Extract section HTML (from this heading to next heading or end)
    const headingIndex = match.index || 0;
    const nextHeadingMatch = headingRegex.exec(html);
    const sectionEnd = nextHeadingMatch ? (nextHeadingMatch.index || html.length) : html.length;
    const sectionHtml = html.substring(headingIndex, sectionEnd);
    
    // Detect format from HTML structure
    const format = detectSectionFormat(sectionHtml);
    
    // Extract purpose from data-purpose attribute or infer from content
    const dataPurposeMatch = attrs.match(/data-purpose=["']([^"']+)["']/i);
    const purpose = dataPurposeMatch ? dataPurposeMatch[1] : inferSectionPurpose(sectionHtml);
    
    sections.push({
      key,
      title: titleText, // Don't add indentation - keep original title
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


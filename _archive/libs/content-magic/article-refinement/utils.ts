// ARCHIVED: Original path was libs/content-magic/article-refinement/utils.ts

// Utility functions for Article Refinement

import monkey from "@/libs/monkey.js";

/**
 * Call LLM and parse JSON response
 */
export async function callLLMAndParseJSON(
  prompt: string,
  options: { forceJson?: boolean } = {}
): Promise<any> {
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
    console.error("LLM call error:", error);
    throw error;
  }
}

/**
 * Parse final review feedback from text format
 */
export function parseFinalReview(text: string): {
  score: number;
  verdict: 'Good' | 'Meh' | 'Bad';
  feedbackRows: Array<{
    type: 'must_fix' | 'strength' | 'suggestion';
    label: string;
    text: string;
  }>;
} {
  const lines = text.split('\n').filter(line => line.trim());
  
  // Extract score
  const scoreMatch = text.match(/Score:\s*(\d+)\/100/i);
  const score = scoreMatch ? parseInt(scoreMatch[1]) : 0;
  
  // Extract verdict
  const verdictMatch = text.match(/Verdict:\s*(Good|Meh|Bad)/i);
  const verdict = (verdictMatch ? verdictMatch[1] : 'Meh') as 'Good' | 'Meh' | 'Bad';
  
  // Parse feedback rows
  const feedbackRows: Array<{
    type: 'must_fix' | 'strength' | 'suggestion';
    label: string;
    text: string;
  }> = [];
  
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
import { generateSectionKey } from '../utils/sectionKeys';
import { detectSectionFormat, inferSectionPurpose } from '../utils/sectionFormatDetection';
import { Section } from '../types/sections';

export function extractOutlineFromHtml(html: string): Section[] {
  if (!html || typeof html !== 'string') {
    return [];
  }
  
  const sections: Section[] = [];
  
  // First, find all headings with their positions
  const headingRegex = /<h([1-6])([^>]*)>(.*?)<\/h[1-6]>/gi;
  const allMatches: Array<{
    level: number;
    attrs: string;
    titleHtml: string;
    titleText: string;
    index: number;
    fullMatch: string;
  }> = [];
  
  let match;
  while ((match = headingRegex.exec(html)) !== null) {
    const level = parseInt(match[1]);
    const attrs = match[2] || '';
    const titleHtml = match[3] || '';
    const titleText = titleHtml.replace(/<[^>]*>/g, '').trim();
    
    if (!titleText) continue;
    
    allMatches.push({
      level,
      attrs,
      titleHtml,
      titleText,
      index: match.index || 0,
      fullMatch: match[0],
    });
  }
  
  // Now process each heading to extract section info
  let position = 0;
  for (let i = 0; i < allMatches.length; i++) {
    const current = allMatches[i];
    const next = allMatches[i + 1];
    
    // Extract data-section-key if present
    const dataKeyMatch = current.attrs.match(/data-section-key=["']([^"']+)["']/i);
    const existingKey = dataKeyMatch ? dataKeyMatch[1] : null;
    
    // Generate key: use existing or auto-generate from heading
    const key = existingKey || generateSectionKey(current.titleText);
    
    // Extract section HTML (from this heading to next heading or end)
    const sectionStart = current.index;
    const sectionEnd = next ? next.index : html.length;
    const sectionHtml = html.substring(sectionStart, sectionEnd);
    
    // Detect format from HTML structure
    const format = detectSectionFormat(sectionHtml);
    
    // Extract purpose from data-purpose attribute or infer from content
    const dataPurposeMatch = current.attrs.match(/data-purpose=["']([^"']+)["']/i);
    const purpose = dataPurposeMatch ? dataPurposeMatch[1] : inferSectionPurpose(sectionHtml);
    
    sections.push({
      key,
      title: current.titleText,
      format,
      purpose: purpose || undefined,
      level: current.level,
      position: position++,
    });
  }
  
  return sections;
}


/**
 * HTML to Canonical Markdown Importer (AST-based)
 * 
 * Uses rehype-remark pipeline for robust HTML → Markdown conversion.
 * This is an alternative to the regex-based importer for better reliability.
 * 
 * @module libs/content-magic/importers/html-to-canonical-md-ast
 */

import { unified } from 'unified';
import rehypeParse from 'rehype-parse';
import rehypeRemark from 'rehype-remark';
import remarkStringify from 'remark-stringify';
import remarkGfm from 'remark-gfm';

/**
 * Main importer function using AST-based conversion
 * @param {string} html - Raw HTML content
 * @param {Object} options - Import options
 * @returns {Promise<{markdown: string, confidence: number, blocks: Array}>}
 */
export async function importHtmlToCanonicalMdAst(html, options = {}) {
  const {
    useLLMFallback = false,
    confidenceThreshold = 0.7,
  } = options;

  try {
    // Step 1: Clean up HTML (remove scripts, styles, etc.)
    const cleanedHtml = cleanupHTML(html);
    
    // Step 2: Extract main content region
    const mainContent = extractMainContent(cleanedHtml);
    
    // Step 3: Convert HTML to Markdown using AST pipeline
    const markdown = await convertHtmlToMarkdown(mainContent);
    
    // Step 4: Post-process markdown to add CJGEO canonical blocks (CTAs, Forms, FAQs)
    const canonicalMarkdown = await postProcessMarkdown(markdown, mainContent);
    
    // Step 5: Extract blocks for analysis
    const blocks = extractBlocksFromMarkdown(canonicalMarkdown);
    
    const confidence = calculateConfidence(blocks, canonicalMarkdown);
    
    return {
      markdown: canonicalMarkdown,
      confidence,
      blocks,
      hasMarkdown: canonicalMarkdown.length > 0,
      markdownLength: canonicalMarkdown.length,
      hasBlocks: blocks.length > 0,
      blocksCount: blocks.length,
      hasError: false,
      error: null,
    };
  } catch (error) {
    if (useLLMFallback) {
      // Could add LLM fallback here if needed
      throw error;
    }
    
    return {
      markdown: '',
      confidence: 0,
      blocks: [],
      hasMarkdown: false,
      markdownLength: 0,
      hasBlocks: false,
      blocksCount: 0,
      hasError: true,
      error: error.message,
    };
  }
}

/**
 * Clean up HTML by removing non-content elements
 */
function cleanupHTML(html) {
  if (!html || typeof html !== 'string') return '';
  
  // Remove script, style, noscript, template tags and their content
  let cleaned = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, '')
    .replace(/<template\b[^>]*>[\s\S]*?<\/template>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, ''); // Remove HTML comments
  
  // Remove SVG and canvas (optional, but helps reduce noise)
  cleaned = cleaned
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, '')
    .replace(/<canvas\b[^>]*>[\s\S]*?<\/canvas>/gi, '');
  
  return cleaned;
}

/**
 * Extract main content region from HTML
 */
function extractMainContent(html) {
  // Try to find main content container
  const mainMatch = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
  if (mainMatch) return mainMatch[1];
  
  const articleMatch = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i);
  if (articleMatch) return articleMatch[1];
  
  const roleMainMatch = html.match(/<div[^>]*role=["']main["'][^>]*>([\s\S]*?)<\/div>/i);
  if (roleMainMatch) return roleMainMatch[1];
  
  // Remove boilerplate containers
  let cleaned = html
    .replace(/<header\b[^>]*>[\s\S]*?<\/header>/gi, '')
    .replace(/<footer\b[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<nav\b[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<aside\b[^>]*>[\s\S]*?<\/aside>/gi, '');
  
  // Remove elements with boilerplate classes/ids
  const boilerplatePatterns = [
    /nav/i, /menu/i, /breadcrumb/i, /footer/i, /header/i,
    /cookie/i, /consent/i, /modal/i, /popup/i, /social/i,
    /share/i, /sidebar/i, /related/i, /recommended/i,
    /newsletter/i, /subscribe/i, /pagination/i, /pager/i
  ];
  
  // Remove divs/spans with boilerplate classes
  boilerplatePatterns.forEach(pattern => {
    cleaned = cleaned.replace(
      new RegExp(`<(div|span|section)\\b[^>]*(?:class|id)=["'][^"']*${pattern.source}[^"']*["'][^>]*>[\s\S]*?<\\/\\1>`, 'gi'),
      ''
    );
  });
  
  // Fallback to body content
  const bodyMatch = cleaned.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) return bodyMatch[1];
  
  return cleaned;
}

/**
 * Convert HTML to Markdown using rehype-remark pipeline
 */
async function convertHtmlToMarkdown(html) {
  try {
    const file = await unified()
      .use(rehypeParse, { fragment: true }) // Parse HTML
      .use(rehypeRemark) // Convert HAST to MDAST
      .use(remarkGfm) // Support GFM (tables, strikethrough, etc.)
      .use(remarkStringify, {
        bullet: '-', // Use - for unordered lists
        bulletOther: '*',
        bulletOrdered: '.', // Use 1. for ordered lists
        emphasis: '*',
        // Note: strong defaults to '**' in markdown, no need to specify
        fences: true,
        listItemIndent: 'one',
      })
      .process(html);
    
    return String(file);
  } catch (error) {
    throw error;
  }
}

/**
 * Post-process markdown to add CJGEO canonical blocks (CTAs, Forms, FAQs)
 * This scans the original HTML for special elements and injects canonical blocks
 */
async function postProcessMarkdown(markdown, originalHtml) {
  let processed = markdown;
  const blocks = [];
  
  // Extract CTAs from original HTML
  const ctaPattern = /<(button|a)\b[^>]*(?:class|id)=["'][^"']*(?:btn|button|cta)[^"']*["'][^>]*>([\s\S]*?)<\/(button|a)>/gi;
  let ctaMatch;
  let ctaCount = 0;
  
  while ((ctaMatch = ctaPattern.exec(originalHtml)) !== null) {
    const label = extractTextFromHtml(ctaMatch[2]);
    const href = ctaMatch[0].match(/href=["']([^"']+)["']/i)?.[1] || '';
    const target = href || (ctaMatch[1] === 'button' ? '' : '');
    
    if (label && label.trim().length > 0) {
      blocks.push({
        type: 'CTA',
        label,
        target,
        context: 'Top', // Could be enhanced to detect context
      });
      
      // Replace in markdown if found, or append
      const ctaBlock = `\n\n[[CTA]]\nLabel: ${label}\nTarget: ${target}\nContext: Top\n`;
      processed += ctaBlock;
      ctaCount++;
    }
  }
  
  // Extract Forms from original HTML
  const formPattern = /<form\b[^>]*>([\s\S]*?)<\/form>/gi;
  let formMatch;
  let formCount = 0;
  
  while ((formMatch = formPattern.exec(originalHtml)) !== null) {
    const formHtml = formMatch[1];
    const formName = formMatch[0].match(/(?:id|name)=["']([^"']+)["']/i)?.[1] || 'Form';
    
    // Extract fields
    const fieldPattern = /<(input|select|textarea)\b[^>]*>/gi;
    const fields = [];
    let fieldMatch;
    
    while ((fieldMatch = fieldPattern.exec(formHtml)) !== null) {
      const fieldLabel = 
        fieldMatch[0].match(/aria-label=["']([^"']+)["']/i)?.[1] ||
        fieldMatch[0].match(/placeholder=["']([^"']+)["']/i)?.[1] ||
        fieldMatch[0].match(/(?:name|id)=["']([^"']+)["']/i)?.[1] ||
        fieldMatch[0].match(/type=["']([^"']+)["']/i)?.[1] || 'field';
      
      fields.push(fieldLabel);
    }
    
    // Extract submit button
    const submitMatch = formHtml.match(/<(button|input)\b[^>]*type=["']submit["'][^>]*>([\s\S]*?)<\/(button|input)>/i);
    const submitLabel = submitMatch 
      ? (submitMatch[2] || submitMatch[0].match(/value=["']([^"']+)["']/i)?.[1] || 'Submit')
      : 'Submit';
    
    if (fields.length > 0 || formName !== 'Form') {
      blocks.push({
        type: 'FORM',
        name: formName,
        fields: fields.join('; '),
        submit: extractTextFromHtml(submitLabel),
      });
      
      const formBlock = `\n\n[[FORM]]\nName: ${formName}\nFields: ${fields.join('; ')}\nSubmit: ${extractTextFromHtml(submitLabel)}\nContext: Top\n`;
      processed += formBlock;
      formCount++;
    }
  }
  
  // Extract FAQs (details/summary elements)
  const faqPattern = /<details\b[^>]*>[\s\S]*?<summary\b[^>]*>([\s\S]*?)<\/summary>[\s\S]*?<\/details>/gi;
  let faqMatch;
  let faqCount = 0;
  
  while ((faqMatch = faqPattern.exec(originalHtml)) !== null) {
    const question = extractTextFromHtml(faqMatch[1]);
    const answerMatch = faqMatch[0].match(/<\/summary>([\s\S]*?)<\/details>/i);
    const answer = answerMatch ? extractTextFromHtml(answerMatch[1]) : '';
    
    if (question && question.trim().length > 0) {
      blocks.push({
        type: 'FAQ',
        question,
        answer,
      });
      
      const faqBlock = `\n\n[[FAQ]]\nQ: ${question}\nA: ${answer}\n`;
      processed += faqBlock;
      faqCount++;
    }
  }
  return processed;
}

/**
 * Extract text from HTML (simple version)
 */
function extractTextFromHtml(html) {
  if (!html) return '';
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract blocks from markdown for analysis
 */
function extractBlocksFromMarkdown(markdown) {
  const blocks = [];
  
  // Extract headings
  const headingRegex = /^(#{1,6})\s+(.+)$/gm;
  let headingMatch;
  while ((headingMatch = headingRegex.exec(markdown)) !== null) {
    blocks.push({
      type: 'heading',
      level: headingMatch[1].length,
      text: headingMatch[2],
    });
  }
  
  // Extract lists
  const listRegex = /^([-*]|\d+\.)\s+(.+)$/gm;
  let listMatch;
  while ((listMatch = listRegex.exec(markdown)) !== null) {
    blocks.push({
      type: 'list',
      text: listMatch[2],
    });
  }
  
  // Extract paragraphs (non-empty lines that aren't headings, lists, or special blocks)
  const paragraphRegex = /^([^#\-\*\d\[\n].+)$/gm;
  let paraMatch;
  while ((paraMatch = paragraphRegex.exec(markdown)) !== null) {
    const text = paraMatch[1].trim();
    if (text.length > 40 && !text.startsWith('[[')) {
      blocks.push({
        type: 'paragraph',
        text,
      });
    }
  }
  
  // Extract special blocks
  const ctaRegex = /\[\[CTA\]\]\nLabel:\s*(.+)\nTarget:\s*(.+)\nContext:\s*(.+)/g;
  let ctaMatch;
  while ((ctaMatch = ctaRegex.exec(markdown)) !== null) {
    blocks.push({
      type: 'CTA',
      label: ctaMatch[1],
      target: ctaMatch[2],
      context: ctaMatch[3],
    });
  }
  
  const formRegex = /\[\[FORM\]\]\nName:\s*(.+)\nFields:\s*(.+)\nSubmit:\s*(.+)\nContext:\s*(.+)/g;
  let formMatch;
  while ((formMatch = formRegex.exec(markdown)) !== null) {
    blocks.push({
      type: 'FORM',
      name: formMatch[1],
      fields: formMatch[2],
      submit: formMatch[3],
    });
  }
  
  return blocks;
}

/**
 * Calculate confidence score
 */
function calculateConfidence(blocks, markdown) {
  if (!markdown || markdown.trim().length === 0) return 0;
  
  const hasHeadings = blocks.some(b => b.type === 'heading');
  const hasContent = blocks.some(b => b.type === 'paragraph' || b.type === 'list');
  const blockCount = blocks.length;
  
  let confidence = 0.5; // Base confidence
  
  if (hasHeadings) confidence += 0.2;
  if (hasContent) confidence += 0.2;
  if (blockCount > 5) confidence += 0.1;
  
  return Math.min(confidence, 1.0);
}

/**
 * HTML to Canonical Markdown Importer (CJ Test Method)
 * 
 * Simple algorithm:
 * 1. Retain specific HTML tags and their content
 * 2. Delete specific HTML tags and their content completely
 * 3. Replace everything else with placeholder tags (defined below)
 * 
 * @module libs/content-magic/importers/html-to-canonical-md-cj
 */

import * as cheerio from 'cheerio';

// Placeholder tags for unwrapped content
// To disable placeholders, set both to empty string
// const PLACEHOLDER_START = '<p>';
// const PLACEHOLDER_END = '</p>';
const PLACEHOLDER_START = '';
const PLACEHOLDER_END = '';

/**
 * Main importer function using CJ test method
 * @param {string} html - Raw HTML content
 * @param {Object} options - Import options
 * @returns {Promise<{markdown: string, confidence: number, blocks: Array}>}
 */
export async function importHtmlToCanonicalMdCj(html, options = {}) {
  const {
    useLLMFallback = false,
    confidenceThreshold = 0.7,
  } = options;

  try {
    // Tags to retain (keep as-is with their content)
    const RETAIN_TAGS = [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'a', 'button', 'i', 'img', 'object', 'obj', 'video',
    ];

    // Tags to delete completely (remove tag and all its content)
    const DELETE_TAGS = [
      'script', 'style', 'noscript', 'template',
      'svg', 'canvas', // Optional noise elements
    ];

    // Step 1: Load HTML into Cheerio
    const $ = cheerio.load(html, {
      xml: false,
      decodeEntities: false,
    });

    // Step 2: Remove boilerplate containers (header, footer, nav, aside)
    $('header, footer, nav, aside').remove();

    // Step 3: Extract main content region if available
    let $content = $('main').first();
    if ($content.length === 0) {
      $content = $('article').first();
    }
    if ($content.length === 0) {
      $content = $('[role="main"]').first();
    }
    if ($content.length === 0) {
      $content = $('body');
    }
    if ($content.length === 0) {
      $content = $.root();
    }

    // Work with the content region
    const $workArea = $content.length > 0 && $content[0] !== $.root()[0] 
      ? $content 
      : $.root();

    // Step 4: Delete specified tags and their content
    DELETE_TAGS.forEach(tag => {
      $workArea.find(tag).remove();
    });

    // Step 5: Recursively process all elements in-place using DOM manipulation
    // Process top-level nodes recursively (each node processes itself and its children)
    $workArea.contents().each(function() {
      const $node = $(this);
      cjRenderElement($, this, $node, RETAIN_TAGS, DELETE_TAGS, PLACEHOLDER_START, PLACEHOLDER_END);
    });
    
    // Step 6: Get the processed HTML
    let processedHtml = $workArea.html() || '';
    
    // Step 7: Clean up any remaining unwanted elements at the root level
    processedHtml = processedHtml.replace(/<!--[\s\S]*?-->/g, ''); // Remove comments
    
    // Step 8: Deduplicate placeholders (keep replacing doubles to single until no double is detected)
    if (PLACEHOLDER_START && PLACEHOLDER_END) {
      // Escape special regex characters in placeholders
      const escapedStart = PLACEHOLDER_START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const escapedEnd = PLACEHOLDER_END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      
      // Deduplicate consecutive PLACEHOLDER_START and PLACEHOLDER_END
      let previousHtml = '';
      while (previousHtml !== processedHtml) {
        previousHtml = processedHtml;
        // Replace double PLACEHOLDER_START with single
        processedHtml = processedHtml.replace(
          new RegExp(`${escapedStart}${escapedStart}`, 'g'),
          PLACEHOLDER_START
        );
        // Replace double PLACEHOLDER_END with single
        processedHtml = processedHtml.replace(
          new RegExp(`${escapedEnd}${escapedEnd}`, 'g'),
          PLACEHOLDER_END
        );
        // Replace consecutive PLACEHOLDER_END followed by PLACEHOLDER_START with single pair
        processedHtml = processedHtml.replace(
          new RegExp(`${escapedEnd}\\s*${escapedStart}`, 'g'),
          PLACEHOLDER_END + PLACEHOLDER_START
        );
      }
      
      // Normalize whitespace around placeholders
      processedHtml = processedHtml.replace(new RegExp(`\\s*${escapedStart}\\s*`, 'g'), PLACEHOLDER_START);
      processedHtml = processedHtml.replace(new RegExp(`\\s*${escapedEnd}\\s*`, 'g'), PLACEHOLDER_END);
      processedHtml = processedHtml.replace(new RegExp(`${escapedStart}\\s+${escapedEnd}`, 'g'), `${PLACEHOLDER_START}${PLACEHOLDER_END}`); // Empty placeholders
    }

    processedHtml = processedHtml.replace(/<p><\/p>/g, '');
    
    // Extract blocks for analysis
    const blocks = extractBlocksFromHtml(processedHtml, RETAIN_TAGS);
    
    const confidence = calculateConfidence(blocks, processedHtml);
    
    return {
      markdown: processedHtml,
      confidence,
      blocks,
      hasMarkdown: processedHtml.length > 0,
      markdownLength: processedHtml.length,
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
 * Recursively render an element using CJ test method (simple recursive pattern)
 * Core loop: process children first, then drop attributes, then conditionally drop/retain/unwrap parent
 * @param {Cheerio} $ - Cheerio instance
 * @param {Node} parent - Element or text node to process
 * @param {Cheerio} $parent - Cheerio wrapper for the parent
 * @param {string[]} RETAIN_TAGS - Tags to retain
 * @param {string[]} DELETE_TAGS - Tags to delete
 * @param {string} PLACEHOLDER_START - Start placeholder string
 * @param {string} PLACEHOLDER_END - End placeholder string
 * @returns {Node|null} - Returns the parent element (or null if deleted)
 */
function cjRenderElement($, parent, $parent, RETAIN_TAGS, DELETE_TAGS, PLACEHOLDER_START, PLACEHOLDER_END) {
  if (!parent) return null;
  
  // Handle text nodes - wrap with placeholders if enabled
  if (parent.type === 'text') {
    const text = (parent.data || '').trim();
    if (text && PLACEHOLDER_START && PLACEHOLDER_END) {
      parent.data = `${PLACEHOLDER_START}${text}${PLACEHOLDER_END}`;
    } else if (!text) {
      // Empty text node - remove it
      if ($parent.length > 0) {
        $parent.remove();
      }
      return null;
    }
    return parent;
  }
  
  // Handle non-tag elements (comments, etc.) - remove them
  if (parent.type !== 'tag') {
    if ($parent.length > 0) {
      $parent.remove();
    }
    return null;
  }
  
  const tagName = parent.name?.toLowerCase();
  
  // Step 1: Process children first (recursive)
  if (parent.children && parent.children.length > 0) {
    // Get children as array (need to collect before processing, as DOM will change)
    const children = Array.from(parent.children);
    children.forEach(child => {
      const $child = $(child);
      cjRenderElement($, child, $child, RETAIN_TAGS, DELETE_TAGS, PLACEHOLDER_START, PLACEHOLDER_END);
    });
  }
  
  // Step 2: Drop attributes for parent (applies to all elements)
  dropAttributes($, parent, $parent, tagName);
  
  // Step 3: Conditionally drop entire parent, replace outerHTML with innerHTML, or retain as-is
  if (DELETE_TAGS.includes(tagName)) {
    // Drop entire parent
    if ($parent.length > 0) {
      $parent.remove();
    }
    return null;
  }
  
  if (RETAIN_TAGS.includes(tagName)) {
    // Retain parent as-is (already cleaned attributes in step 2)
    return parent;
  }
  
  // Replace parent's outerHTML with innerHTML (unwrap)
  if ($parent.length > 0) {
    // Check if parent is a blocky element (block-level elements)
    const BLOCKY_TAGS = ['div', 'section', 'article', 'header', 'footer', 'main', 'aside', 'nav', 'p', 'blockquote', 'pre'];
    const isBlocky = BLOCKY_TAGS.includes(tagName);
    
    if (isBlocky && $parent.html() !='') {
      // Wrap contents with placeholders for blocky elements
      const contentsHtml = $parent.html() || '';
      $parent.replaceWith(`<p>${PLACEHOLDER_START}${contentsHtml}${PLACEHOLDER_END}</p>`);
    } else {
      // Regular unwrap for non-blocky elements
      $parent.replaceWith($parent.contents());
    }
  }
  // Note: After unwrapping, the parent no longer exists, but its children do
  // We return null to indicate the parent was replaced
  return null;
}

/**
 * Drop attributes for an element based on whitelist
 * @param {Cheerio} $ - Cheerio instance
 * @param {Node} element - Element node
 * @param {Cheerio} $element - Cheerio wrapper for the element
 * @param {string} tagName - Tag name (lowercase)
 */
function dropAttributes($, element, $element, tagName) {
  if (!element.attribs || $element.length === 0) return;
  
  // Unified attribute whitelist (applies to all element types)
  const ATTR_WHITELIST = ['href', 'src', 'alt', 'poster', 'data'];
  
  // Special handling for img tags: if data-src exists, use it to replace src
  if (tagName === 'img' && element.attribs['data-src']) {
    $element.attr('src', element.attribs['data-src']);
  }
  
  // Go through all attributes and remove non-whitelisted ones
  Object.keys(element.attribs).forEach(attr => {
    // Skip data-src for img (already converted to src above)
    if (tagName === 'img' && attr === 'data-src') {
      $element.removeAttr(attr);
      return;
    }
    
    // Remove attributes not in whitelist
    if (!ATTR_WHITELIST.includes(attr)) {
      $element.removeAttr(attr);
    }
  });
  
  // For img tags, limit size to max 150px wide and 150px tall
  if (tagName === 'img' && $element.length > 0) {
    $element.attr('style', 'max-width: 150px; max-height: 150px;');
  }
}


/**
 * Extract blocks from processed HTML for analysis
 */
function extractBlocksFromHtml(html, retainTags) {
  const blocks = [];
  const $ = cheerio.load(html);
  
  // Extract headings
  $('h1, h2, h3, h4, h5, h6').each(function() {
    blocks.push({
      type: 'heading',
      level: parseInt(this.tagName.substring(1)),
      text: $(this).text().trim(),
    });
  });
  
  // Extract lists
  $('ul, ol').each(function() {
    const items = [];
    $(this).find('li').each(function() {
      items.push($(this).text().trim());
    });
    blocks.push({
      type: 'list',
      ordered: this.tagName.toLowerCase() === 'ol',
      items,
    });
  });
  
  // Extract tables
  $('table').each(function() {
    const rows = [];
    $(this).find('tr').each(function() {
      const cells = [];
      $(this).find('th, td').each(function() {
        cells.push($(this).text().trim());
      });
      rows.push(cells);
    });
    blocks.push({
      type: 'table',
      rows,
    });
  });
  
  // Extract links
  $('a').each(function() {
    blocks.push({
      type: 'link',
      text: $(this).text().trim(),
      href: $(this).attr('href') || '',
    });
  });
  
  // Extract images
  $('img').each(function() {
    blocks.push({
      type: 'image',
      alt: $(this).attr('alt') || '',
      src: $(this).attr('src') || '',
    });
  });
  
  // Count placeholders (if they're enabled)
  // Note: This uses the actual placeholder strings, not constants, since this is a utility function
  const placeholderMatches = html.match(/\|CJSlug\|/g);
  if (placeholderMatches) {
    blocks.push({
      type: 'placeholder',
      count: placeholderMatches.length,
    });
  }
  
  return blocks;
}

/**
 * Calculate confidence score
 */
function calculateConfidence(blocks, html) {
  if (!html || html.trim().length === 0) return 0;
  
  const hasHeadings = blocks.some(b => b.type === 'heading');
  const hasLists = blocks.some(b => b.type === 'list');
  const hasTables = blocks.some(b => b.type === 'table');
  const hasLinks = blocks.some(b => b.type === 'link');
  const blockCount = blocks.length;
  
  let confidence = 0.3; // Base confidence
  
  if (hasHeadings) confidence += 0.2;
  if (hasLists) confidence += 0.15;
  if (hasTables) confidence += 0.1;
  if (hasLinks) confidence += 0.1;
  if (blockCount > 5) confidence += 0.15;
  
  return Math.min(confidence, 1.0);
}

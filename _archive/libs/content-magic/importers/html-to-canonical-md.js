// ARCHIVED: Original path was libs/content-magic/importers/html-to-canonical-md.js

/**
 * HTML to Canonical Markdown Importer
 * 
 * Converts arbitrary HTML pages into CJGEO Canonical Markdown format.
 * Focus: Semantic structure preservation, noise removal, deterministic first.
 * 
 * @module libs/content-magic/importers/html-to-canonical-md
 */

/**
 * Canonical Block Types
 */
const BLOCK_TYPES = {
  HEADING: 'heading',
  PARAGRAPH: 'paragraph',
  LIST: 'list',
  TABLE: 'table',
  CTA: 'cta',
  FORM: 'form',
  FAQ: 'faq',
};

/**
 * Noise removal patterns (deterministic)
 */
const NOISE_PATTERNS = {
  // Tags to remove entirely
  REMOVE_TAGS: ['header', 'footer', 'nav', 'aside', 'script', 'style', 'noscript'],
  
  // Class/ID patterns to remove
  REMOVE_CLASSES: [
    /nav/i,
    /menu/i,
    /breadcrumb/i,
    /footer/i,
    /header/i,
    /cookie/i,
    /consent/i,
    /popup/i,
    /modal/i,
    /social/i,
    /share/i,
    /sidebar/i,
    /related/i,
    /recommended/i,
    /newsletter/i,
    /subscribe/i,
  ],
  
  // Boilerplate phrases to filter
  BOILERPLATE_PHRASES: [
    'Privacy Policy',
    'Terms of Service',
    'Accept Cookies',
    'Cookie Policy',
    'Terms and Conditions',
  ],
};

/**
 * Main importer function
 * @param {string} html - Raw HTML content
 * @param {Object} options - Import options
 * @returns {Promise<{markdown: string, confidence: number, blocks: Array}>}
 */
export async function importHtmlToCanonicalMd(html, options = {}) {
  const {
    useLLMFallback = true,
    confidenceThreshold = 0.7,
  } = options;

  // Track test string through conversion pipeline
  const testString = "Review Final Touch-Ups";
  console.log(`[HTML-TO-MD] ===== Tracking test string: "${testString}" =====`);
  
  // Check initial HTML
  const foundInInitialHtml = html.includes(testString);
  if (foundInInitialHtml) {
    console.log(`[HTML-TO-MD] ✅ Step 0 (Initial HTML): Test string "${testString}" FOUND`);
    const index = html.indexOf(testString);
    const context = html.substring(Math.max(0, index - 150), Math.min(html.length, index + testString.length + 150));
    console.log(`[HTML-TO-MD] Context (300 chars): ${context}`);
  } else {
    console.error(`[HTML-TO-MD] ❌ Step 0 (Initial HTML): Test string "${testString}" NOT FOUND`);
  }

  // Step 1: DOM cleanup
  const cleanedHtml = cleanupDOM(html);
  const foundAfterCleanup = cleanedHtml.includes(testString);
  if (foundAfterCleanup) {
    console.log(`[HTML-TO-MD] ✅ Step 1 (After cleanupDOM): Test string "${testString}" FOUND`);
  } else {
    console.error(`[HTML-TO-MD] ❌ Step 1 (After cleanupDOM): Test string "${testString}" REMOVED during DOM cleanup!`);
    if (foundInInitialHtml) {
      const index = html.indexOf(testString);
      const context = html.substring(Math.max(0, index - 150), Math.min(html.length, index + testString.length + 150));
      console.log(`[HTML-TO-MD] Original context where it was removed: ${context}`);
    }
  }
  
  // Step 2: Main content detection
  const mainContent = detectMainContent(cleanedHtml);
  const foundAfterMainContent = mainContent.includes(testString);
  if (foundAfterMainContent) {
    console.log(`[HTML-TO-MD] ✅ Step 2 (After detectMainContent): Test string "${testString}" FOUND`);
    // Find the HTML structure around the test string
    const index = mainContent.indexOf(testString);
    const contextHtml = mainContent.substring(Math.max(0, index - 500), Math.min(mainContent.length, index + testString.length + 500));
    console.log(`[HTML-TO-MD] HTML context around test string (1000 chars): ${contextHtml}`);
    
    // Try to identify what HTML element contains it
    const beforeString = mainContent.substring(Math.max(0, index - 200), index);
    const afterString = mainContent.substring(index + testString.length, Math.min(mainContent.length, index + testString.length + 200));
    
    // Find the opening tag before the string
    const lastOpenTag = beforeString.lastIndexOf('<');
    const lastCloseTag = beforeString.lastIndexOf('>');
    if (lastOpenTag > lastCloseTag && lastOpenTag > -1) {
      const tagMatch = beforeString.substring(lastOpenTag).match(/<(\w+)[^>]*>/);
      if (tagMatch) {
        console.log(`[HTML-TO-MD] Test string appears to be inside: <${tagMatch[1]}> tag`);
        console.log(`[HTML-TO-MD] Full tag: ${beforeString.substring(lastOpenTag, Math.min(beforeString.length, lastOpenTag + 200))}`);
      }
    }
  } else {
    console.error(`[HTML-TO-MD] ❌ Step 2 (After detectMainContent): Test string "${testString}" REMOVED during main content detection!`);
  }
  
  // Step 3: Element extraction by taxonomy
  const blocks = extractBlocks(mainContent);
  // Check if test string exists in any block
  const foundInBlocks = blocks.some(block => {
    if (block.text && block.text.includes(testString)) return true;
    if (block.items && block.items.some(item => item.includes && item.includes(testString))) return true;
    return false;
  });
  if (foundInBlocks) {
    console.log(`[HTML-TO-MD] ✅ Step 3 (After extractBlocks): Test string "${testString}" FOUND in blocks`);
    const blockWithString = blocks.find(block => {
      if (block.text && block.text.includes(testString)) return true;
      if (block.items && block.items.some(item => item.includes && item.includes(testString))) return true;
      return false;
    });
    console.log(`[HTML-TO-MD] Block type containing test string: ${blockWithString?.type || 'unknown'}`);
    console.log(`[HTML-TO-MD] Block content preview: ${JSON.stringify(blockWithString).substring(0, 200)}`);
  } else {
    console.error(`[HTML-TO-MD] ❌ Step 3 (After extractBlocks): Test string "${testString}" NOT FOUND in any blocks - REMOVED during block extraction!`);
    console.log(`[HTML-TO-MD] Total blocks extracted: ${blocks.length}`);
    console.log(`[HTML-TO-MD] Block types: ${blocks.map(b => b.type).join(', ')}`);
  }
  
  // Step 4: Canonical markdown conversion
  const markdown = convertToCanonicalMarkdown(blocks);
  const foundInMarkdown = markdown.includes(testString);
  if (foundInMarkdown) {
    console.log(`[HTML-TO-MD] ✅ Step 4 (After convertToCanonicalMarkdown): Test string "${testString}" FOUND in markdown`);
    const index = markdown.indexOf(testString);
    const context = markdown.substring(Math.max(0, index - 100), Math.min(markdown.length, index + testString.length + 100));
    console.log(`[HTML-TO-MD] Markdown context (200 chars): ${context}`);
  } else {
    console.error(`[HTML-TO-MD] ❌ Step 4 (After convertToCanonicalMarkdown): Test string "${testString}" REMOVED during markdown conversion!`);
  }
  
  // Step 5: Confidence scoring
  const confidence = scoreConfidence(blocks, markdown);
  
  // Step 6: LLM fallback if needed
  let finalMarkdown = markdown;
  let usedLLM = false;
  
  if (useLLMFallback && confidence < confidenceThreshold) {
    finalMarkdown = await llmRescuePass(blocks, markdown, html);
    usedLLM = true;
    const foundAfterLLM = finalMarkdown.includes(testString);
    if (foundAfterLLM) {
      console.log(`[HTML-TO-MD] ✅ Step 5 (After LLM fallback): Test string "${testString}" FOUND`);
    } else {
      console.error(`[HTML-TO-MD] ❌ Step 5 (After LLM fallback): Test string "${testString}" REMOVED during LLM processing!`);
    }
  }
  
  console.log(`[HTML-TO-MD] ===== Test string tracking complete =====`);
  
  return {
    markdown: finalMarkdown,
    confidence,
    blocks: blocks.length,
    usedLLM,
  };
}

/**
 * Clean up DOM - remove scripts, styles, nav, footer, etc.
 */
function cleanupDOM(html) {
  let cleaned = html;
  
  // Remove HTML comments
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '');
  
  // Remove entire head section
  cleaned = cleaned.replace(/<head\b[^>]*>[\s\S]*?<\/head>/gi, '');
  
  // Remove noise tags entirely
  NOISE_PATTERNS.REMOVE_TAGS.forEach(tag => {
    const regex = new RegExp(`<${tag}\\b[^>]*>[\s\S]*?<\\/${tag}>`, 'gi');
    cleaned = cleaned.replace(regex, '');
  });
  
  // Remove elements by class/id patterns
  NOISE_PATTERNS.REMOVE_CLASSES.forEach(pattern => {
    const regex = new RegExp(`<[^>]*(?:class|id)=["'][^"']*${pattern.source}[^"']*["'][^>]*>[\s\S]*?<\/[^>]+>`, 'gi');
    cleaned = cleaned.replace(regex, '');
  });
  
  // Remove script and style tags (in case they weren't caught above)
  cleaned = cleaned.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  cleaned = cleaned.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  
  // Remove meta, link tags
  cleaned = cleaned.replace(/<meta\b[^>]*>/gi, '');
  cleaned = cleaned.replace(/<link\b[^>]*>/gi, '');
  
  return cleaned;
}

/**
 * Detect main content area using heuristics
 */
function detectMainContent(html) {
  // Try to find <main>, <article>, or <div role="main">
  const mainMatch = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
  if (mainMatch) return mainMatch[1];
  
  const articleMatch = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i);
  if (articleMatch) return articleMatch[1];
  
  const roleMainMatch = html.match(/<div[^>]*role=["']main["'][^>]*>([\s\S]*?)<\/div>/i);
  if (roleMainMatch) return roleMainMatch[1];
  
  // Fallback: find body content
  const bodyMatch = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) return bodyMatch[1];
  
  return html;
}

/**
 * Extract blocks by taxonomy
 */
function extractBlocks(html) {
  const blocks = [];
  let remainingHtml = html;
  const testString = "Review Final Touch-Ups";
  
  console.log(`[HTML-TO-MD] [extractBlocks] ===== Starting block extraction =====`);
  const foundAtStart = html.includes(testString);
  if (foundAtStart) {
    console.log(`[HTML-TO-MD] [extractBlocks] ✅ Test string "${testString}" FOUND in input HTML`);
    const index = html.indexOf(testString);
    const context = html.substring(Math.max(0, index - 200), Math.min(html.length, index + testString.length + 200));
    console.log(`[HTML-TO-MD] [extractBlocks] Context (400 chars): ${context}`);
  } else {
    console.error(`[HTML-TO-MD] [extractBlocks] ❌ Test string "${testString}" NOT FOUND in input HTML`);
  }
  
  // Extract headings (h1-h6) - handle nested HTML tags
  const headingRegex = /<(h[1-6])\b[^>]*>([\s\S]*?)<\/h[1-6]>/gi;
  let headingMatch;
  const headingPositions = [];
  const regularHeadingSeenByText = new Set();
  
  while ((headingMatch = headingRegex.exec(html)) !== null) {
    const level = parseInt(headingMatch[1].substring(1));
    let headingContent = headingMatch[2];
    
    // Clean any leaked attributes
    headingContent = headingContent.replace(/;\s*["'][^"']*["']\s*data-[^=]*=["'][^"']*["']/gi, '');
    headingContent = headingContent.replace(/data-[^=]*=["'][^"']*["']/gi, '');
    headingContent = headingContent.replace(/;\s*["'][^"']*["']/g, '');
    
    // Extract text from heading content, handling nested HTML tags
    // Use preserveLinks=false to get clean text for headings
    const text = extractText(headingContent, false).trim();
    const normalizedText = text.toLowerCase().replace(/\s+/g, ' ').trim();
    
    // Skip duplicates
    if (regularHeadingSeenByText.has(normalizedText)) continue;
    
    if (text && text.length > 0) {
      headingPositions.push({
        position: headingMatch.index,
        level,
        text,
        match: headingMatch[0],
      });
      
      regularHeadingSeenByText.add(normalizedText);
    }
  }
  
  // Extract div-based headings (e.g., <div class="elementor-heading-title">, <div class="heading">, etc.)
  // These are common in modern CMSs like Elementor, WordPress, etc.
  // Use a more comprehensive pattern that handles nested structures
  // Match divs with heading-related classes/ids, or divs containing only short text (likely headings)
  const divHeadingPatterns = [
    // Pattern 1: Explicit heading classes/ids - use balanced tag matching to avoid capturing attributes from adjacent elements
    /<div\b[^>]*(?:class|id)=["'][^"']*(?:heading|title|h[1-6]|headline|subtitle|section-title|widget-title|entry-title|post-title|page-title|step|section-header)[^"']*["'][^>]*>((?:[^<]|<(?!\/div\b)[^>]*>)*?)<\/div>/gi,
    // Pattern 2: Divs with elementor widget types that are headings
    /<div\b[^>]*data-widget_type=["']heading[^"']*["'][^>]*>((?:[^<]|<(?!\/div\b)[^>]*>)*?)<\/div>/gi,
  ];
  
  let divHeadingMatch;
  const divHeadingPositions = [];
  const divHeadingSeenByPosition = new Set(); // Avoid duplicates by position
  const divHeadingSeenByText = new Set(); // Avoid duplicates by normalized text
  
  divHeadingPatterns.forEach((divHeadingRegex, patternIndex) => {
    divHeadingRegex.lastIndex = 0;
    
    while ((divHeadingMatch = divHeadingRegex.exec(html)) !== null) {
      // Skip if we've already seen this position (avoid duplicates from multiple patterns)
      if (divHeadingSeenByPosition.has(divHeadingMatch.index)) continue;
      
      // Extract content and clean it more aggressively to remove any leaked attributes
      let headingContent = divHeadingMatch[1];
      
      // Remove any HTML attributes that might have leaked in (e.g., data-anim-type, etc.)
      // This handles cases where malformed HTML causes attributes to appear in content
      headingContent = headingContent.replace(/;\s*["'][^"']*["']\s*data-[^=]*=["'][^"']*["']/gi, '');
      headingContent = headingContent.replace(/data-[^=]*=["'][^"']*["']/gi, '');
      headingContent = headingContent.replace(/;\s*["'][^"']*["']/g, '');
      
      const text = extractText(headingContent, false).trim();
      
      // Normalize text for deduplication (lowercase, remove extra spaces)
      const normalizedText = text.toLowerCase().replace(/\s+/g, ' ').trim();
      
      // Skip if we've already seen this exact text (avoid duplicates like "Step 2:" and "Step 2: Build Framework")
      if (divHeadingSeenByText.has(normalizedText)) {
        console.log(`[HTML-TO-MD] [extractBlocks] ⚠️ Skipping duplicate heading by text: "${text.substring(0, 50)}..."`);
        continue;
      }
      
      // Only treat as heading if text is relatively short (headings are usually concise)
      // and not too long (to avoid capturing regular content divs)
      // Increased limit to 300 to catch longer headings like "Steps for Remodeling Home in the SF Bay Area"
      if (text && text.length > 0 && text.length < 300) {
        // Try to infer heading level from class/id or default to h2
        let level = 2; // Default to h2
        const fullMatch = divHeadingMatch[0];
        const classId = (fullMatch.match(/(?:class|id)=["']([^"']+)["']/i) || [])[1] || '';
        
        // Check for step patterns (Step 1, Step 2, etc.) - these are usually h2
        // But prefer full step text over partial (e.g., "Step 2: Build Framework" over "Step 2:")
        if (text.match(/^Step\s+\d+:/i)) {
          level = 2;
        } else if (classId.match(/h1|heading-1|title-1|headline-1|elementor-heading-title[^"]*elementor-size-default|elementor-size-xl|elementor-size-xxl/i)) {
          level = 1;
        } else if (classId.match(/h2|heading-2|title-2|headline-2|elementor-size-large/i)) {
          level = 2;
        } else if (classId.match(/h3|heading-3|title-3|headline-3|elementor-size-medium/i)) {
          level = 3;
        } else if (classId.match(/h4|heading-4|title-4|headline-4|elementor-size-small/i)) {
          level = 4;
        } else if (classId.match(/h5|heading-5|title-5|headline-5/i)) {
          level = 5;
        } else if (classId.match(/h6|heading-6|title-6|headline-6/i)) {
          level = 6;
        }
        
        divHeadingPositions.push({
          position: divHeadingMatch.index,
          level,
          text,
          match: fullMatch,
        });
        
        divHeadingSeenByPosition.add(divHeadingMatch.index);
        divHeadingSeenByText.add(normalizedText);
        
        if (text.includes(testString)) {
          console.log(`[HTML-TO-MD] [extractBlocks] ✅ Test string "${testString}" found in div-based heading (level ${level}, pattern ${patternIndex + 1})`);
        }
      } else if (headingContent.includes(testString)) {
        console.log(`[HTML-TO-MD] [extractBlocks] ⚠️ Test string "${testString}" in div heading but text too long (${text.length} chars) or empty`);
      }
    }
  });
  
  // Extract span-based headings (less common but possible)
  const spanHeadingRegex = /<span\b[^>]*(?:class|id)=["'][^"']*(?:heading|title|h[1-6]|headline|subtitle)[^"']*["'][^>]*>((?:[^<]|<(?!\/span\b)[^>]*>)*?)<\/span>/gi;
  let spanHeadingMatch;
  const spanHeadingPositions = [];
  const spanHeadingSeenByText = new Set();
  
  spanHeadingRegex.lastIndex = 0;
  
  while ((spanHeadingMatch = spanHeadingRegex.exec(html)) !== null) {
    // Extract content and clean it to remove any leaked attributes
    let headingContent = spanHeadingMatch[1];
    headingContent = headingContent.replace(/;\s*["'][^"']*["']\s*data-[^=]*=["'][^"']*["']/gi, '');
    headingContent = headingContent.replace(/data-[^=]*=["'][^"']*["']/gi, '');
    headingContent = headingContent.replace(/;\s*["'][^"']*["']/g, '');
    
    const text = extractText(headingContent, false).trim();
    const normalizedText = text.toLowerCase().replace(/\s+/g, ' ').trim();
    
    // Skip duplicates
    if (spanHeadingSeenByText.has(normalizedText)) continue;
    
    if (text && text.length > 0 && text.length < 300) {
      let level = 2;
      const classId = (spanHeadingMatch[0].match(/(?:class|id)=["']([^"']+)["']/i) || [])[1] || '';
      
      if (classId.match(/h1|heading-1|title-1|headline-1/i)) level = 1;
      else if (classId.match(/h2|heading-2|title-2|headline-2/i)) level = 2;
      else if (classId.match(/h3|heading-3|title-3|headline-3/i)) level = 3;
      else if (classId.match(/h4|heading-4|title-4|headline-4/i)) level = 4;
      else if (classId.match(/h5|heading-5|title-5|headline-5/i)) level = 5;
      else if (classId.match(/h6|heading-6|title-6|headline-6/i)) level = 6;
      
      spanHeadingPositions.push({
        position: spanHeadingMatch.index,
        level,
        text,
        match: spanHeadingMatch[0],
      });
      
      spanHeadingSeenByText.add(normalizedText);
    }
  }
  
  // Add div-based and span-based headings to headingPositions
  headingPositions.push(...divHeadingPositions);
  headingPositions.push(...spanHeadingPositions);
  
  // Final deduplication: Remove duplicate headings by normalized text content
  // This catches cases where the same heading is extracted by multiple methods
  const finalHeadingPositions = [];
  const seenNormalizedText = new Set();
  
  for (const heading of headingPositions) {
    const normalizedText = heading.text.toLowerCase().replace(/\s+/g, ' ').trim();
    
    // Skip if we've seen this exact text before
    if (seenNormalizedText.has(normalizedText)) {
      console.log(`[HTML-TO-MD] [extractBlocks] ⚠️ Removing duplicate heading: "${heading.text.substring(0, 50)}..."`);
      continue;
    }
    
    // For step headings, prefer the longer/more complete version
    // If we have "Step 2:" and "Step 2: Build Framework", keep only the longer one
    if (normalizedText.match(/^step\s+\d+:/)) {
      // Check if there's a longer version of this step heading
      const stepNumber = normalizedText.match(/^step\s+(\d+):/)?.[1];
      if (stepNumber) {
        const longerVersion = headingPositions.find(h => {
          const hNorm = h.text.toLowerCase().replace(/\s+/g, ' ').trim();
          return hNorm.match(new RegExp(`^step\\s+${stepNumber}:`)) && hNorm.length > normalizedText.length;
        });
        
        if (longerVersion) {
          console.log(`[HTML-TO-MD] [extractBlocks] ⚠️ Skipping shorter step heading "${heading.text}" in favor of "${longerVersion.text}"`);
          continue;
        }
      }
    }
    
    seenNormalizedText.add(normalizedText);
    finalHeadingPositions.push(heading);
  }
  
  // Replace headingPositions with deduplicated version
  headingPositions.length = 0;
  headingPositions.push(...finalHeadingPositions);
  
  // Log div-based and span-based headings found
  if (divHeadingPositions.length > 0) {
    console.log(`[HTML-TO-MD] [extractBlocks] Extracted ${divHeadingPositions.length} div-based headings:`, 
      divHeadingPositions.map(h => `H${h.level}: ${h.text.substring(0, 60)}...`).join(', '));
  }
  if (spanHeadingPositions.length > 0) {
    console.log(`[HTML-TO-MD] [extractBlocks] Extracted ${spanHeadingPositions.length} span-based headings`);
  }
  
  // Debug: Log heading extraction results
  const regularHeadingsCount = headingPositions.length - divHeadingPositions.length;
  console.log(`[HTML-TO-MD] [extractBlocks] Heading extraction summary:`);
  console.log(`[HTML-TO-MD] [extractBlocks] - Regular <h1-h6> headings: ${regularHeadingsCount}`);
  console.log(`[HTML-TO-MD] [extractBlocks] - Div-based headings: ${divHeadingPositions.length}`);
  console.log(`[HTML-TO-MD] [extractBlocks] - Total headings: ${headingPositions.length}`);
  
  if (headingPositions.length > 0) {
    console.log(`[HTML-TO-MD] Extracted ${headingPositions.length} headings:`, 
      headingPositions.map(h => `H${h.level}: ${h.text.substring(0, 50)}...`).join(', '));
  } else {
    console.warn('[HTML-TO-MD] ⚠️ No headings extracted from HTML');
  }
  
  // Check for common missing headings from the source
  const expectedHeadings = [
    "Step 1: Let's Get Started",
    "Step 2: Build Framework", 
    "Step 3: Pre-Construction",
    "Step 4: Construction Phases",
    "Step 5: Wrapping Up & Closeout",
    "Home Remodeling Planning in the Bay Area, CA",
    "How Much Does it Cost to Remodel a Home?",
    "How Long Does a Home Renovation Take?",
    "Steps for Remodeling Home in the SF Bay Area",
    "How to Finance a Home Renovation?",
    "Where to Stay During Home Renovation?",
    "Home Remodel Procedure for California Bay Area",
    "Full Home Remodeling Consultation",
    "Develop a Plan for House Remodel",
    "Pre-Construction for House Remodeling",
    "Construction for Remodeling Home",
    "Completing and Presenting New Home Remodel",
    "Do Home Renovations Increase Property Value in My Area?",
    "What Renovations Increase Home Value the Most?",
    "Are Home Renovations Tax Deductible?",
    "Home Remodeling Trends in the Bay Area",
    "Experience the Wise Builders Difference",
    "Frequently Asked Questions About Complete Home Renovations"
  ];
  
  const foundHeadings = expectedHeadings.filter(expected => 
    headingPositions.some(h => h.text.includes(expected) || expected.includes(h.text))
  );
  const missingHeadings = expectedHeadings.filter(expected => 
    !headingPositions.some(h => h.text.includes(expected) || expected.includes(h.text))
  );
  
  console.log(`[HTML-TO-MD] [extractBlocks] Expected headings check: ${foundHeadings.length}/${expectedHeadings.length} found`);
  if (missingHeadings.length > 0) {
    console.warn(`[HTML-TO-MD] [extractBlocks] ⚠️ Missing ${missingHeadings.length} expected headings:`, missingHeadings.slice(0, 10).join(', '));
  }
  
  // Check if test string is in any heading
  const foundInHeadings = headingPositions.some(h => h.text.includes(testString));
  if (foundInHeadings) {
    console.log(`[HTML-TO-MD] [extractBlocks] ✅ Test string "${testString}" found in headings`);
  } else if (foundAtStart) {
    console.log(`[HTML-TO-MD] [extractBlocks] Test string "${testString}" not in headings (expected if it's not a heading)`);
  }
  
  // Extract tables
  const tableRegex = /<table\b[^>]*>([\s\S]*?)<\/table>/gi;
  let tableMatch;
  const tablePositions = [];
  
  while ((tableMatch = tableRegex.exec(html)) !== null) {
    tablePositions.push({
      position: tableMatch.index,
      html: tableMatch[0],
      content: tableMatch[1],
    });
  }
  
  const foundInTables = tablePositions.some(t => t.content.includes(testString));
  if (foundInTables) {
    console.log(`[HTML-TO-MD] [extractBlocks] ✅ Test string "${testString}" found in tables`);
  } else if (foundAtStart) {
    console.log(`[HTML-TO-MD] [extractBlocks] Test string "${testString}" not in tables`);
  }
  
  // Extract forms
  const formRegex = /<form\b[^>]*>([\s\S]*?)<\/form>/gi;
  let formMatch;
  const formPositions = [];
  
  while ((formMatch = formRegex.exec(html)) !== null) {
    formPositions.push({
      position: formMatch.index,
      html: formMatch[0],
      content: formMatch[1],
    });
  }
  
  const foundInForms = formPositions.some(f => f.content.includes(testString));
  if (foundInForms) {
    console.log(`[HTML-TO-MD] [extractBlocks] ✅ Test string "${testString}" found in forms`);
  } else if (foundAtStart) {
    console.log(`[HTML-TO-MD] [extractBlocks] Test string "${testString}" not in forms`);
  }
  
  // Extract lists - use more robust regex that handles nested structures better
  // First try standard match
  const listRegex = /<(ul|ol|dl)\b[^>]*>([\s\S]*?)<\/(ul|ol|dl)>/gi;
  let listMatch;
  const listPositions = [];
  const listEndPositions = new Set(); // Track end positions to avoid double-extraction
  
  // Reset regex lastIndex
  listRegex.lastIndex = 0;
  
  while ((listMatch = listRegex.exec(html)) !== null) {
    const listType = listMatch[1].toLowerCase();
    const startPos = listMatch.index;
    const endPos = startPos + listMatch[0].length;
    
    // Verify this isn't nested inside another list (proper containment check)
    // Check if this list starts after another list's start and before its end
    const isNested = listPositions.some(existing => 
      startPos > existing.position && 
      startPos < existing.endPosition &&
      endPos <= existing.endPosition
    );
    if (!isNested) {
      listPositions.push({
        position: startPos,
        listType: listType, // Preserve original list type ('ul'/'ol'/'dl')
        content: listMatch[2], // Inner HTML between tags
        html: listMatch[0], // Full match including tags
        endPosition: endPos,
      });
      listEndPositions.add(endPos);
    }
  }
  
  const foundInLists = listPositions.some(l => l.content.includes(testString));
  if (foundInLists) {
    console.log(`[HTML-TO-MD] [extractBlocks] ✅ Test string "${testString}" found in lists`);
    const listWithString = listPositions.find(l => l.content.includes(testString));
    console.log(`[HTML-TO-MD] [extractBlocks] List type: ${listWithString.listType}, position: ${listWithString.position}`);
  } else if (foundAtStart) {
    console.log(`[HTML-TO-MD] [extractBlocks] Test string "${testString}" not in lists`);
  }
  
  // Extract CTAs (buttons and styled links) - expanded detection
  // Match: <button>, <a role="button">, elements with btn-* classes, onclick/action attributes, or styled as buttons
  const ctaPatterns = [
    // Standard button and anchor with button role
    /<(button|a)\b[^>]*>([\s\S]*?)<\/(button|a)>/gi,
    // Elements with btn-* classes (e.g., btn-orange, btn-blue)
    /<(p|div|span|a)\b[^>]*(?:class|id)=["'][^"']*(?:btn-|button|cta|call-to-action)[^"']*["'][^>]*>([\s\S]*?)<\/(p|div|span|a)>/gi,
    // Elements with onclick or action attributes (often used for CTAs)
    /<(p|div|span|a|button)\b[^>]*(?:onclick|action|redirecturl)=["'][^"']+["'][^>]*>([\s\S]*?)<\/(p|div|span|a|button)>/gi,
  ];
  
  const ctaPositions = [];
  const ctaSeen = new Set(); // Track to avoid duplicates
  
  ctaPatterns.forEach(regex => {
    let ctaMatch;
    while ((ctaMatch = regex.exec(html)) !== null) {
      const fullMatch = ctaMatch[0];
      const label = extractText(ctaMatch[2] || ctaMatch[3] || '');
      
      // Skip if label is too short or empty
      if (!label || label.length < 2) continue;
      
      // Create a hash to detect duplicates
      const ctaHash = `${label.toLowerCase().trim()}_${ctaMatch.index}`;
      if (ctaSeen.has(ctaHash)) continue;
      ctaSeen.add(ctaHash);
      
      // Extract href, onclick, or action target
      let target = null;
      const hrefMatch = fullMatch.match(/href=["']([^"']+)["']/i);
      const onclickMatch = fullMatch.match(/onclick=["']([^"']+)["']/i);
      const actionMatch = fullMatch.match(/action=["']([^"']+)["']/i);
      
      if (hrefMatch) {
        target = hrefMatch[1];
      } else if (onclickMatch) {
        target = onclickMatch[1].substring(0, 100); // Truncate long onclick handlers
      } else if (actionMatch) {
        target = actionMatch[1];
      }
      
      ctaPositions.push({
        position: ctaMatch.index,
        label: label.trim(),
        target: target,
        html: fullMatch,
      });
    }
  });
  
  // Sort by position
  ctaPositions.sort((a, b) => a.position - b.position);
  
  const foundInCTAs = ctaPositions.some(c => c.label.includes(testString) || c.html.includes(testString));
  if (foundInCTAs) {
    console.log(`[HTML-TO-MD] [extractBlocks] ✅ Test string "${testString}" found in CTAs`);
  } else if (foundAtStart) {
    console.log(`[HTML-TO-MD] [extractBlocks] Test string "${testString}" not in CTAs`);
  }
  
  // Extract FAQs (details/summary or Q/A patterns)
  const faqRegex = /<details\b[^>]*>[\s\S]*?<summary[^>]*>([^<]+)<\/summary>[\s\S]*?<\/details>/gi;
  let faqMatch;
  const faqPositions = [];
  
  while ((faqMatch = faqRegex.exec(html)) !== null) {
    const answerMatch = faqMatch[0].match(/<\/summary>([\s\S]*?)<\/details>/);
    faqPositions.push({
      position: faqMatch.index,
      question: faqMatch[1].trim(),
      answer: answerMatch ? extractText(answerMatch[1]) : '',
    });
  }
  
  const foundInFAQs = faqPositions.some(f => f.question.includes(testString) || f.answer.includes(testString));
  if (foundInFAQs) {
    console.log(`[HTML-TO-MD] [extractBlocks] ✅ Test string "${testString}" found in FAQs`);
  } else if (foundAtStart) {
    console.log(`[HTML-TO-MD] [extractBlocks] Test string "${testString}" not in FAQs`);
  }
  
  // Sort all positions and extract in order
  // Use blockType for the position item type, preserve original tag names (like listType)
  const allPositions = [
    ...headingPositions.map(h => ({ ...h, blockType: 'heading' })),
    ...tablePositions.map(t => ({ ...t, blockType: 'table' })),
    ...formPositions.map(f => ({ ...f, blockType: 'form' })),
    ...listPositions.map(l => ({ ...l, blockType: 'list' })), // listType preserved from original
    ...ctaPositions.map(c => ({ ...c, blockType: 'cta' })),
    ...faqPositions.map(f => ({ ...f, blockType: 'faq' })),
  ].sort((a, b) => a.position - b.position);
  
  // Process each element in order
  let lastPosition = 0;
  let elementIndex = 0;
  
  console.log(`[HTML-TO-MD] [extractBlocks] Processing ${allPositions.length} structured elements in order...`);
  
  for (const item of allPositions) {
    elementIndex++;
    
    // Extract paragraphs between last position and current
    if (item.position > lastPosition) {
      const betweenHtml = html.substring(lastPosition, item.position);
      const hasTestStringInBetween = betweenHtml.includes(testString);
      
      if (hasTestStringInBetween && foundAtStart) {
        console.log(`[HTML-TO-MD] [extractBlocks] ✅ Test string "${testString}" found in between-HTML (before element ${elementIndex}, type: ${item.blockType})`);
        const index = betweenHtml.indexOf(testString);
        const context = betweenHtml.substring(Math.max(0, index - 100), Math.min(betweenHtml.length, index + testString.length + 100));
        console.log(`[HTML-TO-MD] [extractBlocks] Between-HTML context (200 chars): ${context}`);
      }
      
      const paragraphs = extractParagraphs(betweenHtml);
      blocks.push(...paragraphs);
      
      // Check if test string is in extracted paragraphs
      const foundInExtractedParagraphs = paragraphs.some(p => p.text && p.text.includes(testString));
      if (foundInExtractedParagraphs) {
        console.log(`[HTML-TO-MD] [extractBlocks] ✅ Test string "${testString}" found in extracted paragraphs from between-HTML`);
      } else if (hasTestStringInBetween) {
        console.error(`[HTML-TO-MD] [extractBlocks] ❌ Test string "${testString}" LOST when extracting paragraphs from between-HTML!`);
      }
    }
    
    // Process the current element
    if (item.blockType === 'heading') {
      blocks.push({
        type: BLOCK_TYPES.HEADING,
        level: item.level,
        text: item.text,
      });
    } else if (item.blockType === 'table') {
      const tableBlock = parseTable(item.content);
      blocks.push(tableBlock);
    } else if (item.blockType === 'form') {
      const formBlock = parseForm(item.content);
      // Find nearest heading for context
      const nearestHeading = headingPositions
        .filter(h => h.position < item.position)
        .sort((a, b) => b.position - a.position)[0];
      formBlock.context = nearestHeading ? nearestHeading.text : 'Top';
      blocks.push(formBlock);
    } else if (item.blockType === 'list') {
      // Use listType (preserved original tag: 'ul'/'ol'/'dl'), not blockType ('list')
      const listBlock = parseList(item.content, item.listType);
      // Only add list if it has items
      if (listBlock.items && listBlock.items.length > 0) {
        blocks.push(listBlock);
        
        // Check if test string is in the list block
        const foundInListBlock = listBlock.items.some(item => item.includes && item.includes(testString));
        if (foundInListBlock) {
          console.log(`[HTML-TO-MD] [extractBlocks] ✅ Test string "${testString}" found in list block (element ${elementIndex})`);
        } else if (item.content.includes(testString)) {
          console.error(`[HTML-TO-MD] [extractBlocks] ❌ Test string "${testString}" LOST when parsing list (element ${elementIndex})!`);
        }
      } else if (item.content.includes(testString)) {
        console.error(`[HTML-TO-MD] [extractBlocks] ❌ Test string "${testString}" LOST - list block has no items (element ${elementIndex})!`);
      }
    } else if (item.blockType === 'cta') {
      // Find nearest heading for context
      const nearestHeading = headingPositions
        .filter(h => h.position < item.position)
        .sort((a, b) => b.position - a.position)[0];
      
      blocks.push({
        type: BLOCK_TYPES.CTA,
        label: item.label,
        target: item.target,
        context: nearestHeading ? nearestHeading.text : 'Top',
      });
    } else if (item.blockType === 'faq') {
      blocks.push({
        type: BLOCK_TYPES.FAQ,
        questions: [{
          question: item.question,
          answer: item.answer,
        }],
      });
    }
    
    // Calculate end position - use endPosition if available, otherwise calculate from match/html length
    if (item.endPosition) {
      lastPosition = item.endPosition;
    } else {
      lastPosition = item.position + (item.match?.length || item.html?.length || 0);
    }
  }
  
  // Extract remaining paragraphs
  if (lastPosition < html.length) {
    const remaining = html.substring(lastPosition);
    const hasTestStringInRemaining = remaining.includes(testString);
    
    if (hasTestStringInRemaining && foundAtStart) {
      console.log(`[HTML-TO-MD] [extractBlocks] ✅ Test string "${testString}" found in remaining HTML (after all structured elements)`);
      const index = remaining.indexOf(testString);
      const context = remaining.substring(Math.max(0, index - 100), Math.min(remaining.length, index + testString.length + 100));
      console.log(`[HTML-TO-MD] [extractBlocks] Remaining HTML context (200 chars): ${context}`);
    }
    
    const paragraphs = extractParagraphs(remaining);
    blocks.push(...paragraphs);
    
    // Check if test string is in extracted paragraphs from remaining
    const foundInRemainingParagraphs = paragraphs.some(p => p.text && p.text.includes(testString));
    if (foundInRemainingParagraphs) {
      console.log(`[HTML-TO-MD] [extractBlocks] ✅ Test string "${testString}" found in extracted paragraphs from remaining HTML`);
    } else if (hasTestStringInRemaining) {
      console.error(`[HTML-TO-MD] [extractBlocks] ❌ Test string "${testString}" LOST when extracting paragraphs from remaining HTML!`);
    }
  }
  
  // Check blocks before filtering
  const foundInBlocksBeforeFilter = blocks.some(block => {
    if (block.text && block.text.includes(testString)) return true;
    if (block.items && block.items.some(item => item.includes && item.includes(testString))) return true;
    return false;
  });
  
  if (foundInBlocksBeforeFilter) {
    console.log(`[HTML-TO-MD] [extractBlocks] ✅ Test string "${testString}" found in blocks before filtering`);
  } else if (foundAtStart) {
    console.error(`[HTML-TO-MD] [extractBlocks] ❌ Test string "${testString}" NOT FOUND in blocks before filtering!`);
  }
  
  // Filter out noise blocks
  const filteredBlocks = filterNoiseBlocks(blocks);
  
  // Check blocks after filtering
  const foundInBlocksAfterFilter = filteredBlocks.some(block => {
    if (block.text && block.text.includes(testString)) return true;
    if (block.items && block.items.some(item => item.includes && item.includes(testString))) return true;
    return false;
  });
  
  if (foundInBlocksAfterFilter) {
    console.log(`[HTML-TO-MD] [extractBlocks] ✅ Test string "${testString}" found in blocks after filtering`);
  } else if (foundInBlocksBeforeFilter) {
    console.error(`[HTML-TO-MD] [extractBlocks] ❌ Test string "${testString}" REMOVED by filterNoiseBlocks!`);
  }
  
  console.log(`[HTML-TO-MD] [extractBlocks] ===== Block extraction complete =====`);
  console.log(`[HTML-TO-MD] [extractBlocks] Total blocks: ${filteredBlocks.length} (before filter: ${blocks.length})`);
  
  return filteredBlocks;
}

/**
 * Extract paragraphs from HTML
 */
function extractParagraphs(html) {
  const blocks = [];
  const testString = "Review Final Touch-Ups";
  const hasTestString = html.includes(testString);
  
  if (hasTestString) {
    console.log(`[HTML-TO-MD] [extractParagraphs] Test string "${testString}" found in input HTML`);
    const index = html.indexOf(testString);
    const context = html.substring(Math.max(0, index - 200), Math.min(html.length, index + testString.length + 200));
    console.log(`[HTML-TO-MD] [extractParagraphs] Context (400 chars): ${context}`);
  }
  
  // First, remove already-extracted structured elements to avoid double extraction
  let cleanedHtml = html;
  cleanedHtml = cleanedHtml.replace(/<(ul|ol|dl)\b[^>]*>[\s\S]*?<\/(ul|ol|dl)>/gi, '');
  cleanedHtml = cleanedHtml.replace(/<table\b[^>]*>[\s\S]*?<\/table>/gi, '');
  cleanedHtml = cleanedHtml.replace(/<form\b[^>]*>[\s\S]*?<\/form>/gi, '');
  cleanedHtml = cleanedHtml.replace(/<(h[1-6])\b[^>]*>[\s\S]*?<\/h[1-6]>/gi, '');
  // Also remove div-based headings (they should be extracted as headings, not paragraphs)
  cleanedHtml = cleanedHtml.replace(/<div\b[^>]*(?:class|id)=["'][^"']*(?:heading|title|h[1-6]|headline)[^"']*["'][^>]*>[\s\S]*?<\/div>/gi, '');
  
  const foundAfterCleaning = cleanedHtml.includes(testString);
  if (hasTestString && !foundAfterCleaning) {
    console.log(`[HTML-TO-MD] [extractParagraphs] Test string "${testString}" removed when cleaning structured elements (expected if it's a heading)`);
  } else if (hasTestString && foundAfterCleaning) {
    console.log(`[HTML-TO-MD] [extractParagraphs] Test string "${testString}" still in cleanedHtml after removing structured elements`);
  }
  
  // Extract <p> tags
  const pRegex = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;
  let pMatch;
  
  while ((pMatch = pRegex.exec(cleanedHtml)) !== null) {
    const text = extractText(pMatch[1]);
    // Check if it's not a CTA button (btn-* classes, onclick, action)
    const isCTA = pMatch[0].match(/(?:class|id)=["'][^"']*(?:btn-|button|cta)[^"']*["']|onclick=|action=/i);
    
    if (pMatch[1].includes(testString)) {
      console.log(`[HTML-TO-MD] [extractParagraphs] Found test string in <p> tag`);
      console.log(`[HTML-TO-MD] [extractParagraphs] Extracted text: "${text}"`);
      console.log(`[HTML-TO-MD] [extractParagraphs] Text length: ${text.length}, isCTA: ${!!isCTA}, isBoilerplate: ${isBoilerplate(text)}`);
    }
    
    if (text && text.length >= 40 && !isBoilerplate(text) && !isCTA) {
      blocks.push({
        type: BLOCK_TYPES.PARAGRAPH,
        text,
      });
      if (text.includes(testString)) {
        console.log(`[HTML-TO-MD] [extractParagraphs] ✅ Test string "${testString}" added as paragraph block`);
      }
    } else if (pMatch[1].includes(testString)) {
      console.error(`[HTML-TO-MD] [extractParagraphs] ❌ Test string "${testString}" FILTERED OUT: length=${text?.length || 0}, isCTA=${!!isCTA}, isBoilerplate=${isBoilerplate(text)}`);
    }
  }
  
  // Extract div/span content that looks like paragraphs (but not CTAs or structured elements)
  const divRegex = /<div\b[^>]*>([\s\S]*?)<\/div>/gi;
  let divMatch;
  
  while ((divMatch = divRegex.exec(cleanedHtml)) !== null) {
    const text = extractText(divMatch[1]);
    // Check if it's paragraph-like (no nested block elements, sufficient length, not a CTA)
    const isCTA = divMatch[0].match(/(?:class|id)=["'][^"']*(?:btn-|button|cta)[^"']*["']|onclick=|action=/i);
    const isHeadingDiv = divMatch[0].match(/(?:class|id)=["'][^"']*(?:heading|title|h[1-6]|headline)[^"']*["']/i);
    
    if (divMatch[1].includes(testString)) {
      console.log(`[HTML-TO-MD] [extractParagraphs] Found test string in <div> tag`);
      console.log(`[HTML-TO-MD] [extractParagraphs] Div HTML: ${divMatch[0].substring(0, 200)}`);
      console.log(`[HTML-TO-MD] [extractParagraphs] Extracted text: "${text}"`);
      console.log(`[HTML-TO-MD] [extractParagraphs] Text length: ${text.length}, isCTA: ${!!isCTA}, isHeadingDiv: ${!!isHeadingDiv}, isBoilerplate: ${isBoilerplate(text)}`);
    }
    
    // Skip div-based headings (they should be extracted as headings, not paragraphs)
    if (isHeadingDiv) {
      if (divMatch[1].includes(testString)) {
        console.log(`[HTML-TO-MD] [extractParagraphs] ⚠️ Test string "${testString}" in heading div - should be extracted as heading, not paragraph`);
      }
      continue;
    }
    
    if (text && text.length >= 40 && !isBoilerplate(text) && !divMatch[1].match(/<(h[1-6]|ul|ol|table|form|button)/i) && !isCTA) {
      blocks.push({
        type: BLOCK_TYPES.PARAGRAPH,
        text,
      });
      if (text.includes(testString)) {
        console.log(`[HTML-TO-MD] [extractParagraphs] ✅ Test string "${testString}" added as paragraph block from div`);
      }
    } else if (divMatch[1].includes(testString)) {
      console.error(`[HTML-TO-MD] [extractParagraphs] ❌ Test string "${testString}" FILTERED OUT from div: length=${text?.length || 0}, isCTA=${!!isCTA}, isBoilerplate=${isBoilerplate(text)}, isHeadingDiv=${!!isHeadingDiv}`);
    }
  }
  
  // Final check
  const foundInExtractedBlocks = blocks.some(b => b.text && b.text.includes(testString));
  if (foundInExtractedBlocks) {
    console.log(`[HTML-TO-MD] [extractParagraphs] ✅ Test string "${testString}" found in extracted blocks`);
  } else if (hasTestString) {
    console.error(`[HTML-TO-MD] [extractParagraphs] ❌ Test string "${testString}" NOT FOUND in extracted blocks!`);
  }
  
  return blocks;
}

/**
 * Extract text content from HTML, preserving links as markdown
 */
function extractText(html, preserveLinks = true) {
  if (!html) return '';
  
  let processed = html;
  
  // First, remove any HTML attributes that might have leaked in as plain text
  // This handles cases where malformed HTML causes attributes to appear in content
  // Pattern: ;" data-attribute="value" or just data-attribute="value"
  processed = processed.replace(/;\s*["'][^"']*["']\s*data-[^=]*=["'][^"']*["']/gi, '');
  processed = processed.replace(/data-[^=]*=["'][^"']*["']/gi, '');
  processed = processed.replace(/;\s*["'][^"']*["']/g, '');
  // Remove any remaining attribute-like patterns (key="value" or key='value')
  processed = processed.replace(/\b\w+\s*=\s*["'][^"']*["']/gi, '');
  
  if (preserveLinks) {
    // Convert <a href="...">text</a> to [text](url)
    processed = processed.replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (match, href, text) => {
      // Extract text from link content (without preserving nested links to avoid recursion)
      const linkText = extractText(text, false).trim();
      return linkText ? `[${linkText}](${href})` : href;
    });
  }
  
  // Now remove remaining tags and decode entities
  processed = processed
    .replace(/<[^>]+>/g, ' ') // Remove remaining tags
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#8217;/g, "'") // Right single quotation mark
    .replace(/&#8220;/g, '"') // Left double quotation mark
    .replace(/&#8221;/g, '"') // Right double quotation mark
    .replace(/&#8211;/g, '-') // En dash
    .replace(/&#8212;/g, '--') // Em dash
    .replace(/\s+/g, ' ')
    .trim();
  
  return processed;
}

/**
 * Check if text is boilerplate
 */
function isBoilerplate(text) {
  return NOISE_PATTERNS.BOILERPLATE_PHRASES.some(phrase => 
    text.toLowerCase().includes(phrase.toLowerCase())
  );
}

/**
 * Parse table HTML
 */
function parseTable(tableHtml) {
  try {
    const headerRegex = /<th\b[^>]*>([^<]+)<\/th>/gi;
    const headers = [];
    let headerMatch;
    
    while ((headerMatch = headerRegex.exec(tableHtml)) !== null) {
      headers.push(extractText(headerMatch[1]));
    }
    
    const rowRegex = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
    const rows = [];
    let rowMatch;
    
    while ((rowMatch = rowRegex.exec(tableHtml)) !== null) {
      const cellRegex = /<td\b[^>]*>([\s\S]*?)<\/td>/gi;
      const cells = [];
      let cellMatch;
      
      while ((cellMatch = cellRegex.exec(rowMatch[1])) !== null) {
        cells.push(extractText(cellMatch[1]));
      }
      
      if (cells.length > 0) {
        rows.push(cells);
      }
    }
    
    if (headers.length > 0 && rows.length > 0) {
      return {
        type: BLOCK_TYPES.TABLE,
        headers,
        rows,
        failed: false,
      };
    }
  } catch (error) {
    // Fall through to fallback
  }
  
  // Fallback
  const rowCount = (tableHtml.match(/<tr/gi) || []).length;
  const colCount = (tableHtml.match(/<th/gi) || []).length;
  
  return {
    type: BLOCK_TYPES.TABLE,
    summary: 'Table data',
    rows: rowCount,
    headers: colCount,
    failed: true,
  };
}

/**
 * Parse form HTML
 */
function parseForm(formHtml) {
  try {
    // Get form name/id
    const nameMatch = formHtml.match(/<form\b[^>]*(?:name|id)=["']([^"']+)["']/i);
    const name = nameMatch ? nameMatch[1] : 'form';
    
    const fields = [];
    
    // Extract all form fields (input, select, textarea)
    const fieldElements = formHtml.match(/<(input|select|textarea)\b[^>]*>/gi) || [];
    
    fieldElements.forEach(fieldHtml => {
      // Priority: label for= > aria-label > placeholder > name > id > type
      let fieldLabel = null;
      
      // Check for associated label via "for" attribute
      const fieldIdMatch = fieldHtml.match(/id=["']([^"']+)["']/i);
      if (fieldIdMatch) {
        const labelRegex = new RegExp(`<label[^>]*for=["']${fieldIdMatch[1]}["'][^>]*>([\\s\\S]*?)<\\/label>`, 'i');
        const labelMatch = formHtml.match(labelRegex);
        if (labelMatch) {
          fieldLabel = extractText(labelMatch[1]).trim();
        }
      }
      
      // Fallback to aria-label
      if (!fieldLabel) {
        const ariaLabelMatch = fieldHtml.match(/aria-label=["']([^"']+)["']/i);
        if (ariaLabelMatch) {
          fieldLabel = ariaLabelMatch[1].trim();
        }
      }
      
      // Fallback to placeholder
      if (!fieldLabel) {
        const placeholderMatch = fieldHtml.match(/placeholder=["']([^"']+)["']/i);
        if (placeholderMatch) {
          fieldLabel = placeholderMatch[1].trim();
        }
      }
      
      // Fallback to name
      if (!fieldLabel) {
        const nameMatch = fieldHtml.match(/name=["']([^"']+)["']/i);
        if (nameMatch) {
          fieldLabel = nameMatch[1].trim();
        }
      }
      
      // Fallback to id
      if (!fieldLabel) {
        const idMatch = fieldHtml.match(/id=["']([^"']+)["']/i);
        if (idMatch) {
          fieldLabel = idMatch[1].trim();
        }
      }
      
      // Last resort: use type
      if (!fieldLabel) {
        const typeMatch = fieldHtml.match(/type=["']([^"']+)["']/i);
        if (typeMatch) {
          fieldLabel = `${typeMatch[1]} input`;
        } else {
          fieldLabel = 'field';
        }
      }
      
      if (fieldLabel && !fields.includes(fieldLabel)) {
        fields.push(fieldLabel);
      }
    });
    
    // Extract submit button label
    let submitLabel = null;
    const submitButtonMatch = formHtml.match(/<button[^>]*type=["']submit["'][^>]*>([\s\S]*?)<\/button>/i);
    if (submitButtonMatch) {
      submitLabel = extractText(submitButtonMatch[1]).trim();
    } else {
      const submitInputMatch = formHtml.match(/<input[^>]*type=["']submit["'][^>]*value=["']([^"']+)["']/i);
      if (submitInputMatch) {
        submitLabel = submitInputMatch[1].trim();
      }
    }
    
    // Find nearest heading for context
    // This will be set during block processing
    
    return {
      type: BLOCK_TYPES.FORM,
      name,
      fields,
      submitLabel: submitLabel || 'Submit',
      failed: false,
    };
  } catch (error) {
    return {
      type: BLOCK_TYPES.FORM,
      name: 'form',
      fields: [],
      submitLabel: null,
      failed: true,
    };
  }
}

/**
 * Parse list HTML
 */
function parseList(listHtml, listType) {
  const items = [];
  const testString = "Review Final Touch-Ups";
  const hasTestString = listHtml.includes(testString);
  
  if (hasTestString) {
    console.log(`[HTML-TO-MD] [parseList] Test string "${testString}" found in list HTML (type: ${listType})`);
    const index = listHtml.indexOf(testString);
    const context = listHtml.substring(Math.max(0, index - 200), Math.min(listHtml.length, index + testString.length + 200));
    console.log(`[HTML-TO-MD] [parseList] Context (400 chars): ${context}`);
  }
  
  if (!listHtml || !listHtml.trim()) {
    return {
      type: BLOCK_TYPES.LIST,
      items: [],
      ordered: listType === 'ol',
    };
  }

  if (listType === 'ul' || listType === 'ol') {
    const itemRegex = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;
    let itemMatch;
    let matchCount = 0;
    
    while ((itemMatch = itemRegex.exec(listHtml)) !== null) {
      matchCount++;
      const itemContent = itemMatch[1] || '';
      const text = extractText(itemContent).trim();
      
      if (itemContent.includes(testString)) {
        console.log(`[HTML-TO-MD] [parseList] Found test string in list item ${matchCount}`);
        console.log(`[HTML-TO-MD] [parseList] Item content: ${itemContent.substring(0, 200)}`);
        console.log(`[HTML-TO-MD] [parseList] Extracted text: "${text}"`);
      }
      
      // Only skip if text is completely empty after extraction
      // Even single characters should be included
      if (text.length > 0) {
        items.push(text);
        if (text.includes(testString)) {
          console.log(`[HTML-TO-MD] [parseList] ✅ Test string "${testString}" added to list items`);
        }
      } else if (itemContent.trim().length > 0) {
        // If itemContent has HTML but extractText returned empty, 
        // there might be formatting tags - try extracting raw text
        const rawText = itemContent
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        if (rawText.length > 0) {
          items.push(rawText);
          if (rawText.includes(testString)) {
            console.log(`[HTML-TO-MD] [parseList] ✅ Test string "${testString}" added to list items (via raw text extraction)`);
          }
        } else if (itemContent.includes(testString)) {
          console.error(`[HTML-TO-MD] [parseList] ❌ Test string "${testString}" LOST during list item extraction!`);
        }
      }
    }
    
    // If regex found matches but items is empty, there's an extraction issue
    if (matchCount > 0 && items.length === 0) {
      // Fallback: try to extract any text from listHtml
      const fallbackText = extractText(listHtml).trim();
      if (fallbackText.length > 0) {
        // Split by common separators
        const parts = fallbackText.split(/[•\-\*]/).map(p => p.trim()).filter(p => p.length > 0);
        if (parts.length > 0) {
          items.push(...parts);
        }
      }
    }
  } else if (listType === 'dl') {
    // Definition list - flatten to bullets
    const termRegex = /<dt\b[^>]*>([\s\S]*?)<\/dt>/gi;
    let termMatch;
    
    while ((termMatch = termRegex.exec(listHtml)) !== null) {
      const text = extractText(termMatch[1]).trim();
      if (text && text.length > 0) {
        items.push(text);
      }
    }
  }
  
  return {
    type: BLOCK_TYPES.LIST,
    items,
    ordered: listType === 'ol',
  };
}

/**
 * Filter out noise blocks and deduplicate
 */
function filterNoiseBlocks(blocks) {
  const testString = "Review Final Touch-Ups";
  
  // Check if test string exists in blocks before filtering
  const foundBeforeFilter = blocks.some(block => {
    if (block.text && block.text.includes(testString)) return true;
    if (block.items && block.items.some(item => item.includes && item.includes(testString))) return true;
    return false;
  });
  
  if (foundBeforeFilter) {
    console.log(`[HTML-TO-MD] [filterNoiseBlocks] Test string "${testString}" found in blocks before filtering`);
  }
  
  const filtered = blocks.filter(block => {
    // Filter short paragraphs
    if (block.type === BLOCK_TYPES.PARAGRAPH) {
      const hasTestString = block.text && block.text.includes(testString);
      
      if (block.text.length < 40) {
        if (hasTestString) {
          console.error(`[HTML-TO-MD] [filterNoiseBlocks] ❌ Test string "${testString}" REMOVED: paragraph too short (${block.text.length} chars < 40)`);
          console.log(`[HTML-TO-MD] [filterNoiseBlocks] Paragraph text: "${block.text}"`);
        }
        return false;
      }
      
      // Check link density
      const linkCount = (block.text.match(/\[.*?\]\(.*?\)/g) || []).length;
      const linkDensity = linkCount / (block.text.length / 100);
      if (linkDensity > 30) {
        if (hasTestString) {
          console.error(`[HTML-TO-MD] [filterNoiseBlocks] ❌ Test string "${testString}" REMOVED: link density too high (${linkDensity}% > 30%)`);
        }
        return false;
      }
      
      // Check for boilerplate
      if (isBoilerplate(block.text)) {
        if (hasTestString) {
          console.error(`[HTML-TO-MD] [filterNoiseBlocks] ❌ Test string "${testString}" REMOVED: marked as boilerplate`);
        }
        return false;
      }
    }
    
    return true;
  });
  
  // Check if test string exists in blocks after filtering
  const foundAfterFilter = filtered.some(block => {
    if (block.text && block.text.includes(testString)) return true;
    if (block.items && block.items.some(item => item.includes && item.includes(testString))) return true;
    return false;
  });
  
  if (foundAfterFilter) {
    console.log(`[HTML-TO-MD] [filterNoiseBlocks] ✅ Test string "${testString}" found in blocks after filtering`);
  } else if (foundBeforeFilter) {
    console.error(`[HTML-TO-MD] [filterNoiseBlocks] ❌ Test string "${testString}" REMOVED during filtering!`);
  }
  
  // Deduplicate blocks by creating a hash of normalized content
  const seen = new Set();
  const deduplicated = [];
  
  for (const block of filtered) {
    let hash = '';
    
    if (block.type === BLOCK_TYPES.PARAGRAPH) {
      // Normalize text: lowercase, remove extra whitespace
      hash = `para:${block.text.toLowerCase().replace(/\s+/g, ' ').trim()}`;
    } else if (block.type === BLOCK_TYPES.HEADING) {
      hash = `heading:${block.level}:${block.text.toLowerCase().trim()}`;
    } else if (block.type === BLOCK_TYPES.LIST) {
      const itemsHash = block.items.map(i => i.toLowerCase().trim()).join('|');
      hash = `list:${block.ordered ? 'ol' : 'ul'}:${itemsHash}`;
    } else if (block.type === BLOCK_TYPES.CTA) {
      hash = `cta:${block.label.toLowerCase().trim()}`;
    } else if (block.type === BLOCK_TYPES.FORM) {
      hash = `form:${block.name || 'unnamed'}:${block.fields.join(',')}`;
    } else if (block.type === BLOCK_TYPES.TABLE) {
      // For tables, hash the header row
      if (block.headers && block.headers.length > 0) {
        hash = `table:${block.headers.map(h => h.toLowerCase().trim()).join('|')}`;
      } else {
        hash = `table:${block.summary || 'unknown'}`;
      }
    } else if (block.type === BLOCK_TYPES.FAQ) {
      const qaHash = block.questions.map(qa => 
        `${qa.question.toLowerCase().trim()}:${qa.answer.toLowerCase().trim()}`
      ).join('|');
      hash = `faq:${qaHash}`;
    } else {
      // Unknown type, include it
      hash = `unknown:${JSON.stringify(block)}`;
    }
    
    // Check if this block contains test string before deduplication
    const blockHasTestString = (block.text && block.text.includes(testString)) ||
      (block.items && block.items.some(item => item.includes && item.includes(testString)));
    
    // Only add if we haven't seen this exact content before
    if (!seen.has(hash)) {
      seen.add(hash);
      deduplicated.push(block);
    } else if (blockHasTestString) {
      console.error(`[HTML-TO-MD] [filterNoiseBlocks] ❌ Test string "${testString}" REMOVED during deduplication (duplicate hash: ${hash.substring(0, 100)})`);
    }
  }
  
  // Final check
  const foundAfterDedupe = deduplicated.some(block => {
    if (block.text && block.text.includes(testString)) return true;
    if (block.items && block.items.some(item => item.includes && item.includes(testString))) return true;
    return false;
  });
  
  if (foundAfterDedupe) {
    console.log(`[HTML-TO-MD] [filterNoiseBlocks] ✅ Test string "${testString}" found in blocks after deduplication`);
  } else if (foundAfterFilter) {
    console.error(`[HTML-TO-MD] [filterNoiseBlocks] ❌ Test string "${testString}" REMOVED during deduplication!`);
  }
  
  return deduplicated;
}

/**
 * Convert blocks to canonical markdown
 */
function convertToCanonicalMarkdown(blocks) {
  return blocks.map(block => convertBlock(block)).join('\n\n');
}

/**
 * Convert a single block to markdown
 */
function convertBlock(block) {
  switch (block.type) {
    case BLOCK_TYPES.HEADING:
      return convertHeading(block);
    case BLOCK_TYPES.PARAGRAPH:
      return convertParagraph(block);
    case BLOCK_TYPES.LIST:
      return convertList(block);
    case BLOCK_TYPES.TABLE:
      return convertTable(block);
    case BLOCK_TYPES.CTA:
      return convertCTA(block);
    case BLOCK_TYPES.FORM:
      return convertForm(block);
    case BLOCK_TYPES.FAQ:
      return convertFAQ(block);
    default:
      return '';
  }
}

/**
 * Convert heading block
 */
function convertHeading(block) {
  const { level, text } = block;
  const hashes = level === 1 ? '#' : level === 2 ? '##' : level === 3 ? '###' : '####';
  return `${hashes} ${text}`;
}

/**
 * Convert paragraph block
 */
function convertParagraph(block) {
  return block.text.trim();
}

/**
 * Convert list block to markdown
 * Ordered lists (ol) use numbered format: "1. item", "2. item", etc.
 * Unordered lists (ul) use bullet dot format: "• item"
 */
function convertList(block) {
  const { items, ordered } = block;
  
  if (!items || items.length === 0) {
    return '';
  }
  
  // Ensure ordered lists use numbered bullets (1., 2., 3., ...)
  // Unordered lists use bullet dots (•)
  return items.map((item, index) => {
    const prefix = ordered ? `${index + 1}. ` : '• ';
    return `${prefix}${item.trim()}`;
  }).join('\n');
}

/**
 * Convert table block
 */
function convertTable(block) {
  try {
    // Attempt GitHub-flavored markdown table
    const { headers, rows } = block;
    if (!headers || headers.length === 0 || !rows || rows.length === 0) {
      throw new Error('No headers or rows');
    }
    
    // Normalize headers - replace empty strings with placeholder
    const normalizedHeaders = headers.map((h, i) => {
      const trimmed = (h || '').trim();
      return trimmed || `Column ${i + 1}`;
    });
    
    // Normalize rows to match header count
    const normalizedRows = rows.map(row => {
      const normalized = [...row];
      // Pad or truncate to match header count
      while (normalized.length < normalizedHeaders.length) {
        normalized.push('');
      }
      return normalized.slice(0, normalizedHeaders.length).map(cell => (cell || '').trim());
    });
    
    // Build markdown table with proper line breaks
    const headerRow = `| ${normalizedHeaders.join(' | ')} |`;
    const separatorRow = `| ${normalizedHeaders.map(() => '---').join(' | ')} |`;
    const dataRows = normalizedRows.map(row => {
      // Escape pipe characters in cells
      const escapedRow = row.map(cell => cell.replace(/\|/g, '\\|'));
      return `| ${escapedRow.join(' | ')} |`;
    }).join('\n');
    
    // Ensure proper line breaks between all parts
    return `${headerRow}\n${separatorRow}\n${dataRows}`;
  } catch (error) {
    // Fallback to summary format
    const rowCount = block.rows?.length || 0;
    const colCount = block.headers?.length || 0;
    return `[[TABLE]]\nSummary: ${block.summary || 'Table data'}\nRows: ${rowCount}\nColumns: ${colCount}`;
  }
}

/**
 * Convert CTA block
 */
function convertCTA(block) {
  const { label, target, context } = block;
  return `[[CTA]]\nLabel: ${label}\nTarget: ${target || 'N/A'}\nContext: ${context || 'N/A'}`;
}

/**
 * Convert form block
 */
function convertForm(block) {
  const { name, fields, submitLabel, context } = block;
  return `[[FORM]]\nName: ${name || 'N/A'}\nFields: ${fields.join(', ')}\nSubmit: ${submitLabel || 'N/A'}\nContext: ${context || 'N/A'}`;
}

/**
 * Convert FAQ block
 */
function convertFAQ(block) {
  const { questions } = block;
  return questions.map(qa => `[[FAQ]]\nQ: ${qa.question}\nA: ${qa.answer}`).join('\n\n');
}

/**
 * Score confidence of the import
 */
function scoreConfidence(blocks, markdown) {
  let score = 0;
  let checks = 0;
  
  // Check for H1
  const hasH1 = blocks.some(b => b.type === BLOCK_TYPES.HEADING && b.level === 1);
  score += hasH1 ? 0.2 : 0;
  checks += 0.2;
  
  // Check for multiple headings (≥3)
  const headingCount = blocks.filter(b => b.type === BLOCK_TYPES.HEADING).length;
  score += headingCount >= 3 ? 0.2 : (headingCount >= 1 ? 0.1 : 0);
  checks += 0.2;
  
  // Check for sufficient text (≥300 chars)
  const textLength = markdown.replace(/\[\[.*?\]\]/g, '').trim().length;
  score += textLength >= 300 ? 0.2 : (textLength >= 100 ? 0.1 : 0);
  checks += 0.2;
  
  // Check for paragraphs
  const hasParagraphs = blocks.some(b => b.type === BLOCK_TYPES.PARAGRAPH);
  score += hasParagraphs ? 0.2 : 0;
  checks += 0.2;
  
  // Check for no critical block failures
  const hasTableFailures = blocks.some(b => b.type === BLOCK_TYPES.TABLE && b.failed);
  const hasFormFailures = blocks.some(b => b.type === BLOCK_TYPES.FORM && b.failed);
  score += (!hasTableFailures && !hasFormFailures) ? 0.2 : 0;
  checks += 0.2;
  
  return checks > 0 ? score / checks : 0;
}

/**
 * LLM rescue pass for low-confidence imports
 */
async function llmRescuePass(blocks, markdown, originalHtml) {
  try {
    const { initMonkey } = await import('@/libs/monkey');
    const monkey = await initMonkey();
    
    const prompt = `You are helping to convert HTML content to CJGEO Canonical Markdown format.

The current conversion has low confidence. Your task is to improve it by:
1. Ensuring proper section labeling (headings)
2. Summarizing complex tables if needed
3. Converting card grids to lists
4. Preserving semantic structure

IMPORTANT RULES:
- Do NOT rewrite paragraphs
- Do NOT change the actual content
- Only improve structure and labeling
- Ensure exactly ONE H1 heading
- Preserve all [[CTA]], [[FORM]], [[FAQ]], [[TABLE]] blocks as-is

Current markdown:
${markdown}

Original HTML (for reference):
${originalHtml.substring(0, 5000)}

Return the improved canonical markdown:`;

    const response = await monkey.AI(prompt, {
      vendor: 'openai',
      model: 'gpt-4o',
      forceJson: false,
    });
    
    // Clean up response (remove markdown code fences if present)
    let cleaned = response.trim();
    cleaned = cleaned.replace(/^```markdown\s*/i, '');
    cleaned = cleaned.replace(/^```\s*/m, '');
    cleaned = cleaned.replace(/\s*```\s*$/g, '');
    
    return cleaned.trim();
  } catch (error) {
    console.error('LLM rescue pass failed:', error);
    // Return original markdown if LLM fails
    return markdown;
  }
}

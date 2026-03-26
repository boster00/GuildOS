// ARCHIVED: Original path was libs/content-magic/importers/markdown-to-html.js

/**
 * Simple Markdown to HTML converter for canonical markdown
 * Handles the CJGEO canonical markdown format including special blocks
 */

/**
 * Convert canonical markdown to HTML
 */
export function convertMarkdownToHtml(markdown) {
  let html = markdown;
  
  // Convert headings
  html = html.replace(/^#### (.*)$/gm, '<h4>$1</h4>');
  html = html.replace(/^### (.*)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.*)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.*)$/gm, '<h1>$1</h1>');
  
  // Convert lists - process line by line to handle ordered and unordered separately
  const lines = html.split('\n');
  const processed = [];
  let currentList = [];
  let currentListType = null; // 'ul' or 'ol'
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const orderedMatch = line.match(/^(\d+)\. (.*)$/);
    // Match both dash (-) and bullet dot (•) for unordered lists
    const unorderedMatch = line.match(/^[-•] (.*)$/);
    
    if (orderedMatch) {
      // Ordered list item
      if (currentListType !== 'ol' && currentList.length > 0) {
        // Flush previous list
        const tag = currentListType || 'ul';
        processed.push(`<${tag}>${currentList.join('')}</${tag}>`);
        currentList = [];
      }
      currentListType = 'ol';
      currentList.push(`<li>${orderedMatch[2]}</li>`);
    } else if (unorderedMatch) {
      // Unordered list item (handles both - and •)
      if (currentListType !== 'ul' && currentList.length > 0) {
        // Flush previous list
        const tag = currentListType || 'ol';
        processed.push(`<${tag}>${currentList.join('')}</${tag}>`);
        currentList = [];
      }
      currentListType = 'ul';
      currentList.push(`<li>${unorderedMatch[1]}</li>`);
    } else {
      // Not a list item - flush current list if any
      if (currentList.length > 0) {
        const tag = currentListType || 'ul';
        processed.push(`<${tag}>${currentList.join('')}</${tag}>`);
        currentList = [];
        currentListType = null;
      }
      processed.push(line);
    }
  }
  
  // Flush any remaining list
  if (currentList.length > 0) {
    const tag = currentListType || 'ul';
    processed.push(`<${tag}>${currentList.join('')}</${tag}>`);
  }
  
  html = processed.join('\n');
  
  // Convert special blocks to HTML comments FIRST (before paragraph processing)
  // Handle both formats: with newline after [[CTA]] and without (inline Label:)
  // Pattern 1: [[CTA]]\nLabel: ... (standard format)
  // Pattern 2: [[CTA]] Label: ... (inline format - should be converted too)
  let ctaPattern1 = /\[\[CTA\]\]\s*\n\s*Label:\s*(.+?)\s*\n\s*Target:\s*(.+?)\s*\n\s*Context:\s*(.+?)(?=\n\n|\n\[\[|\n#|\n<h|$)/gs;
  html = html.replace(ctaPattern1, (match, label, target, context) => {
    return `<!-- CTA: ${label.trim()} | Target: ${target.trim()} | Context: ${context.trim()} -->\n`;
  });
  
  // Pattern 2: Handle inline format [[CTA]] Label: ... on same line
  let ctaPattern2 = /\[\[CTA\]\]\s+Label:\s*(.+?)\s*\n\s*Target:\s*(.+?)\s*\n\s*Context:\s*(.+?)(?=\n\n|\n\[\[|\n#|\n<h|$)/gs;
  html = html.replace(ctaPattern2, (match, label, target, context) => {
    return `<!-- CTA: ${label.trim()} | Target: ${target.trim()} | Context: ${context.trim()} -->\n`;
  });
  
  let formPattern1 = /\[\[FORM\]\]\s*\n\s*Name:\s*(.+?)\s*\n\s*Fields:\s*(.+?)\s*\n\s*Submit:\s*(.+?)\s*\n\s*Context:\s*(.+?)(?=\n\n|\n\[\[|\n#|\n<h|$)/gs;
  html = html.replace(formPattern1, (match, name, fields, submit, context) => {
    return `<!-- FORM: ${name.trim()} | Fields: ${fields.trim()} | Submit: ${submit.trim()} | Context: ${context.trim()} -->\n`;
  });
  
  let formPattern2 = /\[\[FORM\]\]\s+Name:\s*(.+?)\s*\n\s*Fields:\s*(.+?)\s*\n\s*Submit:\s*(.+?)\s*\n\s*Context:\s*(.+?)(?=\n\n|\n\[\[|\n#|\n<h|$)/gs;
  html = html.replace(formPattern2, (match, name, fields, submit, context) => {
    return `<!-- FORM: ${name.trim()} | Fields: ${fields.trim()} | Submit: ${submit.trim()} | Context: ${context.trim()} -->\n`;
  });
  
  let faqPattern1 = /\[\[FAQ\]\]\s*\n\s*Q:\s*(.+?)\s*\n\s*A:\s*(.+?)(?=\n\n|\n\[\[|\n#|\n<h|$)/gs;
  html = html.replace(faqPattern1, (match, question, answer) => {
    return `<!-- FAQ: Q: ${question.trim()} | A: ${answer.trim()} -->\n`;
  });
  
  let faqPattern2 = /\[\[FAQ\]\]\s+Q:\s*(.+?)\s*\n\s*A:\s*(.+?)(?=\n\n|\n\[\[|\n#|\n<h|$)/gs;
  html = html.replace(faqPattern2, (match, question, answer) => {
    return `<!-- FAQ: Q: ${question.trim()} | A: ${answer.trim()} -->\n`;
  });
  
  let tablePattern1 = /\[\[TABLE\]\]\s*\n\s*Summary:\s*(.+?)\s*\n\s*Rows:\s*(.+?)\s*\n\s*Columns:\s*(.+?)(?=\n\n|\n\[\[|\n#|\n<h|$)/gs;
  html = html.replace(tablePattern1, (match, summary, rows, columns) => {
    return `<!-- TABLE: Summary: ${summary.trim()} | Rows: ${rows.trim()} | Columns: ${columns.trim()} -->\n`;
  });
  
  let tablePattern2 = /\[\[TABLE\]\]\s+Summary:\s*(.+?)\s*\n\s*Rows:\s*(.+?)\s*\n\s*Columns:\s*(.+?)(?=\n\n|\n\[\[|\n#|\n<h|$)/gs;
  html = html.replace(tablePattern2, (match, summary, rows, columns) => {
    return `<!-- TABLE: Summary: ${summary.trim()} | Rows: ${rows.trim()} | Columns: ${columns.trim()} -->\n`;
  });
  
  // Convert paragraphs (lines that aren't headings, lists, special blocks, or empty)
  const paragraphLines = html.split('\n');
  const paragraphProcessed = [];
  let currentParagraph = [];
  
  for (let i = 0; i < paragraphLines.length; i++) {
    const line = paragraphLines[i];
    const nextLine = paragraphLines[i + 1];
    const isBlockElement = line.match(/^<h[1-6]|^<ul|^<ol|^<!-- (CTA|FORM|FAQ|TABLE)/);
    const isEmpty = !line.trim();
    
    if (isBlockElement) {
      // Flush current paragraph before block element
      if (currentParagraph.length > 0) {
        paragraphProcessed.push(`<p>${currentParagraph.join(' ')}</p>`);
        currentParagraph = [];
      }
      // Add block element
      const trimmedLine = line.trim();
      paragraphProcessed.push(trimmedLine);
      // Ensure newline separation: if next line exists and is text (not block/empty), add separator
      if (nextLine && nextLine.trim() && !nextLine.match(/^<h[1-6]|^<ul|^<ol|^<!--|^\[\[/)) {
        paragraphProcessed.push('');
      }
    } else if (isEmpty) {
      // Empty line = paragraph break
      if (currentParagraph.length > 0) {
        paragraphProcessed.push(`<p>${currentParagraph.join(' ')}</p>`);
        currentParagraph = [];
      }
      // Preserve empty line as separator (but don't add multiples)
      if (paragraphProcessed[paragraphProcessed.length - 1] !== '') {
        paragraphProcessed.push('');
      }
    } else if (line.trim()) {
      // Regular text line - add to current paragraph
      currentParagraph.push(line.trim());
    }
  }
  
  // Flush any remaining paragraph
  if (currentParagraph.length > 0) {
    paragraphProcessed.push(`<p>${currentParagraph.join(' ')}</p>`);
  }
  
  // Join with newlines to preserve structure
  html = paragraphProcessed.join('\n');
  
  // Handle any remaining unconverted special block markers (fallback)
  // Convert them to comments to prevent inline continuation
  html = html.replace(/\[\[(CTA|FORM|FAQ|TABLE)\]\](?!\s*\n\s*<!--)/g, '<!-- $1: Unmatched block marker -->\n');
  
  // Final pass: ensure all closing tags and comments are followed by newline
  // This prevents inline continuation after blocks
  html = html.replace(/(<\/h[1-6]>|<\/ul>|<\/ol>|<!-- (CTA|FORM|FAQ|TABLE):[^>]*-->)(?![ \t]*\n)/g, '$1\n');
  
  // Ensure paragraphs end with newline (before next block element)
  html = html.replace(/(<\/p>)(?=\s*<(h[1-6]|ul|ol|!--))/g, '$1\n');
  
  // Clean up excessive consecutive empty lines (max 2 in a row)
  html = html.replace(/\n{3,}/g, '\n\n');
  
  // Convert markdown tables to HTML tables
  html = html.replace(/\|(.+)\|\n\|([-|: ]+)\|\n((?:\|.+\|\n?)+)/g, (match, header, separator, rows) => {
    const headers = header.split('|').map(h => h.trim()).filter(h => h);
    const rowLines = rows.trim().split('\n');
    
    let tableHtml = '<table><thead><tr>';
    headers.forEach(h => tableHtml += `<th>${h}</th>`);
    tableHtml += '</tr></thead><tbody>';
    
    rowLines.forEach(row => {
      const cells = row.split('|').map(c => c.trim()).filter(c => c);
      if (cells.length > 0) {
        tableHtml += '<tr>';
        cells.forEach(cell => tableHtml += `<td>${cell}</td>`);
        tableHtml += '</tr>';
      }
    });
    
    tableHtml += '</tbody></table>';
    return tableHtml;
  });
  
  return html;
}

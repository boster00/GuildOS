/**
 * Section format detection from HTML structure
 */

/**
 * Detect section format from HTML structure
 * @param html - The HTML content of a section
 * @returns Detected format or 'text_block' as default
 */
export function detectSectionFormat(html: string): string {
  if (!html || typeof html !== 'string') {
    return 'text_block';
  }
  
  const lowerHtml = html.toLowerCase();
  
  // Hero section - typically has large heading, CTA button, background styling
  if (lowerHtml.includes('class="') && (
    lowerHtml.includes('hero') || 
    lowerHtml.includes('bg-') && (lowerHtml.includes('py-28') || lowerHtml.includes('py-24'))
  )) {
    return 'hero';
  }
  
  // Card grid - has multiple cards in a grid
  if (lowerHtml.includes('grid') && (
    lowerHtml.includes('card') || 
    lowerHtml.match(/grid-cols-\d+/)
  )) {
    return 'card_grid';
  }
  
  // Checklist - has checkmarks or list items with checkmarks
  if (lowerHtml.includes('check') || 
      lowerHtml.includes('✓') || 
      lowerHtml.includes('✅') ||
      (lowerHtml.includes('<li') && lowerHtml.includes('rounded-full'))) {
    return 'checklist_block';
  }
  
  // Stats strip - has numbers/statistics
  if (lowerHtml.includes('text-5xl') || 
      lowerHtml.includes('text-4xl') && lowerHtml.includes('font-bold') ||
      lowerHtml.match(/\d+%|\d+k|\d+m/i)) {
    return 'stats_strip';
  }
  
  // CTA banner - has call-to-action button/link prominently
  if (lowerHtml.includes('cta') || 
      (lowerHtml.includes('button') && lowerHtml.includes('bg-') && lowerHtml.includes('px-8'))) {
    return 'cta_banner';
  }
  
  // FAQ accordion - has question/answer pairs
  if (lowerHtml.includes('faq') || 
      lowerHtml.includes('question') && lowerHtml.includes('answer') ||
      lowerHtml.includes('accordion')) {
    return 'faq_accordion';
  }
  
  // Table - has table elements
  if (lowerHtml.includes('<table') || lowerHtml.includes('<tr')) {
    return 'table';
  }
  
  // Two column - has two column layout
  if (lowerHtml.includes('grid-cols-2') || 
      lowerHtml.includes('two-column') ||
      (lowerHtml.includes('grid') && lowerHtml.includes('md:grid-cols-2'))) {
    return 'two_column';
  }
  
  // Quote block - has blockquote or quote styling
  if (lowerHtml.includes('<blockquote') || 
      lowerHtml.includes('quote') ||
      lowerHtml.includes('"') && lowerHtml.includes('italic')) {
    return 'quote_block';
  }
  
  // Form block - has form elements
  if (lowerHtml.includes('<form') || lowerHtml.includes('input') || lowerHtml.includes('textarea')) {
    return 'form_block';
  }
  
  // Steps timeline - has numbered steps or timeline
  if (lowerHtml.includes('step') || 
      lowerHtml.includes('timeline') ||
      lowerHtml.match(/\d+\.\s+[A-Z]/)) {
    return 'steps_timeline';
  }
  
  // Label value - has label:value pairs
  if (lowerHtml.includes('label') && lowerHtml.includes('value')) {
    return 'label_value';
  }
  
  // Default to text_block
  return 'text_block';
}

/**
 * Infer section purpose from content
 * @param html - The HTML content of a section
 * @returns Inferred purpose or empty string
 */
export function inferSectionPurpose(html: string): string {
  if (!html || typeof html !== 'string') {
    return '';
  }
  
  const lowerHtml = html.toLowerCase();
  const title = html.match(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/i)?.[1]?.replace(/<[^>]*>/g, '').toLowerCase() || '';
  
  // Purpose inference based on keywords
  if (title.includes('benefit') || title.includes('advantage') || lowerHtml.includes('benefit')) {
    return 'Highlight key benefits and advantages';
  }
  
  if (title.includes('feature') || lowerHtml.includes('feature')) {
    return 'Describe product/service features';
  }
  
  if (title.includes('problem') || title.includes('pain') || lowerHtml.includes('problem')) {
    return 'Address customer pain points';
  }
  
  if (title.includes('solution') || lowerHtml.includes('solution')) {
    return 'Present the solution';
  }
  
  if (title.includes('testimonial') || title.includes('review') || lowerHtml.includes('testimonial')) {
    return 'Show social proof and testimonials';
  }
  
  if (title.includes('pricing') || title.includes('price') || lowerHtml.includes('pricing')) {
    return 'Display pricing information';
  }
  
  if (title.includes('faq') || title.includes('question') || lowerHtml.includes('faq')) {
    return 'Answer frequently asked questions';
  }
  
  if (title.includes('how') || title.includes('process') || lowerHtml.includes('how it works')) {
    return 'Explain how it works';
  }
  
  if (title.includes('about') || title.includes('who') || lowerHtml.includes('about us')) {
    return 'Provide company/about information';
  }
  
  if (title.includes('contact') || lowerHtml.includes('contact')) {
    return 'Contact information and CTA';
  }
  
  return '';
}

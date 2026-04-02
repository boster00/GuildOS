import { NextResponse } from 'next/server';
import { createClient } from '@/libs/supabase/server';

/**
 * Extract CSS API Route
 * Extracts CSS links and inline styles from HTML
 */

/**
 * Remove all HTML comments (e.g. <!-- ... -->) so commented-out
 * stylesheets and style blocks are not extracted.
 */
const removeHtmlComments = (html) => {
  if (!html || typeof html !== 'string') return html;
  return html.replace(/<!--[\s\S]*?-->/g, '');
};

/**
 * Extract all stylesheet link URLs from HTML
 */
const extractCssLinks = (html) => {
  const links = [];
  
  // Match link tags with rel="stylesheet"
  const linkRegex = /<link[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>|<link[^>]*href=["']([^"']+)["'][^>]*rel=["']stylesheet["'][^>]*>/gi;
  let match;
  
  while ((match = linkRegex.exec(html)) !== null) {
    const href = match[1] || match[2];
    if (href && href.trim()) {
      links.push(href.trim());
    }
  }
  
  return links;
};

/**
 * Extract all inline style tag contents from HTML
 */
const extractInlineStyles = (html) => {
  const styles = [];
  const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let match;
  
  while ((match = styleRegex.exec(html)) !== null) {
    const styleContent = match[1].trim();
    if (styleContent) {
      styles.push(styleContent);
    }
  }
  
  return styles.join('\n\n');
};

/**
 * POST /api/settings/extract-css
 * Body: { html: string }
 * Returns: { links: string[], inlineStyles: string }
 */
export async function POST(request) {
  try {
    const supabase = await createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { html } = body;

    if (!html || !html.trim()) {
      return NextResponse.json(
        { error: 'HTML content is required' },
        { status: 400 }
      );
    }

    // Remove commented-out HTML first so commented stylesheets/style blocks are not extracted
    const cleanedHtml = removeHtmlComments(html);

    // Extract CSS links and inline styles from the cleaned HTML
    const links = extractCssLinks(cleanedHtml);
    const inlineStyles = extractInlineStyles(cleanedHtml);

    // Check if any CSS was found
    if (links.length === 0 && !inlineStyles) {
      return NextResponse.json(
        { 
          error: 'No CSS found in the provided HTML',
          links: [],
          inlineStyles: ''
        },
        { status: 400 }
      );
    }
    return NextResponse.json({
      success: true,
      links,
      inlineStyles,
      summary: {
        linksCount: links.length,
        inlineStylesLength: inlineStyles.length
      }
    });

  } catch (error) {
    return NextResponse.json(
      { error: error.message || 'Failed to extract CSS' },
      { status: 500 }
    );
  }
}

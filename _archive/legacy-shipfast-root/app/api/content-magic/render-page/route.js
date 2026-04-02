import { NextResponse } from 'next/server';

export const maxDuration = 60;

// On Vercel use playwright-core + @sparticuz/chromium (serverless Chromium). Locally use full playwright.
async function launchBrowser() {
  if (process.env.VERCEL === '1' || process.env.VERCEL_REGION) {
    const { chromium: playwrightChromium } = await import('playwright-core');
    const chromiumPkg = await import('@sparticuz/chromium');
    const executablePath = await chromiumPkg.default.executablePath();
    return playwrightChromium.launch({
      headless: true,
      executablePath,
      args: chromiumPkg.default.args,
    });
  }
  const { chromium } = await import('playwright');
  return chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
}

export async function POST(request) {
  let browser = null;
  
  try {
    const { demoUrl, articleId, includeStyles = true } = await request.json();

    // Validate inputs
    if (!demoUrl) {
      return NextResponse.json(
        { error: 'demoUrl is required' },
        { status: 400 }
      );
    }
    // Launch headless browser (on Vercel uses @sparticuz/chromium; locally uses playwright)
    try {
      browser = await launchBrowser();
    } catch (launchError) {
      const msg = launchError?.message || String(launchError);
      const isMissingBrowser = /executable doesn't exist|playwright was just installed|npx playwright install/i.test(msg);
      return NextResponse.json(
        {
          error: isMissingBrowser
            ? 'Live preview is not available in this environment (browser not installed). Use Import from URL or paste HTML with sections instead.'
            : msg,
          code: isMissingBrowser ? 'BROWSER_UNAVAILABLE' : undefined
        },
        { status: 503 }
      );
    }

    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    const page = await context.newPage();
    // Navigate to the demo page with longer timeout for complex pages
    await page.goto(demoUrl, {
      waitUntil: 'networkidle',
      timeout: 60000 // 60 second timeout
    });
    const deadline = Date.now() + 10 * 60 * 1000; // 10 minutes total
    const waitOnce = () => {
      const remaining = Math.max(2000, deadline - Date.now() - 1000);
      return page.waitForSelector('section', { timeout: remaining });
    };

    let sectionFound = false;
    try {
      await waitOnce();
      sectionFound = true;
    } catch (firstError) {
      await new Promise((r) => setTimeout(r, 5000));
      try {
        await waitOnce();
        sectionFound = true;
      } catch (retryError) {
        if (Date.now() >= deadline) {
          throw new Error('Content not ready within 10 minutes. No section found.');
        }
        throw new Error('No section found after retry.');
      }
    }

    if (!sectionFound) {
      throw new Error('No section found on page.');
    }

    

    // First, let's see what the page structure looks like
    const pageDebugInfo = await page.evaluate(() => {
      const html = document.body.outerHTML;
      const firstStart = html.indexOf('<section');
      const lastEnd = html.lastIndexOf('</section>');
      return {
        bodyHTMLLength: html.length,
        firstSectionIndex: firstStart,
        lastSectionEndIndex: lastEnd === -1 ? -1 : lastEnd + '</section>'.length
      };
    });

    

    // Extract the rendered HTML with optional styling from the page
    const result = await page.evaluate((shouldIncludeStyles) => {
      let stylesHTML = '';
      let fontLinkHTML = '';
      let contentHTML = '';
      // 1. Extract style tags (only if includeStyles is true)
      if (shouldIncludeStyles) {
        const styleTags = Array.from(document.querySelectorAll('style'));
        const relevantStyles = styleTags.filter(style => {
          const content = style.textContent || '';
          // Look for Tailwind-related styles (contains CSS custom properties or utility classes)
          return content.includes('--') || content.includes('@layer') || content.length > 1000;
        });
        
        if (relevantStyles.length > 0) {
          // Extract CSS content and wrap in <style> tags (scoping will happen on server side)
          stylesHTML = relevantStyles.map(s => {
            const cssContent = s.textContent || '';
            return `<style>${cssContent}</style>`;
          }).join('\n');
        }
        
        // 2. Extract all font-related link tags
        const fontLinks = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).filter(link => {
          const href = link.getAttribute('href') || '';
          // Capture Google Fonts or any font CDN
          return href.includes('fonts.googleapis.com') || 
                 href.includes('fonts.gstatic.com') ||
                 href.includes('typekit.net') ||
                 href.includes('use.typekit.com') ||
                 href.match(/font/i); // Generic font pattern
        });
        
        if (fontLinks.length > 0) {
          fontLinkHTML = fontLinks.map(link => link.outerHTML).join('\n');
          
        }
      }
      
      // 3. Extract content: first occurrence of '<section' to last '</section>' (string-based, no DOM).
      
      const html = document.body.outerHTML;
      const firstStart = html.indexOf('<section');
      const lastEnd = html.lastIndexOf('</section>');
      const closeTag = '</section>';
      if (firstStart !== -1 && lastEnd !== -1 && lastEnd >= firstStart) {
        contentHTML = html.substring(firstStart, lastEnd + closeTag.length);
      } else {
      }

      const combinedHTML = fontLinkHTML + '\n' + stylesHTML + '\n' + contentHTML;
      return { combinedHTML, contentFound: !!contentHTML };
    }, includeStyles);

    const html = result?.combinedHTML ?? '';
    const contentFound = result?.contentFound ?? false;

    if (!contentFound || !html || html.trim().length === 0) {
      throw new Error(
        'Content not found: no <section or </section> in page HTML.'
      );
    }

    // Resolve relative img src against demo URL origin
    let scopedHtml = html;
    let imgRootUrl;
    try {
      imgRootUrl = new URL(demoUrl).origin;
    } catch (_) {
      imgRootUrl = null;
    }
    if (imgRootUrl) {
      scopedHtml = scopedHtml.replace(/<img([^>]*)>/gi, (match, attrs) => {
        const newAttrs = attrs.replace(/\bsrc=(["'])([^"']+)\1/i, (m, quote, src) => {
          const trimmed = src.trim();
          if (!trimmed || /^(https?:|\/\/)/i.test(trimmed)) return m;
          try {
            return `src=${quote}${new URL(trimmed, demoUrl).href}${quote}`;
          } catch (_) {
            return m;
          }
        });
        return '<img' + newAttrs + '>';
      });
    }

    // No .editorContent CSS prefixing: editor uses shadow DOM so scoping is redundant.

    // Add "default-template" class to each section element
    const sectionTagCount = (scopedHtml.match(/<section/gi) || []).length;
    

    scopedHtml = scopedHtml.replace(/<section class="/gi, '<section class="default-template ');

    
    

    // Build response payload
    const responsePayload = {
      success: true,
      html: scopedHtml,
      sourceUrl: demoUrl,
      htmlLength: scopedHtml.length
    };

    // Log full response object (html truncated so console is readable)
    const logPayload = {
      ...responsePayload,
      html: `[${scopedHtml.length} chars total] PREVIEW (first 1000): ` + scopedHtml.substring(0, 1000)
    };
    
    
    // Close browser
    await browser.close();
    browser = null;

    // Return the HTML (single line, all Tailwind classes preserved, styles scoped to )
    return NextResponse.json(responsePayload);

  } catch (error) {
    // Clean up browser if still open
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
      }
    }
    
    return NextResponse.json(
      { 
        error: error.message || 'Failed to render page',
        details: error.toString(),
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

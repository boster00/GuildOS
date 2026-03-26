import { NextResponse } from 'next/server';
import { initMonkey } from '@/libs/monkey';
import { readFileSync } from 'fs';
import { join } from 'path';

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { articleId, files } = body;

    // Validate inputs
    if (!articleId) {

      return NextResponse.json(
        { error: 'articleId is required' },
        { status: 400 }
      );
    }

    if (!files || !Array.isArray(files) || files.length === 0) {

      return NextResponse.json(
        { error: 'files array is required and must not be empty' },
        { status: 400 }
      );
    }

    // Read frontend standards (editor.css) for reference
    let frontendStandards = '';
    try {
      const editorCssPath = join(process.cwd(), 'app', '(private)', 'content-magic', 'editor.css');
      frontendStandards = readFileSync(editorCssPath, 'utf-8');
      
    } catch (err) {

      frontendStandards = 'Frontend standards file not available. Use semantic HTML with proper heading hierarchy.';
    }

    // Combine all files into a single context
    const filesContext = files.map((file, idx) => {
      return `--- File ${idx + 1}: ${file.name} ---\n${file.content}\n`;
    }).join('\n\n');

    // Build the AI prompt
    const prompt = `You are an expert at converting React/Next.js components and code into clean, semantic HTML that complies with our frontend standards.

TASK: Convert the provided code files into a single, well-structured HTML document that will be displayed in our content editor.

INPUT FILES:
${filesContext}

FRONTEND STANDARDS (from editor.css):
${frontendStandards}

REQUIREMENTS:
1. Extract the main content structure from the provided files (React components, TypeScript, etc.)
2. Convert React components into semantic HTML equivalents
3. Remove all React-specific syntax (JSX, hooks, imports, etc.)
4. Convert Tailwind CSS classes to inline styles or semantic HTML where appropriate
5. Ensure the HTML structure follows our frontend standards:
   - Use proper heading hierarchy (h1, h2, h3, h4, h5, h6)
   - Use semantic HTML elements (header, main, section, article, footer, nav, etc.)
   - Preserve content structure and meaning
   - Maintain readability and logical flow
6. If the files contain multiple components, combine them into a cohesive single-page structure
7. Remove any Next.js-specific code (getServerSideProps, metadata, etc.)
8. Convert any interactive elements (buttons, links) to static HTML equivalents
9. Ensure all text content is preserved
10. Use proper HTML5 semantic structure
11. The output should be clean HTML that can be directly inserted into our content editor

OUTPUT FORMAT:
- Return ONLY the HTML content
- Do NOT include <!DOCTYPE>, <html>, <head>, or <body> tags
- Start directly with the main content (e.g., <h1>, <section>, etc.)
- Do NOT include markdown code fences
- Do NOT include explanations or comments

Now convert the provided files into compliant HTML:`;

    // Initialize monkey and call AI
    const monkey = await initMonkey();
    monkey.loadUserContext(body?.user_context ?? {});

    const aiResponse = await monkey.AI(prompt, {
      vendor: 'openai',
      model: 'gpt-4o',
      forceJson: false,
    });

    

    // Clean up the response
    let html = aiResponse.trim();
    
    // Remove markdown code fences if present
    html = html.replace(/^```html\s*/i, '');
    html = html.replace(/^```\s*/m, '');
    html = html.replace(/\s*```\s*$/g, '');
    
    // Preserve <style> tags from head before stripping (so we keep proper style adoption)
    const { extractStyleTags, extractEditorContent } = await import('@/libs/content-magic/utils/extractEditorContent');
    const headMatch = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
    const stylesFromHead = headMatch ? extractStyleTags(headMatch[1]) : '';

    // Remove any DOCTYPE, html, head, body tags if present
    html = html.replace(/<!DOCTYPE[^>]*>/gi, '');
    html = html.replace(/<html[^>]*>/gi, '');
    html = html.replace(/<\/html>/gi, '');
    html = html.replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '');
    html = html.replace(/<body[^>]*>/gi, '');
    html = html.replace(/<\/body>/gi, '');
    
    // Trim whitespace
    html = html.trim();

    if (!html || html.length === 0) {

      throw new Error('AI returned empty HTML content');
    }

    // Same rendering as render-page: remove header/footer, keep only section content (or strip header/footer/nav).
    // extractEditorContent also preserves and prepends any <style> from body.
    html = extractEditorContent(html);

    // Prepend styles that were in head so editor retains proper style rendering (body styles already in html from extractEditorContent)
    if (stylesFromHead) {
      html = `${stylesFromHead}\n${html}`;
    }

    // Extract sections from div wrapper if present
    // This helps avoid including nav/footer and keeps only the section content
    function extractSections(htmlString) {
      // Use DOMParser to parse HTML (works in Node.js with jsdom or similar)
      // For server-side, we'll use a regex approach that's more reliable
      try {
        // Check if HTML starts with a div that contains only section children
        const divWrapperPattern = /^<div[^>]*>([\s\S]*?)<\/div>$/i;
        const match = htmlString.trim().match(divWrapperPattern);
        
        if (match) {
          const innerContent = match[1].trim();
          // Check if inner content contains only section elements (with possible whitespace)
          const sectionPattern = /<section[^>]*>[\s\S]*?<\/section>/gi;
          const sections = innerContent.match(sectionPattern);
          
          // If we found multiple sections and they're the only significant content, extract them
          if (sections && sections.length > 0) {
            // Check if there's minimal non-section content (just whitespace/newlines)
            const nonSectionContent = innerContent.replace(sectionPattern, '').trim();
            if (nonSectionContent.length < 50) { // Allow some whitespace/newlines

              return sections.join('\n');
            }
          }
        }
      } catch (err) {

      }
      
      // Otherwise return as-is
      return htmlString;
    }

    html = extractSections(html);

    

    return NextResponse.json({
      success: true,
      html: html,
      filesProcessed: files.length
    });

  } catch (error) {
    const msg = error?.message ?? String(error);

    return NextResponse.json(
      {
        error: error.message || 'Failed to adopt outline',
        details: error.toString()
      },
      { status: 500 }
    );
  }
}

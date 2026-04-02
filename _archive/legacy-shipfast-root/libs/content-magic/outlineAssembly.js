/**
 * Shared assembly logic for Edit Draft (Generate New Draft / Improve Existing Draft).
 * Used by generate-outline API. Supports:
 * - Inline mode: full prompt with all reference content appended
 * - File mode: short prompt + file attachments (templates, article, competitors)
 */

/** Max chars per file; v0 limit 20 files. Templates combined into one; each competitor separate. */
const MAX_TEMPLATE_CHARS = 15000;
const MAX_COMPETITOR_CHARS = 10000;
const MAX_CURRENT_PAGE_CHARS = 50000;
const MAX_COMPETITORS = 17;

const IMPROVE_DRAFT_RULES = `IMPORTANT — Improve Existing Draft rules:
- KEEP all existing article components and coding standards (HTML structure, class names, Tailwind usage, semantic markup). Do not change component patterns or styling conventions.
- You MAY edit content inside existing sections (text, copy, headings) where it fits the improvement instructions.
- You MAY insert, prepend, or append new sections to the existing content as needed.
- PRESERVE all existing content: do not remove or replace sections wholesale. All current content must remain; add or refine as instructed.`;

const REQUIREMENTS_CORE = `REQUIREMENTS:
- The main output file MUST be named exactly "index.html" (do not use page.tsx or app/page.tsx)
- Pure HTML + Tailwind CSS (NO React components)
- All custom styling in a <style> tag in index.html. No separate CSS files
- Fully offline-capable (no CDN dependencies). Convert Tailwind classes to pure CSS in <style>
- Responsive, semantic HTML, production-ready
- Do NOT use inline emoticons or emoji. Use HTML-based icons only (inline SVG, icon fonts). Text and UI: plain text or HTML/SVG only.
- Deliverable must work completely offline without external dependencies.`;

function getCustomCssRule(useCustomTemplates, allowGeneratingCustomCss) {
  if (!useCustomTemplates) return '';
  if (allowGeneratingCustomCss) {
    return '\n- Allow using custom <style> tag CSS. Put <style> inside the section it affects (or use inline styles). Scope selectors to that section\'s unique id so styles do not leak.';
  }
  return '\n- Do NOT allow using custom <style> tag CSS. Use only existing classes from the provided custom templates and css_class_references.txt.';
}

/**
 * Assemble full prompt for inline mode (everything appended to prompt).
 * @param {'generate'|'improve'} mode
 * @param {Object} params
 */
export function assembleInlinePrompt(mode, params) {
  if (mode === 'improve') {
    return assembleImprovePrompt(params);
  }
  return assemblePrompt(params);
}

function assemblePrompt({
  userPrompt,
  contextPrompt,
  competitorUrls = [],
  competitorContents = [],
  allowImageGeneration,
  useCustomTemplates = false,
  allowGeneratingCustomCss = false,
  customTemplates = [],
  customCss = '',
  cssClassReferences = '',
}) {
  const requirementsExtra = allowImageGeneration
    ? '\n- Allow custom image generation by AI where necessary. Do not use placeholders for images; generate actual images if needed.'
    : '';
  const customCssRule = getCustomCssRule(useCustomTemplates, allowGeneratingCustomCss);
  const refNote = [customTemplates?.length > 0 || customCss ? 'Use the custom CSS and templates in the REFERENCE CONTENT section below for styling and structure.' : '', 'Use the competitor reference(s) in the REFERENCE CONTENT section below for style and structure.'].filter(Boolean).join(' ');

  const instructionsParts = [
    REQUIREMENTS_CORE + customCssRule + requirementsExtra,
    'TASK: Follow the requirements above. Generate the page according to the user prompt and context below. ' + (refNote ? refNote : ''),
    `USER PROMPT:\n${userPrompt || ''}`,
    contextPrompt && String(contextPrompt).trim() ? `CONTEXT:\n${contextPrompt}` : '',
    '--- REFERENCE CONTENT (use for styling/structure; follow the task above) ---',
  ];

  const referenceParts = [];
  if (customCss && String(customCss).trim()) {
    referenceParts.push(`CUSTOM CSS (use for styling the page):\n<custom_css>\n${String(customCss).trim().substring(0, MAX_TEMPLATE_CHARS)}\n</custom_css>`);
  }
  if (customTemplates?.length > 0) {
    const templateParts = [
      'CUSTOM TEMPLATES (use their structure and patterns for sections/layout; each section is labeled TEMPLATE: name):',
      'Use only the structure, classes, and styles from the templates above. Do not add inline style attributes (style="...") to elements — all styling must come from template CSS classes or scoped <style> tags.',
      '',
    ];
    customTemplates.forEach((t, idx) => {
      const name = t.name || t.id || `Template ${idx + 1}`;
      const content = (t.html || '').trim().substring(0, MAX_TEMPLATE_CHARS);
      if (content) {
        templateParts.push(`<!-- ========== TEMPLATE: ${name} ========== -->`);
        templateParts.push('');
        templateParts.push(content);
        templateParts.push('');
      }
    });
    referenceParts.push(templateParts.join('\n'));
  }
  const count = Math.min(
    Math.max(competitorUrls?.length || 0, competitorContents?.length || 0),
    MAX_COMPETITORS
  );
  for (let idx = 0; idx < count; idx++) {
    const url = (competitorUrls[idx] || '').trim() || `Competitor ${idx + 1}`;
    const content = (competitorContents[idx] || '').substring(0, MAX_COMPETITOR_CHARS);
    if (content) {
      referenceParts.push(`COMPETITOR PAGE (${url}):\n<reference>\n${content}\n</reference>`);
    }
  }

  return [...instructionsParts.filter(Boolean), ...referenceParts].join('\n\n');
}

function assembleImprovePrompt({
  improvementInstructions,
  contextPrompt,
  currentPageContent,
  improveCoverageOption,
  allowImageGeneration,
  useCustomTemplates = false,
  allowGeneratingCustomCss = false,
  customTemplates = [],
  customCss = '',
}) {
  const requirementsExtra = allowImageGeneration
    ? '\n- Allow custom image generation by AI where necessary. Do not use placeholders for images; generate actual images if needed.'
    : '';
  const customCssRule = getCustomCssRule(useCustomTemplates, allowGeneratingCustomCss);

  const instructionsParts = [
    REQUIREMENTS_CORE + customCssRule + requirementsExtra,
    IMPROVE_DRAFT_RULES,
    'TASK: Improve the page according to the improvement instructions below. Apply the rules above to the current page HTML in the REFERENCE CONTENT section.',
    `IMPROVEMENT INSTRUCTIONS:\n${improvementInstructions || ''}`,
  ];
  if (improveCoverageOption === 'also_cover_assets' && contextPrompt && String(contextPrompt).trim()) {
    instructionsParts.push(`ADDITIONAL CONTEXT TO INCORPORATE:\n${contextPrompt}`);
    instructionsParts.push('NOTE: Also try to naturally incorporate the topics, keywords, and prompts from the context where relevant.');
  }
  instructionsParts.push('--- REFERENCE CONTENT (current page to improve; custom CSS/templates if any) ---');

  const referenceParts = [];
  if (customCss && String(customCss).trim()) {
    referenceParts.push(`CUSTOM CSS (use for styling):\n<custom_css>\n${String(customCss).trim().substring(0, MAX_TEMPLATE_CHARS)}\n</custom_css>`);
  }
  if (customTemplates?.length > 0) {
    const templateParts = [
      'CUSTOM TEMPLATES (use their structure and patterns where relevant):',
      'Use only the structure, classes, and styles from the templates above. Do not add inline style attributes (style="...") to elements — all styling must come from template CSS classes or scoped <style> tags.',
      '',
    ];
    customTemplates.forEach((t, idx) => {
      const name = t.name || t.id || `Template ${idx + 1}`;
      const content = (t.html || '').trim().substring(0, MAX_TEMPLATE_CHARS);
      if (content) {
        templateParts.push(`<!-- ========== TEMPLATE: ${name} ========== -->`);
        templateParts.push('');
        templateParts.push(content);
        templateParts.push('');
      }
    });
    referenceParts.push(templateParts.join('\n'));
  }
  const pageContent = String(currentPageContent || '').trim().substring(0, MAX_CURRENT_PAGE_CHARS);
  if (pageContent) {
    referenceParts.push(`CURRENT PAGE (improve this):\n<current_page>\n${pageContent}\n</current_page>`);
  }

  return [...instructionsParts.filter(Boolean), ...referenceParts].join('\n\n');
}

/**
 * Build files array + short prompt for file mode.
 * Files: custom templates (one combined), existing article, competitor contents (one per).
 * Custom CSS is NOT in files; it goes in the prompt only.
 *
 * @param {'generate'|'improve'} mode
 * @param {Object} params
 * @returns {{ prompt: string, files: Array<{ name: string, content: string }> }}
 */
export function buildFilesAndShortPrompt(mode, params) {
  const {
    userPrompt,
    contextPrompt,
    competitorUrls = [],
    competitorContents = [],
    customTemplates = [],
    customCss = '',
    cssClassReferences = '',
    allowImageGeneration,
    useCustomTemplates = false,
    allowGeneratingCustomCss = false,
    improvementInstructions,
    currentPageContent,
    improveCoverageOption,
  } = params;

  const files = [];

  // 1. Custom templates (one combined file). No custom CSS in files.
  if (customTemplates?.length > 0) {
    const parts = [
      '<!-- Multiple custom HTML templates below. Use their structure and patterns. Each section is labeled TEMPLATE: name -->',
      '<!-- Custom CSS must be scoped per the main instructions. Use only the structure, classes, and styles from these templates. -->',
      '',
    ];
    customTemplates.forEach((t, idx) => {
      const name = t.name || t.id || `Template ${idx + 1}`;
      const content = (t.html || '').trim().substring(0, MAX_TEMPLATE_CHARS);
      if (content) {
        parts.push(`<!-- ========== TEMPLATE: ${name} ========== -->`);
        parts.push('');
        parts.push(content);
        parts.push('');
      }
    });
    files.push({ name: 'custom-templates.html', content: parts.join('\n') });
  }

  // 1b. CSS class references (when custom templates used and references exist)
  if (customTemplates?.length > 0 && String(cssClassReferences || '').trim()) {
    files.push({ name: 'css_class_references.txt', content: String(cssClassReferences).trim() });
  }

  // 2. Existing article (Improve mode)
  if (mode === 'improve') {
    const content = String(currentPageContent || '').trim().substring(0, MAX_CURRENT_PAGE_CHARS);
    if (content) {
      files.push({ name: 'current-page.html', content });
    }
  }

  // 3. Competitor contents (one file per competitor, Generate mode)
  if (mode === 'generate' && competitorContents?.length > 0) {
    const count = Math.min(competitorContents.length, MAX_COMPETITORS);
    for (let idx = 0; idx < count; idx++) {
      const content = (competitorContents[idx] || '').substring(0, MAX_COMPETITOR_CHARS);
      if (content) {
        files.push({ name: `competitor-${idx + 1}.html`, content });
      }
    }
  }

  // Placeholder if no files (v0 init expects at least one)
  if (files.length === 0) {
    files.push({
      name: 'reference-placeholder.html',
      content: '<!DOCTYPE html><html><head><title>Reference</title></head><body><h1>Reference page</h1><p>Use this as design reference.</p></body></html>',
    });
  }

  const requirementsExtra = allowImageGeneration
    ? '\n- Allow custom image generation by AI where necessary. Do not use placeholders for images; generate actual images if needed.'
    : '';
  const customCssRule = getCustomCssRule(useCustomTemplates, allowGeneratingCustomCss);

  let promptParts;
  if (mode === 'improve') {
    promptParts = [
      REQUIREMENTS_CORE + customCssRule + requirementsExtra,
      IMPROVE_DRAFT_RULES,
      'TASK: Improve the page (see attached current-page.html) per the improvement instructions below. Apply the rules above.',
      `IMPROVEMENT INSTRUCTIONS:\n${improvementInstructions || ''}`,
    ];
    if (improveCoverageOption === 'also_cover_assets' && contextPrompt && String(contextPrompt).trim()) {
      promptParts.push(`ADDITIONAL CONTEXT TO INCORPORATE:\n${contextPrompt}`);
      promptParts.push('NOTE: Also try to naturally incorporate the topics, keywords, and prompts from the context where relevant.');
    }
    promptParts.push(customTemplates?.length > 0
      ? 'Use any attached custom template files for styling/structure reference. Use only the structure, classes, and styles from the templates. Do not add inline style attributes (style="...") to elements — all styling must come from template CSS classes or scoped <style> tags.'
      : 'Use any attached custom template files for styling/structure reference.');
    if (customCss && String(customCss).trim()) {
      promptParts.push(`CUSTOM CSS (use for styling):\n<custom_css>\n${String(customCss).trim().substring(0, MAX_TEMPLATE_CHARS)}\n</custom_css>`);
    }
  } else {
    promptParts = [
      REQUIREMENTS_CORE + customCssRule + requirementsExtra,
      'TASK: Generate the page according to the user prompt and context below. Use the attached files (custom templates, competitor pages) for style and structure.' +
      (customTemplates?.length > 0 ? ' When custom templates are used, use only the structure, classes, and styles from those templates. Do not add inline style attributes (style="...") to elements — all styling must come from template CSS classes or scoped <style> tags.' : ''),
      `USER PROMPT:\n${userPrompt || ''}`,
      contextPrompt && String(contextPrompt).trim() ? `CONTEXT:\n${contextPrompt}` : '',
    ].filter(Boolean);
    if (customCss && String(customCss).trim()) {
      promptParts.push(`CUSTOM CSS (use for styling):\n<custom_css>\n${String(customCss).trim().substring(0, MAX_TEMPLATE_CHARS)}\n</custom_css>`);
    }
  }

  return { prompt: promptParts.join('\n\n'), files };
}

/** Substrings in file names that indicate input/reference files (not the generated result). */
const INPUT_FILE_NAME_MARKERS = /competitor|current|template|reference/;

/**
 * From v0 response files, find the result HTML file (not an input we attached).
 * Inputs we attach: custom-templates.html, current-page.html, competitor-*.html, reference-placeholder.html.
 * We ask v0 to output index.html; it may also echo input files. This picks the actual result.
 * @param {Array<{ name?: string, content?: string, source?: string, code?: string }>} files
 * @returns {{ name: string, content: string } | null}
 */
export function findResultHtmlFile(files) {
  if (!files || !Array.isArray(files) || files.length === 0) return null;
  const getContent = (f) => f?.content ?? f?.source ?? f?.code ?? '';
  const getName = (f) => (f?.name != null ? String(f.name) : '');
  // Prefer index.html (requested output)
  let result = files.find((f) => {
    const n = getName(f);
    return n && n.toLowerCase().includes('index.html');
  });
  if (result) return { name: getName(result), content: getContent(result) };
  // Else first .html that is not an input file
  result = files.find((f) => {
    const n = getName(f).toLowerCase();
    return n.includes('.html') && !INPUT_FILE_NAME_MARKERS.test(n);
  });
  return result ? { name: getName(result), content: getContent(result) } : null;
}

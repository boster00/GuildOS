/**
 * Renders a draft-preview shadow DOM from raw HTML.
 * Used by Edit Draft (createOutline) to show the generated draft inside a shadow root
 * with optional profile custom CSS.
 */

import { rewriteDraftCssForShadowRoot } from '@/libs/content-magic/utils/rewriteDraftCssForShadow';

/** Base styles for .editorContent inside shadow root (mirrors QuickActionPopupAIFill / ContentMagicEditor) */
const EDITOR_CONTENT_STYLES = `
.editorContent {
  font-family: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  padding: 1.5rem;
  min-height: 6rem;
  line-height: 1.7;
  color: oklch(0.15 0 0);
  background: oklch(1 0 0);
}
.editorContent :where(em), .editorContent :where(i) { font-style: italic; }
.editorContent :where(u) { text-decoration: underline; }
.editorContent :where(s), .editorContent :where(del) { text-decoration: line-through; }
.editorContent :where(a) { text-decoration: underline; cursor: pointer; }
.editorContent :where(ul), .editorContent :where(ol) { list-style-position: inside; }
.editorContent :where(ul) { list-style-type: disc; }
.editorContent :where(ol) { list-style-type: decimal; }
.editorContent :where(table) { border-collapse: collapse; width: 100%; }
.editorContent :where(table td), .editorContent :where(table th) { text-align: left; }
`;

/**
 * Extract <style> and <link rel="stylesheet"> nodes from the document head.
 * Inline <style> content is rewritten for shadow DOM (:root → :host, body → :host > .editorContent).
 * @param {string} html - Full HTML document string
 * @returns {Array<HTMLStyleElement|HTMLLinkElement>}
 */
export function extractHeadStyles(html) {
  if (typeof DOMParser === 'undefined') return [];
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const head = doc.querySelector('head');
  if (!head) return [];
  const nodes = [];
  head.querySelectorAll('style, link[rel="stylesheet"]').forEach((el) => {
    if (el.tagName === 'STYLE') {
      const style = document.createElement('style');
      style.textContent = rewriteDraftCssForShadowRoot(el.textContent || '');
      nodes.push(style);
    } else {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      if (el.href) link.href = el.href;
      nodes.push(link);
    }
  });
  return nodes;
}

/**
 * Extract body content from a full HTML document (v0 output).
 * @param {string} html - Full HTML document string
 * @returns {string} body innerHTML or fallback
 */
export function extractBodyContent(html) {
  if (typeof DOMParser === 'undefined') return html;
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const body = doc.querySelector('body');
  if (body) return body.innerHTML;
  if (html.includes('<section') || html.includes('<div')) return html;
  return `<section class="">${html}</section>`;
}

/**
 * Create a host element with a shadow root containing the draft HTML and optional custom CSS.
 * @param {string} rawHtml - Full HTML document string (e.g. index.html content from outline.files)
 * @param {{ loadCustomCss?: boolean }} [options] - loadCustomCss: when true, inject profile custom CSS (head with data-custom-css-head) via monkey
 * @returns {Promise<HTMLDivElement>} Host element with shadow root attached; append to container
 */
export async function renderShadowDOM(rawHtml, options = {}) {
  const { loadCustomCss = false } = options;
  const host = document.createElement('div');
  host.className = 'w-full h-full';

  const shadow = host.attachShadow({ mode: 'open' });

  // 1. Base style
//   const baseStyle = document.createElement('style');
//   baseStyle.textContent = EDITOR_CONTENT_STYLES;
//   baseStyle.setAttribute('data-editor-base-style', 'true');
//   shadow.appendChild(baseStyle);

  // 2. Draft head styles from raw HTML
  const stylesWrapper = document.createElement('div');
  stylesWrapper.setAttribute('data-extracted-styles-wrapper', 'true');
  extractHeadStyles(rawHtml).forEach((node) => stylesWrapper.appendChild(node));
  shadow.appendChild(stylesWrapper);

  // 3. Content div (editorContent)
  const editorEl = document.createElement('div');
  editorEl.className = 'editorContent';
  editorEl.style.wordBreak = 'break-word';
  editorEl.style.overflowWrap = 'break-word';
  editorEl.innerHTML = extractBodyContent(rawHtml);
  shadow.appendChild(editorEl);

  // 4. Optional custom CSS head (inserted before editorEl via monkey)
  if (loadCustomCss) {
    const { initMonkey } = await import('@/libs/monkey');
    const monkey = await initMonkey(true);
    await monkey.applyCustomCssToShadowDom(shadow, editorEl);
  }

  return host;
}

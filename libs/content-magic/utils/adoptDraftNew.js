/**
 * Primary adopt path: buildAdoptedHtmlForShadow (Edit Draft "Adopt Draft" + POST /api/content-magic/adopt-draft-new).
 */
import { rewriteDraftCssForShadowRoot } from '@/libs/content-magic/utils/rewriteDraftCssForShadow';
import { extractEditorContent } from '@/libs/content-magic/utils/extractEditorContent';

/**
 * Collect inner text of every <style> tag in the document.
 * @param {string} html
 * @returns {string}
 */
function extractAllStyleInnerText(html) {
  if (!html || typeof html !== 'string') return '';
  const styleRegex = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
  const parts = [];
  let match;
  while ((match = styleRegex.exec(html)) !== null) {
    const inner = match[1];
    if (inner && inner.trim()) parts.push(inner.trim());
  }
  return parts.join('\n\n');
}

/**
 * Stylesheet <link> tags from <head> only (matches draft preview head extraction).
 * @param {string} html
 * @returns {string}
 */
function extractHeadStylesheetLinks(html) {
  if (!html || typeof html !== 'string') return '';
  const headMatch = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i);
  if (!headMatch) return '';
  const headInner = headMatch[1];
  const out = [];
  const linkRe = /<link\b[^>]*>/gi;
  let m;
  while ((m = linkRe.exec(headInner)) !== null) {
    const tag = m[0];
    if (/rel\s*=\s*["']stylesheet["']/i.test(tag) && /href\s*=/i.test(tag)) {
      out.push(tag);
    }
  }
  return out.join('\n');
}

/**
 * Strip all <style>...</style> from HTML string (case-insensitive).
 * @param {string} html
 * @returns {string}
 */
function stripStyleTags(html) {
  if (!html || typeof html !== 'string') return '';
  return html.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '').trim();
}

/**
 * Build editor-ready HTML for shadow DOM: one rewritten <style data-draft-styles="true"> + content only.
 * Mirrors draft preview CSS semantics (:root/body rewritten for shadow).
 * @param {string} rawHtml - Full index.html from outline.files
 * @returns {string}
 */
export function buildAdoptedHtmlForShadow(rawHtml) {
  const combinedCss = extractAllStyleInnerText(rawHtml);
  const rewrittenCss = rewriteDraftCssForShadowRoot(combinedCss);
  const withStyles = extractEditorContent(rawHtml);
  const contentOnly = stripStyleTags(withStyles);
  const styleBlock = `<style data-draft-styles="true">\n${rewrittenCss}\n</style>`;
  const headLinks = extractHeadStylesheetLinks(rawHtml);
  const headPart = [styleBlock, headLinks].filter(Boolean).join('\n');
  return contentOnly ? `${headPart}\n${contentOnly}` : headPart;
}

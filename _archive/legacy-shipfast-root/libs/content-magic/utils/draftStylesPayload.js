/**
 * Draft styles payload: parse/serialize content_html that may contain a leading
 * <style data-draft-styles="true"> block (from adopted index.html). Used by the
 * editor so draft styles can live in the shadow DOM and be toggled when custom
 * CSS is on (commented out) vs off (active). Copy/save use the main payload with
 * draft styles in their current status.
 */

const DRAFT_STYLE_OPEN = /<style([^>]*)>([\s\S]*?)<\/style>/i;
const DRAFT_STYLE_ATTR = 'data-draft-styles="true"';

/**
 * Unwrap CSS that was commented out (e.g. when custom CSS was on at save/copy).
 * @param {string} text - Style tag content, possibly wrapped in /* ... *\/
 * @returns {{ raw: string, wasCommented: boolean }}
 */
function uncommentDraftCss(text) {
  if (!text || typeof text !== 'string') return { raw: '', wasCommented: false };
  const trimmed = text.trim();
  if (trimmed.startsWith('/*') && trimmed.endsWith('*/')) {
    const inner = trimmed.slice(2, -2).trim();
    return { raw: inner, wasCommented: true };
  }
  return { raw: trimmed, wasCommented: false };
}

/**
 * Parse content_html into draft styles (raw CSS) and body HTML.
 * Handles both active and commented draft style blocks.
 * @param {string} html - Full content_html (may start with <style data-draft-styles="true">...)
 * @returns {{ draftStylesRaw: string | null, bodyHtml: string }}
 */
export function parseDraftStylesAndBody(html) {
  if (!html || typeof html !== 'string') return { draftStylesRaw: null, bodyHtml: html || '' };
  const match = html.match(DRAFT_STYLE_OPEN);
  if (!match) return { draftStylesRaw: null, bodyHtml: html };
  const [, attrs = '', content] = match;
  // Treat as draft-styles block if it has the attribute or it's the first/only leading style (adopted content)
  const isDraft = attrs.includes('data-draft-styles') || html.trimStart().startsWith('<style');
  if (!isDraft) return { draftStylesRaw: null, bodyHtml: html };
  const { raw } = uncommentDraftCss(content);
  const bodyStart = html.indexOf('</style>') + 8;
  const bodyHtml = html.slice(bodyStart).replace(/^\s*\n?/, '');
  return { draftStylesRaw: raw || null, bodyHtml };
}

/**
 * Serialize draft styles + body into the main payload (for getHtml / copy / save).
 * @param {object} opts
 * @param {string | null} opts.draftStylesRaw - Raw draft CSS (uncommented)
 * @param {string} opts.bodyHtml - Body HTML
 * @param {boolean} [opts.commentDraftStyles] - If true, wrap draft CSS in a block comment in the style tag
 * @returns {string}
 */
export function serializeDraftStylesAndBody({ draftStylesRaw, bodyHtml, commentDraftStyles = false }) {
  const body = bodyHtml || '';
  if (!draftStylesRaw || !draftStylesRaw.trim()) return body;
  const styleContent = commentDraftStyles
    ? `/*\n${draftStylesRaw}\n*/`
    : draftStylesRaw;
  return `<style data-draft-styles="true">\n${styleContent}\n</style>\n${body}`;
}

/**
 * LEGACY — used only by the old adopt pipeline (POST /api/content-magic/adopt-draft).
 * New adopt uses buildAdoptedHtmlForShadow which already sets data-draft-styles="true".
 * Will be removed with adopt-draft route.
 *
 * Ensure the first <style> in adopted HTML has data-draft-styles="true".
 * @param {string} html - HTML that already has a leading <style>...</style> (e.g. from extractEditorContent)
 * @returns {string}
 */
export function markAdoptedDraftStyles(html) {
  if (!html || typeof html !== 'string') return html;
  return html.replace(/<style(\s*)([^>]*)>/i, (m, s, rest) => {
    if (rest && rest.includes('data-draft-styles')) return m;
    const attr = rest.trim() ? ` ${rest.trim()}` : '';
    return `<style data-draft-styles="true"${attr}>`;
  });
}

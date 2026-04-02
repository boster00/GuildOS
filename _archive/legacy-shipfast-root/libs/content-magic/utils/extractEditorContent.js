/**
 * Extract editor-ready content from full-page HTML (same behavior as render-page).
 * - Removes header/footer/nav and other chrome: keeps only first <section to last </section>, or strips boilerplate.
 * - Optionally resolves relative img src to absolute URLs given a base URL.
 *
 * Removal rules aligned with html-to-canonical-md and html-to-canonical-md-ast:
 * - Tags: header, footer, nav, aside, script, noscript
 * - Roles: navigation, banner, contentinfo
 * - Class/ID patterns: nav, menu, breadcrumb, sidebar, cookie, consent, modal, popup, social, share, newsletter, subscribe, pagination, etc.
 */

/** Tags to remove entirely (same as NOISE_PATTERNS.REMOVE_TAGS minus style – we keep style for editor) */
const REMOVE_TAGS = ['header', 'footer', 'nav', 'aside', 'script', 'noscript'];

/** Class/ID patterns that indicate nav/chrome (same as html-to-canonical-md REMOVE_CLASSES) */
const BOILERPLATE_CLASS_PATTERNS = [
  'nav', 'menu', 'breadcrumb', 'footer', 'header', 'cookie', 'consent',
  'popup', 'modal', 'social', 'share', 'sidebar', 'related', 'recommended',
  'newsletter', 'subscribe', 'pagination', 'pager'
];

/** Roles that indicate navigation/chrome (ARIA) */
const CHROME_ROLES = ['navigation', 'banner', 'contentinfo'];

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Remove elements that have role="navigation" | "banner" | "contentinfo".
 * Matches any tag and removes the whole element (open to matching close).
 */
function removeByRole(html) {
  let out = html;
  const rolePattern = CHROME_ROLES.map(escapeRegex).join('|');
  const roleRegex = new RegExp(
    `<(\\w+)\\b[^>]*role=["'](?:${rolePattern})["'][^>]*>[\\s\\S]*?<\\/\\1>`,
    'gi'
  );
  // Run multiple passes in case of nested role elements
  for (let i = 0; i < 5; i++) {
    const next = out.replace(roleRegex, '');
    if (next === out) break;
    out = next;
  }
  return out;
}

/**
 * Remove div/section/aside elements whose class or id matches boilerplate patterns.
 * Same approach as html-to-canonical-md-ast (one pattern per run; non-greedy close).
 */
function removeByBoilerplateClass(html) {
  let out = html;
  const tagList = 'div|section|aside';
  for (const pattern of BOILERPLATE_CLASS_PATTERNS) {
    const escaped = escapeRegex(pattern);
    const regex = new RegExp(
      `<(${tagList})\\b[^>]*(?:class|id)=["'][^"']*${escaped}[^"']*["'][^>]*>[\\s\\S]*?<\\/\\1>`,
      'gi'
    );
    for (let i = 0; i < 3; i++) {
      const next = out.replace(regex, '');
      if (next === out) break;
      out = next;
    }
  }
  return out;
}

/**
 * Extract all <style>...</style> tags from HTML (from head or body).
 * Used to preserve styles when we strip head or return only section content.
 * @param {string} html - Full HTML string
 * @returns {string} All <style>...</style> tags concatenated, or '' if none
 */
export function extractStyleTags(html) {
  if (!html || typeof html !== 'string') return '';
  const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  const parts = [];
  let match;
  while ((match = styleRegex.exec(html)) !== null) {
    const content = match[1];
    if (content && content.trim()) {
      parts.push(`<style>${content}</style>`);
    }
  }
  return parts.length ? parts.join('\n') : '';
}

/**
 * Extract content from first <section to last </section> (string-based, same as render-page).
 * If no section tags, strip header/footer/nav and other common chrome (tags, roles, boilerplate class/id).
 * Style tags are always preserved and prepended so editor rendering (scoped CSS) is retained.
 * @param {string} html - Full HTML string
 * @returns {string} Editor content only (no header/footer/nav/chrome), with style tags preserved
 */
export function extractEditorContent(html) {
  if (!html || typeof html !== 'string') return html;

  // Preserve all <style> tags from the full document (head or body) so adoption keeps proper rendering
  const styleBlock = extractStyleTags(html);

  const firstStart = html.indexOf('<section');
  const lastEnd = html.lastIndexOf('</section>');
  const closeTag = '</section>';

  let content;
  if (firstStart !== -1 && lastEnd !== -1 && lastEnd >= firstStart) {
    content = html.substring(firstStart, lastEnd + closeTag.length);
    if (typeof console !== 'undefined' && console.log) {

    }
  } else {
    // No section tags or lastEnd < firstStart (e.g. </section> in CSS): remove nav/chrome
    if (firstStart !== -1 && lastEnd !== -1 && lastEnd < firstStart && typeof console !== 'undefined' && console.warn) {
      
    } else if ((firstStart === -1 || lastEnd === -1) && typeof console !== 'undefined' && console.log) {
      
    }
    let out = html;

    // 1. Remove by tag (header, footer, nav, aside, script, noscript) – never remove style
    for (const tag of REMOVE_TAGS) {
      const re = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, 'gi');
      for (let i = 0; i < 3; i++) {
        const next = out.replace(re, '');
        if (next === out) break;
        out = next;
      }
    }

    // 2. Remove by role (navigation, banner, contentinfo)
    out = removeByRole(out);

    // 3. Remove elements with boilerplate class/id (navbar, menu, breadcrumb, sidebar, etc.)
    out = removeByBoilerplateClass(out);

    content = out.trim();
  }

  // Prepend preserved styles so editor keeps proper style adoption (same order as render-page: styles then content)
  return styleBlock ? `${styleBlock}\n${content}` : content;
}

/**
 * Resolve relative img src attributes to absolute URLs using baseUrl.
 * Leaves already-absolute (http:, https:, //) and data: URLs unchanged.
 * @param {string} html - HTML string
 * @param {string} baseUrl - Base URL (e.g. demo page origin) for resolving relative src
 * @returns {string} HTML with img src resolved to absolute URLs
 */
export function resolveRelativeImgSrc(html, baseUrl) {
  if (!html || !baseUrl) return html;
  try {
    const base = new URL(baseUrl);
    return html.replace(/<img([^>]*)>/gi, (match, attrs) => {
      const newAttrs = attrs.replace(/\bsrc=(["'])([^"']+)\1/i, (m, quote, src) => {
        const trimmed = src.trim();
        if (!trimmed || /^(https?:|\/\/|data:)/i.test(trimmed)) return m;
        try {
          return `src=${quote}${new URL(trimmed, baseUrl).href}${quote}`;
        } catch (_) {
          return m;
        }
      });
      return '<img' + newAttrs + '>';
    });
  } catch (_) {
    return html;
  }
}

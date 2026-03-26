/**
 * Process HTML to scope CSS styles with .editorContent prefix.
 * LEGACY: primary consumer was the old "Adopt Draft" flow (UI removed; still used by
 * POST /api/content-magic/adopt-draft). Prefix step is currently a no-op (selectors unchanged).
 * Will be removed or repurposed when adopt-draft is deleted.
 */

const EDITOR_SCOPE = '.editorContent ';

/**
 * Prefix all CSS selectors with .editorContent
 * @param {string} css - CSS content
 * @returns {string} Prefixed CSS
 */
function prefixCssSelectors(css) {
  if (!css || !css.trim()) return css;
  let out = '';
  let i = 0;
  const len = css.length;

  function skipWhitespace() {
    while (i < len && /[\s\n\r\t]/.test(css[i])) i++;
  }

  function skipComment() {
    if (i + 1 < len && css[i] === '/' && css[i + 1] === '*') {
      i += 2;
      while (i + 1 < len && !(css[i] === '*' && css[i + 1] === '/')) i++;
      if (i + 1 < len) i += 2;
      return true;
    }
    return false;
  }

  function skipWhitespaceAndComments() {
    do {
      skipWhitespace();
      if (i + 1 < len && css[i] === '/' && css[i + 1] === '*') {
        skipComment();
      } else {
        break;
      }
    } while (true);
  }

  function findBlockEnd(start) {
    if (css[start] !== '{') return -1;
    let depth = 1;
    let j = start + 1;
    while (j < len && depth > 0) {
      const c = css[j];
      if (c === '{') depth++;
      else if (c === '}') depth--;
      j++;
    }
    return depth === 0 ? j : -1;
  }

  function prefixSelector(selector) {
    return selector;
    // const trimmed = selector.trim();
    // if (!trimmed) return trimmed;
    // return trimmed.split(',').map(s => s.trim()).filter(Boolean).map(s => {
    //   if (s === ':root') return '.editorContent';
    //   return EDITOR_SCOPE + s;
    // }).join(', ');
  }

  while (i < len) {
    skipWhitespaceAndComments();
    if (i >= len) break;

    if (css[i] === '@') {
      const atStart = i;
      i++;
      while (i < len && css[i] !== '{' && css[i] !== ';') i++;
      if (i >= len) {
        out += css.substring(atStart);
        break;
      }
      if (css[i] === ';') {
        out += css.substring(atStart, i + 1);
        i++;
        continue;
      }
      const blockEnd = findBlockEnd(i);
      if (blockEnd === -1) {
        out += css.substring(atStart);
        break;
      }
      const atDecl = css.substring(atStart, i);
      const body = css.substring(i + 1, blockEnd - 1);
      out += atDecl + ' {\n' + prefixCssSelectors(body) + '\n}';
      i = blockEnd;
      continue;
    }

    const ruleStart = i;
    while (i < len && css[i] !== '{') i++;
    if (i >= len) {
      out += css.substring(ruleStart);
      break;
    }
    const selector = css.substring(ruleStart, i);
    const blockEnd = findBlockEnd(i);
    if (blockEnd === -1) {
      out += css.substring(ruleStart);
      break;
    }
    const body = css.substring(i + 1, blockEnd - 1);
    out += prefixSelector(selector) + ' {\n' + body + '\n}\n';
    i = blockEnd;
  }

  return out;
}

/**
 * Process HTML to scope all CSS with .editorContent prefix
 * @param {string} html - HTML content
 * @returns {string} HTML with scoped CSS
 */
export function processCssScoping(html) {
  if (!html || typeof html !== 'string') {
    return html;
  }
  // Extract all <style> tag contents
  const styleTagRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  const styleContents = [];
  let styleMatch;
  
  while ((styleMatch = styleTagRegex.exec(html)) !== null) {
    styleContents.push(styleMatch[1]);
  }

  if (styleContents.length === 0) {
    return html;
  }

  

  // Combine all CSS and prefix selectors
  const combinedCss = styleContents.join('\n');
  const prefixedCss = prefixCssSelectors(combinedCss);

  // Replace all <style> tags with a single prefixed one
  let firstStyle = true;
  const scopedHtml = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, () => {
    if (firstStyle) {
      firstStyle = false;
      return `<style>\n${prefixedCss}\n</style>`;
    }
    return ''; // Remove subsequent style tags
  });
  return scopedHtml;
}

/**
 * Rewrite draft document CSS so it applies inside a shadow root.
 * :root → :host; body → :host > .editorContent
 * Used by draft preview (renderShadowDOM), adopt draft (buildAdoptedHtmlForShadow), and monkey applyCustomCssToShadowDom.
 * @param {string} cssText - Raw CSS from draft <style> tag(s)
 * @returns {string} CSS suitable for shadow root
 */
export function rewriteDraftCssForShadowRoot(cssText) {
  if (!cssText || typeof cssText !== 'string') return cssText;
  return cssText
    .replace(/:root\b/g, ':host')
    .replace(/(?<![a-zA-Z0-9_-])body(\s*\{)/g, ':host > .editorContent$1');
}

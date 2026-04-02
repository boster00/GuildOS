/**
 * Shared shadow preview pipeline for quick-action popups (AI fill, edit HTML, change template).
 * Aligns with main editor (data-draft-styles) and draft preview (extracted document head).
 */

import { copyEditorStyleTagsToShadow } from '../components/shadowPreviewStyles';
import {
  extractHeadStyles,
  extractBodyContent,
} from '@/libs/content-magic/utils/renderShadowDOM';

const DRAFT_PREVIEW_ATTR = 'data-preview-draft-styles';
const HEAD_WRAPPER_ATTR = 'data-preview-extracted-head';

/**
 * @param {string} [html]
 * @returns {boolean}
 */
export function isLikelyFullHtmlDocument(html) {
  if (!html || typeof html !== 'string') return false;
  const t = html.trim().slice(0, 800);
  if (/^<!doctype\b/i.test(html.trim())) return true;
  return /<\s*html[\s>]/.test(t) || /<\s*head[\s>]/.test(t);
}

export function removePreviewDraftStyleClones(shadowRoot) {
  if (!shadowRoot) return;
  shadowRoot.querySelectorAll(`style[${DRAFT_PREVIEW_ATTR}="true"]`).forEach((n) => n.remove());
}

export function removePreviewExtractedHeadWrapper(shadowRoot) {
  if (!shadowRoot) return;
  shadowRoot.querySelectorAll(`[${HEAD_WRAPPER_ATTR}="true"]`).forEach((n) => n.remove());
}

/**
 * Clone live editor draft-wide CSS into the preview shadow.
 * @param {ShadowRoot} previewShadow
 * @param {ShadowRoot | null | undefined} editorShadowRoot
 * @param {Node} insertBefore
 */
export function cloneDraftStylesIntoShadow(previewShadow, editorShadowRoot, insertBefore) {
  removePreviewDraftStyleClones(previewShadow);
  if (!editorShadowRoot || !previewShadow) return;
  const src = editorShadowRoot.querySelector('style[data-draft-styles]');
  if (!src || !(src.textContent || '').trim()) return;
  const style = document.createElement('style');
  style.setAttribute(DRAFT_PREVIEW_ATTR, 'true');
  style.textContent = src.textContent;
  previewShadow.insertBefore(style, insertBefore);
}

/**
 * If htmlString looks like a full document, inject rewritten head styles (and link tags) before insertBefore.
 * @returns {boolean} whether head nodes were injected
 */
export function injectHeadStylesFromHtmlIfDocument(previewShadow, htmlString, insertBefore) {
  removePreviewExtractedHeadWrapper(previewShadow);
  if (!previewShadow || !insertBefore?.parentNode) return false;
  if (!isLikelyFullHtmlDocument(htmlString)) return false;
  const nodes = extractHeadStyles(htmlString);
  if (!nodes.length) return false;
  const wrapper = document.createElement('div');
  wrapper.setAttribute(HEAD_WRAPPER_ATTR, 'true');
  wrapper.style.display = 'contents';
  nodes.forEach((n) => wrapper.appendChild(n));
  previewShadow.insertBefore(wrapper, insertBefore);
  return true;
}

/**
 * Body HTML to show inside .editorContent for a preview string (fragment or full document).
 * @param {string} [htmlString]
 * @returns {string}
 */
export function getBodyHtmlForPreview(htmlString) {
  if (htmlString == null) return '';
  if (isLikelyFullHtmlDocument(htmlString)) return extractBodyContent(htmlString);
  return htmlString;
}

/**
 * Full pipeline: draft clone → extracted head (if full doc) → inline &lt;style&gt; from section → optional body.
 * @param {{
 *   shadowRoot: ShadowRoot,
 *   editorShadowRoot?: ShadowRoot | null,
 *   htmlString: string,
 *   selectedElement?: Element | null,
 *   previewDiv: HTMLElement,
 *   setInnerHtml?: boolean
 * }} opts
 */
export function syncQuickActionPreviewShadow({
  shadowRoot,
  editorShadowRoot = null,
  htmlString = '',
  selectedElement = null,
  previewDiv,
  setInnerHtml = true,
}) {
  if (!shadowRoot || !previewDiv) return;
  const insertBefore = previewDiv;
  cloneDraftStylesIntoShadow(shadowRoot, editorShadowRoot, insertBefore);
  injectHeadStylesFromHtmlIfDocument(shadowRoot, htmlString, insertBefore);
  const editorContent =
    selectedElement && typeof selectedElement.closest === 'function'
      ? selectedElement.closest('.editorContent')
      : null;
  copyEditorStyleTagsToShadow({
    editorContent,
    shadowRoot,
    beforeNode: previewDiv,
  });
  if (setInnerHtml) {
    previewDiv.innerHTML = getBodyHtmlForPreview(htmlString);
  }
}

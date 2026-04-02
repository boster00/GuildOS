/**
 * Centralized shadow DOM renderer for HTML + custom CSS.
 * Used by: main editor, draft preview, quick action previews, template viewer.
 */

import { BASE_RESET_CSS } from './baseStyles.js';

const CONTENT_CLASS = 'editorContent';
const HEAD_BUCKET_DATA_ATTR = 'data-shadow-head-bucket';
const CUSTOM_CSS_MARKER_ATTR = 'data-custom-css-injected';

/**
 * Strip <script> tags and on* attributes from HTML or markup string.
 * @param {string} markupOrHtml
 * @returns {string}
 */
export function stripActiveContent(markupOrHtml) {
  if (!markupOrHtml || typeof markupOrHtml !== 'string') return '';
  const parser = new DOMParser();
  const doc = parser.parseFromString(markupOrHtml, 'text/html');

  // Remove all script elements
  const scripts = doc.querySelectorAll('script');
  scripts.forEach((el) => el.remove());

  // Remove all on* attributes from all elements
  const all = doc.querySelectorAll('*');
  all.forEach((el) => {
    const attrs = Array.from(el.attributes);
    attrs.forEach((attr) => {
      if (/^on/i.test(attr.name)) el.removeAttribute(attr.name);
    });
  });

  // Include both head and body so <link>/<style> in head are preserved
  const headHtml = doc.head ? doc.head.innerHTML : '';
  const bodyHtml = doc.body ? doc.body.innerHTML : '';
  return headHtml + bodyHtml;
}

/**
 * @param {ShadowRoot} shadowRoot
 */
function applyBaseCss(shadowRoot) {
  const style = document.createElement('style');
  style.textContent = BASE_RESET_CSS;
  style.setAttribute('data-editor-base-style', 'true');
  shadowRoot.appendChild(style);
}

/**
 * @param {ShadowRoot} shadowRoot
 * @param {string} html - already stripped
 * @param {{ makeContentEditable?: boolean }} options
 * @returns {HTMLDivElement}
 */
function mountHtml(shadowRoot, html, options = {}) {
  const div = document.createElement('div');
  div.className = CONTENT_CLASS;
  div.style.wordBreak = 'break-word';
  div.style.overflowWrap = 'break-word';
  if (options.makeContentEditable) {
    div.contentEditable = 'true';
  } else {
    div.contentEditable = 'false';
  }
  div.innerHTML = html;
  shadowRoot.appendChild(div);
  return div;
}

/**
 * @param {ShadowRoot} shadowRoot
 * @param {string} headMarkup - already stripped
 * @param {HTMLElement} beforeEl - insert bucket before this (e.g. content div)
 */
function injectHeadMarkup(shadowRoot, headMarkup, beforeEl) {
  let bucket = shadowRoot.querySelector(`[${HEAD_BUCKET_DATA_ATTR}]`);
  if (!bucket) {
    bucket = document.createElement('div');
    bucket.setAttribute(HEAD_BUCKET_DATA_ATTR, 'true');
    bucket.style.display = 'none';
    shadowRoot.insertBefore(bucket, beforeEl);
  }
  bucket.innerHTML = '';
  if (!headMarkup || !headMarkup.trim()) return;
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${headMarkup}</div>`, 'text/html');
  const container = doc.body.firstChild;
  if (!container) return;
  const children = Array.from(container.children);
  children.forEach((node) => {
    if (node.nodeType === 1 && (node.tagName === 'STYLE' || node.tagName === 'LINK')) {
      bucket.appendChild(node.cloneNode(true));
    }
  });
}

/**
 * Parse markup (link/style tags) and inject before content div. Strips scripts and on* from markup first.
 * Handles <head data-custom-css-head> wrapper from getCustomCssTagsForShadowDom by extracting its children.
 * @param {ShadowRoot} shadowRoot
 * @param {string} markup - raw from DB/cache
 * @param {HTMLDivElement} beforeEl
 */
function injectCustomCssMarkup(shadowRoot, markup, beforeEl) {
  const cleaned = stripActiveContent(markup);
  if (!cleaned.trim()) return;
  const parser = new DOMParser();
  const hasHeadWrapper = markup.includes('<head');
  const doc = parser.parseFromString(
    hasHeadWrapper ? `<!DOCTYPE html><html>${markup}</html>` : `<div>${cleaned}</div>`,
    'text/html'
  );
  const container = hasHeadWrapper ? doc.head : doc.body.firstChild;
  if (!container) return;
  const marker = document.createElement('span');
  marker.setAttribute(CUSTOM_CSS_MARKER_ATTR, 'true');
  marker.setAttribute('aria-hidden', 'true');
  marker.style.display = 'none';
  shadowRoot.insertBefore(marker, beforeEl);
  const children = Array.from(container.children || container.childNodes);
  children.forEach((node) => {
    const tag = node.nodeType === 1 ? node.tagName : '';
    if (tag === 'LINK' || tag === 'STYLE') {
      shadowRoot.insertBefore(node.cloneNode(true), beforeEl);
    }
  });
}

/**
 * Remove custom CSS nodes (marker + link/style) from shadow root.
 * @param {ShadowRoot} shadowRoot
 */
function removeCustomCss(shadowRoot) {
  const marker = shadowRoot.querySelector(`[${CUSTOM_CSS_MARKER_ATTR}="true"]`);
  if (!marker) return;
  const contentEl = shadowRoot.querySelector(`.${CONTENT_CLASS}`);
  const children = Array.from(shadowRoot.childNodes);
  for (const node of children) {
    if (node === contentEl) break;
    if (node === marker) {
      node.remove();
      continue;
    }
    if (node instanceof Element) {
      if ((node.tagName === 'STYLE' && !node.hasAttribute('data-editor-base-style')) || (node.tagName === 'LINK' && node.getAttribute('rel') === 'stylesheet')) {
        node.remove();
      }
    }
  }
}

/**
 * @param {ShadowRoot} shadowRoot
 * @param {boolean} makeContentEditable - if true, only the single content container is editable; all other contenteditable are forced false
 * @returns {() => void} cleanup
 */
function attachInteractionBlockers(shadowRoot, makeContentEditable) {
  const contentEl = shadowRoot.querySelector(`.${CONTENT_CLASS}`);

  const blockClick = (e) => {
    const target = e.target;
    if (target.closest('a')) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const blockKeydown = (e) => {
    const target = e.target;
    if (e.key === 'Enter' && target.closest('a')) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const blockSubmit = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const disableForms = () => {
    const selectors = 'input, textarea, select, button, fieldset';
    shadowRoot.querySelectorAll(selectors).forEach((el) => {
      el.setAttribute('disabled', 'true');
    });
  };

  const forceContentEditableFalse = () => {
    shadowRoot.querySelectorAll('[contenteditable]').forEach((el) => {
      if (el === contentEl && makeContentEditable) return;
      el.removeAttribute('contenteditable');
      el.setAttribute('contenteditable', 'false');
    });
  };

  shadowRoot.addEventListener('click', blockClick, { capture: true });
  shadowRoot.addEventListener('keydown', blockKeydown, { capture: true });
  shadowRoot.addEventListener('submit', blockSubmit, { capture: true });

  disableForms();
  forceContentEditableFalse();

  // Observe for dynamically added form elements or contenteditable
  const observer = new MutationObserver(() => {
    disableForms();
    forceContentEditableFalse();
  });
  observer.observe(shadowRoot, { childList: true, subtree: true });

  return () => {
    shadowRoot.removeEventListener('click', blockClick, { capture: true });
    shadowRoot.removeEventListener('keydown', blockKeydown, { capture: true });
    shadowRoot.removeEventListener('submit', blockSubmit, { capture: true });
    observer.disconnect();
  };
}

/**
 * @param {HTMLElement} hostElement
 * @param {{ view: 'editor'|'draftPreview'|'quickActionPreview'|'templateViewer' }} options
 * @returns {{ mount: (input: RenderInput) => Promise<void>, update: (input: RenderInput) => Promise<void>, destroy: () => void, getContentElement: () => HTMLDivElement|null }}
 * @typedef {{ html?: string, loadCustomCss?: boolean, customCssDbKey?: string, makeContentEditable?: boolean, headMarkup?: string }} RenderInput
 */
export function createShadowRenderer(hostElement, options = {}) {
  if (!hostElement || !hostElement.attachShadow) {
    throw new Error('shadowRenderer: hostElement must support attachShadow');
  }

  let shadowRoot = null;
  let contentElement = null;
  let cleanupBlockers = null;
  let customCssCache = null;

  const ensureShadow = () => {
    if (hostElement.shadowRoot) {
      shadowRoot = hostElement.shadowRoot;
      contentElement = shadowRoot.querySelector(`.${CONTENT_CLASS}`);
      return shadowRoot;
    }
    shadowRoot = hostElement.attachShadow({ mode: 'open' });
    applyBaseCss(shadowRoot);
    return shadowRoot;
  };

  /**
   * @param {RenderInput} input
   */
  async function mount(input) {
    const {
      html = '',
      loadCustomCss = false,
      customCssDbKey,
      makeContentEditable = false,
      headMarkup,
    } = input;

    ensureShadow();
    if (!shadowRoot) return;

    const safeHtml = stripActiveContent(html);

    // Content container first so we have a beforeEl for head/custom CSS
    contentElement = shadowRoot.querySelector(`.${CONTENT_CLASS}`);
    if (!contentElement) {
      contentElement = mountHtml(shadowRoot, safeHtml, { makeContentEditable });
    } else {
      contentElement.innerHTML = safeHtml;
      contentElement.contentEditable = makeContentEditable ? 'true' : 'false';
    }

    // Head bucket (headMarkup) before content
    if (headMarkup != null) {
      injectHeadMarkup(shadowRoot, stripActiveContent(headMarkup), contentElement);
    }

    // Custom CSS from DB (with cache)
    if (loadCustomCss) {
      if (!customCssCache) customCssCache = (await import('./customCssClient.js')).createCustomCssCache();
      const markup = await customCssCache.get(customCssDbKey);
      injectCustomCssMarkup(shadowRoot, markup, contentElement);
    } else {
      removeCustomCss(shadowRoot);
    }

    if (cleanupBlockers) cleanupBlockers();
    cleanupBlockers = attachInteractionBlockers(shadowRoot, makeContentEditable);
  }

  /**
   * @param {RenderInput} input
   */
  async function update(input) {
    const {
      html,
      loadCustomCss = false,
      customCssDbKey,
      makeContentEditable,
      headMarkup,
    } = input;

    if (!shadowRoot) {
      await mount(input);
      return;
    }

    contentElement = shadowRoot.querySelector(`.${CONTENT_CLASS}`);
    if (!contentElement) {
      await mount(input);
      return;
    }

    if (html !== undefined) {
      contentElement.innerHTML = stripActiveContent(html);
    }
    if (makeContentEditable !== undefined) {
      contentElement.contentEditable = makeContentEditable ? 'true' : 'false';
    }

    if (headMarkup !== undefined) {
      injectHeadMarkup(shadowRoot, stripActiveContent(headMarkup), contentElement);
    }

    if (loadCustomCss) {
      if (!customCssCache) customCssCache = (await import('./customCssClient.js')).createCustomCssCache();
      const markup = await customCssCache.get(customCssDbKey);
      removeCustomCss(shadowRoot);
      contentElement = shadowRoot.querySelector(`.${CONTENT_CLASS}`);
      injectCustomCssMarkup(shadowRoot, markup, contentElement);
    } else {
      removeCustomCss(shadowRoot);
    }

    if (makeContentEditable !== undefined && cleanupBlockers) {
      cleanupBlockers();
      cleanupBlockers = attachInteractionBlockers(shadowRoot, makeContentEditable);
    }
  }

  function destroy() {
    if (cleanupBlockers) {
      cleanupBlockers();
      cleanupBlockers = null;
    }
    if (customCssCache) customCssCache.clear();
    shadowRoot = null;
    contentElement = null;
  }

  function getContentElement() {
    return contentElement || (shadowRoot && shadowRoot.querySelector(`.${CONTENT_CLASS}`)) || null;
  }

  return { mount, update, destroy, getContentElement };
}

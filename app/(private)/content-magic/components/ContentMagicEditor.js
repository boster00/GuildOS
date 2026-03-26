"use client";
import React, { useRef, useState, useEffect, forwardRef, useImperativeHandle } from "react";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  Undo2,
  Redo2,
  Type,
  Table,
  Trash2,
  Image as ImageIcon,
  Palette,
} from "lucide-react";
import { toast } from "react-hot-toast";
import "@/app/(private)/content-magic/editor.css";
import { useWritingGuide } from "@/libs/content-magic/context/WritingGuideContext";
import ImageGenerationModal from "./ImageGenerationModal";
import ImageInsertModal from "./ImageInsertModal";
import { convertImageReferencesToUrls } from "@/libs/content-magic/utils/convertImageReferences";
import { parseDraftStylesAndBody, serializeDraftStylesAndBody } from "@/libs/content-magic/utils/draftStylesPayload";
import { initMonkey } from "@/libs/monkey";
import MediaWidthButton from "./MediaWidthButton";

/** Base styles for .editorContent inside shadow root (mirrors editor.css) */

// const EDITOR_CONTENT_STYLES = `
// .editorContent {
//   font-family: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
//   padding: 1.5rem;
//   min-height: 6rem;
//   line-height: 1.7;
//   color: oklch(0.15 0 0);
//   background: oklch(1 0 0);
// }
// .editorContent :where(em), .editorContent :where(i) { font-style: italic; }
// .editorContent :where(u) { text-decoration: underline; }
// .editorContent :where(s), .editorContent :where(del) { text-decoration: line-through; }
// .editorContent :where(a) { text-decoration: underline; cursor: pointer; }
// .editorContent :where(ul), .editorContent :where(ol) { list-style-position: inside; }
// .editorContent :where(ul) { list-style-type: disc; }
// .editorContent :where(ol) { list-style-type: decimal; }
// .editorContent :where(table) { border-collapse: collapse; width: 100%; }
// .editorContent :where(table td), .editorContent :where(table th) { text-align: left; }
// `;

const ContentMagicEditor = forwardRef(function ContentMagicEditor(
  { onChange, rootNode, customCssEnabled: customCssEnabledProp, onCustomCssChange },
  ref
) {
  const { article, selectedElements, setSelectedElements } = useWritingGuide(); // Get from context
  const initialHtml = article.content_html;
  const editorRef = useRef(null);
  const lastExternalContentRef = useRef(initialHtml); // Track last known external content
  const isUpdatingFromExternalRef = useRef(false); // Flag to prevent loops
  const [history, setHistory] = useState([initialHtml]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [blockType, setBlockType] = useState("p");
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [isStrikethrough, setIsStrikethrough] = useState(false);
  const [isList, setIsList] = useState(false);
  const [isOrderedList, setIsOrderedList] = useState(false);
  const [isLink, setIsLink] = useState(false);
  const [isImageSelected, setIsImageSelected] = useState(false);
  const [firstSelectedElement, setFirstSelectedElement] = useState(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [showImageInsertModal, setShowImageInsertModal] = useState(false);
  const [selectedImageElement, setSelectedImageElement] = useState(null);
  const [internalCustomCssEnabled, setInternalCustomCssEnabled] = useState(false);
  const customCssEnabled = typeof onCustomCssChange === "function" ? (customCssEnabledProp ?? false) : internalCustomCssEnabled;
  const setCustomCssEnabled = typeof onCustomCssChange === "function" ? onCustomCssChange : setInternalCustomCssEnabled;
  const shadowHostRef = useRef(null);
  const [shadowHostReady, setShadowHostReady] = useState(false);
  const shadowInjectionRunIdRef = useRef(0);
  const draftStylesRawRef = useRef(null);
  const handleEditorChangeRef = useRef(null);
  const updateToolbarStateRef = useRef(null);
  const onChangeRef = useRef(null);
  const onCustomCssChangeRef = useRef(null);
  const customCssEnabledRef = useRef(false);
  useEffect(() => {
    handleEditorChangeRef.current = handleEditorChange;
    updateToolbarStateRef.current = updateToolbarState;
    onChangeRef.current = onChange;
    onCustomCssChangeRef.current = onCustomCssChange;
    customCssEnabledRef.current = customCssEnabled;
  });

  // Content-only HTML for save/copy: draft styles (in current status: commented when custom CSS on) + .editorContent body.
  const getContentOnlyHtml = () => {
    const shadowRoot = shadowHostRef.current?.shadowRoot;
    if (shadowRoot) {
      const contentWrapper = shadowRoot.querySelector(".editorContent");
      const bodyHtml = contentWrapper ? contentWrapper.innerHTML || "" : "";
      const raw = draftStylesRawRef.current;
      if (raw != null && raw.trim()) {
        return serializeDraftStylesAndBody({
          draftStylesRaw: raw,
          bodyHtml,
          commentDraftStyles: customCssEnabledRef.current,
        });
      }
      return bodyHtml;
    }
    return editorRef.current?.innerHTML || "";
  };

  // Expose editor API to parent/consumers (e.g. Quick Actions)
  useImperativeHandle(ref, () => ({
    /** Returns article content only. In custom CSS (shadow) mode: .editorContent innerHTML only (no injected link/style/base). Otherwise: contenteditable innerHTML. */
    getHtml: () => getContentOnlyHtml(),

    // External set without touching history/undo stack (used for outline adoption and similar flows).
    setHtml: (html) => {
      if (!editorRef.current) return;

      isUpdatingFromExternalRef.current = true;
      const { draftStylesRaw, bodyHtml } = parseDraftStylesAndBody(html);
      draftStylesRawRef.current = draftStylesRaw;

      const shadowRoot = shadowHostRef.current?.shadowRoot;
      if (shadowRoot) {
        const editorEl = shadowRoot.querySelector(".editorContent");
        const draftStyleEl = shadowRoot.querySelector('style[data-draft-styles="true"]');
        const comment = customCssEnabledRef.current;
        if (draftStylesRaw != null && draftStylesRaw.trim()) {
          const styleContent = comment ? `/*\n${draftStylesRaw}\n*/` : draftStylesRaw;
          if (draftStyleEl) {
            draftStyleEl.textContent = styleContent;
          } else {
            const style = document.createElement("style");
            style.setAttribute("data-draft-styles", "true");
            style.textContent = styleContent;
            const wrapper = shadowRoot.querySelector(".editor-media-width-wrapper");
            shadowRoot.insertBefore(style, wrapper);
          }
          if (editorEl) editorEl.innerHTML = bodyHtml;
        } else {
          if (draftStyleEl) draftStyleEl.remove();
          if (editorEl) editorEl.innerHTML = html;
        }
        lastExternalContentRef.current = getContentOnlyHtml();
      } else {
        editorRef.current.innerHTML = html;
        lastExternalContentRef.current = html;
      }

      setTimeout(() => {
        try {
          convertImageReferencesToUrls(editorRef.current);
        } catch (err) {

        } finally {
          isUpdatingFromExternalRef.current = false;
        }
      }, 100);
    },

    /**
     * Apply an external change AND record it in the editor's history.
     * - If `html` is provided, replaces the editor DOM with that HTML first.
     * - Always pushes a new history entry based on current DOM and notifies parent `onChange`
     *   (mirrors what an input event does).
     *
     * Quick Actions should prefer this over dispatching synthetic DOM events.
     */
    applyExternalHtmlChange: (html) => {
      if (!editorRef.current) return;

      // Optional: replace DOM first
      if (typeof html === "string") {
        isUpdatingFromExternalRef.current = true;
        editorRef.current.innerHTML = html;
        lastExternalContentRef.current = html;

        setTimeout(() => {
          try {
            convertImageReferencesToUrls(editorRef.current);
          } catch (err) {

          } finally {
            isUpdatingFromExternalRef.current = false;
          }
        }, 100);
      }

      // Mirror a user edit: update history + toolbar + parent onChange
      notifyEditorChange();
    },

    /**
     * Convenience helper for consumers that directly mutate the editor DOM.
     * Reads current DOM, pushes a history entry, updates toolbar, and notifies parent onChange.
     */
    snapshotHistoryFromDom: () => {
      notifyEditorChange();
    },
    /** Turn custom CSS mode on (same as toolbar "Enable Custom CSS"). Content already lives inside the shadow root. */
    prepareAndEnableCustomCss: () => {
      if (onCustomCssChangeRef.current) {
        onCustomCssChangeRef.current(true);
      }
    },
    getEditorNode: () => editorRef.current,
    getFirstSelectedElement: () => firstSelectedElement,
    getSelectedElements: () => selectedElements,
  }), [firstSelectedElement, selectedElements]);

  // Update editor when article.content_html changes (e.g., from generate outline)
  useEffect(() => {
    if (editorRef.current && article.content_html) {
      const newHtml = article.content_html || "";
      const lastExternal = lastExternalContentRef.current || "";
      
      // Only update if:
      // 1. The new content is different from the last known external content (actual external change)
      // 2. We're not currently updating from external source (prevent loops)
      // 3. The editor doesn't have focus (user isn't actively editing/selecting)
      const isEditorFocused = document.activeElement === editorRef.current;
      const isExternalChange = newHtml !== lastExternal;
      
      // Also check if there's a significant difference (more than just whitespace normalization)
      const normalizedNew = newHtml.replace(/\s+/g, ' ').trim();
      const normalizedLast = lastExternal.replace(/\s+/g, ' ').trim();
      const isSignificantChange = normalizedNew !== normalizedLast;
      
      if (isExternalChange && isSignificantChange && !isUpdatingFromExternalRef.current && !isEditorFocused) {
        isUpdatingFromExternalRef.current = true;
        try {
          const host = shadowHostRef.current;
          const shadow = host?.shadowRoot;
          const { draftStylesRaw, bodyHtml } = parseDraftStylesAndBody(newHtml);
          if (shadow) {
            draftStylesRawRef.current = draftStylesRaw;
            const editorEl = shadow.querySelector(".editorContent");
            const draftStyleEl = shadow.querySelector('style[data-draft-styles="true"]');
            const comment = customCssEnabledRef.current;
            if (draftStylesRaw != null && draftStylesRaw.trim()) {
              const styleContent = comment ? `/*\n${draftStylesRaw}\n*/` : draftStylesRaw;
              if (draftStyleEl) {
                draftStyleEl.textContent = styleContent;
              } else {
                const style = document.createElement("style");
                style.setAttribute("data-draft-styles", "true");
                style.textContent = styleContent;
                const wrapper = shadow.querySelector(".editor-media-width-wrapper");
                shadow.insertBefore(style, wrapper);
              }
              if (editorEl) editorEl.innerHTML = bodyHtml;
            } else {
              if (draftStyleEl) draftStyleEl.remove();
              if (editorEl) editorEl.innerHTML = newHtml;
            }
          } else {
            editorRef.current.innerHTML = newHtml;
          }
          lastExternalContentRef.current = newHtml;

          setTimeout(() => {
            try {
              convertImageReferencesToUrls(editorRef.current);
            } catch (convertErr) {

            }
            isUpdatingFromExternalRef.current = false;
          }, 100);

        } catch (innerErr) {
          const msg = innerErr?.message ?? String(innerErr);
          isUpdatingFromExternalRef.current = false;
        }
      }
    }
  }, [article.content_html]);

  // Create shadow root and base editor when host is ready (ensures ref is set after client-side nav)
  useEffect(() => {
    if (!shadowHostReady) {
      
      return;
    }
    const host = shadowHostRef.current;
    
    if (!host) {

      return;
    }
    if (host.shadowRoot) {

      return;
    }

    const hasStored = article?.content_html && String(article.content_html).trim().length > 0;
    const initialHtml = article?.content_html || "<p>Start typing...</p>";
    if (!hasStored) {
      
    } else {

    }

    const shadow = host.attachShadow({ mode: "open" });
    // const baseStyle = document.createElement("style");
    // baseStyle.textContent = EDITOR_CONTENT_STYLES;
    // baseStyle.setAttribute("data-editor-base-style", "true");
    // shadow.appendChild(baseStyle);

    const wrapper = document.createElement("div");
    wrapper.className = "editor-media-width-wrapper";

    const { draftStylesRaw, bodyHtml } = parseDraftStylesAndBody(initialHtml);
    draftStylesRawRef.current = draftStylesRaw;
    if (draftStylesRaw != null && draftStylesRaw.trim()) {
      const draftStyleEl = document.createElement("style");
      draftStyleEl.setAttribute("data-draft-styles", "true");
      draftStyleEl.textContent = customCssEnabledRef.current ? `/*\n${draftStylesRaw}\n*/` : draftStylesRaw;
      shadow.appendChild(draftStyleEl);
    }
    const editorEl = document.createElement("div");
    editorEl.contentEditable = "true";
    editorEl.className = "editorContent flex-1 p-4 outline-none text-base leading-relaxed min-h-96 focus:ring-2 focus:ring-blue-300";
    editorEl.setAttribute("data-reactroot", "");
    editorEl.style.wordBreak = "break-word";
    editorEl.style.overflowWrap = "break-word";
    editorEl.style.position = "relative";
    editorEl.innerHTML = draftStylesRaw != null && draftStylesRaw.trim() ? bodyHtml : initialHtml;
    wrapper.appendChild(editorEl);
    shadow.appendChild(wrapper);

    editorRef.current = editorEl;
    lastExternalContentRef.current = initialHtml;

    const onInput = () => {
      handleEditorChangeRef.current?.();
      if (onChangeRef.current) {
        try {
          onChangeRef.current(new Event("input"));
        } catch (_) {}
      }
    };
    const onToolbar = () => updateToolbarStateRef.current?.();
    const onMouseDown = (e) => {
      const target = e.target;
      const editorNode = editorRef.current;
      
      if (!editorNode || !editorNode.contains(target)) return;
      if (target.closest(".quick-actions-btn") || target.closest(".quick-actions-dropdown")) return;
      if (target.tagName === "IMG") {
        const sel = window.getSelection();
        const range = document.createRange();
        range.selectNode(target);
        sel.removeAllRanges();
        sel.addRange(range);
        setSelectedImageElement(target);
        setIsImageSelected(true);
        return;
      }
      const blockElements = ["SECTION", "DIV", "ARTICLE", "ASIDE", "HEADER", "FOOTER", "MAIN", "NAV"];
      if (blockElements.includes(target.tagName)) {
        const previouslySelected = editorNode.querySelectorAll(".selected, .is-selected");
        previouslySelected.forEach((el) => el.classList.remove("selected", "is-selected"));
        target.classList.add("selected");
        if (setSelectedElements) {
          
          setSelectedElements([{ element: target, html: target.outerHTML || target.innerHTML }]);
        }
        e.preventDefault();
        return;
      }
      let elementToSelect = target.parentElement;
      while (elementToSelect && elementToSelect !== editorNode) {
        if (blockElements.includes(elementToSelect.tagName)) {
          const blockElement = elementToSelect;
          const mouseUpHandler = () => {
            setTimeout(() => {
              const selection = window.getSelection();
              const isTextSelection = selection.rangeCount > 0 && !selection.isCollapsed;
              if (!isTextSelection && blockElement && editorNode.contains(blockElement)) {
                const previouslySelected = editorNode.querySelectorAll(".selected, .is-selected");
                previouslySelected.forEach((el) => el.classList.remove("selected", "is-selected"));
                blockElement.classList.add("selected");
                if (setSelectedElements) {
                  
                  setSelectedElements([{ element: blockElement, html: blockElement.outerHTML || blockElement.innerHTML }]);
                }
              }
            }, 50);
          };
          editorNode.addEventListener("mouseup", mouseUpHandler, { once: true });
          break;
        }
        elementToSelect = elementToSelect.parentElement;
      }
    };

    editorEl.addEventListener("input", onInput);
    editorEl.addEventListener("mouseup", onToolbar);
    editorEl.addEventListener("keyup", onToolbar);
    editorEl.addEventListener("click", onToolbar);
    editorEl.addEventListener("blur", onToolbar);
    editorEl.addEventListener("focus", onToolbar);
    editorEl.addEventListener("mousedown", onMouseDown);

    setTimeout(() => convertImageReferencesToUrls(editorEl), 100);

    return () => {
      
      if (editorEl) {
        editorEl.removeEventListener("input", onInput);
        editorEl.removeEventListener("mouseup", onToolbar);
        editorEl.removeEventListener("keyup", onToolbar);
        editorEl.removeEventListener("click", onToolbar);
        editorEl.removeEventListener("blur", onToolbar);
        editorEl.removeEventListener("focus", onToolbar);
        editorEl.removeEventListener("mousedown", onMouseDown);
      }
      if (editorRef.current === editorEl) {
        editorRef.current = null;
      }
    };
  }, [shadowHostReady]);

  // Media width: apply wrapper width + scale when host is narrower than media width; keep in sync via ResizeObserver and MutationObserver.
  useEffect(() => {
    const host = shadowHostRef.current;
    if (!host || !host.shadowRoot) return;
    const shadow = host.shadowRoot;
    const wrapper = shadow.querySelector(".editor-media-width-wrapper");
    if (!wrapper) return;

    const updateWrapperScale = () => {
      const mediaWidth = host.getAttribute("data-media-width");
      const px = mediaWidth ? parseInt(mediaWidth, 10) : null;
      if (px == null || !Number.isFinite(px)) {
        wrapper.style.width = "";
        wrapper.style.transform = "";
        wrapper.style.transformOrigin = "";
        return;
      }
      wrapper.style.width = px + "px";
      wrapper.style.transformOrigin = "top left";
      const hostWidth = host.clientWidth || px;
      const scale = Math.min(1, hostWidth / px);
      wrapper.style.transform = scale < 1 ? `scale(${scale})` : "";
    };

    updateWrapperScale();

    const resizeObserver = new ResizeObserver(updateWrapperScale);
    resizeObserver.observe(host);

    const mutationObserver = new MutationObserver((mutations) => {
      if (mutations.some((m) => m.type === "attributes" && m.attributeName === "data-media-width")) {
        updateWrapperScale();
      }
    });
    mutationObserver.observe(host, { attributes: true, attributeFilter: ["data-media-width"] });

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      wrapper.style.width = "";
      wrapper.style.transform = "";
      wrapper.style.transformOrigin = "";
    };
  }, [shadowHostReady]);

  // When custom CSS is ON, inject user CSS into the existing shadow root; when OFF, remove injected CSS (base styles remain).
  // Match ShowTemplates: inject custom CSS (link/style) before content div using async flow and runId + host.isConnected guards.
  useEffect(() => {

    const host = shadowHostRef.current;
    if (!host || !host.shadowRoot) {
      if (!host) {

      } else {

      }
      return;
    }

    const shadow = host.shadowRoot;
    const editorEl = shadow.querySelector(".editorContent");
    if (!editorEl) {

      return;
    }

    shadowInjectionRunIdRef.current += 1;
    const thisRunId = shadowInjectionRunIdRef.current;

    const draftStyleEl = shadow.querySelector('style[data-draft-styles="true"]');
    const raw = draftStylesRawRef.current;
    if (draftStyleEl && raw != null && raw.trim()) {
      // When custom CSS on: comment out draft (profile only). When off: clear so only rewritten draft from applyCustomCssToShadowDom shows.
      draftStyleEl.textContent = customCssEnabled ? `/*\n${raw}\n*/` : '';
    }

    (async () => {
      try {
        if (thisRunId !== shadowInjectionRunIdRef.current) return;
        if (!host.isConnected) return;
        const monkey = await initMonkey(true);
        if (thisRunId !== shadowInjectionRunIdRef.current || !host.isConnected) return;
        if (customCssEnabled) {
          await monkey.applyCustomCssToShadowDom(shadow, editorEl);
        } else {
          await monkey.applyCustomCssToShadowDom(shadow, editorEl, { draftCss: raw ?? '', applyProfileCss: false });
        }
      } catch (err) {

      }
    })();
  }, [customCssEnabled]);

  // Legacy change button code removed - now handled by ContentMagicAIAssistant component

  // Track selected elements and show Quick Actions button
  useEffect(() => {
    if (!editorRef.current || !selectedElements || selectedElements.length === 0) {
      setFirstSelectedElement(null);
      return;
    }

    // Get the actual editor DOM node
    const editorElement = editorRef.current.getEditorNode 
      ? editorRef.current.getEditorNode() 
      : editorRef.current;

    if (!editorElement) {
      setFirstSelectedElement(null);
      return;
    }

    // Check if there are any change wrappers (AI response pending) or accept/keep buttons
    const hasChangeWrappers = editorElement.querySelector('.change-wrapper') !== null;
    const hasActionButtons = editorElement.querySelector('.change-action-btn') !== null ||
                             editorElement.querySelector('.change-from, .change-to') !== null;
    if (hasChangeWrappers || hasActionButtons) {
      setFirstSelectedElement(null);
      return;
    }

    // Find the first selected element in the DOM
    const firstElement = selectedElements[0];
    if (!firstElement || !firstElement.element) {
      setFirstSelectedElement(null);
      return;
    }

    const domElement = firstElement.element;
    
    // Check if element is still in the editor
    if (!editorElement.contains(domElement)) {
      setFirstSelectedElement(null);
      return;
    }

    // Check if element has selected class (added by AI Assistant) or is-selected class
    // The AI Assistant adds 'selected' class, but we also check for 'is-selected' for compatibility
    const hasSelectedClass = domElement.classList.contains('selected') || 
                             domElement.classList.contains('is-selected') ||
                             domElement.querySelector('.selected') !== null ||
                             domElement.querySelector('.is-selected') !== null;
    
    if (!hasSelectedClass) {
      setFirstSelectedElement(null);
      return;
    }

    setFirstSelectedElement(domElement);
  }, [selectedElements]);

  // Update history on editor change (full payload: draft styles in current status + body)
  const handleEditorChange = () => {
    if (editorRef.current) {
      const newHtml = getContentOnlyHtml();
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(newHtml);
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
      updateToolbarState();
    }
  };

  /**
   * Central helper to mirror a real user edit:
   * - Updates history (via handleEditorChangeRef)
   * - Updates toolbar state
   * - Notifies parent `onChange` for autosave, using an input-like event
   *
   * Used by:
   * - Native input events (light DOM & shadow DOM)
   * - External callers via `applyExternalHtmlChange` / `snapshotHistoryFromDom`
   */
  const notifyEditorChange = (originalEvent) => {
    // History + toolbar via the latest handleEditorChange
    handleEditorChangeRef.current?.();

    // Notify parent onChange (autosave / external listeners)
    const changeHandler = onChangeRef.current;
    if (changeHandler) {
      try {
        const eventToSend =
          originalEvent instanceof Event ? originalEvent : new Event("input");
        changeHandler(eventToSend);
      } catch (err) {

      }
    }
  };

  // Check if all nodes in selection have a specific inline style
  const isStyleAppliedToSelection = (style) => {
    const selection = window.getSelection();
    if (!selection.rangeCount || selection.isCollapsed) return false;

    const range = selection.getRangeAt(0);
    const contents = range.cloneContents();
    const walker = document.createTreeWalker(
      contents,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );

    let node;
    let allHaveStyle = true;
    let hasContent = false;

    while ((node = walker.nextNode())) {
      if (node.textContent.trim().length > 0) {
        hasContent = true;
        let parent = node.parentNode;
        let hasStyleTag = false;

        // Check if text node is wrapped in the style tag
        while (parent && parent !== contents) {
          const tag = parent.tagName?.toLowerCase();
          if (tag === style) {
            hasStyleTag = true;
            break;
          }
          parent = parent.parentNode;
        }

        if (!hasStyleTag) {
          allHaveStyle = false;
          break;
        }
      }
    }

    return hasContent && allHaveStyle;
  };

  // Check if all nodes in selection are in a list
  const isListStyleAppliedToSelection = (listType) => {
    const selection = window.getSelection();
    if (!selection.rangeCount) return false;

    const range = selection.getRangeAt(0);
    let node = range.commonAncestorContainer;
    const targetTag = listType === "ul" ? "UL" : "OL";

    while (node && node !== editorRef.current) {
      if (node.nodeType === 1 && node.tagName === targetTag) {
        return true;
      }
      node = node.parentNode;
    }

    return false;
  };

  // Get block type of focused element
  const getBlockTypeAtCursor = () => {
    const selection = window.getSelection();
    if (!selection.rangeCount) return "p";

    const range = selection.getRangeAt(0);
    let node = range.commonAncestorContainer;

    while (node && node !== editorRef.current) {
      if (node.nodeType === 1) {
        const tag = node.tagName.toLowerCase();
        if (["h1", "h2", "h3", "h4", "h5", "h6", "p", "li", "blockquote"].includes(tag)) {
          return tag === "li" ? "p" : tag;
        }
      }
      node = node.parentNode;
    }

    return "p";
  };

  // Update toolbar state based on current selection
  const updateToolbarState = () => {
    const selection = window.getSelection();
    
    // Check if an image is selected first
    let imageSelected = false;
    let selectedImg = null;
    
    // First check if we have a selectedImageElement that's still valid
    if (selectedImageElement && editorRef.current?.contains(selectedImageElement)) {
      // Check if this element is in the current selection
      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        try {
          // Check if the selected image element is within or is the selection
          if (range.intersectsNode && range.intersectsNode(selectedImageElement)) {
            imageSelected = true;
            selectedImg = selectedImageElement;
          } else if (range.commonAncestorContainer === selectedImageElement || 
                     selectedImageElement.contains(range.commonAncestorContainer) ||
                     (range.commonAncestorContainer.nodeType === 1 && range.commonAncestorContainer === selectedImageElement)) {
            imageSelected = true;
            selectedImg = selectedImageElement;
          }
        } catch (e) {
          // Fallback: if selectedImageElement exists and is in editor, assume it's selected
          imageSelected = true;
          selectedImg = selectedImageElement;
        }
      } else {
        // No selection but we have a selectedImageElement - keep it selected
        imageSelected = true;
        selectedImg = selectedImageElement;
      }
    }
    
    // If not found above, check the selection for an image
    if (!imageSelected && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const selectedNode = selection.anchorNode;
      
      // Check if the selection node or its parent is an image
      if (selectedNode) {
        let node = selectedNode.nodeType === 3 ? selectedNode.parentNode : selectedNode;
        while (node && node !== editorRef.current) {
          if (node.tagName === 'IMG') {
            imageSelected = true;
            selectedImg = node;
            break;
          }
          node = node.parentNode;
        }
      }
      
      // Also check if the range contains an image
      if (!imageSelected) {
        try {
          if (range.commonAncestorContainer) {
            const container = range.commonAncestorContainer;
            const containerElement = container.nodeType === 1 ? container : container.parentElement;
            if (containerElement && containerElement.tagName === 'IMG') {
              imageSelected = true;
              selectedImg = containerElement;
            }
          }
        } catch (e) {
          // Range.intersectsNode might not be available in all browsers
        }
      }
    }
    
    setIsImageSelected(imageSelected);
    if (imageSelected && selectedImg) {
      setSelectedImageElement(selectedImg);
    } else if (!imageSelected) {
      // Clear selection only if we definitely don't have an image selected
      setSelectedImageElement(null);
    }

    if (!selection.rangeCount) {
      setBlockType("p");
      // Don't clear image selection if there's no selection - might be a programmatic selection
      return;
    }

    // Determine block type from cursor position
    const blockType = getBlockTypeAtCursor();
    setBlockType(blockType);

    // Check if selection exists (not collapsed)
    const isSelectionActive = !selection.isCollapsed;

    if (isSelectionActive) {
      // Selection-based checks
      setIsBold(isStyleAppliedToSelection("strong") || document.queryCommandState("bold"));
      setIsItalic(isStyleAppliedToSelection("em") || document.queryCommandState("italic"));
      setIsUnderline(isStyleAppliedToSelection("u") || document.queryCommandState("underline"));
      setIsStrikethrough(
        isStyleAppliedToSelection("s") || isStyleAppliedToSelection("del") || document.queryCommandState("strikethrough")
      );
      setIsLink(!!document.queryCommandValue("createLink"));
    } else {
      // Cursor-based checks (check parent elements)
      const range = selection.getRangeAt(0);
      let node = range.commonAncestorContainer;
      if (node.nodeType === 3) node = node.parentNode;

      let foundBold = false,
        foundItalic = false,
        foundUnderline = false,
        foundStrike = false,
        foundLink = false;

      while (node && node !== editorRef.current) {
        if (node.nodeType === 1) {
          const tag = node.tagName.toLowerCase();
          if (tag === "strong" || tag === "b") foundBold = true;
          if (tag === "em" || tag === "i") foundItalic = true;
          if (tag === "u") foundUnderline = true;
          if (tag === "s" || tag === "del") foundStrike = true;
          if (tag === "a") foundLink = true;
        }
        node = node.parentNode;
      }

      setIsBold(foundBold);
      setIsItalic(foundItalic);
      setIsUnderline(foundUnderline);
      setIsStrikethrough(foundStrike);
      setIsLink(foundLink);
    }

    // Check list state
    const inUL = isListStyleAppliedToSelection("ul");
    const inOL = isListStyleAppliedToSelection("ol");
    setIsList(inUL);
    setIsOrderedList(inOL);
  };

  // Apply formatting with inline styles (no classes)
  const applyFormat = (command, value = null) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    updateToolbarState();
    handleEditorChange();
  };

  // Change block type
  const changeBlockType = (type) => {
    if (type === "ul" || type === "ol") {
      applyFormat(type === "ul" ? "insertUnorderedList" : "insertOrderedList");
    } else {
      applyFormat("formatBlock", `<${type}>`);
    }
    setBlockType(type);
    handleEditorChange();
  };

  // Toggle list type
  const toggleListType = (type) => {
    if (type === "ul") {
      applyFormat("insertUnorderedList");
      setIsList(!isList);
      setIsOrderedList(false);
    } else if (type === "ol") {
      applyFormat("insertOrderedList");
      setIsOrderedList(!isOrderedList);
      setIsList(false);
    }
    handleEditorChange();
  };

  // Apply bold (uses <strong> tag)
  const applyBold = () => {
    document.execCommand("bold", false);
    editorRef.current?.focus();
    updateToolbarState();
    handleEditorChange();
  };

  // Apply italic (uses <em> tag)
  const applyItalic = () => {
    document.execCommand("italic", false);
    editorRef.current?.focus();
    updateToolbarState();
    handleEditorChange();
  };

  // Apply underline (uses <u> tag)
  const applyUnderline = () => {
    document.execCommand("underline", false);
    editorRef.current?.focus();
    updateToolbarState();
    handleEditorChange();
  };

  // Apply strikethrough (uses <s> tag)
  const applyStrikethrough = () => {
    document.execCommand("strikethrough", false);
    editorRef.current?.focus();
    updateToolbarState();
    handleEditorChange();
  };

  // Insert table (simple 2x2 default)
  const insertTable = () => {
    const html = `<table border="1" cellpadding="8" cellspacing="0" style="width: 100%; border-collapse: collapse;">
      <tr><td style="border: 1px solid #ccc; padding: 8px;">Cell 1</td><td style="border: 1px solid #ccc; padding: 8px;">Cell 2</td></tr>
      <tr><td style="border: 1px solid #ccc; padding: 8px;">Cell 3</td><td style="border: 1px solid #ccc; padding: 8px;">Cell 4</td></tr>
    </table><p></p>`;
    document.execCommand("insertHTML", false, html);
    handleEditorChange();
  };

  // Insert link
  const insertLink = () => {
    const url = prompt("Enter URL:");
    if (url) {
      applyFormat("createLink", url);
    }
  };

  // Open image insert modal (edit if image is selected, insert if not)
  const openImageInsertModal = () => {
    if (isImageSelected && selectedImageElement) {
      // Edit existing image
      setShowImageInsertModal(true);
    } else {
      // Insert new image
      setSelectedImageElement(null);
      setShowImageInsertModal(true);
    }
  };

  // Open image generation modal (for backward compatibility)
  const openImageModal = () => {
    setShowImageModal(true);
  };

  // Remove link
  const removeLink = () => {
    applyFormat("unlink");
  };

  // Apply a content payload (from history or setHtml) to shadow or light DOM
  const applyContentHtml = (html) => {
    const { draftStylesRaw, bodyHtml } = parseDraftStylesAndBody(html);
    const shadow = shadowHostRef.current?.shadowRoot;
    if (shadow) {
      draftStylesRawRef.current = draftStylesRaw;
      const editorEl = shadow.querySelector(".editorContent");
      const draftStyleEl = shadow.querySelector('style[data-draft-styles="true"]');
      const comment = customCssEnabledRef.current;
      if (draftStylesRaw != null && draftStylesRaw.trim()) {
        const styleContent = comment ? `/*\n${draftStylesRaw}\n*/` : draftStylesRaw;
        if (draftStyleEl) {
          draftStyleEl.textContent = styleContent;
        } else {
          const style = document.createElement("style");
          style.setAttribute("data-draft-styles", "true");
          style.textContent = styleContent;
          const wrapper = shadow.querySelector(".editor-media-width-wrapper");
          shadow.insertBefore(style, wrapper);
        }
        if (editorEl) editorEl.innerHTML = bodyHtml;
      } else {
        if (draftStyleEl) draftStyleEl.remove();
        if (editorEl) editorEl.innerHTML = html;
      }
    } else if (editorRef.current) {
      editorRef.current.innerHTML = html;
    }
    setTimeout(() => convertImageReferencesToUrls(editorRef.current), 0);
  };

  // Undo
  const undo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      applyContentHtml(history[newIndex]);
      updateToolbarState();
    }
  };

  // Redo
  const redo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      applyContentHtml(history[newIndex]);
      updateToolbarState();
    }
  };

  // Clear inline formatting
  const clearFormatting = () => {
    applyFormat("removeFormat");
  };

  // Get current HTML
  const getHtml = () => {
    return editorRef.current?.innerHTML || "";
  };

  // Handle editor change with keystroke tracking

  return (
    <div className="flex flex-col border rounded-lg bg-white shadow-sm">
      {/* Control Panel */}
      <div className="sticky top-0 z-10 bg-gray-50 border-b p-2 flex flex-wrap gap-1 items-center">
        {/* Block Type Selector */}
        <select
          value={blockType}
          onChange={(e) => changeBlockType(e.target.value)}
          className="px-2 py-1 border rounded text-sm bg-white cursor-pointer hover:bg-gray-100 font-medium"
        >
          <option value="p">Paragraph</option>
          <option value="h1">Heading 1</option>
          <option value="h2">Heading 2</option>
          <option value="h3">Heading 3</option>
          <option value="h4">Heading 4</option>
          <option value="h5">Heading 5</option>
          <option value="h6">Heading 6</option>
        </select>

        {/* Divider */}
        <div className="border-l h-6 mx-1"></div>

        {/* Text Formatting Buttons */}
        <ToolbarButton
          icon={<Bold className="w-4 h-4" />}
          title="Bold"
          active={isBold}
          onClick={applyBold}
        />
        <ToolbarButton
          icon={<Italic className="w-4 h-4" />}
          title="Italic"
          active={isItalic}
          onClick={applyItalic}
        />
        <ToolbarButton
          icon={<Underline className="w-4 h-4" />}
          title="Underline"
          active={isUnderline}
          onClick={applyUnderline}
        />
        <ToolbarButton
          icon={<Strikethrough className="w-4 h-4" />}
          title="Strikethrough"
          active={isStrikethrough}
          onClick={applyStrikethrough}
        />

        {/* Divider */}
        <div className="border-l h-6 mx-1"></div>

        {/* List Buttons */}
        <ToolbarButton
          icon={<List className="w-4 h-4" />}
          title="Unordered List"
          active={isList}
          onClick={() => toggleListType("ul")}
        />
        <ToolbarButton
          icon={<ListOrdered className="w-4 h-4" />}
          title="Ordered List"
          active={isOrderedList}
          onClick={() => toggleListType("ol")}
        />

        {/* Divider */}
        <div className="border-l h-6 mx-1"></div>

        

        {/* Table Button */}
        <ToolbarButton
          icon={<Table className="w-4 h-4" />}
          title="Insert Table"
          onClick={insertTable}
        />

        {/* Image Button */}
        <ToolbarButton
          icon={<ImageIcon className="w-4 h-4" />}
          title={isImageSelected ? "Edit Image" : "Insert Image"}
          active={isImageSelected}
          onClick={openImageInsertModal}
        />

        {/* Divider */}
        <div className="border-l h-6 mx-1"></div>

        {/* Clear Formatting */}
        <ToolbarButton
          icon={<Trash2 className="w-4 h-4" />}
          title="Clear Formatting"
          onClick={clearFormatting}
        />

        {/* Divider */}
        <div className="border-l h-6 mx-1"></div>

        {/* Undo/Redo */}
        <ToolbarButton
          icon={<Undo2 className="w-4 h-4" />}
          title="Undo"
          disabled={historyIndex === 0}
          onClick={undo}
        />
        <ToolbarButton
          icon={<Redo2 className="w-4 h-4" />}
          title="Redo"
          disabled={historyIndex === history.length - 1}
          onClick={redo}
        />

        {/* Custom CSS Toggle */}
        <ToolbarButton
          icon={<Palette className="w-4 h-4" />}
          title={customCssEnabled ? "Disable Custom CSS" : "Enable Custom CSS"}
          active={customCssEnabled}
          onClick={() => {
            if (customCssEnabled) {

              setCustomCssEnabled(false);
            } else {
              
              setCustomCssEnabled(true);
            }
          }}
        />Custom CSS Mode

        {/* Divider */}
        <div className="border-l h-6 mx-1"></div>

        {/* Media Width */}
        <MediaWidthButton shadowHostRef={shadowHostRef} />

      </div>

      <div
        ref={(el) => {
          shadowHostRef.current = el;
          setShadowHostReady(!!el);
        }}
        className="flex-1 flex flex-col min-h-0"
        style={{ minHeight: "24rem" }}
      />
      

      {/* Image Insert Modal */}
      {showImageInsertModal && (
        <ImageInsertModal
          editorRef={editorRef}
          imageElement={selectedImageElement}
          onClose={() => {
            setShowImageInsertModal(false);
            setSelectedImageElement(null);
          }}
          onImageUpdate={handleEditorChange}
        />
      )}

      {/* Image Generation Modal - HIDDEN */}
      {false && showImageModal && (
        <ImageGenerationModal
          editorRef={editorRef}
          onClose={() => setShowImageModal(false)}
          onImageReplace={(imageUrl, targetImg) => {
            if (!imageUrl) return;
            
            if (targetImg && editorRef.current?.contains(targetImg)) {
              // Replace existing image
              targetImg.src = imageUrl;
              targetImg.alt = targetImg.alt || 'Generated image';
              handleEditorChange();
            } else {
              // Insert new image at cursor position
              const selection = window.getSelection();
              if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                const img = document.createElement('img');
                img.src = imageUrl;
                img.alt = 'Generated image';
                img.style.maxWidth = '100%';
                img.style.height = 'auto';
                img.style.display = 'block';
                img.style.margin = '1rem 0';
                
                // Insert image and add a paragraph after it for better editing
                range.insertNode(img);
                const p = document.createElement('p');
                p.innerHTML = '<br>';
                range.setStartAfter(img);
                range.insertNode(p);
                
                // Move cursor after the image
                range.setStartAfter(p);
                range.collapse(true);
                selection.removeAllRanges();
                selection.addRange(range);
                
                handleEditorChange();
              } else {
                // Fallback: insert at end
                const img = document.createElement('img');
                img.src = imageUrl;
                img.alt = 'Generated image';
                img.style.maxWidth = '100%';
                img.style.height = 'auto';
                img.style.display = 'block';
                img.style.margin = '1rem 0';
                editorRef.current?.appendChild(img);
                handleEditorChange();
              }
            }
            setShowImageModal(false);
          }}
        />
      )}

      <style jsx global>{`
        /* Removed .is-selected and .selected styles - now using positioned overlays outside editor */

        /* Change highlighting styles */
        .change-wrapper {
          position: relative;
          margin-bottom: 1rem;
        }

        .change-from {
          position: relative;
        }

        .change-to {
          position: relative;
        }

        .change-from-content {
          background-color: rgba(239, 68, 68, 0.1) !important;
          border-left: 4px solid #ef4444 !important;
          padding-left: 1rem !important;
          position: relative;
        }

        .change-to-content {
          background-color: rgba(34, 197, 94, 0.1) !important;
          border-left: 4px solid #22c55e !important;
          padding-left: 1rem !important;
          margin-top: 0.5rem;
          position: relative;
        }

        .change-from:hover .change-action-btn,
        .change-to:hover .change-action-btn {
          display: block;
        }

        .change-action-btn {
          display: none;
          position: absolute;
          top: 0.5rem;
          right: 0.5rem;
          padding: 0.25rem 0.5rem;
          font-size: 0.75rem;
          font-weight: 600;
          border-radius: 0.25rem;
          cursor: pointer;
          z-index: 10;
          transition: all 0.2s;
          border: none;
        }

        .change-from .change-action-btn {
          background-color: #ef4444;
          color: white;
        }

        .change-from .change-action-btn:hover {
          background-color: #dc2626;
        }

        .change-to .change-action-btn {
          background-color: #22c55e;
          color: white;
        }

        .change-to .change-action-btn:hover {
          background-color: #16a34a;
        }
      `}</style>
    </div>
  );
});

// Reusable Toolbar Button Component
function ToolbarButton({
  icon,
  title,
  active = false,
  disabled = false,
  onClick,
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-1.5 rounded transition-colors ${
        disabled
          ? "opacity-50 cursor-not-allowed"
          : active
          ? "bg-blue-500 text-white hover:bg-blue-600"
          : "bg-white border hover:bg-gray-100"
      }`}
    >
      {icon}
    </button>
  );
}

export default ContentMagicEditor;
// ARCHIVED: Original path was app/(private)/content-magic/components/ContentMagicEditorCustom.js

"use client";
import React, { useRef, useEffect, useImperativeHandle, forwardRef } from "react";
import { useWritingGuide } from "@/libs/content-magic/context/WritingGuideContext";
import { convertImageReferencesToUrls } from "@/libs/content-magic/utils/convertImageReferences";
import { initMonkey } from "@/libs/monkey";

/** Base styles for .editorContent inside shadow root (mirrors editor.css) */
const EDITOR_CONTENT_STYLES = `
.editorContent {
  font-family: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  padding: 1.5rem;
  min-height: 100%;
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

async function injectCustomCssIntoShadow(shadowRoot) {
  try {
    const monkey = await initMonkey(true);
    const html = await monkey.getCustomCssTagsForShadowDom();
    if (html && html.trim()) {
      const container = document.createElement("div");
      container.innerHTML = html;
      shadowRoot.appendChild(container);
    }
  } catch (err) {
    console.error("[ContentMagicEditorCustom] Error injecting custom CSS:", err);
  }
}

const ContentMagicEditorCustom = forwardRef(function ContentMagicEditorCustom(
  { onChange },
  ref
) {
  const { article } = useWritingGuide();
  const hostRef = useRef(null);
  const wrapperRef = useRef(null);
  const shadowRef = useRef(null);
  const lastExternalContentRef = useRef("");
  const isUpdatingFromExternalRef = useRef(false);

  useImperativeHandle(
    ref,
    () => ({
      getHtml: () => wrapperRef.current?.innerHTML ?? "",
      setHtml: (html) => {
        if (!wrapperRef.current) return;
        isUpdatingFromExternalRef.current = true;
        wrapperRef.current.innerHTML = html ?? "";
        lastExternalContentRef.current = html ?? "";
        setTimeout(() => {
          convertImageReferencesToUrls(wrapperRef.current);
          isUpdatingFromExternalRef.current = false;
        }, 100);
      },
      getEditorNode: () => wrapperRef.current ?? null,
      getFirstSelectedElement: () => null,
      getSelectedElements: () => [],
    }),
    []
  );

  useEffect(() => {
    if (!hostRef.current) return;
    const host = hostRef.current;
    if (host.shadowRoot) return;
    const shadow = host.attachShadow({ mode: "open" });
    shadowRef.current = shadow;

    const baseStyle = document.createElement("style");
    baseStyle.textContent = EDITOR_CONTENT_STYLES;
    // shadow.appendChild(baseStyle);

    let cancelled = false;
    let wrapper = null;
    const handleInput = (e) => {
      if (onChange) onChange(e);
    };

    (async () => {
      await injectCustomCssIntoShadow(shadow);
      if (cancelled) return;

      const banner = document.createElement("div");
      banner.className = "custom-css-mode-banner";
      banner.style.cssText = "position:absolute;top:0.5rem;right:0.5rem;padding:0.25rem 0.5rem;font-size:0.75rem;background:rgb(243 232 255);color:rgb(107 33 168);border-radius:0.25rem;z-index:10;";
      banner.textContent = "Custom CSS Mode ON";
      // shadow.appendChild(banner);

      wrapper = document.createElement("div");
      wrapper.className = "editorContent";
      wrapper.contentEditable = "true";
      wrapper.setAttribute("data-placeholder", "Start typing...");
      const initialHtml = article?.content_html || "<p>Start typing...</p>";
      const hasStored = article?.content_html && String(article.content_html).trim().length > 0;
      if (!hasStored) {
        console.warn("!!! [ContentMagicEditorCustom] init: using fallback 'Start typing...' (article.content_html empty or missing) articleId:", article?.id);
      } else {
        console.log("[ContentMagicEditorCustom] init: using article.content_html length:", initialHtml.length, "articleId:", article?.id);
      }
      wrapper.innerHTML = initialHtml;
      lastExternalContentRef.current = initialHtml;
      wrapperRef.current = wrapper;
      shadow.appendChild(wrapper);

      setTimeout(() => convertImageReferencesToUrls(wrapper), 100);
      wrapper.addEventListener("input", handleInput);
    })();

    return () => {
      cancelled = true;
      if (wrapper) wrapper.removeEventListener("input", handleInput);
      wrapperRef.current = null;
      shadowRef.current = null;
    };
  }, []);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper || !article?.content_html) return;
    const newHtml = article.content_html || "";
    const lastExternal = lastExternalContentRef.current || "";
    const isEditorFocused = shadowRef.current?.activeElement === wrapper;
    const isExternalChange = newHtml !== lastExternal;
    const normalizedNew = newHtml.replace(/\s+/g, " ").trim();
    const normalizedLast = lastExternal.replace(/\s+/g, " ").trim();
    const isSignificantChange = normalizedNew !== normalizedLast;
    if (
      isExternalChange &&
      isSignificantChange &&
      !isUpdatingFromExternalRef.current &&
      !isEditorFocused
    ) {
      isUpdatingFromExternalRef.current = true;
      wrapper.innerHTML = newHtml;
      lastExternalContentRef.current = newHtml;
      setTimeout(() => {
        convertImageReferencesToUrls(wrapper);
        isUpdatingFromExternalRef.current = false;
      }, 100);
    }
  }, [article?.content_html]);

  return <div ref={hostRef} className="flex-1 overflow-y-auto flex flex-col relative min-h-0" />;
});

export default ContentMagicEditorCustom;

"use client";
import React, { useState, useEffect, useRef } from "react";
import { X, Save, Eye, EyeOff, Code } from "lucide-react";
import { initMonkey } from "@/libs/monkey";
import "@/app/(private)/content-magic/editor.css";
import { syncQuickActionPreviewShadow } from "../utils/shadowPreviewSync";

/** Base styles for .editorContent inside shadow root (mirrors ContentMagicEditor / QuickActionPopupAIFill) */
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
 * QuickActionPopupEditHtml
 * 
 * HTML code editor popup for editing section HTML directly.
 * Features:
 * - Code textarea with monospace font
 * - Preview pane toggle
 * - When customCssEnabled, preview renders in shadow DOM with custom CSS
 */
export default function QuickActionPopupEditHtml({
  isOpen,
  onClose,
  selectedElement,
  onSave,
  customCssEnabled = false,
  editorShadowRoot = null,
}) {
  const [htmlCode, setHtmlCode] = useState('');
  const [showPreview, setShowPreview] = useState(true);
  const [hasChanges, setHasChanges] = useState(false);

  const previewShadowHostRef = useRef(null);
  const previewShadowContentRef = useRef(null);
  const shadowInjectionRunIdRef = useRef(0);

  // Initialize HTML code when dialog opens
  useEffect(() => {
    if (isOpen && selectedElement) {
      const elementHtml = selectedElement.outerHTML || selectedElement.innerHTML || '';
      setHtmlCode(elementHtml);
      setHasChanges(false);
    }
  }, [isOpen, selectedElement]);

  // Attach shadow to preview host and create content div (independent of customCssEnabled)
  useEffect(() => {
    if (!previewShadowHostRef.current || !isOpen || !showPreview) return;
    const host = previewShadowHostRef.current;
    if (!host.shadowRoot) {
      const shadow = host.attachShadow({ mode: "open" });
      const baseStyle = document.createElement("style");
      baseStyle.textContent = EDITOR_CONTENT_STYLES;
      // shadow.appendChild(baseStyle);

      const previewDiv = document.createElement("div");
      previewDiv.className = "editorContent min-h-full outline-none rounded-lg p-4 border border-gray-200 bg-white";
      previewDiv.style.wordBreak = "break-word";
      previewDiv.style.overflowWrap = "break-word";
      previewDiv.innerHTML = htmlCode ?? "";
      shadow.appendChild(previewDiv);
      previewShadowContentRef.current = previewDiv;
      return () => {
        previewShadowContentRef.current = null;
      };
    } else {
      const existing = host.shadowRoot.querySelector(".editorContent");
      if (existing) previewShadowContentRef.current = existing;
    }
  }, [isOpen, showPreview]);

  // Inject custom CSS (profile-level) into the shadow root when customCssEnabled is ON
  useEffect(() => {
    if (!customCssEnabled || !previewShadowHostRef.current || !isOpen || !showPreview) return;
    const host = previewShadowHostRef.current;
    if (!host.shadowRoot) return;

    shadowInjectionRunIdRef.current += 1;
    const thisRunId = shadowInjectionRunIdRef.current;

    (async () => {
      try {
        if (thisRunId !== shadowInjectionRunIdRef.current || !host.isConnected) return;
        const shadowRoot = host.shadowRoot;
        if (!shadowRoot) return;
        const previewEl = shadowRoot.querySelector(".editorContent");
        if (!previewEl) return;

        const monkey = await initMonkey(true);
        if (thisRunId !== shadowInjectionRunIdRef.current || !host.isConnected) return;
        await monkey.applyCustomCssToShadowDom(shadowRoot, previewEl);
      } catch (err) {
      }
    })();
  }, [customCssEnabled, isOpen, showPreview]);

  useEffect(() => {
    if (!isOpen || !showPreview || !previewShadowHostRef.current?.shadowRoot) return;
    const shadow = previewShadowHostRef.current.shadowRoot;
    const previewDiv = shadow.querySelector(".editorContent");
    if (!previewDiv) return;
    syncQuickActionPreviewShadow({
      shadowRoot: shadow,
      editorShadowRoot,
      htmlString: htmlCode ?? "",
      selectedElement,
      previewDiv,
      setInnerHtml: true,
    });
  }, [isOpen, showPreview, htmlCode, selectedElement, editorShadowRoot]);

  const handleCodeChange = (e) => {
    setHtmlCode(e.target.value);
    setHasChanges(true);
  };

  const handleSave = () => {
    if (!hasChanges) {
      onClose();
      return;
    }
    if (onSave) {
      onSave(htmlCode);
    }

    setHasChanges(false);
    onClose();
  };

  const handleCancel = () => {
    if (hasChanges) {
      if (!confirm('You have unsaved changes. Are you sure you want to close?')) {
        return;
      }
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-[80] flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <Code className="w-5 h-5 text-gray-600" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Edit Section HTML</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Edit the HTML code of the entire section containing your selection
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              title={showPreview ? "Hide preview" : "Show preview"}
            >
              {showPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              {showPreview ? "Hide Preview" : "Show Preview"}
            </button>
            <button
              onClick={handleCancel}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Code Editor */}
          <div className={showPreview ? "w-1/2 border-r border-gray-200 flex flex-col" : "w-full flex flex-col"}>
            <div className="px-4 py-2 border-b border-gray-200 bg-gray-50">
              <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">HTML Code</span>
            </div>
            <div className="flex-1 overflow-hidden">
              <textarea
                value={htmlCode}
                onChange={handleCodeChange}
                className="w-full h-full px-4 py-3 font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset"
                style={{
                  fontFamily: 'Monaco, Menlo, "Ubuntu Mono", Consolas, monospace',
                  fontSize: '13px',
                  lineHeight: '1.6',
                  tabSize: 2
                }}
                spellCheck={false}
              />
            </div>
          </div>

          {/* Preview Pane */}
          {showPreview && (
            <div className="w-1/2 flex flex-col">
              <div className="px-4 py-2 border-b border-gray-200 bg-gray-50">
                <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Preview</span>
              </div>
              <div className="flex-1 overflow-auto p-6 bg-gray-50">
                <div>
                  <p className="text-xs text-gray-500 mb-3">
                    {customCssEnabled
                      ? "Preview with custom CSS applied"
                      : "Preview (custom CSS disabled)"}
                  </p>
                  <div
                    ref={previewShadowHostRef}
                    className="min-h-[200px] rounded-lg border border-gray-200 overflow-hidden bg-white"
                    style={{ minHeight: "200px" }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="text-sm text-gray-600">
            {hasChanges ? (
              <span className="text-amber-600 font-medium">Unsaved changes</span>
            ) : (
              <span className="text-gray-400">No changes</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!hasChanges}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              <Save className="w-4 h-4" />
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";
import React, { useState, useEffect, useRef } from "react";
import { X, Wand2, Sparkles } from "lucide-react";
import { initMonkey } from "@/libs/monkey";
import "@/app/(private)/content-magic/editor.css";
import {
  syncQuickActionPreviewShadow,
  getBodyHtmlForPreview,
} from "../utils/shadowPreviewSync";

/** Base styles for .editorContent inside shadow root (mirrors ContentMagicEditor) */
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
 * QuickActionPopupAIFill (AI Edit)
 * 
 * Full-screen popup for AI-powered content editing.
 * Provides a prompt-based interface with before/after preview.
 * The "after" version is contenteditable and used for serial editing.
 * When customCssEnabled is true, preview renders in a shadow DOM with custom CSS.
 */
export default function QuickActionPopupAIFill({
  isOpen,
  onClose,
  selectedElement,
  onApply,
  sectionElementToReplace = null,
  customCssEnabled = false,
  editorShadowRoot = null,
}) {
  const [prompt, setPrompt] = useState('');
  const [processing, setProcessing] = useState(false);
  const [beforeHtml, setBeforeHtml] = useState('');
  const [afterHtml, setAfterHtml] = useState('');
  const [activeTab, setActiveTab] = useState('preview');
  const [chatHistory, setChatHistory] = useState([]);
  const [originalParentSection, setOriginalParentSection] = useState(null);
  const [jsonPreviewItem, setJsonPreviewItem] = useState(null); // { index, raw } for dev-only floating json
  const [isDev, setIsDev] = useState(false);
  /** Bumps when preview body should be pushed from React (open, AI response, original→preview tab). */
  const [previewBodyNonce, setPreviewBodyNonce] = useState(0);
  const prevActiveTabRef = useRef(activeTab);

  // Compute isDev on client after mount (avoids SSR/stale closure issues)
  useEffect(() => {
    const host = typeof window !== "undefined" ? window.location?.hostname ?? "" : "";
    const dev =
      /^(localhost|127\.0\.0\.1|\[::1\]|\.local)$/i.test(host) ||
      (typeof process !== "undefined" && process.env?.NODE_ENV !== "production");
    setIsDev(dev);
  }, []);

  const previewShadowHostRef = useRef(null);
  const previewShadowContentRef = useRef(null);
  const shadowInjectionRunIdRef = useRef(0);
  const setAfterHtmlRef = useRef(setAfterHtml);
  setAfterHtmlRef.current = setAfterHtml;

  // Initialize before/after HTML when popup opens
  useEffect(() => {
    if (isOpen && selectedElement) {
      // Find parent section if element is inside one, or use element if it IS a section
      let sectionElement = null;
      if (selectedElement.tagName === 'SECTION') {
        // Element itself is a section
        sectionElement = selectedElement;
      } else {
        // Find parent section
        let element = selectedElement;
        while (element && element.parentElement) {
          if (element.parentElement.tagName === 'SECTION') {
            sectionElement = element.parentElement;
            break;
          }
          element = element.parentElement;
        }
      }
      
      // Use section's outerHTML if found, otherwise use element's outerHTML
      const initialHtml = sectionElement 
        ? sectionElement.outerHTML 
        : (selectedElement.outerHTML || selectedElement.innerHTML || '');
      
      setBeforeHtml(initialHtml);
      setAfterHtml(initialHtml);
      setOriginalParentSection(sectionElement);
      setPrompt('');
      setChatHistory([]); // Clear chat history when popup opens
      setPreviewBodyNonce((n) => n + 1);
      prevActiveTabRef.current = "preview";
    }
  }, [isOpen, selectedElement]);

  useEffect(() => {
    if (prevActiveTabRef.current === "original" && activeTab === "preview") {
      setPreviewBodyNonce((n) => n + 1);
    }
    prevActiveTabRef.current = activeTab;
  }, [activeTab]);

  // Attach shadow to preview host and create content div (independent of customCssEnabled)
  // Deps: [isOpen] only — avoids removing input listener when afterHtml/beforeHtml change (sync effect populates content)
  useEffect(() => {
    if (!previewShadowHostRef.current || !isOpen) return;
    const host = previewShadowHostRef.current;
    if (!host.shadowRoot) {
      const shadow = host.attachShadow({ mode: "open" });
      const baseStyle = document.createElement("style");
      baseStyle.textContent = EDITOR_CONTENT_STYLES;
      // shadow.appendChild(baseStyle);

      const editorEl = document.createElement("div");
      editorEl.className = "editorContent min-h-full outline-none rounded-lg p-4 border border-gray-200";
      editorEl.style.wordBreak = "break-word";
      editorEl.style.overflowWrap = "break-word";
      editorEl.innerHTML = ""; // Sync effect will populate from state
      editorEl.contentEditable = "true"; // Preview tab is default
      shadow.appendChild(editorEl);
      previewShadowContentRef.current = editorEl;

      const onInput = () => {
        if (editorEl.contentEditable === "true") {
          setAfterHtmlRef.current(editorEl.innerHTML);
        }
      };
      editorEl.addEventListener("input", onInput);

      return () => {
        editorEl.removeEventListener("input", onInput);
        previewShadowContentRef.current = null;
      };
    } else {
      const existing = host.shadowRoot.querySelector(".editorContent");
      if (existing) previewShadowContentRef.current = existing;
    }
  }, [isOpen]);

  // Inject custom CSS (profile-level) into the shadow root when customCssEnabled is ON
  useEffect(() => {
    if (!customCssEnabled || !previewShadowHostRef.current || !isOpen) return;
    const host = previewShadowHostRef.current;
    if (!host.shadowRoot) return;

    shadowInjectionRunIdRef.current += 1;
    const thisRunId = shadowInjectionRunIdRef.current;

    (async () => {
      try {
        if (thisRunId !== shadowInjectionRunIdRef.current || !host.isConnected) return;
        const shadow = host.shadowRoot;
        if (!shadow) return;
        const editorElInner = shadow.querySelector(".editorContent");
        if (!editorElInner) return;

        const monkey = await initMonkey(true);
        if (thisRunId !== shadowInjectionRunIdRef.current || !host.isConnected) return;
        await monkey.applyCustomCssToShadowDom(shadow, editorElInner);
      } catch (err) {
      }
    })();
  }, [customCssEnabled, isOpen]);

  // Draft + head + section styles; on preview tab do not overwrite body (contenteditable).
  useEffect(() => {
    if (!isOpen || !previewShadowHostRef.current?.shadowRoot) return;
    const shadow = previewShadowHostRef.current.shadowRoot;
    const previewDiv = shadow.querySelector(".editorContent");
    if (!previewDiv) return;
    const htmlStr = activeTab === "preview" ? afterHtml : beforeHtml;
    syncQuickActionPreviewShadow({
      shadowRoot: shadow,
      editorShadowRoot,
      htmlString: htmlStr ?? "",
      selectedElement,
      previewDiv,
      setInnerHtml: activeTab !== "preview",
    });
    previewDiv.contentEditable = activeTab === "preview";
  }, [
    isOpen,
    activeTab,
    afterHtml,
    beforeHtml,
    selectedElement,
    editorShadowRoot,
  ]);

  // Push preview body only when nonce bumps (open, AI apply, original→preview) — not every keystroke.
  const afterHtmlRef = useRef(afterHtml);
  afterHtmlRef.current = afterHtml;
  useEffect(() => {
    if (!isOpen || activeTab !== "preview" || !previewShadowContentRef.current) return;
    previewShadowContentRef.current.innerHTML = getBodyHtmlForPreview(
      afterHtmlRef.current ?? ""
    );
  }, [isOpen, activeTab, previewBodyNonce]);

  // Read current preview HTML from DOM when on preview tab (source of truth for manual edits)
  const getCurrentPreviewHtml = () => {
    if (activeTab !== "preview" || !previewShadowContentRef.current) return afterHtml;
    return previewShadowContentRef.current.innerHTML ?? afterHtml;
  };

  // Example prompts for user guidance
  const examplePrompts = [
    "Replace the content with: xxx",
    "Make xxx more concise",
    "Design svg icons for each item",
    "Add bullet points to summarize the key points",
  ];

  const handleApply = async () => {
    if (!prompt.trim()) {
      alert('Please provide instructions for the AI');
      return;
    }

    const htmlToEdit = getCurrentPreviewHtml();
    if (!htmlToEdit) {
      alert('No content to edit');
      return;
    }
    
    
    setProcessing(true);

    try {
      const requestPayload = {
        prompt: prompt,
        html: htmlToEdit
      };
      
      // Call server-side API route for AI editing
      const monkey = await initMonkey();
      const responseText = await monkey.apiCall('/api/content-magic/ai-edit', requestPayload);
      
      const data = JSON.parse(responseText);
      if (data.error) {
        throw new Error(data.error || 'AI Edit request failed');
      }
      
      
      
      
      // Update the "after" version with AI-edited content
      setAfterHtml(data.html);
      setPreviewBodyNonce((n) => n + 1);
      
      // Add to chat history (include raw response for dev json viewer)
      const currentPrompt = prompt; // Save before clearing
      const rawStr = JSON.stringify(data);
      
      setChatHistory(prev => [...prev, {
        prompt: currentPrompt,
        timestamp: new Date().toLocaleTimeString(),
        success: true,
        rawResponse: data
      }]);
      
      setPrompt(''); // Clear prompt for next edit
    } catch (err) {
      // Add failed attempt to chat history (include raw error for dev json viewer)
      const currentPrompt = prompt; // Save before clearing
      const errRaw = { error: err.message, name: err.name, stack: err.stack };
      
      setChatHistory(prev => [...prev, {
        prompt: currentPrompt,
        timestamp: new Date().toLocaleTimeString(),
        success: false,
        error: err.message,
        rawResponse: errRaw
      }]);
      
      alert(`AI Edit failed: ${err.message}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleSave = () => {
    const htmlToApply = getCurrentPreviewHtml();
    // Validate section wrapper if we captured a section element
    if (originalParentSection && htmlToApply) {
      // Check if the HTML string still starts with <section
      const trimmedHtml = htmlToApply.trim();
      if (!trimmedHtml.toLowerCase().startsWith('<section')) {
        const warningMsg = 'Warning: The content no longer starts with a <section> tag. The changes may not be applied correctly. Do you want to continue?';
        if (!confirm(warningMsg)) {
          return; // User cancelled
        }
      }
    }
    
    // Save the current "after" version (which may have been manually edited)
    if (onApply && htmlToApply) {
      // Pass the section element to replace if we captured one
      const elementToReplace = originalParentSection || selectedElement;
      onApply(htmlToApply, elementToReplace);
    }
    onClose();
  };

  const handleAfterHtmlChange = (e) => {
    // Kept for backward compatibility; editing is now handled directly in the shadow DOM contentEditable div.
    setAfterHtml(e.target.innerHTML);
  };

  const handleExampleClick = (examplePrompt) => {
    setPrompt(examplePrompt);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-white z-[90] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-600" />
          <div>
            <h2 className="text-xl font-semibold text-gray-900">AI Edit</h2>
            <p className="text-sm text-gray-500 mt-0.5">Edit content with AI instructions</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <X className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      {/* Content - Two Column Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Prompt Input */}
        <div className="w-1/3 border-r border-gray-200 flex flex-col">
          <div className="px-6 py-3 border-b border-gray-200 bg-gray-50">
            <h3 className="text-sm font-semibold text-gray-900">AI Instructions</h3>
            <p className="text-xs text-gray-500 mt-0.5">Describe how you want to edit the content</p>
          </div>
          <div className="flex-1 overflow-auto p-4 space-y-4">
            {/* Instructions */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs text-blue-900 font-medium mb-1">💡 How to use</p>
              <p className="text-xs text-blue-800">
                Use like you would in AI LLM. A good strategy is asking AI to better target one of your target prompts/questions in this section.
              </p>
            </div>

            {/* Example Prompts */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">
                Examples (click to use)
              </label>
              <div className="flex flex-wrap gap-1.5">
                {examplePrompts.map((example, index) => (
                  <button
                    key={index}
                    onClick={() => handleExampleClick(example)}
                    className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition-colors border border-gray-300"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>

            {/* Prompt Input */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">
                Your Instructions
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={6}
                placeholder="Type your instructions here..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm resize-none"
                onKeyDown={(e) => {
                  // Allow Ctrl+Enter or Cmd+Enter to submit
                  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                    e.preventDefault();
                    handleApply();
                  }
                }}
              />
              <p className="text-xs text-gray-500 mt-1">
                Ctrl+Enter to apply
              </p>
            </div>

            {/* Apply Button */}
            <button
              onClick={handleApply}
              disabled={processing || !prompt.trim()}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              {processing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Processing...
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4" />
                  Apply AI Edit
                </>
              )}
            </button>

            {/* Chat History */}
            {chatHistory.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <label className="block text-xs font-medium text-gray-700 mb-2">
                  Chat History
                </label>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {chatHistory.map((item, index) => (
                    <div
                      key={index}
                      className={`p-2 rounded-lg text-xs ${
                        item.success
                          ? 'bg-green-50 border border-green-200'
                          : 'bg-red-50 border border-red-200'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-1 gap-2">
                        <span className={`font-medium ${
                          item.success ? 'text-green-900' : 'text-red-900'
                        }`}>
                          {item.success ? '✓ Applied' : '✗ Failed'}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          {isDev && (
                            <button
                              type="button"
                              onClick={() => setJsonPreviewItem({ index, raw: item.rawResponse ?? null })}
                              className="px-1.5 py-0.5 text-[10px] font-mono bg-gray-200 hover:bg-gray-300 text-gray-700 rounded"
                            >
                              json
                            </button>
                          )}
                          <span className="text-gray-500 text-xs">{item.timestamp}</span>
                        </div>
                      </div>
                      <p className={`text-xs ${
                        item.success ? 'text-green-800' : 'text-red-800'
                      }`}>
                        {item.prompt}
                      </p>
                      {item.error && (
                        <p className="text-xs text-red-600 mt-1 italic">
                          Error: {item.error}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Tabbed Preview */}
        <div className="w-2/3 flex flex-col overflow-hidden">
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Tabs */}
            <div className="flex border-b border-gray-200 bg-gray-50 flex-shrink-0">
              <button
                onClick={() => setActiveTab('preview')}
                className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
                  activeTab === 'preview'
                    ? 'text-purple-600 border-b-2 border-purple-600 bg-white'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                Preview
              </button>
              <button
                onClick={() => setActiveTab('original')}
                className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
                  activeTab === 'original'
                    ? 'text-purple-600 border-b-2 border-purple-600 bg-white'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                Show Original
              </button>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <div>
                <p className="text-xs text-gray-500 mb-3">
                  {activeTab === "preview"
                    ? customCssEnabled
                      ? "AI-edited version - you can make manual edits here (custom CSS applied)"
                      : "AI-edited version - you can make manual edits here"
                    : "Original content for reference (read-only)"}
                </p>
                <div
                  ref={previewShadowHostRef}
                  className="min-h-[200px] rounded-lg border border-gray-200 overflow-hidden"
                  style={{ minHeight: "200px" }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Dev-only: floating JSON viewer for chat history item raw response */}
      {isDev && jsonPreviewItem != null && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/50"
          onClick={() => setJsonPreviewItem(null)}
        >
          <div
            className="bg-white rounded-lg shadow-xl border border-gray-200 max-w-2xl w-full max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-gray-50 rounded-t-lg">
              <span className="text-sm font-medium text-gray-700">Raw response (item #{jsonPreviewItem.index + 1})</span>
              <button
                type="button"
                onClick={() => setJsonPreviewItem(null)}
                className="p-1.5 hover:bg-gray-200 rounded text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <pre className="flex-1 overflow-auto p-4 text-xs font-mono text-gray-800 whitespace-pre-wrap break-words">
              {jsonPreviewItem.raw == null
                ? "No raw response stored for this item (e.g. from before this feature)."
                : typeof jsonPreviewItem.raw === "string"
                  ? jsonPreviewItem.raw
                  : JSON.stringify(jsonPreviewItem.raw, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
        <div className="text-sm text-gray-600">
          <span>Make edits in the preview, then accept to apply changes</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Abandon Changes
          </button>
          <button
            onClick={handleSave}
            disabled={!getCurrentPreviewHtml()}
            className="flex items-center gap-2 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
          >
            <Wand2 className="w-4 h-4" />
            Accept Changes
          </button>
        </div>
      </div>
    </div>
  );
}

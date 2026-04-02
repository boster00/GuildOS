"use client";
import React, { useState, useEffect, useRef } from "react";
import { X, RefreshCw, Check } from "lucide-react";
import ShowTemplates from "@/libs/monkey/components/ShowTemplates";
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
 * QuickActionPopupChangeTemplate
 * 
 * Full-screen modal for changing/converting a section to a different template.
 * Shows current section preview (with editor styles) and available templates.
 * Uses AI to replace template content with original section content.
 * When customCssEnabled, left-panel preview renders in shadow DOM with custom CSS.
 */
export default function QuickActionPopupChangeTemplate({
  isOpen,
  onClose,
  selectedElement,
  onApply,
  customCssEnabled = false,
  editorShadowRoot = null,
}) {
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [converting, setConverting] = useState(false);
  const [convertedHtml, setConvertedHtml] = useState(null);
  const [originalHtml, setOriginalHtml] = useState('');
  const [originalParentSection, setOriginalParentSection] = useState(null);
  const customInstructionsRef = useRef(null);
  const [keepPlaceholders, setKeepPlaceholders] = useState(false);

  const previewShadowHostRef = useRef(null);
  const previewShadowContentRef = useRef(null);
  const shadowInjectionRunIdRef = useRef(0);

  // Initialize original HTML when popup opens
  useEffect(() => {
    if (isOpen && selectedElement) {
      // Find parent section if element is inside one, or use element if it IS a section
      let sectionElement = null;
      if (selectedElement.tagName === 'SECTION') {
        sectionElement = selectedElement;
      } else {
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
      
      setOriginalHtml(initialHtml);
      setOriginalParentSection(sectionElement);
      setConvertedHtml(null); // Reset converted HTML
      setSelectedTemplate(null); // Reset selected template
      if (customInstructionsRef.current) customInstructionsRef.current.value = '';
      setKeepPlaceholders(false); // Reset keep placeholders toggle
    }
  }, [isOpen, selectedElement]);

  // Attach shadow to preview host and create content div (independent of customCssEnabled)
  useEffect(() => {
    if (!previewShadowHostRef.current || !isOpen) return;
    const host = previewShadowHostRef.current;
    if (!host.shadowRoot) {
      const shadow = host.attachShadow({ mode: "open" });
      const baseStyle = document.createElement("style");
      baseStyle.textContent = EDITOR_CONTENT_STYLES;
      // shadow.appendChild(baseStyle);

      const previewDiv = document.createElement("div");
      previewDiv.className = "editorContent min-h-full outline-none rounded-lg p-4";
      previewDiv.style.wordBreak = "break-word";
      previewDiv.style.overflowWrap = "break-word";
      previewDiv.innerHTML = "";
      shadow.appendChild(previewDiv);
      previewShadowContentRef.current = previewDiv;
      return () => {
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
  }, [customCssEnabled, isOpen]);

  useEffect(() => {
    if (!isOpen || !previewShadowHostRef.current?.shadowRoot) return;
    const shadow = previewShadowHostRef.current.shadowRoot;
    const previewDiv = shadow.querySelector(".editorContent");
    if (!previewDiv) return;
    const htmlStr = convertedHtml || originalHtml || "";
    syncQuickActionPreviewShadow({
      shadowRoot: shadow,
      editorShadowRoot,
      htmlString: htmlStr,
      selectedElement,
      previewDiv,
      setInnerHtml: true,
    });
  }, [isOpen, selectedElement, editorShadowRoot, convertedHtml, originalHtml]);

  const handleTemplateSelect = (template) => {
    setSelectedTemplate(template);
    setConvertedHtml(null); // Reset converted HTML when selecting a new template
    // Keep custom instructions when selecting a new template
  };

  // Helper function to strip HTML tags and extract only text content
  const stripHtmlTags = (html) => {
    if (!html) return '';
    // Create a temporary DOM element to extract text
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    return tempDiv.textContent || tempDiv.innerText || '';
  };

  const handleApply = async () => {
    if (!selectedTemplate || !selectedElement) {
      return;
    }
    setConverting(true);

    try {
      // Get template HTML
      const templateHtml = selectedTemplate.html || selectedTemplate.template || '';
      
      // Strip HTML tags from original content to extract only text
      // This ensures we only adopt the text content, not any HTML structure
      const originalTextOnly = stripHtmlTags(originalHtml);
      
      // Build prompt: take content from original section and adapt it to the template's format
      // Include template HTML directly in the prompt for clarity (read from ref to avoid re-renders on type)
      const customInstructionsValue = (customInstructionsRef.current?.value ?? '').trim();
      const customInstructionsText = customInstructionsValue
        ? `\n\nADDITIONAL CUSTOM INSTRUCTIONS:\n${customInstructionsValue}` 
        : '';
      
      // Conditional instruction for placeholder elements based on toggle
      const placeholderInstruction = keepPlaceholders
        ? '- If the source content lacks information for certain template elements, retain those elements with their placeholder content'
        : '- Remove template elements that lack corresponding content from the source';
      
      const prompt = `Take the TEXT CONTENT from the original section below and adapt it to match the template's structure and format.

GLOBAL GUIDE RAILS — Apply the following unless they conflict with the user's direct instructions, in which case follow the user's instructions:
1. Retain all source information and text. If the template does not have enough space or elements allocated, improvise as needed; this will signal to the user to update the prompt about what to do with the extra content.
2. Do not retain HTML from the source. Use the source HTML only for contextual understanding of what the source elements are.
3. Images are informational; retain them from the source.
4. The source (and the template) may implement images as backgrounds of divs or other elements. Treat those as images: deduce where the images are and retain them.

TEMPLATE STRUCTURE (use this format, structure, CSS classes, and layout):
${templateHtml}

CRITICAL REQUIREMENTS:
- Extract ONLY the TEXT CONTENT from the original section - DO NOT adopt any HTML tags, structure, or formatting from the source
- Use ONLY the template's HTML structure, layout, CSS classes, and visual format
- The source HTML is provided for reference, but you must IGNORE all HTML tags and structure from it
- Extract only the plain text content and place it into the template's structure
- Preserve the template's design and styling completely
- Do not copy any HTML tags, attributes, classes, or structure from the source
- Map the extracted text content into the template's format appropriately
- Do not lose any text content from the original section
${placeholderInstruction}${customInstructionsText}

ORIGINAL SECTION TEXT CONTENT (extract ONLY the text, ignore all HTML):
${originalTextOnly}

ORIGINAL SECTION HTML (for reference only - DO NOT use its HTML structure):
${originalHtml}`;
      
      // Call AI edit API with template HTML and prompt
      // Note: We pass templateHtml as a flag so API knows this is template conversion
      // The prompt already includes the template HTML, and html param is the template to use as base
      const requestPayload = {
        prompt: prompt,
        html: templateHtml,
        templateHtml: true // Flag to indicate this is template conversion
      };
      const monkey = await initMonkey();
      const responseText = await monkey.apiCall('/api/content-magic/ai-edit', requestPayload);
      
      const data = JSON.parse(responseText);
      
      
      // Store converted HTML instead of applying immediately
      if (data.html) {
        setConvertedHtml(data.html);
      } else {
        throw new Error('No HTML returned from conversion');
      }
    } catch (err) {
      alert(`Template conversion failed: ${err.message}`);
    } finally {
      setConverting(false);
    }
  };

  const handleAcceptChange = () => {
    // Validate section wrapper if we captured a section element
    if (originalParentSection && convertedHtml) {
      // Check if the HTML string still starts with <section
      const trimmedHtml = convertedHtml.trim();
      if (!trimmedHtml.toLowerCase().startsWith('<section')) {
        const warningMsg = 'Warning: The content no longer starts with a <section> tag. The changes may not be applied correctly. Do you want to continue?';
        if (!confirm(warningMsg)) {
          return; // User cancelled
        }
      }
    }
    
    // Apply the converted HTML
    if (onApply && convertedHtml) {
      const elementToReplace = originalParentSection || selectedElement;
      onApply(convertedHtml, elementToReplace);
    }
    
    // Reset and close
    setSelectedTemplate(null);
    setConvertedHtml(null);
    onClose();
  };

  const handleCancel = () => {
    // Reset converted HTML but keep template selected and custom instructions
    setConvertedHtml(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-white z-[90] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Change Template</h2>
          <p className="text-sm text-gray-500 mt-1">
            Select a template to convert your section. Only text content will be extracted from the source - HTML structure will not be adopted.
          </p>
        </div>
        <button
          onClick={() => {
            setSelectedTemplate(null);
            onClose();
          }}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <X className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      {/* Content - Two Sections */}
      <div className="flex-1 flex overflow-hidden">
        {/* First Section: Selected Section Preview */}
        <div className="w-1/2 border-r border-gray-200 flex flex-col">
          <div className="px-6 py-3 border-b border-gray-200 bg-gray-50">
            <h3 className="text-sm font-semibold text-gray-900">Current Section</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Preview of the section you're converting. Only text content will be extracted - HTML tags and structure will be ignored.
            </p>
          </div>
          
          {/* Custom Instructions Input */}
          <div className="px-6 py-3 border-b border-gray-200 bg-white">
            <label className="block text-xs font-medium text-gray-700 mb-2">
              Custom Instructions (optional)
            </label>
            <textarea
              ref={customInstructionsRef}
              defaultValue=""
              rows={3}
              placeholder="e.g., do not keep icons, remove images, keep only text..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none"
              disabled={converting}
            />
            <p className="text-xs text-gray-500 mt-1">
              Add specific instructions for the template conversion
            </p>
          </div>
          
          {/* Keep Placeholder Elements Toggle */}
          <div className="px-6 py-3 border-b border-gray-200 bg-white">
            <label className="flex items-start gap-3 cursor-pointer">
              <div className="relative flex-shrink-0 mt-0.5">
                <input
                  type="checkbox"
                  checked={keepPlaceholders}
                  onChange={(e) => setKeepPlaceholders(e.target.checked)}
                  className="sr-only"
                  disabled={converting}
                />
                <div className={`w-11 h-6 rounded-full transition-colors ${
                  keepPlaceholders ? 'bg-blue-600' : 'bg-gray-300'
                }`}>
                  <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform mt-0.5 ml-0.5 ${
                    keepPlaceholders ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </div>
              </div>
              <div className="flex-1">
                <span className="text-sm font-medium text-gray-900 block">
                  Retain Unfilled Template Elements
                </span>
                <span className="text-xs text-gray-500 block mt-1">
                  When enabled, template elements without matching source content will be kept with placeholder text. When disabled, these elements will be removed.
                </span>
              </div>
            </label>
          </div>
          
          {/* Accept/Cancel buttons - shown only when converted HTML is available */}
          {convertedHtml && (
            <div className="px-6 py-3 border-b border-gray-200 bg-blue-50 flex items-center gap-3">
              <button
                onClick={handleAcceptChange}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
              >
                <Check className="w-4 h-4" />
                Accept Change
              </button>
              <button
                onClick={handleCancel}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
          
          <div className="flex-1 overflow-auto p-6">
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

        {/* Second Section: Template Selection */}
        <div className="w-1/2 flex flex-col">
          <div className="px-6 py-3 border-b border-gray-200 bg-gray-50">
            <h3 className="text-sm font-semibold text-gray-900">Available Templates</h3>
            <p className="text-xs text-gray-500 mt-0.5">Select a template to convert your section</p>
          </div>
          <div className="flex-1 overflow-hidden">
              <ShowTemplates
                onTemplateClick={handleTemplateSelect}
                selectedTemplateId={selectedTemplate?.id || null}
              />
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
        <div className="text-sm text-gray-600">
          {selectedTemplate ? (
            <span>Selected: <strong>{selectedTemplate.name}</strong></span>
          ) : (
            <span className="text-gray-400">No template selected</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setSelectedTemplate(null);
              setConvertedHtml(null);
              onClose();
            }}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Close
          </button>
          <button
            onClick={handleApply}
            disabled={converting || !selectedTemplate || !!convertedHtml}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
          >
            {converting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Converting...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                Apply Template Change
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

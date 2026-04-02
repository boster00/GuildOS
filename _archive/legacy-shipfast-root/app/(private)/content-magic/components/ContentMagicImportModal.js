/**
 * ContentMagicImportModal Component
 *
 * Modal for importing content from URL or pasted HTML.
 * Extracts content between first <section and last </section> when present;
 * if no sections are found, wraps the entire HTML in a single section. No AI or other modifications.
 *
 * @component
 */
"use client";
import React, { useState, useEffect } from "react";
import { X, Upload, Globe, FileText, Loader, AlertCircle, CheckCircle, ExternalLink } from "lucide-react";
import { initMonkey } from "@/libs/monkey";
import { normalizeMediaDomain } from "@/libs/content-magic/utils/normalizeMediaDomain";
import { resolveRelativeUrlsInHtml } from "@/libs/content-magic/utils/resolveRelativeUrlsInHtml";

const MEDIA_DOMAIN_STORAGE_KEY = "cj.contentImport.mediaDomain";

/** Remove <head> and <style> tags from HTML (for paste-import when wrapping in a section). */
function stripHeadAndStyleTags(html) {
  return html
    .replace(/<head\b[^>]*>[\s\S]*?<\/head>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .trim();
}

function extractSectionsFromHtml(html) {
  if (!html || !html.trim()) return { extracted: "", hasSections: false };
  const first = html.indexOf("<section");
  const lastEnd = html.lastIndexOf("</section>");
  if (first === -1 || lastEnd === -1 || lastEnd < first) {
    const cleaned = stripHeadAndStyleTags(html.trim());
    return { extracted: `<section class="imported">${cleaned}</section>`, hasSections: false };
  }
  return {
    extracted: html.substring(first, lastEnd + "</section>".length),
    hasSections: true,
  };
}

function isHtmlContent(text) {
  if (!text || text.trim().length === 0) return false;
  const htmlTagPattern = /<[a-z][\s\S]*>/i;
  const htmlEntityPattern = /&[#\w]+;/;
  const htmlStructurePattern = /<\w+[^>]*>[\s\S]*<\/\w+>/i;
  return htmlTagPattern.test(text) || htmlEntityPattern.test(text) || htmlStructurePattern.test(text);
}

export default function ContentMagicImportModal({ isOpen, onClose, onImport }) {
  const [importMode, setImportMode] = useState("url");
  const [url, setUrl] = useState("");
  const [pastedContent, setPastedContent] = useState("");
  const [mediaDomain, setMediaDomain] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [warning, setWarning] = useState(null);
  const [success, setSuccess] = useState(false);
  const [urlFetchFailed, setUrlFetchFailed] = useState(false);
  const [customCssConfigured, setCustomCssConfigured] = useState(null);

  const handleUrlImport = async () => {
    if (!url.trim()) {
      setError("Please enter a URL");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      new URL(url);

      const monkey = await initMonkey();
      const text = await monkey.apiCall("/api/content-magic/crawl", { url, crawlDepth: 0, extractSectionsOnly: true });
      const data = JSON.parse(text);

      if (data.error) {
        setUrlFetchFailed(true);
        setError(data.error || "Failed to fetch URL");
        return;
      }

      setUrlFetchFailed(false);
      if (data.content_html) {
        setSuccess(true);
        setTimeout(() => {
          onImport(data.content_html);
          handleClose();
        }, 500);
      } else {
        setError("No content received from URL");
      }
    } catch (err) {
      setUrlFetchFailed(true);
      setError(err.message || "Failed to import from URL. Try pasting the page HTML instead.");
    } finally {
      setLoading(false);
    }
  };

  const handlePasteImport = () => {
    if (!pastedContent.trim()) {
      setError("Please paste HTML content");
      return;
    }

    setError(null);
    setWarning(null);
    setSuccess(false);

    const content = pastedContent.trim();
    const isHtml = isHtmlContent(content);

    if (!isHtml) {
      setError("Please paste HTML from a webpage.");
      return;
    }

    // Normalize domain: if user entered something, validate it
    const domainInput = mediaDomain.trim();
    if (domainInput) {
      const base = normalizeMediaDomain(domainInput);
      if (base && typeof base === "object" && base.error) {
        setError(base.error);
        return;
      }
      // base is normalized origin string; resolve before extraction
      const htmlToParse = resolveRelativeUrlsInHtml(content, base, { resolveLinks: false });
      const { extracted } = extractSectionsFromHtml(htmlToParse);
      // Persist domain for next time
      try {
        localStorage.setItem(MEDIA_DOMAIN_STORAGE_KEY, domainInput);
      } catch (_) {}
      setSuccess(true);
      onImport(extracted);
    } else {
      const { extracted } = extractSectionsFromHtml(content);
      setSuccess(true);
      onImport(extracted);
    }
    handleClose();
  };

  const handleClose = () => {
    setUrl("");
    setPastedContent("");
    setMediaDomain("");
    setError(null);
    setWarning(null);
    setSuccess(false);
    setLoading(false);
    setUrlFetchFailed(false);
    onClose();
  };

  const handleModeChange = (mode) => {
    setImportMode(mode);
    setError(null);
    setWarning(null);
    setSuccess(false);
    setUrlFetchFailed(false);
  };

  // Prefill media domain from localStorage when modal opens
  useEffect(() => {
    if (isOpen) {
      try {
        const stored = localStorage.getItem(MEDIA_DOMAIN_STORAGE_KEY);
        if (stored && typeof stored === "string") setMediaDomain(stored);
      } catch (_) {}
    }
  }, [isOpen]);

  // When modal opens, check if user has custom styling set up
  useEffect(() => {
    if (!isOpen) {
      setCustomCssConfigured(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const monkey = await initMonkey();
        const text = await monkey.apiGet("/api/settings/custom-css");
        const data = JSON.parse(text || "{}");
        if (!cancelled && data.configured === false) {
          setCustomCssConfigured(false);
        } else if (!cancelled) {
          setCustomCssConfigured(data.configured === true);
        }
      } catch {
        if (!cancelled) setCustomCssConfigured(null);
      }
    })();
    return () => { cancelled = true; };
  }, [isOpen]);

  if (!isOpen) return null;

  const domainNorm = mediaDomain.trim() ? normalizeMediaDomain(mediaDomain) : null;
  const domainError = domainNorm && typeof domainNorm === "object" && domainNorm.error ? domainNorm : null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 z-[200] flex items-center justify-center p-4"
      onClick={handleClose}
    >
      <div 
        className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-gray-800 text-white px-6 py-4 flex items-center justify-between rounded-t-lg">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Import Content
          </h3>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-gray-700 rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-auto p-6 bg-white">
          {/* Warning when custom styles are not set up */}
          {customCssConfigured === false && (
            <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-800 mb-1">Custom styles are not set up yet</p>
                  <p className="text-xs text-amber-700 mb-2">
                    Imported content will use default styling. Set up custom styles so imported pages match your brand.
                  </p>
                  <a
                    href="/settings/custom-css"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-800 hover:text-amber-900 underline"
                  >
                    Set up custom style
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Import Mode Tabs */}
          <div className="border-b border-gray-200 mb-6">
            <div className="flex">
              <button
                onClick={() => handleModeChange("url")}
                className={`px-6 py-3 text-sm font-medium transition-colors ${
                  importMode === "url"
                    ? "text-blue-600 border-b-2 border-blue-600 bg-white"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                }`}
              >
                <Globe className="w-4 h-4 inline mr-2" />
                Import from URL
              </button>
              <button
                onClick={() => handleModeChange("paste")}
                className={`px-6 py-3 text-sm font-medium transition-colors ${
                  importMode === "paste"
                    ? "text-blue-600 border-b-2 border-blue-600 bg-white"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                }`}
              >
                <FileText className="w-4 h-4 inline mr-2" />
                Paste HTML/Text
              </button>
            </div>
          </div>

          {/* URL Import Mode */}
          {importMode === "url" && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Enter URL
                </label>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    setError(null);
                    setUrlFetchFailed(false); // Reset failure state when URL changes
                  }}
                  placeholder="https://example.com/page"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  disabled={loading}
                />
              </div>
              
              {error && error.includes("Try copying and pasting") && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm text-amber-800 font-medium mb-1">URL fetch failed</p>
                      <p className="text-xs text-amber-700">{error}</p>
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={handleUrlImport}
                disabled={loading || !url.trim() || urlFetchFailed}
                className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    Fetching...
                  </>
                ) : (
                  <>
                    <Globe className="w-4 h-4" />
                    Import from URL
                  </>
                )}
              </button>
            </div>
          )}

          {/* Paste Import Mode */}
          {importMode === "paste" && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Media Source Domain <span className="text-gray-500 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={mediaDomain}
                  onChange={(e) => {
                    setMediaDomain(e.target.value);
                    setError(null);
                  }}
                  placeholder="https://example.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 text-sm"
                  disabled={loading}
                />
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  {typeof window !== "undefined" && (
                    <button
                      type="button"
                      onClick={() => setMediaDomain(window.location.origin)}
                      className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      Use this site ({new URL(window.location.origin).hostname})
                    </button>
                  )}
                  {domainError && <span className="text-xs text-red-600">{domainError.error}</span>}
                  {domainNorm && typeof domainNorm === "string" && (
                    <span className="text-xs text-gray-500">
                      /media/a.png → {domainNorm.replace(/\/$/, "")}/media/a.png
                    </span>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Paste HTML or Text Content
                </label>
                <textarea
                  value={pastedContent}
                  onChange={(e) => {
                    setPastedContent(e.target.value);
                    setError(null);
                    setWarning(null);
                  }}
                  placeholder="Paste HTML or plain text here..."
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 resize-none font-mono text-xs"
                  rows={12}
                  disabled={loading}
                />
              </div>

              <button
                onClick={handlePasteImport}
                disabled={!pastedContent.trim() || !!domainError}
                className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center gap-2"
              >
                <FileText className="w-4 h-4" />
                Import Content
              </button>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <p className="text-sm text-green-800 font-medium">Content imported successfully!</p>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mt-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-red-800 font-medium mb-1">Import failed</p>
                  <p className="text-xs text-red-700">{error}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-gray-100 px-6 py-3 flex justify-end rounded-b-lg border-t border-gray-200">
          <button
            onClick={handleClose}
            className="px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

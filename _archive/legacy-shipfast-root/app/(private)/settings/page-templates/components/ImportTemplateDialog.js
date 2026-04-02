"use client";
import React, { useState } from "react";
import { X, Download, Globe, FileText, Loader, AlertCircle, CheckCircle } from "lucide-react";
import { initMonkey } from "@/libs/monkey";
import { resolveRelativeUrlsInHtml } from "@/libs/content-magic/utils/resolveRelativeUrlsInHtml";
import { normalizeMediaDomain } from "@/libs/content-magic/utils/normalizeMediaDomain";
import "@/app/(private)/content-magic/editor.css";

const NOT_CRAWLABLE_MESSAGE = 'This page is not crawlable. Paste in the HTML code instead.';

/**
 * ImportTemplateDialog
 * 
 * Dialog for importing templates from live pages
 * Extracts section elements and saves them as individual templates
 */
export default function ImportTemplateDialog({ 
  isOpen, 
  onClose,
  onComplete
}) {
  const [inputMode, setInputMode] = useState('url'); // 'url' or 'html'
  const [url, setUrl] = useState('');
  const [html, setHtml] = useState('');
  const [mediaDomain, setMediaDomain] = useState('');
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState(null);
  const [sections, setSections] = useState([]);
  const [sectionsExtracted, setSectionsExtracted] = useState(false);

  // Reset sections when input mode changes or when input content changes
  const handleInputModeChange = (mode) => {
    setInputMode(mode);
    setSectionsExtracted(false);
    setSections([]);
    setError(null);
  };

  const handleUrlChange = (newUrl) => {
    setUrl(newUrl);
    if (sectionsExtracted) {
      setSectionsExtracted(false);
      setSections([]);
    }
  };

  const handleHtmlChange = (newHtml) => {
    setHtml(newHtml);
    if (sectionsExtracted) {
      setSectionsExtracted(false);
      setSections([]);
    }
  };

  // Extract domain from URL
  const extractDomainFromUrl = (urlString) => {
    try {
      const urlObj = new URL(urlString);
      return `${urlObj.protocol}//${urlObj.host}`;
    } catch (e) {
      return '';
    }
  };

  const getResolvedHtml = (htmlContent, domainOverride) => {
    const rawDomain = domainOverride || mediaDomain;
    if (!rawDomain || !htmlContent) return htmlContent;
    const base = domainOverride
      ? domainOverride
      : (() => {
          const n = normalizeMediaDomain(mediaDomain);
          return typeof n === "string" ? n : null;
        })();
    if (!base) return htmlContent;
    return resolveRelativeUrlsInHtml(htmlContent, base, { resolveLinks: true });
  };

  const handleFetchUrl = async () => {
    if (!url.trim()) {
      setError('Please enter a URL');
      return;
    }

    setLoading(true);
    setError(null);
    setSections([]);
    setSectionsExtracted(false);

    try {
      const urlObj = new URL(url);
      const extractedDomain = extractDomainFromUrl(url);

      const monkey = await initMonkey();
      const text = await monkey.apiCall('/api/content-magic/crawl', { url, crawlDepth: 0 });
      const data = JSON.parse(text || '{}');
      if (data.error) {
        setError(NOT_CRAWLABLE_MESSAGE);
        return;
      }

      const rawHtml = data.content_html;
      if (!rawHtml || !String(rawHtml).trim()) {
        setError(NOT_CRAWLABLE_MESSAGE);
        return;
      }

      setMediaDomain(extractedDomain);
      setHtml(rawHtml);
      setInputMode('html');
      await parseSections(rawHtml, extractedDomain);
    } catch (err) {
      setError(NOT_CRAWLABLE_MESSAGE);
    } finally {
      setLoading(false);
    }
  };

  const parseSections = async (htmlContent = html, domainOverride = null) => {
    if (!htmlContent.trim()) {
      setError('Please provide HTML content');
      return;
    }

    setLoading(true);
    setError(null);
    setSections([]);
    setSectionsExtracted(false);

    try {
      const processedHtml = getResolvedHtml(htmlContent, domainOverride);

      // Extract sections using API
      const monkey = await initMonkey();
      const text = await monkey.apiCall('/api/templates/import', {
        html: processedHtml,
        saveTemplates: false // Just extract for preview
      });
      const data = JSON.parse(text);

      if (data.error) {
        if (/no section|only one section/i.test(data.error)) {
          setError(NOT_CRAWLABLE_MESSAGE);
          return;
        }
        throw new Error(data.error || 'Failed to extract sections');
      }

      if (data.sections && data.sections.length > 0) {
        setSections(data.sections);
        setSectionsExtracted(true);
      }
      
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (sections.length === 0) {
      setError('No sections to import');
      return;
    }

    setImporting(true);
    setError(null);

    try {
      const processedHtml = getResolvedHtml(html);

      // Save templates using API
      const monkey = await initMonkey();
      const text = await monkey.apiCall('/api/templates/import', {
        html: processedHtml,
        saveTemplates: true
      });
      const data = JSON.parse(text);
      if (data.error) {
        throw new Error(data.error || 'Failed to import templates');
      }
      // Reset form
      setUrl('');
      setHtml('');
      setMediaDomain('');
      setSections([]);
      setSectionsExtracted(false);
      
      if (onComplete) {
        onComplete(data);
      }
      
      // Show success message before closing
      alert(data.message || `Successfully imported ${data.count} templates`);
      onClose();
      
    } catch (err) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setUrl('');
    setHtml('');
    setMediaDomain('');
    setSections([]);
    setSectionsExtracted(false);
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Import Templates from Page</h2>
            <p className="text-sm text-gray-600 mt-1">
              Extract section elements from an example page
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6 space-y-4">
          {/* Instructions */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="text-sm font-medium text-blue-900 mb-2">Instructions</h3>
            <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
              <li>Copy/paste HTML or provide a link to an example page</li>
              <li>The HTML must contain <code className="bg-blue-100 px-1 rounded">&lt;section&gt;</code> elements</li>
              <li>Each section will be saved as a separate template</li>
              <li>This is an advanced feature; some HTML knowledge may be required</li>
            </ul>
          </div>

          {/* Input Mode Toggle */}
          <div className="flex items-center gap-2 border-b border-gray-200">
            <button
              onClick={() => handleInputModeChange('url')}
              className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${
                inputMode === 'url'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <Globe className="w-4 h-4" />
              Enter URL
            </button>
            <button
              onClick={() => handleInputModeChange('html')}
              className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${
                inputMode === 'html'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <FileText className="w-4 h-4" />
              Paste HTML
            </button>
          </div>

          {/* URL Input */}
          {inputMode === 'url' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Page URL
              </label>
              <input
                type="url"
                value={url}
                onChange={(e) => handleUrlChange(e.target.value)}
                placeholder="https://example.com/page"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                disabled={loading}
              />
              <p className="text-xs text-gray-500 mt-2">
                Domain will be automatically detected from the URL for converting relative paths to absolute URLs
              </p>
            </div>
          )}

          {/* HTML Input */}
          {inputMode === 'html' && (
            <div className="space-y-4">
              {/* Media Source Domain Field - Placed First for Visibility */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Media Source Domain <span className="text-gray-500 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={mediaDomain}
                  onChange={(e) => setMediaDomain(e.target.value)}
                  placeholder="https://example.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  disabled={loading}
                />
                <p className="text-xs text-gray-500 mt-1">
                  All relative paths (in attributes, CSS url(), inline styles, srcset, etc.) will be converted to absolute URLs using this domain
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  HTML Content
                </label>
                <textarea
                  value={html}
                  onChange={(e) => handleHtmlChange(e.target.value)}
                  placeholder="<section>&#10;  <div>&#10;    Your section content...&#10;  </div>&#10;</section>&#10;&#10;<section>&#10;  <div>&#10;    Another section...&#10;  </div>&#10;</section>"
                  className="w-full h-[200px] px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-mono resize-none"
                  spellCheck={false}
                  disabled={loading}
                />
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Success Message with Sections Preview */}
          {sectionsExtracted && sections.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-start gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-green-800">
                  Found {sections.length} section{sections.length > 1 ? 's' : ''} ready to import
                </p>
              </div>

              {/* Sections Preview */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Preview of Sections ({sections.length})
                </label>
                <div className="space-y-2 max-h-[300px] overflow-auto">
                  {sections.map((section, index) => (
                    <div key={index} className="border border-gray-300 rounded-lg p-4 bg-gray-50">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-gray-700">
                          Section {index + 1}
                        </span>
                        <span className="text-xs text-gray-500">
                          {section.html.length} characters
                        </span>
                      </div>
                      <div 
                        className="editorContent text-sm"
                        dangerouslySetInnerHTML={{ __html: section.html }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={handleClose}
            disabled={loading || importing}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          
          {/* Conditional Action Button */}
          {!sectionsExtracted ? (
            // Show "Parse Sections" button when sections haven't been extracted yet
            <button
              onClick={() => {
                if (inputMode === 'html') {
                  parseSections(html, mediaDomain);
                } else {
                  handleFetchUrl();
                }
              }}
              disabled={loading || (inputMode === 'html' ? !html.trim() : !url.trim())}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              {loading ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  {inputMode === 'url' ? 'Fetching...' : 'Parsing...'}
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4" />
                  {inputMode === 'url' ? 'Fetch & Parse' : 'Parse Sections'}
                </>
              )}
            </button>
          ) : (
            // Show "Import Templates" button after sections are extracted
            <button
              onClick={handleImport}
              disabled={loading || importing || sections.length === 0}
              className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              {importing ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Import {sections.length} Template{sections.length > 1 ? 's' : ''}
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

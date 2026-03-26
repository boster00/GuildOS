"use client";
import React, { useState } from "react";
import { X, Download, Globe, FileText, Loader, AlertCircle, CheckCircle } from "lucide-react";
import { initMonkey } from "@/libs/monkey";

const NOT_CRAWLABLE_MESSAGE = 'This page is not crawlable. Paste in the HTML code instead.';

/**
 * ImportCSSDialog
 * 
 * Dialog for importing CSS from live pages
 * Extracts CSS links and inline styles
 */
export default function ImportCSSDialog({
  isOpen,
  onClose,
  onImport
}) {
  const [inputMode, setInputMode] = useState('url'); // 'url' or 'html'
  const [url, setUrl] = useState('');
  const [html, setHtml] = useState('');
  const [mediaDomain, setMediaDomain] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [extractedData, setExtractedData] = useState(null);
  const [cssExtracted, setCssExtracted] = useState(false);

  // Reset extraction when input mode or content changes
  const handleInputModeChange = (mode) => {
    setInputMode(mode);
    setCssExtracted(false);
    setExtractedData(null);
    setError(null);
  };

  const handleUrlChange = (value) => {
    setUrl(value);
    if (cssExtracted) {
      setCssExtracted(false);
      setExtractedData(null);
    }
  };

  const handleHtmlChange = (value) => {
    setHtml(value);
    if (cssExtracted) {
      setCssExtracted(false);
      setExtractedData(null);
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

  // Replace relative paths with absolute URLs (same logic as template import)
  const replaceRelativePaths = (cssContent, domain) => {
    if (!domain || !cssContent) return cssContent;
    
    // Ensure domain doesn't end with / (we'll add it when needed)
    const baseUrl = domain.endsWith('/') ? domain.slice(0, -1) : domain;
    
    let processed = cssContent;
    
    // Helper function to check if path should be converted
    const shouldConvert = (path) => {
      if (!path || typeof path !== 'string') return false;
      
      // Skip if already absolute URL
      if (path.match(/^https?:\/\//i) || path.startsWith('//')) {
        return false;
      }
      // Skip if data URI or special protocol
      if (path.match(/^(data:|mailto:|tel:|#|javascript:)/i)) {
        return false;
      }
      // Skip if it's just a fragment or query string
      if (path.startsWith('#') || path.startsWith('?')) {
        return false;
      }
      // Convert if:
      // 1. Starts with / and contains a dot (likely a file) OR is longer than 1 char
      // 2. Doesn't start with / but contains a dot and looks like a file path (has / or ends with file extension)
      const hasDot = path.includes('.');
      const looksLikeFile = hasDot && (path.includes('/') || /\.(css|js|jpg|jpeg|png|gif|svg|webp|ico|woff|woff2|ttf|eot|pdf|mp4|mp3|webm|ogg)$/i.test(path));
      
      if (path.startsWith('/')) {
        return hasDot || path.length > 1;
      }
      
      // Relative path (like css/design-guide.css)
      return looksLikeFile || (hasDot && path.length > 3);
    };
    
    const convertPath = (path) => {
      const trimmed = (path || '').trim();
      // Never prepend domain if already absolute (http/https or protocol-relative)
      if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('//')) return trimmed;
      // Ensure path starts with /
      const cleanPath = trimmed.startsWith('/') ? trimmed : ('/' + trimmed);
      // Concatenate baseUrl + path, ensuring no double slashes
      return baseUrl + cleanPath;
    };
    
    // Replace ALL url() functions in CSS
    // This handles: url('/path'), url("/path"), url(/path)
    processed = processed.replace(
      /url\s*\(\s*(['"]?)([^'")]+?)\1\s*\)/gi,
      (match, quote, path) => {
        // Trim whitespace from path
        const trimmedPath = path.trim();
        
        if (!shouldConvert(trimmedPath)) {
          return match;
        }
        
        // For CSS, we can add quotes for safety (CSS allows both quoted and unquoted)
        return `url("${convertPath(trimmedPath)}")`;
      }
    );
    
    // Handle image-set() CSS function
    processed = processed.replace(
      /image-set\s*\(\s*([^)]+?)\s*\)/gi,
      (match, imageSetValue) => {
        const converted = imageSetValue.replace(
          /url\s*\(\s*(['"]?)([^'")]+?)\1\s*\)/gi,
          (urlMatch, quote, path) => {
            const trimmedPath = path.trim();
            if (shouldConvert(trimmedPath)) {
              return `url("${convertPath(trimmedPath)}")`;
            }
            return urlMatch;
          }
        );
        return `image-set(${converted})`;
      }
    );
    
    // Universal catch-all: Replace any quoted string that looks like a file path
    // Matches paths starting with / OR relative paths (like css/file.css)
    processed = processed.replace(
      /(["'])((?:\/|[^"'\s/]+[\/])[^"']+?\.[^"']+?)\1/g,
      (match, quote, path) => {
        // Skip if we just converted this (contains our baseUrl)
        if (match.includes(baseUrl)) {
          return match;
        }
        
        if (!shouldConvert(path)) {
          return match;
        }
        
        return `${quote}${convertPath(path)}${quote}`;
      }
    );
    
    return processed;
  };

  const handleFetchUrl = async () => {
    if (!url.trim()) {
      setError('Please enter a URL');
      return;
    }

    setLoading(true);
    setError(null);
    setExtractedData(null);
    setCssExtracted(false);

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
      await extractCSS(rawHtml, extractedDomain);
    } catch (err) {
      setError(NOT_CRAWLABLE_MESSAGE);
    } finally {
      setLoading(false);
    }
  };

  const extractCSS = async (htmlContent = html, domainOverride = null) => {
    if (!htmlContent.trim()) {
      setError('Please provide HTML content');
      return;
    }

    setLoading(true);
    setError(null);
    setExtractedData(null);
    setCssExtracted(false);

    try {
      // Use provided domain override or state domain
      const domainToUse = domainOverride || mediaDomain;

      // Extract CSS using API
      const monkey = await initMonkey();
      const text = await monkey.apiCall('/api/settings/extract-css', { html: htmlContent });
      const data = JSON.parse(text);
      if (data.error) {
        if (/no CSS found/i.test(data.error)) {
          setError(NOT_CRAWLABLE_MESSAGE);
          return;
        }
        throw new Error(data.error || 'Failed to extract CSS');
      }

      if (data.links || data.inlineStyles) {
        // Process CSS with domain replacement if domain is provided
        const processedData = { ...data };
        
        if (domainToUse) {
          // Process inline styles
          if (processedData.inlineStyles) {
            processedData.inlineStyles = replaceRelativePaths(processedData.inlineStyles, domainToUse);
          }
          
          // Process CSS links (convert relative paths to absolute)
          if (processedData.links && Array.isArray(processedData.links)) {
            processedData.links = processedData.links.map(link => {
              const baseUrl = domainToUse.endsWith('/') ? domainToUse.slice(0, -1) : domainToUse;
              // Skip if already absolute (http/https)
              if (/^https?:\/\//i.test(link) || link.startsWith('//')) return link;
              // Path starting with / → baseUrl + path
              if (link.startsWith('/')) return baseUrl + link;
              // Path without / (e.g. css/design-guide.css) → baseUrl + / + path
              if (link.trim() && !link.startsWith('#')) return baseUrl + '/' + link;
              return link;
            });
          }
        }
        
        setExtractedData(processedData);
        setCssExtracted(true);
      }
      
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadCSS = () => {
    if (!extractedData) {
      setError('No CSS data to load');
      return;
    }

    // Call the parent component's onImport callback with the extracted data
    if (onImport) {
      onImport({
        links: extractedData.links || [],
        inlineStyles: extractedData.inlineStyles || ''
      });
    }

    // Close dialog first so parent shows updated CSS/links without full reload
    handleClose();
  };

  const handleClose = () => {
    setUrl('');
    setHtml('');
    setMediaDomain('');
    setExtractedData(null);
    setCssExtracted(false);
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Import CSS from Page</h2>
            <p className="text-sm text-gray-600 mt-1">
              Extract CSS files and inline styles from an example page
            </p>
          </div>
          <button
            type="button"
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
              <li>Provide a URL or paste HTML to extract CSS from</li>
              <li>CSS file URLs will be added to External CSS Links</li>
              <li>Inline styles will be added to the Custom CSS textarea</li>
              <li>You can review and save manually after import</li>
            </ul>
          </div>

          {/* Input Mode Toggle */}
          <div className="flex items-center gap-2 border-b border-gray-200">
            <button
              type="button"
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
              type="button"
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
                  All relative paths (in CSS url(), inline styles, srcset, etc.) will be converted to absolute URLs using this domain
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  HTML Content
                </label>
                <textarea
                  value={html}
                  onChange={(e) => handleHtmlChange(e.target.value)}
                  placeholder="<html>&#10;  <head>&#10;    <link rel=&quot;stylesheet&quot; href=&quot;styles.css&quot;>&#10;    <style>/* your styles */</style>&#10;  </head>&#10;  ...&#10;</html>"
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

          {/* Success Message with CSS Preview */}
          {cssExtracted && extractedData && (
            <div className="space-y-3">
              <div className="flex items-start gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-green-800">
                  <p className="font-medium">CSS extracted successfully!</p>
                  <ul className="mt-1 list-disc list-inside">
                    {extractedData.summary.linksCount > 0 && (
                      <li>{extractedData.summary.linksCount} CSS file link{extractedData.summary.linksCount > 1 ? 's' : ''} found</li>
                    )}
                    {extractedData.summary.inlineStylesLength > 0 && (
                      <li>{extractedData.summary.inlineStylesLength} characters of inline styles found</li>
                    )}
                  </ul>
                </div>
              </div>

              {/* CSS Links Preview */}
              {extractedData.links && extractedData.links.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    CSS File Links ({extractedData.links.length})
                  </label>
                  <div className="border border-gray-300 rounded-lg p-4 bg-gray-50 max-h-[150px] overflow-auto">
                    <ul className="text-sm space-y-1">
                      {extractedData.links.map((link, index) => (
                        <li key={index} className="font-mono text-xs break-all">
                          {link}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Inline Styles Preview */}
              {extractedData.inlineStyles && extractedData.inlineStyles.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Inline Styles Preview
                  </label>
                  <div className="border border-gray-300 rounded-lg p-4 bg-gray-50 max-h-[150px] overflow-auto">
                    <pre className="text-xs font-mono whitespace-pre-wrap">
                      {extractedData.inlineStyles.substring(0, 500)}
                      {extractedData.inlineStyles.length > 500 && '...'}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          {!cssExtracted ? (
            <button
              type="button"
              onClick={() => {
                if (inputMode === 'url') {
                  handleFetchUrl();
                } else {
                  extractCSS(html, mediaDomain);
                }
              }}
              disabled={loading || (inputMode === 'url' ? !url.trim() : !html.trim())}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              {loading ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  {inputMode === 'url' ? 'Fetching...' : 'Extracting...'}
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4" />
                  {inputMode === 'url' ? 'Fetch & Extract' : 'Extract CSS'}
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleLoadCSS}
              disabled={loading || !extractedData}
              className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              <Download className="w-4 h-4" />
              Load CSS into Editor
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

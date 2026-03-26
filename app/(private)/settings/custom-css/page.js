"use client";
import React, { useState, useEffect } from "react";
import { Save, Loader, ArrowLeft, AlertCircle, Plus, X, Download, Info } from "lucide-react";
import Link from "next/link";
import { initMonkey } from "@/libs/monkey";
import ImportCSSDialog from "./components/ImportCSSDialog";

const CSS_CLASS_REFERENCES_EXAMPLE = `## Colors
- \`text-orange\` — orange text (#ea8d28)
- \`text-blue\` — blue text (#3ca9d6)
- \`bg-orange\` / \`bg-blue\` — same colors as backgrounds

## Font Sizes
- \`font-small\` / \`font-large\` / \`font-larger\` — relative size steps
- \`h1\`–\`h5\`, \`p\` — default heading/paragraph sizes (no class needed)

## Text & Font Utilities
- \`text-left\`, \`text-center\`, \`text-right\` — alignment
- \`text-uppercase\`, \`text-capitalize\`, \`font-weight-bold\`, \`font-italic\`

## Lists
- \`list-style-numbers\`, \`list-style-bullets\`, \`list-style-circles\`, \`list-style-squares\`

## Spacing
- \`p-0\`–\`p-5\` — padding 0–25px; \`m-0\`–\`m-5\` — margin 0–25px

## Layout
- \`cutoff\` + \`cutoff-point\` — collapse long content with a read-more CTA
- \`horizontal-center\`, \`vertical-center\` — center children in container
- \`w-{n}\` / \`h-{n}\` — width/height as % of parent; \`w-{n}-px\` / \`h-{n}-px\` — fixed pixels

## Buttons
- \`btn-orange\`, \`btn-blue\` — styled CTA buttons
- \`btn-lg\` — large size; \`btn-full-width\` — full width; \`btn-outline-white\` — outline style`;

export default function CustomCSSSettings() {
  const [css, setCss] = useState('');
  const [cssLinks, setCssLinks] = useState(['']);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingLinks, setSavingLinks] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [linksSuccess, setLinksSuccess] = useState(false);
  const [sizeWarning, setSizeWarning] = useState(null);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [cssClassReferences, setCssClassReferences] = useState('');
  const [showExamplePopup, setShowExamplePopup] = useState(false);
  const [savingReferences, setSavingReferences] = useState(false);

  // Load existing CSS on mount
  useEffect(() => {
    loadCSS();
  }, []);

  const loadCSS = async () => {
    try {
      setLoading(true);
      setError(null);
      const monkey = await initMonkey(true);
      await monkey.initUser();

      if (!monkey.user?.id) {
        setLoading(false);
        return;
      }

      const profile = await monkey.read('profiles', [
        { operator: 'eq', args: ['id', monkey.user.id] }
      ]);

      if (profile && profile[0]?.json?.customizations) {
        const cust = profile[0].json.customizations;
        if (cust.css) {
          setCss(cust.css);
        }
        if (cust.external_css_links && Array.isArray(cust.external_css_links)) {
          const links = cust.external_css_links.filter(link => link && link.trim());
          setCssLinks(links.length > 0 ? links : ['']);
        }
        setCssClassReferences(cust?.css_class_references ?? '');
      }
    } catch (error) {
      setError('Failed to load custom CSS');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    // Check size limit (300 KB = 300 * 1024 bytes)
    const sizeInBytes = new Blob([css]).size;
    const sizeInKB = sizeInBytes / 1024;
    const maxSizeKB = 300;

    if (sizeInKB > maxSizeKB) {
      setError(`CSS is too large (${sizeInKB.toFixed(2)} KB). Maximum size is ${maxSizeKB} KB.`);
      setSizeWarning(null);
      return;
    }

    // Show warning if approaching limit
    if (sizeInKB > maxSizeKB * 0.8) {
      setSizeWarning(`Warning: CSS is ${sizeInKB.toFixed(2)} KB (${((sizeInKB / maxSizeKB) * 100).toFixed(0)}% of limit)`);
    } else {
      setSizeWarning(null);
    }

    setSaving(true);
    setError(null);
    setSuccess(false);
    setLinksSuccess(false);

    try {
      const validCssLinks = cssLinks.filter(link => link && link.trim());
      const monkey = await initMonkey(true);
      await monkey.saveCustomCss({
        css: css.trim(),
        external_css_links: validCssLinks,
        css_class_references: cssClassReferences.trim(),
      });
      setSuccess(true);
      setLinksSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setLinksSuccess(false);
      }, 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveLinks = async () => {
    // Check CSS size limit before saving
    const sizeInBytes = new Blob([css]).size;
    const sizeInKB = sizeInBytes / 1024;
    const maxSizeKB = 300;

    if (sizeInKB > maxSizeKB) {
      setError(`CSS is too large (${sizeInKB.toFixed(2)} KB). Maximum size is ${maxSizeKB} KB.`);
      setSizeWarning(null);
      return;
    }

    // Filter out empty CSS links
    const validCssLinks = cssLinks.filter(link => link && link.trim());

    setSavingLinks(true);
    setError(null);
    setLinksSuccess(false);
    setSuccess(false);

    try {
      const monkey = await initMonkey(true);
      await monkey.saveCustomCss({
        css: css.trim(),
        external_css_links: validCssLinks,
        css_class_references: cssClassReferences.trim(),
      });
      setLinksSuccess(true);
      setSuccess(true);
      setTimeout(() => {
        setLinksSuccess(false);
        setSuccess(false);
      }, 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingLinks(false);
    }
  };

  const handleSaveReferences = async () => {
    setSavingReferences(true);
    setError(null);
    setSuccess(false);
    try {
      const validCssLinks = cssLinks.filter(link => link && link.trim());
      const monkey = await initMonkey(true);
      await monkey.saveCustomCss({
        css: css.trim(),
        external_css_links: validCssLinks,
        css_class_references: cssClassReferences.trim(),
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingReferences(false);
    }
  };

  // Calculate size as user types
  const handleCssChange = (e) => {
    const newCss = e.target.value;
    setCss(newCss);
    
    const sizeInBytes = new Blob([newCss]).size;
    const sizeInKB = sizeInBytes / 1024;
    const maxSizeKB = 300;

    if (sizeInKB > maxSizeKB) {
      setSizeWarning(`CSS is too large (${sizeInKB.toFixed(2)} KB). Maximum size is ${maxSizeKB} KB.`);
    } else if (sizeInKB > maxSizeKB * 0.8) {
      setSizeWarning(`Warning: CSS is ${sizeInKB.toFixed(2)} KB (${((sizeInKB / maxSizeKB) * 100).toFixed(0)}% of limit)`);
    } else {
      setSizeWarning(null);
    }
  };

  const handleImportCSS = (data) => {
    // Replace all existing CSS links with imported links (do not append)
    if (data.links && Array.isArray(data.links)) {
      const filtered = data.links.filter(link => link && typeof link === 'string' && link.trim());
      setCssLinks(filtered.length > 0 ? filtered : ['']);
    } else {
      setCssLinks(['']);
    }

    // Replace all existing custom CSS with imported inline styles (do not append)
    const newCss = (data.inlineStyles && typeof data.inlineStyles === 'string')
      ? data.inlineStyles.trim()
      : '';
    setCss(newCss);

    // Update size warning after import
    const sizeInBytes = new Blob([newCss]).size;
    const sizeInKB = sizeInBytes / 1024;
    const maxSizeKB = 300;

    if (sizeInKB > maxSizeKB) {
      setSizeWarning(`CSS is too large (${sizeInKB.toFixed(2)} KB). Maximum size is ${maxSizeKB} KB.`);
    } else if (sizeInKB > maxSizeKB * 0.8) {
      setSizeWarning(`Warning: CSS is ${sizeInKB.toFixed(2)} KB (${((sizeInKB / maxSizeKB) * 100).toFixed(0)}% of limit)`);
    } else {
      setSizeWarning(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <Loader className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-4" />
          <p className="text-sm text-gray-600">Loading custom CSS...</p>
        </div>
      </div>
    );
  }

  const sizeInBytes = new Blob([css]).size;
  const sizeInKB = sizeInBytes / 1024;
  const maxSizeKB = 300;
  const sizePercent = (sizeInKB / maxSizeKB) * 100;

  return (
    <div className="max-w-6xl mx-auto py-8">
      {/* Back Link */}
      <Link
        href="/settings"
        className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Settings
      </Link>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Custom CSS</h1>
        <p className="text-sm text-gray-600">
          Add custom CSS styles that will be applied to your content. Maximum size: 300 KB.
        </p>
      </div>

      {/* CSS Links Section */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm mb-6">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">External CSS Links</h2>
            <p className="text-sm text-gray-600 mt-1">
              Add external CSS files that will be fetched, minified, and scoped to the editor.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowImportDialog(true)}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
            >
              <Download className="w-4 h-4" />
              Import from Page
            </button>
            <button
              onClick={handleSaveLinks}
              disabled={savingLinks}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              {savingLinks ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Links
                </>
              )}
            </button>
          </div>
        </div>
        <div className="p-6">
          <div className="space-y-3">
            {cssLinks.map((link, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  type="url"
                  value={link}
                  onChange={(e) => {
                    const newLinks = [...cssLinks];
                    newLinks[index] = e.target.value;
                    setCssLinks(newLinks);
                  }}
                  placeholder="https://example.com/styles.css"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
                {cssLinks.length > 1 && (
                  <button
                    onClick={() => {
                      const newLinks = cssLinks.filter((_, i) => i !== index);
                      setCssLinks(newLinks.length > 0 ? newLinks : ['']);
                    }}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Remove this CSS link"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={() => setCssLinks([...cssLinks, ''])}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add CSS Link
            </button>
          </div>
        </div>
        {/* Footer with success/error messages */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 space-y-2">
          {linksSuccess && (
            <div className="flex items-start gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5">✓</div>
              <p className="text-sm text-green-800">CSS links saved successfully!</p>
            </div>
          )}
        </div>
      </div>

      {/* CSS Editor */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        {/* Editor Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-gray-700">CSS Code</label>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>
                {sizeInKB.toFixed(2)} KB / {maxSizeKB} KB
              </span>
              <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    sizePercent > 100
                      ? 'bg-red-500'
                      : sizePercent > 80
                      ? 'bg-yellow-500'
                      : 'bg-blue-500'
                  }`}
                  style={{ width: `${Math.min(sizePercent, 100)}%` }}
                />
              </div>
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={saving || sizeInKB > maxSizeKB}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
          >
            {saving ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save CSS
              </>
            )}
          </button>
        </div>

        {/* Textarea */}
        <div className="p-6">
          <textarea
            value={css}
            onChange={handleCssChange}
            placeholder="/* Add your custom CSS here */&#10;&#10;.my-custom-class {&#10;  color: blue;&#10;}"
            className="w-full h-[600px] px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-mono resize-none"
            spellCheck={false}
          />
        </div>

        {/* Footer with warnings/errors */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 space-y-2">
          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}
          {success && (
            <div className="flex items-start gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5">✓</div>
              <p className="text-sm text-green-800">Custom CSS saved successfully!</p>
            </div>
          )}
          {sizeWarning && !error && (
            <div className={`flex items-start gap-2 p-3 rounded-lg ${
              sizeInKB > maxSizeKB
                ? 'bg-red-50 border border-red-200'
                : 'bg-yellow-50 border border-yellow-200'
            }`}>
              <AlertCircle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                sizeInKB > maxSizeKB ? 'text-red-600' : 'text-yellow-600'
              }`} />
              <p className={`text-sm ${
                sizeInKB > maxSizeKB ? 'text-red-800' : 'text-yellow-800'
              }`}>
                {sizeWarning}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* CSS Class References Section */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm mt-6">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">CSS Class References</h2>
            <p className="text-sm text-gray-600 mt-1">
              Providing an explanation of what each class does will be appended to the v0 prompt when custom templates are enabled, improving HTML accuracy.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowExamplePopup(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors border border-gray-300"
            >
              <Info className="w-4 h-4" />
              See example
            </button>
            <button
              onClick={handleSaveReferences}
              disabled={savingReferences}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              {savingReferences ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save
                </>
              )}
            </button>
          </div>
        </div>
        <div className="p-6">
          <textarea
            value={cssClassReferences}
            onChange={(e) => setCssClassReferences(e.target.value)}
            placeholder="## Colors&#10;- `text-orange` — orange text (#ea8d28)&#10;- `text-blue` — blue text (#3ca9d6)&#10;&#10;## Buttons&#10;- `btn-orange` — primary CTA button..."
            className="w-full h-[200px] px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-mono resize-none"
            spellCheck={false}
          />
        </div>
      </div>

      {/* Info Section */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="text-sm font-medium text-blue-900 mb-2">How it works</h3>
        <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
          <li>Your custom CSS will be applied globally to your content</li>
          <li>CSS is limited to 300 KB to ensure optimal performance</li>
          <li>Changes take effect immediately after saving</li>
          <li>Use CSS selectors to target specific elements in your content</li>
        </ul>
      </div>

      {/* Import CSS Dialog */}
      {showImportDialog && (
        <ImportCSSDialog
          isOpen={showImportDialog}
          onClose={() => setShowImportDialog(false)}
          onImport={handleImportCSS}
        />
      )}

      {/* CSS Class References Example Popup */}
      {showExamplePopup && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">CSS Class References Example</h2>
              <button
                type="button"
                onClick={() => setShowExamplePopup(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-6">
              <pre className="text-sm font-mono whitespace-pre-wrap text-gray-800 bg-gray-50 p-4 rounded-lg">
                {CSS_CLASS_REFERENCES_EXAMPLE}
              </pre>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
              <button
                type="button"
                onClick={() => setShowExamplePopup(false)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

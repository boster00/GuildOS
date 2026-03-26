"use client";
import React, { useState, useEffect } from "react";
import { X, Save } from "lucide-react";
import "@/app/(private)/content-magic/editor.css";

/**
 * TemplateEditPopup
 * 
 * Full-screen popup for editing template HTML
 * Shows HTML editor at top (250px height) and live preview at bottom
 */
export default function TemplateEditPopup({
  isOpen,
  onClose,
  template,
  onSave
}) {
  const [html, setHtml] = useState('');
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Initialize HTML and name when popup opens
  useEffect(() => {
    if (isOpen && template) {
      setHtml(template.html || '');
      setName(template.name || '');
      setError(null);
    }
  }, [isOpen, template]);

  const handleSave = async () => {
    if (!html.trim()) {
      setError('HTML cannot be empty');
      return;
    }

    if (!name.trim()) {
      setError('Template name cannot be empty');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const { initMonkey } = await import('@/libs/monkey');
      const monkey = await initMonkey();
      const text = await monkey.apiCall('/api/templates/save', {
        templateId: template.id,
        html: html.trim(),
        name: name.trim(),
        category: template.category,
        pageTypes: template.pageTypes,
        isUserCreated: template.isUserCreated
      });
      const data = JSON.parse(text);
      if (data.error) throw new Error(data.error || 'Failed to save template');
      if (onSave) {
        await onSave(data.template);
      }
      
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-white z-[100] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Edit Template</h2>
          <p className="text-sm text-gray-500 mt-1">
            ID: <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">{template?.id}</span>
            {template?.isCustom && <span className="ml-2 text-purple-600">(Custom)</span>}
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <X className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6 space-y-4">
        {/* Template Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Template Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            placeholder="Enter template name"
          />
          <p className="text-xs text-gray-500 mt-1">
            The display name for this template
          </p>
        </div>

        {/* HTML Editor */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Template HTML
          </label>
          <textarea
            value={html}
            onChange={(e) => setHtml(e.target.value)}
            className="w-full h-[250px] px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-mono resize-none"
            placeholder="<section>...</section>"
            spellCheck={false}
          />
          <p className="text-xs text-gray-500 mt-1">
            Edit the HTML code for this template
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !html.trim() || !name.trim()}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
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

        {/* Error Message */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Live Preview */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Live Preview
          </label>
          <div className="border border-gray-300 rounded-lg p-6 bg-white min-h-[300px]">
            <div 
              className="editorContent"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

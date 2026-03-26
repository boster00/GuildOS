"use client";
import React, { useState } from "react";
import { X, Plus } from "lucide-react";
import "@/app/(private)/content-magic/editor.css";

/**
 * CreateTemplateDialog
 * 
 * Dialog for creating a new custom template
 * Prompts for name, key, and HTML code
 */
export default function CreateTemplateDialog({
  isOpen,
  onClose,
  onComplete
}) {
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [html, setHtml] = useState('');
  const [category, setCategory] = useState('custom');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);

  // Auto-generate key from name
  const handleNameChange = (newName) => {
    // Calculate what the auto-generated key would be from the old name
    const oldAutoKey = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    // Auto-generate key if user hasn't manually edited it
    if (!key || key === oldAutoKey) {
      const autoKey = newName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      setKey(autoKey);
    }
    setName(newName);
  };

  const handleCreate = async () => {
    // Validation
    if (!name.trim()) {
      setError('Template name is required');
      return;
    }
    if (!key.trim()) {
      setError('Template key is required');
      return;
    }
    if (!/^[a-z0-9-]+$/.test(key)) {
      setError('Template key must contain only lowercase letters, numbers, and hyphens');
      return;
    }
    if (!html.trim()) {
      setError('HTML code is required');
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const { initMonkey } = await import('@/libs/monkey');
      const monkey = await initMonkey();
      const text = await monkey.apiCall('/api/templates/create', {
        id: key.trim(),
        name: name.trim(),
        html: html.trim(),
        category: category
      });
      const data = JSON.parse(text);
      if (data.error) throw new Error(data.error || 'Failed to create template');
      // Reset form
      setName('');
      setKey('');
      setHtml('');
      setCategory('custom');
      
      if (onComplete) {
        onComplete(data.template);
      }
      
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Create New Template</h2>
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
              Template Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="e.g., My Custom Hero Section"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          {/* Template Key */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Template Key <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="e.g., my-custom-hero"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-mono"
            />
            <p className="text-xs text-gray-500 mt-1">
              Unique identifier (lowercase letters, numbers, and hyphens only)
            </p>
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="custom">Custom</option>
              <option value="hero">Hero</option>
              <option value="features">Features</option>
              <option value="benefits">Benefits</option>
              <option value="testimonials">Testimonials</option>
              <option value="cta">Call to Action</option>
              <option value="pricing">Pricing</option>
              <option value="faq">FAQ</option>
              <option value="footer">Footer</option>
            </select>
          </div>

          {/* HTML Code */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              HTML Code <span className="text-red-500">*</span>
            </label>
            <textarea
              value={html}
              onChange={(e) => setHtml(e.target.value)}
              placeholder="<section>&#10;  <div>&#10;    Your HTML content here...&#10;  </div>&#10;</section>"
              className="w-full h-[300px] px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-mono resize-none"
              spellCheck={false}
            />
            <p className="text-xs text-gray-500 mt-1">
              If section wrapper is missing, it will be added automatically
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Preview */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Preview
            </label>
            <div className="border border-gray-300 rounded-lg p-6 bg-gray-50 min-h-[200px]">
              <div 
                className="editorContent"
                dangerouslySetInnerHTML={{ __html: html }}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            disabled={creating}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={creating || !name.trim() || !key.trim() || !html.trim()}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
          >
            {creating ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Creating...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Create Template
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";
import React, { useState, useEffect } from "react";
import { X, ArrowUp, ArrowDown, Loader, Save } from "lucide-react";
import { initMonkey } from "@/libs/monkey";

/**
 * ReorderTemplatesDialog
 * 
 * Dialog for reordering custom templates
 * Shows only custom templates with move up/down buttons
 */
export default function ReorderTemplatesDialog({
  isOpen,
  onClose,
  onSave
}) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Load custom templates on mount
  useEffect(() => {
    if (isOpen) {
      loadCustomTemplates();
    }
  }, [isOpen]);

  const loadCustomTemplates = async () => {
    try {
      setLoading(true);
      setError(null);

      const monkey = await initMonkey();
      const text = await monkey.apiGet('/api/templates/list-custom');
      const data = JSON.parse(text);
      if (data.error) throw new Error(data.error || 'Failed to load templates');
      setTemplates(data.templates || []);
    } catch (err) {

      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleMoveUp = (index) => {
    if (index === 0) return; // Can't move first item up
    
    const newTemplates = [...templates];
    const temp = newTemplates[index];
    newTemplates[index] = newTemplates[index - 1];
    newTemplates[index - 1] = temp;
    setTemplates(newTemplates);
  };

  const handleMoveDown = (index) => {
    if (index === templates.length - 1) return; // Can't move last item down
    
    const newTemplates = [...templates];
    const temp = newTemplates[index];
    newTemplates[index] = newTemplates[index + 1];
    newTemplates[index + 1] = temp;
    setTemplates(newTemplates);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      
      // Send the new order to the API
      const monkey = await initMonkey();
      const text = await monkey.apiCall('/api/templates/reorder', { templateIds: templates.map(t => t.id) });
      const data = JSON.parse(text);
      if (data.error) throw new Error(data.error || 'Failed to save order');
      
      // Call onSave callback which will reload the page
      if (onSave) {
        onSave();
      }
      
      onClose();
    } catch (err) {

      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (!saving) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Reorder Custom Templates</h2>
            <p className="text-sm text-gray-600 mt-1">
              Use the arrows to change the display order of your custom templates
            </p>
          </div>
          <button
            onClick={handleClose}
            disabled={saving}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <Loader className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-4" />
                <p className="text-sm text-gray-600">Loading templates...</p>
              </div>
            </div>
          ) : error ? (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 text-sm">No custom templates found</p>
              <p className="text-gray-400 text-xs mt-2">
                Create or import custom templates to reorder them
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {templates.map((template, index) => (
                <div
                  key={template.id}
                  className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                >
                  {/* Template Info */}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 truncate">
                      {template.name}
                    </div>
                    <div className="text-xs text-gray-500 font-mono truncate mt-0.5">
                      {template.id}
                    </div>
                  </div>

                  {/* Move Buttons */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleMoveUp(index)}
                      disabled={index === 0 || saving}
                      className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Move up"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleMoveDown(index)}
                      disabled={index === templates.length - 1 || saving}
                      className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Move down"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={handleClose}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading || templates.length === 0}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
          >
            {saving ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Order
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

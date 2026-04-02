"use client";

import React, { useState } from "react";
import { X } from "lucide-react";
import { initMonkey } from "@/libs/monkey";
import ShowTemplates from "@/libs/monkey/components/ShowTemplates";

export default function ComponentPickerModal({ 
  isOpen, 
  onClose, 
  onInsert, 
  focusedSectionElement 
}) {
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  const handleTemplateSelect = (template) => {
    setSelectedTemplate(template);
  };

  const handleInsert = async () => {
    if (!selectedTemplate) {
      return;
    }

    try {
      const monkey = await initMonkey();
      const insertedElement = monkey.insertComponent(
        focusedSectionElement, 
        selectedTemplate.html || selectedTemplate.template, 
        'after'
      );
      if (onInsert) {
        onInsert(insertedElement);
      }
      
      setSelectedTemplate(null);
      onClose();
    } catch (err) {
      alert(`Failed to insert component: ${err.message}`);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Insert Component</h2>
            <p className="text-sm text-gray-600 mt-0.5">
              Choose a pre-built section to add to your page
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

        {/* Template List */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <ShowTemplates
            onTemplateClick={handleTemplateSelect}
            selectedTemplateId={selectedTemplate?.id || null}
          />
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
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
                onClose();
              }}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleInsert}
              disabled={!selectedTemplate}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              Insert Component
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { X, ChevronRight } from "lucide-react";

interface Section {
  key: string;
  title: string;
  level: number;
  position: number;
}

interface SectionInsertionModalProps {
  sections: Section[];
  ideaText: string;
  onInsert: (afterSectionKey: string | null) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

/**
 * Section Insertion Modal Component
 * Shows a list of article sections (headers) and allows selecting where to insert a new section
 * 
 * This is a reusable component for inserting sections into articles with section-based structure.
 * Used by ResearchInsightsPanel and other components that need to insert content at specific positions.
 */
export default function SectionInsertionModal({
  sections,
  ideaText,
  onInsert,
  onCancel,
  isLoading = false,
}: SectionInsertionModalProps) {
  const [selectedSectionKey, setSelectedSectionKey] = useState<string | null>(null);

  const handleInsert = async () => {
    await onInsert(selectedSectionKey);
  };

  // Get display text for section level (h1, h2, etc.)
  const getLevelLabel = (level: number) => {
    return `H${level}`;
  };

  // Get indent style based on level
  const getIndentStyle = (level: number) => {
    return {
      paddingLeft: `${(level - 1) * 1.5}rem`,
    };
  };

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold">Insert Section</h3>
          <button
            onClick={onCancel}
            className="btn btn-sm btn-ghost btn-circle"
            disabled={isLoading}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Idea Preview */}
        <div className="mb-6 p-4 bg-base-200 rounded-lg">
          <p className="text-sm font-semibold mb-2">Section to insert:</p>
          <p className="text-sm text-base-content/80">{ideaText}</p>
        </div>

        {/* Instructions */}
        <div className="mb-4">
          <p className="text-sm text-base-content/70">
            Select where to insert this section. The section will be added after the selected section, or at the beginning if "At the beginning" is selected.
          </p>
        </div>

        {/* Section List */}
        <div className="max-h-96 overflow-y-auto mb-4 border border-base-300 rounded-lg">
          {sections.length === 0 ? (
            <div className="p-8 text-center text-base-content/60">
              <p className="text-sm">No sections found in the article.</p>
              <p className="text-xs mt-2">The section will be added at the end.</p>
            </div>
          ) : (
            <div className="space-y-1 p-2">
              {/* Option: Insert at beginning */}
              <button
                onClick={() => setSelectedSectionKey(null)}
                className={`w-full text-left p-3 rounded-lg transition-colors flex items-center gap-2 ${
                  selectedSectionKey === null
                    ? "bg-primary text-primary-content"
                    : "bg-base-100 hover:bg-base-200"
                }`}
                disabled={isLoading}
              >
                <ChevronRight className="w-4 h-4" />
                <span className="text-sm font-medium">At the beginning</span>
              </button>

              {/* Section options */}
              {sections.map((section) => (
                <button
                  key={section.key}
                  onClick={() => setSelectedSectionKey(section.key)}
                  className={`w-full text-left p-3 rounded-lg transition-colors flex items-center gap-2 ${
                    selectedSectionKey === section.key
                      ? "bg-primary text-primary-content"
                      : "bg-base-100 hover:bg-base-200"
                  }`}
                  style={getIndentStyle(section.level)}
                  disabled={isLoading}
                >
                  <ChevronRight className="w-4 h-4" />
                  <span className="text-xs font-mono text-base-content/60 mr-2">
                    {getLevelLabel(section.level)}
                  </span>
                  <span className="text-sm font-medium flex-1">{section.title}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="btn btn-outline"
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            onClick={handleInsert}
            className="btn btn-primary"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <span className="loading loading-spinner loading-sm"></span>
                Inserting...
              </>
            ) : (
              "Insert Section"
            )}
          </button>
        </div>
      </div>
      <div className="modal-backdrop" onClick={onCancel}></div>
    </div>
  );
}
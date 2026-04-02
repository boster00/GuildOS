"use client";
import { useState, useEffect } from "react";

export default function SectionPreview({ section, onClose, onInsert, onFormatChange, onPromptEdit }) {
  const [selectedFormat, setSelectedFormat] = useState(section?.format || "paragraph");
  const [isChangingFormat, setIsChangingFormat] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [editedPrompt, setEditedPrompt] = useState(
    section?.prompt?.contentPrompt || ""
  );

  // Update edited prompt when section changes
  useEffect(() => {
    if (section?.prompt?.contentPrompt) {
      setEditedPrompt(section.prompt.contentPrompt);
    }
    if (section?.format) {
      setSelectedFormat(section.format);
    }
  }, [section]);

  if (!section) return null;

  const handleFormatChange = async (newFormat) => {
    if (newFormat === selectedFormat) return;
    
    setIsChangingFormat(true);
    setIsGenerating(true);
    setSelectedFormat(newFormat);
    
    if (onFormatChange) {
      // Pass the edited prompt to the format change handler
      await onFormatChange(newFormat, editedPrompt);
    }
    
    setIsChangingFormat(false);
    setIsGenerating(false);
  };

  const handlePromptEdit = (newPrompt) => {
    setEditedPrompt(newPrompt);
    if (onPromptEdit) {
      onPromptEdit(newPrompt);
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    if (onFormatChange) {
      await onFormatChange(selectedFormat, editedPrompt);
    }
    setIsGenerating(false);
  };

  const formatOptions = [
    { value: "paragraph", label: "📝 Paragraph", icon: "📝" },
    { value: "paragraph_picture", label: "🖼️ Paragraph + Picture", icon: "🖼️" },
    { value: "cards", label: "🃏 Cards", icon: "🃏" },
    { value: "table", label: "📊 Table", icon: "📊" },
    { value: "list", label: "📋 List/Steps", icon: "📋" },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="card bg-base-100 shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="card-body p-6 flex flex-col flex-1 overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <h3 className="card-title text-lg">Preview New Section</h3>
            <button onClick={onClose} className="btn btn-sm btn-circle btn-ghost">
              ✕
            </button>
          </div>

          {/* Section Metadata */}
          <div className="bg-base-200 p-3 rounded-lg mb-4 text-sm">
            <p><strong>Category:</strong> {section.category}</p>
            <p><strong>Idea:</strong> {section.idea}</p>
            <p className="text-xs text-base-content/60 mt-1">
              <strong>Sources:</strong> {section.sources?.map(url => new URL(url).hostname).join(", ")}
            </p>
          </div>

          {/* Content Prompt Editor */}
          <div className="mb-4">
            <label className="label">
              <span className="label-text font-semibold">Content Prompt</span>
              <span className="label-text-alt">Edit the prompt to refine the generated content</span>
            </label>
            <textarea
              className="textarea textarea-bordered w-full min-h-[100px] font-mono text-sm"
              value={editedPrompt}
              onChange={(e) => handlePromptEdit(e.target.value)}
              placeholder="Enter the prompt that will generate the section content..."
            />
          </div>

          {/* Format Selector */}
          <div className="mb-4">
            <label className="label">
              <span className="label-text font-semibold">Format</span>
            </label>
            <div className="flex gap-2 flex-wrap">
              {formatOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleFormatChange(option.value)}
                  disabled={isChangingFormat || isGenerating}
                  className={`btn btn-sm ${
                    selectedFormat === option.value ? "btn-primary" : "btn-outline"
                  } ${isChangingFormat || isGenerating ? "loading" : ""}`}
                >
                  {!isChangingFormat && !isGenerating && option.icon} {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Scrollable Content Area */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {/* HTML Preview */}
            {section.html ? (
              <div className="border border-base-300 rounded-lg p-4 mb-4 bg-white">
                <div dangerouslySetInnerHTML={{ __html: section.html }} />
              </div>
            ) : (
              <div className="border border-base-300 rounded-lg p-8 text-center mb-4 bg-base-50">
                <p className="text-base-content/60">
                  {isGenerating ? "Generating content..." : "Select a format to generate content"}
                </p>
              </div>
            )}

            {/* Generate Button (if no content yet) */}
            {!section.html && !isGenerating && (
              <button 
                onClick={handleGenerate}
                className="btn btn-primary w-full mb-4"
              >
                Generate Content
              </button>
            )}
          </div>

          {/* Action Buttons - Always visible at bottom */}
          <div className="flex gap-2 justify-end pt-4 border-t border-base-300 mt-auto">
            <button onClick={onClose} className="btn btn-ghost">
              Cancel
            </button>
            {section.html ? (
              <button 
                onClick={() => {
                  if (onInsert) {
                    onInsert();
                  }
                  onClose();
                }} 
                className="btn btn-primary"
              >
                Insert Section at End
              </button>
            ) : (
              <button 
                className="btn btn-primary"
                disabled
              >
                Insert Section at End
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

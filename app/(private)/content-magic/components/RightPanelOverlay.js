"use client";
import React from "react";
import { X, Loader2 } from "lucide-react";
import TutorialLink from "./TutorialLink";

export default function RightPanelOverlay({ title, description, tutorialURL, tutorialTitle, onClose, children, isSaving = false }) {
  return (
    <div className="fixed right-0 top-0 bottom-0 w-80 bg-white border-l border-gray-200 shadow-xl flex flex-col z-[60]">
      {/* Header - single source: rule.meta.label + optional rule.meta.description + optional tutorial */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 flex-shrink-0 bg-gray-50">
        <div className="min-w-0 flex-1 pr-2">
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          {description && (
            <p className="text-xs text-gray-600 mt-0.5">{description}</p>
          )}
          {tutorialURL && (
            <div className="mt-1">
              <TutorialLink tutorialURL={tutorialURL} tutorialTitle={tutorialTitle} size="sm" />
            </div>
          )}
        </div>
        <button
          onClick={onClose}
          disabled={isSaving}
          className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
          title={isSaving ? "Saving..." : "Close"}
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-xs font-medium">Saving...</span>
            </>
          ) : (
            <X className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  );
}


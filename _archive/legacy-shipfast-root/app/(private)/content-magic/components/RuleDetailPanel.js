"use client";
import React, { useState, useRef } from "react";
import { X, Loader2 } from "lucide-react";
import TutorialLink from "./TutorialLink";
import { useWritingGuide } from "@/libs/content-magic/context/WritingGuideContext";
import RightPanelOverlay from "./RightPanelOverlay";
import { initMonkey } from "@/libs/monkey";

export default function RuleDetailPanel({ rule, onClose }) {
  const { article, updateArticle } = useWritingGuide();
  const [isSaving, setIsSaving] = useState(false);
  const getPendingUpdatesRef = useRef(null);

  const DetailedUI = rule.components.DetailedUI ?? rule.components.Detail;
  const displayMode = rule.DetailsUIDisplayMode || "fullscreen";

  if (!DetailedUI) {
    return (
      <RightPanelOverlay title={rule.meta?.label} description={rule.meta?.description} onClose={onClose} isSaving={false}>
        <p className="text-gray-600">This rule has no detail view.</p>
      </RightPanelOverlay>
    );
  }

  // Save and close - unified function for both Save and Close buttons.
  // Optional assetUpdates: when provided (e.g. from rule Save button), save that patch then close.
  // When not provided (e.g. header Close), use getPendingUpdates from the rule so Close also saves current state.
  // Do NOT fall back to full article.assets: that can overwrite recently saved fields (e.g. main_keyword)
  // with stale state when the rule already saved and then calls onUpdate().
  const saveAndClose = async (assetUpdates) => {
    setIsSaving(true);
    try {
      let patch = assetUpdates;
      if (patch === undefined && typeof getPendingUpdatesRef.current === "function") {
        const pending = await Promise.resolve(getPendingUpdatesRef.current());
        if (pending && typeof pending === "object" && Object.keys(pending).length > 0) {
          patch = pending;
        }
      }
      if (article?.id && patch && Object.keys(patch).length > 0) {
        const monkey = await initMonkey();
        await monkey.articleAssets.savePatch(
          article.id,
          patch,
          article.assets || {},
          updateArticle
        );
      }
    } catch (err) {

      // Continue with close even if save fails (non-blocking)
    } finally {
      setIsSaving(false);
      onClose();
    }
  };

  const registerGetPendingUpdates = (fn) => {
    getPendingUpdatesRef.current = fn;
  };

  // Fullscreen modal (default) - full screen overlay without backdrop
  if (displayMode === "fullscreen") {
    return (
      <div className="fixed inset-0 bg-white z-[60] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 z-10">
          <div className="flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{rule.meta.label}</h3>
              <p className="text-sm text-gray-600 mt-0.5">{rule.meta.description}</p>
              {rule.meta?.tutorialURL && (
                <div className="mt-1">
                  <TutorialLink tutorialURL={rule.meta.tutorialURL} tutorialTitle={rule.meta.tutorialTitle} />
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => saveAndClose()}
              disabled={isSaving}
              className="p-4 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              title={isSaving ? "Saving..." : "Close"}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-8 h-8 animate-spin" />
                  <span className="text-sm font-medium">Saving...</span>
                </>
              ) : (
                <X className="w-8 h-8" />
              )}
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-7xl mx-auto">
          <DetailedUI
            rule={rule}
            context={article}
            onUpdate={saveAndClose}
            onRegisterCloseHandler={registerGetPendingUpdates}
            isSaving={isSaving}
          />
        </div>
      </div>
    );
  }

  // Right side panel (overlays Writing Guide)
  if (displayMode === "rightside") {
    return (
      <RightPanelOverlay title={rule.meta.label} description={rule.meta.description} tutorialURL={rule.meta?.tutorialURL} tutorialTitle={rule.meta?.tutorialTitle} onClose={() => saveAndClose()} isSaving={isSaving}>
        <DetailedUI
          rule={rule}
          context={article}
          onUpdate={saveAndClose}
          onRegisterCloseHandler={registerGetPendingUpdates}
          isSaving={isSaving}
        />
      </RightPanelOverlay>
    );
  }

  // Left side panel (for AI assistant area - not used yet)
  if (displayMode === "leftside") {
    return (
      <div className="fixed inset-0 z-[60] pointer-events-none">
        {/* Backdrop */}
        <div 
          className="fixed inset-0 bg-black bg-opacity-30 pointer-events-auto"
          onClick={isSaving ? undefined : () => saveAndClose()}
          style={{ cursor: isSaving ? 'not-allowed' : 'pointer' }}
        />
        {/* Left Panel */}
        <div className="fixed left-0 top-0 bottom-0 w-[600px] max-w-[90vw] bg-white shadow-2xl flex flex-col pointer-events-auto">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{rule.meta.label}</h3>
              <p className="text-sm text-gray-600 mt-0.5">{rule.meta.description}</p>
              {rule.meta?.tutorialURL && (
                <div className="mt-1">
                  <TutorialLink tutorialURL={rule.meta.tutorialURL} tutorialTitle={rule.meta.tutorialTitle} />
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => saveAndClose()}
              disabled={isSaving}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              title={isSaving ? "Saving..." : "Close"}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-xs font-medium">Saving...</span>
                </>
              ) : (
                <X className="w-5 h-5" />
              )}
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <DetailedUI
              rule={rule}
              context={article}
              onUpdate={saveAndClose}
              onRegisterCloseHandler={registerGetPendingUpdates}
              isSaving={isSaving}
            />
          </div>
        </div>
      </div>
    );
  }

  // Split layout (full-width title bar + left sidebar + right content panel)
  if (displayMode === "split") {
    return (
      <div className="fixed inset-0 bg-white z-[60] flex flex-col overflow-hidden">
        {/* Header - Full width title bar */}
        <div className="border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center justify-between px-6 py-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{rule.meta.label}</h3>
              <p className="text-sm text-gray-600 mt-0.5">{rule.meta.description}</p>
              {rule.meta?.tutorialURL && (
                <div className="mt-1">
                  <TutorialLink tutorialURL={rule.meta.tutorialURL} tutorialTitle={rule.meta.tutorialTitle} />
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => saveAndClose()}
              disabled={isSaving}
              className="p-4 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              title={isSaving ? "Saving..." : "Close"}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-8 h-8 animate-spin" />
                  <span className="text-sm font-medium">Saving...</span>
                </>
              ) : (
                <X className="w-8 h-8" />
              )}
            </button>
          </div>
        </div>

        {/* Content - Split layout handled by DetailedUI */}
        <div className="flex-1 overflow-hidden">
          <DetailedUI
            rule={rule}
            context={article}
            onUpdate={saveAndClose}
            onRegisterCloseHandler={registerGetPendingUpdates}
            isSaving={isSaving}
          />
        </div>
      </div>
    );
  }

  // Fallback to fullscreen
  return null;
}
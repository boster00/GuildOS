"use client";
import React, { useState } from "react";
import { X } from "lucide-react";
import { useWritingGuide } from "@/libs/content-magic/context/WritingGuideContext";

export default function ContentMagicGuideAssets() {
  const { article } = useWritingGuide();
  const [showModal, setShowModal] = useState(false);
  const [selectedAssetType, setSelectedAssetType] = useState(null);

  const assets = article?.assets || {};
  const hasAssets = Object.keys(assets).length > 0;

  const handleOpenModal = (assetKey) => {
    setShowModal(true);
    setSelectedAssetType(assetKey);
  };

  const getAssetDisplayName = (key) => {
    return key.replace(/_/g, " ");
  };

  return (
    <>
      {/* Collapsed UI - No Assets */}
      {!hasAssets && (
        <p className="text-xs text-gray-600 px-4 py-2">
          <span className="font-semibold">Assets:</span> No assets yet. Follow the guide below to create assets.
        </p>
      )}

      {/* Collapsed UI - With Assets */}
      {hasAssets && (
        <div className="px-4 py-1 space-y-1">
          <p className="text-xs font-semibold text-gray-900">Assets:</p>
          <div className="flex flex-wrap gap-1">
            {/* {Object.keys(assets).slice(0, 10).map((assetKey) => (
              <button
                key={assetKey}
                onClick={() => handleOpenModal(assetKey)}
                className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded border border-blue-200 transition-colors text-xs font-medium whitespace-nowrap"
              >
                {getAssetDisplayName(assetKey)}
                {Array.isArray(assets[assetKey]) && (
                  <span className="ml-1 text-xs bg-blue-200 text-blue-800 px-1.5 py-0.5 rounded-full inline-block">
                    {assets[assetKey].length}
                  </span>
                )}
              </button>
            ))} */}
            {Object.keys(assets).length > 10 && (
              <button
                onClick={() => {
                  setShowModal(true);
                  setSelectedAssetType(Object.keys(assets)[0]);
                }}
                className="px-2 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded border border-gray-300 transition-colors text-xs font-medium whitespace-nowrap"
              >
                View all assets →
              </button>
            )}
          </div>
        </div>
      )}

      {/* Assets Modal */}
      {showModal && hasAssets && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl h-96 flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Generated Assets</h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex flex-1 overflow-hidden">
              {/* Left Nav Pane - Asset Types */}
              <div className="w-48 border-r border-gray-200 overflow-y-auto bg-gray-50">
                <div className="p-3 space-y-2">
                  {Object.keys(assets).map((assetKey) => (
                    <button
                      key={assetKey}
                      onClick={() => setSelectedAssetType(assetKey)}
                      className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                        selectedAssetType === assetKey
                          ? "bg-blue-600 text-white font-medium"
                          : "text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      <div className="font-medium">{getAssetDisplayName(assetKey)}</div>
                      <div className="text-xs mt-0.5">
                        {Array.isArray(assets[assetKey]) ? `${assets[assetKey].length} items` : "1 item"}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Right Detail Pane - JSON Display */}
              <div className="flex-1 overflow-y-auto p-6 bg-white">
                {selectedAssetType ? (
                  <div className="space-y-3">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 capitalize mb-1">
                        {getAssetDisplayName(selectedAssetType)}
                      </h3>
                      <p className="text-xs text-gray-600">
                        {Array.isArray(assets[selectedAssetType])
                          ? `${assets[selectedAssetType].length} items`
                          : "1 item"}
                      </p>
                    </div>
                    <pre className="text-xs bg-gray-50 border border-gray-200 rounded p-4 overflow-x-auto font-mono text-gray-700 whitespace-pre-wrap break-words max-h-72">
                      {JSON.stringify(
                        // Simplify keywords and prompts for preview (reduce bloat)
                        selectedAssetType === 'keywords' && Array.isArray(assets[selectedAssetType])
                          ? assets[selectedAssetType]
                              .filter(kw => kw.included !== false)
                              .map(kw => typeof kw === 'string' ? kw : (kw.keyword_text || kw.keyword || kw.label || String(kw)))
                              .filter(k => k && k.trim())
                          : selectedAssetType === 'prompts' && Array.isArray(assets[selectedAssetType])
                          ? assets[selectedAssetType]
                              .map(p => typeof p === 'string' ? p : (p.text || p.prompt || String(p)))
                              .filter(p => p && p.trim())
                          : assets[selectedAssetType],
                        null,
                        2
                      )}
                    </pre>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    Select an asset type to view details
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
/**
 * CustomCssModeModal Component
 *
 * Shown when the user tries to enable Custom CSS Mode but has not configured
 * custom styles in Settings. Offers navigation to Custom CSS Settings.
 *
 * @component
 */
"use client";
import React from "react";
import { X, Palette } from "lucide-react";
import { useRouter } from "next/navigation";

export default function CustomCssModeModal({ onClose }) {
  const router = useRouter();

  const handleGoToSettings = () => {
    onClose();
    router.push("/settings/custom-css");
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 z-[200] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-2xl max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-gray-800 text-white px-6 py-4 flex items-center justify-between rounded-t-lg">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Palette className="w-5 h-5" />
            Custom CSS Not Configured
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-gray-700 rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6">
          <p className="text-gray-700">
            Set up your custom styles in Settings before enabling Custom CSS Mode.
          </p>
        </div>

        {/* Modal Footer */}
        <div className="bg-gray-100 px-6 py-3 flex justify-end gap-3 rounded-b-lg border-t border-gray-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400 transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleGoToSettings}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors font-medium"
          >
            Go to Custom CSS Settings
          </button>
        </div>
      </div>
    </div>
  );
}

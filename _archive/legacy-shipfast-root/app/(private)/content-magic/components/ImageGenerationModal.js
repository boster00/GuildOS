"use client";
import React, { useState, useRef, useEffect } from "react";
import { X, Loader, Image as ImageIcon, Check, FolderOpen } from "lucide-react";
import ImageBrowser from "./ImageBrowser";
import { initMonkey } from "@/libs/monkey";
import CreditCostBadge from "@/components/CreditCostBadge";

export default function ImageGenerationModal({ editorRef, onClose, onImageReplace, showImageBrowser = false }) {
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState(null);
  const [error, setError] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [showBrowser, setShowBrowser] = useState(showImageBrowser);

  // Handle escape key to close modal
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Find selected image in editor on mount
  useEffect(() => {
    if (!editorRef?.current) return;

    const editor = editorRef.current;
    const selection = window.getSelection();
    
    // Check if there's a selected img element in the editor (from AI assistant selection)
    const images = editor.querySelectorAll('img');
    images.forEach(img => {
      if (img.classList.contains('selected') || img.classList.contains('is-selected')) {
        setSelectedImage(img);
        return;
      }
    });
    
    // Also check if cursor is inside or next to an img element
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      let node = range.commonAncestorContainer;
      
      // Find the closest img element
      while (node && node !== editor) {
        if (node.nodeType === 1 && node.tagName === 'IMG') {
          setSelectedImage(node);
          break;
        }
        node = node.parentNode;
      }
      
      // Check if the range is immediately before or after an img
      if (!selectedImage) {
        const startContainer = range.startContainer;
        const startOffset = range.startOffset;
        
        // Check if next sibling is an img
        if (startContainer.nodeType === 3 && startContainer.nextSibling && startContainer.nextSibling.tagName === 'IMG') {
          setSelectedImage(startContainer.nextSibling);
        }
        // Check if previous sibling is an img
        else if (startContainer.nodeType === 3 && startContainer.previousSibling && startContainer.previousSibling.tagName === 'IMG') {
          setSelectedImage(startContainer.previousSibling);
        }
        // Check if parent's next/previous sibling is an img
        else if (startContainer.parentNode) {
          const parent = startContainer.parentNode;
          if (parent.nextSibling && parent.nextSibling.tagName === 'IMG') {
            setSelectedImage(parent.nextSibling);
          } else if (parent.previousSibling && parent.previousSibling.tagName === 'IMG') {
            setSelectedImage(parent.previousSibling);
          }
        }
      }
    }
  }, [editorRef]);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError("Please enter a prompt");
      return;
    }

    setGenerating(true);
    setError(null);
    setGeneratedImages([]);
    setSelectedImageIndex(null);

    try {
      const monkey = await initMonkey();
      const text = await monkey.apiCall("/api/content-magic/generate-image", { prompt: prompt.trim() });
      const data = JSON.parse(text);
      if (data.images && data.images.length > 0) {
        setGeneratedImages(data.images);
      } else {
        throw new Error("No images generated");
      }
    } catch (err) {
      setError(err.message || "Failed to generate images");
    } finally {
      setGenerating(false);
    }
  };

  const handleSelectImage = (index) => {
    setSelectedImageIndex(index);
  };

  const handleReplace = async () => {
    if (selectedImageIndex !== null && generatedImages[selectedImageIndex]) {
      const imageUrl = generatedImages[selectedImageIndex].url;
      const promptText = prompt.trim();
      
      try {
        const monkey = await initMonkey();
        await monkey.apiCall("/api/content-magic/save-generated-image", {
          imageUrl,
          prompt: promptText,
          title: `AI Generated: ${promptText.substring(0, 50)}`,
          alt: promptText,
        });
      } catch (err) {
      }
      onImageReplace(imageUrl, selectedImage);
    }
  };

  const handleInsertNew = async () => {
    if (selectedImageIndex !== null && generatedImages[selectedImageIndex]) {
      const imageUrl = generatedImages[selectedImageIndex].url;
      const promptText = prompt.trim();
      
      try {
        const monkey = await initMonkey();
        await monkey.apiCall("/api/content-magic/save-generated-image", {
          imageUrl,
          prompt: promptText,
          title: `AI Generated: ${promptText.substring(0, 50)}`,
          alt: promptText,
        });
      } catch (err) {
      }
      onImageReplace(imageUrl, null);
    }
  };

  const handleBrowserSelect = (image) => {
    onImageReplace(image.src, selectedImage);
  };

  if (showBrowser) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
        <ImageBrowser
          onSelectImage={handleBrowserSelect}
          onClose={() => {
            setShowBrowser(false);
            if (!showImageBrowser) {
              onClose();
            }
          }}
          showGenerateButton={false}
        />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-semibold">Generate Image with AI</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Selected Image Info */}
          {selectedImage && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded">
              <p className="text-sm text-blue-800">
                <strong>Selected image:</strong> This image will be replaced with the generated image.
              </p>
            </div>
          )}

          {/* Prompt Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Image Prompt
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the image you want to generate..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows={3}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.ctrlKey) {
                  handleGenerate();
                }
              }}
            />
            <p className="mt-1 text-xs text-gray-500">
              Press Ctrl+Enter to generate
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-800 text-sm">
              {error}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setShowBrowser(true)}
              className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors flex items-center justify-center gap-2"
            >
              <FolderOpen className="w-4 h-4" />
              Browse Existing Images
            </button>
            <button
              onClick={handleGenerate}
              disabled={generating || !prompt.trim()}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {generating ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <ImageIcon className="w-4 h-4" />
                  Generate Image
                  <CreditCostBadge path="/api/content-magic/generate-image" size="sm" />
                </>
              )}
            </button>
          </div>

          {/* Generated Images */}
          {generatedImages.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-medium text-gray-700 mb-3">
                Select an image:
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {generatedImages.map((image, index) => (
                  <div
                    key={index}
                    className={`relative border-2 rounded-lg overflow-hidden cursor-pointer transition-all ${
                      selectedImageIndex === index
                        ? "border-blue-500 ring-2 ring-blue-200"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                    onClick={() => handleSelectImage(index)}
                  >
                    <img
                      src={image.url}
                      alt={`Generated image ${index + 1}`}
                      className="w-full h-auto"
                    />
                    {selectedImageIndex === index && (
                      <div className="absolute top-2 right-2 bg-blue-500 text-white rounded-full p-1">
                        <Check className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t p-4 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          {generatedImages.length > 0 && selectedImageIndex !== null && (
            <>
              {selectedImage && (
                <button
                  onClick={handleReplace}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  Replace Selected Image
                </button>
              )}
              <button
                onClick={async () => {
                  await handleInsertNew();
                }}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
              >
                Insert New Image
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

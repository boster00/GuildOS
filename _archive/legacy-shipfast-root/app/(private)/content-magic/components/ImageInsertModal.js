"use client";
import React, { useState, useEffect } from "react";
import { X, Save } from "lucide-react";
import ImageBrowsePanel from "./ImageBrowsePanel";

export default function ImageInsertModal({ editorRef, imageElement, onClose, onImageUpdate }) {
  const [imageAttributes, setImageAttributes] = useState({
    src: "",
    id: "",
    title: "",
    alt: "",
    class: "",
    width: "",
    height: "",
    'data-image-id': undefined,
    'data-storage-path': undefined,
  });

  // Initialize attributes from image element if provided
  useEffect(() => {
    if (imageElement) {
      setImageAttributes({
        src: imageElement.src || "",
        id: imageElement.id || "",
        title: imageElement.title || "",
        alt: imageElement.alt || "",
        class: imageElement.className || "",
        width: imageElement.width || imageElement.style.width || "",
        height: imageElement.height || imageElement.style.height || "",
        'data-image-id': imageElement.getAttribute('data-image-id') || undefined,
        'data-storage-path': imageElement.getAttribute('data-storage-path') || undefined,
      });
    }
  }, [imageElement]);

  const handleInputChange = (field, value) => {
    setImageAttributes((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleBrowseSelect = (image) => {
    // Store image reference (ID or storage_path) instead of signed URL
    // For storage-based images, use data-image-id; for external URLs, use src directly
    const isStorageImage = image.storage_path && !image.src?.startsWith('http');
    const imageRef = isStorageImage ? `image:${image.id}` : (image.src || image.url || image);
    
    setImageAttributes((prev) => ({
      ...prev,
      src: imageRef, // Will be converted to signed URL on render
      id: image.id || prev.id,
      title: image.title || prev.title,
      alt: image.alt || prev.alt,
      'data-image-id': isStorageImage ? image.id : undefined, // Store image ID for storage images
      'data-storage-path': isStorageImage ? image.storage_path : undefined,
    }));
  };

  const handleSave = async () => {
    if (!imageAttributes.src) {
      alert("Please provide an image source (src)");
      return;
    }

    // Helper to set image attributes
    const setImageAttributesOnElement = (img) => {
      // Store reference instead of signed URL for storage images
      const srcValue = imageAttributes.src;
      if (srcValue?.startsWith('image:')) {
        // Storage image reference - store in data attribute, src will be set by render utility
        img.setAttribute('data-image-id', imageAttributes['data-image-id'] || srcValue.replace('image:', ''));
        if (imageAttributes['data-storage-path']) {
          img.setAttribute('data-storage-path', imageAttributes['data-storage-path']);
        }
        img.src = ''; // Will be populated by render utility
      } else {
        // External URL (AI-generated or external) - use directly
        img.src = srcValue;
      }
      
      if (imageAttributes.id) img.id = imageAttributes.id;
      if (imageAttributes.title) img.title = imageAttributes.title;
      if (imageAttributes.alt) img.alt = imageAttributes.alt;
      if (imageAttributes.class) img.className = imageAttributes.class;
      if (imageAttributes.width) {
        img.width = imageAttributes.width;
        img.style.width = imageAttributes.width;
      }
      if (imageAttributes.height) {
        img.height = imageAttributes.height;
        img.style.height = imageAttributes.height;
      }
      img.style.maxWidth = "100%";
      img.style.height = "auto";
      img.style.display = "block";
      img.style.margin = "1rem 0";
    };

    // Save title and alt to database if image has a data-image-id
    let imageId = imageAttributes['data-image-id'] || 
                   (imageElement?.getAttribute('data-image-id'));
    
    // Extract image ID from src if it starts with "image:"
    if (!imageId && imageAttributes.src?.startsWith('image:')) {
      imageId = imageAttributes.src.replace('image:', '');
    }
    
    if (imageId && (imageAttributes.title || imageAttributes.alt)) {
      try {
        const { initMonkey } = await import("@/libs/monkey");
        const monkey = await initMonkey();
        await monkey.apiCall("/api/content-magic/images", {
          imageId: imageId,
          title: imageAttributes.title || null,
          alt: imageAttributes.alt || null,
        }, { method: "PATCH" });
      } catch (error) {
        // Continue with insertion even if update fails
      }
    }

    // Update or insert image
    if (imageElement && editorRef?.current?.contains(imageElement)) {
      // Update existing image
      setImageAttributesOnElement(imageElement);
    } else {
      // Insert new image - prioritize after element with "selected" class
      const selectedElement = editorRef.current?.querySelector('.selected');
      
      if (selectedElement) {
        // Insert after the selected element
        const img = document.createElement("img");
        setImageAttributesOnElement(img);
        
        const p = document.createElement("p");
        p.innerHTML = "<br>";
        
        // Insert image after selected element
        selectedElement.insertAdjacentElement('afterend', img);
        img.insertAdjacentElement('afterend', p);
      } else {
        // Fallback to cursor position or end
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          const img = document.createElement("img");
          setImageAttributesOnElement(img);

          range.insertNode(img);
          const p = document.createElement("p");
          p.innerHTML = "<br>";
          range.setStartAfter(img);
          range.insertNode(p);
          range.setStartAfter(p);
          range.collapse(true);
          selection.removeAllRanges();
          selection.addRange(range);
        } else {
          // Fallback: insert at end
          const img = document.createElement("img");
          setImageAttributesOnElement(img);
          editorRef.current?.appendChild(img);
        }
      }
    }
    
    // Trigger image URL conversion after insertion
    if (onImageUpdate) {
      onImageUpdate();
    }

    if (onImageUpdate) {
      onImageUpdate();
    }
    onClose();
  };

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-semibold">
            {imageElement ? "Edit Image" : "Insert Image"}
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Two Panel Layout */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left Panel - Settings */}
          <div className="w-1/2 border-r border-gray-200 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-6">
              {/* Image Source */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Image Source (src) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={imageAttributes.src}
                  onChange={(e) => handleInputChange("src", e.target.value)}
                  placeholder="https://example.com/image.jpg"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

          {/* Image Preview */}
          {imageAttributes.src && (
            <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-sm font-medium text-gray-700 mb-2">Preview:</p>
              <img
                src={imageAttributes.src}
                alt={imageAttributes.alt || "Preview"}
                className="max-w-full h-auto max-h-48 rounded border border-gray-300"
                onError={(e) => {
                  e.target.style.display = "none";
                }}
              />
            </div>
          )}

          {/* Image Attributes */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ID
              </label>
              <input
                type="text"
                value={imageAttributes.id}
                onChange={(e) => handleInputChange("id", e.target.value)}
                placeholder="image-id"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Title
              </label>
              <input
                type="text"
                value={imageAttributes.title}
                onChange={(e) => handleInputChange("title", e.target.value)}
                placeholder="Image title"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Alt Text
              </label>
              <input
                type="text"
                value={imageAttributes.alt}
                onChange={(e) => handleInputChange("alt", e.target.value)}
                placeholder="Alternative text for accessibility"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                CSS Class
              </label>
              <input
                type="text"
                value={imageAttributes.class}
                onChange={(e) => handleInputChange("class", e.target.value)}
                placeholder="rounded-lg shadow-md"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Width
                </label>
                <input
                  type="text"
                  value={imageAttributes.width}
                  onChange={(e) => handleInputChange("width", e.target.value)}
                  placeholder="500 or 100%"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Height
                </label>
                <input
                  type="text"
                  value={imageAttributes.height}
                  onChange={(e) => handleInputChange("height", e.target.value)}
                  placeholder="300 or auto"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>
            </div>

            {/* Left Panel Footer */}
            <div className="border-t p-4 flex items-center justify-end gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!imageAttributes.src}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                {imageElement ? "Update" : "Insert"}
              </button>
            </div>
          </div>

          {/* Right Panel - Browse */}
          <div className="w-1/2 flex flex-col overflow-hidden">
            <ImageBrowsePanel
              onSelectImage={handleBrowseSelect}
              editorRef={editorRef}
              onEditImage={(image) => {
                // When edit icon is clicked, populate the form with image data
                handleBrowseSelect(image);
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

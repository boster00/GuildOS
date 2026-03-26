"use client";
import React, { useState, useEffect, useRef } from "react";
import { X, Search, Upload, Sparkles, ChevronLeft, ChevronRight, Loader, Image as ImageIcon } from "lucide-react";
import { initMonkey } from "@/libs/monkey";

export default function ImageBrowser({ onSelectImage, onClose, showGenerateButton = true }) {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [selectedImageId, setSelectedImageId] = useState(null);
  const fileInputRef = useRef(null);
  const imagesPerPage = 5;

  // Fetch images from database
  const fetchImages = async (page = 1, search = "") => {
    setLoading(true);
    try {
      const monkey = await initMonkey();
      const text = await monkey.apiGet(
        `/api/content-magic/images?page=${page}&limit=${imagesPerPage}&search=${encodeURIComponent(search)}`
      );
      const data = JSON.parse(text);
      if (data.error) throw new Error(data.error || "Failed to fetch images");
      setImages(data.images || []);
      setTotalPages(data.totalPages || 1);
      setCurrentPage(page);
    } catch (error) {

      setImages([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchImages(1, searchQuery);
  }, [searchQuery]);

  // Handle search with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery !== undefined) {
        fetchImages(1, searchQuery);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Handle file upload
  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    setUploading(true);
    try {
      const formData = new FormData();
      files.forEach((file) => {
        formData.append("files", file);
      });

      const monkey = await initMonkey();
      const text = await monkey.apiCallFormData("/api/content-magic/upload-image", formData);
      const data = JSON.parse(text);
      if (data.error) throw new Error(data.error || "Failed to upload images");
      // Refresh images list
      await fetchImages(currentPage, searchQuery);
      
      // If only one image uploaded, select it automatically
      if (data.images && data.images.length === 1) {
        onSelectImage(data.images[0]);
      }
    } catch (error) {

      alert(`Failed to upload images: ${error.message}`);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      fetchImages(newPage, searchQuery);
    }
  };

  const handleImageSelect = (image) => {
    setSelectedImageId(image.id);
    onSelectImage(image);
  };

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 w-full max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Browse Images</h3>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-100 rounded transition-colors"
          title="Close"
        >
          <X className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      {/* Search Bar */}
      <div className="p-4 border-b border-gray-200">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search images..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="p-4 border-b border-gray-200 flex gap-2">
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {uploading ? (
            <>
              <Loader className="w-4 h-4 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4" />
              Upload New Image
            </>
          )}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileUpload}
          className="hidden"
        />
        {/* Generate Image button - HIDDEN */}
        {/* {showGenerateButton && (
          <button
            onClick={() => {
              // This will be handled by parent component
              onClose();
            }}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            Generate Image
          </button>
        )} */}
      </div>

      {/* Images Grid */}
      <div className="p-4 max-h-96 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : images.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <ImageIcon className="w-12 h-12 mb-2 opacity-50" />
            <p className="text-sm">No images found</p>
            <p className="text-xs mt-1">Upload an image to get started</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {images.map((image) => (
              <div
                key={image.id}
                onClick={() => handleImageSelect(image)}
                className={`relative border-2 rounded-lg overflow-hidden cursor-pointer transition-all ${
                  selectedImageId === image.id
                    ? "border-blue-500 ring-2 ring-blue-200"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <img
                  src={image.src}
                  alt={image.alt || image.title || "Image"}
                  className="w-full h-32 object-cover"
                />
                <div className="p-2 bg-white">
                  <p className="text-xs font-medium text-gray-900 truncate">
                    {image.title || image.alt || "Untitled"}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{image.source}</p>
                </div>
                {selectedImageId === image.id && (
                  <div className="absolute top-2 right-2 bg-blue-500 text-white rounded-full p-1">
                    <ImageIcon className="w-3 h-3" />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="p-4 border-t border-gray-200 flex items-center justify-between">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="flex items-center gap-1 px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </button>
          <span className="text-sm text-gray-600">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="flex items-center gap-1 px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

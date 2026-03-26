"use client";
import React, { useState, useEffect, useRef } from "react";
import { Search, Upload, Sparkles, ChevronLeft, ChevronRight, Loader, Image as ImageIcon, X, Check, Trash2 } from "lucide-react";
import { initMonkey } from "@/libs/monkey";
import { isSupabaseStorageUrl } from "@/libs/content-magic/utils/parseSupabaseStoragePath";
import CreditCostBadge from "@/components/CreditCostBadge";

// Image thumbnail component that uses signed URLs
function ImageThumbnail({ image, isSelected, onSelect, signedUrl, onDelete, deletingId }) {
  const [loadFailed, setLoadFailed] = useState(false);
  const isDeleting = deletingId === image.id;
  useEffect(() => {
    setLoadFailed(false);
  }, [signedUrl]);

  return (
    <div
      className={`relative border-2 rounded-lg overflow-hidden transition-all ${
        isSelected
          ? "border-blue-500 ring-2 ring-blue-200"
          : "border-gray-200 hover:border-gray-300"
      }`}
    >
      {onDelete && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (!isDeleting) onDelete(image);
          }}
          disabled={isDeleting}
          className="absolute top-2 right-2 z-10 p-1.5 rounded-md bg-white/90 border border-gray-200 text-gray-500 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          title="Delete image"
        >
          {isDeleting ? (
            <Loader className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Trash2 className="w-3.5 h-3.5" />
          )}
        </button>
      )}
      <div
        onClick={onSelect}
        className="cursor-pointer"
      >
        {signedUrl ? (
          loadFailed ? (
            <div className="w-full h-32 flex flex-col items-center justify-center bg-gray-100 text-gray-500">
              <ImageIcon className="w-8 h-8 mb-1 opacity-50" />
              <span className="text-xs">Could not load</span>
            </div>
          ) : (
            <img
              src={signedUrl}
              alt={image.alt || image.title || "Image"}
              className="w-full h-32 object-cover"
              onError={() => {
                if (process.env.NODE_ENV === "development") {
                  
                }
                setLoadFailed(true);
              }}
            />
          )
        ) : (
          <div className="w-full h-32 flex items-center justify-center bg-gray-100">
            <Loader className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        )}
      </div>
      <div className="p-2 bg-white">
        <p className="text-xs font-medium text-gray-900 truncate">
          {image.title || image.alt || "Untitled"}
        </p>
        <p className="text-xs text-gray-500 truncate">{image.source}</p>
      </div>
    </div>
  );
}

export default function ImageBrowsePanel({ onSelectImage, editorRef, onEditImage }) {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [selectedImageId, setSelectedImageId] = useState(null);
  const [showGenerator, setShowGenerator] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState(null);
  const [error, setError] = useState(null);
  const [selectedStyle, setSelectedStyle] = useState("default"); // Image style selection
  const [signedUrls, setSignedUrls] = useState({}); // Cache of signed URLs (storage_path -> signedUrl)
  const [deletingId, setDeletingId] = useState(null);
  const fileInputRef = useRef(null);
  const imagesPerPage = 5;

  // Image style presets with their style prompts
  const imageStyles = [
    {
      value: "default",
      label: "Default (Best Practices)",
      prompt: [
        "natural, believable scene",
        "realistic lighting and materials",
        "subtle imperfections and asymmetry",
        "unposed, everyday moment",
        "functional environment",
        "neutral, business-appropriate tone",
        "designed to support text, not dominate",
        "no stock-photo vibe",
        "no dramatic or stylized effects"
      ].join(", ")
    },
    {
      value: "photorealistic",
      label: "Photorealistic (Candid)",
      prompt: [
        "candid documentary photograph",
        "natural skin texture, minor imperfections",
        "imperfect framing, slight asymmetry",
        "realistic mixed lighting, not studio-lit",
        "lived-in environment details",
        "no glossy retouching",
        "no posed expressions",
        "no corporate stock-photo aesthetic"
      ].join(", ")
    },
    {
      value: "illustration",
      label: "Illustration (Editorial)",
      prompt: [
        "editorial illustration",
        "clean shapes and clear silhouettes",
        "limited, neutral color palette",
        "minimal shading and texture",
        "concept-focused, not decorative",
        "business-appropriate tone",
        "designed to sit alongside text",
        "avoid hyper-detailed rendering"
      ].join(", ")
    },
    {
      value: "minimalist",
      label: "Minimalist (UI-Friendly)",
      prompt: [
        "minimalist vector style",
        "flat or lightly shaded forms",
        "strong negative space",
        "2–4 visual elements only",
        "high clarity at small sizes",
        "no background clutter",
        "designed to integrate with UI"
      ].join(", ")
    },
    {
      value: "sketch",
      label: "Sketch (Concept)",
      prompt: [
        "hand-drawn pencil sketch",
        "clean linework with slight imperfections",
        "minimal shading",
        "white or very light background",
        "diagram-like clarity",
        "conceptual, not realistic"
      ].join(", ")
    }
  ];

  // Fetch signed URLs for images with storage_path or legacy Supabase src
  const fetchSignedUrls = async (imageList) => {
    const storagePaths = imageList
      .filter(img => img.storage_path && !signedUrls[img.storage_path])
      .map(img => img.storage_path);

    const legacySrcUrls = imageList
      .filter(img => !img.storage_path && img.src && isSupabaseStorageUrl(img.src) && !signedUrls[img.src])
      .map(img => img.src);

    if (storagePaths.length === 0 && legacySrcUrls.length === 0) {
      return;
    }

    try {
      const monkey = await initMonkey();
      const text = await monkey.apiCall("/api/content-magic/images/signed-url", {
        storagePaths,
        legacySrcUrls,
      });
      const data = JSON.parse(text);
      if (data.error) throw new Error(data.error || "Failed to fetch signed URLs");
      setSignedUrls(prev => ({ ...prev, ...data.urls }));
    } catch (error) {
    }
  };

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

      // Fetch signed URLs for storage-based images
      if (data.images && data.images.length > 0) {
        await fetchSignedUrls(data.images);
      }
    } catch (error) {
      setImages([]);
    } finally {
      setLoading(false);
    }
  };

  // Handle search with debounce (runs on mount and when searchQuery changes)
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchImages(1, searchQuery);
    }, searchQuery === "" ? 0 : 300); // Immediate fetch on mount (empty search), debounce for actual searches
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
    // Also select the image for insertion (populate the form)
    if (onSelectImage) {
      const imageUrl = getImageUrl(image);
      onSelectImage({ ...image, src: imageUrl });
    }
  };

  const handleDelete = async (image) => {
    if (!confirm("Delete this image? This cannot be undone.")) return;
    setDeletingId(image.id);
    try {
      const monkey = await initMonkey();
      const text = await monkey.apiCall(`/api/content-magic/images/${image.id}`, null, { method: "DELETE" });
      const data = JSON.parse(text);
      if (data.error) throw new Error(data.error || "Failed to delete image");
      await fetchImages(currentPage, searchQuery);
      if (selectedImageId === image.id) {
        setSelectedImageId(null);
      }
    } catch (err) {
      alert(`Failed to delete image: ${err.message}`);
    } finally {
      setDeletingId(null);
    }
  };

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
      // Combine user prompt with selected style prompt
      const selectedStyleObj = imageStyles.find(s => s.value === selectedStyle);
      const stylePrompt = selectedStyleObj?.prompt || "";
      const fullPrompt = stylePrompt 
        ? `${prompt.trim()}, ${stylePrompt}`
        : prompt.trim();

      // Generate 4 images by making 4 separate API calls (DALL-E 3 only supports n=1)
      const monkey = await initMonkey();
      const allImages = [];
      for (let i = 0; i < 4; i++) {
        const text = await monkey.apiCall("/api/content-magic/generate-image", { prompt: fullPrompt });
        const data = JSON.parse(text);
        if (data.error) {
          const errorMessage = data.details ? `${data.error || 'Error'}: ${data.details}` : data.error;
          throw new Error(errorMessage);
        }
        if (data.images && data.images.length > 0) {
          allImages.push(...data.images);
        }
      }
      
      if (allImages.length > 0) {
        setGeneratedImages(allImages);
      } else {
        throw new Error("No images generated");
      }
    } catch (err) {
      setError(err.message || "Failed to generate images");
    } finally {
      setGenerating(false);
    }
  };

  const handleSelectGeneratedImage = async (index) => {
    setSelectedImageIndex(index);
    if (generatedImages[index] && onSelectImage) {
      const imageUrl = generatedImages[index].url;
      const revisedPrompt = generatedImages[index].revised_prompt;
      
      // Save generated image to database
      try {
        setError(null);
        const monkey = await initMonkey();
        const text = await monkey.apiCall("/api/content-magic/save-generated-image", {
          imageUrl,
          prompt: prompt.trim(),
          title: `AI Generated: ${prompt.trim().substring(0, 50)}`,
          alt: revisedPrompt || prompt.trim(),
        });
        const data = JSON.parse(text);
        if (data.error) throw new Error(data.error || "Failed to save generated image");

        // Select the image for insertion
        onSelectImage({ 
          src: imageUrl,
          alt: revisedPrompt || prompt.trim(),
          title: `AI Generated: ${prompt.trim().substring(0, 50)}`
        });
        
        // Refresh images list and close generator
        await fetchImages(currentPage, searchQuery);
        setShowGenerator(false);
        setPrompt("");
        setGeneratedImages([]);
        setSelectedImageIndex(null);
      } catch (err) {
        setError(`Failed to save image: ${err.message}`);
        setSelectedImageIndex(null);
      }
    }
  };

  // Helper to get image URL (signed URL for storage/legacy, src for external/AI-generated)
  const getImageUrl = (image) => {
    if (image.storage_path && signedUrls[image.storage_path]) {
      return signedUrls[image.storage_path];
    }
    if (!image.storage_path && image.src && signedUrls[image.src]) {
      return signedUrls[image.src];
    }
    return image.src || '';
  };

  return (
    <div className="flex flex-col h-full">
      {/* Browse UI */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Search Bar */}
        <div className="p-4 border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search images..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
          </div>
        </div>

        {/* Images Grid */}
        <div className="flex-1 overflow-y-auto p-4">
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
                <ImageThumbnail
                  key={image.id}
                  image={image}
                  isSelected={selectedImageId === image.id}
                  onSelect={() => handleImageSelect(image)}
                  signedUrl={getImageUrl(image)}
                  onDelete={handleDelete}
                  deletingId={deletingId}
                />
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
              className="flex items-center gap-1 px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
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
              className="flex items-center gap-1 px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Add new image section */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <h4 className="text-sm font-semibold text-gray-900 mb-3">Add new image</h4>
          <div className="flex gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors text-sm"
            >
              {uploading ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Upload
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
            <button
              onClick={() => setShowGenerator(!showGenerator)}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors text-sm"
            >
              <Sparkles className="w-4 h-4" />
              Generate with AI
            </button>
          </div>
        </div>
      </div>

      {/* Generation UI */}
      {showGenerator && (
        <div className="border-t border-gray-200 bg-white flex flex-col max-h-[500px]">
          <div className="p-4 overflow-y-auto flex-1">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3 flex-1">
                <h4 className="text-sm font-semibold text-gray-900">Generate Image with AI</h4>
                <select
                  value={selectedStyle}
                  onChange={(e) => setSelectedStyle(e.target.value)}
                  disabled={generating}
                  className="text-xs px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white"
                >
                  {imageStyles.map((style) => (
                    <option key={style.value} value={style.value}>
                      {style.label}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => {
                  setShowGenerator(false);
                  setPrompt("");
                  setGeneratedImages([]);
                  setSelectedImageIndex(null);
                  setError(null);
                  setSelectedStyle("default");
                }}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Prompt Input */}
            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Describe the image you want to generate:
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="A serene landscape with mountains and a lake at sunset..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm resize-none"
                rows={3}
                disabled={generating}
              />
            </div>

            {/* Error Display */}
            {error && (
              <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-md">
                <p className="text-xs text-red-600">{error}</p>
              </div>
            )}

            {/* Generate Button */}
            {generatedImages.length === 0 && (
              <button
                onClick={handleGenerate}
                disabled={generating || !prompt.trim()}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-sm"
              >
                {generating ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    Generating 4 images... (this may take 60-90 seconds)
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Generate 4 Images
                    <CreditCostBadge path="/api/content-magic/generate-image" size="sm" />
                  </>
                )}
              </button>
            )}

            {/* Generated Images Grid */}
            {generatedImages.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-medium text-gray-700 mb-2">Select an image to use:</p>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  {generatedImages.map((image, index) => (
                    <div
                      key={index}
                      onClick={() => setSelectedImageIndex(index)}
                      className={`relative border-2 rounded-lg overflow-hidden cursor-pointer transition-all ${
                        selectedImageIndex === index
                          ? "border-blue-500 ring-2 ring-blue-200"
                          : "border-gray-300 hover:border-gray-400"
                      }`}
                    >
                      <img
                        src={image.url}
                        alt={`Generated ${index + 1}`}
                        className="w-full h-auto"
                      />
                      {selectedImageIndex === index && (
                        <div className="absolute top-2 right-2 bg-blue-500 text-white rounded-full p-1">
                          <Check className="w-3 h-3" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Revised Prompt Info */}
                {selectedImageIndex !== null && generatedImages[selectedImageIndex]?.revised_prompt && (
                  <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded-md">
                    <p className="text-xs font-medium text-blue-900 mb-1">Revised Prompt:</p>
                    <p className="text-xs text-blue-700 italic">{generatedImages[selectedImageIndex].revised_prompt}</p>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSelectGeneratedImage(selectedImageIndex)}
                    disabled={selectedImageIndex === null}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-sm"
                  >
                    <Check className="w-4 h-4" />
                    Use This Image
                  </button>
                  <button
                    onClick={() => {
                      setGeneratedImages([]);
                      setSelectedImageIndex(null);
                      setError(null);
                    }}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-sm"
                  >
                    <Sparkles className="w-4 h-4" />
                    Regenerate
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

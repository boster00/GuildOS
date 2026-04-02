/**
 * Upload images from v0 response to Supabase storage
 * Includes automatic compression for images >100KB
 */

/**
 * Convert v0 file content to Blob
 * @param {string} content - File content (base64, data URL, or raw)
 * @returns {Promise<Blob>}
 */
async function convertToBlob(content) {
  // Handle data URL (e.g., "data:image/png;base64,...")
  if (content.startsWith('data:')) {
    const response = await fetch(content);
    return response.blob();
  }
  
  // Handle base64 string
  if (content.match(/^[A-Za-z0-9+/=]+$/)) {
    const binaryString = atob(content);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return new Blob([bytes]);
  }
  
  // Assume it's already a blob-like content
  return new Blob([content]);
}

/**
 * Compress image if larger than 100KB
 * @param {Blob} blob - Image blob
 * @param {string} fileName - File name for logging
 * @returns {Promise<Blob>} Compressed blob
 */
async function compressImageIfNeeded(blob, fileName) {
  const MAX_SIZE = 100 * 1024; // 100KB
  
  if (blob.size <= MAX_SIZE) {
    
    return blob;
  }
  
  
  
  try {
    // Create image element
    const img = new Image();
    const objectUrl = URL.createObjectURL(blob);
    
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = objectUrl;
    });
    
    // Create canvas
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Start with original dimensions
    let width = img.width;
    let height = img.height;
    
    // Try different quality levels and dimensions
    let quality = 0.9;
    let compressedBlob = blob;
    let attempts = 0;
    const maxAttempts = 20;
    
    while (compressedBlob.size > MAX_SIZE && attempts < maxAttempts) {
      canvas.width = width;
      canvas.height = height;
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      
      // Convert to blob with quality
      compressedBlob = await new Promise(resolve => {
        canvas.toBlob(resolve, 'image/jpeg', quality);
      });
      
      // If still too large, adjust strategy
      if (compressedBlob.size > MAX_SIZE) {
        if (quality > 0.5) {
          // Try lower quality first
          quality -= 0.1;
        } else {
          // Then reduce dimensions
          width = Math.floor(width * 0.9);
          height = Math.floor(height * 0.9);
          quality = 0.8; // Reset quality when resizing
        }
      }
      
      attempts++;
    }
    
    URL.revokeObjectURL(objectUrl);
    
    if (compressedBlob.size <= MAX_SIZE) {
      
      return compressedBlob;
    } else {
      
      return compressedBlob; // Return best attempt
    }
  } catch (error) {

    return blob; // Return original on error
  }
}

/**
 * Upload images from v0 response to Supabase storage
 * @param {Array} files - v0 files array
 * @returns {Promise<Object>} Mapping of {originalPath: supabaseUrl}
 */
export async function uploadV0Images(files) {
  if (!files || !Array.isArray(files)) {

    return {};
  }
  
  // Filter files for images (name matches /images/* or mime type is image/*)
  const imageFiles = files.filter(f => {
    if (!f || !f.name) return false;
    
    return (
      f.name.startsWith('images/') || 
      f.name.startsWith('/images/') ||
      f.content?.startsWith('data:image/') ||
      (f.meta && f.meta.type && f.meta.type.startsWith('image/'))
    );
  });
  
  if (imageFiles.length === 0) {

    return {};
  }
  
  
  
  // Convert to FormData
  const formData = new FormData();
  const originalPaths = [];
  
  for (const imageFile of imageFiles) {
    try {
      // Handle base64 or raw content
      let blob = await convertToBlob(imageFile.content);
      const fileName = imageFile.name.replace(/^\/?(images\/)?/, ''); // Remove leading slash and images/ prefix
      
      // Compress if needed
      blob = await compressImageIfNeeded(blob, fileName);
      // Server expects File (has .name, .type); Blob is skipped by upload-image route
      const file = new File([blob], fileName, { type: blob.type || 'image/png' });
      formData.append('files', file);
      originalPaths.push(imageFile.name);
    } catch (error) {

    }
  }
  
  if (originalPaths.length === 0) {

    return {};
  }
  
  // Upload to Supabase
  try {
    
    const { initMonkey } = await import('@/libs/monkey');
    const monkey = await initMonkey();
    const text = await monkey.apiCallFormData('/api/content-magic/upload-image', formData);
    const result = JSON.parse(text);
    if (result.error) throw new Error(result.error || 'Upload failed');
    
    if (!result.success || !result.images) {
      throw new Error('Upload response missing images data');
    }
    
    // Build mapping: original path -> signed URL
    const mapping = {};
    result.images.forEach((img, i) => {
      if (i < originalPaths.length) {
        const originalPath = originalPaths[i];
        
        // Try to get signed URL from API response
        let imageUrl = img.src;
        
        // If src is not available, generate signed URL from storage_path
        if (!imageUrl && img.storage_path) {

          // For now, use storage_path - client will handle signed URL generation
          imageUrl = img.storage_path;
        }
        
        mapping[originalPath] = imageUrl;

      }
    });
    
    
    return mapping;
    
  } catch (error) {

    throw new Error(`Failed to upload images: ${error.message}`);
  }
}

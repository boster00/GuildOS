/**
 * Cleans HTML before saving by removing signed URLs from images with data-image-id
 * This ensures we only save image references, not expired signed URLs
 */

export function cleanImageUrlsForSave(html) {
  if (!html) return html;

  // Create a temporary DOM element to parse HTML
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;

  // Find all images with data-image-id (storage-based images)
  const images = tempDiv.querySelectorAll('img[data-image-id]');
  
  images.forEach((img) => {
    // Remove the src attribute if it's a signed URL (contains query params or is a blob/data URL)
    // Keep it if it's an external URL (starts with http/https and doesn't look like a signed URL)
    const src = img.getAttribute('src');
    if (src) {
      // Check if it's a signed URL (Supabase signed URLs contain query parameters)
      const isSignedUrl = src.includes('?') && (src.includes('supabase.co') || src.includes('token='));
      // Check if it's a blob URL (temporary)
      const isBlobUrl = src.startsWith('blob:');
      // Check if it's a data URL (base64)
      const isDataUrl = src.startsWith('data:');
      
      // Remove src if it's a signed URL, blob URL, or data URL
      // Keep it if it's an external URL (AI-generated images from OpenAI, etc.)
      if (isSignedUrl || isBlobUrl || isDataUrl) {
        img.removeAttribute('src');
      }
    }
  });

  return tempDiv.innerHTML;
}

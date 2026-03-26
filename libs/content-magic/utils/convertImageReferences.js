/**
 * Converts image references (data-image-id) to signed URLs on-demand
 * This prevents expired signed URLs from being stored in article content
 */

export async function convertImageReferencesToUrls(editorElement) {
  if (!editorElement) return;

  // Find all images with data-image-id attribute (storage-based images)
  const images = editorElement.querySelectorAll('img[data-image-id]');
  
  if (images.length === 0) return;

  // Collect all image IDs and storage paths
  const imageIds = [];
  const storagePaths = [];
  const imageMap = new Map(); // Map image element to its storage path

  images.forEach((img) => {
    const imageId = img.getAttribute('data-image-id');
    const storagePath = img.getAttribute('data-storage-path');
    
    if (imageId && storagePath) {
      imageIds.push(imageId);
      storagePaths.push(storagePath);
      imageMap.set(img, storagePath);
    }
  });

  if (storagePaths.length === 0) return;

  try {
    const { initMonkey } = await import("@/libs/monkey");
    const monkey = await initMonkey();
    const text = await monkey.apiCall("/api/content-magic/images/signed-url", { storagePaths });
    const data = JSON.parse(text);
    if (data.error) {
      return;
    }
    const urlMap = data.urls || {};

    // Update each image's src with the signed URL
    imageMap.forEach((storagePath, img) => {
      const signedUrl = urlMap[storagePath];
      if (signedUrl) {
        img.src = signedUrl;
      } else {
      }
    });
  } catch (error) {
  }
}

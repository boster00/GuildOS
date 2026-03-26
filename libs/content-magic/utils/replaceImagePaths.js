/**
 * Replace image src attributes in HTML with new URLs
 * @param {string} html - HTML content
 * @param {Object} pathMapping - {originalPath: newUrl}
 * @returns {string} Updated HTML
 */
export function replaceImagePaths(html, pathMapping) {
  if (!html || typeof html !== 'string') {
    return html;
  }
  
  if (!pathMapping || Object.keys(pathMapping).length === 0) {
    return html;
  }
  
  let updatedHtml = html;
  let replacementCount = 0;
  
  
  
  // Replace each image path
  for (const [originalPath, newUrl] of Object.entries(pathMapping)) {
    if (!newUrl) {
      continue;
    }
    
    // Escape special regex characters in the original path
    const escapedPath = originalPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    // Handle various path formats:
    // - /images/foo.png
    // - images/foo.png
    // - ./images/foo.png
    // - ../images/foo.png
    const pathVariants = [
      escapedPath,
      escapedPath.replace(/^\//, ''), // Remove leading slash
      `/${escapedPath.replace(/^\//, '')}`, // Add leading slash
      `./${escapedPath.replace(/^\//, '')}`, // Add ./
      `../${escapedPath.replace(/^\//, '')}` // Add ../
    ];
    
    // Try to match with both single and double quotes
    for (const variant of pathVariants) {
      // Match src="path" or src='path'
      const patterns = [
        new RegExp(`src=["']${variant}["']`, 'gi'),
        new RegExp(`src=["']${variant}\\?[^"']*["']`, 'gi') // With query params
      ];
      
      patterns.forEach(pattern => {
        const matches = updatedHtml.match(pattern);
        if (matches) {
          updatedHtml = updatedHtml.replace(pattern, `src="${newUrl}"`);
          replacementCount += matches.length;
        }
      });
    }
  }
  
  if (replacementCount > 0) {
    
  } else {
  }
  
  return updatedHtml;
}

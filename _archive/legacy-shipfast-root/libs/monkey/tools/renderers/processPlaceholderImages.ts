/**
 * HTML Post-Processing: Placeholder Image Replacement
 * Scans HTML string and replaces missing/broken images with theme-appropriate placeholders
 * based on alt text keyword matching
 */

export type PlaceholderTheme = 
  | "professional"
  | "casual"
  | "minimalist"
  | "colorful"
  | "corporate"
  | "creative";

export type PlaceholderType = 
  | "logo"
  | "avatar"
  | "product"
  | "banner"
  | "icon"
  | "default";

/**
 * Keyword mappings for placeholder type detection
 * Priority order: logo → avatar → product → banner → icon → default
 */
const keywordMappings: Record<PlaceholderType, string[]> = {
  logo: ["logo", "company", "brand", "corp", "inc", "business", "enterprise"],
  avatar: ["avatar", "person", "user", "team", "profile", "photo", "people", "customer", "testimonial"],
  product: ["product", "feature", "screenshot", "app", "software", "tool", "service", "device"],
  banner: ["banner", "hero", "header", "cover", "background"],
  icon: ["icon", "symbol", "badge", "mark", "emblem"],
  default: [], // Fallback for everything else
};

/**
 * Determine placeholder type based on alt text
 */
function determinePlaceholderType(altText: string): PlaceholderType {
  const lowerAlt = altText.toLowerCase();
  
  // Check in priority order
  for (const [type, keywords] of Object.entries(keywordMappings)) {
    if (type === "default") continue;
    
    if (keywords.some(keyword => lowerAlt.includes(keyword))) {
      return type as PlaceholderType;
    }
  }
  
  return "default";
}

/**
 * Check if an image needs placeholder replacement
 */
function needsPlaceholder(src: string | null | undefined): boolean {
  if (!src || src.trim() === "") return true;
  
  const lowerSrc = src.toLowerCase();
  
  // Check for placeholder/broken image patterns
  const placeholderPatterns = [
    "placeholder",
    "broken",
    "missing",
    "undefined",
    "null",
    "data:image/svg+xml,", // Empty data URI
    "about:blank",
  ];
  
  return placeholderPatterns.some(pattern => lowerSrc.includes(pattern));
}

/**
 * Extract alt text from img tag
 */
function extractAltFromImgTag(imgTag: string): string {
  // Match alt="..." or alt='...'
  const altMatch = imgTag.match(/alt\s*=\s*["']([^"']*)["']/i);
  return altMatch ? altMatch[1] : "";
}

/**
 * Replace src attribute in img tag
 */
function replaceSrcInImgTag(imgTag: string, newSrc: string): string {
  // Replace src="..." or src='...'
  if (/src\s*=\s*["'][^"']*["']/i.test(imgTag)) {
    return imgTag.replace(/src\s*=\s*["'][^"']*["']/i, `src="${newSrc}"`);
  } else {
    // Insert src if it doesn't exist
    return imgTag.replace(/<img\s+/i, `<img src="${newSrc}" `);
  }
}

/**
 * Process HTML string and replace missing/broken images with placeholders
 */
export async function processPlaceholderImages(
  html: string,
  userTheme: PlaceholderTheme = "professional"
): Promise<string> {
  // Validate theme
  const validThemes: PlaceholderTheme[] = ["professional", "casual", "minimalist", "colorful", "corporate", "creative"];
  const theme = validThemes.includes(userTheme) ? userTheme : "professional";
  
  // Regex to match img tags (handles self-closing and regular tags)
  const imgTagRegex = /<img[^>]*>/gi;
  
  return html.replace(imgTagRegex, (imgTag) => {
    // Extract src attribute
    const srcMatch = imgTag.match(/src\s*=\s*["']([^"']*)["']/i);
    const src = srcMatch ? srcMatch[1] : null;
    
    // Check if placeholder is needed
    if (!needsPlaceholder(src)) {
      return imgTag; // Keep original image if it has a valid src
    }
    
    // Extract alt text
    const altText = extractAltFromImgTag(imgTag);
    
    // Determine placeholder type based on alt text
    // Use empty string if no alt text to ensure default fallback
    const placeholderType = altText ? determinePlaceholderType(altText) : "default";
    
    // Construct placeholder path
    // Format: /images/placeholders/{theme}/{type}.svg
    const placeholderPath = `/images/placeholders/${theme}/${placeholderType}.svg`;
    
    // Replace src with placeholder path
    return replaceSrcInImgTag(imgTag, placeholderPath);
  });
}

/**
 * Synchronous version (for when async is not needed)
 */
export function processPlaceholderImagesSync(
  html: string,
  userTheme: PlaceholderTheme = "professional"
): string {
  // Validate theme
  const validThemes: PlaceholderTheme[] = ["professional", "casual", "minimalist", "colorful", "corporate", "creative"];
  const theme = validThemes.includes(userTheme) ? userTheme : "professional";
  
  // Regex to match img tags (handles self-closing and regular tags)
  const imgTagRegex = /<img[^>]*>/gi;
  
  return html.replace(imgTagRegex, (imgTag) => {
    // Extract src attribute
    const srcMatch = imgTag.match(/src\s*=\s*["']([^"']*)["']/i);
    const src = srcMatch ? srcMatch[1] : null;
    
    // Check if placeholder is needed
    if (!needsPlaceholder(src)) {
      return imgTag; // Keep original image if it has a valid src
    }
    
    // Extract alt text
    const altText = extractAltFromImgTag(imgTag);
    
    // Determine placeholder type based on alt text
    // Use empty string if no alt text to ensure default fallback
    const placeholderType = altText ? determinePlaceholderType(altText) : "default";
    
    // Construct placeholder path
    // Format: /images/placeholders/{theme}/{type}.svg
    const placeholderPath = `/images/placeholders/${theme}/${placeholderType}.svg`;
    
    // Replace src with placeholder path
    return replaceSrcInImgTag(imgTag, placeholderPath);
  });
}

/**
 * Section key generation and validation utilities
 */

/**
 * Generate a stable section key from heading text
 * @param title - The heading text
 * @returns A URL-safe section key
 */
export function generateSectionKey(title: string): string {
  if (!title || typeof title !== 'string') {
    return 'section_unknown';
  }
  
  // Normalize: lowercase, replace spaces with underscores, remove special chars
  const normalized = title
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^\w_]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  
  // Ensure it starts with 'section_'
  const key = normalized.startsWith('section_') 
    ? normalized 
    : `section_${normalized}`;
  
  // Ensure minimum length
  return key.length > 0 ? key : 'section_unknown';
}

/**
 * Normalize a section key to standard format
 * @param key - The section key to normalize
 * @returns Normalized section key
 */
export function normalizeSectionKey(key: string): string {
  if (!key || typeof key !== 'string') {
    return 'section_unknown';
  }
  
  // Remove any existing 'section_' prefix to avoid duplication
  let normalized = key.replace(/^section_+/, '');
  
  // Normalize format
  normalized = normalized
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^\w_]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  
  // Add prefix back
  return normalized.length > 0 ? `section_${normalized}` : 'section_unknown';
}

/**
 * Validate if a string is a valid section key format
 * @param key - The key to validate
 * @returns True if valid, false otherwise
 */
export function isValidSectionKey(key: string): boolean {
  if (!key || typeof key !== 'string') {
    return false;
  }
  
  // Must start with 'section_'
  if (!key.startsWith('section_')) {
    return false;
  }
  
  // After 'section_', must have at least one alphanumeric/underscore character
  const suffix = key.substring(8); // 'section_'.length = 8
  if (suffix.length === 0) {
    return false;
  }
  
  // Must only contain lowercase letters, numbers, and underscores
  return /^[a-z0-9_]+$/.test(suffix);
}

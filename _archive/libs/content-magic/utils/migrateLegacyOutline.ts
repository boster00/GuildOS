// ARCHIVED: Original path was libs/content-magic/utils/migrateLegacyOutline.ts

/**
 * Migration utility for legacy outline formats
 * Converts old outline structures to new format
 */

import { Section } from '../types/sections';
import { generateSectionKey } from './sectionKeys';

/**
 * Migrate legacy outline section from old format to new format
 * Legacy format: { id: string, title: string }
 * New format: { key: string, title: string, format: string, purpose?: string }
 */
export function migrateLegacySection(section: any): Section {
  // If already in new format, return as-is
  if (section.key && section.format) {
    return section as Section;
  }
  
  // Migrate from legacy format
  const key = section.key || section.id || generateSectionKey(section.title || '');
  const title = section.title || '';
  const format = section.format || 'text_block';
  const purpose = section.purpose;
  const level = section.level;
  const position = section.position;
  
  return {
    key,
    title,
    format,
    purpose,
    level,
    position,
  };
}

/**
 * Migrate an array of legacy outline sections
 */
export function migrateLegacyOutline(sections: any[]): Section[] {
  if (!Array.isArray(sections)) {
    return [];
  }
  
  return sections.map((section, index) => {
    const migrated = migrateLegacySection(section);
    
    // If no key was generated, ensure we have one
    if (!migrated.key || migrated.key === 'section_unknown') {
      migrated.key = generateSectionKey(migrated.title || `Section ${index + 1}`);
    }
    
    return migrated;
  });
}

/**
 * Check if an outline needs migration
 */
export function needsMigration(sections: any[]): boolean {
  if (!Array.isArray(sections) || sections.length === 0) {
    return false;
  }
  
  // Check if any section is missing required new format fields
  return sections.some(section => {
    return !section.key || !section.format;
  });
}

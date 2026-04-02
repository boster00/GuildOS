/**
 * Type definitions for section structures
 */

export interface Section {
  key: string;
  title: string;
  format: string;
  purpose?: string;
  level?: number; // h1-h6 level
  position?: number; // order in document
}

export interface OutlineSections {
  sections: Section[];
  extractedAt: string;
  source: 'html' | 'assets' | 'generated';
}

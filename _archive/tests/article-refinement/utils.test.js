// ARCHIVED: Original path was tests/article-refinement/utils.test.js

import { describe, it, expect } from 'vitest';
import { extractOutlineFromHtml, parseFinalReview } from '@/libs/content-magic/article-refinement/utils.js';

describe('Article Refinement Utils', () => {
  describe('extractOutlineFromHtml', () => {
    it('should extract headings from HTML', () => {
      const html = '<h1>Main Title</h1><h2>Subtitle</h2><p>Content</p><h3>Sub-subtitle</h3>';
      const sections = extractOutlineFromHtml(html);

      expect(sections).toHaveLength(3);
      expect(sections[0].title).toBe('Main Title');
      expect(sections[1].title).toBe('  Subtitle');
      expect(sections[2].title).toBe('    Sub-subtitle');
    });

    it('should handle empty HTML', () => {
      const sections = extractOutlineFromHtml('');
      expect(sections).toHaveLength(0);
    });

    it('should handle HTML without headings', () => {
      const html = '<p>Just paragraphs</p><div>No headings</div>';
      const sections = extractOutlineFromHtml(html);
      expect(sections).toHaveLength(0);
    });
  });

  describe('parseFinalReview', () => {
    it('should parse final review text correctly', () => {
      const reviewText = `Score: 85/100
Verdict: Good
! H1 Missing: Add primary keyword to H1
✅ Clear Structure: Headings are well organized
→ Add CTA: Consider adding a call-to-action`;

      const review = parseFinalReview(reviewText);

      expect(review.score).toBe(85);
      expect(review.verdict).toBe('Good');
      expect(review.feedbackRows).toHaveLength(3);
      expect(review.feedbackRows[0].type).toBe('must_fix');
      expect(review.feedbackRows[1].type).toBe('strength');
      expect(review.feedbackRows[2].type).toBe('suggestion');
    });

    it('should handle missing score and verdict', () => {
      const reviewText = `! Test: Test message`;
      const review = parseFinalReview(reviewText);

      expect(review.score).toBe(0);
      expect(review.verdict).toBe('Meh');
      expect(review.feedbackRows.length).toBeGreaterThan(0);
    });
  });
});


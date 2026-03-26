// ARCHIVED: Original path was tests/article-refinement/step-9-final-review.test.js

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/content-magic/article-refinement/step-9-final-review/route';

describe('Step 9: Final Review', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should generate final review successfully', async () => {
    const request = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({
        articleId: 'test-article-id',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.review).toBeDefined();
    expect(data.review).toHaveProperty('score');
    expect(data.review).toHaveProperty('verdict');
    expect(data.review).toHaveProperty('feedbackRows');
    expect(Array.isArray(data.review.feedbackRows)).toBe(true);
    expect(data.review.score).toBeGreaterThanOrEqual(0);
    expect(data.review.score).toBeLessThanOrEqual(100);
    expect(['Good', 'Meh', 'Bad']).toContain(data.review.verdict);
  });
});


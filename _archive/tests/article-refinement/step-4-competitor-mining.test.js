// ARCHIVED: Original path was tests/article-refinement/step-4-competitor-mining.test.js

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/content-magic/article-refinement/step-4-competitor-mining/route';

describe('Step 4: Competitor Mining', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should mine competitor ideas successfully', async () => {
    const request = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({
        articleId: 'test-article-id',
        competitorSummaries: 'Competitor content summary here',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.ideas).toBeDefined();
    expect(Array.isArray(data.ideas)).toBe(true);
    if (data.ideas.length > 0) {
      expect(data.ideas[0]).toHaveProperty('idea');
      expect(data.ideas[0]).toHaveProperty('whyItMatters');
      expect(data.ideas[0]).toHaveProperty('importance');
    }
  });
});


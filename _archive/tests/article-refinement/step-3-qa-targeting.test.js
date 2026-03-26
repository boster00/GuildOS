// ARCHIVED: Original path was tests/article-refinement/step-3-qa-targeting.test.js

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/content-magic/article-refinement/step-3-qa-targeting/route';

describe('Step 3: Q&A Targeting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should generate Q&A targets successfully', async () => {
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
    expect(data.qaTargets).toBeDefined();
    expect(Array.isArray(data.qaTargets)).toBe(true);
    if (data.qaTargets.length > 0) {
      expect(data.qaTargets[0]).toHaveProperty('question');
      expect(data.qaTargets[0]).toHaveProperty('answerAngle');
      expect(data.qaTargets[0]).toHaveProperty('sectionTarget');
    }
  });
});


// ARCHIVED: Original path was tests/article-refinement/step-6-change-checklist.test.js

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/content-magic/article-refinement/step-6-change-checklist/route';

describe('Step 6: Change Checklist', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should generate change checklist successfully', async () => {
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
    expect(data.checklist).toBeDefined();
    expect(Array.isArray(data.checklist)).toBe(true);
    if (data.checklist.length > 0) {
      expect(data.checklist[0]).toHaveProperty('id');
      expect(data.checklist[0]).toHaveProperty('label');
      expect(data.checklist[0]).toHaveProperty('description');
      expect(data.checklist[0]).toHaveProperty('category');
    }
  });
});


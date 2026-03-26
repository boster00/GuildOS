// ARCHIVED: Original path was tests/article-refinement/step-8-internal-linking.test.js

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/content-magic/article-refinement/step-8-internal-linking/route';

describe('Step 8: Internal Linking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should generate internal linking plan successfully', async () => {
    const request = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({
        articleId: 'test-article-id',
        domain: 'example.com',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.linksPlan).toBeDefined();
    expect(data.linksPlan).toHaveProperty('linksFromThisArticle');
    expect(data.linksPlan).toHaveProperty('linksToThisArticle');
    expect(Array.isArray(data.linksPlan.linksFromThisArticle)).toBe(true);
  });
});


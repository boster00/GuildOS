// ARCHIVED: Original path was tests/article-refinement/step-2-keyword-strategy.test.js

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/content-magic/article-refinement/step-2-keyword-strategy/route';

describe('Step 2: Keyword Strategy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should generate keyword strategy successfully', async () => {
    const request = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({
        articleId: 'test-article-id',
        candidateKeywords: [
          { keyword: 'test keyword 1', volume: 1000 },
          { keyword: 'test keyword 2', volume: 500 },
        ],
        targetWordCount: 1500,
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.strategy).toHaveProperty('selectedKeywords');
    expect(Array.isArray(data.strategy.selectedKeywords)).toBe(true);
  });

  it('should return 400 if no candidate keywords provided', async () => {
    const request = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({
        articleId: 'test-article-id',
        candidateKeywords: [],
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('candidate keywords');
  });
});


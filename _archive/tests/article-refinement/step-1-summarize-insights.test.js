// ARCHIVED: Original path was tests/article-refinement/step-1-summarize-insights.test.js

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/content-magic/article-refinement/step-1-summarize-insights/route';
import { createClient } from '@/libs/supabase/server';

describe('Step 1: Summarize Insights', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should summarize author insights successfully', async () => {
    const request = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({
        articleId: 'test-article-id',
        authorInsights: 'Test insights about the article',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.brief).toHaveProperty('mustInclude');
    expect(data.brief).toHaveProperty('niceToInclude');
    expect(data.brief).toHaveProperty('avoid');
    expect(data.brief).toHaveProperty('clarifiedPurpose');
  });

  it('should return 400 if articleId is missing', async () => {
    const request = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({
        authorInsights: 'Test insights',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('required');
  });

  it('should return 401 if user is not authenticated', async () => {
    const mockGetUser = vi.fn(() => Promise.resolve({ data: { user: null } }));
    const mockSupabase = {
      auth: { getUser: mockGetUser },
      from: vi.fn(),
    };
    
    vi.mocked(createClient).mockReturnValue(mockSupabase);

    const request = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({
        articleId: 'test-article-id',
        authorInsights: 'Test insights',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toContain('Unauthorized');
  });
});


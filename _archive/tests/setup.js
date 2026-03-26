// ARCHIVED: Original path was tests/setup.js

// Test setup file
import { vi } from 'vitest';

// Mock environment variables
process.env.AI_MODEL_STANDARD = 'gpt-4o';
process.env.CHATGPT_API_KEY = 'test-api-key';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

// Create a reusable mock Supabase client factory
export function createMockSupabaseClient() {
  const mockArticle = {
    id: 'test-article-id',
    title: 'Test Article',
    content_html: '<h1>Test</h1><h2>Section 1</h2><p>Content</p>',
    icp_id: 'test-icp-id',
    user_id: 'test-user-id',
    assets: {},
    context: { searchQuery: 'test keyword' },
  };

  const mockICP = {
    id: 'test-icp-id',
    name: 'Test ICP',
    offer_names: 'Test Offer',
  };

  return {
    auth: {
      getUser: vi.fn(() => Promise.resolve({
        data: {
          user: {
            id: 'test-user-id',
            email: 'test@example.com',
          },
        },
      })),
    },
    from: vi.fn((table) => {
      if (table === 'content_magic_articles') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn((field, value) => {
              if (field === 'id') {
                return {
                  eq: vi.fn(() => ({
                    single: vi.fn(() => Promise.resolve({
                      data: mockArticle,
                      error: null,
                    })),
                  })),
                };
              }
              return {
                single: vi.fn(() => Promise.resolve({
                  data: mockArticle,
                  error: null,
                })),
              };
            }),
          })),
          update: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                select: vi.fn(() => Promise.resolve({
                  data: [mockArticle],
                  error: null,
                })),
              })),
            })),
          })),
        };
      }
      if (table === 'icps') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(() => Promise.resolve({
                  data: mockICP,
                  error: null,
                })),
              })),
            })),
          })),
        };
      }
      return {};
    }),
  };
}

// Mock Supabase client
vi.mock('@/libs/supabase/server', () => ({
  createClient: vi.fn(() => {
    // This will be set up in individual tests
    return createMockSupabaseClient();
  }),
}));

// Mock monkey AI
vi.mock('@/libs/monkey', () => ({
  default: {
    AI: vi.fn((prompt, options) => {
      // Return mock JSON responses based on prompt content
      if (prompt.includes('Summarize these notes')) {
        return Promise.resolve(JSON.stringify({
          mustInclude: ['Must include point 1', 'Must include point 2'],
          niceToInclude: ['Nice to have 1'],
          avoid: ['Avoid this'],
          clarifiedPurpose: 'Test purpose',
        }));
      }
      if (prompt.includes('Secondary keywords')) {
        return Promise.resolve(JSON.stringify({
          recommendedSecondaryCount: 5,
          selectedKeywords: [
            { keyword: 'keyword 1', reason: 'Good fit', priority: 'high' },
            { keyword: 'keyword 2', reason: 'Relevant', priority: 'medium' },
          ],
        }));
      }
      if (prompt.includes('Q&A-style blocks')) {
        return Promise.resolve(JSON.stringify([
          { question: 'Test question?', answerAngle: 'Test answer', sectionTarget: 'section_0' },
        ]));
      }
      if (prompt.includes('competitor content')) {
        return Promise.resolve(JSON.stringify([
          { idea: 'Test idea', whyItMatters: 'Important', importance: 'essential' },
        ]));
      }
      if (prompt.includes('placement')) {
        return Promise.resolve(JSON.stringify({
          placements: [
            { type: 'keyword', source: 'test', sectionTarget: 'section_0', role: 'paragraph', note: 'Test note' },
          ],
        }));
      }
      if (prompt.includes('change checklist')) {
        return Promise.resolve(JSON.stringify([
          { id: 'change_1', label: 'Test change', description: 'Test description', category: 'keyword' },
        ]));
      }
      if (prompt.includes('Implement changes')) {
        return Promise.resolve(JSON.stringify({
          updatedArticle: '<h1>Updated</h1><p>New content</p>',
          changelog: ['Change 1', 'Change 2'],
        }));
      }
      if (prompt.includes('internal links')) {
        return Promise.resolve(JSON.stringify({
          linksFromThisArticle: [
            { anchorText: 'test link', destinationUrl: 'https://example.com', reason: 'Test reason' },
          ],
          linksToThisArticle: [
            { sourcePage: 'Test page', suggestedAnchorContext: 'Context', reason: 'Test reason' },
          ],
        }));
      }
      if (prompt.includes('Final Editorial Review')) {
        return Promise.resolve(`Score: 85/100
Verdict: Good
! H1 Missing: Add primary keyword to H1
✅ Clear Structure: Headings are well organized
→ Add CTA: Consider adding a call-to-action`);
      }
      return Promise.resolve('{}');
    }),
  },
}));


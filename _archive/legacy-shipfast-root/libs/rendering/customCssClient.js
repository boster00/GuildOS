/**
 * Per-component-instance in-memory cache for custom CSS markup.
 * No localStorage or persistent cache; avoids refetch during the same mounted session.
 */

import { initMonkey } from '@/libs/monkey';

const DEFAULT_KEY = 'profile';

/**
 * Creates a cache instance for custom CSS. Use one per component instance.
 * @returns {{ get: (key?: string) => Promise<string>, clear: () => void }}
 */
export function createCustomCssCache() {
  const cache = new Map();

  return {
    /**
     * Get custom CSS markup (HTML string of <link> and <style> tags).
     * @param {string} [key] - Optional cache key; defaults to user profile. Pass same key to reuse cached value.
     * @returns {Promise<string>}
     */
    async get(key = DEFAULT_KEY) {
      if (cache.has(key)) return cache.get(key);
      const monkey = await initMonkey(true);
      const markup = await monkey.getCustomCssTagsForShadowDom();
      cache.set(key, markup);
      return markup;
    },

    clear() {
      cache.clear();
    },
  };
}

import { assertPlainJson } from '@/libs/shared/assertPlainJson';

/**
 * Centralized article asset management with integrity guarantees
 */
export class ArticleAssetManager {
  constructor(monkey) {
    this.monkey = monkey;
    // Write queue to serialize concurrent saves per article
    this._writeQueues = new Map(); // articleId -> Promise chain
  }

  /**
   * Patch existing assets (merge with current state)
   * @param {string} articleId - Article ID
   * @param {object} patch - Fields to update/add (MUST be serializable)
   * @param {object} currentAssets - Current assets to merge with
   * @param {function} updateArticleContext - Optional context updater
   * @returns {Promise<object>} Merged assets
   * @throws {Error} If patch contains non-serializable data
   */
  async savePatch(articleId, patch, currentAssets = {}, updateArticleContext = null) {
    
    // Validate patch is plain JSON (deep scan)
    try {
      assertPlainJson(patch, 'patch');
    } catch (validationErr) {
      
      throw validationErr;
    }

    // Serialize writes per article to prevent race conditions
    return this._enqueueWrite(articleId, async () => {

      // Send only patch - server will merge with latest DB state
      let responseText;
      try {
        responseText = await this.monkey.apiCall("/api/content-magic/save-assets", {
          articleId,
          mode: 'patch',
          patch
        });
      } catch (apiErr) {

        throw apiErr;
      }

      const response = JSON.parse(responseText);

      if (!response.ok) {
        throw new Error(response.error || "Failed to save asset patch");
      }

      // Server returns merged result (always trust server)
      if (!response.assets) {
        throw new Error('Server did not return merged assets');
      }

      if (updateArticleContext) {
        updateArticleContext({ assets: response.assets });
      }

      return response.assets;
    });
  }

  /**
   * Replace entire asset object (use with caution - for deletions only)
   * @param {string} articleId - Article ID
   * @param {object} fullAssets - Complete asset object (MUST be serializable)
   * @param {function} updateArticleContext - Optional context updater
   * @returns {Promise<object>} Saved assets
   * @throws {Error} If fullAssets contains non-serializable data
   */
  async saveReplace(articleId, fullAssets, updateArticleContext = null) {
    assertPlainJson(fullAssets, 'fullAssets');

    return this._enqueueWrite(articleId, async () => {
      const responseText = await this.monkey.apiCall("/api/content-magic/save-assets", {
        articleId,
        mode: 'replace',
        assets: fullAssets
      });

      const response = JSON.parse(responseText);

      if (!response.ok) {
        throw new Error(response.error || "Failed to replace assets");
      }

      if (updateArticleContext) {
        updateArticleContext({ assets: fullAssets });
      }

      return fullAssets;
    });
  }

  /**
   * Refresh GEO report (AI optimization score) for an article.
   * Calls API, parses response, returns ready-to-use object. Do not call /api/content-magic/ai-optimization-score via fetch directly.
   * API also persists GEOReport to article.assets on the server. Caller should merge result into local article state.
   * Response includes suggestions (priority + reasoning per prompt) for Implement Prompts downstream.
   * @param {string} articleId
   * @param {string} contentHtml - Current article content for evaluation
   * @returns {Promise<{ success: boolean, score: number, rationale: object, suggestions: Array }>}
   */
  async refreshGeoReport(articleId, contentHtml) {
    const responseText = await this.monkey.apiCall("/api/content-magic/ai-optimization-score", {
      articleId,
      contentHtml: contentHtml || "",
    });
    const data = JSON.parse(responseText);
    if (data.error) {
      throw new Error(data.error);
    }
    return {
      success: data.success === true,
      score: data.score,
      rationale: data.rationale,
      suggestions: data.suggestions ?? [],
    };
  }

  /**
   * Serialize writes per article to prevent race conditions
   * @private
   */
  _enqueueWrite(articleId, writeOperation) {
    const existingQueue = this._writeQueues.get(articleId) || Promise.resolve();
    
    const newQueue = existingQueue
      .then(() => writeOperation())
      .catch((err) => {

        throw err;
      })
      .finally(() => {
        // Clean up queue if this was the last operation
        if (this._writeQueues.get(articleId) === newQueue) {
          this._writeQueues.delete(articleId);
        }
      });

    this._writeQueues.set(articleId, newQueue);
    return newQueue;
  }
}

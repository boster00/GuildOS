import { AsyncLocalStorage } from "node:async_hooks";

/** @typedef {{ userId: string, client: import("@/libs/council/database/types.js").DatabaseClient }} AdventurerExecutionContext */

const storage = new AsyncLocalStorage();

/**
 * Async context for `libs/adventurer/index.js` execution: userId + Supabase client for saves and skill actions.
 * @param {AdventurerExecutionContext} ctx
 * @param {() => Promise<T>} fn
 * @returns {Promise<T>}
 * @template T
 */
export function runWithAdventurerExecutionContext(ctx, fn) {
  return storage.run(ctx, fn);
}

/** @returns {AdventurerExecutionContext | undefined} */
export function getAdventurerExecutionContext() {
  return storage.getStore();
}

/** @returns {string | undefined} */
export function getAdventurerExecutionUserId() {
  return storage.getStore()?.userId;
}

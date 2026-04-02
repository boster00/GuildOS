/**
 * AsyncLocalStorage scope for adventurer skill execution (quest owner + DB client).
 * Node-only; import from `@/libs/adventurer` (barrel) or this file directly.
 */
import { AsyncLocalStorage } from "node:async_hooks";

/** @typedef {{ userId: string, client: import("@/libs/council/database/types.js").DatabaseClient }} AdventurerExecutionContext */

const adventurerExecutionStorage = new AsyncLocalStorage();

/**
 * @param {AdventurerExecutionContext} ctx
 * @param {() => Promise<T> | T} fn
 * @returns {Promise<T>}
 * @template T
 */
export function runWithAdventurerExecutionContext(ctx, fn) {
  return adventurerExecutionStorage.run(ctx, fn);
}

/** @returns {AdventurerExecutionContext | undefined} */
export function getAdventurerExecutionContext() {
  return adventurerExecutionStorage.getStore();
}

/** @returns {string | undefined} */
export function getAdventurerExecutionUserId() {
  return adventurerExecutionStorage.getStore()?.userId;
}

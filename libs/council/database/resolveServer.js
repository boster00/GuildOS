import { createClient as createServerClient } from "./supabase/server.js";

/**
 * @param {import("./types.js").DatabaseClient | undefined} injected
 * @returns {Promise<import("./types.js").DatabaseClient>}
 */
export async function resolveServerClient(injected) {
  return injected ?? (await createServerClient());
}

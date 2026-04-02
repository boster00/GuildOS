/**
 * @file Standard usage (server):
 *
 * ```js
 * import { database } from "@/libs/council/database";
 *
 * const db = await database.init("server");
 * ```
 *
 * Runtimes: `"server"` (SSR + cookies), `"client"` (browser), `"service"` (service role).
 * `"server"` is **never cached**: each call returns a new client bound to the current `cookies()` context.
 * `"client"` and `"service"` are cached per process after the first `init`.
 *
 * After `init("client"|"service")`, the `database` proxy forwards to that cached client (not for `"server"`).
 */
import { createClient as createServerClient } from "./supabase/server.js";
import { createClient as createBrowserClient } from "./supabase/client.js";
import { createServiceClient } from "./supabase/service.js";

// Do not uncomment or reintroduce barrel exports of raw Supabase factories. All app/libs code must use
// `import { database } from "@/libs/council/database"` and `await database.init(...)`. Re-exporting
// createServerClient / createServiceClient here invites the old pattern and breaks the single entry point.
// export { createServerClient, createBrowserClient, createServiceClient, resolveServerClient };

/** @type {Map<string, import("@supabase/supabase-js").SupabaseClient>} */
const clientsByRuntime = new Map();

/**
 * Wire the `database` facade to a Supabase client for this runtime.
 * Safe to call more than once for `"client"` and `"service"` (cached). Call `"server"` whenever you need
 * the SSR user — typically once at the start of a route handler or RSC, not at module top level.
 *
 * @param {'server' | 'client' | 'service'} runtime
 */
async function init(runtime) {
  const r = String(runtime).toLowerCase();
  if (r === "server") {
    return await createServerClient();
  }
  if (clientsByRuntime.has(r)) {
    return clientsByRuntime.get(r);
  }
  let client;
  if (r === "client") {
    client = createBrowserClient();
  } else if (r === "service") {
    client = createServiceClient();
  } else {
    throw new Error(
      `Unknown database runtime "${runtime}". Use "server", "client", or "service".`,
    );
  }
  clientsByRuntime.set(r, client);
  return client;
}

function proxyTarget() {
  if (clientsByRuntime.size === 0) {
    return null;
  }
  return clientsByRuntime.values().next().value;
}

/**
 * After `await database.init(...)`, `database` forwards to the Supabase client (`from`, `auth`, `storage`, …).
 */
export const database = new Proxy(
  {},
  {
    get(_target, prop, _receiver) {
      if (prop === "init") {
        return init;
      }
      const supabaseClient = proxyTarget();
      if (supabaseClient == null) {
        throw new Error(
          'Database is not initialized. Call await database.init("server"|"client"|"service") first.',
        );
      }
      const value = supabaseClient[prop];
      if (typeof value === "function") {
        return value.bind(supabaseClient);
      }
      return value;
    },
  },
);

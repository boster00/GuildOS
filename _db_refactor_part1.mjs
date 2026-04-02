import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = __dirname;

function w(rel, text) {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, text.trimStart() + (text.endsWith("\n") ? "" : "\n"), "utf8");
}

w("libs/council/database/types.js", `/**
 * @typedef {import("@supabase/supabase-js").SupabaseClient} DatabaseClient
 */

export {};
`);

w("libs/council/database/resolveServer.js", `import { createClient as createServerClient } from "./supabase/server.js";

/**
 * @param {import("./types.js").DatabaseClient | undefined} injected
 * @returns {Promise<import("./types.js").DatabaseClient>}
 */
export async function resolveServerClient(injected) {
  return injected ?? (await createServerClient());
}
`);

w("libs/council/database/index.js", `import { createClient as createServerClient } from "./supabase/server.js";
import { createClient as createBrowserClient } from "./supabase/client.js";
import { createServiceClient } from "./supabase/service.js";
import { resolveServerClient } from "./resolveServer.js";
import * as serverQuest from "./serverQuest.js";
import * as serverAdventurer from "./serverAdventurer.js";

export { createServerClient, createBrowserClient, createServiceClient, resolveServerClient };

/** @typedef {import("./types.js").DatabaseClient} DatabaseClient */

export const database = {
  server: {
    quests: serverQuest,
    adventurers: serverAdventurer,
  },
};
`);

console.log("ok");

/**
 * Shared bootstrap for claude-scripts.
 * Import this as a static import at the top of each script — its side effects
 * (env loading + @/ resolver registration) run before the script body.
 *
 *   import { db } from "./claude-scripts/_loader.js";
 *   // now dynamic imports of @/ modules work:
 *   const { advance } = await import("@/libs/quest/index.js");
 */
import { config } from "dotenv";
import { register } from "node:module";
import { pathToFileURL } from "node:url";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const projectRoot = resolve(__dirname, "..");

// Load .env.local
config({ path: resolve(projectRoot, ".env.local") });

// Register @/ → project root resolver (embeds the resolved file URL as a literal)
// Also handles directory imports (resolves to /index.js) for Node.js ESM compat.
if (!globalThis.__guildosLoaderRegistered) {
  globalThis.__guildosLoaderRegistered = true;
  const rootUrl = pathToFileURL(projectRoot + "/").href;
  // rootPath is used in the resolver to check if the path is a directory
  // next/headers mock: returns stubs so modules that statically import it don't crash outside Next.js
  const NEXT_HEADERS_MOCK = "data:text/javascript," + encodeURIComponent(
    `export async function cookies() { return { get: () => undefined, getAll: () => [], set: () => {}, delete: () => {} }; }
     export async function headers() { return new Headers(); }`
  );

  register(
    "data:text/javascript," +
      encodeURIComponent(
        `import { statSync } from "node:fs";
        import { fileURLToPath } from "node:url";
        function statKind(p) {
          try { const s = statSync(p); return s.isDirectory() ? "dir" : "file"; } catch { return null; }
        }
        export function resolve(specifier, context, next) {
          // Mock next/headers so modules importing it don't crash outside Next.js
          if (specifier === "next/headers") return { url: ${JSON.stringify(NEXT_HEADERS_MOCK)}, shortCircuit: true };
          if (specifier === "next/cache") return { url: "data:text/javascript,export function unstable_cache(fn){return fn;} export function revalidateTag(){}; export function revalidatePath(){}", shortCircuit: true };
          if (specifier.startsWith("@/")) {
            let url = ${JSON.stringify(rootUrl)} + specifier.slice(2);
            const p = fileURLToPath(url);
            const kind = statKind(p);
            if (kind === "dir") url += "/index.js";
            else if (kind === null) {
              if (statKind(p + ".js") === "file") url += ".js";
            }
            return next(url, context);
          }
          return next(specifier, context);
        }`,
      ),
    pathToFileURL(projectRoot + "/"),
  );
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SECRETE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRETE_KEY in .env.local");
  process.exit(1);
}

/** Service-role Supabase client — use for all DB operations in scripts */
export const db = createClient(supabaseUrl, supabaseKey);

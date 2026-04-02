import { createClient } from "@supabase/supabase-js";
import { getSupabaseSecretKey } from "@/libs/council/auth/env";

/**
 * Server-only client with secret key (bypasses RLS). Used by cron and other trusted server jobs.
 * @throws {Error} If URL or secret key is missing — message lists what to set in `.env.local`.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = getSupabaseSecretKey();

  if (!url?.trim()) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL. Add it to .env.local (Supabase → Project Settings → API → Project URL).",
    );
  }
  if (!secretKey?.trim()) {
    throw new Error(
      "Missing Supabase secret key for server jobs (cron, service client). Add one of these to .env.local:\n" +
        "  SUPABASE_SECRET_KEY (preferred naming in newer Supabase docs), or\n" +
        "  SUPABASE_SERVICE_ROLE_KEY (legacy name)\n" +
        "Value: Supabase → Project Settings → API → secret (service_role) key. Never expose this in the browser.",
    );
  }

  return createClient(url, secretKey);
}

import { createBrowserClient } from "@supabase/ssr"; // pragma: allowlist secret
import { getSupabasePublicEnv } from "@/libs/council/auth/env";

export function createClient() {
  const { url, publishableKey } = getSupabasePublicEnv();
  return createBrowserClient(url, publishableKey);
}

/**
 * Pure service-role client (no cookies, no user session).
 * Use for cron, VT pipeline, and other server ops that must bypass RLS.
 * The SSR createServerClient(service_role_key) can inherit user session from cookies;
 * this client never uses cookies and always runs as service_role.
 */
import { createClient } from "@supabase/supabase-js";

export function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  return createClient(url, key);
}

const urlEnv = "NEXT_PUBLIC_" + "SU" + "PAB" + "ASE" + "_URL";

/**
 * Supabase moved from anon/service-role wording to publishable/secret keys.
 * Keep fallback support so existing local env files keep working.
 */
export function getSupabasePublicEnv() {
  const url = process.env[urlEnv];
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !publishableKey) {
    throw new Error(
      "Missing Supabase public env vars. Required: NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY."
    );
  }

  return { url, publishableKey };
}

export function getSupabaseSecretKey() {
  return (
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SECRETE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    ""
  );
}

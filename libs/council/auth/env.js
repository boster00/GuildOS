const urlEnv = "NEXT_PUBLIC_" + "SU" + "PAB" + "ASE" + "_URL";

/**
 * Supabase moved from anon/service-role wording to publishable/secret keys.
 * Keep fallback support so existing local env files keep working.
 *
 * GuildOS-namespaced fallback chain (added 2026-04-27): when an agent
 * works on multiple repos at once (e.g. CJGEO with its own Supabase +
 * GuildOS for quest bookkeeping), the basic SUPABASE_* env names
 * collide. To disambiguate, the agent's environment may set
 * GUILDOS_NEXT_PUBLIC_SUPABASE_URL / GUILDOS_NEXT_PUBLIC_SUPABASE_KEY /
 * GUILDOS_SUPABASE_SECRETE_KEY pointing at the GuildOS project. This
 * module checks the GUILDOS_-prefixed names FIRST so the project's own
 * SUPABASE_* vars can still point at the project's Supabase without
 * breaking GuildOS access. Cursor global / project envs should set
 * the GUILDOS_-prefixed vars; local dev (this repo) sets both.
 */

export function getSupabasePublicEnv() {
  const url =
    process.env.GUILDOS_NEXT_PUBLIC_SUPABASE_URL ||
    process.env[urlEnv];
  const publishableKey =
    process.env.GUILDOS_NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.GUILDOS_NEXT_PUBLIC_SUPABASE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !publishableKey) {
    throw new Error(
      "Missing Supabase public env vars. Required: NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or the GUILDOS_-prefixed equivalents when working in a multi-repo agent env)."
    );
  }

  return { url, publishableKey };
}

export function getSupabaseSecretKey() {
  return (
    process.env.GUILDOS_SUPABASE_SECRET_KEY ||
    process.env.GUILDOS_SUPABASE_SECRETE_KEY ||
    process.env.GUILDOS_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SECRETE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    ""
  );
}

/**
 * Resolve the GuildOS Supabase URL specifically (used by orchestrators
 * spawning agents — e.g. cursor.writeAgent setup-block — where
 * "GuildOS" must be unambiguous regardless of whether the orchestrator
 * is also wired into a project's own Supabase).
 */
export function getGuildosSupabaseUrl() {
  return (
    process.env.GUILDOS_NEXT_PUBLIC_SUPABASE_URL ||
    process.env[urlEnv] ||
    ""
  );
}

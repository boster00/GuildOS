/**
 * Pure-JS module: builds the GuildOS-credentials shell-setup block that
 * `cursor.writeAgent` prepends to every spawn prompt.
 *
 * Extracted so node scripts (which can't resolve `@/libs/...` Next path
 * aliases) and the Next-runtime weapon both consume the same source.
 * No imports — keep it that way so this module is consumable from any
 * runtime without adapter shims.
 */

/**
 * @param {{ supabaseUrl: string, supabaseKey: string }} input
 * @returns {string} shell-setup block to prepend to a Cursor agent's spawn prompt
 */
export function guildosCredentialsSetupBlock({ supabaseUrl, supabaseKey } = {}) {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "guildosCredentialsSetupBlock: supabaseUrl + supabaseKey are required. " +
      "Caller is responsible for sourcing them from process.env (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SECRETE_KEY) " +
      "or profiles.env_vars before invoking the spawn."
    );
  }
  return [
    "═════════════════════════════════════════════════════════════════════",
    "FIRST ACTION — provision GuildOS credentials (do this BEFORE anything else)",
    "═════════════════════════════════════════════════════════════════════",
    "",
    "Run these shell commands verbatim to set up your GuildOS access:",
    "",
    "```bash",
    "mkdir -p ~/guildos",
    "cat > ~/.guildos.env <<'EOF'",
    `export NEXT_PUBLIC_SUPABASE_URL='${supabaseUrl}'`,
    `export SUPABASE_SECRETE_KEY='${supabaseKey}'`,
    "EOF",
    "echo 'source ~/.guildos.env' >> ~/.bashrc",
    "source ~/.guildos.env",
    "test -n \"$SUPABASE_SECRETE_KEY\" && echo 'GuildOS creds loaded' || echo 'FAILED — escalate'",
    "```",
    "",
    "After that, run housekeeping.initAgent (clones GuildOS, loads skill books, finds your quests). The init step assumes the env is already loaded.",
    "",
    "═════════════════════════════════════════════════════════════════════",
    "TASK PROMPT",
    "═════════════════════════════════════════════════════════════════════",
    "",
  ].join("\n");
}

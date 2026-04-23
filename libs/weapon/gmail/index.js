/**
 * Gmail weapon — MCP pointer (no Node runtime logic).
 *
 * All Gmail actions are performed via the `gmail` MCP server
 * (`@gongrzhe/server-gmail-autoauth-mcp`) which wraps the Gmail REST API
 * through a Google OAuth refresh token. The runtime surface is agent-only:
 * Claude (local) or a Cursor cloud agent with this MCP mounted calls the
 * `mcp__gmail__*` tools directly. No browser, no CIC.
 *
 * There are deliberately no exported functions here — GuildOS is agent-driven,
 * and Gmail has no server-code call sites. If a server-side caller ever
 * genuinely needs Gmail, dispatch a pigeon letter to an agent rather than
 * inlining REST calls.
 *
 * ─── Setup (one-time, local) ──────────────────────────────────────────────
 * 1. `~/.gmail-mcp/gcp-oauth.keys.json` — Google OAuth "installed" client:
 *      { "installed": { "client_id": <GMAIL_MCP_CLIENT_ID>,
 *                       "client_secret": <GMAIL_MCP_CLIENT_SECRET>,
 *                       "redirect_uris": ["http://localhost"] } }
 *    Credentials live in profiles.env_vars (formulary):
 *      GMAIL_MCP_CLIENT_ID, GMAIL_MCP_CLIENT_SECRET.
 *
 * 2. `~/.gmail-mcp/credentials.json` — refresh-token bundle:
 *      { "access_token": "",
 *        "refresh_token": <GOOGLE_GMAIL_REFRESH_TOKEN from formulary>,
 *        "scope": "https://www.googleapis.com/auth/gmail.readonly
 *                  https://www.googleapis.com/auth/gmail.modify",
 *        "token_type": "Bearer",
 *        "expiry_date": 1 }
 *    gongrzhe's server auto-refreshes the access token on every call.
 *
 * 3. Register in `~/.claude.json` under the GuildOS project:
 *      "mcpServers": { "gmail": { "type":"stdio",
 *        "command":"npx", "args":["-y","@gongrzhe/server-gmail-autoauth-mcp"] } }
 *
 * ─── Scope note ──────────────────────────────────────────────────────────
 * The stored refresh token grants only `gmail.readonly` + `gmail.modify`.
 * Read / triage / star / label tools work. `send_email`, `draft_email`,
 * `create_filter`, `*_label` mutations require a fresh consent with broader
 * scopes — redo OAuth if/when send is needed.
 *
 * ─── MCP tool names (all prefixed `mcp__gmail__` in agent context) ───────
 * Read:    search_emails, read_email, list_email_labels, list_filters,
 *          get_filter, download_attachment
 * Modify:  modify_email, batch_modify_emails
 * Delete:  delete_email, batch_delete_emails, delete_label, delete_filter
 *          (destructive — require user confirmation)
 * Write:   draft_email, send_email, create_label, update_label,
 *          get_or_create_label, create_filter, create_filter_from_template
 *          (blocked until scopes expanded)
 */

export const toc = {
  // Intentionally empty. Gmail actions are MCP tools, not weapon exports.
  // Agents discover capabilities via the MCP server at connection time.
};

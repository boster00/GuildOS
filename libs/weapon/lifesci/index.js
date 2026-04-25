/**
 * LifeSci Intel weapon — CIC pointer (no Node runtime logic).
 *
 * The LifeSci Intel app is a private surface inside boster_nexus:
 *   - prod:  https://nexus.bosterbio.com/lifesci-intel
 *   - local: http://localhost:3001/lifesci-intel  (port-locked in CLAUDE.md)
 *   - test:  /lifesci-intel/test  (full-pipeline feasibility page)
 *
 * It exposes no public JSON endpoints an agent can hit directly. The
 * `/api/lifesci/*` routes are session-gated (Supabase auth, same cookie the
 * browser tab carries), so programmatic access without a real session fails.
 * Every agent interaction therefore goes through the UI.
 *
 * ─── How to drive it (LOCAL Claude only) ─────────────────────────────────
 * Use Claude-in-Chrome MCP tools — the user's real Chrome already holds the
 * Supabase session, so navigating to the page is enough:
 *
 *   1. `mcp__Claude_in_Chrome__tabs_context_mcp` ({ createIfEmpty: true })
 *      — get/seed a tab group for this objective.
 *   2. `mcp__Claude_in_Chrome__tabs_create_mcp` to the target sub-page (prod
 *      URL unless the user is specifically testing local changes).
 *   3. Observe→act→observe: after each `find`/`form_input`/`preview_click`,
 *      screenshot + `read_page` before the next step. No batch scripts.
 *
 * If the page renders the ButtonAccount login CTA instead of the panels, the
 * Chrome session is not signed in — stop and ask the user to log in.
 *
 * ─── How NOT to drive it ─────────────────────────────────────────────────
 * - Do NOT call `/api/lifesci/*` from Node — no service-role shortcut exists
 *   and the session cookie isn't available to server code here.
 * - Do NOT dispatch this weapon to a Cursor cloud agent — cloud VMs don't
 *   hold the user's nexus.bosterbio.com session, and capturing an auth state
 *   for nexus isn't wired up. Local CIC only.
 * - Do NOT use the deprecated Browserclaw CDP path. CIC is the sole local
 *   browser path (see CLAUDE.md Insights buffer, 2026-04-23).
 *
 * ─── Key surfaces (for orienting CIC work) ───────────────────────────────
 * /lifesci-intel            — landing; two-objective overview + test page CTA
 * /lifesci-intel/test       — end-to-end pipeline:
 *   · Obj1ImportPanel       — upload SciLeads CSV, preview column mapping,
 *                             run import
 *   · Obj2OrderPanel        — paste / select an order email, triage identity
 *   · ResultsPanel          — audit log of enrichment steps (E1–E4)
 *
 * Feature notes live in `boster_nexus/docs/lifesci-intel-strategies.md` and
 * the source at `boster_nexus/libs/lifesci/` (identity-resolver, enrichment,
 * column-mapper, importer, email-connector, order triage).
 */

export const toc = {
  // Intentionally empty. LifeSci Intel actions are CIC-driven UI interactions,
  // not weapon exports. Agents use mcp__Claude_in_Chrome__* tools directly,
  // using the guidance above to pick a sub-page and drive the panels.
};

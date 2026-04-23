# Browser Automation Guideline

## Rule of thumb

| Environment | Use this for browser work |
|---|---|
| **Local Claude** (Guildmaster / PA / Claude Code CLI) | **Claude-in-Chrome (CIC)** — the `mcp__Claude_in_Chrome__*` MCP tools only |
| **Cursor cloud agents** (on Linux VM) | The VM's own native Playwright + headed Chrome. Do NOT use CIC. Do NOT reach for `localhost:9222`. |

CIC is the only browser-control path for local Claude. The old Browserclaw CDP weapon on port 9222 is deprecated — kept only for a couple of legacy pipeline scripts.

---

## Claude-in-Chrome (CIC) — how to use

1. **Always start with tab context.** Seeds the group if empty, lists existing tabs.
   ```
   mcp__Claude_in_Chrome__tabs_context_mcp({ createIfEmpty: true })
   // → { availableTabs: [{ tabId, title, url }], tabGroupId }
   ```

2. **One tab group per objective.** If you start a new objective, open a fresh tab:
   ```
   mcp__Claude_in_Chrome__tabs_create_mcp()
   ```
   Don't reuse a tab from an unrelated previous objective — the user relies on the tab group as the visual record of what was done.

3. **Navigate and interact.** Use `navigate`, `find`, `read_page`, `get_page_text`, `computer` (click/type/scroll/screenshot/key).

4. **Observe → act → observe.** After every meaningful action, screenshot or `read_page` before the next step. Never batch-script.

**If "Claude in Chrome is not connected":** The extension isn't running in the user's main Chrome. This is not programmatically fixable — the user must open Chrome and re-authenticate the extension. Escalate.

---

## Cloud Cursor agents — how THEY browse

Cloud agents have a Linux desktop (X11, DISPLAY=:1) with headed Chrome at `/usr/local/bin/google-chrome` and Playwright available. They drive this themselves. When dispatching work:

- Describe the objective and the screenshots you want; let the agent pick Playwright calls natively.
- Do NOT send CIC MCP tool names in the prompt — the agent has no access to them.
- Do NOT reference `port 9222` or the local CDP profile — unreachable from the cloud.
- Auth: pass Playwright's `storageState` via `playwright/.auth/user.json`, which the user refreshes locally with `node scripts/auth-capture.mjs`.

---

## Auth state for cloud agents

`scripts/auth-capture.mjs` is a local-only helper that opens a regular Chrome, waits for you to log in to services (Gmail, Zoho, LinkedIn, Smartlead, Figma, etc.), then dumps cookies + localStorage to `playwright/.auth/user.json`. Cloud agents pass that file to `chromium.launchPersistentContext({ storageState: ... })` so their first navigation is already signed in.

This is the ONLY place in GuildOS where Playwright launches Chrome directly. All other local browser control goes through CIC MCP tools.

---

## Observation loop (applies to both CIC and cloud Playwright)

Navigate → screenshot → read → decide → act → screenshot → read → …

A batch script that runs 10 steps without reading results will silently fail on step 3 and keep going. Use your eyes every step.

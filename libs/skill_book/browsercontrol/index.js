/**
 * Browser control skill book.
 *
 * ── LOCAL CLAUDE: use Claude-in-Chrome (CIC), always ────────────────────────
 * When Claude runs locally (Guildmaster / PA / Claude Code CLI) and needs to
 * browse, use the Claude-in-Chrome MCP extension tools (`mcp__Claude_in_Chrome__*`).
 * CIC is the ONLY local browser control path. It opens a dedicated tab group per
 * objective, drives the user's real Chrome, and follows an observe→act→observe loop.
 *
 *   - Start with `tabs_context_mcp` (createIfEmpty: true) to get/seed the tab group.
 *   - Open a NEW tab per objective with `tabs_create_mcp` — never reuse a tab
 *     from a previous objective.
 *   - After every action, screenshot and `read_page`/`find` before the next step.
 *     No batch scripts.
 *
 * ── CLOUD CURSOR AGENTS: use the VM's native UI ─────────────────────────────
 * Cursor cloud agents run on a Linux VM with its own headed Chrome and
 * Playwright tooling. They drive the browser natively — do NOT dispatch CIC
 * commands from cloud agents, and do NOT instruct them to reach a local CDP
 * endpoint (port 9222 is not reachable from the cloud). Let them use their
 * built-in controls.
 */

export const skillBook = {
  id: "browsercontrol",
  title: "Browser control",
  description:
    "Guidance for browser work: local Claude uses Claude-in-Chrome MCP; cloud agents use their VM's native Playwright. Actions: captureAuth (export storageState for cloud), accessChromeExtensionPage (open chrome:// URLs via CIC).",
  steps: [],
  toc: {
    captureAuth: {
      description: "Export a storageState JSON that cloud agents can import as Playwright auth context.",
      howTo: `
Cloud Cursor agents on Linux VMs drive the browser natively via Playwright but start with a clean session. This script opens a local Chrome, waits for you to log in to whichever service(s) you want the cloud agents to inherit, and writes cookies + localStorage to \`playwright/.auth/user.json\`. Cloud agents then pass that file as Playwright's \`storageState\` to start authenticated.

\`\`\`bash
node scripts/auth-capture.mjs             # log in manually, exports JSON
node scripts/auth-load.mjs                # verify JSON export
\`\`\`

This is the only place in GuildOS where Playwright launches Chrome directly (\`launchPersistentContext\` with system Chrome). Local Claude uses Claude-in-Chrome MCP tools for browsing — NOT the captured profile.
`,
    },
    accessChromeExtensionPage: {
      description: "Navigate CIC to chrome://extensions/ (reload an extension, toggle dev mode, etc.).",
      howTo: `
Use the Claude-in-Chrome MCP \`navigate\` tool with URL \`chrome://extensions/\`.

**Critical:** the URL MUST include the trailing slash. \`chrome://extensions\` (no slash) silently fails to load via CIC — the tab navigates, no visible error, but the page never renders. Always use \`chrome://extensions/\`.

Same rule applies to other chrome:// URLs that end in a path segment: \`chrome://settings/\`, \`chrome://flags/\`, \`chrome://inspect/\`. Add the trailing slash when in doubt.

Common follow-ups once on chrome://extensions/:
- Reload an unpacked extension: \`find\` the extension's reload button (circular-arrow icon under its card) and click it.
- Toggle developer mode: top-right switch.
- After reloading, navigate to the target site (or tell the user to refresh their tab) so the new content script loads.

If the user has disabled the extension or uninstalled it, chrome://extensions/ is where you verify — but you cannot programmatically re-enable/re-install; ask the user.
`,
    },
  },
};

export default skillBook;

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
    "Guidance for browser work: local Claude uses Claude-in-Chrome MCP; cloud agents use their VM's native Playwright. One action: captureAuth (local Guildmaster only, for exporting a storageState JSON that cloud agents import).",
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
  },
};

export default skillBook;

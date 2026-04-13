# Cursor Cloud Agent — Capabilities Reference

*Self-reported by agent bc-fb70e14d, April 2026. Verified against observed behavior.*

## Environment

- **OS:** Linux (kernel 6.12.58+, x86_64)
- **Desktop:** X11 graphical session (`DISPLAY=:1`), resolution 1920x1200 (VNC)
- **GUI apps:** Yes — headed browsers work when `DISPLAY=:1` is set
- **Repo location:** `/workspace`
- **Disk:** ~126G total, ~109G free (overlay fs)
- **Persistence:** Files persist within a workspace's lifetime. No guarantee across sessions for /tmp or VM state.

## Browser

- **System Chrome:** `/usr/local/bin/google-chrome` (pre-installed)
- **Playwright Chromium:** Available via `npx playwright install chromium`
- **Headed mode:** Works — `headless: false` shows on the VNC desktop. User can see it via Cursor's desktop stream.
- **storageState:** Can load saved auth cookies for authenticated browsing (Gmail, Zoho, etc.)

## Runtimes & Tools

| Tool | Version |
|------|---------|
| Node.js | v22.22.1 (nvm) |
| pnpm | 10.33.0 |
| Python | 3.12.3 |
| Chrome | System install |
| ffmpeg | 6.1.1 |
| git | Available |
| curl | Available |
| Docker | May be absent — verify per session |
| ImageMagick | May be absent — verify per session |

## Network

- **Outbound HTTP/HTTPS:** Generally unrestricted
- **Localhost services:** Yes — can start dev servers and access them
- **Restrictions:** Corporate auth walls, geo blocks, rate limits still apply per-host
- **NOT the same as user's localhost** — the agent runs on a separate VM

## Native Capabilities

- Structured file read/write/edit tools
- Parallel exploration and subagents
- PR creation and git management
- Browser automation via Playwright (headed or headless)
- Long-running background processes
- MCP servers if configured in the project

## Limitations

- **No mouse/keyboard GUI API** — must use Playwright for UI interaction, not raw desktop control
- **Cannot see user's screen** — only sees images user attaches or files in repo
- **Timeouts:** Very long commands may be killed; use background processes
- **Memory/CPU:** Shared VM — large builds or many parallel browsers can OOM
- **Headed GUI:** Depends on DISPLAY being set; fails if no display server
- **Interactive CLIs:** Break in non-interactive mode (e.g., prompts)
- **No cross-session memory** — thread + repo state are the source of truth

## Best Practices for Orchestrating

1. **Clear success criteria:** "screenshot of route X", "PR merged", "green CI"
2. **Constraints up front:** branch name, files not to touch, tools to use
3. **Ordered steps** when order matters; bundled steps fine when independent
4. **Avoid:** Vague "make it better", changing requirements without stating deltas, assuming agent sees your UI
5. **When agent stops mid-task:** Send "continue from X" with what's done vs pending, or paste git status/error
6. **Push reminders:** Agent often completes code but forgets to push — include explicit push instructions

## Collaboration Preferences

- **Multi-step tasks:** Either all-at-once or stepwise works. All-at-once is more efficient for independent steps.
- **Source of truth:** The thread conversation + repo state. Agent doesn't retain private memory across threads.
- **Followup format:** When resuming, state what's done and what's pending clearly.

## Non-Obvious Capabilities

- Can use workspace rules, skills, and MCP servers if project configures them
- Cloud agent flows include git push + draft PR automation
- Playwright `storageState` carries live session cookies — treat auth files like passwords
- Has a VNC desktop — headed browsers ARE visible to user via Cursor's desktop stream
- System Chrome is available alongside Playwright bundled Chromium

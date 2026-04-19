# Browser Automation Guideline

## Two separate tools — never confuse them

| Tool | What it is | When to use |
|------|-----------|-------------|
| **Claude in Chrome MCP** (`mcp__Claude_in_Chrome__*`) | Extension running in the **user's main Chrome** — interactive, visible to user | Research, booking, dashboards, anything needing visual observation loop |
| **Browserclaw CDP weapon** (`libs/weapon/browserclaw/cdp.js`) | Playwright connecting to a **dedicated headless Chrome on port 9222** — separate process, separate profile | Repeatable automation: scraping, screenshots, form fills where selectors are known |

**These are completely independent.** The CDP Chrome being down does NOT affect the MCP extension, and vice versa. Calling `mcp__Claude_in_Chrome__navigate` when you mean CDP weapon, or vice versa, will either fail silently or automate the wrong browser.

---

## CDP weapon — how to use

```javascript
import { ensureCdpChrome, executeSteps, isCdpRunning } from "@/libs/weapon/browserclaw/cdp";

// Always check first
await ensureCdpChrome(); // no-op if already running; launches + injects auth if not

const result = await executeSteps([
  { action: "navigate", url: "https://example.com", item: "nav" },
  { action: "screenshot", item: "proof" },
]);
```

Chrome stays running between calls. `executeSteps` only connects/disconnects Playwright — it does NOT close Chrome.

---

## CDP relaunch procedure (when Chrome was closed or crashed)

1. **Try `ensureCdpChrome()`** — this is always the first step. It:
   - Detects if Chrome is already running on port 9222 (no-op if yes)
   - Launches Chrome with `--user-data-dir=~/.guildos-cdp-profile --remote-debugging-port=9222`
   - Auto-injects cookies from `playwright/.auth/user.json` after launch

2. **Verify it worked:**
   ```bash
   curl http://localhost:9222/json/version
   ```
   Should return a JSON blob with `"Browser": "Chrome/..."`. If this works, CDP is up.

3. **Test navigation:**
   ```javascript
   await executeSteps([{ action: "navigate", url: "https://google.com", item: "test" }])
   ```

4. **If cookies are expired** (sites show login pages after navigation):
   ```bash
   node scripts/auth-capture.mjs
   ```
   This opens Chrome, lets you log in manually, then saves auth to both the profile and `playwright/.auth/user.json`.

5. **If Chrome won't launch** (exe path wrong, process conflict):
   - Check Chrome path: `%LOCALAPPDATA%/Google/Chrome/Application/chrome.exe`
   - Kill any stuck Chrome on port 9222: `netstat -ano | findstr 9222` → `taskkill /PID <pid> /F`
   - Then retry `ensureCdpChrome()`

---

## Claude in Chrome MCP — how to use

```javascript
// Always get tab context first
mcp__Claude_in_Chrome__tabs_context_mcp({ createIfEmpty: true })
// → returns { availableTabs: [{ tabId, title, url }] }

// Then use tabId for all subsequent calls
mcp__Claude_in_Chrome__navigate({ tabId, url: "https://..." })
mcp__Claude_in_Chrome__computer({ action: "screenshot", tabId })
```

**Requires:** User's main Chrome is open AND the Claude in Chrome extension is installed and signed in.

**If "Claude in Chrome is not connected":** The extension is not running in the user's main Chrome. This cannot be fixed programmatically — the user needs to open Chrome and ensure the extension is active. Do NOT try to fix this by relaunching the CDP automation browser — they are unrelated.

---

## Auth state — how it works

### Local (CDP weapon)
- Profile dir: `~/.guildos-cdp-profile` — persistent Chrome profile with cookies baked in
- On fresh launch, `ensureCdpChrome()` also injects cookies from `playwright/.auth/user.json`
- Both mechanisms together mean the session survives even if the profile cookies expired
- Refresh: `node scripts/auth-capture.mjs`

### Cloud agents
- Cloud agents cannot reach `localhost:9222`
- Must use `mcp__Claude_in_Chrome__*` exclusively
- Auth state: `playwright/.auth/user.json` (exported by `auth-capture.mjs`)

---

## Observation loop rule

**Never execute steps blindly.** After every action, take a screenshot and read it.

```
navigate → screenshot → read → decide → act → screenshot → read → ...
```

This applies to both tools. A batch script that runs 10 steps without reading results will silently fail on step 3 and keep going.

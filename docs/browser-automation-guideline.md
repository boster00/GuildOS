# Browser Automation Guideline

Two browser automation tools are available in GuildOS. They serve different purposes and should not be confused.

---

## Claude Chrome Extension (interactive, rich, session-bound)

**What it is:** An MCP server (`mcp__Claude_in_Chrome__*`) that gives Claude Code direct control of a Chrome browser tab. Available only inside a Claude Code conversation or `claude -p` subprocess.

**Best for:** Testing developed features, debugging UI, verifying quest results, one-off browser tasks that require judgment.

### Capabilities

| Tool | Purpose |
|---|---|
| `navigate(url, tabId)` | Go to a URL |
| `computer(action: "screenshot", tabId)` | Take a screenshot (JPEG) |
| `get_page_text(tabId)` | Extract page text content |
| `find(query, tabId)` | Find elements by natural language ("login button") |
| `read_page(tabId, filter)` | Accessibility tree with element refs |
| `computer(action: "left_click", coordinate, tabId)` | Click by coordinate |
| `computer(action: "type", text, tabId)` | Type text |
| `computer(action: "key", text, tabId)` | Press key (Enter, Tab, etc.) |
| `computer(action: "scroll", scroll_direction, tabId)` | Scroll |
| `computer(action: "hover", coordinate, tabId)` | Hover |
| `form_input(ref, value, tabId)` | Fill form fields by element ref |
| `javascript_tool(action: "javascript_exec", text, tabId)` | Run JS in page context |
| `read_console_messages(tabId)` | Read browser console logs |
| `read_network_requests(tabId)` | Inspect network requests |
| `file_upload(paths, ref, tabId)` | Upload files to file inputs |
| `gif_creator(action, tabId)` | Record/export GIF of actions |
| `resize_window(width, height, tabId)` | Resize browser window |
| `tabs_context_mcp(createIfEmpty)` | Get/create tab group |
| `tabs_create_mcp()` | Create new tab |
| `tabs_close_mcp(tabId)` | Close tab |

### Setup

1. Install the "Claude in Chrome" extension from Chrome Web Store
2. The extension auto-connects when Claude Code starts (if Chrome is open)
3. Call `tabs_context_mcp({ createIfEmpty: true })` to get a tab ID before using other tools

### Usage pattern: Feature verification

```
1. tabs_context_mcp({ createIfEmpty: true })     -> get tabId
2. navigate("http://localhost:3002/page", tabId)  -> go to page
3. computer({ action: "screenshot", tabId })      -> see current state
4. find("submit button", tabId)                   -> locate element
5. computer({ action: "left_click", ref, tabId }) -> interact
6. computer({ action: "screenshot", tabId })      -> verify result
```

### Usage pattern: Programmatic from Node.js (via `claude -p`)

The Chrome extension MCP tools are NOT available in regular Node.js. To use them from scripts, spawn `claude -p` as a subprocess:

```bash
claude -p "Navigate to http://localhost:3002/town/inn, take a screenshot, verify the quest board loads" \
  --output-format json \
  --allowedTools "mcp__Claude_in_Chrome__navigate,mcp__Claude_in_Chrome__computer,mcp__Claude_in_Chrome__tabs_context_mcp,mcp__Claude_in_Chrome__tabs_create_mcp,mcp__Claude_in_Chrome__get_page_text,mcp__Claude_in_Chrome__read_page"
```

This is used by the Blacksmith's post-forge verification to test freshly forged weapons.

### Limitations

- Only works when Chrome is open with the extension connected
- Only available in Claude Code sessions (or `claude -p` subprocesses)
- Each `claude -p` call costs one API call
- Screenshots are session-scoped IDs, not persistent files (use `save_to_disk: true` to save)

---

## Browserclaw (autonomous, unattended, pigeon-post integrated)

**What it is:** A custom Chrome MV3 extension (`browserclaw/` at repo root) that executes multi-step browser tasks autonomously via GuildOS pigeon post. Runs unattended.

**Best for:** Recurring automated tasks, weapon testing pipelines, any browser work that needs to run without a live Claude Code session.

### Capabilities

| Action | Required Params | Description |
|---|---|---|
| `navigate` | `url`, `item` | Go to URL, wait for load |
| `get` | `selector`, `item` | Extract text/attribute from element |
| `click` | `selector`, `item` | Click element (full pointer event sequence) |
| `typeText` | `selector`, `text`, `item` | Type text char-by-char |
| `pressKey` | `key`, `item` | Press keyboard key |
| `wait` | `seconds`, `item` | Wait N seconds, optionally poll for selector |
| `getUrl` | `item` | Return current page URL |

Each step has an `item` key -- the result is stored under that key and delivered back to GuildOS inventory.

### Setup

1. Open `chrome://extensions` in Chrome, enable Developer mode
2. Click "Load unpacked", point to the `browserclaw/` folder
3. Open the extension settings page, set:
   - **API Base URL:** `http://localhost:3002`
   - **Pigeon API Key:** (from `.env.local` `PIGEON_API_KEY`)
4. Enable auto-pilot to poll for tasks every 60 seconds

### How tasks get dispatched

1. A skill book action (e.g. `browsercontrol.dispatchBrowserActionsThroughPigeonPost`) creates a pigeon letter with steps
2. The letter is stored in the quest's pigeon queue via `POST /api/pigeon-post`
3. Browserclaw's auto-pilot polls `GET /api/pigeon-post?action=pending`
4. For each letter: opens a background tab, executes steps sequentially, collects results
5. Delivers results back: `POST /api/pigeon-post?action=deliver` with `{ questId, letterId, items }`
6. Results land in quest inventory, pipeline continues

### Step format

```json
{
  "action": "get",
  "selector": "#result-panel",
  "item": "result_text",
  "url": "http://localhost:3002/some-page"
}
```

- `url` is optional on any step -- if present, navigates before executing the action
- `item` is required -- names the inventory key where the result is stored
- `selector` is required for `get`, `click`, `typeText` (CSS selector syntax)

### Limitations

- Polling interval is ~60 seconds (not real-time)
- One task at a time per auto-pilot tick
- No screenshots (text/attribute extraction only)
- No JavaScript execution
- No natural language element finding (CSS selectors only)
- Cannot make judgment calls -- executes exactly the steps given

---

## When to use which

| Scenario | Tool |
|---|---|
| Testing a feature you just built | Claude Chrome Extension |
| Verifying quest results at review stage | Claude Chrome Extension (via `claude -p`) |
| Debugging why a page looks wrong | Claude Chrome Extension (screenshot + inspect) |
| Running a repeatable multi-step browser task | Browserclaw |
| Weapon testing in the forge pipeline | Browserclaw (pigeon letters) |
| Scraping data from external sites | Browserclaw (auto-pilot) |
| Anything requiring judgment or adaptation | Claude Chrome Extension |
| Anything that must run unattended | Browserclaw |

---

## Integration with quest pipeline

### Post-forge verification (Blacksmith)

After forging a weapon, the Blacksmith spawns `claude -p` with Chrome Extension tools to navigate to the weapon's test page and verify it works. The verification result is stored in inventory as `forge_verification`:

```json
{
  "verified": true,
  "reason": "Test page loads, credential check button visible",
  "screenshotId": "ss_abc123",
  "verifiedAt": "2026-04-06T..."
}
```

This happens inside `libs/skill_book/blacksmith/index.js` -> `forgeWeapon()`. If Chrome is not running or `claude -p` fails, verification is skipped gracefully -- it never blocks the pipeline.

### Pigeon post testing (Browserclaw)

Weapon test pages at `/town/proving-grounds/weapons/<name>/` are designed as targets for Browserclaw pigeon letters. Each test page has:

1. Credential check button (`#<name>-cred-check-btn`)
2. Result panels with known IDs
3. Deterministic selectors for each test case

Pigeon letters execute against these pages to verify weapons work end-to-end.

---

## Environment variables

```
PIGEON_API_KEY=<any secret string>           # Auth for Browserclaw API calls
PIGEON_POST_OWNER_ID=<your GuildOS user UUID> # Maps API key to user
```

---

## Historical test results

### Test 1 -- BosterBio H1 (2026-04-04): PASS

Single and multi-step pigeon letters navigating to bosterbio.com, extracting h1 text. Pipeline confirmed: DB insert -> API fetch -> BC execute -> API deliver -> quest inventory updated.

### Test 3 -- Gmail bookmarks (2026-04-04): PASS

9-step pigeon letter reading 3 Gmail filtered views. Wait+re-grab pattern needed for SPA rendering. All steps completed, results delivered.

# Browserclaw Dev Plan & Handoff

> **Handoff note:** This document is the single source of truth for BC development.
> To resume: open PowerShell, `cd C:\Users\xsj70\GuildOS`, run `claude`, then say
> "read docs/browserclaw-dev-plan.md and continue BC development".

---

## What Browserclaw is

A Chrome MV3 extension that executes multi-step browser automation tasks ("pigeon letters")
on behalf of GuildOS. It reads tasks from the GuildOS API, executes DOM actions on real pages
using the user's actual Chrome session and cookies, and delivers results back.

Eventually it will poll Supabase directly (Method 5) so it works on non-dev machines
without a local server. For now it uses the local API.

---

## Method decisions

| Method | Status | Reason |
|--------|--------|--------|
| CDP via server-side Playwright | Abandoned | Requires separate Chrome profile, no real-session cookies, continuity failures |
| **chrome.alarms auto-pilot (MV3)** | **Active — use this now** | Works with real session, alarm survives Chrome restarts, already implemented |
| WebSocket bridge | Skip | Needs always-on Node server, adds infra for no gain over alarms |
| Native Messaging Host | Skip | Per-machine registration, not portable |
| CDP permanent debug port | Skip | Same continuity problems |
| **Direct Supabase polling** | **Future — production target** | No local server, works on non-dev machines, scales to many users |

---

## Current state of the extension

All files in `browserclaw/`. Already implemented in this session:
- `manifest.json` — added `"alarms"` permission
- `shared/constants.js` — added `STORAGE_KEY_AUTO_PILOT`
- `background/service-worker.js` — `ensureAlarm()` + `autoPilotTick()` + `chrome.alarms.onAlarm` handler
- `settings/settings.html` + `settings.js` — auto-pilot toggle UI wired up

**These changes are NOT committed yet** — still local edits in the worktree.

---

## Chrome setup (active test environment)

```
Chrome launched with:
  --remote-debugging-port=9222
  --user-data-dir=C:/Users/xsj70/chrome-cdp-profile

CDP endpoint: http://localhost:9222
Grounding tab ID: 097E691243B73084E546EBF6469FC139
Grounding tab URL: http://localhost:3002/opening
Browserclaw extension ID: mgcnbhjeicnohejhnfnamnillmgggcck
```

**Rule:** Grounding tab must stay open. Open new tabs for automation, close them when done.

**To relaunch Chrome with CDP** (if killed):
```bash
"/c/Users/xsj70/AppData/Local/Google/Chrome/Application/chrome.exe" \
  --remote-debugging-port=9222 \
  --user-data-dir="C:/Users/xsj70/chrome-cdp-profile" \
  --load-extension="C:/Users/xsj70/GuildOS/browserclaw" \
  "http://localhost:3002" &
```

**To reload the extension after edits** (no need to touch chrome://extensions):
```bash
node -e "
const WebSocket = require('ws');
// Get SW target
const http = require('http');
http.get('http://localhost:9222/json', res => {
  let d=''; res.on('data',c=>d+=c); res.on('end',()=>{
    const targets = JSON.parse(d);
    const sw = targets.find(t => t.url && t.url.includes('mgcnbhjeicnohejhnfnamnillmgggcck') && t.type === 'service_worker');
    if (!sw) { console.log('SW not found'); return; }
    const ws = new WebSocket(sw.webSocketDebuggerUrl);
    ws.on('open', () => {
      ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: 'chrome.runtime.reload()' } }));
      setTimeout(() => ws.close(), 500);
    });
  });
});
"
```

**To read chrome.storage.local state:**
```bash
node -e "
const WebSocket = require('ws');
const http = require('http');
http.get('http://localhost:9222/json', res => {
  let d=''; res.on('data',c=>d+=c); res.on('end',()=>{
    const targets = JSON.parse(d);
    const sw = targets.find(t => t.url && t.url.includes('mgcnbhjeicnohejhnfnamnillmgggcck') && t.type === 'service_worker');
    const ws = new WebSocket(sw.webSocketDebuggerUrl);
    ws.on('open', () => {
      ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: {
        expression: 'new Promise(r => chrome.storage.local.get(null, r))',
        returnByValue: true, awaitPromise: true
      }}));
    });
    ws.on('message', data => {
      const msg = JSON.parse(data);
      if (msg.id === 1) { console.log(JSON.stringify(msg.result?.result?.value, null, 2)); ws.close(); }
    });
  });
});
"
```

---

## Infrastructure

### GuildOS server
```bash
cd C:\Users\xsj70\GuildOS\.claude\worktrees\sad-mayer
npm run dev   # runs on port 3002
```
Note: worktree needs `.env.local` copied from main repo. Already done.

### Supabase
- **Project:** GuildOS (`sdrqhejvvmbolqzfujej`)
- **CLI:** `npx supabase` works and is linked to GuildOS project
- **URL:** `https://sdrqhejvvmbolqzfujej.supabase.co`

### `/api/pigeon-post` route
- **Exists and built** at `app/api/pigeon-post/route.js`
- `GET ?action=pending` — returns pending letters for a user
- `POST ?action=deliver` — delivers captured items back into quest inventory
- Auth: session cookie OR `X-Pigeon-Key` header + `PIGEON_POST_OWNER_ID` env var

### Environment variables missing (must be added to `.env.local` before testing)
```
PIGEON_API_KEY=<any secret string>
PIGEON_POST_OWNER_ID=<your GuildOS user UUID from Supabase auth.users>
```

### How pending letters work (IMPORTANT)
`getPendingPigeonLetters` reads from `quests.inventory` JSONB, not the `pigeon_letters` table.
The `pigeon_letters` table exists but isn't wired into the pending fetch yet.

**Recommended fix before testing:** Update `getPendingPigeonLetters` in `libs/pigeon_post/index.js`
to also query the `pigeon_letters` table (status = 'pending', owner_id = userId), so we can
insert test tasks directly into that table via Supabase CLI/service role.

### Letter payload shape (what BC expects)
```json
{
  "letterId": "uuid",
  "questId": "uuid",
  "steps": [
    {
      "action": "obtainText",
      "selector": "h1",
      "item": "page_h1",
      "url": "https://example.com/page"
    }
  ]
}
```
Actions: `obtainText`, `listenFor`, `wait`

---

## Test cases (agreed)

Orchestration: done by Claude via DB inserts.
Browser interaction: done by Browserclaw (BC), triggered by pigeon letters.
Results: written back to DB, then Claude reads and writes to this doc.

### Test 1 — BosterBio IHC page H1 (easiest)
- Navigate to bosterbio.com, find IHC service page, grab its `h1`
- Result → this doc under "Test Results → Test 1"

### Test 2 — Claude.ai sessions summary (medium)
- Navigate to `https://claude.ai/code/`
- Fetch latest messages of all visible Claude Code sessions
- Result → executive summary of what needs attention

### Test 3 — Gmail bookmarks (hardest)
- Find 3 Chrome bookmarks pointing to Gmail (filtered views)
- For each: navigate, fetch first 2 email titles
- Questions still open: are bookmarks in CDP Chrome profile? Are URLs `#label/...` style?

---

## Development loop

1. Edit `browserclaw/` files
2. Reload extension via CDP (script above — no manual chrome://extensions needed)
3. Observe via CDP: read service worker console + `chrome.storage.local`
4. Insert test letter via Supabase CLI or direct DB call
5. Watch auto-pilot tick pick it up (or trigger manually via FAB)
6. Verify delivery via DB query

---

## Open questions (resolve before starting tests)

1. ~~Add `PIGEON_API_KEY` + `PIGEON_POST_OWNER_ID` to `.env.local` and BC settings~~ **DONE** (2026-04-04)
2. ~~Update `getPendingPigeonLetters` to read from `pigeon_letters` table~~ **DONE** (2026-04-04)
3. Confirm CDP Chrome profile is logged into claude.ai (for Test 2)
4. Confirm Gmail bookmarks are in CDP Chrome profile (for Test 3)
5. ~~Get service role key for DB inserts~~ **DONE** — `SUPABASE_SECRETE_KEY` in `.env.local`
6. ~~Wire `deliverPigeonResult` to also update `pigeon_letters` table row status to 'completed'~~ **DONE** (2026-04-04)
7. **NEW:** Chrome must be launched with `--load-extension` flag to load BC (added to launch command above)

---

## Test Results

### Test 1 — BosterBio H1 (2026-04-04)

**Status: PASS**

**Test 1a** (single step — `/ihc` URL):
- URL `https://www.bosterbio.com/ihc` → h1 = `"Ooops, Where Am I?"` (404 page — `/ihc` redirects)
- Pipeline confirmed working: DB insert → API fetch → BC execute → API deliver → quest inventory updated

**Test 1b** (multi-step — main page + services):
- Step 1: `https://www.bosterbio.com` → h1 = `"TOP 100 ELISA KITS — NOW 40% OFF"`
- Step 2: `https://www.bosterbio.com/services` → h1 = `"BOSTER SERVICES"`
- Both steps executed, result delivered, quest inventory updated

**Code changes made for this test:**
1. `libs/pigeon_post/index.js` — `getPendingPigeonLetters()` now also queries the `pigeon_letters` table (status='pending') in addition to legacy `quests.inventory` source. Switched from `database.init("server")` to `database.init("service")` so API-key auth path works (server client needs cookies for RLS, service bypasses RLS).
2. `.env.local` — added `PIGEON_API_KEY=browserclaw-test-key` and `PIGEON_POST_OWNER_ID=4b2ae469-a474-43f0-907a-eec881413020`
3. Chrome relaunched with `--load-extension=C:/Users/xsj70/GuildOS/browserclaw`

**Known gap (fixed):** `deliverPigeonResult` now also marks `pigeon_letters` table rows as `completed` with result payload. Verified in a follow-up test (2026-04-04).

### Test 2 — Claude.ai sessions (2026-04-04)

**Status: BLOCKED — not logged in**

CDP Chrome profile (`chrome-cdp-profile`) is NOT logged into claude.ai — redirects to `/login`.
User needs to manually log in via the CDP Chrome window before this test can run.
Once logged in, insert a pigeon letter with steps to navigate to `https://claude.ai/code/` and `obtainText` from the sessions list.

### Test 3 — Gmail bookmarks (2026-04-04)

**Status: PASS**

Used 3 Gmail bookmark URLs from the main Chrome profile (CDP profile is logged into Gmail at xsj706@gmail.com).
9-step pigeon letter: for each view → navigate → wait 3s → obtainText from `div[role=main]`.

**Results:**
- **CJ view** (important, unread, to boster@): 1 conversation — "Boster Bio- BioSapiens" from CJ Xia (Apr 1)
- **General view** (unimportant, unread): 100+ conversations — top: "Important update to your Microsoft 365 subscription"
- **Asana view** (unread Asana emails): 2 conversations — "Reminder: info sent you a comment yesterday"

**Notes:**
- Gmail is an SPA — first `obtainText` after navigation captures partial render; the wait+re-grab pattern works
- All 9 steps completed, result delivered to quest inventory
- Bookmarks were sourced from main Chrome profile (`User Data/Default/Bookmarks`), not the CDP profile

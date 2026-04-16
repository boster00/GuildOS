# Quest Lifecycle — Action Mapping

Two real examples traced to maximum granularity.

## Questions / Gaps for User

| # | Gap | Question |
|---|-----|----------|
| 1 | **Agents can't seekHelp via Cursor API** — no CURSOR_API_KEY on worker agents. Cat reads quest_comments instead. | Is the comment-based workaround acceptable long-term, or should agents get CURSOR_API_KEY? |
| 2 | **Figma token not on agents** — can't export images for comparison. | Should FIGMA_ACCESS_TOKEN be provisioned to agents, or is Figma comparison always user-side? |
| 3 | **Supabase Storage upload vs raw GitHub URLs** — agents use raw GitHub URLs as workaround for storage upload. | Are raw GitHub URLs acceptable for deliverables, or must they be in Supabase Storage? |
| 4 | **No weapon for quest DB operations** — agents write raw SQL/Supabase queries for stage changes and inventory updates. | Should there be a quest weapon (writeQuestStage, writeInventory) or is direct DB fine? |
| 5 | **Cat's Asana access** — closeQuest needs to write to Asana. Cat has MCP asana tools but weapon approach untested from cloud. | Has Cat successfully written to Asana via weapon or MCP? If not, closing stage is broken. |
| 6 | **No automated Figma fidelity check** — pixel comparison is manual/visual only. | Is this acceptable, or should we build a Figma diff tool? |

---

## Legend
- **Native** = agent does it with its own tools (git, shell, browser, file ops)
- **Weapon** = `libs/weapon/<name>/` JS function
- **Skill book** = `libs/skill_book/<name>/` knowledge registry action
- **DB** = direct Supabase query (createClient + select/update/insert)
- **MISSING** = no weapon or skill book exists for this

---

## Example 1: Smoke Test GuildOS (Forge Keeper)

| Step | What happens | How | Coverage |
|------|-------------|-----|----------|
| **1. Agent gets nudged** | Cron sends [NUDGE] message | weapon: `cursor.writeFollowup` (in cron code) | ✅ |
| **2. Agent reads nudge** | Processes followup message | Native (Cursor built-in) | ✅ |
| **3. Pull latest repo** | `git pull origin main` | Native | ✅ |
| **4. Read global instructions** | `cat docs/global-instructions.md` | Native | ✅ |
| **5. Query adventurer profile** | `SELECT * FROM adventurers WHERE id = ...` | DB | ✅ |
| **6. Read system_prompt** | From adventurer row | DB (part of step 5) | ✅ |
| **7. Read skill books** | `cat libs/skill_book/housekeeping/index.js` | Native | ✅ |
| **8. Get active quests** | `SELECT FROM quests WHERE assignee_id = ... AND stage != 'complete'` | DB / skill book: `housekeeping.getActiveQuests` | ✅ |
| **9. Read quest description** | From quest row | DB (part of step 8) | ✅ |
| **10. Start dev server** | `npm run dev` | Native | ✅ |
| **11. Open browser** | Chrome on DISPLAY=:1 | Native | ✅ |
| **12. Navigate to page** | xdotool + address bar | Native | ✅ |
| **13. Take screenshot** | ffmpeg x11grab / native tools | Native | ✅ |
| **14. Save screenshot to repo** | `cp` to screenshots/ folder | Native | ✅ |
| **15. Git push screenshots** | `git add && git commit && git push` | Native | ✅ |
| **16. Get raw GitHub URLs** | Construct from branch + path | Native (string construction) | ✅ |
| **17. Store URLs in quest inventory** | `UPDATE quests SET inventory = ... WHERE id = ...` | DB / skill book: `housekeeping.submitForPurrview` | ✅ |
| **18. Verify inventory populated** | `SELECT inventory FROM quests WHERE id = ...` | DB / skill book: `housekeeping.submitForPurrview` | ✅ |
| **19. Move to purrview** | `UPDATE quests SET stage = 'purrview' WHERE id = ...` | DB / skill book: `housekeeping.submitForPurrview` | ✅ |
| **20. Verify stage changed** | `SELECT stage FROM quests WHERE id = ...` | DB | ✅ |
| **21. Post milestone comment** | `INSERT INTO quest_comments ...` | DB / skill book: `housekeeping.comment` | ✅ |
| **22. Cat gets nudged** | Cron sends purrview notification | weapon: `cursor.writeFollowup` (in cron code) | ✅ |
| **23. Cat reads quest inventory** | `SELECT inventory FROM quests WHERE stage = 'purrview'` | DB | ✅ |
| **24. Cat opens screenshot URLs** | Fetches raw GitHub URLs | Native (HTTP fetch) | ✅ |
| **25. Cat evaluates screenshots** | Compares to quest deliverable spec | skill book: `questmaster.reviewSubmission` | ✅ |
| **26. Cat uses Claude CLI** | Second opinion if unsure | skill book: `questmaster.getSecondOpinion` | ✅ |
| **27a. Cat approves** | `UPDATE quests SET stage = 'review'` | DB | ✅ |
| **27b. Cat rejects** | `UPDATE quests SET stage = 'execute'` + comment | DB + skill book: `housekeeping.comment` | ✅ |
| **28. Quest on GM desk** | User sees review quest with screenshot carousel | UI (DeskReviewClient) | ✅ |
| **29. User approves** | Click "Approve → Close" | UI → API PATCH stage to closing | ✅ |
| **30. Cat archives to Asana** | Write summary to Asana task | weapon: `asana.writeTask` / `asana.writeComment` | ✅ |
| **31. Cat moves to complete** | `UPDATE quests SET stage = 'complete'` | DB / skill book: `questmaster.closeQuest` | ✅ |

### Gaps in Example 1: None — all steps covered.

---

## Example 2: BosterBio Website Dev

| Step | What happens | How | Coverage |
|------|-------------|-----|----------|
| **1. Agent gets nudged** | Cron sends [NUDGE] | weapon: `cursor.writeFollowup` | ✅ |
| **2. Pull latest GuildOS** | `cd ~/guildos && git pull` | Native | ✅ |
| **3. Create .env.local** | Write env vars from shell to file | Native / skill book: `housekeeping.initAgent` | ✅ |
| **4. Read instructions** | global + system_prompt + skill books | Native + DB | ✅ |
| **5. Get active quests** | `SELECT FROM quests ...` | DB / skill book: `housekeeping.getActiveQuests` | ✅ |
| **6. Read quest WBS** | From quest description | DB | ✅ |
| **7. Read Figma file** | Get page structure from Figma API | weapon: `figma.readFile` | ✅ |
| **8. Export Figma images** | Export nodes as PNG | weapon: `figma.readExport` | ✅ but agent lacks FIGMA_ACCESS_TOKEN |
| **9. Start dev server** | `pnpm dev` | Native | ✅ |
| **10. Start Medusa** | `pnpm dev` in apps/api | Native | ✅ |
| **11. Start PostgreSQL** | `sudo service postgresql start` | Native | ✅ |
| **12. Run migrations/seed** | `pnpm migration:run && pnpm seed:catalog` | Native | ✅ |
| **13. Build/fix pages** | Code changes to match Figma | Native | ✅ |
| **14. Take screenshots** | Browser + capture tools | Native | ✅ |
| **15. Save to repo** | `cp` to screenshots/ | Native | ✅ |
| **16. Git push** | `git add && commit && push` | Native | ✅ |
| **17. Upload to Supabase Storage** | Upload PNGs, get public URLs | weapon: `supabase_storage.writeFile` + `readPublicUrl` | ✅ but agent lacks key |
| **17b. Alternative: raw GitHub URLs** | Construct from branch + path | Native | ✅ |
| **18. Store URLs in inventory** | `UPDATE quests SET inventory = ...` | DB / skill book: `housekeeping.submitForPurrview` | ✅ |
| **19. Verify + move to purrview** | SELECT back, update stage | DB / skill book: `housekeeping.submitForPurrview` | ✅ |
| **20. Post comment** | `INSERT INTO quest_comments` | DB / skill book: `housekeeping.comment` | ✅ |
| **21. Seek Cat's help** | Message Cat's session | weapon: `cursor.writeFollowup` | MISSING — agent lacks CURSOR_API_KEY |
| **21b. Alternative** | Comment in quest_comments | DB | ✅ (Cat reads from DB) |
| **22. Cat reviews** | Same as Example 1 steps 22-27 | Same | ✅ |
| **23. User reviews on GM desk** | Screenshots in carousel | UI | ✅ |
| **24. Archive to Asana** | Update Asana task | weapon: `asana.writeTask` | ✅ |

### Gaps in Example 2:

| Gap | What's missing | Impact |
|-----|---------------|--------|
| Figma token | Agent lacks `FIGMA_ACCESS_TOKEN` | Can't export Figma images for comparison. Workaround: visual comparison from browser. |
| Supabase Storage key | Agent's project .env.local doesn't have GuildOS storage key | Can't upload to Supabase Storage. Workaround: raw GitHub URLs. |
| CURSOR_API_KEY | Agent can't call writeFollowup to Cat | Can't seekHelp directly. Workaround: Cat reads quest_comments from DB. |
| Figma visual comparison | No automated pixel comparison tool | Agent can't verify Figma fidelity programmatically. Relies on Cat + user review. |

---

## Action Registry Summary

### Weapons (scripts that call external APIs)

| Weapon | Used for | Available to agents? |
|--------|---------|---------------------|
| `cursor.writeFollowup` | Send messages to agents | Cron only (agents lack CURSOR_API_KEY) |
| `cursor.readAgent` | Check agent status | Cron only |
| `cursor.readConversation` | Read agent messages | Cron only |
| `cursor.createAgent` | Create new agent session | Guildmaster only |
| `figma.readFile` | Read Figma page structure | Needs FIGMA_ACCESS_TOKEN |
| `figma.readExport` | Export Figma nodes as images | Needs FIGMA_ACCESS_TOKEN |
| `asana.writeTask` | Update Asana task | Cat (needs ASANA_ACCESS_TOKEN or MCP) |
| `asana.writeComment` | Post to Asana task | Cat (needs token or MCP) |
| `supabase_storage.writeFile` | Upload files to storage | Needs SUPABASE_SECRETE_KEY |
| `supabase_storage.readPublicUrl` | Get public URL for file | Needs SUPABASE_SECRETE_KEY |

### Skill Book Actions (text instructions agents read)

| Skill book | Action | Used for |
|-----------|--------|---------|
| housekeeping | initAgent | Set up environment, read instructions |
| housekeeping | setNewAgent | Replace broken agent session |
| housekeeping | comment | Post milestone/escalation comment |
| housekeeping | escalate | Move quest to escalated stage |
| housekeeping | presentPlan | Create WBS plan for user approval |
| housekeeping | createQuest | Create quest in execute stage |
| housekeeping | seekHelp | Message Cat for approval |
| housekeeping | getActiveQuests | Query assigned quests |
| housekeeping | submitForPurrview | Store inventory + move to purrview |
| housekeeping | summarizeComments | Compress old comments |
| questmaster | reviewSubmission | Cat evaluates deliverables |
| questmaster | getSecondOpinion | Cat uses Claude CLI |
| questmaster | createPR | Cat creates PR after approval |
| questmaster | closeQuest | Cat archives to Asana |

### Native Actions (agent's own tools)

| Action | Tool |
|--------|------|
| Git operations | git CLI |
| File read/write | shell, editor |
| Browser navigation | Chrome + xdotool |
| Screenshot capture | ffmpeg x11grab |
| Start dev server | npm/pnpm |
| Start databases | service commands |
| Code editing | built-in editor |
| HTTP requests | curl, fetch |

### Direct DB Operations

| Operation | Used for |
|-----------|---------|
| SELECT quests | Read quest details, check stage |
| UPDATE quests | Change stage, update inventory |
| INSERT quest_comments | Post comments |
| SELECT adventurers | Get profile, session_id |
| UPDATE adventurers | Change session_status |

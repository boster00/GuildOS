# GuildOS UI Smoke Test — WBS

## Questions for User

| # | Question |
|---|----------|
| 1 | **Remove /town/inn/sales-orders?** Zoho demo page, not part of agent-driven model. |
| 2 | **Remove /town/guildmaster-room/zoho-activation?** Static OAuth setup guide, superseded by weapons. |
| 3 | **Remove /town/guildmaster-room/potion-formulars?** Just redirects to formulary. |
| 4 | **Remove /town/proving-grounds/quest-workflow?** Old pipeline testing, agent-driven now. |
| 5 | **Remove /town/proving-grounds/ccc-test?** Make 24 demo, no ongoing use. |
| 6 | **Review queue (/town/review-queue) — keep or consolidate into GM desk?** Seems to duplicate GM desk functionality. |
| 7 | **Request desk (/town/inn/request-desk) — still useful?** Creates quests via form. In new model, quests are created through agent chat. Keep as a quick-create tool or remove? |

---

## Legend
- **TEST** — active feature, test as described
- **REMOVE** — obsolete, pending user confirmation above
- **UPDATE** — needs changes, test after update

---

## 1. Navigation & Layout

### 1.1 Top nav bar
**Where:** Top of every /town/* page
**Test:** Click each link: Town map, Inn, Upstairs, Quest board, GM Desk, Proving grounds, Town square, Forge, Council hall, World map
**Expect:** Each navigates correctly. No 404s.
**Screenshot:** Nav bar fully visible

### 1.2 Town map (/town)
**Where:** /town
**Test:** Click each location card
**Expect:** All cards navigate correctly
**Screenshot:** Town map with all cards

---

## 2. Inn

### 2.1 Inn main (/town/inn)
**Where:** /town/inn
**Test:** Verify place cards (Quest board, Upstairs, Request desk) render
**Expect:** Cards visible with links
**Screenshot:** Inn main page

### 2.2 Quest board (/town/inn/quest-board)
**Where:** /town/inn/quest-board
**Test:** Verify quests list with stage badges. Click one to open detail.
**Expect:** Quests visible, clickable, badges colored by stage
**Screenshot:** Quest board with 2+ quests

### 2.3 Quest detail (/town/inn/quest-board/[questId])
**Where:** Click any quest

**2.3.1 Stage dropdown**
**Test:** Click stage badge → dropdown opens → select a stage → dropdown closes → badge updates → checkmark
**Expect:** Immediate update, saves to DB
**Screenshot:** Dropdown open, then closed with new stage

**2.3.2 Edit title**
**Test:** Click title → type "Smoke Test Title" → save
**Expect:** Title updates on page
**Demo entry:** "Smoke Test Title"

**2.3.3 Edit description**
**Test:** Click description → type "Smoke test description" → save
**Expect:** Description updates
**Demo entry:** "Smoke test description"

**2.3.4 Add comment**
**Test:** Type "Smoke test comment" → Add
**Expect:** Comment appears with source "user", action "note"
**Demo entry:** "Smoke test comment"

**2.3.5 Edit comment**
**Test:** Click edit on comment → change text → Save
**Expect:** Text updates, edit UI closes
**Demo entry:** "Edited smoke test comment"

**2.3.6 Delete comment**
**Test:** Click X → confirm
**Expect:** Comment removed

**2.3.7 Summarize comments (if >5)**
**Test:** Click "Summarize" button
**Expect:** Message sent to assigned adventurer

**2.3.8 Verify no advance buttons**
**Test:** Confirm no "Run >> next step" buttons anywhere on the page
**Expect:** Only stage dropdown for stage changes

**Screenshot:** Quest detail with title, description, stage dropdown, comments section

### 2.4 Request desk (/town/inn/request-desk)
**UPDATE** — verify quest creates in execute stage (not idea), no Cat assignment
**Where:** /town/inn/request-desk
**Test:** Click "Load Demo" → "Submit Request"
**Expect:** Quest created in execute stage
**Demo entry:** "Smoke test quest from request desk"
**Screenshot:** Request desk before and after submit

### 2.5 Sales orders (/town/inn/sales-orders)
**REMOVE** — Zoho demo page

### 2.6 Upstairs (/town/inn/upstairs)
**Where:** /town/inn/upstairs

**2.6.1 Adventurer cards**
**Test:** Verify all adventurers show with chibi avatars, status badges, quest counts, skill books
**Expect:** Cards render with correct data
**Screenshot:** Upstairs with 2+ adventurers

**2.6.2 Chat — open**
**Test:** Click "Chat" on adventurer with linked session
**Expect:** Chat panel opens, shows conversation history

**2.6.3 Chat — send message**
**Test:** Type "Smoke test" → Send
**Expect:** Message appears as pending (faded, loading dots). Polls every 5s.
**Demo entry:** "Smoke test"

**2.6.4 Chat — message confirmed**
**Test:** Wait for poll to pick up the sent message in conversation
**Expect:** Pending indicator removed, message shows solid

**2.6.5 Open in Cursor**
**Test:** Click "Open in Cursor ↗"
**Expect:** Opens cursor.com/agents/... in new tab

**2.6.6 Commission link**
**Test:** Click "Commission new adventurer"
**Expect:** Navigates to commission page

**Screenshot:** Chat panel open with pending message

### 2.7 Adventurer detail (/town/inn/upstairs/[adventurerId])
**Where:** Click "Edit" on any adventurer

**2.7.1 Edit name**
**Test:** Change name → Save
**Demo entry:** "Test Agent Renamed"

**2.7.2 Edit system prompt**
**Test:** Change text → Save
**Demo entry:** "Updated system prompt for smoke test"

**2.7.3 Edit skill books**
**Test:** Toggle a skill book → Save

**2.7.4 Decommission**
**Test:** Click Decommission → confirm both dialogs
**Expect:** Adventurer removed (test on a disposable adventurer only)

**Screenshot:** Edit form with fields filled

---

## 3. Guildmaster's Chamber

### 3.1 GM room hub (/town/guildmaster-room)
**Where:** /town/guildmaster-room
**Test:** Verify links to Desk and Commission
**Screenshot:** GM room page

### 3.2 GM Desk (/town/guildmaster-room/desk)
**Where:** /town/guildmaster-room/desk

**3.2.1 Review quests**
**Test:** Verify review-stage quests show with screenshot carousel, title link, Approve → Close, Feedback
**Expect:** Cards render with images
**Screenshot:** GM desk with quest + carousel

**3.2.2 Title link**
**Test:** Click quest title
**Expect:** Opens detail in new tab

**3.2.3 Feedback**
**Test:** Click Feedback → type "Test feedback" → Send
**Expect:** Comment posted, adventurer pinged
**Demo entry:** "Test feedback from smoke test"

**3.2.4 Approve → Close**
**Test:** Click on a review quest
**Expect:** Quest moves to closing, disappears from review section

**3.2.5 Triage escalated**
**Test:** (need escalated quests) Click "Triage All"
**Expect:** Shows Issue, Proposed Solution, Recent Comments, badge per quest

**3.2.6 Resolve escalation**
**Test:** Type resolution → Resolve & Return to Execute
**Expect:** Comment posted, quest back to execute, adventurer pinged
**Demo entry:** "Resolved: test resolution"

**3.2.7 Closing quests visible**
**Test:** Verify closing-stage quests appear on desk
**Expect:** Shown alongside review and escalated

**Screenshot:** GM desk with triage results expanded

### 3.3 Commission adventurer (/town/guildmaster-room/commission-new-adventurer)
**Where:** /town/guildmaster-room/commission-new-adventurer
**Test:** Fill form → Commission
**Demo entries:** Name: "Smoke Test Agent", System prompt: "Test adventurer", Skill books: housekeeping
**Expect:** Created with housekeeping auto-added
**Screenshot:** Form filled, then success

### 3.4 Zoho activation
**REMOVE** — superseded by weapons

### 3.5 Potion formulars
**REMOVE** — redirect duplicate

---

## 4. Town Square

### 4.1 Hub (/town/town-square)
**Test:** Verify links to Forge, Library, Apothecary
**Screenshot:** Town square page

### 4.2 Forge (/town/town-square/forge)
**Test:** Verify weapon list with names, descriptions, status badges
**Screenshot:** Forge with weapon list

### 4.3 Weapon detail — Zoho (/town/town-square/forge/zoho)
**UPDATE** — verify OAuth form still renders
**Test:** Check form: Client ID, Client Secret, Region dropdown
**Demo entries:** Client ID: "test-id", Client Secret: "test-secret", Region: "com"
**Screenshot:** Zoho weapon form

### 4.4 Library (/town/town-square/library)
**Test:** Verify all skill books listed (housekeeping, questmaster_registry, gmail, zoho, cjgeo, nexus, bosterbio, etc.)
**Screenshot:** Library page

### 4.5 Apothecary (/town/town-square/apothecary)
**Test:** Verify OAuth token table renders
**Screenshot:** Apothecary page

---

## 5. Council Hall

### 5.1 Hub (/town/council-hall)
**Test:** Links to Formulary and Dungeon master
**Screenshot:** Council hall page

### 5.2 Formulary (/town/council-hall/formulary)
**5.2.1 Add:** Name: "SMOKE_TEST_KEY", Value: "test-value" → Commit
**5.2.2 Edit:** Click edit → change value → Save
**5.2.3 Delete:** Click delete → confirm
**Expect:** CRUD works, values masked after save
**Screenshot:** Formulary with test key

### 5.3 Dungeon master (/town/council-hall/dungeon-master)
**Test:** Verify LLM settings form renders
**Screenshot:** Dungeon master page

---

## 6. Proving Grounds

### 6.1 Hub (/town/proving-grounds)
**Test:** Links to test suites render
**Screenshot:** Proving grounds page

### 6.2 Quest workflow
**REMOVE** — old pipeline testing

### 6.3 Browserclaw (/town/proving-grounds/browserclaw)
**Test:** Interface loads
**Screenshot:** Browserclaw test page

### 6.4 BigQuery (/town/proving-grounds/weapons/bigquery)
**Test:** Click "Test credentials"
**Screenshot:** BigQuery test with result

### 6.5 CCC Test
**REMOVE** — Make 24 demo

### 6.6 Asana review (/town/proving-grounds/asana)
**Test:** Task list loads
**Screenshot:** Asana review page

---

## 7. Other

### 7.1 World map (/town/world-map)
**Test:** Placeholder zones display
**Screenshot:** World map

### 7.2 Review queue (/town/review-queue)
**UPDATE** — may duplicate GM desk. Check if needed.
**Test:** Renders without error
**Screenshot:** Review queue page

### 7.3 Sign-in (/signin)
**Test:** Sign-in form renders
**Screenshot:** Sign-in page

---

## Totals

| | Count |
|---|---|
| Tests | 37 |
| Updates needed | 3 |
| Removals pending | 5 |

# GuildOS UI Smoke Test — WBS

## UI Restructure (applied before testing)

### Renames & Merges
- **Inn → Tavern** — shows adventurers (what was "upstairs"). No more "main hall" concept.
- **Upstairs → removed** — adventurer list moves to Tavern page
- **Quest board** — adopts Kanban style (what was the Inn's quest board section)
- **GM Chamber + Desk → Guildmaster's Room** — single page showing what the desk shows (review/escalated/closing quests). No separate desk page.
- **Commission adventurer → Tavern button** — "Add Adventurer" button above adventurer list, shows "future feature" popup

### Nav changes
- Top nav: replace "Inn" with "Tavern", remove "Upstairs", remove "GM Desk" (now "GM Room" or just navigable from Town map)
- Forge and Library: read-only, no nav links, only accessible as Town Square sub-pages
- World Map: owns pigeon letters and outposts (future feature placeholders)

---

## 1. Navigation

### 1.1 Top nav bar
**Where:** All /town/* pages
**Test:** Click each link: Town map, Tavern, Quest board, Proving grounds, Town square, Council hall, World map
**Expect:** All navigate correctly. No "Inn", "Upstairs", or "GM Desk" links.
**Screenshot:** Nav bar

### 1.2 Town map (/town)
**Test:** Location cards: Tavern, Town Square, Council Hall, Guildmaster's Room, World map
**Screenshot:** Town map

---

## 2. Tavern (/town/tavern)

### 2.1 Adventurer list
**Test:** All adventurers show with chibi avatars, status badges, quest counts, skill books
**Expect:** Same content as old upstairs page
**Screenshot:** Tavern with adventurers

### 2.2 Add Adventurer button
**Test:** Click "Add Adventurer" above the list
**Expect:** Popup/modal saying "Coming in a future update"
**Screenshot:** Popup visible

### 2.3 Chat — open
**Test:** Click "Chat" on adventurer with session
**Expect:** Chat panel opens with conversation history

### 2.4 Chat — send message
**Test:** Type "Smoke test" → Send
**Expect:** Pending bubble with loading dots, polls for confirmation
**Demo entry:** "Smoke test"

### 2.5 Chat — Open in Cursor
**Test:** Click "Open in Cursor ↗"
**Expect:** New tab to cursor.com/agents/...

### 2.6 Adventurer detail (Edit)
**Test:** Click Edit → change name → Save
**Demo entry:** "Test Rename"
**Expect:** Name updates

---

## 3. Quest Board (/town/quest-board)

### 3.1 Kanban view
**Test:** Quests displayed in columns by stage (execute, escalated, review, closing, complete)
**Expect:** Cards in correct columns with title, assignee, priority badge
**Screenshot:** Kanban board

### 3.2 Click quest
**Test:** Click a quest card
**Expect:** Opens quest detail page

### 3.3 Quest detail — stage dropdown
**Test:** Click stage badge → select new stage → closes → updates
**Screenshot:** Stage dropdown

### 3.4 Quest detail — add comment
**Test:** Type "Smoke test" → Add
**Demo entry:** "Smoke test comment"
**Expect:** Comment appears

### 3.5 Quest detail — edit comment
**Test:** Edit → change text → Save → edit UI closes
**Demo entry:** "Edited smoke test"

### 3.6 Quest detail — delete comment
**Test:** Click X → confirm → removed

### 3.7 Quest detail — summarize (if >5 comments)
**Test:** Click Summarize
**Expect:** Message sent to assigned adventurer

### 3.8 Verify no advance buttons
**Test:** No "Run >> next step" anywhere
**Expect:** Only stage dropdown

---

## 4. Guildmaster's Room (/town/guildmaster-room)

### 4.1 Review quests
**Test:** Review-stage quests with screenshot carousel, title links (new tab), Approve → Close, Feedback
**Screenshot:** GM room with quest + carousel

### 4.2 Title link
**Test:** Click title → new tab to quest detail

### 4.3 Feedback
**Test:** Feedback → type → Send
**Demo entry:** "Test feedback"
**Expect:** Comment posted, adventurer pinged

### 4.4 Approve → Close
**Test:** Click on review quest
**Expect:** Moves to closing

### 4.5 Triage escalated
**Test:** Click "Triage All" (need escalated quests)
**Expect:** Issue, Proposed Solution, Recent Comments, badge

### 4.6 Resolve escalation
**Test:** Type resolution → Resolve
**Demo entry:** "Test resolution"
**Expect:** Comment posted, quest to execute, adventurer pinged

### 4.7 Closing quests visible
**Test:** Closing-stage quests appear
**Screenshot:** GM room with all sections

---

## 5. Town Square (/town/town-square)

### 5.1 Hub
**Test:** Links to Forge, Library, Apothecary
**Screenshot:** Town square

### 5.2 Forge (/town/town-square/forge)
**Test:** Read-only weapon list. No edit controls.
**Screenshot:** Forge

### 5.3 Library (/town/town-square/library)
**Test:** Read-only skill book list. All books visible.
**Screenshot:** Library

### 5.4 Apothecary (/town/town-square/apothecary)
**Test:** Token table renders
**Screenshot:** Apothecary

---

## 6. Council Hall (/town/council-hall)

### 6.1 Hub
**Test:** Links to Formulary and Dungeon master
**Screenshot:** Council hall

### 6.2 Formulary
**Test:** Add key → edit → delete
**Demo entries:** Name: "SMOKE_TEST_KEY", Value: "test-value"
**Screenshot:** Formulary with test key

### 6.3 Dungeon master
**Test:** Settings form renders
**Screenshot:** Dungeon master

---

## 7. Proving Grounds (/town/proving-grounds)

### 7.1 Hub
**Test:** Links to test suites
**Screenshot:** Proving grounds

### 7.2 Browserclaw
**Test:** Interface loads
**Screenshot:** Browserclaw

### 7.3 BigQuery
**Test:** Test credentials button
**Screenshot:** BigQuery test

### 7.4 Asana review
**Test:** Task list loads
**Screenshot:** Asana

---

## 8. World Map (/town/world-map)

### 8.1 Placeholder zones
**Test:** Shows zones including Pigeon Post and Outposts as "Coming in future updates"
**Screenshot:** World map

---

## 9. Other

### 9.1 Sign-in (/signin)
**Test:** Sign-in form renders
**Screenshot:** Sign-in page

### 9.2 Request desk (/town/tavern/request-desk or removed)
**UPDATE** — evaluate if still needed after tavern restructure

---

## Totals

| Section | Tests |
|---------|-------|
| Navigation | 2 |
| Tavern | 6 |
| Quest Board | 8 |
| GM Room | 7 |
| Town Square | 4 |
| Council Hall | 3 |
| Proving Grounds | 4 |
| World Map | 1 |
| Other | 2 |
| **Total** | **37** |

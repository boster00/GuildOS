# GuildOS Refactor Progress

## Last updated: 2026-04-14

## Completed

### Phase 0: Fix Cursor Weapon Payload
- [x] `libs/weapon/cursor/index.js` — changed `writeFollowup` body from `{ message, model }` to `{ prompt: { text: message } }`
- [x] Verified with test message to agent bc-1a4bfbeb — 200 OK

### Phase 1: Adventurer Session Infrastructure
- [x] Migration `20260414200000_add_adventurer_session_fields.sql` — added `session_id`, `worker_type`, `session_status`, `busy_since` to adventurers + `dispatch_token` to quests
- [x] Migration `20260414201000_add_adventurer_avatar.sql` — added `avatar_url` to adventurers
- [x] Both migrations pushed to remote Supabase
- [x] `libs/council/database/serverAdventurer.js` — updated ADVENTURER_ROW_SELECT, added `updateAdventurerSession()`
- [x] `app/api/adventurer/route.js` — added GET handler + POST actions: `link_session`, `message`; GET actions: `conversation`, `session_status`
- [x] `libs/council/cron/index.js` — added `updateAdventurerStatuses()` pass with confused threshold
- [x] Chibi sprites: cropped bunny-sheet and monkey-sheet into 8 individual PNGs at `public/images/guildos/sprites/`
- [x] `AdventurerRoomCard.js` — shows avatar with pose based on status + status badge
- [x] Assigned avatar types in DB: Zoho Advisor=monkey, Neo Golden Finger=bunny

### Adventurer status-to-pose mapping
| Status | Pose | Meaning |
|--------|------|---------|
| idle/inactive | normal | No quest in execute/review |
| raised_hand | happy | All quests done/in review |
| busy | working | Actively working |
| confused/error | attention | Needs help |

## In Progress

### Phase 6 (partial): Gmail skill book converted to knowledge registry format
- [x] `libs/skill_book/gmail/index.js` — toc entries now have `howTo` fields with prompt instructions
- [x] Legacy JS functions preserved at bottom for backward compat

### Phase 4: Global Instructions
- [x] Created `docs/global-instructions.md` with entity model, weapon usage, skill book usage, submit_results API

### Agent session linking
- [x] Linked bc-1a4bfbeb to Neo Golden Finger adventurer

### Acceptance criteria
- [x] Created "GuildOS Refactor" quest (id: 7b223a04-46dc-4e37-948d-919260fdc8bb) in review stage
- [x] Dispatched screenshot task to agent bc-1a4bfbeb
- [x] Agent took 6 screenshots using native Chrome (xdotool + ffmpeg x11grab)
- [x] Screenshots verified: skill book registry, Inn upstairs with chibis, docs listing, library, forge, inn
- [x] Uploaded all 6 to Supabase Storage under GuildOS_Bucket/cursor_cloud/{questId}/
- [x] Quest inventory updated with screenshot URLs
- [x] Quest "GuildOS Refactor" (7b223a04) visible on GM's Desk with screenshots

## Files Modified (this refactor)
- `libs/weapon/cursor/index.js`
- `libs/council/database/serverAdventurer.js`
- `libs/council/cron/index.js`
- `app/api/adventurer/route.js`
- `app/town/inn/upstairs/AdventurerRoomCard.js`

### Phase 4.5: Escalation Stage + Guildmaster Triage (designed, not yet implemented)
- [x] Concept defined: `escalated` stage between execute and review
- [x] Guildmaster = local Claude Code session, triages escalated tasks
- [x] Triage button: classifies autonomous vs needs-user
- [x] Updated global instructions with escalation flow
- [x] `escalated` added to VALID_STAGES in `libs/quest/index.js`
- [x] Proving grounds: escalated stage handler (no-op, awaits triage)
- [x] Cron: includes escalated in polling
- [x] API: `triage_escalated` (pattern-match autonomous vs needs-user) and `resolve_escalation` (comment + return to execute)
- [x] GM Desk: shows escalated quests with "Triage All" button, classification badges (Can resolve / Needs you), resolve action for autonomous items

### Phase 2 (partial): Adventurer Chat UI
- [x] Inn upstairs cards redesigned: no system prompt, quest stage counts, skill books inline
- [x] Chat button opens inline chat panel with conversation history (DaisyUI chat bubbles)
- [x] "Open in Cursor" link in chat panel when session is linked
- [x] Green dot indicator for session-linked adventurers

### Feedback → Adventurer Ping
- [x] Quest comment API pings adventurer's live session when user/guildmaster posts feedback
- [x] Loop prevention: skips ping for adventurer/agent/system source comments

## Files Created
- `supabase/migrations/20260414200000_add_adventurer_session_fields.sql`
- `supabase/migrations/20260414201000_add_adventurer_avatar.sql`
- `public/images/guildos/sprites/bunny-{normal,happy,attention,working}.png`
- `public/images/guildos/sprites/monkey-{normal,happy,attention,working}.png`
- `docs/GuildOS-refactor.md` (notes)
- `docs/refactor-progress.md` (this file)

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

### Remaining for acceptance criteria screenshots:
1. **Screenshot 1 (skill book as registry):** Convert at least 1 skill book to knowledge registry format (Phase 6)
2. **Screenshot 2 (Inn upstairs):** Map existing Cursor sessions to adventurers, verify page renders with avatars+status
3. **Screenshot 3 (global instructions):** Create `docs/global-instructions.md`, consolidate other docs
4. **Screenshot 4 (Library/Forge/Pigeon Post):** These pages exist, just need screenshots

### Then:
- Create "GuildOS Refactor" quest in review stage
- Dispatch agent bc-1a4bfbeb to take screenshots, save to Supabase, add as quest inventory items
- Verify screenshots on GM's Desk

## Files Modified (this refactor)
- `libs/weapon/cursor/index.js`
- `libs/council/database/serverAdventurer.js`
- `libs/council/cron/index.js`
- `app/api/adventurer/route.js`
- `app/town/inn/upstairs/AdventurerRoomCard.js`

## Files Created
- `supabase/migrations/20260414200000_add_adventurer_session_fields.sql`
- `supabase/migrations/20260414201000_add_adventurer_avatar.sql`
- `public/images/guildos/sprites/bunny-{normal,happy,attention,working}.png`
- `public/images/guildos/sprites/monkey-{normal,happy,attention,working}.png`
- `docs/GuildOS-refactor.md` (notes)
- `docs/refactor-progress.md` (this file)

# BosterBio Real Run — Decisions Needed

## Questions for User

| # | Question | Options |
|---|----------|---------|
| 1 | **initAgent: clone GuildOS repo?** Agent couldn't access skill books or query quests because GuildOS code isn't in its workspace. | (a) Clone GuildOS repo alongside project repo during init (b) Send skill book text inline (c) Build API endpoints |
| 2 | **System_prompt overrides global?** Global says "Tailwind v4 only" but BosterBio uses v3. Agent correctly didn't force-upgrade. | (a) system_prompt overrides global for project-specific stack (b) Global is always authoritative |
| 3 | **Agent auto-created PR.** Good initiative or unwanted? | (a) Allow — agents should PR when submitting work (b) Only when explicitly asked |
| 4 | **Figma comparison: who does it?** Agent can't pixel-compare remotely. | (a) User-side review step on GM desk (b) Agent uses Figma weapon for structural comparison only |
| 5 | **Guildmaster guide needed.** I (local Claude Code) bypassed the quest system — sent raw task instructions instead of creating quest first. No instructions exist for the Guildmaster role. | (a) Write a Guildmaster guide: always create quest, assign, then notify (b) Keep ad-hoc for now |
| 6 | **"Correct the record" action?** When user corrects wrong info (e.g., "it's PostgreSQL not Supabase"), should that auto-update system_prompt in DB? | (a) Yes — add correctRecord action to housekeeping (b) Manual updates only |
| 7 | **Env provisioning in initAgent?** Agent wasted time on missing Supabase key. | (a) readEnvSetupInstructions during init (b) Include in GuildOS clone .env.local (c) Both |

## What Worked
- Agent creation via Cursor API, setNewAgent flow, cron nudge, autonomous coding, self-bug-fixing, honest gap reporting

| 8 | **Duplicate quests created.** Multiple quests for the same web dev task exist because quest creation was done ad-hoc without checking for existing ones. Need dedup — before creating a quest, check if one with similar title/Asana task already exists. | Pending |

## What Didn't
- Quest never created in DB (Guildmaster skipped the step)
- Agent couldn't access skill books (wrong repo)
- Wrong infra context in system_prompt wasted agent time
- Env vars missing on agent

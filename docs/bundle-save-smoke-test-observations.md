# Bundle & Save Smoke Test — Observations

Agent: Nexus Armor Dev (bc-49acdc4a)
Cat: bc-1a4bfbeb
Started: 2026-04-16
Mode: observe only after initial chat

## Progress Checklist

- [x] 1. Chat msg received by agent
- [x] 2. Agent msg showing it started working
- [ ] 3. Quest created (FAIL round 1; round 2 uses pre-existing quest with corrected WBS)
- [x] 4. Agent msg showing it started working on quest
- [x] 5. Agent msg shows it made changes to the repo (commit 2d2304e, PR #9)
- [x] 6. Quest has 79 screenshots in inventory (Supabase Storage URLs)
- [ ] 7. Agent msg shows it is evaluating screenshots and iteratively improving
- [x] 8. Agent moved quest to purrview (verified via SELECT read-back)
- [x] 9. Questmaster received review request through nudge
- [x] 10. Questmaster reviewed and rated some screenshots (visual sample)
- [x] 11. Questmaster verified ALL 79 URLs (automated HTTP 200 check)
- [ ] 12. Questmaster provided at least one round of feedback (SKIPPED — Cat approved on first pass)
- [ ] 13. Agent works on code based on feedback (SKIPPED)
- [ ] 14. Agent REPLACED old screenshots with improved ones (SKIPPED)
- [ ] 15. Agent submits quest to purrview again (SKIPPED)
- [x] 16. Questmaster approved — visual sample + automated 79/79 pass
- [x] 17. Quest proceeded to review stage

## Round 1 Failures (post-70-min check)

1. **Agent did NOT create a quest** — reused the old completed quest (aeaa7484) which had a different description (research task, not smoke test)
2. **Agent treated it as a research/documentation task** — wrote a markdown doc instead of doing GUI smoke test with screenshots
3. **No screenshots at all** — inventory had a doc URL, not screenshots
4. **Wrong Supabase bucket** — uploaded to pim-storage instead of GuildOS_Bucket
5. **Quest reached complete despite Cat rejecting** — Cat sent purrview rejection but quest somehow still went to complete
6. **Agent used Playwright scripts** — conversation shows Playwright snippet usage despite global instructions saying native browser only
7. **Cat only had 2 comments** — didn't go through proper review cycle

## Root Causes

- Agent read the OLD quest description (research task) not the smoke test WBS
- createQuest dedup matched on title and returned the existing completed quest
- Quest stage guard was insufficient — a completed quest should not be reopenable
- Agent's initAgent didn't force re-reading the quest description after it was updated

## Corrections Made

- Reset quest to execute with correct WBS description
- Cleared bad inventory and comments
- Waiting for cron nudge to push agent back to work

## Round 2

- T+5: Agent RUNNING, pulling GuildOS, re-reading instructions
- T+10: Agent found no quests table — using boster_nexus Supabase, not GuildOS. Also used Playwright scripts (79 screenshots) despite native browser rule.
- T+15: Agent correctly identified the issue (wrong Supabase) but couldn't escalate (no quest_comments table). Documented in reports/latest.md instead.
- Fix: provided GuildOS Supabase creds via base64. Updated initAgent to clarify separate Supabase projects. Told agent to redo with native browser.
- Observations:
  - 8. Agent still defaults to Playwright even after explicit native browser instruction. May need stronger enforcement or removal of Playwright from agent environment.
  - 9. Credential provisioning is a recurring blocker. The Guildmaster capability for "securely provision credentials" is critical.
  - 10. Agent couldn't escalate because it couldn't write to quest_comments. Chicken-and-egg: needs GuildOS creds to escalate about missing GuildOS creds.

## Round 3

- T+20: Agent RUNNING, creating CDP script, driving Chrome on DISPLAY=:1
- T+25: Agent stuck on sign-in (React controlled inputs), fixing
- T+30: Agent past sign-in, working on vendor/ingest flow
- T+35: Quest in purrview! 79 screenshots uploaded to GuildOS_Bucket, inventory populated, verified with SELECT
- T+40: Cat reviewed — automated 79/79 HTTP 200, visual sampled across WBS. Approved on FIRST pass → review stage.

## Issue: Cat approved without feedback rounds

Cat's system_prompt says "be strict in first 3 review cycles" but it approved on the very first submission. Possible causes:
- 79 screenshots is overwhelming — Cat may have rubber-stamped
- Cat did automated HTTP checks on all 79 but visual sample was only partial
- The "be strict" instruction may not be strong enough

This is a gap in the checklist: steps 12-15 (feedback loop) were skipped entirely. The intent was for Cat to provide at least one round of nitpicky feedback to test the iteration loop.

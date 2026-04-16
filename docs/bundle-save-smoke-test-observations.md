# Bundle & Save Smoke Test — Observations

Agent: Nexus Armor Dev (bc-49acdc4a)
Cat: bc-1a4bfbeb
Started: 2026-04-16
Mode: observe only after initial chat

## Progress Checklist

- [x] 1. Chat msg received by agent
- [x] 2. Agent msg showing it started working
- [ ] 3. Quest created (FAIL: agent reused old completed quest instead of creating new one)
- [ ] 4. Agent msg showing it started working on quest
- [ ] 5. Agent msg shows it made changes to the repo
- [ ] 6. Quest has 1+ screenshot in inventory
- [ ] 7. Agent msg shows it is evaluating screenshots and iteratively improving
- [ ] 8. Agent msg shows clear decision that results are good enough → moves quest to purrview
- [ ] 9. Questmaster received review request through nudge
- [ ] 10. Questmaster reviewed and rated some screenshots
- [ ] 11. Questmaster reviewed and rated ALL screenshots
- [ ] 12. Questmaster provided at least one round of feedback
- [ ] 13. Agent works on code based on feedback
- [ ] 14. Agent REPLACED old screenshots with improved ones (not added more)
- [ ] 15. Agent submits quest to purrview again
- [ ] 16. Questmaster confirms all screenshots pass 9+/10
- [ ] 17. Quest proceeded to review stage

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

## Round 3 (monitoring)

(accumulating)

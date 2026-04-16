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

## Findings

### What worked
- Agent uploaded 79 screenshots to Supabase Storage (GuildOS_Bucket) and stored URLs in quest inventory
- Agent verified DB writes with SELECT read-back before moving to purrview
- Cat reviewed all 79 items with per-item pass/fail + WBS-referencing notes written into inventory
- GM desk carousel now shows pass/fail badges under each screenshot
- Vercel cron nudged both agents correctly
- The full execute → purrview → review flow completed autonomously

### What failed
- **Step 3:** Agent did not create the quest — reused a pre-existing one. createQuest action untested in real flow.
- **Step 7:** Agent did not self-evaluate before submitting — went straight to purrview after capturing screenshots.
- **Steps 12-15:** Cat approved on first pass without providing feedback. The "first submission must get improvement suggestions" rule was bypassed because Cat treated it as a re-submission from prior rounds. The feedback → iterate → resubmit loop was never tested.

### Recommended updates

| # | Update | Where |
|---|--------|-------|
| 1 | **Add purrview_count to quest** — track how many times a quest enters purrview. Cat checks this: if count == 1, must provide feedback. Prevents "re-submission" bypass. | DB migration + questmaster skill book |
| 2 | **Test createQuest in next smoke test** — start from chat, agent must create quest itself, no pre-made quests. | Next test run |
| 3 | **CDP scripting is acceptable** — agent used Chrome DevTools Protocol to drive the native browser on DISPLAY=:1. This is functionally equivalent to "native browser" and should be explicitly accepted in global instructions as the standard approach. | docs/global-instructions.md |
| 4 | **GuildOS Supabase credentials must be provisioned during initAgent** — every run hit this blocker. Make it part of the standard Guildmaster credential provisioning capability. | housekeeping initAgent + Guildmaster guide |
| 5 | **Escalation without GuildOS DB access is impossible** — if an agent can't write to quest_comments, it can't escalate. Need a fallback (e.g., write to repo file and push, or message Cat directly). | housekeeping escalate action |

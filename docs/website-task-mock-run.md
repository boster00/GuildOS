# Real Run: BosterBio Website Dev Quest

Live conversation with agent bc-fb70e14d (BosterBio Website Dev).
Asana task: 1214025303063053 — "Develop the website on cloud cursor"

## Observations & Improvement Notes

(Accumulated during the run)

### Initiation
- **NOTE 1:** Agent was in FINISHED/ailing state. Sending a followup message woke it up. The system correctly handles this — FINISHED agents can still receive messages. But the UI showed "ailing" which could confuse users. **Improvement: distinguish "ailing" (API error) from "sleeping" (FINISHED but addressable).**
- **NOTE 2:** initAgent was sent manually by constructing a message. The link_session API auto-sends init, but this agent was already linked. **Improvement: need a "re-init" action in the UI (button on the adventurer card) that re-sends global + system_prompt + skill books without re-linking.**
- **NOTE 3:** The init message I sent was hand-written, duplicating what's in system_prompt and global instructions. **Improvement: the initAgent action in housekeeping should be executable by the Guildmaster (me) — a single API call that assembles and sends the full init payload.**

---

## Conversation Log

- **NOTE 4:** initAgent should include a version/branch check. If the agent's repo is stale or on an old branch, it should pull latest main before doing anything. Add to initAgent: "Run `git checkout main && git pull origin main && npm install` before starting work."
- **NOTE 5:** Agent bc-fb70e14d was on stale branch `cursor/bosterbio-homepage-1b41`, diverged from main. Got "Update script failed, your environment may not work as expected." **Improvement: initAgent must handle repo reset. Or: standardize creating fresh agents when old ones are broken.**
- **NOTE 6:** No Cursor API endpoint for creating agents — must be done manually at cursor.com. The post-creation workflow (link_session → auto-init) works, but creating the agent is a manual step. **Improvement: document the new-agent workflow clearly. Consider adding a "New Agent" button in the Inn UI that generates instructions for the user.**
- **NOTE 7:** Stale agents are a recurring problem. Options: (a) fix in-place by resetting to main, (b) create fresh agent, (c) both — try reset first, create fresh if it fails. **Need to decide on standard approach.**

### Message 1 (sent): initAgent + status request
Asked the agent to report current repo state before planning.
Agent was on stale branch. Got environment error.


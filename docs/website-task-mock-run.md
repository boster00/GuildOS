# Real Run: BosterBio Website Dev Quest — Session Notes

Agent: bc-18c56ad0 (BosterBio Website Dev)
Asana task: 1214025303063053 — "Develop the website on cloud cursor"
Date: 2026-04-15

## Current State

- New agent created via Cursor API, linked to adventurer, old agent archived
- Agent is running on branch `cursor/pending-instructions-definition-bb93` (merged with old work branch)
- Agent is building screenshots and pushing code
- Cron is running with `npm run dev`, will nudge if agent goes idle
- **Quest NOT yet created in DB** — agent was given raw instructions instead of working from a quest record

---

## Action Items for User Review

### Architecture / Process Gaps

| # | Point | My Recommendation |
|---|-------|-------------------|
| 1 | **No Guildmaster instructions exist.** Global instructions are for adventurers. Nothing tells the local Claude Code (Guildmaster) how to properly dispatch work — create quest first, then notify agent. I sent raw task instructions directly to the agent, bypassing the quest system entirely. | Write a Guildmaster guide: always create quest in DB first, assign to adventurer, then send agent "check getActiveQuests." Never send raw task instructions. |
| 2 | **Agent should discover work via quests, not chat.** The agent should read its assigned quests from DB, not receive the full task description in a followup message. Chat is for nudges and feedback, not task specs. | Update global: "Your work comes from quests assigned to you. Use getActiveQuests to find what to work on. Chat messages are for coordination, not task definitions." |
| 3 | **Quest was never created.** I went straight from init to "here's your task" without creating a quest record. No stage tracking, no comments, no assignee_id, GM desk can't see it. | Before real launch: create quest in DB with full WBS description, assign to adventurer, let the system work as designed. |

### initAgent Improvements

| # | Point | My Recommendation |
|---|-------|-------------------|
| 4 | **initAgent should include env provisioning.** Agent wasted time because it didn't have the right env vars. The cursor weapon has `readEnvSetupInstructions()` but it wasn't used. | Call readEnvSetupInstructions during initAgent flow and send env setup to agent. |
| 5 | **initAgent should be a single API endpoint.** Currently the Guildmaster hand-assembles the init message. Should be one call: `POST /api/adventurer?action=init` that reads global + system_prompt + skill books + env and sends it all. | Build the API action. link_session already does partial init — extend it or add separate action. |
| 6 | **Re-init button in Inn UI.** Currently no way to re-send init without re-linking. Need a button on the adventurer card. | Add "Re-init" button that calls the init API action. |
| 7 | **Version/branch check works but needs repo-specific handling.** BosterBio repo had no `main` branch — only feature branches. Agent was created on old working branch, which is fine. | initAgent should not enforce `main` — just pull latest on whatever branch and continue. |

### Agent Session Management

| # | Point | My Recommendation |
|---|-------|-------------------|
| 8 | **setNewAgent flow validated.** Old agent ERROR → create new via API → link → archive old → init new. Took ~2 minutes. Works. | Add `createAgent` to cursor weapon (the API endpoint exists: `POST /v0/agents` with `source.repository` and `source.ref`). |
| 9 | **Distinguish "ailing" from "sleeping" in UI.** FINISHED agents can still receive messages. "Ailing" implies broken, but FINISHED is just idle. | Add a "sleeping" status for FINISHED agents that respond to messages. Reserve "ailing" for actual errors. |
| 10 | **Followup messages queue, can't interrupt.** Cursor API queues followups — agent processes them only after finishing current work. Web UI can submit immediately. | Document in housekeeping: "followup messages queue behind current work. If urgent, use the Cursor web UI to submit directly." |

### System_prompt / Context Issues

| # | Point | My Recommendation |
|---|-------|-------------------|
| 11 | **Wrong infra context wasted agent time.** I said "use Supabase" but BosterBio uses local PostgreSQL for Medusa. Product catalog data IS in Supabase though. | System_prompt must precisely describe infra. Fixed: "Medusa backend uses local PostgreSQL. Product catalog data is in Supabase boster_products table." |
| 12 | **"Correct the record" action needed.** When user corrects wrong info, that correction should update system_prompt in DB permanently, not just fix one conversation. | Add a housekeeping action: `correctRecord` — updates adventurer system_prompt in DB with the correction. |
| 13 | **Global rule conflicts with project reality.** Global says "Tailwind v4 + DaisyUI v5 only" but existing BosterBio project uses v3. Agent correctly noted the gap and didn't force-upgrade. | System_prompt should override global for project-specific tech stack. Add to global: "Your system_prompt takes precedence over global rules for project-specific conventions." |

### Workflow / Communication

| # | Point | My Recommendation |
|---|-------|-------------------|
| 14 | **Escalation path needs to work end-to-end.** Agent → Questmaster → Guildmaster → user. Currently GM desk triage is pattern matching, not a real conversation with Questmaster. | Build real escalation: agent calls seekHelp → message goes to Cat → Cat evaluates → if can't help, posts to quest comments → GM desk shows it → local Claude evaluates. |
| 15 | **Agent auto-created PR without being asked.** Good initiative but may be unwanted. | Add to global: "Create PRs only when explicitly asked or when submitting for review." Or leave as-is if this is desired behavior. |
| 16 | **Figma comparison is impractical for agents.** Agent can't pixel-compare against Figma remotely. It can use the Figma weapon API for node structure but not visual comparison. | Figma visual comparison should be a user-side review step. Agent focuses on building; user compares to Figma on the GM desk. |
| 17 | **40+ screenshots in carousel is overwhelming.** | Group screenshots by phase/page in desk UI. Deferred. |
| 18 | **Agent honestly reported gaps.** Transparency about what it couldn't do (Figma audit, Tailwind upgrade, upload failure) was valuable. | Keep: the "honest reporting" behavior is working. No change needed. |

### Confirmed Working

| # | What | Status |
|---|------|--------|
| 19 | Agent creation via Cursor API | Works |
| 20 | setNewAgent flow (create, link, archive, init) | Works |
| 21 | Cron running with `npm run dev` | Works |
| 22 | Agent picks up work and codes autonomously | Works |
| 23 | Agent self-fixes bugs (routing loops, null data, cache issues) | Works |
| 24 | Agent pushes code to GitHub | Works |
| 25 | Nudge system (cron → confused → nudge message) | Works (needs real-world verification) |

### Final Outcome
- **Quest:** "BosterBio Website — Figma Conversion & Product Catalog" (25481ccb) in review stage
- **Agent:** bc-18c56ad0 (replaced bc-fb70e14d which was ERROR)
- **Branch:** cursor/pending-instructions-definition-bb93, PR #7
- **Deliverables:** 48 screenshots pushed to repo, 6 key screenshots uploaded to Supabase for GM desk
- **Remaining gaps:** Catalog shows 4 products (not 5), Tailwind still v3, no Figma pixel comparison, products from Supabase not Medusa

### Top Improvement Priorities (from this run)
1. **initAgent must provision env vars** — agent wasted time on missing Supabase key
2. **System_prompt must accurately describe infra** — wrong DB info (Supabase vs PostgreSQL) caused confusion
3. **Separate init from task dispatch** — send init, confirm ready, then send task
4. **Add createAgent to cursor weapon** — we discovered the API endpoint exists
5. **Global: system_prompt overrides global for project-specific conventions** — prevents Tailwind v3/v4 conflicts

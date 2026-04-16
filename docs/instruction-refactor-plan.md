# Instruction Refactor Plan

Based on 30 messages of web dev agent conversation, patterns identified:

## Problems Observed

### 1. Agent didn't know inventory was required
The agent stored evidence in quest_comments.detail and raw GitHub URLs but never wrote to quest.inventory. It learned this requirement only after being told explicitly mid-conversation. 

**Root cause:** The instruction was added to global-instructions.md mid-flight. Agent was initialized before this rule existed and never pulled the update.

**Fix:** The `submitForPurrview` action in housekeeping already locks this rule. But agents need to re-read instructions periodically, not just at init.

### 2. Agent restored test writes
When asked to verify DB writes, agent did a write → read-back → RESTORE to original state. It treated the verification as a test, not as the actual operation.

**Root cause:** Ambiguous instruction. "Verify writes" was interpreted as "test that writes work" not "do the write and confirm it stuck."

**Fix:** Already addressed — global instructions now say "SELECT the row back and use returned values as truth."

### 3. Agent waited for permission to move stage
Multiple cycles of: agent has deliverables → doesn't move to purrview → gets nudged → still waits. Only moved after direct "why aren't you doing it?" message.

**Root cause:** Agent was being cautious after earlier confusion. Nudge said "if you believe deliverables are met" which is a conditional, not a directive.

**Fix:** Nudge now says "do not wait for permission." But the deeper fix: agents should follow a checklist, not make judgment calls about when to proceed. The submitForPurrview action IS that checklist.

### 4. GuildOS repo has no main branch in bosterbio.com2026
`git pull origin main` fails on the bosterbio repo because the default branch is `claude/setup-nextjs-medusa-3bhX2`. Agent reported this but kept trying.

**Fix:** system_prompt should specify the correct branch name, or agent should use `git remote show origin | grep HEAD` to find it.

### 5. Agent couldn't push to GuildOS main
The Cursor bot account gets 403 on `boster00/GuildOS` main branch. Agent can commit locally but can't push.

**Fix:** Either grant cursor[bot] push access, or accept that GuildOS changes from agents go on feature branches only.

---

## Proposed Changes

### For this task (BosterBio web dev)

1. **Update BosterBio system_prompt** with correct default branch name
2. **Ensure .env.local creation** is in initAgent (already done)
3. **Quest description should specify** that inventory must contain Supabase Storage URLs for all screenshots

### For all tasks (global)

1. **Periodic re-read rule:** Add to global instructions: "At the start of every work session (after each nudge), pull ~/guildos and re-read docs/global-instructions.md. Instructions change — stale context causes errors."

2. **submitForPurrview is mandatory:** Add to nudge message: "Follow the submitForPurrview action from housekeeping skill book." Currently the nudge gives free-form instructions. It should point to the skill book action which has the exact checklist.

3. **No test-then-restore pattern:** Add to global: "When writing to the database, write what you intend. Do not write test values and restore. Every write should be the real operation."

4. **Branch discovery:** Add to initAgent: "If git pull origin main fails, run: git remote show origin | grep HEAD to find the default branch."

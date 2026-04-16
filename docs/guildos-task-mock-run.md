Things I noticed should change:
1. the agent chat UI: if the agent status is busy, it should still pull every 5 seconds for new messages while the chat window is open, and that when the agent status is busy, the chat UI should show a agent is typing sort of status indicator, so the user know the agent is working on a message back.
Update status: done

2. Agent hit build errors because skill_book/cursor and weapon modules (asana, figma, ssh, supabase_storage, auth_state) were never committed to main. Agent pulled from main and got missing import errors. Root cause: Guildmaster said "all changes committed" but didn't check for untracked files in libs/.
Update status: fixed — all modules committed to main

3. Need to verify npm run build passes on a clean clone of main before declaring "all committed." The Guildmaster should run a build check.
Update status: done — agent confirmed build passes after pulling fixed main

4. Agent thought it couldn't take UI screenshots and said "manual pass needed." Had to remind it about Chrome on DISPLAY=:1 and the UI Testing section in global instructions. Agent didn't read that section proactively.
Update status: nudged to use native browser

5. Agent fixed a real lint error: renamed `module` variable in zoho API route to `moduleName` (was triggering @next/next/no-assign-module-variable). Good autonomous fix.
Update status: done by agent

6. Agent added legacy /town/inn → tavern redirects in next.config.mjs. Good initiative — old bookmarks and links won't 404.
Update status: done by agent

7. Agent launched Chrome with fresh temp profile — hit sign-in redirect on all pages. No auth state available on cloud VM. This is a known limitation: cloud agents can't easily get authenticated sessions without auth state sharing. Options: (a) share auth cookies via storageState, (b) create Supabase test session programmatically, (c) accept sign-in page as the screenshot for unauthenticated state.
Update status: in progress — agent testing which pages work without auth
Future fix: auth_state weapon already exists (libs/weapon/auth_state/). Wire into initAgent: user captures cookies locally via scripts/auth-capture.mjs → upload to Supabase Storage → agent downloads during init → loads into Chrome. Pieces exist, just not connected yet.

8. BosterBio agent stuck in infinite small-fix loop. Gets nudged → does a tiny link fix → goes idle → gets nudged again. Never evaluates overall quest completion against the WBS deliverables. Root cause: no instruction telling agents to periodically assess "am I done?" against the quest deliverables. The nudge just says "keep working" which the agent interprets as "find something else to fix."
Update status: sent explicit "evaluate and submit or escalate" message. Need to add "completion check" behavior to global instructions or housekeeping.

9. Global instructions should say: when you believe all deliverables in the quest WBS are met, stop making improvements and contact the Questmaster for review. Do not keep polishing indefinitely.
Update status: done — added purrview stage and "submit when done" to nudge + global

10. Cat got stuck in merge conflict loop (10+ min). Had to send hard reset (git reset --hard origin/main). Root cause: Cat's branch diverged too far from main. Fix: agents on GuildOS repo should always work on main, not feature branches.
Update status: resolved

11. Cursor API has more endpoints than we knew: List Agents, Artifacts, Stop, Delete, Models, Repositories. No queue view or force-send though. Added to weapon backlog.
Update status: noted

12. Smoke test quest reached purrview. Cat reviewed and gave correct feedback (file:// paths not verifiable). But Cat's DB write to move quest back to execute failed silently — quest stayed in purrview. Cat likely lacks proper Supabase service role key or used anon key blocked by RLS. Guildmaster had to move it manually.
Update status: Cat needs verified DB write access

13. Agents claiming they did a DB write but it didn't actually happen — both agents confirmed writes NOW work with service role key. Earlier failures unexplained (possibly stale session or different key). Write verification added to global instructions.
Update status: resolved — agents can write, verify-writes rule added

14. BosterBio agent's GuildOS clone showed global instructions without purrview — possible stale pull. Agents should always git pull ~/guildos before re-reading instructions.
Update status: noted

15. Both quests stuck in execute despite agents believing they moved to purrview. Guildmaster cannot directly mutate quests — must rely on agents and cron. Agents need next Vercel cron nudge to trigger the move.
Update status: waiting for cron cycle

Things I noticed should change:
1. the agent chat UI: if the agent status is busy, it should still pull every 5 seconds for new messages while the chat window is open, and that when the agent status is busy, the chat UI should show a agent is typing sort of status indicator, so the user know the agent is working on a message back.
Update status: done

2. Agent hit build errors because skill_book/cursor and weapon modules (asana, figma, ssh, supabase_storage, auth_state) were never committed to main. Agent pulled from main and got missing import errors. Root cause: Guildmaster said "all changes committed" but didn't check for untracked files in libs/.
Update status: fixed — all modules committed to main

3. Need to verify npm run build passes on a clean clone of main before declaring "all committed." The Guildmaster should run a build check.
Update status: pending

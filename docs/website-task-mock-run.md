# BosterBio Real Run — All Decisions Resolved

## Resolved Decisions (all implemented)

1. Clone GuildOS repo during initAgent ✅
2. Priority: system_prompt > skill books > global ✅
3. Agents do NOT create PRs — Questmaster handles ✅
4. 3-layer validation: agent self-gate → Questmaster → user ✅
5. Guildmaster guide formalized ✅
6. No auto correctRecord — use live chat ✅
7. No auto env provisioning — agent escalates ✅
8. Remove advance buttons — pending UI change
9. Dedup quests — pending implementation

## New Observations (round 2)

| # | Observation |
|---|-------------|
| 10 | .env.local is gitignored — agent clones GuildOS but has no credentials. The "escalate to user" flow works correctly but adds latency. Need a secure way to provision env vars to new agents. |
| 11 | Secret scanner on Cursor redacts inline credentials in messages. Can't just paste keys. Need alternative delivery (env file in workspace, or encoded). |
| 12 | Cat (Questmaster) is on GuildOS repo agent bc-1a4bfbeb. For closing/Asana archival, Cat needs to be able to call Asana weapon. Untested. |
| 13 | "Approve → Close" button correctly sends to closing stage now. Cron notifies Cat. But Cat hasn't been initialized with Questmaster instructions yet. |
| 14 | Agent correctly followed the full initAgent flow: clone repo, read instructions, detect missing env, escalate. The skill book instructions work. |
| 15 | Mark done previously went straight to complete, skipping closing/Asana archival. Fixed button label and behavior. Old quests moved back to closing. |

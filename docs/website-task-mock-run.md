# GuildOS Orchestration — Open Gaps

## Critical (blocks autonomous operation)

| # | Gap | Impact |
|---|-----|--------|
| 1 | **Cat (Questmaster) never initialized** | No review layer. Agent can't seekHelp, closing quests pile up. Cat has session bc-1a4bfbeb but was never sent initAgent or questmaster instructions. |
| 2 | **Closing → Asana archival untested** | Quests sit in closing forever. Cron notifies Cat but Cat doesn't know what to do. |

## Important (degrades efficiency)

| # | Gap | Impact |
|---|-----|--------|
| 3 | **No quest dedup** | Multiple quests for same task created manually. Need check-before-create. |
| 4 | **Guildmaster can't auto-resolve escalations** | Agent escalates missing env vars, GM has to manually base64-encode and send. Not automated. |
| 5 | **Comment summarization not implemented** | Quests will flood over time. housekeeping.summarizeComments defined but never called. |

## Nice to have (ergonomic)

| # | Gap | Impact |
|---|-----|--------|
| 6 | **Inn UI missing "Re-init" button** | Can't re-init agent from UI — must send manual messages. |
| 7 | **No multi-agent coordination** | Agents work in isolation. No handoff or artifact sharing between agents. |

## Resolved this round
- Stage inconsistency: migrated 8 quests from 'completed' to 'complete'
- Quest advance buttons removed from quest detail UI
- Cat initialization: in progress

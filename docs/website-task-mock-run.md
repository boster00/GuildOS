# GuildOS Orchestration — Open Gaps

## Critical (blocks autonomous operation)

| # | Gap | Impact |
|---|-----|--------|
| 1 | **Cat (Questmaster) never initialized** | No review layer. Agent can't seekHelp, closing quests pile up. Cat has session bc-1a4bfbeb but was never sent initAgent or questmaster instructions. |
| 2 | **Closing → Asana archival untested** | Quests sit in closing forever. Cron notifies Cat but Cat doesn't know what to do. |
| 3 | **Stage name inconsistency** | DB has both 'completed' and 'complete'. Agent's getActiveQuests filter misses some. Need migration to standardize. |

## Important (degrades efficiency)

| # | Gap | Impact |
|---|-----|--------|
| 4 | **No quest dedup** | Multiple quests for same task created manually. Need check-before-create. |
| 5 | **Guildmaster can't auto-resolve escalations** | Agent escalates missing env vars, GM has to manually base64-encode and send. Not automated. |
| 6 | **Comment summarization not implemented** | Quests will flood over time. housekeeping.summarizeComments defined but never called. |
| 7 | **Quest advance buttons still in UI** | Old pipeline buttons confuse the new agent-driven model. Remove from quest detail page. |

## Nice to have (ergonomic)

| # | Gap | Impact |
|---|-----|--------|
| 8 | **Inn UI missing "Re-init" button** | Can't re-init agent from UI — must send manual messages. |
| 9 | **No multi-agent coordination** | Agents work in isolation. No handoff or artifact sharing between agents. |
| 10 | **System_prompt changed 3 times for infra** | Lesson: verify infra facts with user before writing system_prompt. Don't guess. |

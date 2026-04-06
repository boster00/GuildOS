# claude-scripts

Standalone Node.js scripts for Claude to trigger GuildOS actions directly without going through the GUI or waiting for the cron loop.

## Setup

All scripts read from `.env.local` in the project root. Run from the project root:

```bash
node claude-scripts/create-quest.js "My quest title" "Detailed description here"
node claude-scripts/advance-quest.js <questId> [maxCycles]
node claude-scripts/get-quest.js <questId>
```

## Scripts

| Script | Purpose |
|--------|---------|
| `create-quest.js` | Create a new quest (idea stage → auto-assigned to cat) |
| `advance-quest.js` | Run doNextAction in a loop for a specific quest |
| `get-quest.js` | Print current quest state (stage, plan, inventory keys) |

## How it works

Scripts register a Node.js module resolver for the `@/` path alias, then import GuildOS modules directly — the same way the cron does, bypassing HTTP auth and using the service role client.

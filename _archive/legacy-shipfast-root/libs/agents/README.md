# Agents SDK Integration (Hybrid Approach)

This directory contains the Agents SDK integration for gradual migration from the current custom pipeline to OpenAI's Agents SDK.

## Architecture

### Current State (Legacy)
- Custom pipeline with manual state management
- Step-by-step API routes (`/api/monkey/landing-page/step1`, `/step2`, etc.)
- React state management for UI
- Custom structured output validation (Ajv)

### New State (Agents SDK)
- Agent-based orchestration with built-in tools
- Session persistence for campaign context
- Streaming support for real-time UI updates
- Built-in tracing for debugging

### Hybrid Approach
- **Feature flags** control which steps use Agents SDK
- Legacy code continues to work alongside
- Gradual migration step-by-step
- Fallback to legacy if agent fails

## Structure

```
libs/agents/
├── agents/              # Agent definitions
│   └── clarificationQuestionsAgent.ts
├── session/            # Session adapters
│   ├── supabaseSession.ts  # Production (persists to DB)
│   └── memorySession.ts    # Development (in-memory)
├── config.ts          # Feature flags and settings
├── runner.ts          # Agent execution service
└── index.ts           # Public exports

app/api/agents/
└── run/route.ts       # API endpoint for agent execution
```

## Usage

### Running an Agent

```typescript
import { runAgent, createSessionId } from "@/libs/agents";
import { clarificationQuestionsAgent } from "@/libs/agents/agents/clarificationQuestionsAgent";

const result = await runAgent({
  agent: clarificationQuestionsAgent,
  input: "Generate questions for this landing page project...",
  sessionId: createSessionId(),
  userId: user.id,
  campaignId: campaign.id,
  stream: false,
});
```

### With Streaming

```typescript
const stream = await runAgent({
  agent: clarificationQuestionsAgent,
  input: "...",
  stream: true,
});

for await (const chunk of stream) {
  // Handle streaming events
}
```

## Feature Flags

Set environment variables to enable Agents SDK for specific steps:

```bash
# Enable Agents SDK for clarification questions
USE_AGENTS_SDK_CLARIFICATION=true

# Session storage type (memory | supabase)
AGENTS_SESSION_TYPE=supabase
```

## Migration Status

- ✅ **Infrastructure**: Agents SDK setup, session management, API routes
- ✅ **Clarification Questions**: Agent created, integrated with feature flag
- ⏳ **Step 2 (Competitor Research)**: Pending migration
- ⏳ **Step 3 (Write Sections)**: Pending migration
- ⏳ **Streaming UI**: Pending implementation

## Database

Run the migration to create the `agent_sessions` table:

```bash
# Apply migration
supabase migration up
```

The table stores:
- `session_id`: Unique session identifier
- `user_id`: Owner of the session
- `campaign_id`: Optional campaign association
- `messages`: Conversation history (JSONB)
- `metadata`: Additional session data (JSONB)

## Testing

### Development Mode
- Uses `MemorySession` (in-memory, no persistence)
- Fast iteration, no DB required

### Production Mode
- Uses `SupabaseSession` (persists to database)
- Campaign context persists across runs
- Supports resuming interrupted sessions

## Next Steps

1. **Enable feature flag** for clarification questions in production
2. **Monitor performance** and compare with legacy approach
3. **Migrate Step 2** (competitor research) to agent
4. **Add streaming UI** for real-time updates
5. **Migrate remaining steps** gradually

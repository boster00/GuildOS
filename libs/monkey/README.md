# Monkey AI Module

Centralized AI calling, response normalization, JSON validation, and agentic pipelines.

## Architecture

All AI-related code lives under `libs/monkey/` with the following structure:

- **pipelines/**: Multi-step orchestration (triagePipeline, writeArticleLandingPipeline)
- **actions/**: Reusable actions used by pipelines (triageTaskType, competitorValidate, competitorMapToSections)
- **tools/**: Pure utility functions and external integrations
  - **runtime/**: AI runtime calls (callStructured, callChat, callHtml, modelResolver, providers)
  - **renderers/**: HTML renderers for marketing page sections
  - Other tools: competitorFetch, competitorSegment, dataForSeo, htmlCheck, patch
- **references/**: Configuration, types, schemas, and page type registry
  - **pageTypes/**: Marketing page type registry and templates
- **prompts/**: Prompt templates (repair, triage)
- **ui/**: Logger and UI components (MonkeyResultsPanel, monkeyResultsController)

## Usage

```typescript
import { runTask } from "@/libs/monkey";

const result = await runTask({
  model: "agent",  // "agent" | "high" | "mid"
  taskType: "WRITE_ARTICLE",  // "SUGGEST_IDEAS" | "SUGGEST_TITLE" | "WRITE_ARTICLE"
  campaignContext: {
    icp: { name: "...", description: "..." },
    campaign: { name: "...", goal: "..." },
  },
  userInput: {
    query: "Write an article about...",
  },
  constraints: {
    tone: "Professional",
    audience: "Marketing professionals",
  },
  outputFormat: "html",  // "markdown" | "html" | "json"
});
```

## Model Configuration

Set via environment variables:
- `MONKEY_PROVIDER` (default: "openai")
- `MONKEY_MODEL_AGENT` (default: "gpt-4o")
- `MONKEY_MODEL_HIGH` (default: "gpt-4o")
- `MONKEY_MODEL_MID` (default: "gpt-4o")
- `MONKEY_LOG_FULL=1` (enable full logging in dev)
- `MONKEY_MAX_OUTPUT_CHARS_JSON` (default: 200000)
- `MONKEY_MAX_OUTPUT_CHARS_HTML` (default: 400000)

## Task Types

### SUGGEST_IDEAS
Generates content ideas based on intent and campaign context.

### SUGGEST_TITLE
Generates title options with rationale. Can return state patches for field updates.

### WRITE_ARTICLE
Full article generation pipeline:
- Interpret intent
- Plan article (agent mode only)
- Write draft
- Critique and repair (agent mode only, if score < 85)
- Convert to HTML

## Key Principles

1. **Pure functions**: Monkey never mutates React state
2. **JSON validation**: Ajv with schemas allowing additionalProperties
3. **Error handling**: Typed errors via MonkeyErrorCode enum
4. **Logging**: Console-only in dev, no logs in production
5. **No direct provider calls**: All AI calls go through monkey runtime

## Migration Status

The new monkey module is ready for use. Existing code using `monkey.AI()` should be gradually migrated to use `runTask()`.

Files still using old patterns (for reference):
- `libs/gpt.js` - Legacy GPT wrapper (deprecated)
- `libs/monkey.js` - Contains old `monkey.AI()` method (still in use, will be deprecated)
- `app/api/ai/route.js` - Generic AI endpoint (uses `monkey.AI()`)

## Testing

Test task types using the monkey API endpoints or integrate directly with the `runTask()` function.


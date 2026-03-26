---
name: ""
overview: ""
todos: []
isProject: false
---

# Plan: Revert Get Second Opinions to Eden-Only (No Individual API Keys)

## Summary

All models used by **Get Second Opinions** (Content Magic) should go through **Eden AI** only. The previous "Direct Provider Routing" implementation added per-provider API keys (OPENAI, ANTHROPIC, PERPLEXITY) and direct API calls. This plan reverts that so only **EDEN_AI_API_KEY** is required for the chat gateway.

---

## 1. Where individual API keys are used


| Location                                                                                               | Keys / behavior                                                                                                              | Scope                                                                        |
| ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| **[libs/ai/eden/chatGateway.js](libs/ai/eden/chatGateway.js)**                                         | `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `PERPLEXITY_API_KEY`; throws "is not set" / `MISSING_API_KEY` for Get Second Opinions | **Revert** – route all models through Eden                                   |
| **[libs/ai/eden/modelRegistry.js](libs/ai/eden/modelRegistry.js)**                                     | `provider`, `directModel` added for routing to direct APIs                                                                   | **Revert** – remove provider/directModel (or stop using them in chatGateway) |
| **[libs/ai/direct/anthropicGateway.js](libs/ai/direct/anthropicGateway.js)**                           | N/A (no env read here; key passed in by chatGateway)                                                                         | **Remove** – only consumer is chatGateway                                    |
| **[.env.local](.env.local)**                                                                           | `ANTHROPIC_API_KEY=<your-key>`, `PERPLEXITY_API_KEY=<your-key>` and comment "Direct providers for Get Second Opinions"       | **Remove** – not needed for Eden-only                                        |
| [libs/monkey.js](libs/monkey.js)                                                                       | Injects `PERPLEXITY_API_KEY`, `ANTHROPIC_API_KEY` into env keys for Monkey/agent runtime                                     | **Leave as-is** – used by run-task/agents, not Get Second Opinions           |
| [app/api/monkey/run-task/route.ts](app/api/monkey/run-task/route.ts)                                   | Pushes `PERPLEXITY_API_KEY`, `ANTHROPIC_API_KEY` into `envKeys` for task runner                                              | **Leave as-is** – agent runtime only                                         |
| [libs/monkey/tools/runtime/providers/perplexity.ts](libs/monkey/tools/runtime/providers/perplexity.ts) | Fallback to `PERPLEXITY_API_KEY` when no user key                                                                            | **Leave as-is** – Monkey provider, not chatGateway                           |


---

## 2. Changes to make (revert runaway implementation)

### 2.1 Revert [libs/ai/eden/chatGateway.js](libs/ai/eden/chatGateway.js)

- Remove the `switch (modelDef.provider)` and all branches that use `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, or `PERPLEXITY_API_KEY`.
- Remove `require("../direct/anthropicGateway")` and the helper `openaiCompatibleChat`.
- Remove `truncateRawFallback` (only used by those branches).
- Restore a single path: resolve model via `getModel(modelId)`, then call `edenPost("/v3/llm/chat/completions", { model: modelDef.eden.model, messages, temperature, max_tokens, stream })` and return the same normalized shape `{ ok, requestId, latencyMs, data: { text, usage }, rawPreview, raw }`.
- Keep using `generateRequestId` from edenClient for the Eden path; for the single-path version you can use the requestId returned by edenPost.

### 2.2 Revert [libs/ai/eden/modelRegistry.js](libs/ai/eden/modelRegistry.js)

- Remove `provider` and `directModel` from every entry in the `MODELS` array.
- In `getModel(id)`, remove the assignment and return of `provider` and `directModel`; remove the line that sets `directModel` from `resolveEdenModel` for non-eden. Keep `eden: { model }` (from `resolveEdenModel(m.id, m.edenDefault)`) as the only model identifier used by the gateway.

### 2.3 Remove [libs/ai/direct/anthropicGateway.js](libs/ai/direct/anthropicGateway.js)

- Delete the file. It is only required by the reverted chatGateway; no other source imports it.

### 2.4 Clean up [.env.local](.env.local)

- Remove the block:
  - `# Direct providers for Get Second Opinions (Content Magic)`
  - `ANTHROPIC_API_KEY=<your-key>`
  - `PERPLEXITY_API_KEY=<your-key>`

---

## 3. Outcome

- Get Second Opinions (and any other caller of `sendChatPrompt`) will use **only Eden AI** and **EDEN_AI_API_KEY**.
- No references to `ANTHROPIC_API_KEY` or `PERPLEXITY_API_KEY` in the Eden chat gateway or model registry.
- Monkey/run-task and Perplexity provider can continue to use `ANTHROPIC_API_KEY` / `PERPLEXITY_API_KEY` for their own flows if you keep those env vars set.

---

## 4. Optional: Eden model IDs

If Eden v3 still rejects `anthropic/claude-3-5-sonnet-20241022` or the perplexity provider, the fix is to **update the `edenDefault` values** in [libs/ai/eden/modelRegistry.js](libs/ai/eden/modelRegistry.js) to the model IDs Eden currently supports (or remove unsupported models from the registry), rather than adding direct provider calls. Checking [Eden AI’s current LLM docs](https://docs.edenai.co) for the correct model strings is recommended.
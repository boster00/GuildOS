/**
 * Codex skill book — the fundamentals every adventurer carries on day one.
 *
 * Class hierarchy (locked 2026-04-27):
 *   - Every adventurer carries: codex + housekeeping + dailies (+ project books)
 *   - Workers add:               worker class book
 *   - Questmasters add:          questmaster class book
 *   - Guildmaster (Pig) adds:    guildmaster class book
 *
 * The codex covers contracts + fundamentals — the things that don't fit
 * inside a single tier weapon or quest workflow but still bind every
 * agent: how to read instructions, how to invoke named protocols
 * (BCS / WWCD), how to write items.expectation in the locked style,
 * the no-bypass guarantees, and what to do when contracts disagree.
 */

export const skillBook = {
  id: "codex",
  title: "Codex of the Guild",
  description: "Fundamentals every adventurer carries: contracts, named protocols, language style, the rules that bind all classes.",
  steps: [],
  toc: {
    readContractsFromMain: {
      description: "Always read CLAUDE.md from the main branch on session start (worktree drift is the documented cause of past contract failures).",
      howTo: `On every session start: run \`git -C /workspace show main:CLAUDE.md\` (or \`git show main:CLAUDE.md\` if /workspace is GuildOS) and treat THAT as authoritative — not the auto-loaded file. If the auto-loaded copy differs from main, main wins without exception.

Why: a session can be rooted in a stale worktree. Auto-loaded CLAUDE.md is a courtesy, not source of truth. Worktree drift caused the 2026-04-26 BCS / WWCD failures and the description-as-status incident. Don't repeat them.

Refresh ritual: also re-run this on long sessions if contracts get fuzzy. Cheap to repeat.`,
    },

    invokeNamedProtocol: {
      description: "When the user says BCS / CBS / CSB (any 3-letter B/C/S permutation) or WWCD, look up the spec verbatim before responding.",
      howTo: `Named interaction protocols are domain terms with defined contracts. They don't follow training-data shapes. Look them up in CLAUDE.md every single time:

- **BCS / CBS / CSB / BSC / SBC / SCB** → CJ Briefing Style. Table format with required columns: \`# | Item | Status | Δ | Note\`. Required \`100%\` substring somewhere in the response.
- **WWCD** → "What Would CJ Do." Two output modes (A or B), banned shortcuts (no HEAD-checking ≠ verification, no calibration laundering, no mini-only judging), required \`100%\` substring. Mandatory direct multimodal Read for any "verified / done / ready" claim on quests with image deliverables.

If you find yourself producing a sit-rep style response from training data, stop and re-read the spec. Do not free-style.`,
    },

    writeExpectationInLockedStyle: {
      description: "items.expectation must be written in the reviewer-facing 'we should see X showing Y with these details: Z' style.",
      howTo: `Required shape:
- Screenshots: \`"In the screenshot, we should see <subject/UI element> showing <state or content> with these details: <specific, numbered facts>."\`
- Docs (.md, .json, .txt): \`"In the document, we should see <subject> covering <scope> with these details: <facts>."\`
- Other: \`"In the artifact, we should see <subject> demonstrating <property> with these details: <facts>."\`

The expectation is the literal claim handed to the gpt-4o judge AND read by the user in the GM-desk side panel. Be specific and anchored. Bad: "image shows HTTP 200." Good: "In the screenshot, we should see the /api/track fire-response panel showing HTTP 200 with these details: response body is {inserted:8, rejected:[], errors:[]}."

Full guidance: \`housekeeping.presentPlan\`.`,
    },

    respectTierColumnOwnership: {
      description: "Each of the 5 review-tier columns on items is owned by exactly one tier; never write to a column you don't own.",
      howTo: `5 review-tier columns on \`items\`:
- \`self_check\`     — T0, owned by the worker at submit time (worker self-claim).
- \`openai_check\`   — T1, owned by the OpenAI judge (\`openai_images.judge\` weapon).
- \`purrview_check\` — T2, owned by Cat (questPurrview.approve / .bounce).
- \`claude_check\`   — T3.5, owned by the Guildmaster's local Claude direct multimodal review (questReview.pass / .bounce).
- \`user_feedback\`  — T4, owned by the user via the GM-desk Feedback button.

A tier may overwrite its OWN column (e.g. T1 re-judging is fine). It must NEVER overwrite another tier's column. The 2026-04-26 calibration laundering happened because a downstream layer rewrote upstream verdicts; that's structurally banned.`,
    },

    noBypassSpawnContract: {
      description: "Spawning a cursor agent is only valid via cursor.writeAgent — direct POSTs to the Cursor API skip the GuildOS credentials block.",
      howTo: `Every cursor agent spawn must go through \`cursor.writeAgent\`. The weapon prepends a setup block to the spawn prompt that provisions GUILDOS_NEXT_PUBLIC_SUPABASE_URL + GUILDOS_SUPABASE_SECRETE_KEY into the agent's ~/.guildos.env.

Without that block, agents end up with their project's Supabase but not GuildOS — the documented 2026-04-26 ptglab failure mode. The agent does the work, can't post items rows, can't call submitForPurrview, and either escalates honestly or fakes artifacts.

If you're tempted to do a direct POST to https://api.cursor.com/v0/agents — stop, use cursor.writeAgent. The credentials block is the whole point.`,
    },

    escalateHonestly: {
      description: "When genuinely blocked, escalate via housekeeping.escalate with detail.reason + detail.unblock_path. Do NOT fake artifacts to bypass blockers.",
      howTo: `An escalation is more useful than fake progress. The pattern:

\`\`\`javascript
import { escalate } from "@/libs/skill_book/housekeeping";  // or default — both expose escalate
await escalate(userId, {
  questId,
  comment: "Concrete description of what's blocking",
  detail: {
    reason: "What specifically is blocking you (single sentence).",
    unblock_path: "Concrete steps the user / Guildmaster needs to take to unblock — be specific. e.g., 'provision SUPABASE_SECRETE_KEY for GuildOS on adventurer env_vars', NOT 'fix env'.",
  },
});
\`\`\`

The Guildmaster's GM desk surfaces escalations with detail.reason + detail.unblock_path. Vague reasons leave the user without a handoff. Specific reasons unblock fast.

NEVER paper over a blocker by faking screenshots, uploading to the wrong bucket, calibrating expectations to whatever the artifact happens to show, or any other workaround that lets the gate "pass" without the deliverable being real. Honest escalation is the right answer.`,
    },
  },
};

export const definition = skillBook;

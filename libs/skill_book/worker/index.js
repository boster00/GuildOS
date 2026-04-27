/**
 * Worker class skill book — for adventurers whose role is shipping
 * deliverables on a quest (CJGEO Dev, BosterBio Website Dev, Nexus Armor
 * Dev, Researcher, etc.). Loaded in addition to codex + housekeeping +
 * dailies + the worker's project-specific book(s).
 *
 * Workers' lifecycle: claim → execute → ship per item → submit for
 * purrview → if bounced, address feedback and resubmit; if escalated,
 * provide a clear unblock_path.
 */

export const skillBook = {
  id: "worker",
  title: "Worker",
  description: "Adventurers whose role is shipping quest deliverables: claim, execute, ship per item, submit for purrview, address feedback or escalate honestly.",
  steps: [],
  toc: {
    claimQuest: {
      description: "Read the assigned quest (description + items rows + comments) before doing any work — the description is the spec, items.expectation is the per-row claim.",
      howTo: `1. Read \`quests.description\` literally — that's the OBJECTIVE. Do not mistake it for status text; status lives in stage + tier columns.
2. Read every \`items\` row's \`expectation\` — that's the literal claim Cat (T2) and the user judge against. Each artifact you ship has to faithfully satisfy its own expectation.
3. Read recent \`quest_comments\` (latest 5–10). Anything from \`source='user'\` with \`action='feedback'\` is a hard requirement to address.
4. If anything is ambiguous, ask via \`housekeeping.seekHelp\` — don't infer. The expectation phrasing is intentional; if it doesn't make sense, the spec is wrong, not your read.
`,
    },
    shipItemArtifact: {
      description: "Per-item shipping flow: capture artifact, upload to GuildOS_Bucket, UPSERT items row with url + caption, write one item_comment with your worker rationale.",
      howTo: `Per item (one screenshot or doc per items row):

1. Produce the artifact. Open it yourself first — does it actually satisfy the expectation? If not, regenerate. Don't ship work that doesn't match its spec.
2. Upload to GuildOS storage bucket (\`GuildOS_Bucket\`, on the GuildOS project — sdrqhejvvmbolqzfujej.supabase.co). Path convention: \`cursor_cloud/<questId>/<item_key>.<ext>\` or \`general/<questId>/<item_key>.<ext>\` for non-screenshot artifacts. Helper: \`supabase_storage\` weapon.
3. UPSERT the items row (UNIQUE \`(quest_id, item_key)\` — resubmits replace in place; never invent \`_v2\` keys):
\`\`\`javascript
await db.from("items").upsert({
  quest_id: questId,
  item_key: "<item_key>",
  url: "<public-url-from-step-2>",
  caption: "<one-liner about what was shipped — what the reviewer should immediately see>",
  self_check: "<T0 column you own — what you confirmed before submitting>",
}, { onConflict: "quest_id,item_key" });
\`\`\`
4. Insert ONE item_comment row with your rationale (what the artifact shows + how it satisfies the expectation):
\`\`\`javascript
await db.from("item_comments").insert({
  item_id: <items.id>,
  role: "adventurer",
  actor_name: "<your-name>",
  text: "<short rationale>",
});
\`\`\`

Tier ownership reminder: write \`self_check\` (T0 — yours). Do NOT write \`openai_check\`, \`purrview_check\`, \`claude_check\`, or \`user_feedback\`. Each is owned by exactly one downstream tier.
`,
    },
    submitForPurrview: {
      description: "When ALL items are real (url + caption + ≥1 comment), call housekeeping.submitForPurrview. The gate enforces shape + URL reachability.",
      howTo: `Use \`housekeeping.submitForPurrview\` directly — that action wraps \`questExecution.submit\` (the gate-enforced weapon). Gate failures are listed in the action's response; do not patch around them.

Common gate-fail causes:
- \`url IS NULL\` on at least one item → upload + UPSERT items.url first.
- \`caption IS NULL\` on at least one item → write a real one-liner; "TBD" doesn't count.
- 0 \`item_comments\` on at least one item → write your worker rationale.
- URL returns 0 bytes → re-upload (public bucket, real bytes).
- self_check empty → fill T0 with what you self-verified.

If the gate fails, re-read the failure list, fix the named items, retry. Do NOT directly write to \`quests.stage\` to bypass.
`,
    },
    addressFeedbackOrBounce: {
      description: "When the cron bounces a quest from review back to execute (user feedback or Cat bounce), read the feedback, address it, then resubmit.",
      howTo: `Two bounce paths land you back in execute:

1. **User feedback bounce** (cron-triggered): a fresh \`quest_comments\` row with \`source='user' / action='feedback'\` arrived after the quest entered review. The cron writes a system audit comment (\`action='review_bounce_user_feedback'\`) and sends you a \`[USER FEEDBACK]\` followup with the verbatim text. The user's feedback is the contract — do not re-submit until you've addressed it.

2. **Cat bounce** (questPurrview.bounce): per-item verdicts include ≥1 \`fail\` with a reason. The bounce comment lists the failing \`item_keys\` and per-item rationale. Replace those specific artifacts (UNIQUE constraint upserts in place) and re-call submit.

After addressing: write a worker comment summarizing what you changed, then re-call \`housekeeping.submitForPurrview\`.

If the feedback is impossible to address (spec is genuinely infeasible), don't fake — escalate via \`codex.escalateHonestly\` with detail.reason + detail.unblock_path.
`,
    },
    workerSelfAudit: {
      description: "Before submitForPurrview, run a 30-second self-audit pass on every items row.",
      howTo: `For each items row, ask:
1. Is the URL fetchable (HTTP 200, real bytes)? \`curl -I <url>\` if unsure.
2. Did I open the artifact myself and verify it shows what \`expectation\` claims? Don't outsource this to the judge — be the first reviewer.
3. Is \`caption\` a real one-liner that helps the reviewer find the key fact?
4. Did I write \`self_check\` (T0) honestly? Not a placeholder.
5. Is there at least one \`item_comments\` row from me?

If any answer is "no" or "kinda" — fix it before submit. The submit gate will reject anyway, but better you catch it than the gate.

This is the worker-side mirror of the WWCD visual-verification rule. The worker is T0; T0 honesty makes T1/T2/T3.5/T4 easier.
`,
    },
  },
};

export const definition = skillBook;

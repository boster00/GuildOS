/**
 * Guildmaster skill book — Pig uses these for recruitment / roster orchestration.
 */
export const skillBook = {
  id: "guildmaster",
  title: "Guildmaster",
  description: "Recruit adventurers, dispatch new quests, handle escalations.",
  steps: [],
  toc: {
    callToArms: {
      description: "Trigger recruitment when a quest is handed off (idea-stage reroute).",
      input: {
        quest: "object with id, title",
      },
      output: {
        ok: "boolean",
      },
    },
    dispatchWork: {
      description: "Hand a new quest to an adventurer.",
      howTo: `
1. Create the quest in DB with full WBS description, deliverables, and priority.
2. Set \`assignee_id\` and \`assigned_to\` to the chosen adventurer.
3. Send the adventurer a short message: "You have a new quest assigned. Use searchQuests to check."
4. NEVER send raw task instructions in chat — the quest description IS the task spec.

Do NOT:
- Send full task descriptions in chat messages (use quests).
- Ask the user to do things you can do yourself.
- Skip quest creation and go straight to agent chat.
- Auto-provision credentials without user awareness. If an agent is missing env vars, it should escalate. The user decides what to share.
`,
    },
    handleEscalation: {
      description: "Process an escalated quest.",
      howTo: `
1. Check GM desk for escalated quests.
2. Evaluate if you can resolve (credentials, local commands, config).
3. If yes: resolve, post a comment explaining the fix, move the quest back to \`execute\`.
4. If no: flag for user attention.
`,
    },
    runFinalGate: {
      description: "Run the local final-gate verification on a quest in review stage. Cat already approved; this is the last check before the user sees it on the GM desk. Pass → quest stays in review with FINAL_GATE_PASS lockphrase. Fail → bounce to execute, user never sees it.",
      howTo: `
This is the canonical local-only review pass. Use it for any quest in \`review\` stage that has Cat's approve lockphrase but no FINAL_GATE_PASS lockphrase yet (the GM desk filters quests to those with the pass lockphrase, so unverified ones are invisible until you process them).

### Step 1 — Verify Cat's approval lockphrase

\`\`\`javascript
import { confirmApproval } from "@/libs/weapon/questReview";
const confirm = await confirmApproval({ questId });
if (!confirm.ok) {
  // confirm.reason: 'no_gate_comment' | 'lockphrase_missing' | 'wrong_stage' | ...
  // The quest reached review without passing through Cat. Don't run the final gate;
  // either escalate or bounce manually.
  return;
}
// confirm.items = the per-row spec; each carries { item_key, expectation, url, caption }
// confirm.cat_perItemVerdicts = Cat's verdicts (useful as a baseline / sanity check)
\`\`\`

### Step 2 — Local verification per item

**MANDATORY: open every artifact yourself before forming a verdict.** This rule was hardened on 2026-04-26 after the Guildmaster claimed "verified" repeatedly without ever opening a single file. No exceptions:

- For images: download to disk, then \`Read\` with the multimodal vision tool. Look at the actual pixels. Compare against the item's \`expectation\` text.
- For docs (.md, .json, .txt): \`fetch()\` the URL, read the body, compare against \`expectation\`.
- For non-fetchable / auth-walled URLs (Zoho live invoice URLs, Asana attachments, etc.): note the gap explicitly. **Do not pass an item that cannot be inspected from your perspective** — flag it as needing user-side verification or replacement.

The judge weapons (Path A below) and Cat's prior verdicts are inputs to your decision, not substitutes for direct inspection. A quest with an image deliverable cannot be passed if you have not personally seen the image.

**Banned shortcuts** (each has produced false positives in past sessions):
- HEAD-checking URLs and calling that "verification"
- Trusting the gpt-4o-mini judge alone (too many inconclusive verdicts → false-easy passes when softened)
- Trusting Cat's purrview verdicts as ground truth (Cat runs Composer 2.0 with weaker vision)
- Calibrating an item's \`expectation\` to whatever the artifact happens to show *just to make the judge match* — that launders bad artifacts through the gate. Calibration is OK only when the artifact genuinely satisfies the original quest objective and the synthesized expectation had drifted; never to mask a bad artifact.

**After your direct inspection**, optionally augment with the contextless judge for a second opinion:

**Path A — contextless second pair of eyes (cheap, fast, catches things you might have missed on a tired pass):**

\`\`\`javascript
import { judge } from "@/libs/weapon/openai_images";
for (const item of confirm.items) {
  const isImage = /\\.(png|jpg|jpeg|gif|webp)/i.test(item.url);
  if (!isImage) continue; // text artifacts: read directly via fetch
  const v = await judge({ imageUrl: item.url, claim: item.expectation, model: "gpt-4o" });
  // gpt-4o, NOT gpt-4o-mini — cost difference is rounding error per 50 calls,
  // and mini misses fine text in screenshots so often it's net-negative.
  // v: { verdict: 'match'|'mismatch'|'inconclusive', confidence, reasoning }
}
\`\`\`

**Path B — local CIC visual check (slower, catches subtler issues; uses your logged-in browser so authenticated dashboards work):**

For each item URL, open in CIC, screenshot the rendered page, Read the image yourself with multimodal vision, decide pass/fail. This is the path Cat-cloud can't take because it doesn't have your auth state. **For any artifact that's an auth-walled live URL (Zoho, Asana attachments, etc.), Path B is mandatory** — the contextless judge can only see the unauthenticated response (often a login redirect), not the real content.

### Step 3 — Build per-item verdicts

For every item in \`confirm.items\`, decide \`{item_key, verdict, text}\`:
- \`verdict: 'pass'\` when both your check (Path A or B) says match AND Cat's prior verdict was pass. Disagreement → 'fail'.
- \`verdict: 'fail'\` when your check disagrees with the expectation, even if Cat passed it. Cat-cloud uses Composer 2.0 which has weaker vision than the contextless gpt-4o-mini judge or your own multimodal Read.
- \`text\`: one-sentence note. On pass, what you verified. On fail, what's wrong + what worker should fix.

### Step 4a — All pass

\`\`\`javascript
import { pass } from "@/libs/weapon/questReview";
const result = await pass({ questId, perItemVerdicts, summary: "Optional Guildmaster note" });
\`\`\`

Result: stage stays at \`review\`, FINAL_GATE_PASS lockphrase comment lands on the quest, GM desk now surfaces the quest to the user.

### Step 4b — Any fail

\`\`\`javascript
import { bounce } from "@/libs/weapon/questReview";
const result = await bounce({
  questId,
  perItemVerdicts,
  reason: "<one paragraph: what failed across the quest, what the worker should fix>",
});
\`\`\`

Result: stage moves to \`execute\`, FINAL_GATE_BOUNCE lockphrase lands, user never sees the quest. Worker resubmits using the same item_keys (UPSERT replaces in place).

### What NOT to do

- Do NOT call \`pass\` with any 'fail' verdicts to "let it through with notes." The gate refuses; bounce is the only valid path for any failure.
- Do NOT skip \`confirmApproval\`. If a quest reached review without passing through Cat, it's untrusted — escalate.
- Do NOT auto-pass quests just because Cat approved. The whole point of this gate is to catch what Cat missed (Composer 2.0 vision weaknesses, edge cases). Form your own verdict.
`,
    },
  },
};

/**
 * @param {string} userId
 * @param {Record<string, unknown>} [input]
 */
export async function callToArms(userId, input) {
  const quest =
    input && typeof input === "object" && input !== null && "quest" in input
      ? /** @type {Record<string, unknown>} */ (input).quest
      : null;
  console.log("[GuildOS:guildmaster:callToArms]", "call to arms is activated", {
    userId: typeof userId === "string" ? `${userId.slice(0, 8)}…` : userId,
    questId: quest && typeof quest === "object" && quest !== null && "id" in quest ? quest.id : undefined,
  });
  return { ok: true };
}

export default { skillBook, callToArms };

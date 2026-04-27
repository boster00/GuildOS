/**
 * Dailies skill book — recurring curation / upkeep routines the Pig (local Claude)
 * runs between quests. Pure text-prompt registry; no JS logic here.
 */

export const skillBook = {
  id: "dailies",
  title: "Dailies",
  description: "Curation and upkeep routines: merge new insights into the right home, prune stale buffer entries.",

  toc: {
    mergeInsight: "Place a new user-correction insight into the right home using the ownership protocol (weapon / skill book / adventurer system_prompt / global).",
    curateInsightsBuffer: "Periodic pass over the CLAUDE.md Insights buffer: promote timestamped entries to their proper home, or drop them if situational.",
    triageEmailStep1: "Pass 1 of email triage — from the filtered inbox view, flag emails the user SHOULD look at (star them).",
    triageEmailStep2: "Pass 2 of email triage — from the remaining unread inbox, flag emails the user could SKIP (label or archive).",
  },

  mergeInsight: `
When the user provides a correction, a new rule, or a non-obvious nuance, decide where it belongs. Use this decision tree — first match wins:

1. **Deterministic data-layer behavior** (auth refresh, retries, I/O format enforcement, error translation — anything that runs the same way every time with no judgment)
   → **weapon** (specifically the weapon's function code or the weapon's module-level comment)

2. **A process or tactic that anyone playing a given role should follow** (e.g. "every questmaster should check screenshot count matches WBS bullets"; "before every forge, scan existing weapons for overlap")
   → **skill book** — inside the relevant action's \`howTo\`, or at the skill-book top-level description if it spans multiple actions

3. **Specific to one adventurer's judgment, personality, or private constraints** (e.g. Cat's exact threshold for calling an adventurer unresponsive; a particular agent's tone rules)
   → **adventurer.system_prompt** (update the DB row directly; then trigger re-initAgent so the agent reloads)

4. **Cross-cutting rules or context that applies across roles / situations** OR **ambiguous — doesn't clearly belong to 1–3**
   → **global** — append a timestamped entry to the CLAUDE.md "Insights buffer" at the bottom. Format: \`- [YYYY-MM-DD] <insight>\`. Do not try to place it perfectly now; the next \`curateInsightsBuffer\` pass handles promotion.

**Tie-breakers and grey zones:**
- Insight spans multiple actions in one skill book → skill book description (top-level) or a new cross-cutting action in that book.
- Insight applies to multiple skill books → global.
- OAuth / auth flows that touch both layers → split: weapon owns token lifecycle; skill book owns the human-in-the-loop handling ("if 401, tell the user to re-authorize").
- Insight that clarifies the ownership protocol itself → update this skill book's howTo (meta, rare).
- Time-sensitive / situational insights (e.g. "Zoho CRM is flaky this week") → always go to the Insights buffer; they get dropped on the next curation pass.

**After placing the insight:**
- If it changed a skill book or adventurer system_prompt, note whether any running adventurer needs a re-init. Dispatch an initAgent followup if so.
- Do NOT duplicate the insight in multiple places. If you find it already lives somewhere, edit in place — do not re-append.
`.trim(),

  curateInsightsBuffer: `
Periodically scan the "Insights buffer" section at the bottom of CLAUDE.md. For each timestamped entry:

1. Apply the \`mergeInsight\` decision tree to decide its permanent home.
2. Move the entry to that home (edit the target file/prompt in place). Preserve the date only if it carries useful historical context — usually drop.
3. If the entry turned out to be situational (no longer relevant), delete it.
4. Remove the entry from the Insights buffer once relocated.

**Rules:**
- Do NOT leave entries in the buffer indefinitely — every cleanup pass should reduce the buffer toward zero.
- An entry that has been in the buffer for 14+ days and still doesn't have an obvious home is probably situational; lean toward deleting.
- If the buffer is empty after the pass, that's the success state.

**When to run:** when the buffer has 3+ entries, or weekly, whichever comes first.
`.trim(),

  triageEmailStep1: `
**Goal:** from the filtered inbox view (unread, not already marked important, no Asana notifications), identify the highest-signal emails and STAR them.

All Gmail access is via the \`gmail\` MCP server. Do NOT import from \`@/libs/weapon/gmail\` — that weapon is an MCP pointer with no runtime exports.

**⛔ Do NOT chain into step 2.** Stop after this step and wait for the user to review the starred results before proceeding. The user must review between steps — never volunteer to run step 2 next.

**Filter query:** \`-label:important in:unread in:inbox -asana\`
**Browser reference (for manual review):** https://mail.google.com/mail/u/0/#search/-label%3Aimportant+in%3Aunread+in%3Ainbox+-asana

**Steps:**
1. Search the inbox via MCP:
   \`mcp__gmail__search_emails { query: "-label:important in:unread in:inbox -asana", maxResults: 100 }\`

2. For each message, apply scoring rules:
   - **Hard skip rules** (do not star, regardless of any positive score signals):
     - Shared mailboxes, automated reports, marketing, utility notices.
     - TO/CC includes a \`*@bosterbio.com\` address OTHER than \`boster@bosterbio.com\`, AND CJ / Sijie are not in the direct TO line. Reasoning: another bosterbio employee is the named owner; the email reached this inbox because of forwarding/cc, not because action is needed from CJ. (\`boster@bosterbio.com\` is the shared mailbox and does NOT count as another employee owning it — keep scoring as normal when only \`boster@\` is the bosterbio address.)
     - **Banned sales-pitch topics** — judge by what the email is *trying to sell*, not by keyword string match. Senders dress these up as opportunities, intros, or "exclusive" pitches; the ban applies regardless of framing. Current list (the user extends this iteratively — treat it as a living block list):
       1. Capital raises (anyone offering to help raise capital, broker investors, or pitch a capital service)
       2. Funding offers (loans, lines of credit, grant facilitation, "we fund companies like yours")
       3. Contact list / lead list sales (selling B2B contact data, prospect lists, ICP databases, "verified emails")
   - **Score signals (apply only after hard-skip rules pass):** wire transfers / invoices / POs (+10), Calendly events (+9), customer replies to quotes (+9), SalesIQ / live chat (+8), etc.

3. **Before starring, verify each top candidate.** \`search_emails\` returns Subject/From only — TO/CC headers and body content require \`mcp__gmail__read_email\`. For every candidate that survived scoring, read it to confirm:
   - It does NOT trip the bosterbio recipient rule (TO/CC includes another \`*@bosterbio.com\` while CJ/Sijie are not direct recipients).
   - The body is not actually one of the banned sales-pitch topics dressed in friendly subject lines (e.g. "quick intro" that's really a capital-raise pitch).
   Drop any that fail. This verification is cheap when only ~5 candidates remain.

4. Star the survivors (top ~2% by score, be selective — only "definitely worth a look"):
   \`mcp__gmail__batch_modify_emails { messageIds: [...verifiedIds], addLabelIds: ["STARRED"] }\`

5. Report: how many scanned, how many starred, 1-line reason per star. Then stop.

**Success criterion:** user's starred view shows a short, high-signal must-read list.
`.trim(),

  triageEmailStep2: `
**Goal:** from the REMAINING unread emails (everything pass 1 didn't star), identify emails the user can skip and STAR them — so the user's starred view contains both must-reads and skippable emails for a single review pass.

All Gmail access is via the \`gmail\` MCP server. Do NOT import from \`@/libs/weapon/gmail\`.

**⛔ Do NOT chain into step 1.** This step must only be run after the user has reviewed step 1's output. Never volunteer to run step 1 before this step, and never volunteer to run this step immediately after step 1 — the user decides when to proceed.

**Filter query:** \`in:unread in:inbox -label:starred\` (excludes what pass 1 already starred)

**Steps:**
1. Search via MCP:
   \`mcp__gmail__search_emails { query: "in:unread in:inbox -label:starred", maxResults: 200 }\`

2. For each message, decide SKIP / KEEP using skip-signal rules:
   - SKIP signals: shared mailbox sender (orders@/account@/support@/etc.), automated report (DMARC, Search Console, Bing Webmaster), utility (PG&E, energy), marketing / newsletter / webinar / conference, "New Order #" notifications, no-reply@asana.com, kybc@kyinno.com.
   - KEEP = default (don't touch). Only explicitly flag SKIP.

3. Star the SKIP emails in one batch:
   \`mcp__gmail__batch_modify_emails { messageIds: [...skipIds], addLabelIds: ["STARRED"] }\`

4. Report: how many scanned, how many starred as skippable, rough category breakdown. Then stop.

**Success criterion:** starred view now contains both high-priority emails (from step 1) and low-priority/skippable ones (from this step) — user reviews the full starred list and acts on each.

**Do NOT delete or archive permanently in this pass.**
`.trim(),
};

export default skillBook;

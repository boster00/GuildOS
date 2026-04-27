/**
 * Questmaster skill book — Cat uses these actions for planning and assignee matching.
 * Includes JSON extraction helpers shared with plan/find flows.
 */
import { runDungeonMasterChat } from "@/libs/council/ai/chatCompletion.js";

/** Server logs for tracing planRequestToQuest (grep: GuildOS:planRequestToQuest). */
const LOG = "[GuildOS:planRequestToQuest]";

/** @param {unknown} s @param {number} [max] */
function previewText(s, max = 280) {
  const t = s == null ? "" : String(s);
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}

/**
 * Pull a JSON object from model text: tries ```json fences, then scans for balanced `{...}` and parses.
 * Expects objects with at least `title` and `deliverable` (quest-plan shape).
 * @param {string} text
 * @returns {Record<string, unknown>|null}
 */
function extractQuestPlanJson(text) {
  if (text == null || typeof text !== "string") return null;
  let s = text.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```/im.exec(s);
  if (fence) s = fence[1].trim();

  const start = s.indexOf("{");
  if (start === -1) return null;

  for (let i = start; i < s.length; i++) {
    if (s[i] !== "{") continue;
    let depth = 0;
    for (let j = i; j < s.length; j++) {
      const ch = s[j];
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          const slice = s.slice(i, j + 1);
          try {
            const obj = JSON.parse(slice);
            if (
              obj &&
              typeof obj === "object" &&
              !Array.isArray(obj) &&
              "title" in obj &&
              "deliverable" in obj
            ) {
              return obj;
            }
          } catch {
            /* try next opening brace */
          }
          break;
        }
      }
    }
  }
  return null;
}

export const definition = {
  id: "questmaster",
  title: "Questmaster",
  description:
    "Plan user requests into quest-shaped JSON and pick roster adventurers by capability.",
  toc: {
    planRequestToQuest: {
      description: "Translate a raw user request into a structured quest (title, description, deliverables, due date, stage).",
      input: {
        initialRequest: "string, the user's raw request text",
      },
      output: {
        title: "string",
        description: "string",
        deliverables: "string",
        due_date: "string, ISO 8601",
        stage: "string, one of: idea, plan",
      },
    },
    searchAdventurerForQuest: {
      description: "Pick the best-fit adventurer for a quest by capability match.",
      input: {
        quest: "object with title, description, deliverables",
        adventurers: "array of { id, name, capabilities }",
      },
      output: {
        adventurer_id: "string, UUID",
        name: "string",
      },
    },
    selectAdventurer: {
      description: "Match a new request to a roster adventurer (returns the id or no-match).",
      input: {
        quest: "object with id, title, description",
      },
      output: {
        result: "object { id, name } or false",
        msg: "string, rationale",
      },
    },
    assign: {
      description: "Assign stage: load quest, scan adventurer roster, pick best-fit or return no-match.",
      input: {
        questId: "string, quest UUID",
      },
      output: {
        result: "object { id, name } or false",
        msg: "string, rationale",
        meta: "object, debug trace",
      },
    },
    interpretIdea: {
      description: "Turn a raw user request into a structured quest for a chosen adventurer.",
      input: {
        initialRequest: "string, the user's raw request text",
        adventurerName: "string, name of the chosen adventurer",
      },
      output: {
        title: "string",
        description: "string",
        deliverables: "string",
        due_date: "string, ISO 8601 or null",
      },
    },
    reviewSubmission: {
      description: "Review a quest in purrview. Script-locked end-to-end via questPurrview weapon: confirmSubmission → per-item vision evaluation → approve OR bounce.",
      howTo: `
This is the canonical purrview review flow. Both ends of every handoff are script-locked — never write \`stage\` directly, never open a screenshot before \`confirmSubmission\` passes.

### Step 1 — Verify the worker handoff (no shortcuts)

\`\`\`javascript
import { confirmSubmission } from "@/libs/weapon/questPurrview";
const confirm = await confirmSubmission({ questId });
if (!confirm.ok) {
  // confirm.reason: 'no_gate_comment' | 'lockphrase_missing' | 'wrong_stage' | ...
  // The quest didn't pass through questExecution.submit. Do NOT review it.
  // Either bounce it back (if a worker is owning it) or escalate to Guildmaster.
  return;
}
// confirm.items = the per-row spec (id, item_key, expectation, url, caption); judge each one against its expectation.
\`\`\`

### Step 2 — Invoke the vision judge per item (mandatory)

**The judge is mandatory, not optional.** Layer-attribution finding (5f9b4c0): Cat alone (Composer 2.0 vision) has 0/2 catch rate on visual verification. The \`questPurrview.approve\` and \`bounce\` gates now refuse any verdict missing \`judge_origin\`. The judge's verdict binds — Cat's \`text\` is the wrapper note, not the decision.

For each \`item_key\` returned by confirmSubmission:
- **Image URL** → call \`openai_images.judge({ imageUrl, claim })\` where \`claim\` is the item's \`expectation\` verbatim. Default model is \`gpt-4o\` (full); never override to \`gpt-4o-mini\` (banned, see CLAUDE.md WWCD).
- **Text / JSON URL** → fetch the body and judge it yourself via Claude Sonnet (claudeCLI). Use \`judge_origin: 'claude-multimodal-read'\` for these.
- **Document / non-image URL** → same as text.

\`\`\`javascript
import { judge } from "@/libs/weapon/openai_images";

const perItemVerdicts = [];
for (const item of confirm.items) {
  const isImage = /\\.(png|jpg|jpeg|gif|webp)/i.test(item.url);
  if (isImage) {
    const j = await judge({ imageUrl: item.url, claim: item.expectation });
    // j.verdict ∈ {'match','mismatch','inconclusive'}; map conservatively.
    const verdict = j.verdict === "match" ? "pass" : "fail";
    perItemVerdicts.push({
      item_key: item.item_key,
      verdict,
      text: verdict === "pass"
        ? \`Judge confirmed: \${j.reasoning}\`
        : \`Judge flagged \${j.verdict} (confidence \${j.confidence}): \${j.reasoning}\`,
      judge_origin: \`openai_images.judge:\${j.model}\`,
      judge_rationale: j.reasoning,
      judge_model: j.model,
    });
  } else {
    // Text/JSON/doc — fetch + Claude-judge, then build the verdict with
    // judge_origin: 'claude-multimodal-read'.
  }
}
\`\`\`

### Step 3a — Approve (every judge says match)

\`\`\`javascript
import { approve } from "@/libs/weapon/questPurrview";
const result = await approve({ questId, perItemVerdicts, summary: "Optional Cat-level note" });
if (!result.ok) {
  // Common rejections:
  //   failed: ['judge_origin_missing_or_invalid'] → you forgot to invoke the judge
  //                                                  for one or more items.
  //   failed: ['verdict_not_all_pass']            → at least one judge said
  //                                                  mismatch/inconclusive. Use bounce.
  // result.report.fix tells you exactly what to do.
}
\`\`\`

On success: stage moves to \`review\`, per-item Cat verdict comments are written (text includes judge rationale), \`items.purrview_check\` (T2 column) is filled per item via the writeReview chokepoint, and the APPROVE lockphrase ('this quest now meets the criteria for review') lands as a quest_comments row. The GM-desk script greps for that phrase before showing the quest to the user.

### Step 3b — Bounce (≥1 judge said mismatch / inconclusive)

\`\`\`javascript
import { bounce } from "@/libs/weapon/questPurrview";
const result = await bounce({
  questId,
  perItemVerdicts, // same shape as approve — judge_origin still required even on bounce
  reason: "<one paragraph: which item_keys failed, what the judge flagged, what the worker should fix>",
});
\`\`\`

On success: stage returns to \`execute\`, per-item Cat verdict comments are written, \`items.purrview_check\` is filled per item, and the BOUNCE lockphrase lands as a quest_comments row. The worker resubmits using \`writeItem\` with the SAME item_keys (UPSERT replaces in place) — same items.length, same gate.

### What NOT to do

- Do NOT \`updateQuest({stage: 'review'})\` directly. There's no other path that writes the APPROVE lockphrase, and the GM desk will refuse to surface the quest.
- Do NOT skip \`confirmSubmission\`. If a quest reached purrview without passing through the worker gate, it's untrusted — bounce or escalate.
- Do NOT call approve with a 'fail' verdict to "let it through with a note." The gate refuses; bounce is the only valid path for any failure.
- Do NOT post a verdict without a \`judge_origin\`. Cat's standalone visual judgment has 0/2 catch rate — the gate will reject and tell you which item_keys are missing the judge call.
- Do NOT make up a \`judge_origin\` value. The gate accepts only \`openai_images.judge[:model]\` and \`claude-multimodal-read\`. Inventing labels like \`"cat"\` or \`"manual-review"\` will fail validation.

### Common content-quality bounces (history)

- Stock images uploaded with descriptions claiming they're real artifacts (Caribbean beach for sales chart, Swiss-Made badge for folder listing).
- Empty inventory passed via direct stage write (now blocked by the submit gate, but legacy quests may still appear).
- Wrong repo/workspace artifacts (quest is for bosterbio.com2026, screenshots are from GuildOS dev server).
- Dev overlays / 4xx pages captured as if they were the success state.
`,
    },
    reviewCloudAgentWork: {
      description: "Legacy: high-level review framing for cloud-agent deliverables. For new work, use reviewSubmission — the script-locked flow.",
      howTo: `
**Use reviewSubmission for any quest in \`purrview\`.** This action is kept as a meta-framing reference for cases where a cloud agent's output isn't yet on a quest (one-off investigations, exploratory dispatches), but the moment artifacts exist as items on a quest, the script-locked flow is the only acceptable path.

**Common cloud agent pitfalls (still useful as a reference list — feed into reviewSubmission's per-item verdict text):**
- Google/Bing CAPTCHA on headless cloud IPs → use DuckDuckGo or add \`--disable-blink-features=AutomationControlled\`
- Full-page screenshots that are blank/black → use viewport capture instead
- Secrets appearing in committed code → agent's repo has secret scanner
- \`localhost:3002\` unreachable → agent forgot to start dev server
- Stock image substitution masquerading as a real artifact (the dominant failure mode in the 2026-04-25 audit — 8 of 14 quests had bogus inventory)
`,
    },
    reportChaperonWork: {
      description: "Report chaperon work by creating a review-stage quest on the Guildmaster.s Desk.",
      howTo: `
Every completed chaperon engagement must produce a review task visible on \`/guildmaster-room/desk\`. If no GuildOS quest exists for the work, create one in \`review\` stage — the desk auto-shows all review-stage quests.

\`\`\`javascript
import { writeQuest, writeItem, recordQuestComment } from "@/libs/quest";

// 1. Create the review quest
const { data: quest } = await writeQuest({
  userId,
  title: "Review: <what was done>",
  description: "<summary of work and success criteria>",
  stage: "review",
});

// 2. Upsert each deliverable into the items table (UNIQUE(quest_id, item_key) enforces replace-not-pile-on)
await writeItem({
  questId: quest.id,
  item_key: "screenshot_1",
  url: "https://...",
  description: "Login page after fix",
  source: "chaperon",
});

// 3. Post one hand-off comment at the quest level
await recordQuestComment(quest.id, {
  source: "chaperon",
  action: "deliver",
  summary: "Agent completed: built login page, tested with Playwright, 3 screenshots attached.",
  detail: { agentId: "bc-xxx", artifacts: ["screenshot_1", "screenshot_2"] },
});
\`\`\`

**Per-item review notes (Cat annotating a specific screenshot):** use \`writeItemComment(itemId, { role, text })\` — quest-level comments (\`recordQuestComment\`) are a separate channel for hand-offs and major events.
`,
    },
    handleFeedback: {
      description: "Act on feedback from a quest comment or direct message.",
      howTo: `
When you receive feedback on a quest (comment ping or direct message): act on it immediately. Do not ask for confirmation or permission to implement the feedback. The feedback IS the instruction. Just do it, verify the result, and report back.
`,
    },
    assistAdventurer: {
      description: "Assist an adventurer asking for help; scan the full skill-book registry, not just their loaded set.",
      howTo: `
An adventurer's \`skill_books\` array is the common-use load, not a cap on capability. When helping, think comprehensively across the full registry at \`libs/skill_book/index.js\`.

**Process:**
1. Understand the block — read the quest description, the adventurer's latest comment, and what they tried.
2. Scan the skill book registry. Look for any book whose scope matches the problem, regardless of whether it's in the adventurer's assigned array.
3. If you find a fitting action in a book the adventurer doesn't carry: instruct them to load its \`toc\` (and the specific action's \`howTo\`) temporarily and retry. Do NOT modify their DB \`skill_books\` array for a one-off use.
4. If the adventurer will need that book repeatedly, recommend to the Guildmaster that the adventurer be recommissioned with the book added permanently.
5. Only after this comprehensive scan comes up empty should the adventurer escalate for human help.

**Anti-pattern:** telling an adventurer "you don't have that skill book, escalate" without first checking the registry yourself. The registry is the upper bound on what's available to the guild, not the adventurer's loaded set.
`,
    },

    // ── Merged from questmaster_registry on 2026-04-27 ─────────────────────
    // The old "questmaster_registry" book has been folded into this book.
    approveOrEscalate: {
      description: "Handle requests from worker agents seeking approval or help.",
      howTo: `**When another agent contacts you for approval or help:**

1. **First response:** Do NOT read their full report yet. Ask them:
   "Do you have everything you need to proceed? If so, proceed. If not, tell me specifically what you need from me."

2. **On their second response:** Judge whether you can provide what they need:
   - If YES: help them directly (provide info, credentials, guidance, whatever they asked for).
   - If NO: tell them to escalate the quest (move to 'escalated' stage with a structured comment — reason + unblock_path) and work on the next-priority quest if they have one.

**Key principle:** Don't be a bottleneck. Most agents are asking for permission they don't need. The first question filters those out.`,
    },

    getSecondOpinion: {
      description: "Launch Claude CLI to independently evaluate a submission when you're unsure.",
      howTo: `**When to use:** Complex deliverables where you're unsure about quality, correctness, or completeness. Use sparingly — your own per-item vision verdicts are the canonical signal; this is a tiebreaker.

**How:**
\`\`\`bash
claude -p "Review this submission for quest '<quest-title>'. The deliverable should show: <expectation>. The screenshot is at: <url>. Is this acceptable? What could be improved?"
\`\`\`

Use Claude CLI's response to confirm your assessment, identify issues you missed, or provide more detailed feedback in the bounce comment. Do NOT let it override a clear pass/fail you already established — the per-item verdicts you write to \`purrview_check\` are yours, not delegated.`,
    },

    createPR: {
      description: "Create a pull request for the worker agent's branch after review approval.",
      howTo: `**When:** After reviewSubmission moves the quest to \`review\` (all per-item verdicts pass).

1. Identify the worker agent's branch from the quest comments or conversation.
2. Create a PR on GitHub targeting main (or the project's default branch).
3. Add the quest title and a short summary as the PR description.
4. Record the PR URL in a quest comment so the Guildmaster's desk can link to it.

Worker agents do NOT create PRs — only you do, after approval.`,
    },

    closeQuest: {
      description: "Archive quest deliverables and summary to Asana, then mark complete.",
      howTo: `**Closing flow:**
1. Read the quest description, items, and key comments.
2. Write a managerial-level summary suitable for Asana (not technical detail).
3. Check if the quest references an Asana task (in description or comments).
4. If yes: update the Asana task with the summary using the asana weapon.
5. If no: escalate to the Guildmaster to identify the right Asana task.
6. After successful Asana archival: move quest to \`complete\` stage.
7. Add a comment: "Quest closed. Summary archived to Asana."`,
    },
  },
  steps: [],
};

/**
 * @param {unknown} v
 * @returns {string}
 */
function deliverablesToText(v) {
  if (v == null) return "";
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean).join("\n");
  return String(v).trim();
}

/**
 * @param {unknown} raw
 * @returns {string | null}
 */
function parseDueDateIso(raw) {
  if (raw == null || raw === "") return null;
  const s = String(raw).trim();
  const t = Date.parse(s);
  if (Number.isNaN(t)) return null;
  return new Date(t).toISOString();
}

/**
 * @param {string} text
 * @returns {Record<string, unknown> | null}
 */
function extractJsonObject(text) {
  if (text == null || typeof text !== "string") return null;
  return extractQuestPlanJson(text) || tryBalancedJson(text);
}

/**
 * @param {string} s
 */
function tryBalancedJson(s) {
  const start = s.indexOf("{");
  if (start === -1) return null;
  for (let i = start; i < s.length; i++) {
    if (s[i] !== "{") continue;
    let depth = 0;
    for (let j = i; j < s.length; j++) {
      const ch = s[j];
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          try {
            const obj = JSON.parse(s.slice(i, j + 1));
            if (obj && typeof obj === "object" && !Array.isArray(obj)) return /** @type {Record<string, unknown>} */ (obj);
          } catch {
            return null;
          }
          return null;
        }
      }
    }
  }
  return null;
}

/**
 * Query AI with the user's initial request; return quest-compatible JSON and normalized fields.
 *
 * @param {string} userId
 * @param {{ initialRequest: string, client: import("@/libs/council/database/types.js").DatabaseClient }} opts
 */
export async function planRequestToQuest(userId, { initialRequest, client }) {
  const req = String(initialRequest ?? "").trim();
  if (req.length < 3) {
    console.warn(LOG, "reject: initial request too short", { len: req.length });
    return { data: null, error: new Error("Initial request is too short (need at least 3 characters).") };
  }

  console.log(LOG, "start", {
    userIdPrefix: typeof userId === "string" ? `${userId.slice(0, 8)}…` : String(userId),
    initialRequestLen: req.length,
    initialRequestPreview: previewText(req, 400),
    hasClient: Boolean(client),
  });

  const prompt = `The user submitted this request:

${req}

Respond with ONLY one JSON object (no prose) using exactly these keys:
{
  "title": "verb-first short title",
  "description": "SMART description of the work",
  "deliverables": "what must be submitted (string, or array of strings if multiple)",
  "due_date": "ISO 8601 datetime or clear date string",
  "stage": "plan"
}

"stage" must be "plan" unless the request is too vague — then use "idea".`;

  let aiText = "";
  try {
    console.log(LOG, "calling runDungeonMasterChat");
    const out = await runDungeonMasterChat({
      userId,
      messages: [{ role: "user", content: prompt }],
      model: undefined,
      client,
    });
    aiText = out.text;
    console.log(LOG, "model raw response", {
      responseChars: typeof aiText === "string" ? aiText.length : 0,
      rawPreview: previewText(aiText, 500),
    });
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error(LOG, "runDungeonMasterChat failed", {
      message: e.message,
      name: e.name,
    });
    return { data: null, error: e };
  }

  const parsed = extractJsonObject(aiText);
  if (!parsed || typeof parsed.title !== "string" || String(parsed.title).trim() === "") {
    console.warn(LOG, "parse failed or missing title", {
      hasParsed: Boolean(parsed),
      titleType: parsed && typeof parsed.title,
      extractPreview: previewText(aiText, 600),
    });
    return { data: null, error: new Error("Model did not return valid quest JSON (title required).") };
  }

  const title = String(parsed.title).trim();
  const description = parsed.description != null ? String(parsed.description) : "";
  const deliverables = deliverablesToText(parsed.deliverables ?? parsed.deliverable);
  const dueRaw = parsed.due_date ?? parsed.dueDate;
  const due_date = parseDueDateIso(dueRaw);
  const stageRaw = parsed.stage != null ? String(parsed.stage).trim().toLowerCase() : "plan";
  const stage = stageRaw === "idea" || stageRaw === "plan" ? stageRaw : "plan";

  console.log(LOG, "normalized plan", {
    titleLen: title.length,
    titlePreview: previewText(title, 120),
    descriptionLen: description.length,
    deliverablesLen: deliverables.length,
    due_date,
    stage,
    dueRaw: dueRaw != null ? previewText(dueRaw, 80) : null,
  });

  return {
    data: {
      title,
      description,
      deliverables,
      due_date,
      stage,
      raw_model_text: aiText,
    },
    error: null,
  };
}

/**
 * Read quest fields + adventurer names/capabilities; pick one adventurer (AI-assisted).
 *
 * @param {string} userId
 * @param {{
 *   quest: { title?: unknown, description?: unknown, deliverables?: unknown },
 *   adventurers: Array<{ id: string, name: string, capabilities?: unknown, skill_books?: unknown }>,
 *   client: import("@/libs/council/database/types.js").DatabaseClient
 * }} opts
 */
export async function searchAdventurerForQuest(userId, { quest, adventurers, client }) {
  const roster = Array.isArray(adventurers) ? adventurers : [];
  if (roster.length === 0) {
    return { data: null, error: new Error("No adventurers on roster.") };
  }

  const qTitle = String(quest?.title ?? "").trim() || "(untitled)";
  const qDesc = String(quest?.description ?? "").trim();
  const qDel = deliverablesToText(quest?.deliverables);

  const brief = roster.map((a) => {
    const cap =
      typeof a.capabilities === "string"
        ? a.capabilities
        : a.capabilities != null
          ? JSON.stringify(a.capabilities)
          : "";
    const books = Array.isArray(a.skill_books) ? a.skill_books.join(", ") : "";
    return {
      adventurer_id: a.id,
      name: a.name,
      capabilities_plain: cap,
      skill_books: books,
    };
  });

  const prompt = `You match guild quests to adventurers.

Quest:
Title: ${qTitle}
Description: ${qDesc || "—"}
Deliverables: ${qDel || "—"}

Adventurers (pick exactly one by id):
${JSON.stringify(brief, null, 2)}

Reply with ONLY: {"adventurer_id":"<uuid>"} using one of the listed adventurer_id values.`;

  let aiText = "";
  try {
    const out = await runDungeonMasterChat({
      userId,
      messages: [{ role: "user", content: prompt }],
      model: undefined,
      client,
    });
    aiText = out.text;
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
  }

  const parsed = extractJsonObject(aiText);
  const id =
    parsed && typeof parsed.adventurer_id === "string"
      ? parsed.adventurer_id.trim()
      : parsed && typeof parsed.assignee_id === "string"
        ? parsed.assignee_id.trim()
        : "";

  const picked = id ? roster.find((a) => a.id === id) : null;
  if (!picked) {
    return {
      data: null,
      error: new Error('Model did not return a valid {"adventurer_id":"..."} for a listed adventurer.'),
    };
  }

  return { data: { adventurer_id: picked.id, name: picked.name }, error: null };
}

/**
 * @param {unknown} parsed
 * @returns {{ result: unknown, msg: string } | null}
 */
function normalizeSelectAdventurerConclusion(parsed) {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const o = /** @type {Record<string, unknown>} */ (parsed);
  if (!("result" in o)) return null;
  const msg = o.msg != null ? String(o.msg).trim() : "";
  if (!msg) return null;
  return { result: o.result, msg };
}

function selectResultMeansNoMatch(result) {
  if (result === false) return true;
  if (result === "false") return true;
  if (typeof result === "string" && result.trim().toLowerCase() === "false") return true;
  return false;
}

/**
 * Loads roster (dynamic import to avoid skill_book ↔ adventurer cycle), runs AI pick.
 *
 * @param {string} userId
 * @param {{
 *   quest: Record<string, unknown>,
 *   client: import("@/libs/council/database/types.js").DatabaseClient
 * }} opts
 * @returns {Promise<{ data: { result: false | { id: string, name: string }, msg: string, meta: { prompt: string, modelText: string } } | null, error: Error | null }>}
 */
export async function selectAdventurer(userId, { quest, client }) {
  const questRow = quest && typeof quest === "object" ? quest : null;
  const questId = questRow?.id;
  const initialRequest =
    String(questRow?.description ?? "").trim() || String(questRow?.title ?? "").trim();

  if (!questId || typeof questId !== "string") {
    return { data: null, error: new Error("selectAdventurer: quest.id is required") };
  }

  if (initialRequest.length < 3) {
    return { data: null, error: new Error("selectAdventurer: request text is too short.") };
  }

  const { listAdventurers } = await import("@/libs/adventurer_runtime/server.js");
  const { data: roster, error: rosterErr } = await listAdventurers(userId, { client });
  if (rosterErr) {
    return { data: null, error: rosterErr };
  }

  const rosterArr = Array.isArray(roster) ? roster : [];

  // Build brief with both static capabilities (abstract) and dynamic boast (specific).
  // Capabilities describes the type of work the adventurer handles.
  // Boast lists the exact skill book actions available — the binding contract.
  const { buildBoast } = await import("@/libs/adventurer/index.js");
  const brief = await Promise.all(rosterArr.map(async (a) => ({
    id: a.id,
    name: a.name,
    backstory: typeof a.backstory === "string" ? a.backstory : "",
    capabilities:
      typeof a.capabilities === "string"
        ? a.capabilities
        : a.capabilities != null
          ? JSON.stringify(a.capabilities)
          : "",
    boast: await buildBoast(a),
  })));

  const prompt = `You match a NEW guild request to at most one adventurer on the roster.

User request (raw):
${initialRequest}

Roster — each entry has:
  "id" / "name" — identifiers,
  "backstory" — the adventurer's intended purpose in a sentence or two; THIS IS THE PRIMARY SIGNAL for fit,
  "capabilities" — high-level description of work they handle,
  "boast" — exact list of skill book actions available to them.

Read backstory FIRST. The backstory tells you what the adventurer is FOR. Capabilities and boast are about HOW they do it. A task that fits an adventurer's backstory is a good match even if the boast is generic; a task that mismatches the backstory is a poor match even if the boast technically covers it.

${JSON.stringify(brief, null, 2)}

Reply with ONLY one JSON object (no markdown, no prose):

If one adventurer is a good match:
{
  "result": { "id": "<uuid from roster>", "name": "<exact name from roster>" },
  "msg": "<brief rationale>"
}

If NONE are a good match:
{
  "result": false,
  "msg": "<brief rationale why no one fits>"
}

IMPORTANT — triage priority (apply FIRST, before matching by boast):
1. Ask: "Can this task be done with natural language alone — no specialized API access, no database changes, no codebase modifications?"
2. If YES or UNSURE → pick the general-purpose agent. Most tasks (writing, research, reports, analysis, screenshots, creative work) fall here.
3. ONLY pick a specialized adventurer if the task CLEARLY requires their specific weapon (e.g. Zoho CRM data, forging new code weapons, Stripe billing).
4. Blacksmith/Runesmith are ONLY for creating new weapons and skill books — NOT for general tasks. Do not pick them for writing, research, or content.
5. If a quest returns to assign with a comment saying specialized access is needed, read the comments and re-route accordingly.

Rules:
- "msg" must be a non-empty string.
- "result" is either an object with both "id" and "name" from the roster, or boolean false (or the string "false").
- Match by what the actions DO (read their descriptions), not by action names.`;

  if (rosterArr.length === 0) {
    const msg = "No adventurers on roster; cannot assign without recruitment.";
    return {
      data: {
        result: false,
        msg,
        meta: { prompt, modelText: "" },
      },
      error: null,
    };
  }

  let aiText = "";
  try {
    const out = await runDungeonMasterChat({
      userId,
      messages: [{ role: "user", content: prompt }],
      model: undefined,
      client,
    });
    aiText = out.text;
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
  }

  const parsed = extractJsonObject(aiText);
  const conclusion = normalizeSelectAdventurerConclusion(parsed);

  if (!conclusion) {
    return {
      data: null,
      error: new Error(
        'selectAdventurer: model did not return valid JSON with "result" and non-empty "msg".',
      ),
    };
  }

  const meta = { prompt, modelText: aiText };

  if (selectResultMeansNoMatch(conclusion.result)) {
    return {
      data: { result: false, msg: conclusion.msg, meta },
      error: null,
    };
  }

  const resObj =
    conclusion.result && typeof conclusion.result === "object" && !Array.isArray(conclusion.result)
      ? /** @type {Record<string, unknown>} */ (conclusion.result)
      : null;
  const id =
    resObj && typeof resObj.id === "string"
      ? resObj.id.trim()
      : resObj && typeof resObj.adventurer_id === "string"
        ? resObj.adventurer_id.trim()
        : "";

  const picked = id ? rosterArr.find((a) => a.id === id) : null;
  if (!picked) {
    return {
      data: null,
      error: new Error("selectAdventurer: model id is not on the roster."),
    };
  }

  const nameFromModel = resObj && typeof resObj.name === "string" ? resObj.name.trim() : "";
  let msg = conclusion.msg;
  if (nameFromModel && nameFromModel !== picked.name) {
    msg = `${conclusion.msg} (model name "${nameFromModel}" normalized to roster name "${picked.name}")`;
  }

  return {
    data: {
      result: { id: picked.id, name: picked.name },
      msg,
      meta,
    },
    error: null,
  };
}

/**
 * @param {string} userId
 * @param {{
 *   initialRequest: string,
 *   adventurerName: string,
 *   client: import("@/libs/council/database/types.js").DatabaseClient
 * }} opts
 */
export async function interpretIdea(userId, { initialRequest, adventurerName, client }) {
  const req = String(initialRequest ?? "").trim();
  const adv = String(adventurerName ?? "").trim();
  if (req.length < 3) {
    return { data: null, error: new Error("Initial request is too short.") };
  }
  if (!adv) {
    return { data: null, error: new Error("Adventurer name is required for interpretIdea.") };
  }

  const prompt = `Evaluate this user request and decide if it is clear enough to execute.

User request:
${req}

Check two things:
1. Is the request clear enough that someone could act on it without asking questions?
2. Can you deduce when the task is considered done? (explicit or obvious completion criteria)

If BOTH pass, respond with:
{"clear":true,"title":"<short action-verb title, e.g. Write a poem about spring in Beijing>"}

If EITHER fails, respond with:
{"clear":false,"question":"<one specific clarification question to ask the user>"}

Rules:
- title MUST start with an action verb.
- Do NOT rewrite the user's request. The original description will be kept as-is.
- Be lenient — if the task is obviously completable (e.g. "write a poem about X"), it is clear. Only flag truly ambiguous requests.`;

  let aiText = "";
  try {
    const out = await runDungeonMasterChat({
      userId,
      messages: [{ role: "user", content: prompt }],
      model: undefined,
      client,
    });
    aiText = out.text;
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
  }

  const parsed = extractJsonObject(aiText);
  if (!parsed) {
    return { data: null, error: new Error("Model did not return valid JSON for interpretIdea.") };
  }

  if (parsed.clear === false) {
    // Request is unclear — return question for clarification
    return {
      data: {
        clear: false,
        question: String(parsed.question || "Could you clarify what you'd like done?"),
        raw_model_text: aiText,
      },
      error: null,
    };
  }

  // Request is clear — return title only, description stays as-is
  const title = typeof parsed.title === "string" ? parsed.title.trim() : "";
  if (!title) {
    return { data: null, error: new Error("interpretIdea: model returned clear=true but no title.") };
  }

  return {
    data: {
      clear: true,
      title,
      description: req, // keep original user request as description
      raw_model_text: aiText,
    },
    error: null,
  };
}

/**
 * Assign stage action — uses the quest from pipeline context (guildos.quest),
 * scans adventurer roster via AI, writes the assignment back to the quest.
 * Returns full debug trace (prompt, model response, quest context).
 *
 * @param {string} userId
 * @param {{
 *   questId?: string,
 *   guildos?: { quest?: Record<string, unknown> },
 *   client: import("@/libs/council/database/types.js").DatabaseClient
 * }} opts
 */
export async function assign(userId, { questId, guildos, client }) {
  // Quest comes from pipeline context (loaded by the trigger), or fall back to questId
  let questRow = guildos?.quest ?? null;
  if (!questRow && questId) {
    const { getQuestForOwner } = await import("@/libs/quest");
    const { data, error } = await getQuestForOwner(questId, userId, { client });
    if (error || !data) return { data: null, error: error || new Error("Quest not found.") };
    questRow = data;
  }
  if (!questRow || !questRow.id) {
    return { data: null, error: new Error("assign: quest is required (via pipeline context or questId)") };
  }

  // Run selectAdventurer — AI scans the roster
  const result = await selectAdventurer(userId, { quest: questRow, client });
  if (result.error) {
    return {
      data: {
        result: false,
        msg: result.error.message,
        meta: { quest: { id: questRow.id, title: questRow.title, stage: questRow.stage } },
      },
      error: null,
    };
  }

  const questMeta = { id: questRow.id, title: questRow.title, description: questRow.description, stage: questRow.stage };

  // If a match was found, write the assignment and advance to plan
  if (result.data && result.data.result && result.data.result !== false) {
    const match = result.data.result;
    const assignedTo = match.name || "";

    // Use quest module's resolveAssignee to confirm NPC vs adventurer
    const { resolveAssignee, updateQuest } = await import("@/libs/quest");
    const resolved = await resolveAssignee(assignedTo, client);

    const { updateQuestAssignee } = await import("@/libs/council/database/serverQuest.js");
    await updateQuestAssignee(questRow.id, {
      assigneeId: resolved.type === "adventurer" ? resolved.profile.id : null,
      assignedTo,
    }, { client });

    // Advance directly to execute — planning is done inline by the executing LLM
    await updateQuest(questRow.id, { stage: "execute" }, { client });

    return {
      data: {
        result: match,
        msg: result.data.msg,
        assigneeType: resolved.type,
        resolved: resolved.profile,
        meta: { ...result.data.meta, quest: questMeta },
      },
      error: null,
    };
  }

  // No match — trigger preparation cascade
  const { triggerPreparationCascade } = await import("@/libs/quest");
  const cascadeResult = await triggerPreparationCascade(questRow, { client });

  return {
    data: {
      result: false,
      msg: result.data.msg,
      assigneeType: "none",
      cascade: cascadeResult.error
        ? { ok: false, error: cascadeResult.error.message }
        : { ok: true, ...cascadeResult.data },
      meta: { ...result.data.meta, quest: questMeta },
    },
    error: null,
  };
}

const questmaster = {
  definition,
  planRequestToQuest,
  searchAdventurerForQuest,
  selectAdventurer,
  interpretIdea,
  assign,
};

export default questmaster;

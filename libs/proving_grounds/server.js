/**
 * Server-only proving-grounds surface — roster CRUD, storage, runtime class,
 * and the quest advancement stage machine.
 */
import {
  insertAdventurerRow,
  updateAdventurerRow,
  deleteAdventurerForOwner,
  selectAdventurerForOwner,
  selectAdventurerById,
  listAdventurersForOwner,
} from "@/libs/council/database/serverAdventurer.js";
import { database } from "@/libs/council/database";
import { publicTables } from "@/libs/council/publicTables";
import { getStorageBucketName } from "@/libs/council/storageEnv.js";
import { runDungeonMasterChat } from "@/libs/council/ai/chatCompletion.js";
import { runWithAdventurerExecutionContext } from "@/libs/adventurer/advance.js";

export { selectAdventurerForOwner };
export const listAdventurers = listAdventurersForOwner;

export async function recruitAdventurer({ ownerId, draft, client }) {
  const { filterValidSkillBookNames } = await import("@/libs/skill_book");
  const sb = Array.isArray(draft.skill_books) ? filterValidSkillBookNames(draft.skill_books) : [];
  const insertRow = {
    owner_id: ownerId,
    name: String(draft.name ?? "").trim(),
    system_prompt: String(draft.system_prompt ?? draft.systemPrompt ?? "").trim(),
    skill_books: sb,
    backstory: draft.backstory != null ? String(draft.backstory).trim() || null : null,
    capabilities: draft.capabilities != null ? String(draft.capabilities) : null,
  };
  return insertAdventurerRow(insertRow, { client });
}

export async function updateAdventurer({ adventurerId, ownerId, draft, client }) {
  const { filterValidSkillBookNames } = await import("@/libs/skill_book");
  const updateRow = {
    name: String(draft.name ?? "").trim(),
    system_prompt: String(draft.system_prompt ?? draft.systemPrompt ?? "").trim(),
    skill_books: Array.isArray(draft.skill_books) ? filterValidSkillBookNames(draft.skill_books) : [],
    backstory: draft.backstory != null ? String(draft.backstory).trim() || null : null,
    capabilities: draft.capabilities != null ? String(draft.capabilities) : null,
  };
  return updateAdventurerRow(adventurerId, ownerId, updateRow, { client });
}

export async function decommissionAdventurer({ adventurerId, ownerId, client }) {
  return deleteAdventurerForOwner(adventurerId, ownerId, { client });
}

// ---------------------------------------------------------------------------
// Stage machine helpers
// ---------------------------------------------------------------------------

/**
 * Parse a JSON object from a model text response. Returns null on failure.
 * @param {string} text
 * @returns {Record<string, unknown> | null}
 */
function parseJsonFromModelText(text) {
  if (!text || typeof text !== "string") return null;
  const s = text.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```/im.exec(s);
  const src = fence ? fence[1].trim() : s;
  const start = src.indexOf("{");
  if (start === -1) return null;
  for (let depth = 0, i = start; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) {
        try {
          const obj = JSON.parse(src.slice(start, i + 1));
          if (obj && typeof obj === "object" && !Array.isArray(obj)) return obj;
        } catch { /* continue */ }
        break;
      }
    }
  }
  return null;
}

/**
 * Advance one step of the quest stage machine.
 *
 * Dispatch rules:
 *  - closing/completed: handled by server.js (advanceToNextStep, no assignee needed)
 *  - NPC assignee (Cat/Pig/Blacksmith/Runesmith): delegate to libs/npcs/<slug>/doNextAction
 *  - Adventurer assignee (DB row): server.js runs plan/execute/review logic
 *
 * @param {object} quest — full quest row
 * @param {{ client: import("@/libs/council/database/types.js").DatabaseClient }} opts
 * @returns {Promise<{ ok: boolean, advanced: boolean, stage: string, action?: string, detail?: unknown, note?: string, error?: string }>}
 */
export async function advanceQuest(quest, opts) {
  if (!quest || typeof quest !== "object") {
    return { ok: false, advanced: false, stage: "", error: "Invalid quest" };
  }

  const { client } = opts ?? {};
  const questId = String(quest.id ?? "");
  const ownerId = String(quest.owner_id ?? "");
  const stage = String(quest.stage ?? "idea");

  const { updateQuest, recordQuestComment, updateQuestExecutionPlan } = await import("@/libs/quest/index.js");

  // ── closing: advance to next step or complete (no assignee needed) ──
  if (stage === "closing") {
    const { advanceToNextStep } = await import("@/libs/quest/index.js");
    const stepResult = await advanceToNextStep(questId, { client });
    if (stepResult.error) {
      return { ok: false, advanced: false, stage, error: stepResult.error.message };
    }
    if (stepResult.done) {
      await updateQuest(questId, { stage: "completed" }, { client });
      await recordQuestComment(questId, { source: "system", action: "closing", summary: "All steps complete. Quest finished." }, { client });
      return { ok: true, advanced: true, stage: "completed", action: "closing:complete" };
    }
    return { ok: true, advanced: true, stage: "assign", action: "closing:nextStep", detail: stepResult.data };
  }

  // ── completed: terminal ──
  if (stage === "completed") {
    return { ok: true, advanced: false, stage: "completed", note: "Quest is already completed." };
  }

  // ── Resolve assignee — default unassigned idea/assign to Cat ──
  const { resolveAssignee } = await import("@/libs/quest/index.js");
  let assignedTo = String(quest.assigned_to ?? "").trim();

  if (!assignedTo && (stage === "idea" || stage === "assign")) {
    assignedTo = "Cat";
    const { updateQuestAssignee } = await import("@/libs/council/database/serverQuest.js");
    await updateQuestAssignee(questId, { assigneeId: null, assignedTo: "Cat" }, { client });
  }

  if (!assignedTo) {
    return { ok: false, advanced: false, stage, error: `Quest has no assignee for stage "${stage}". Assign an adventurer or NPC.` };
  }

  const assignee = await resolveAssignee(assignedTo, client);

  // ── NPC path: delegate entirely to the NPC module's doNextAction ──
  if (assignee.type === "npc") {
    const slug = assignee.profile.slug;
    const npcLoaders = {
      questmaster: () => import("@/libs/npcs/questmaster/index.js"),
      guildmaster: () => import("@/libs/npcs/guildmaster/index.js"),
      blacksmith: () => import("@/libs/npcs/blacksmith/index.js"),
      runesmith: () => import("@/libs/npcs/runesmith/index.js"),
    };
    const loader = npcLoaders[slug];
    if (!loader) {
      return { ok: false, advanced: false, stage, error: `Unknown NPC slug: ${slug}` };
    }
    const npcModule = await loader();
    const result = await runWithAdventurerExecutionContext({ userId: ownerId, client }, () =>
      npcModule.doNextAction(quest, { client, userId: ownerId })
    );
    // "waiting" actions mean no progress — mark advanced: false so scripts know to pause
    const waiting = typeof result?.action === "string" && result.action.includes("waiting");
    await recordQuestComment(questId, {
      source: assignee.profile.name,
      action: result?.action || "advance",
      summary: result?.msg || result?.action || "NPC action",
      detail: result,
    }, { client });
    return { ok: result?.ok ?? true, advanced: !waiting, stage, action: `${slug}.${result?.action || "doNextAction"}`, detail: result };
  }

  // ── Adventurer path: plan / execute / review handled here ──
  if (assignee.type !== "adventurer") {
    return { ok: false, advanced: false, stage, error: `Cannot resolve assignee "${assignedTo}" as NPC or adventurer.` };
  }

  const advRow = assignee.profile;

  // ── plan: AI generates execution_plan from system_prompt + skill book context ──
  if (stage === "plan") {
    const systemPrompt = String(advRow.system_prompt ?? "").trim();
    const questTitle = String(quest.title ?? "").trim();
    const questDescription = String(quest.description ?? "").trim();

    // Build skill book context with full TOC so the planner sees exact action names + input/output
    const { getSkillBook } = await import("@/libs/skill_book/index.js");
    const advSkillBooks = Array.isArray(advRow.skill_books) ? advRow.skill_books : [];
    const booksContext = advSkillBooks.map((bookId) => {
      const book = getSkillBook(bookId);
      if (!book) return `- ${bookId}: (not found)`;
      const tocEntries = book.toc && typeof book.toc === "object" ? book.toc : {};
      const actionLines = Object.entries(tocEntries).map(([name, entry]) => {
        const desc = entry?.description || "";
        const input = entry?.input && typeof entry.input === "object" ? JSON.stringify(entry.input) : "{}";
        const output = entry?.output && typeof entry.output === "object" ? JSON.stringify(entry.output) : "{}";
        return `    - ${name}: ${desc}\n      input: ${input}\n      output: ${output}`;
      }).join("\n");
      return `- ${bookId} (${book.title || bookId}): ${book.description || ""}\n  Actions:\n${actionLines}`;
    }).join("\n");

    const { inventoryRawToMap } = await import("@/libs/quest/inventoryMap.js");
    const inventoryMap = inventoryRawToMap(quest.inventory);
    const inventoryContext = Object.keys(inventoryMap).length > 0
      ? `\nCurrent quest inventory:\n${JSON.stringify(inventoryMap, null, 2)}`
      : "";

    const fullPrompt = `${systemPrompt}\n\nQuest title: ${questTitle}\nQuest description: ${questDescription}${inventoryContext}\n\nAvailable skill books:\n${booksContext}`;

    let aiText = "";
    try {
      const out = await runDungeonMasterChat({ userId: ownerId, messages: [{ role: "user", content: fullPrompt }], client });
      aiText = out.text;
    } catch (e) {
      return { ok: false, advanced: false, stage, action: "plan:aiCall", error: e instanceof Error ? e.message : String(e) };
    }

    const parsed = parseJsonFromModelText(aiText);
    if (!parsed) {
      return { ok: false, advanced: false, stage, action: "plan:parseResponse", error: "Adventurer did not return valid JSON", detail: { rawText: aiText.slice(0, 500) } };
    }

    const executionPlan = Array.isArray(parsed.execution_plan) ? parsed.execution_plan : [];
    if (executionPlan.length > 0) {
      await updateQuestExecutionPlan(questId, executionPlan, { client });
    }

    // Store weapon_spec / setup_steps into inventory if present
    if (parsed.weapon_spec || (Array.isArray(parsed.setup_steps) && parsed.setup_steps.length > 0)) {
      const { appendInventoryItem } = await import("@/libs/quest/index.js");
      if (parsed.weapon_spec && typeof parsed.weapon_spec === "object") {
        await appendInventoryItem(questId, { item_key: "weapon_spec", payload: parsed.weapon_spec, source: "plan" }, { client });
      }
      if (Array.isArray(parsed.setup_steps) && parsed.setup_steps.length > 0) {
        await appendInventoryItem(questId, { item_key: "setup_steps", payload: parsed.setup_steps, source: "plan" }, { client });
      }
    }

    await updateQuest(questId, { stage: "execute" }, { client });
    await recordQuestComment(questId, { source: advRow.name, action: "plan", summary: `Plan created (${executionPlan.length} steps)`, detail: { executionPlan, parsed } }, { client });
    return { ok: true, advanced: true, stage: "execute", action: "plan:createPlan", detail: { executionPlan, stepCount: executionPlan.length } };
  }

  // ── execute: pop one step from execution_plan and dispatch it ──
  if (stage === "execute") {
    const { getQuest } = await import("@/libs/quest/index.js");
    const { data: freshQuest } = await getQuest(questId, { client });
    const executionPlan = Array.isArray(freshQuest?.execution_plan) ? freshQuest.execution_plan : [];

    if (executionPlan.length === 0) {
      await updateQuest(questId, { stage: "review" }, { client });
      return { ok: true, advanced: true, stage: "review", action: "execute:complete" };
    }

    const [currentStep, ...remainingSteps] = executionPlan;
    const { normalizePlanStep, getSkillBook } = await import("@/libs/skill_book/index.js");
    const step = normalizePlanStep(currentStep);

    if (!step) {
      await updateQuestExecutionPlan(questId, remainingSteps, { client });
      return { ok: true, advanced: true, stage: "execute", action: "execute:skipInvalidStep", detail: { currentStep } };
    }

    // ── waitFor: pause until required inventory keys exist ──
    const { inventoryRawToMap } = await import("@/libs/quest/inventoryMap.js");
    const invMap = inventoryRawToMap(freshQuest?.inventory);
    const book = getSkillBook(step.skillbook);
    const tocEntry = book?.toc?.[step.action];
    const waitForKeys = Array.isArray(tocEntry?.waitFor) ? tocEntry.waitFor
      : Array.isArray(currentStep?.waitFor) ? currentStep.waitFor : [];
    if (waitForKeys.length > 0) {
      const missing = waitForKeys.filter((k) => !(k in invMap));
      if (missing.length > 0) {
        return { ok: true, advanced: false, stage: "execute", action: "execute:waitingForInventory", note: `Waiting for inventory keys: ${missing.join(", ")}`, detail: { waitingFor: missing } };
      }
    }

    // Build payload: start with static params from plan, then overlay inventory-resolved input keys.
    // params = values known at plan time (e.g. { module: "Quotes", limit: 5 })
    // input = inventory keys whose values come from prior steps' output
    const stepPayload = {};
    const rawParams = currentStep?.params;
    if (rawParams && typeof rawParams === "object" && !Array.isArray(rawParams)) {
      Object.assign(stepPayload, rawParams);
    }
    if (Array.isArray(step.input)) {
      for (const key of step.input) {
        if (key in invMap) stepPayload[key] = invMap[key];
      }
    }

    const { runProvingGroundsAction } = await import("@/libs/proving_grounds/index.js");
    const actionResult = await runProvingGroundsAction({
      userId: ownerId,
      client,
      skillBookId: step.skillbook,
      actionName: step.action,
      payload: stepPayload,
      adventurerRow: advRow,
      questRow: freshQuest,
    });

    // Only pop step and persist items on success
    if (actionResult.ok) {
      if (actionResult.items && Object.keys(actionResult.items).length > 0) {
        const { appendInventoryItem } = await import("@/libs/quest/index.js");
        const outputFilter = Array.isArray(step.output) && step.output.length > 0 ? new Set(step.output) : null;
        for (const [k, v] of Object.entries(actionResult.items)) {
          if (!outputFilter || outputFilter.has(k)) {
            await appendInventoryItem(questId, { item_key: k, payload: v, source: `${step.skillbook}.${step.action}` }, { client });
          }
        }
      }
      await updateQuestExecutionPlan(questId, remainingSteps, { client });
    }

    await recordQuestComment(questId, {
      source: `${step.skillbook}.${step.action}`,
      action: "execute",
      summary: actionResult.ok ? "Step completed" : `Step failed: ${actionResult.msg}`,
      detail: { step, ok: actionResult.ok, msg: actionResult.msg },
    }, { client });

    if (!actionResult.ok) {
      // Weapon reauth escalation: surface a clear, actionable system comment so the
      // user knows exactly what to do in the UI without reading raw error text.
      // All weapon auth errors now include "WEAPON_REAUTH_REQUIRED" or "Forge" in the message.
      const isWeaponReauth = typeof actionResult.msg === "string" && (
        actionResult.msg.includes("WEAPON_REAUTH_REQUIRED") ||
        actionResult.msg.includes("Go to the Forge") ||
        actionResult.msg.includes("forge/zoho")
      );
      if (isWeaponReauth) {
        const { getSiteUrl } = await import("@/libs/council/auth/urls.js");
        const forgeUrl = `${getSiteUrl().replace(/\/$/, "")}/town/town-square/forge/zoho`;
        await recordQuestComment(questId, {
          source: "system",
          action: "escalate:weapon_reauth",
          summary: `Action required: the ${step.skillbook} weapon needs to be re-forged with expanded permissions. Go to the Forge → click "Scrap weapon & forge again" → re-authorize in Zoho to grant the missing scope. Forge: ${forgeUrl}`,
          detail: { weaponId: step.skillbook, action: "reforge_required", forgeUrl },
        }, { client });
      }
      return { ok: false, advanced: false, stage, action: `execute:${step.skillbook}.${step.action}`, error: actionResult.msg, detail: { step } };
    }

    const newStage = remainingSteps.length === 0 ? "review" : "execute";
    if (newStage === "review") {
      await updateQuest(questId, { stage: "review" }, { client });
    }
    return { ok: true, advanced: true, stage: newStage, action: `execute:${step.skillbook}.${step.action}`, detail: { remainingSteps: remainingSteps.length } };
  }

  // ── review: attempt Chrome verification, then advance to closing ──
  if (stage === "review") {
    const { inventoryRawToMap } = await import("@/libs/quest/inventoryMap.js");
    const { getQuest: reloadQuest } = await import("@/libs/quest/index.js");
    const { data: freshForReview } = await reloadQuest(questId, { client });
    const invMap = inventoryRawToMap(freshForReview?.inventory);
    const verificationPrompt = buildVerificationPrompt(freshForReview || quest, invMap);

    if (verificationPrompt) {
      const vResult = await runChromeVerification(verificationPrompt);
      if (vResult) {
        await recordQuestComment(questId, {
          source: "system",
          action: "review:verification",
          summary: vResult.verified
            ? `Automated verification passed: ${vResult.reason}`
            : `Automated verification failed: ${vResult.reason}`,
          detail: { ...vResult, verifiedAt: new Date().toISOString() },
        }, { client });
      }
    }

    await updateQuest(questId, { stage: "closing" }, { client });
    return { ok: true, advanced: true, stage: "closing", action: "review:autoClose" };
  }

  return { ok: true, advanced: false, stage, note: `No advance logic for stage "${stage}" with adventurer "${advRow.name}"` };
}

// ---------------------------------------------------------------------------
// runQuestToCompletion — loops advanceQuest until completed or maxSteps
// ---------------------------------------------------------------------------

/**
 * Advance a quest to completion (or until maxSteps is reached).
 * Returns logs for each step and the final HTML report if one was written to inventory.
 *
 * @param {string} questId
 * @param {{ client: import("@/libs/council/database/types.js").DatabaseClient, maxSteps?: number }} opts
 * @returns {Promise<{ ok: boolean, finalStage: string, logs: Array<Record<string, unknown>>, html: string }>}
 */
export async function runQuestToCompletion(questId, { client, maxSteps = 40 }) {
  const { getQuest } = await import("@/libs/quest/index.js");
  const { inventoryRawToMap } = await import("@/libs/quest/inventoryMap.js");
  /** @type {Array<Record<string, unknown>>} */
  const logs = [];
  let ok = true;
  let html = "";

  // Queue of quest IDs to advance (parent first, then children as they appear)
  const queue = [questId];
  let totalSteps = 0;

  while (queue.length > 0 && totalSteps < maxSteps) {
    const currentQuestId = queue[0];

    const { data: quest, error: loadErr } = await getQuest(currentQuestId, { client });
    if (loadErr || !quest) {
      logs.push({ step: totalSteps, questId: currentQuestId, error: loadErr?.message || "Quest not found" });
      ok = false;
      queue.shift();
      continue;
    }

    const stage = String(quest.stage ?? "");
    if (stage === "completed") {
      queue.shift();
      continue;
    }

    const result = await advanceQuest(quest, { client });
    logs.push({ step: totalSteps, questId: currentQuestId, questTitle: String(quest.title ?? "").slice(0, 60), ...result });
    totalSteps++;

    if (!result.ok) {
      ok = false;
      break;
    }

    // If this advance spawned a child quest, add it to the front of the queue
    // so we resolve dependencies before continuing the parent
    const childId = result.detail?.childQuestId;
    if (childId && typeof childId === "string") {
      queue.unshift(childId);
    }
  }

  // Scan all completed quests for the HTML report (deepest child likely has it)
  for (const qid of [questId, ...queue]) {
    const { data: q } = await getQuest(qid, { client });
    if (!q) continue;
    const inv = inventoryRawToMap(q.inventory);
    if (typeof inv.report_html === "string" && inv.report_html) {
      html = inv.report_html;
      break;
    }
    if (typeof inv.html === "string" && inv.html) {
      html = inv.html;
      break;
    }
  }

  const { data: rootQuest } = await getQuest(questId, { client });
  const finalStage = String(rootQuest?.stage ?? "");

  return { ok, finalStage, logs, html };
}

// ---------------------------------------------------------------------------
// Chrome Extension verification via `claude -p` subprocess
// ---------------------------------------------------------------------------

/**
 * Build a verification prompt for `claude -p` based on quest results.
 * Returns null if the quest has nothing worth verifying via browser.
 *
 * @param {Record<string, unknown>} quest — quest row
 * @param {Record<string, unknown>} inventoryMap — flattened inventory
 * @returns {string | null}
 */
function buildVerificationPrompt(quest, inventoryMap) {
  const title = String(quest.title || "").trim();
  const description = String(quest.description || "").trim();
  const questId = String(quest.id || "");
  const invKeys = Object.keys(inventoryMap);

  // Skip quests with no output items
  if (invKeys.length === 0) return null;

  // Build a summary of what's in inventory for the verifier
  const invSummary = invKeys
    .filter((k) => k !== "pigeon_letters")
    .map((k) => {
      const v = inventoryMap[k];
      if (Array.isArray(v)) return `  - ${k}: array with ${v.length} items`;
      if (v && typeof v === "object") return `  - ${k}: object with keys [${Object.keys(v).slice(0, 5).join(", ")}]`;
      return `  - ${k}: ${String(v).slice(0, 100)}`;
    })
    .join("\n");

  if (!invSummary) return null;

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "http://localhost:3002").replace(/\/$/, "");
  const questUrl = `${siteUrl}/town/inn/quest-board/${questId}`;

  return [
    `Verify the results of this completed quest by inspecting its detail page.`,
    ``,
    `Quest: ${title}`,
    `Description: ${description}`,
    `Quest detail URL: ${questUrl}`,
    ``,
    `Current inventory:`,
    invSummary,
    ``,
    `Instructions:`,
    `1. Navigate to the quest detail URL above`,
    `2. Take a screenshot of the quest detail page`,
    `3. Check whether the inventory section shows the expected output`,
    `4. Respond with ONLY a JSON object:`,
    `   {"verified": true/false, "reason": "one sentence explaining what you found", "screenshotId": "the screenshot ID or null"}`,
  ].join("\n");
}

/**
 * Spawn `claude -p` to run Chrome Extension verification.
 * Returns the parsed result or null if verification could not run.
 *
 * Best-effort: never throws. If Chrome isn't connected, claude isn't
 * installed, or the subprocess times out, returns null silently.
 *
 * @param {string} prompt
 * @returns {Promise<{ verified: boolean, reason: string, screenshotId: string | null } | null>}
 */
async function runChromeVerification(prompt) {
  const { execSync } = await import("node:child_process");

  try {
    const escaped = prompt.replace(/"/g, '\\"').replace(/\n/g, "\\n");
    const cmd = [
      "claude",
      "-p",
      `"${escaped}"`,
      "--output-format", "json",
      "--allowedTools", '"mcp__Claude_in_Chrome__navigate,mcp__Claude_in_Chrome__computer,mcp__Claude_in_Chrome__tabs_context_mcp,mcp__Claude_in_Chrome__tabs_create_mcp,mcp__Claude_in_Chrome__get_page_text,mcp__Claude_in_Chrome__read_page"',
      "--append-system-prompt", '"You are a quest result verifier. Use the Claude Chrome Extension to navigate and screenshot. Return ONLY valid JSON with keys: verified (boolean), reason (string), screenshotId (string or null). No markdown, no prose."',
    ].join(" ");

    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.log("[Chrome Verification] Spawning claude -p ...");
    }

    const stdout = execSync(cmd, {
      timeout: 90_000,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env },
    });

    // Parse the JSON output from claude -p
    const parsed = JSON.parse(stdout);
    // claude -p --output-format json wraps the result in a { result, session_id, ... } envelope
    const resultText = typeof parsed.result === "string" ? parsed.result : stdout;

    // Extract the verification JSON from the result text
    const jsonMatch = resultText.match(/\{[\s\S]*"verified"[\s\S]*\}/);
    if (!jsonMatch) {
      if (process.env.NODE_ENV === "development") {
        // eslint-disable-next-line no-console
        console.log("[Chrome Verification] Could not parse verification JSON from result:", resultText.slice(0, 300));
      }
      return null;
    }

    const verification = JSON.parse(jsonMatch[0]);
    return {
      verified: Boolean(verification.verified),
      reason: String(verification.reason || ""),
      screenshotId: verification.screenshotId || null,
    };
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.log("[Chrome Verification] Skipped:", err.message?.slice(0, 200) || String(err).slice(0, 200));
    }
    return null;
  }
}

// ---------------------------------------------------------------------------
// Storage helpers (unchanged from original)
// ---------------------------------------------------------------------------

export function commissionAvatarPath(userId, ext) {
  const u = String(userId ?? "").trim();
  const e = String(ext ?? "png").replace(/^\./, "");
  return `commission/${u}/${Date.now()}.${e}`;
}

export function adventurerAvatarPath(userId, adventurerId, ext) {
  const u = String(userId ?? "").trim();
  const a = String(adventurerId ?? "").trim();
  const e = String(ext ?? "png").replace(/^\./, "");
  return `adventurers/${u}/${a}.${e}`;
}

export async function uploadStorageObjectAsServiceRole({ path, bytes, contentType }) {
  const db = await database.init("service");
  const bucket = getStorageBucketName();
  const { data, error } = await db.storage.from(bucket).upload(path, bytes, {
    contentType: contentType || "application/octet-stream",
    upsert: true,
  });
  if (error) {
    return { error };
  }
  const pub = db.storage.from(bucket).getPublicUrl(data.path);
  return { data: { path: data.path, publicUrl: pub.data.publicUrl } };
}

export async function generateAndStoreAvatarSheet(opts) {
  void opts;
  return { error: new Error("Avatar sheet generation is not implemented in this build.") };
}

class Adventurer {
  constructor() {
    this.profile = null;
    this.quest = null;
    this.db = database.init("server");
  }

  async loadProfile(adventurerId, tempAttributes = {}) {
    if (!adventurerId) {
      throw new Error("adventurer.loadProfile: adventurerId is required");
    }

    const { data, error } = await this.db
      .from(publicTables.adventurers)
      .select("*")
      .eq("id", adventurerId)
      .single();

    if (error) {
      throw new Error(error.message || "Failed to load adventurer");
    }
    if (!data || typeof data !== "object") {
      throw new Error("Adventurer not found");
    }

    this.profile = data;
    this.profile = { ...this.profile, ...tempAttributes };
    return this.profile;
  }

  async loadQuest(questId) {
    if (!questId) {
      throw new Error("adventurer.loadQuest: questId is required");
    }
    let data;
    if (typeof questId === "object" && questId !== null) {
      data = questId;
    } else {
      const res = await this.db.from(publicTables.quests).select("*").eq("id", questId).single();
      if (res.error) {
        throw new Error(res.error.message || "Failed to load quest");
      }
      data = res.data;
    }
    this.quest = data;
    return this.quest;
  }

  async manage() {
    const { extendAdventurerWithManage } = await import("@/libs/adventurer/manage.js");
    extendAdventurerWithManage(this);
    this.test();
  }
}

export const adventurer = {
  Adventurer,
};

export * from "./ui.js";

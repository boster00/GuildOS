/**
 * Skill book hub — per-book modules live under `libs/skill_book/<name>/`.
 * `getSkillBook` builds the runtime view for proving-grounds / adventurer execution.
 *
 * **Catalog source of truth:** `SKILL_BOOKS`, `ADVENTURER_REGISTRY`, and helpers below
 * (`listSkillBookIdsForRosterUI`, `filterValidSkillBookNames`, etc.). Do not duplicate
 * skill book lists elsewhere; clients load ids via `/api/skill_book?action=listRosterIds`.
 */
import { definition as defaultDef, escalate as defaultEscalate } from "./default/index.js";

export { skillActionOk, skillActionErr } from "./actionResult.js";
import { skillBook as zohoSkillBook, search as zohoSearch } from "./zoho/index.js";

import { skillBook as browsercontrolSkillBook } from "./browsercontrol/index.js";
import {
  definition as questmasterDef,
  planRequestToQuest,
  searchAdventurerForQuest,
  interpretIdea,
  selectAdventurer as runSelectAdventurer,
  assign as runAssign,
} from "./questmaster/index.js";
import { skillBook as guildmasterSkillBook, callToArms } from "./guildmaster/index.js";
import { skillBook as blacksmithSkillBook } from "./blacksmith/index.js";
import { skillBook as bigquerySkillBook, readRecentEvents as bigqueryReadRecentEvents } from "./bigquery/index.js";
import { skillBook as asanaSkillBook, readProjectTasks as asanaReadProjectTasks, readTaskComments as asanaReadTaskComments } from "./asana/index.js";
import { skillBook as cursorSkillBook, dispatchTask as cursorDispatchTask, readStatus as cursorReadStatus, readConversation as cursorReadConversation, dispatchPptGeneration as cursorDispatchPptGeneration } from "./cursor/index.js";
import { skillBook as gmailSkillBook } from "./gmail/index.js";
import { skillBook as housekeepingSkillBook } from "./housekeeping/index.js";
import { questmasterRegistry } from "./questmaster/registry.js";
import { skillBook as cjgeoSkillBook } from "./cjgeo/index.js";
import { skillBook as nexusSkillBook } from "./nexus/index.js";
import { skillBook as bosterbioSkillBook } from "./bosterbio/index.js";
import { skillBook as dailiesSkillBook } from "./dailies/index.js";
import { skillBook as figmaSkillBook, readPages as figmaReadPages, readPage as figmaReadPage, exportFrames as figmaExportFrames, readComponents as figmaReadComponents } from "./figma/index.js";
import { skillBook as supabaseUiSkillBook, readTable as supabaseUiReadTable, readLogs as supabaseUiReadLogs, readAPISettings as supabaseUiReadAPISettings, readStorageBuckets as supabaseUiReadStorageBuckets } from "./supabase_ui/index.js";
import { skillBook as cloudflareSkillBook, audit as cloudflareAudit, classifyCloudflareResponse as cloudflareClassify, interpretLegacyAction as cloudflareInterpretLegacy } from "./cloudflare/index.js";

// --- claudeCLI (inline definition — no separate file needed) ---
const claudeCLISkillBook = {
  id: "claudeCLI",
  title: "Claude CLI",
  description: "Handles any task that can be done with Claude natively. Do not pick if the task requires changing local files.",
  steps: [],
  toc: {
    executeTask: {
      description: "Handles any task that can be done with Claude natively. Do not pick if the task requires changing local files.",
      input: { instructions: "string — natural language description of what to do" },
      output: { result: "object — delivered items and quest comment" },
    },
  },
};

// --- planStepUtils (inlined) ---

/**
 * @typedef {{ skillbook: string, action: string, input?: string[], output?: string[], params?: Record<string, unknown> }} PlanStep
 */

/**
 * @param {unknown} ps
 * @returns {string}
 */
export function qualifiedPlanStep(ps) {
  const n = normalizePlanStep(ps);
  return n ? `${n.skillbook}.${n.action}` : "";
}

/**
 * @param {unknown} raw
 * @returns {PlanStep | null}
 */
export function normalizePlanStep(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = /** @type {Record<string, unknown>} */ (raw);
  let skillbook = typeof o.skillbook === "string" ? o.skillbook.trim() : "";
  let action = typeof o.action === "string" ? o.action.trim() : "";
  if (!skillbook && typeof o.skillBookId === "string") skillbook = o.skillBookId.trim();
  if (!action && typeof o.actionId === "string") action = o.actionId.trim();
  if (!skillbook && typeof o.skill_book === "string") skillbook = o.skill_book.trim();

  if (!skillbook && action && action.includes(".")) {
    const dot = action.indexOf(".");
    skillbook = action.slice(0, dot).trim();
    action = action.slice(dot + 1).trim();
  }

  if (!skillbook || !action) return null;

  /** @type {PlanStep} */
  const out = { skillbook, action };
  if (Array.isArray(o.input)) {
    out.input = o.input.map((x) => String(x)).filter((s) => s.length > 0);
  }
  if (Array.isArray(o.output)) {
    out.output = o.output.map((x) => String(x)).filter((s) => s.length > 0);
  }
  // Preserve params — static values known at plan time (e.g. { module: "Quotes", limit: 5 }).
  // At execute time, params are merged into the payload alongside inventory-resolved input keys.
  if (o.params && typeof o.params === "object" && !Array.isArray(o.params)) {
    out.params = o.params;
  }
  return out;
}

/**
 * @param {Record<string, unknown>} spec
 * @returns {string[]}
 */
function keysRequiredInSpec(spec) {
  if (!spec || typeof spec !== "object") return [];
  /** @type {string[]} */
  const keys = [];
  for (const [key, val] of Object.entries(spec)) {
    if (val && typeof val === "object" && !Array.isArray(val) && /** @type {{ required?: boolean }} */ (val).required === true) {
      keys.push(key);
    }
  }
  return keys;
}

/**
 * @param {Record<string, unknown>} outputSpec
 * @returns {string[]}
 */
function outputKeysFromSpec(outputSpec) {
  if (!outputSpec || typeof outputSpec !== "object") return [];
  return Object.keys(outputSpec);
}

/**
 * @param {PlanStep} planStep
 * @param {{ input?: Record<string, unknown>, output?: Record<string, unknown> } | null | undefined} actionTocEntry
 * @returns {{ inputKeys: string[], outputKeys: string[] }}
 */
export function resolveStepInventoryKeys(planStep, actionTocEntry) {
  if (Array.isArray(planStep.input) && planStep.input.length > 0) {
    const outputKeys =
      Array.isArray(planStep.output) && planStep.output.length > 0
        ? [...planStep.output]
        : actionTocEntry
          ? outputKeysFromSpec(actionTocEntry.output || {})
          : [];
    return { inputKeys: [...planStep.input], outputKeys };
  }

  const input = actionTocEntry && typeof actionTocEntry.input === "object" ? actionTocEntry.input : {};
  const output = actionTocEntry && typeof actionTocEntry.output === "object" ? actionTocEntry.output : {};
  return {
    inputKeys: keysRequiredInSpec(/** @type {Record<string, unknown>} */ (input)),
    outputKeys: outputKeysFromSpec(/** @type {Record<string, unknown>} */ (output)),
  };
}

// --- catalog (inlined) ---

/** Ordered list of skill book definitions for UI (library shelf). */
export function listSkillBooksForLibrary() {
  return Object.values(SKILL_BOOKS).map((def) => ({
    id: def.id,
    title: def.title,
    description: def.description,
  }));
}

/**
 * Collect TOC entries from all skill books owned by an adventurer.
 * @param {{ skill_books?: string[] }} adventurer
 */
export function tocForAdventurer(adventurer) {
  const ids = Array.isArray(adventurer?.skill_books) ? adventurer.skill_books : [];
  const result = [];

  for (const bookId of ids) {
    const def = SKILL_BOOKS[bookId];
    if (!def || def.deprecated) continue;
    const toc = def.toc;
    if (Array.isArray(toc)) {
      for (const entry of toc) {
        if (entry && typeof entry.id === "string") {
          result.push({
            skillBookId: bookId,
            actionId: entry.id,
            summary: entry.summary || "",
            input: entry.input || {},
            output: entry.output || {},
            ...(Array.isArray(entry.waitFor) ? { waitFor: entry.waitFor } : {}),
          });
        }
      }
    } else if (toc && typeof toc === "object" && !Array.isArray(toc)) {
      for (const actionId of Object.keys(toc)) {
        const entry = /** @type {Record<string, unknown>} */ (toc)[actionId];
        const e = entry && typeof entry === "object" ? entry : {};
        result.push({
          skillBookId: bookId,
          actionId,
          summary: typeof e.description === "string" ? e.description : "",
          input:
            (e.input && typeof e.input === "object" && !Array.isArray(e.input) ? e.input : null) ??
            (e.inputExample && typeof e.inputExample === "object" && !Array.isArray(e.inputExample) ? e.inputExample : {}),
          output:
            (e.output && typeof e.output === "object" && !Array.isArray(e.output) ? e.output : null) ??
            (e.outputExample !== undefined && typeof e.outputExample === "object" && !Array.isArray(e.outputExample)
              ? e.outputExample
              : {}),
          ...(Array.isArray(e.waitFor) ? { waitFor: e.waitFor } : {}),
        });
      }
    }
  }

  const defaultDef = SKILL_BOOKS.default;
  if (defaultDef && Array.isArray(defaultDef.toc)) {
    for (const entry of defaultDef.toc) {
      if (result.some((r) => r.skillBookId === "default" && r.actionId === entry.id)) continue;
      result.push({
        skillBookId: "default",
        actionId: entry.id,
        summary: entry.summary || "",
        input: entry.input || {},
        output: entry.output || {},
        ...(Array.isArray(entry.waitFor) ? { waitFor: entry.waitFor } : {}),
      });
    }
  }

  return result;
}

// --- adventurerBookView (inlined) ---

/**
 * @param {Record<string, unknown> & { toc?: unknown }} definition
 * @param {Record<string, (userId: string, input: unknown) => Promise<unknown>>} adventurerActions
 */
export function buildAdventurerSkillBookView(definition, adventurerActions = {}) {
  /** @type {Record<string, { input: Record<string, unknown>, output: Record<string, unknown>, waitFor?: string[] }>} */
  const toc = {};
  if (Array.isArray(definition.toc)) {
    for (const row of definition.toc) {
      if (row && typeof row.id === "string") {
        toc[row.id] = {
          description: row.description || row.summary || "",
          input: row.input && typeof row.input === "object" && !Array.isArray(row.input) ? row.input : {},
          output: row.output && typeof row.output === "object" && !Array.isArray(row.output) ? row.output : {},
          ...(Array.isArray(row.waitFor) ? { waitFor: row.waitFor } : {}),
        };
      }
    }
  } else if (definition.toc && typeof definition.toc === "object" && !Array.isArray(definition.toc)) {
    for (const [actionId, entry] of Object.entries(definition.toc)) {
      const e = entry && typeof entry === "object" ? entry : {};
      toc[actionId] = {
        description: e.description || e.summary || "",
        input:
          (e.input && typeof e.input === "object" && !Array.isArray(e.input) ? e.input : null) ??
          (e.inputExample && typeof e.inputExample === "object" && !Array.isArray(e.inputExample) ? e.inputExample : {}),
        output:
          (e.output && typeof e.output === "object" && !Array.isArray(e.output) ? e.output : null) ??
          (e.outputExample !== undefined && typeof e.outputExample === "object" && !Array.isArray(e.outputExample)
            ? e.outputExample
            : {}),
        ...(Array.isArray(e.waitFor) ? { waitFor: e.waitFor } : {}),
      };
    }
  }

  const out = {
    ...definition,
    toc,
  };

  for (const [actionId, fn] of Object.entries(adventurerActions)) {
    if (typeof fn !== "function") continue;
    out[actionId] = async (inputObj) => {
      const { getAdventurerExecutionUserId } = await import("@/libs/adventurer/advance.js");
      const userId = getAdventurerExecutionUserId();
      if (!userId) {
        throw new Error(
          `Adventurer action "${actionId}" requires runWithAdventurerExecutionContext({ userId, client }, …).`,
        );
      }
      return fn(userId, inputObj);
    };
  }

  return out;
}

/**
 * Canonical definitions for catalog, AI prompts, and `tocForAdventurer`.
 */
export const SKILL_BOOKS = {
  default: defaultDef,
  zoho: zohoSkillBook,
  questmaster: questmasterDef,
  guildmaster: guildmasterSkillBook,
  blacksmith: blacksmithSkillBook,

  browsercontrol: browsercontrolSkillBook,
  bigquery: bigquerySkillBook,
  claudeCLI: claudeCLISkillBook,
  asana: asanaSkillBook,
  cursor: cursorSkillBook,
  gmail: gmailSkillBook,
  cjgeo: cjgeoSkillBook,
  nexus: nexusSkillBook,
  bosterbio: bosterbioSkillBook,
  dailies: dailiesSkillBook,
  figma: figmaSkillBook,
  supabase_ui: supabaseUiSkillBook,
  housekeeping: housekeepingSkillBook,
  cloudflare: cloudflareSkillBook,
  questmaster_registry: questmasterRegistry,
};

/** Catalog keys (for persistence validation). */
export function getAcceptedSkillBookIds() {
  return new Set(Object.keys(SKILL_BOOKS));
}

/**
 * @param {unknown} names
 * @returns {string[]}
 */
export function filterValidSkillBookNames(names) {
  if (!Array.isArray(names)) return [];
  const allowed = getAcceptedSkillBookIds();
  return names.filter((n) => typeof n === "string" && allowed.has(n));
}

/**
 * Checkbox lists on commission/edit UIs: every assignable book (no implicit `default`).
 */
export function listSkillBookIdsForRosterUI() {
  return Object.keys(SKILL_BOOKS).filter((id) => id !== "default");
}

const zohoAdventurerActions = {
  search: (_userId, input) => zohoSearch(/** @type {Record<string, unknown>} */ (input || {})),
};


const guildmasterAdventurerActions = {
  callToArms: (_userId, input) => callToArms(_userId, /** @type {Record<string, unknown>} */ (input || {})),
};

const questmasterAdventurerActions = {
  planRequestToQuest: async (userId, input) => {
    const inObj = /** @type {Record<string, unknown>} */ (input || {});
    const ir = inObj.initialRequest;
    console.log("[GuildOS:planRequestToQuest]", "skill_book adventurer wrapper", {
      userIdPrefix: typeof userId === "string" ? `${userId.slice(0, 8)}…` : userId,
      initialRequestLen: typeof ir === "string" ? ir.length : 0,
    });
    const { getAdventurerExecutionContext } = await import("@/libs/adventurer/advance.js");
    const client = getAdventurerExecutionContext()?.client;
    if (!client) {
      console.error("[GuildOS:planRequestToQuest]", "skill_book wrapper: no execution context client");
      return Promise.reject(new Error("planRequestToQuest requires client in adventurer execution context."));
    }
    const result = await planRequestToQuest(userId, { ...inObj, client });
    console.log("[GuildOS:planRequestToQuest]", "skill_book adventurer wrapper done", {
      ok: !result.error,
      err: result.error?.message,
      hasPlannedTitle: Boolean(result.data && typeof result.data.title === "string"),
    });
    return result;
  },
  searchAdventurerForQuest: async (userId, input) => {
    const { getAdventurerExecutionContext } = await import("@/libs/adventurer/advance.js");
    const client = getAdventurerExecutionContext()?.client;
    if (!client) {
      return Promise.reject(new Error("searchAdventurerForQuest requires client in adventurer execution context."));
    }
    return searchAdventurerForQuest(userId, { .../** @type {Record<string, unknown>} */ (input || {}), client });
  },
  interpretIdea: async (userId, input) => {
    const { getAdventurerExecutionContext } = await import("@/libs/adventurer/advance.js");
    const client = getAdventurerExecutionContext()?.client;
    if (!client) {
      return Promise.reject(new Error("interpretIdea requires client in adventurer execution context."));
    }
    const inObj = /** @type {Record<string, unknown>} */ (input || {});
    return interpretIdea(userId, {
      initialRequest: String(inObj.initialRequest ?? ""),
      adventurerName: String(inObj.adventurerName ?? ""),
      client,
    });
  },
  selectAdventurer: async (userId, input) => {
    const { getAdventurerExecutionContext } = await import("@/libs/adventurer/advance.js");
    const client = getAdventurerExecutionContext()?.client;
    if (!client) {
      return Promise.reject(new Error("selectAdventurer requires client in adventurer execution context."));
    }
    const inObj = /** @type {Record<string, unknown>} */ (input || {});
    const quest =
      inObj.quest && typeof inObj.quest === "object"
        ? inObj.quest
        : inObj.guildos && typeof inObj.guildos === "object" && inObj.guildos !== null && "quest" in inObj.guildos
          ? /** @type {{ quest?: unknown }} */ (inObj.guildos).quest
          : null;
    if (!quest || typeof quest !== "object") {
      return Promise.reject(new Error("selectAdventurer requires quest in input."));
    }
    return runSelectAdventurer(userId, {
      quest: /** @type {Record<string, unknown>} */ (quest),
      client,
    });
  },
  assign: async (userId, input) => {
    const { getAdventurerExecutionContext } = await import("@/libs/adventurer/advance.js");
    const client = getAdventurerExecutionContext()?.client;
    if (!client) {
      return Promise.reject(new Error("assign requires client in adventurer execution context."));
    }
    const inObj = /** @type {Record<string, unknown>} */ (input || {});
    const guildos = inObj.guildos && typeof inObj.guildos === "object" ? inObj.guildos : null;
    const questId = String(inObj.questId || guildos?.quest?.id || "").trim();
    return runAssign(userId, { questId, guildos, client });
  },
};

// Blacksmith is a pure text-prompt skill book — no callable JS actions.
const blacksmithAdventurerActions = {};

const ADVENTURER_REGISTRY = {
  default: { definition: defaultDef, adventurerActions: {
    escalate: (userId, input) => defaultEscalate(userId, /** @type {Record<string, unknown>} */ (input || {})),
  } },
  zoho: { definition: zohoSkillBook, adventurerActions: zohoAdventurerActions },
  questmaster: { definition: questmasterDef, adventurerActions: questmasterAdventurerActions },
  guildmaster: { definition: guildmasterSkillBook, adventurerActions: guildmasterAdventurerActions },
  blacksmith: { definition: blacksmithSkillBook, adventurerActions: blacksmithAdventurerActions },

  browsercontrol: { definition: browsercontrolSkillBook, adventurerActions: {} },
  bigquery: { definition: bigquerySkillBook, adventurerActions: {
    readRecentEvents: (_userId, input) => bigqueryReadRecentEvents(_userId, /** @type {Record<string, unknown>} */ (input || {})),
  } },
  asana: { definition: asanaSkillBook, adventurerActions: {
    readProjectTasks: (_userId, input) => asanaReadProjectTasks(_userId, /** @type {Record<string, unknown>} */ (input || {})),
    readTaskComments: (_userId, input) => asanaReadTaskComments(_userId, /** @type {Record<string, unknown>} */ (input || {})),
  } },
  cursor: { definition: cursorSkillBook, adventurerActions: {
    dispatchTask: (_userId, input) => cursorDispatchTask(_userId, /** @type {Record<string, unknown>} */ (input || {})),
    readStatus: (_userId, input) => cursorReadStatus(_userId, /** @type {Record<string, unknown>} */ (input || {})),
    readConversation: (_userId, input) => cursorReadConversation(_userId, /** @type {Record<string, unknown>} */ (input || {})),
    dispatchPptGeneration: (_userId, input) => cursorDispatchPptGeneration(_userId, /** @type {Record<string, unknown>} */ (input || {})),
  } },
  gmail: { definition: gmailSkillBook, adventurerActions: {} },
  figma: { definition: figmaSkillBook, adventurerActions: {
    readPages: (_userId, input) => figmaReadPages(_userId, /** @type {Record<string, unknown>} */ (input || {})),
    readPage: (_userId, input) => figmaReadPage(_userId, /** @type {Record<string, unknown>} */ (input || {})),
    exportFrames: (_userId, input) => figmaExportFrames(_userId, /** @type {Record<string, unknown>} */ (input || {})),
    readComponents: (_userId, input) => figmaReadComponents(_userId, /** @type {Record<string, unknown>} */ (input || {})),
  } },
  supabase_ui: { definition: supabaseUiSkillBook, adventurerActions: {
    readTable: (_userId, input) => supabaseUiReadTable(_userId, /** @type {Record<string, unknown>} */ (input || {})),
    readLogs: (_userId, input) => supabaseUiReadLogs(_userId, /** @type {Record<string, unknown>} */ (input || {})),
    readAPISettings: (_userId, input) => supabaseUiReadAPISettings(_userId, /** @type {Record<string, unknown>} */ (input || {})),
    readStorageBuckets: (_userId, input) => supabaseUiReadStorageBuckets(_userId, /** @type {Record<string, unknown>} */ (input || {})),
  } },
  cloudflare: { definition: cloudflareSkillBook, adventurerActions: {
    audit: (_userId, input) => cloudflareAudit(_userId, /** @type {Record<string, unknown>} */ (input || {})),
    classifyCloudflareResponse: (_userId, input) => cloudflareClassify(_userId, /** @type {Record<string, unknown>} */ (input || {})),
    interpretLegacyAction: (_userId, input) => cloudflareInterpretLegacy(_userId, /** @type {Record<string, unknown>} */ (input || {})),
  } },
  claudeCLI: { definition: claudeCLISkillBook, adventurerActions: {
    executeTask: async (_userId, input) => {
      const { execSync } = await import("child_process");
      const inObj = /** @type {Record<string, unknown>} */ (input || {});
      const instructions = String(inObj.instructions || "");
      const outputItem = String(inObj.output_item || "result");
      if (!instructions) return { ok: false, msg: "No instructions provided.", items: {} };

      const EXEC_MAX_RETRIES = 3;
      let lastResult = "";
      let lastError = "";

      for (let attempt = 1; attempt <= EXEC_MAX_RETRIES; attempt++) {
        const retryContext = attempt > 1
          ? `\n\nPREVIOUS ATTEMPT FAILED: ${lastError}\nFix the issue and try again.`
          : "";

        const prompt = [
          `Check /docs/adventurer-claude-non-development-guideline.md before starting. Then do the following:`,
          ``,
          instructions,
          retryContext,
          ``,
          `OUTPUT FORMAT REQUIREMENTS:`,
          `- You MUST produce a non-empty result.`,
          `- Output ONLY the final deliverable content as plain text.`,
          `- No explanation, no markdown fences, no preamble — just the deliverable.`,
          `- Before finishing, review your output: is it complete, correct, and non-empty? If not, fix it.`,
        ].join("\n");

        try {
          const result = execSync(
            `claude -p --dangerously-skip-permissions "${prompt.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`,
            { encoding: "utf-8", timeout: 5 * 60 * 1000, maxBuffer: 10 * 1024 * 1024 },
          ).trim();

          // Validate: result must be non-empty and not an error message
          if (!result) {
            lastError = "Claude returned empty output.";
            if (attempt < EXEC_MAX_RETRIES) continue;
            return { ok: false, msg: `Empty output after ${EXEC_MAX_RETRIES} attempts`, items: {} };
          }

          if (result.length < 10 && /^(error|fail|sorry)/i.test(result)) {
            lastError = `Claude returned what looks like an error: "${result.slice(0, 100)}"`;
            if (attempt < EXEC_MAX_RETRIES) continue;
            return { ok: false, msg: lastError, items: {} };
          }

          lastResult = result;
          return { ok: true, msg: `Claude produced ${result.length} chars (attempt ${attempt})`, items: { [outputItem]: result } };
        } catch (err) {
          lastError = `Claude CLI error: ${err.message || err}`;
          if (attempt < EXEC_MAX_RETRIES) continue;
          return { ok: false, msg: `Claude CLI failed after ${EXEC_MAX_RETRIES} attempts: ${lastError}`, items: {} };
        }
      }

      return { ok: false, msg: `executeTask exhausted ${EXEC_MAX_RETRIES} retries: ${lastError}`, items: {} };
    },
  } },
};

/**
 * Skill book runtime: `toc[action].input|output` and `book[action](input)`.
 * @param {string} id
 */
export function getSkillBook(id) {
  const entry = ADVENTURER_REGISTRY[id];
  if (!entry) return null;
  return buildAdventurerSkillBookView(entry.definition, entry.adventurerActions);
}

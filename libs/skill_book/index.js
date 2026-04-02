/**
 * Skill book hub — per-book modules live under `libs/skill_book/<name>/`.
 * `getSkillBook` builds the runtime view for proving-grounds / adventurer execution.
 *
 * **Catalog source of truth:** `SKILL_BOOKS`, `ADVENTURER_REGISTRY`, and helpers below
 * (`listSkillBookIdsForRosterUI`, `filterValidSkillBookNames`, etc.). Do not duplicate
 * skill book lists elsewhere; clients load ids via `/api/skill_book?action=listRosterIds`.
 */
import { definition as defaultDef } from "./default/index.js";

export { skillActionOk, skillActionErr } from "./actionResult.js";
import { skillBook as zohoSkillBook, getRecentOrders } from "./zoho/index.js";
import {
  skillBook as testskillbookDef,
  testaction,
  sendpigeonpost,
  checkPigeonResult,
} from "./testskillbook/index.js";
import {
  skillBook as browsercontrolSkillBook,
  dispatchBrowserActionsThroughPigeonPost,
} from "./browsercontrol/index.js";
import {
  definition as questmasterDef,
  planRequestToQuest,
  findAdventurerForQUest,
  interpretIdea,
  selectAdventurer as runSelectAdventurer,
} from "./questmaster/index.js";
import { skillBook as guildmasterSkillBook, callToArms } from "./guildmaster/index.js";
import { skillBook as blacksmithSkillBook, forgeWeapon, updateProvingGrounds } from "./blacksmith/index.js";

// --- planStepUtils (inlined) ---

/**
 * @typedef {{ skillbook: string, action: string, input?: string[], output?: string[] }} PlanStep
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
  testskillbook: testskillbookDef,
  browsercontrol: browsercontrolSkillBook,
};

/**
 * Legacy `skill_books` values still allowed on adventurer rows until data is migrated.
 * Not registered in {@link SKILL_BOOKS} — keep this Set in this file only.
 */
export const LEGACY_SKILL_BOOK_IDS = new Set(["salesOrders"]);

/** Catalog keys plus {@link LEGACY_SKILL_BOOK_IDS} (for persistence validation). */
export function getAcceptedSkillBookIds() {
  return new Set([...Object.keys(SKILL_BOOKS), ...LEGACY_SKILL_BOOK_IDS]);
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
 * Checkbox lists on commission/edit UIs: every assignable book (no implicit `default`) plus legacy ids.
 */
export function listSkillBookIdsForRosterUI() {
  const fromCatalog = Object.keys(SKILL_BOOKS).filter((id) => id !== "default");
  return [...fromCatalog, ...LEGACY_SKILL_BOOK_IDS];
}

const zohoAdventurerActions = {
  getRecentOrders: (_userId, input) => getRecentOrders(/** @type {Record<string, unknown>} */ (input || {})),
};

const testskillbookAdventurerActions = {
  testaction: (_userId, input) => testaction(_userId, /** @type {Record<string, unknown>} */ (input || {})),
  sendpigeonpost: (_userId, input) => sendpigeonpost(_userId, /** @type {Record<string, unknown>} */ (input || {})),
  checkPigeonResult: (_userId, input) => checkPigeonResult(_userId, /** @type {Record<string, unknown>} */ (input || {})),
};

const browsercontrolAdventurerActions = {
  dispatchBrowserActionsThroughPigeonPost: (_userId, input) =>
    dispatchBrowserActionsThroughPigeonPost(_userId, /** @type {Record<string, unknown>} */ (input || {})),
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
  findAdventurerForQUest: async (userId, input) => {
    const { getAdventurerExecutionContext } = await import("@/libs/adventurer/advance.js");
    const client = getAdventurerExecutionContext()?.client;
    if (!client) {
      return Promise.reject(new Error("findAdventurerForQUest requires client in adventurer execution context."));
    }
    return findAdventurerForQUest(userId, { .../** @type {Record<string, unknown>} */ (input || {}), client });
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
};

const blacksmithAdventurerActions = {
  forgeWeapon: (_userId, input) => forgeWeapon(_userId, /** @type {Record<string, unknown>} */ (input || {})),
  updateProvingGrounds: (_userId, input) => updateProvingGrounds(_userId, /** @type {Record<string, unknown>} */ (input || {})),
};

const ADVENTURER_REGISTRY = {
  default: { definition: defaultDef, adventurerActions: {} },
  zoho: { definition: zohoSkillBook, adventurerActions: zohoAdventurerActions },
  questmaster: { definition: questmasterDef, adventurerActions: questmasterAdventurerActions },
  guildmaster: { definition: guildmasterSkillBook, adventurerActions: guildmasterAdventurerActions },
  blacksmith: { definition: blacksmithSkillBook, adventurerActions: blacksmithAdventurerActions },
  testskillbook: { definition: testskillbookDef, adventurerActions: testskillbookAdventurerActions },
  browsercontrol: { definition: browsercontrolSkillBook, adventurerActions: browsercontrolAdventurerActions },
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

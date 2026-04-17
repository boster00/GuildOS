/**
 * Browser control skill book.
 *
 * CORE RULE (applies to ALL browser tasks — research, testing, booking, anything):
 * Never execute steps blindly. After every action, take a screenshot and read it
 * before deciding the next step. Browser control is observe → act → observe, not a batch script.
 *
 * PRIMARY: Claude in Chrome MCP (mcp__Claude_in_Chrome__*) for any interactive task.
 *   Flow: tabs_context_mcp → navigate → screenshot → read → click/type → screenshot → read → repeat
 * SECONDARY: Browserclaw CDP weapon (libs/weapon/browserclaw/cdp.js) for fully known,
 *   repeatable automation where selectors are confirmed and no visual verification is needed.
 *   Connects to the persistent Chrome instance on port 9222 — does NOT launch its own browser.
 *
 * ── Browserclaw CDP Init Protocol (follow before every session) ─────────────
 *
 * 1. CHECK CDP: isCdpRunning() from libs/weapon/browserclaw/cdp
 *    → If true → call executeSteps() directly (Chrome is already running with auth)
 *
 * 2. IF NOT RUNNING → call ensureCdpChrome()
 *    → Launches Chrome on port 9222 with the shared CDP profile (~/.guildos-cdp-profile)
 *    → Profile already has auth from the last scripts/auth-capture.mjs run
 *    → If Chrome can't launch, escalate with "CDP_CHROME_REQUIRED: run ensureCdpChrome() or launch Chrome manually"
 *
 * 3. FOR CLOUD AGENTS (Cursor): cannot use local CDP.
 *    → Cloud agents must use Claude in Chrome MCP (mcp__Claude_in_Chrome__*) exclusively.
 *    → auth_state JSON (playwright/.auth/user.json) can be used if MCP supports storageState loading.
 *
 * ── Usage (local Guildmaster only) ─────────────────────────────────────────
 *
 *   import { ensureCdpChrome, executeSteps } from '@/libs/weapon/browserclaw/cdp';
 *   await ensureCdpChrome();   // no-op if already running
 *   const result = await executeSteps([
 *     { action: 'navigate', url: 'https://example.com', item: 'nav' },
 *     { action: 'screenshot', item: 'proof' },
 *   ]);
 *
 * ────────────────────────────────────────────────────────────────────────────
 */
import { skillActionOk, skillActionErr } from "@/libs/skill_book/actionResult.js";
import { replacePigeonLetters } from "@/libs/weapon/pigeon";
import { getAdventurerExecutionContext } from "@/libs/adventurer/advance.js";

const DISPATCH_BROWSER_ACTIONS_DESCRIPTION = `Sends an ordered **browserActions** array to GuildOS **pigeon post**: the server replaces the quest's pigeon queue with **one multi-step letter**. Browserclaw (Chrome extension) pulls that letter, runs each step in order, collects results under each step's **item** key, then POSTs a single deliver when all steps complete.

**Every step must include:** **item** (non-empty string — inventory key for the result) and **action** (which operation to run). Steps that target a DOM element also require **selector**. Add a **url** field to any step to navigate to that URL before executing the action.

**Actions:**

- **navigate** — Navigate to **url** and stop (no DOM interaction). Required: **url**, **item**.

- **get** — Read text or an attribute from a DOM element. By default reads **innerText**. Optional **attribute**: innerHTML | outerHTML | value | or any named attribute string. Optional **getAll** (boolean, default false) to collect all matches as an array. Required: **selector**, **item**.

- **click** — Dispatches a full pointer + mouse + click event sequence on the element. Required: **selector**, **item**.

- **typeText** — Types text into an input or contenteditable. Dispatches keyboard events per character. **text** is the string to type. **clearContent** (boolean, default true) clears the field first. Required: **selector**, **item**, **text**.

- **pressKey** — Dispatches keydown/keypress/keyup on a target element. **key** is the key name (e.g. "Enter", "Tab", "Escape"). Optional **selector** (defaults to activeElement). Required: **item**, **key**.

- **wait** — Waits **seconds** (number, capped at 120), then optionally polls for **selector** to appear in DOM for up to 30 s. Required: **item**, **seconds**. No selector required (selector is optional for the poll phase).

- **getUrl** — Returns the current page URL. Required: **item**. No selector.

**Operational note:** Steps are stored on the quest (inventory **pigeon_letters**). Keep step counts reasonable — one letter per test run is preferred.
`;

export const skillBook = {
  id: "browsercontrol",
  title: "Browser control",
  description:
    "Pigeon-post browser automation: dispatch ordered steps (collect, search, DOM actions, in-page navigation) for Browserclaw.",
  steps: [],
  toc: {
    dispatchBrowserActionsThroughPigeonPost: {
      description: DISPATCH_BROWSER_ACTIONS_DESCRIPTION,
      input: {
        browserActions: "array of step objects, each with: action (string, one of: navigate, get, click, typeText, pressKey, wait, getUrl), item (string, inventory key for result), selector (string, CSS selector — required for get/click/typeText), url (string, optional — navigate before action), text (string, for typeText), key (string, for pressKey), seconds (int, for wait)",
      },
      output: {
        pigeon_letters: "array, one letter row with steps[]",
        letterIds: "array of strings",
        letterId: "string, first letter ID",
        pigeon_letter: "object, first letter",
      },
    },
  },
};


function normalizePayload(a, b) {
  return b !== undefined && typeof b === "object" && b !== null && !Array.isArray(b)
    ? b
    : a !== undefined && typeof a === "object" && a !== null && !Array.isArray(a)
      ? a
      : {};
}

const NO_SELECTOR_ACTIONS = new Set(["navigate", "navigateInPage", "wait", "getUrl", "pressKey"]);
function actionNeedsSelector(action) {
  return !NO_SELECTOR_ACTIONS.has(action);
}

export async function dispatchBrowserActionsThroughPigeonPost(a, b) {
  const input = normalizePayload(a, b);
  const raw = /** @type {Record<string, unknown>} */ (input);
  const guildos = raw.guildos && typeof raw.guildos === "object" && !Array.isArray(raw.guildos) ? raw.guildos : null;
  const quest = guildos && /** @type {{ quest?: { id?: string } }} */ (guildos).quest;
  const questId = quest && typeof quest.id === "string" ? quest.id : "";
  if (!questId) {
    return skillActionErr("dispatchBrowserActionsThroughPigeonPost: guildos.quest.id is required.");
  }

  /** @type {Record<string, unknown>[]} */
  const partials = [];

  let browserActions = raw.browserActions;

  // Auto-generate standard weapon test actions from weapon_spec when browserActions not provided
  if (!Array.isArray(browserActions)) {
    const spec = raw.weapon_spec && typeof raw.weapon_spec === "object" && !Array.isArray(raw.weapon_spec)
      ? /** @type {Record<string, unknown>} */ (raw.weapon_spec) : null;
    const weaponName = typeof spec?.name === "string" ? spec.name.trim() : "";
    if (weaponName) {
      const baseUrl = `http://localhost:${process.env.PORT || 3002}/town/proving-grounds/weapons/${weaponName}/`;
      browserActions = [
        { action: "navigate", url: baseUrl, item: "nav" },
        { action: "wait", seconds: 2, selector: `#${weaponName}-cred-check-btn`, item: "ready" },
        { action: "click", selector: `#${weaponName}-cred-check-btn`, item: "credCheck" },
        { action: "wait", seconds: 3, selector: `#${weaponName}-cred-check-result`, item: "waited" },
        { action: "get", selector: `#${weaponName}-cred-check-result`, item: "credResult" },
        { action: "click", selector: `#${weaponName}-hello-btn`, item: "helloClick" },
        { action: "wait", seconds: 3, selector: `#${weaponName}-hello-result`, item: "helloWaited" },
        { action: "get", selector: `#${weaponName}-hello-result`, item: "helloResult" },
      ];
    } else {
      return skillActionErr("dispatchBrowserActionsThroughPigeonPost: browserActions must be an array, or weapon_spec.name must be provided for auto-generation.");
    }
  }

  const execCtx = getAdventurerExecutionContext();
  const clientOpt = execCtx?.client ? { client: execCtx.client } : {};

  if (browserActions.length === 0) {
    const { data, error } = await replacePigeonLetters(questId, [], clientOpt);
    if (error) return skillActionErr(error?.message || "replacePigeonLetters failed.");
    return skillActionOk({
      pigeon_letters: data ?? [],
      letterIds: [],
      letterId: undefined,
      pigeon_letter: undefined,
    });
  }

  let index = 0;
  for (const entry of browserActions) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      return skillActionErr(
        `dispatchBrowserActionsThroughPigeonPost: browserActions[${index}] must be a plain object.`,
      );
    }
    const ba = /** @type {Record<string, unknown>} */ (entry);
    const actionRaw = ba.action;
    const action =
      typeof actionRaw === "string" && actionRaw.trim() ? actionRaw.trim() : "obtainText";
    const selector = typeof ba.selector === "string" ? ba.selector.trim() : "";
    const itemRaw = ba.item;
    const item = typeof itemRaw === "string" ? itemRaw.trim() : "";

    if (!item) {
      return skillActionErr(
        `dispatchBrowserActionsThroughPigeonPost: browserActions[${index}].item is required (non-empty string).`,
      );
    }
    if (actionNeedsSelector(action) && !selector) {
      return skillActionErr(
        `dispatchBrowserActionsThroughPigeonPost: browserActions[${index}] needs a non-empty selector for action "${action}".`,
      );
    }

    if (action === "wait") {
      const sec = Number(ba.seconds);
      if (!Number.isFinite(sec) || sec < 0) {
        return skillActionErr(
          `dispatchBrowserActionsThroughPigeonPost: browserActions[${index}] wait requires a non-negative numeric seconds.`,
        );
      }
    }

    const url = ba.url != null ? String(ba.url).trim() : "";
    const merged = { ...ba, action, selector, item };
    if (url) merged.url = url;
    else delete merged.url;
    partials.push(merged);
    index += 1;
  }

  if (partials.length === 0) {
    return skillActionErr("dispatchBrowserActionsThroughPigeonPost: no valid steps after validation.");
  }

  const { data, error } = await replacePigeonLetters(questId, partials, clientOpt);
  if (error || !data) {
    return skillActionErr(error?.message || "replacePigeonLetters failed.");
  }
  const letters = data;
  return skillActionOk({
    pigeon_letters: letters,
    letterIds: letters.map((l) => l.letterId),
    letterId: letters[0]?.letterId,
    pigeon_letter: letters[0],
  });
}

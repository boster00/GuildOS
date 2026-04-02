/**
 * Browser control via pigeon post — queue multi-step browser work for Browserclaw.
 */
import { skillActionOk, skillActionErr } from "@/libs/skill_book/actionResult.js";
import { replacePigeonLetters } from "@/libs/weapon/pigeon";

const DISPATCH_BROWSER_ACTIONS_DESCRIPTION = `Sends an ordered **browserActions** array to GuildOS **pigeon post**: the server replaces the quest's pigeon queue with **one multi-step letter**. Browserclaw (Chrome extension) pulls that letter, runs each step on the active tab in order, collects results under each step's **item** key (inventory), then POSTs a single deliver. An optional **url** on a step triggers full-page navigation before that step runs; if **url** is omitted, the step runs in the current document.

**Every step must include:** **item** — a non-empty string used as the inventory key for the result written when the step completes. **action** names which operation to run (see below). Most DOM steps require a non-empty **selector**; exceptions are **navigateInPage**, **wait**, and **listenFor** (listenFor allows selector-only, text-only, or both — see below).

Browserclaw holds all captured **item** values in memory for the letter; one **POST** to pigeon-post **deliver** sends the full **items** map when you choose Send result — not one request per step.

**Actions (parameters beyond action/selector/item/url):**

- **obtainText** — Legacy read: takes **innerText**-style text from the **first** element matching **selector**. Required: **selector**, **item**. Use when you only need visible text from one node.

- **collect** — Reads a property from matched node(s). **attribute**: one of innerText, textContent, innerHTML, outerHTML, href, src, value, checked; or **attr:name** for a named attribute. **match**: first | all | nth (default first). For **nth**, **nth** is 1-based. **item** stores the collected value (string or JSON-serializable structure when match=all). Required: **selector**, **item**, **attribute**.

- **search** — Finds content within matched element(s) using **targetString** (literal) or **pattern** + **flags** (RegExp). Uses the same **attribute** / **match** / **nth** conventions as **collect** for which DOM text to search. Required: **selector**, **item**, and either **targetString** or **pattern**.

- **click** — Clicks the first element matching **selector**. Optional **scrollIntoView** (boolean, default true) scrolls into view first. Required: **selector**, **item** (still required for pigeon bookkeeping even if no text is collected).

- **enterValue** — Sets an input's value using the native value setter and dispatches **input** and **change**. **value** is the string to set. Optional **clear** (boolean) clears first. Required: **selector**, **item**, **value**.

- **setChecked** — Sets **checked** (boolean) on checkbox/radio. Required: **selector**, **item**, **checked**.

- **selectOption** — Selects an option on **select**: **optionValue** (preferred) or **optionLabel**. Required: **selector**, **item**, and one of **optionValue** / **optionLabel**.

- **navigateInPage** — Client-side navigation: **path** and/or **hash** applied via History API as implemented by Browserclaw. **selector** is not required. **item** remains required for pigeon semantics (store a short status string or timestamp if no natural payload).

- **wait** — Pauses the run for **seconds** (number, non-negative; extension caps at 120s). Handled in the extension background (no DOM). Required: **item**, **seconds**. No **selector**.

- **listenFor** — Blocks until a condition becomes true, then advances (other steps do not run until this completes). Provide **selector** and/or **targetString** (at least one required). If **selector** only: waits until \`document.querySelector(selector)\` matches. If **targetString** only: waits until the document body text includes that substring. If both: waits until the element matches **and** its visible text includes **targetString**. Optional **timeoutMs** (default 30000, max 120000) and **intervalMs** (poll interval, default 250, clamped 100–2000). On success, **item** stores an object (matched: true, plus optional selector/targetString echo fields). On timeout, the step fails.

- **insertMarkup** — Inserts HTML relative to **selector** (anchor). **placement**: beforebegin | afterbegin | beforeend | afterend. **html** is the markup fragment; parsing should occur only on detached/template nodes (never assign **innerHTML** on live tracked nodes). **signature** is an idempotency token so re-runs do not duplicate inserts. Required: **selector**, **item**, **placement**, **signature**, **html**.

**Implementation note (Browserclaw):** **obtainText**, **listenFor**, and **wait** are implemented end-to-end; other actions may still be partial — confirm the extension dispatcher when relying on them.

**Operational note:** Steps are stored on the quest (inventory **pigeon_letters**). Keep **insertMarkup** HTML small; large payloads bloat persisted JSON.
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
      inputExample: {
        guildos: { quest: { id: "quest-uuid" } },
        browserActions: [
          {
            action: "obtainText",
            selector: "h1",
            item: "pageTitle",
            url: "https://example.com",
          },
          {
            action: "collect",
            selector: ".price",
            item: "priceText",
            attribute: "innerText",
            match: "nth",
            nth: 2,
          },
        ],
      },
      outputExample: {
        pigeon_letters: "Letter[] (one row with steps[])",
        letterIds: "string[]",
        letterId: "string (first)",
        pigeon_letter: "object (first)",
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

function actionNeedsSelector(action) {
  return action !== "navigateInPage";
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

  const browserActions = raw.browserActions;
  if (!Array.isArray(browserActions)) {
    return skillActionErr("dispatchBrowserActionsThroughPigeonPost: browserActions must be an array.");
  }

  if (browserActions.length === 0) {
    const { data, error } = await replacePigeonLetters(questId, [], {});
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

    if (action === "listenFor") {
      const ts = ba.targetString != null ? String(ba.targetString).trim() : "";
      if (!selector && !ts) {
        return skillActionErr(
          `dispatchBrowserActionsThroughPigeonPost: browserActions[${index}] listenFor requires a non-empty selector and/or targetString.`,
        );
      }
      if (ba.timeoutMs != null) {
        const t = Number(ba.timeoutMs);
        if (!Number.isFinite(t) || t < 0) {
          return skillActionErr(
            `dispatchBrowserActionsThroughPigeonPost: browserActions[${index}] listenFor timeoutMs must be a non-negative number.`,
          );
        }
      }
      if (ba.intervalMs != null) {
        const iv = Number(ba.intervalMs);
        if (!Number.isFinite(iv) || iv < 0) {
          return skillActionErr(
            `dispatchBrowserActionsThroughPigeonPost: browserActions[${index}] listenFor intervalMs must be a non-negative number.`,
          );
        }
      }
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

  const { data, error } = await replacePigeonLetters(questId, partials);
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

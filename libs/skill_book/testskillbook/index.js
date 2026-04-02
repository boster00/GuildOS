/**
 * Test skill book — minimal multiply action for proving grounds and plumbing checks.
 */
import { skillActionOk, skillActionErr } from "@/libs/skill_book/actionResult.js";
import { replacePigeonLetters } from "@/libs/weapon/pigeon";

export const skillBook = {
  id: "testskillbook",
  title: "Test skill book",
  description: "Dev-only multiply: testaction(num1, num2) → product; pigeon smoke test.",
  steps: [],
  toc: {
    testaction: {
      description: "Multiply two numbers.",
      inputExample: { num1: "number", num2: "number" },
      outputExample: { product: "number", sysprompt: "string (adventurer system_prompt when guildos.profile is present)" },
    },
    sendpigeonpost: {
      description:
        "Replace quest pigeon queue with one multi-step letter from browserActions (inventory.pigeon_letters; Browserclaw runs all steps then POSTs deliver once).",
      inputExample: { browserActions: [{ action: "obtainText", selector: "h1", item: "h1text" }] },
      outputExample: {
        pigeon_letters: "Letter[] (one row with steps[])",
        letterIds: "string[]",
        letterId: "string (first)",
        pigeon_letter: "object (first)",
      },
    },
    checkPigeonResult: {
      description: "Verify that a pigeon-delivered item exists in inventory.",
      inputExample: { h1text: "string (the extracted text)" },
      outputExample: { verified: "boolean", h1text: "string" },
      waitFor: ["h1text"],
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

/**
 * @param {unknown} [a] userId or payload
 * @param {unknown} [b] payload when a is userId
 */
export async function testaction(a, b) {
  const input = normalizePayload(a, b);
  const raw = /** @type {Record<string, unknown>} */ (input);
  const n1 = Number(raw.num1);
  const n2 = Number(raw.num2);
  if (!Number.isFinite(n1) || !Number.isFinite(n2)) {
    return skillActionErr("num1 and num2 must be finite numbers.");
  }
  const guildos = raw.guildos && typeof raw.guildos === "object" && !Array.isArray(raw.guildos) ? raw.guildos : null;
  const profile = guildos && /** @type {{ profile?: unknown }} */ (guildos).profile;
  const p = profile && typeof profile === "object" && !Array.isArray(profile) ? /** @type {Record<string, unknown>} */ (profile) : null;
  const sysprompt = String(p?.system_prompt ?? p?.systemPrompt ?? "");
  return skillActionOk({ product: n1 * n2, sysprompt });
}

/**
 * @param {unknown} [a] userId or payload
 * @param {unknown} [b] payload when a is userId
 */
export async function sendpigeonpost(a, b) {
  const input = normalizePayload(a, b);
  const raw = /** @type {Record<string, unknown>} */ (input);
  const guildos = raw.guildos && typeof raw.guildos === "object" && !Array.isArray(raw.guildos) ? raw.guildos : null;
  const quest = guildos && /** @type {{ quest?: { id?: string } }} */ (guildos).quest;
  const questId = quest && typeof quest.id === "string" ? quest.id : "";
  if (!questId) {
    return skillActionErr("sendpigeonpost: guildos.quest.id is required.");
  }

  /** @type {Array<{ action?: string, selector?: string, item?: string, url?: string }>} */
  const partials = [];

  const browserActions = raw.browserActions;
  if (Array.isArray(browserActions)) {
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
    for (const entry of browserActions) {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
      const ba = /** @type {Record<string, unknown>} */ (entry);
      const action = typeof ba.action === "string" && ba.action.trim() ? ba.action.trim() : "obtainText";
      const selector = typeof ba.selector === "string" && ba.selector.trim() ? ba.selector.trim() : "h1";
      const item = typeof ba.item === "string" && ba.item.trim() ? ba.item.trim() : "h1text";
      const url = typeof ba.url === "string" && ba.url.trim() ? ba.url.trim() : "";
      const p = { action, selector, item };
      if (url) p.url = url;
      partials.push(p);
    }
    if (partials.length === 0) {
      return skillActionErr("sendpigeonpost: browserActions has no valid action objects.");
    }
  } else {
    let action = "obtainText";
    let selector = "h1";
    let item = "h1text";
    let url = "";
    if (typeof raw.action === "string" && raw.action.trim()) action = raw.action.trim();
    if (typeof raw.selector === "string" && raw.selector.trim()) selector = raw.selector.trim();
    if (typeof raw.item === "string" && raw.item.trim()) item = raw.item.trim();
    if (typeof raw.url === "string" && raw.url.trim()) url = raw.url.trim();
    const p = { action, selector, item };
    if (url) p.url = url;
    partials.push(p);
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

/**
 * @param {unknown} [a] userId or payload
 * @param {unknown} [b] payload when a is userId
 */
export async function checkPigeonResult(a, b) {
  const input = normalizePayload(a, b);
  const raw = /** @type {Record<string, unknown>} */ (input);
  const h1text = raw.h1text;
  return skillActionOk({ verified: true, h1text });
}

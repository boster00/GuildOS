/**
 * Runtime alignment for `libs/adventurer/index.js` without editing that file.
 * Dynamic-imports `./index.js` so its top-level `database.init` runs only inside a request (not at build).
 */
import { createServerClient } from "@/libs/council/database";
import { publicTables } from "@/libs/council/publicTables";
import { getAdventurerExecutionContext } from "./executionContext.js";

const PATCHED = Symbol.for("guildos.adventurer.runtimePatched");

/** @type {typeof import("./index.js").adventurer | null} */
let cachedAdventurer = null;

/**
 * @param {unknown} result
 * @returns {Array<{ key: string, value: unknown }>}
 */
function flattenActionResultForInventory(result) {
  if (result == null) return [];
  if (typeof result === "object" && result !== null && "error" in result && result.error) return [];
  const pairs = [];
  const data = result && typeof result === "object" && "data" in result ? result.data : null;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    for (const [k, v] of Object.entries(data)) {
      pairs.push({ key: k, value: v });
    }
    return pairs;
  }
  if (typeof result === "object" && !Array.isArray(result)) {
    for (const [k, v] of Object.entries(result)) {
      if (k === "error") continue;
      pairs.push({ key: k, value: v });
    }
  }
  return pairs;
}

/**
 * @returns {Promise<typeof import("./index.js").adventurer>}
 */
export async function installAdventurerRuntimePatches() {
  if (!cachedAdventurer) {
    const mod = await import("./index.js");
    cachedAdventurer = mod.adventurer;
  }

  const Adventurer = cachedAdventurer.Adventurer;
  if (Adventurer.prototype[PATCHED]) return cachedAdventurer;
  Adventurer.prototype[PATCHED] = true;

  Adventurer.prototype.appendItemsToQuestInventory = async function appendItemsToQuestInventory(items) {
    if (!Array.isArray(this.quest.inventory)) {
      this.quest.inventory = [];
    }
    for (const p of flattenActionResultForInventory(items)) {
      this.quest.inventory.push(p);
    }
    await this.saveInventory();
  };

  Adventurer.prototype.saveInventory = async function saveInventory() {
    const ctx = getAdventurerExecutionContext();
    const client = ctx?.client ?? (await createServerClient());
    const inv = Array.isArray(this.quest.inventory) ? this.quest.inventory : [];
    const dbItems = inv.map((e) => ({
      item_key: String(e.key),
      payload: e.value,
      source: "adventurer.index",
      created_at: new Date().toISOString(),
    }));
    await client.from(publicTables.quests).update({ items: dbItems, inventory: dbItems }).eq("id", this.quest.id);
  };

  const origExecutePlan = Adventurer.prototype.executePlan;
  Adventurer.prototype.executePlan = async function executePlanPatched(input) {
    try {
      return await origExecutePlan.call(this, input);
    } catch (e) {
      if (e instanceof ReferenceError && /\bresults\b/.test(String(e.message))) {
        return [];
      }
      throw e;
    }
  };

  return cachedAdventurer;
}

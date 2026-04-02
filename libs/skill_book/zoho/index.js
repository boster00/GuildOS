/**
 * Zoho Books skill book — toc is a map: action name → { description, inputExample, outputExample }.
 */
import { getList } from "@/libs/weapon/zoho";
import { skillActionOk, skillActionErr } from "@/libs/skill_book/actionResult.js";

export const skillBook = {
  id: "zoho",
  title: "Zoho Books",
  description: "Connect to Zoho Books and fetch latest records via the Books API.",
  steps: [],
  toc: {
    getRecentOrders: {
      description: "Fetch the latest rows from a Zoho Books module (possible transaction names: salesorders, invoices, bills, purchaseorders, creditnotes, payments, estimates).",
      inputExample: { module: "pick a transaction name, note the format is single word without spaces, like salesorders, invoices, bills, purchaseorders, creditnotes, payments or estimates", numOfRecords: "integer" },
      outputExample: [],
    },
  },
};

/**
 * Adventurer wrappers call (userId, input); some API routes call (input) only.
 * @param {unknown} [a] userId or payload
 * @param {unknown} [b] payload when a is userId
 * @returns {Promise<{ ok: boolean, msg: string, items: Record<string, unknown> }>}
 */
export async function getRecentOrders(a, b) {
  const input =
    b !== undefined && typeof b === "object" && b !== null && !Array.isArray(b)
      ? b
      : a !== undefined && typeof a === "object" && a !== null && !Array.isArray(a)
        ? a
        : {};
  const raw = input;
  const mod = String(raw.module ?? raw.transaction_type ?? "salesorders").trim() || "salesorders";
  const n = Number(raw.numOfRecords ?? raw.limit ?? 10);
  try {
    const rows = await getList(mod, n);
    return skillActionOk({ [mod]: rows });
  } catch (e) {
    return skillActionErr(e instanceof Error ? e.message : String(e));
  }
}

/**
 * Zoho skill book — unified search across Zoho Books and Zoho CRM.
 * One action (`search`) covers all modules. The caller specifies a `module`
 * parameter; routing to Books vs CRM API happens internally.
 */
import { searchBooks, searchCrm } from "@/libs/weapon/zoho";
import { skillActionOk, skillActionErr } from "@/libs/skill_book/actionResult.js";

const BOOKS_MODULES = new Set([
  "salesorders", "invoices", "bills",
  "purchaseorders", "creditnotes", "payments", "estimates",
]);

const CRM_MODULES = new Set([
  "Contacts", "Quotes", "Leads", "Deals",
]);

export const skillBook = {
  id: "zoho",
  title: "Zoho",
  description: "Search Zoho Books and Zoho CRM modules via shared OAuth.",
  steps: [],
  toc: {
    search: {
      description: "Search any Zoho module and return up to N records.",
      input: {
        module: "string, one of: salesorders, invoices, bills, purchaseorders, creditnotes, payments, estimates, Contacts, Quotes, Leads, Deals",
        limit: "int, e.g. 5",
      },
      output: {
        records: "array of objects",
      },
    },
  },
};

/**
 * Normalize skill book action input — handles both (userId, input) and
 * (enrichedPayload) call shapes from the proving grounds.
 * @param {unknown} a
 * @param {unknown} b
 */
function normalizeInput(a, b) {
  if (b !== undefined && typeof b === "object" && b !== null && !Array.isArray(b)) return b;
  if (a !== undefined && typeof a === "object" && a !== null && !Array.isArray(a)) return a;
  return {};
}

/**
 * Unified Zoho search — routes to Books or CRM based on the `module` value.
 *
 * @param {unknown} [a]
 * @param {unknown} [b]
 */
export async function search(a, b) {
  const raw = normalizeInput(a, b);
  const module = String(raw.module ?? "").trim();
  const limit = Number(raw.limit ?? 5);

  if (!module) {
    return skillActionErr(
      `"module" is required. Books: ${[...BOOKS_MODULES].join(", ")}. CRM: ${[...CRM_MODULES].join(", ")}.`
    );
  }

  if (BOOKS_MODULES.has(module)) {
    try {
      const rows = await searchBooks(module, limit);
      return skillActionOk({ records: rows });
    } catch (e) {
      return skillActionErr(e instanceof Error ? e.message : String(e));
    }
  }

  if (CRM_MODULES.has(module)) {
    try {
      const rows = await searchCrm(module, limit);
      return skillActionOk({ records: rows });
    } catch (e) {
      return skillActionErr(e instanceof Error ? e.message : String(e));
    }
  }

  return skillActionErr(
    `Unknown Zoho module: "${module}". ` +
    `Books: ${[...BOOKS_MODULES].join(", ")}. CRM: ${[...CRM_MODULES].join(", ")}.`
  );
}

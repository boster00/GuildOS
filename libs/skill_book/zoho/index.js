/**
 * Zoho skill book — unified search across Zoho Books, Zoho CRM, and Zoho Mail.
 * Actions: `search` (Books/CRM), `readMailAccounts`, `readMailMessages`.
 *
 * Note: Zoho Mail API only allows reading the authenticated user's own mailbox.
 * There is no admin API to read other users' inboxes — each user must authorize separately.
 */
import { searchBooks, searchCrm, readMailAccounts, readMailMessages } from "@/libs/weapon/zoho";
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
  description: "Search Zoho Books/CRM modules and read Zoho Mail inbox via shared OAuth.",
  steps: [],
  toc: {
    search: {
      description: "Search any Zoho Books or CRM module and return up to N records.",
      input: {
        module: "string, one of: salesorders, invoices, bills, purchaseorders, creditnotes, payments, estimates, Contacts, Quotes, Leads, Deals",
        limit: "int, e.g. 5",
      },
      output: { records: "array of objects" },
    },
    readMailAccounts: {
      description: "Read Zoho Mail accounts for the authenticated user. Returns accountId needed for readMailMessages.",
      input: {},
      output: { accounts: "array of { accountId, emailAddress, displayName }" },
    },
    readMailMessages: {
      description: "Read recent messages from the authenticated user's Zoho Mail inbox.",
      input: {
        accountId: "string — from readMailAccounts()",
        limit: "int, default 5",
      },
      output: { messages: "array of { messageId, subject, fromAddress, receivedTime, summary }" },
    },
  },
};

function normalizeInput(a, b) {
  if (b !== undefined && typeof b === "object" && b !== null && !Array.isArray(b)) return b;
  if (a !== undefined && typeof a === "object" && a !== null && !Array.isArray(a)) return a;
  return {};
}

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

export async function readMailAccountsAction(a, b) {
  try {
    const accounts = await readMailAccounts();
    return skillActionOk({ accounts });
  } catch (e) {
    return skillActionErr(e instanceof Error ? e.message : String(e));
  }
}

export async function readMailMessagesAction(a, b) {
  const raw = normalizeInput(a, b);
  const accountId = String(raw.accountId ?? "").trim();
  const limit = Number(raw.limit ?? 5);

  if (!accountId) return skillActionErr('"accountId" is required. Call readMailAccounts first.');

  try {
    const messages = await readMailMessages(accountId, { limit });
    return skillActionOk({ messages });
  } catch (e) {
    return skillActionErr(e instanceof Error ? e.message : String(e));
  }
}

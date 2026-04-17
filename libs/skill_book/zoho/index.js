/**
 * Zoho skill book — unified search across Zoho Books, Zoho CRM, and Zoho Mail.
 * Actions: `search` (Books/CRM), `readMailAccounts`, `readMailMessages`, `readOrgMailMessages`.
 */
import { searchBooks, searchCrm, readMailAccounts, readMailMessages, readOrgMailMessages } from "@/libs/weapon/zoho";
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
  description: "Search Zoho Books/CRM modules and read Zoho Mail inboxes via shared OAuth.",
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
      description: "List Zoho Mail accounts for the authenticated user. Returns accountId needed for readMailMessages.",
      input: {},
      output: { accounts: "array of { accountId, emailAddress, displayName }" },
    },
    readMailMessages: {
      description: "Read recent messages from a specific Zoho Mail account (the authenticated user's own inbox).",
      input: {
        accountId: "string — from readMailAccounts()",
        limit: "int, default 5",
      },
      output: { messages: "array of { messageId, subject, fromAddress, receivedTime, summary }" },
    },
    readOrgMailMessages: {
      description: "Admin: read recent messages from any org user's inbox. Requires ZohoMail.organization.accounts.messages.ALL scope.",
      input: {
        orgId: "string — Zoho Mail org ID (42602433 for bosterbio.com)",
        accountKey: "string — target user's email address or accountId",
        limit: "int, default 5",
      },
      output: { messages: "array of { messageId, subject, fromAddress, receivedTime }" },
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

export async function readOrgMailMessagesAction(a, b) {
  const raw = normalizeInput(a, b);
  const orgId = String(raw.orgId ?? "").trim();
  const accountKey = String(raw.accountKey ?? "").trim();
  const limit = Number(raw.limit ?? 5);

  if (!orgId) return skillActionErr('"orgId" is required (e.g. "42602433" for bosterbio.com).');
  if (!accountKey) return skillActionErr('"accountKey" is required (user email or accountId).');

  try {
    const messages = await readOrgMailMessages(orgId, accountKey, { limit });
    return skillActionOk({ messages });
  } catch (e) {
    return skillActionErr(e instanceof Error ? e.message : String(e));
  }
}

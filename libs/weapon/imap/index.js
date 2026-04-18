/**
 * IMAP weapon — read email from IMAP mailboxes via imapflow.
 *
 * Credentials stored in env_vars as IMAP_ACCOUNTS (JSON map of email → password)
 * or IMAP_SERVER / IMAP_PORT for server overrides.
 *
 * Default server: imappro.zoho.com:993 (Zoho Mail Pro)
 */
import { ImapFlow } from "imapflow";
import { database } from "@/libs/council/database";

const DEFAULT_SERVER = "imappro.zoho.com";
const DEFAULT_PORT = 993;

// ---------------------------------------------------------------------------
// Credential loading
// ---------------------------------------------------------------------------

/**
 * Load IMAP accounts from env_vars or process.env.
 * Returns map of { email: password }.
 */
async function loadAccounts(userId) {
  // Try user profile env_vars first
  if (userId) {
    try {
      const db = await database.init("service");
      const { data } = await db.from("profiles").select("env_vars").eq("id", userId).single();
      const raw = data?.env_vars?.IMAP_ACCOUNTS;
      if (raw) return JSON.parse(raw);
    } catch { /* fall through */ }
  }
  // Fall back to process.env
  if (process.env.IMAP_ACCOUNTS) {
    return JSON.parse(process.env.IMAP_ACCOUNTS);
  }
  return {};
}

function getServer(userId) {
  return {
    host: process.env.IMAP_SERVER ?? DEFAULT_SERVER,
    port: Number(process.env.IMAP_PORT ?? DEFAULT_PORT),
  };
}

// ---------------------------------------------------------------------------
// Core
// ---------------------------------------------------------------------------

/**
 * Open an IMAP connection, run callback, then close.
 */
async function withClient(email, password, fn) {
  const { host, port } = getServer();
  const client = new ImapFlow({
    host,
    port,
    secure: true,
    auth: { user: email, pass: password },
    logger: false,
  });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.logout();
  }
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/**
 * Read recent messages from an IMAP inbox.
 * @param {{ email: string, limit?: number, folder?: string }} input
 * @param {string} [userId]
 */
export async function readMessages({ email, limit = 5, folder = "INBOX" } = {}, userId) {
  if (!email) throw new Error('"email" is required');

  const accounts = await loadAccounts(userId);
  const password = accounts[email];
  if (!password) throw new Error(`No IMAP credentials found for ${email}. Add to IMAP_ACCOUNTS env var.`);

  return withClient(email, password, async (client) => {
    const lock = await client.getMailboxLock(folder);
    try {
      const total = client.mailbox.exists;
      const start = Math.max(1, total - limit + 1);
      const messages = [];
      for await (const msg of client.fetch(`${start}:${total}`, {
        envelope: true,
        flags: true,
      })) {
        messages.push({
          uid: msg.uid,
          subject: msg.envelope.subject ?? "(no subject)",
          from: msg.envelope.from?.[0]?.address ?? "",
          date: msg.envelope.date?.toISOString() ?? null,
          seen: msg.flags.has("\\Seen"),
        });
      }
      return messages.reverse(); // newest first
    } finally {
      lock.release();
    }
  });
}

/**
 * List all IMAP accounts currently configured.
 * @param {string} [userId]
 */
export async function searchAccounts(input = {}, userId) {
  const accounts = await loadAccounts(userId);
  return Object.keys(accounts).map((email) => ({ email }));
}

/**
 * Test connectivity for a single account.
 * @param {{ email: string }} input
 * @param {string} [userId]
 */
export async function checkCredentials({ email } = {}, userId) {
  const accounts = await loadAccounts(userId);
  if (email) {
    const password = accounts[email];
    if (!password) return { ok: false, msg: `No credentials for ${email}` };
    try {
      await withClient(email, password, async (client) => {
        await client.getMailboxLock("INBOX").then((l) => l.release());
      });
      return { ok: true, msg: `Connected to ${email}` };
    } catch (e) {
      return { ok: false, msg: e.message };
    }
  }
  // Test all
  const results = [];
  for (const [acct, password] of Object.entries(accounts)) {
    try {
      await withClient(acct, password, async (client) => {
        await client.getMailboxLock("INBOX").then((l) => l.release());
      });
      results.push({ email: acct, ok: true });
    } catch (e) {
      results.push({ email: acct, ok: false, error: e.message });
    }
  }
  return { results };
}

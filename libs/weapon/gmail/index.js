/**
 * Gmail weapon — Google Gmail API connector via OAuth2 refresh token.
 * Auth: GOOGLE_ID + GOOGLE_SECRET + GOOGLE_REFRESH_TOKEN
 *       Read from profiles.env_vars first, falls back to process.env.
 */

export const toc = {
  searchMessages: "Search Gmail messages using a query string.",
  readMessage: "Read a Gmail message with full body content.",
  writeMessageLabels: "Add or remove labels on Gmail messages.",
  starMessage: "Star a single Gmail message.",
  starMessages: "Star multiple Gmail messages.",
  readProfile: "Read the authenticated user's Gmail profile.",
  searchLabels: "Search Gmail labels for the authenticated user.",
};
import { getGoogleCredentials } from "@/libs/council/profileEnvVars";

const GMAIL_API = "https://www.googleapis.com/gmail/v1";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

async function resolveUserId(explicit) {
  if (explicit) return explicit;
  try {
    const { getAdventurerExecutionUserId } = await import("@/libs/adventurer/advance.js");
    const ctxId = getAdventurerExecutionUserId();
    if (ctxId) return ctxId;
  } catch { /* not in adventurer context */ }
  const { requireUser } = await import("@/libs/council/auth/server");
  const user = await requireUser();
  return user.id;
}

/**
 * Exchange refresh token for a fresh access token.
 */
async function getAccessToken(userId) {
  const creds = await getGoogleCredentials(userId);
  const { clientId, clientSecret, refreshToken } = creds;
  if (!clientId)    throw new Error("Missing GOOGLE_ID in profiles.env_vars or process.env.");
  if (!clientSecret) throw new Error("Missing GOOGLE_SECRET in profiles.env_vars or process.env.");
  if (!refreshToken) throw new Error("Missing GOOGLE_REFRESH_TOKEN in profiles.env_vars or process.env.");

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gmail token refresh failed (${res.status}): ${text.slice(0, 300)}`);
  }
  const data = await res.json();
  return data.access_token;
}

async function gmailFetch(path, opts = {}, userId) {
  const token = await getAccessToken(userId);
  const url = path.startsWith("http") ? path : `${GMAIL_API}${path}`;
  const res = await fetch(url, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...opts.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gmail API ${res.status}: ${body.slice(0, 500)}`);
  }
  return res.json();
}

// --------------- Public API ---------------

/**
 * Search messages by Gmail query string.
 * @param {{ query: string, limit?: number }} input
 * @param {string} [userId]
 * @returns {Promise<Array<{ id, threadId, snippet, from, subject, date, labelIds }>>}
 */
export async function searchMessages({ query, limit = 50 } = {}, userId) {
  if (!query) throw new Error("query is required");
  const uid = await resolveUserId(userId);
  const n = Math.max(1, Math.min(Number(limit) || 50, 500));

  let allMessages = [];
  let pageToken = null;
  while (allMessages.length < n) {
    const batchSize = Math.min(n - allMessages.length, 100);
    let path = `/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${batchSize}`;
    if (pageToken) path += `&pageToken=${encodeURIComponent(pageToken)}`;
    const result = await gmailFetch(path, {}, uid);
    const messages = result.messages || [];
    allMessages.push(...messages);
    pageToken = result.nextPageToken;
    if (!pageToken || messages.length === 0) break;
  }
  allMessages = allMessages.slice(0, n);
  if (allMessages.length === 0) return [];

  const details = [];
  const BATCH = 50;
  for (let i = 0; i < allMessages.length; i += BATCH) {
    const batch = allMessages.slice(i, i + BATCH);
    const results = await Promise.all(
      batch.map((m) =>
        gmailFetch(
          `/users/me/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
          {},
          uid,
        ),
      ),
    );
    for (const msg of results) {
      const headers = msg.payload?.headers || [];
      const getHeader = (name) =>
        headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || "";
      details.push({
        id: msg.id,
        threadId: msg.threadId,
        snippet: msg.snippet || "",
        from: getHeader("From"),
        subject: getHeader("Subject"),
        date: getHeader("Date"),
        labelIds: msg.labelIds || [],
      });
    }
  }
  return details;
}

/**
 * Read a single message with full body.
 * @param {{ messageId: string }} input
 * @param {string} [userId]
 */
export async function readMessage({ messageId } = {}, userId) {
  if (!messageId) throw new Error("messageId is required");
  const uid = await resolveUserId(userId);
  return gmailFetch(`/users/me/messages/${encodeURIComponent(messageId)}?format=full`, {}, uid);
}

/**
 * Modify message labels.
 * @param {{ messageId: string, addLabelIds?: string[], removeLabelIds?: string[] }} input
 * @param {string} [userId]
 */
export async function writeMessageLabels({ messageId, addLabelIds = [], removeLabelIds = [] } = {}, userId) {
  if (!messageId) throw new Error("messageId is required");
  const uid = await resolveUserId(userId);
  return gmailFetch(
    `/users/me/messages/${encodeURIComponent(messageId)}/modify`,
    { method: "POST", body: JSON.stringify({ addLabelIds, removeLabelIds }) },
    uid,
  );
}

/**
 * Star a single message.
 * @param {{ messageId: string }} input
 * @param {string} [userId]
 */
export async function starMessage({ messageId } = {}, userId) {
  return writeMessageLabels({ messageId, addLabelIds: ["STARRED"] }, userId);
}

/**
 * Batch-star multiple messages.
 * @param {{ messageIds: string[] }} input
 * @param {string} [userId]
 */
export async function starMessages({ messageIds } = {}, userId) {
  if (!Array.isArray(messageIds) || messageIds.length === 0) return { ok: true, starred: 0 };
  const uid = await resolveUserId(userId);
  const token = await getAccessToken(uid);
  const res = await fetch(`${GMAIL_API}/users/me/messages/batchModify`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ ids: messageIds, addLabelIds: ["STARRED"] }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gmail batchModify failed (${res.status}): ${text.slice(0, 500)}`);
  }
  return { ok: true, starred: messageIds.length };
}

/**
 * Get Gmail profile.
 * @param {string} [userId]
 */
export async function readProfile(userId) {
  const uid = await resolveUserId(userId);
  return gmailFetch("/users/me/profile", {}, uid);
}

/**
 * List all Gmail labels.
 * @param {string} [userId]
 */
export async function searchLabels(userId) {
  const uid = await resolveUserId(userId);
  return gmailFetch("/users/me/labels", {}, uid);
}

/**
 * Check credentials without making external calls.
 * @param {string} [userId]
 */
export async function checkCredentials(userId) {
  try {
    const uid = await resolveUserId(userId);
    const creds = await getGoogleCredentials(uid);
    const missing = [];
    if (!creds.clientId)    missing.push("GOOGLE_ID");
    if (!creds.clientSecret) missing.push("GOOGLE_SECRET");
    if (!creds.refreshToken) missing.push("GOOGLE_GMAIL_REFRESH_TOKEN");
    if (missing.length > 0) {
      return { ok: false, msg: `Missing: ${missing.join(", ")} — visit /api/weapon/gmail?action=connect to authorize.` };
    }
    return { ok: true, msg: "Gmail credentials present (GOOGLE_ID, GOOGLE_SECRET, GOOGLE_GMAIL_REFRESH_TOKEN)." };
  } catch (e) {
    return { ok: false, msg: `Error: ${e.message}` };
  }
}

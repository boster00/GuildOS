/**
 * Telnyx weapon — REST wrapper for the Telnyx programmable-voice / PBX platform.
 *
 * Auth: TELNYX_API_KEY (Bearer) read from profiles.env_vars, fall back to process.env.
 *
 * Optional MCP layer: Telnyx ships an official local MCP server
 * (github.com/team-telnyx/telnyx-mcp-server) runnable via `uvx`. Register it in
 * `~/.claude.json` mcpServers under this project if/when the agent should drive
 * Telnyx via tool calls instead of inline JS. The REST functions below are the
 * primary GuildOS surface — MCP is additive, not required.
 */

export const toc = {
  readBalance: "Read the Telnyx account balance and available credit.",
  searchAvailableNumbers: "Search purchasable DIDs by area code, type, and required features.",
  readNumbers: "Read phone numbers owned by this account.",
  writeNumber: "Purchase a phone number (creates a number order).",
  readOrder: "Read a number order by id (poll status after writeNumber).",
  sendMessage: "Send an SMS from an owned number.",
};
import { database } from "@/libs/council/database";

const BASE = "https://api.telnyx.com/v2";

async function loadKey(userId) {
  if (userId) {
    try {
      const db = await database.init("service");
      const { data } = await db.from("profiles").select("env_vars").eq("id", userId).single();
      const k = data?.env_vars?.TELNYX_API_KEY;
      if (k) return k;
    } catch { /* fall through */ }
  }
  return process.env.TELNYX_API_KEY || null;
}

async function request(path, key, { method = "GET", query, body } = {}) {
  const url = new URL(`${BASE}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null) continue;
      if (Array.isArray(v)) v.forEach((x) => url.searchParams.append(k, String(x)));
      else url.searchParams.set(k, String(v));
    }
  }
  const res = await fetch(url.toString(), {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const json = text ? (() => { try { return JSON.parse(text); } catch { return text; } })() : null;
  if (!res.ok) throw new Error(`Telnyx ${method} ${path} failed (${res.status}): ${typeof json === "string" ? json : JSON.stringify(json)}`);
  return json;
}

export async function readBalance(input = {}, userId) {
  const key = await loadKey(userId);
  if (!key) throw new Error("TELNYX_API_KEY not set");
  return request("/balance", key);
}

/**
 * @param {{ areaCode?: string, country?: string, type?: "local"|"toll-free"|"national"|"mobile", features?: string[], limit?: number }} input
 *   features: any of voice|sms|mms|fax|emergency|hd_voice
 */
export async function searchAvailableNumbers(input = {}, userId) {
  const key = await loadKey(userId);
  if (!key) throw new Error("TELNYX_API_KEY not set");
  const { areaCode, country = "US", type = "local", features = ["voice"], limit = 10 } = input;
  return request("/available_phone_numbers", key, {
    query: {
      "filter[country_code]": country,
      "filter[phone_number_type]": type,
      ...(areaCode ? { "filter[national_destination_code]": areaCode } : {}),
      "filter[features][]": features,
      "filter[limit]": limit,
    },
  });
}

export async function readNumbers({ limit = 50 } = {}, userId) {
  const key = await loadKey(userId);
  if (!key) throw new Error("TELNYX_API_KEY not set");
  return request("/phone_numbers", key, { query: { "page[size]": limit } });
}

/**
 * Purchase a phone number. Pass exactly one E.164 number (e.g. "+15109732439").
 * Returns the number_order; poll readOrder(id) to confirm status === "success".
 */
export async function writeNumber({ phoneNumber }, userId) {
  if (!phoneNumber) throw new Error('"phoneNumber" is required');
  const key = await loadKey(userId);
  if (!key) throw new Error("TELNYX_API_KEY not set");
  return request("/number_orders", key, {
    method: "POST",
    body: { phone_numbers: [{ phone_number: phoneNumber }] },
  });
}

export async function readOrder({ orderId }, userId) {
  if (!orderId) throw new Error('"orderId" is required');
  const key = await loadKey(userId);
  if (!key) throw new Error("TELNYX_API_KEY not set");
  return request(`/number_orders/${orderId}`, key);
}

export async function sendMessage({ from, to, text, messagingProfileId }, userId) {
  if (!from || !to || !text) throw new Error('"from", "to", "text" are required');
  const key = await loadKey(userId);
  if (!key) throw new Error("TELNYX_API_KEY not set");
  return request("/messages", key, {
    method: "POST",
    body: {
      from,
      to,
      text,
      ...(messagingProfileId ? { messaging_profile_id: messagingProfileId } : {}),
    },
  });
}

export async function checkCredentials(input = {}, userId) {
  const key = await loadKey(userId);
  if (!key) return { ok: false, msg: "TELNYX_API_KEY not set in profiles.env_vars or process.env" };
  try {
    const balance = await request("/balance", key);
    return { ok: true, msg: `Telnyx OK — balance ${balance?.data?.available_credit} ${balance?.data?.currency}` };
  } catch (e) {
    return { ok: false, msg: e.message };
  }
}

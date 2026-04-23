/**
 * Miro weapon — board read/write via MCP (local Guildmaster) or REST API (cloud agents).
 *
 * PRIMARY access path (local Guildmaster only):
 *   MCP tools with prefix: mcp__731443b8-24d3-441e-b289-c7d20ca73d44__
 *   No credentials needed — uses the logged-in Miro session in Claude's MCP connection.
 *
 * SECONDARY access path (cloud agents):
 *   Miro REST API v2 — requires MIRO_ACCESS_TOKEN (personal access token or OAuth).
 *   Create one at: https://miro.com/app/settings/user-profile/ → Apps → "Your apps" → token.
 *
 * MCP tool reference:
 *   board_list_items(miro_url, limit, item_type?, cursor?) — paginated item list
 *   context_explore(miro_url)                             — list frames/tables/docs/diagrams
 *   context_get(miro_url)                                 — board overview or item detail
 *   doc_create(miro_url?, content?, x?, y?)               — create a doc on the board
 *   doc_get(miro_url_with_widget)                         — read doc markdown content
 *   doc_update(miro_url_with_widget, old_content, new_content, replace_all?) — find-replace in doc
 *   table_create(table_title, columns, miro_url?, x?, y?) — create a table
 *   table_list_rows(miro_url_with_widget, filter_by?, limit?, next_cursor?) — read table rows
 *   table_sync_rows(miro_url_with_widget, rows)           — add/update rows
 *   diagram_create(...)                                   — create a diagram
 *   diagram_get_dsl(miro_url_with_widget)                 — get diagram DSL
 *   image_get_url(miro_url_with_widget)                   — get image URL
 *
 * Usage (local — call MCP tools directly, no import needed):
 *   mcp__731443b8-24d3-441e-b289-c7d20ca73d44__board_list_items({
 *     miro_url: "https://miro.com/app/board/uXjVGg3gNx8=/",
 *     limit: 50,
 *     item_type: "sticky_note"
 *   })
 *
 * Usage (cloud — REST API):
 *   import { readItems, readBoard } from "@/libs/weapon/miro";
 *   const items = await readItems({ boardId: "uXjVGg3gNx8=", type: "sticky_note" });
 */

const MIRO_API = "https://api.miro.com/v2";

function headers() {
  const token = process.env.MIRO_ACCESS_TOKEN;
  if (!token) throw new Error("MIRO_ACCESS_TOKEN not set — local Guildmaster should use MCP tools directly instead of this weapon.");
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
}

async function apiGet(path, params = {}) {
  const url = new URL(`${MIRO_API}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v != null) url.searchParams.set(k, String(v));
  }
  const res = await fetch(url.toString(), { headers: headers() });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: json.message || res.statusText, data: null };
  return { ok: true, data: json.data ?? json, cursor: json.cursor ?? null };
}

async function apiPatch(path, body) {
  const res = await fetch(`${MIRO_API}${path}`, {
    method: "PATCH",
    headers: headers(),
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: json.message || res.statusText };
  return { ok: true, data: json };
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/**
 * List items on a board, paginating through all pages automatically.
 * @param {{ boardId: string, type?: string, limit?: number }} input
 * type: sticky_note | card | frame | shape | text | image | embed | document | app_card
 */
export async function readItems({ boardId, type, limit = 50 } = {}) {
  const items = [];
  let cursor = null;
  do {
    const params = { limit, ...(type ? { type } : {}), ...(cursor ? { cursor } : {}) };
    const { ok, data, cursor: next, error } = await apiGet(`/boards/${encodeURIComponent(boardId)}/items`, params);
    if (!ok) return { ok: false, error, items };
    items.push(...(data || []));
    cursor = next || null;
  } while (cursor);
  return { ok: true, items };
}

/**
 * Read a single item by ID.
 */
export async function readItem({ boardId, itemId } = {}) {
  return apiGet(`/boards/${encodeURIComponent(boardId)}/items/${itemId}`);
}

/**
 * Get board metadata.
 */
export async function readBoard({ boardId } = {}) {
  return apiGet(`/boards/${encodeURIComponent(boardId)}`);
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

/**
 * Update a sticky note's position and/or color.
 * @param {{ boardId: string, itemId: string, x?: number, y?: number, color?: string }} input
 * color: gray | light_yellow | yellow | orange | light_green | green | dark_green |
 *        cyan | light_pink | pink | violet | red | light_blue | blue
 */
export async function updateStickyNote({ boardId, itemId, x, y, color } = {}) {
  const body = {};
  if (x != null || y != null) body.position = { ...(x != null ? { x } : {}), ...(y != null ? { y } : {}) };
  if (color) body.style = { fillColor: color };
  return apiPatch(`/boards/${encodeURIComponent(boardId)}/sticky_notes/${itemId}`, body);
}

/**
 * Create a sticky note on a board.
 * @param {{ boardId: string, content: string, x: number, y: number, color?: string, width?: number }} input
 */
export async function createStickyNote({ boardId, content, x, y, color, width = 200 } = {}) {
  const res = await fetch(`${MIRO_API}/boards/${encodeURIComponent(boardId)}/sticky_notes`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      data: { content, shape: "square" },
      style: { fillColor: color || "light_yellow" },
      position: { x, y },
      geometry: { width },
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: json.message || res.statusText };
  return { ok: true, data: json };
}

// ---------------------------------------------------------------------------
// Credential check
// ---------------------------------------------------------------------------

export async function checkCredentials() {
  const token = process.env.MIRO_ACCESS_TOKEN;
  if (!token) {
    return {
      ok: true,
      msg: "No MIRO_ACCESS_TOKEN — Miro is available via MCP tools (local Guildmaster only). Set token for cloud agent access.",
    };
  }
  const res = await apiGet("/boards?limit=1");
  if (!res.ok) return { ok: false, msg: `MIRO_ACCESS_TOKEN set but API returned: ${res.error}` };
  return { ok: true, msg: "MIRO_ACCESS_TOKEN valid — REST API and MCP both available." };
}

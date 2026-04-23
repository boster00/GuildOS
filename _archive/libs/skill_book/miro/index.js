/**
 * Miro skill book — read and write Miro boards.
 *
 * ACCESS:
 *   Local Guildmaster: use MCP tools directly (mcp__731443b8-24d3-441e-b289-c7d20ca73d44__*).
 *     No token needed. Full capabilities: list items, read board, create/update docs,
 *     create/read/sync tables, explore board structure.
 *   Cloud agents: use libs/weapon/miro via MIRO_ACCESS_TOKEN (REST API).
 *
 * MCP tool cheat sheet (local use):
 *
 *   EXPLORE / READ
 *     context_explore(miro_url)                  — list frames, tables, docs, diagrams on board
 *     context_get(miro_url)                      — board overview (plain URL) or item detail (with moveToWidget=<id>)
 *     board_list_items(miro_url, limit, item_type?) — paginated list; item_type: sticky_note, card, frame, shape, text, image
 *
 *   DOCS
 *     doc_create(content, miro_url?, x?, y?)     — create a markdown doc on the board
 *     doc_get(miro_url+?moveToWidget=<id>)       — read doc as markdown
 *     doc_update(miro_url+widget, old, new, replace_all?) — find-replace content in a doc
 *
 *   TABLES
 *     table_create(table_title, columns, miro_url?, x?, y?) — create table with text/select columns
 *     table_list_rows(miro_url+widget, filter_by?, limit?) — read rows; filter_by targets select columns
 *     table_sync_rows(miro_url+widget, rows)     — add rows (no rowId) or update rows (with rowId)
 *
 *   DIAGRAMS / IMAGES
 *     diagram_get_dsl(miro_url+widget)           — get diagram DSL text
 *     image_get_url(miro_url+widget)             — get image URL
 *
 * Board URL format:
 *   Plain:           https://miro.com/app/board/uXjVGg3gNx8=/
 *   With item:       https://miro.com/app/board/uXjVGg3gNx8=/?moveToWidget=<itemId>
 */

import { skillActionOk, skillActionErr } from "@/libs/skill_book/actionResult.js";
import { readItems, readBoard, updateStickyNote, createStickyNote, checkCredentials } from "@/libs/weapon/miro";

export const skillBook = {
  id: "miro",
  title: "Miro",
  description: "Read and write Miro boards — stickies, docs, tables, diagrams. Local access via MCP; cloud access via REST API.",
  steps: [],
  toc: {
    readBoard: {
      description: "Get an overview of a Miro board — its items, structure, frames, and high-level content summary. Local: use context_explore + context_get MCP tools. Cloud: reads board metadata via REST API.",
      input: {
        board_id: "string — board ID from the URL (e.g. 'uXjVGg3gNx8=')",
        miro_url: "string — full board URL (alternative to board_id)",
      },
      output: {
        board: "object with id, name, description, item counts",
      },
    },
    readItems: {
      description: "List all items on a board, optionally filtered by type. Returns positions, content, and colors. Local: use board_list_items MCP tool. Cloud: uses REST API.",
      input: {
        board_id: "string — board ID",
        miro_url: "string — full board URL",
        item_type: "string (optional) — sticky_note | card | frame | shape | text | image | embed | document | app_card",
        limit: "number (optional, default 50) — items per page",
      },
      output: {
        items: "array of item objects with id, type, position {x,y}, geometry, data (content, text), style (fillColor)",
      },
    },
    moveStickyNotes: {
      description: "Reposition sticky notes on a board. Provide an array of {id, x, y} moves. For color regrouping, also pass color. Cloud agents: calls updateStickyNote REST API. Local: may use MCP or REST depending on scope.",
      input: {
        board_id: "string — board ID",
        moves: "array of { id: string, x: number, y: number, color?: string }",
      },
      output: {
        results: "array of { id, ok, error? }",
      },
    },
    readDoc: {
      description: "Read the markdown content of a doc on a board. Local: use doc_get MCP tool with moveToWidget URL. Cloud: not supported via REST (MCP only).",
      input: {
        miro_url: "string — item URL with ?moveToWidget=<itemId>",
      },
      output: {
        content: "string — markdown text of the document",
        version: "number — content version for use in updates",
      },
    },
    writeDoc: {
      description: "Create a new doc on a Miro board. Local: use doc_create MCP tool. Cloud: not supported via REST.",
      input: {
        miro_url: "string — board URL",
        content: "string — markdown content (# headings, **bold**, *italic*, lists, links)",
        x: "number (optional) — x position",
        y: "number (optional) — y position",
      },
      output: {
        item: "created doc item object",
      },
    },
    updateDoc: {
      description: "Find and replace content inside an existing board doc. Local: use doc_update MCP tool.",
      input: {
        miro_url: "string — item URL with ?moveToWidget=<itemId>",
        old_content: "string — exact text to find",
        new_content: "string — replacement text",
        replace_all: "boolean (optional, default false) — replace all occurrences",
      },
      output: {
        ok: "boolean",
      },
    },
    createTable: {
      description: "Create a table on a Miro board with specified columns. Supports text and select (dropdown) column types. Local: use table_create MCP tool.",
      input: {
        miro_url: "string — board URL",
        table_title: "string — table name",
        columns: "array of { column_type: 'text'|'select', column_title: string, options?: [{displayValue, color}] }",
        x: "number (optional)",
        y: "number (optional)",
      },
      output: {
        table: "created table item object with id",
      },
    },
    readTable: {
      description: "Read rows from a Miro table, with optional filtering on select columns. Local: use table_list_rows MCP tool.",
      input: {
        miro_url: "string — item URL with ?moveToWidget=<tableId>",
        filter_by: "object (optional) — { ColumnName: ['value1', 'value2'] } for select columns only",
        limit: "number (optional, default 10)",
        next_cursor: "string (optional) — pagination cursor from previous call",
      },
      output: {
        rows: "array of { rowId, cells: [{ columnTitle, valueType, content, options }] }",
        next_cursor: "string | null",
      },
    },
    syncTable: {
      description: "Add new rows or update existing rows in a Miro table. Include rowId to update; omit to insert. Local: use table_sync_rows MCP tool.",
      input: {
        miro_url: "string — item URL with ?moveToWidget=<tableId>",
        rows: "array of { rowId?: string, cells: [{ columnTitle: string, value: string }] }",
      },
      output: {
        ok: "boolean",
      },
    },
  },
};

// ---------------------------------------------------------------------------
// Executable actions (cloud / REST API path)
// ---------------------------------------------------------------------------

function normalizePayload(a, b) {
  return b !== undefined && typeof b === "object" && b !== null && !Array.isArray(b)
    ? b
    : a !== undefined && typeof a === "object" && a !== null && !Array.isArray(a)
      ? a
      : {};
}

export async function readBoard(a, b) {
  const { board_id, miro_url } = normalizePayload(a, b);
  const id = board_id || miro_url?.match(/board\/([^/?]+)/)?.[1];
  if (!id) return skillActionErr("readBoard: board_id or miro_url required.");
  const { ok, data, error } = await readBoard({ boardId: id });
  if (!ok) return skillActionErr(error);
  return skillActionOk({ board: data });
}

export async function readItems(a, b) {
  const { board_id, miro_url, item_type, limit } = normalizePayload(a, b);
  const id = board_id || miro_url?.match(/board\/([^/?]+)/)?.[1];
  if (!id) return skillActionErr("readItems: board_id or miro_url required.");
  const { ok, items, error } = await readItems({ boardId: id, type: item_type, limit });
  if (!ok) return skillActionErr(error);
  return skillActionOk({ items });
}

export async function moveStickyNotes(a, b) {
  const { board_id, miro_url, moves } = normalizePayload(a, b);
  const id = board_id || miro_url?.match(/board\/([^/?]+)/)?.[1];
  if (!id) return skillActionErr("moveStickyNotes: board_id or miro_url required.");
  if (!Array.isArray(moves) || moves.length === 0) return skillActionErr("moveStickyNotes: moves array required.");
  const results = [];
  for (const move of moves) {
    const { ok, error } = await updateStickyNote({ boardId: id, itemId: move.id, x: move.x, y: move.y, color: move.color });
    results.push({ id: move.id, ok, error: error ?? null });
  }
  return skillActionOk({ results });
}

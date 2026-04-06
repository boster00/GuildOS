/**
 * MCP server — Zoho Books
 *
 * Credentials (add to .env.local):
 *   ZOHO_MCP_ACCESS_TOKEN    your current Zoho access token
 *   ZOHO_MCP_ORGANIZATION_ID your Zoho Books organization ID
 *   ZOHO_MCP_REGION          com | eu | in | com_au | jp  (default: com)
 *
 * Run standalone:
 *   node mcp/zoho-server.mjs
 *
 * Or let Claude Code manage it via .claude/settings.local.json mcpServers.
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// ---------------------------------------------------------------------------
// Load .env.local from project root (best-effort — no crash if missing)
// ---------------------------------------------------------------------------
const __dirname = dirname(fileURLToPath(import.meta.url));
try {
  const envPath = resolve(__dirname, "../.env.local");
  const lines = readFileSync(envPath, "utf8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (key && !(key in process.env)) process.env[key] = val;
  }
} catch {
  // .env.local not found — rely on process.env already being set
}

// ---------------------------------------------------------------------------
// Zoho API helpers
// ---------------------------------------------------------------------------
const ZOHO_API_BASE = {
  com: "https://www.zohoapis.com",
  eu: "https://www.zohoapis.eu",
  in: "https://www.zohoapis.in",
  com_au: "https://www.zohoapis.com.au",
  jp: "https://www.zohoapis.jp",
};

function getCredentials() {
  const accessToken = process.env.ZOHO_MCP_ACCESS_TOKEN;
  const organizationId = process.env.ZOHO_MCP_ORGANIZATION_ID;
  const region = (process.env.ZOHO_MCP_REGION || "com").trim();
  return { accessToken, organizationId, region };
}

async function fetchSalesOrders(limit = 5) {
  const { accessToken, organizationId, region } = getCredentials();

  if (!accessToken) throw new Error("ZOHO_MCP_ACCESS_TOKEN is not set in .env.local");
  if (!organizationId) throw new Error("ZOHO_MCP_ORGANIZATION_ID is not set in .env.local");

  const baseUrl = ZOHO_API_BASE[region] || ZOHO_API_BASE.com;
  const url = new URL(`${baseUrl}/books/v3/salesorders`);
  url.searchParams.set("organization_id", organizationId);
  url.searchParams.set("per_page", String(Math.max(1, Math.min(200, limit))));
  url.searchParams.set("sort_column", "date");
  url.searchParams.set("sort_order", "D");

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Zoho API ${res.status}: ${text.slice(0, 400)}`);
  }

  const json = await res.json();
  return json.salesorders ?? [];
}

// ---------------------------------------------------------------------------
// MCP server
// ---------------------------------------------------------------------------
const server = new Server(
  { name: "zoho-books", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "get_sales_orders",
      description: "Fetch the latest sales orders from Zoho Books, sorted newest first.",
      inputSchema: {
        type: "object",
        properties: {
          limit: {
            type: "number",
            description: "Number of records to return (1–200, default 5).",
            default: 5,
          },
        },
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name !== "get_sales_orders") {
    throw new Error(`Unknown tool: ${request.params.name}`);
  }

  const limit = Number(request.params.arguments?.limit ?? 5);

  try {
    const orders = await fetchSalesOrders(limit);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(orders, null, 2),
        },
      ],
    };
  } catch (err) {
    return {
      content: [{ type: "text", text: `Error: ${err.message}` }],
      isError: true,
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);

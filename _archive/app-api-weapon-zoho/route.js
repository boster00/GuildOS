/**
 * Zoho Books weapon — single route; triage via ?action=
 * connect | callback | status | salesOrders (dev diagnostic trace)
 */
import { handleZohoCallback } from "./handleCallback.js";
import { handleZohoConnect } from "./handleConnect.js";
import { handleZohoSalesOrdersDiagnostic } from "./handleSalesOrdersDiagnostic.js";
import { handleZohoScrap } from "./handleScrap.js";
import { handleZohoStatus } from "./handleStatus.js";

const VALID = ["connect", "callback", "status", "salesOrders"];

export async function POST(request) {
  const action = request.nextUrl.searchParams.get("action");
  if (action === "scrap") return handleZohoScrap();
  return Response.json({ error: "Missing or invalid action", validPostActions: ["scrap"] }, { status: 400 });
}

export async function GET(request) {
  const action = request.nextUrl.searchParams.get("action");

  if (!action || !VALID.includes(action)) {
    return Response.json(
      {
        error: "Missing or invalid action",
        validActions: VALID,
        examples: [
          "/api/weapon/zoho?action=connect",
          "/api/weapon/zoho?action=status",
          "/api/weapon/zoho?action=salesOrders",
        ],
      },
      { status: 400 }
    );
  }

  if (action === "connect") return handleZohoConnect(request);
  if (action === "callback") return handleZohoCallback(request);
  if (action === "status") return handleZohoStatus();
  if (action === "salesOrders") return handleZohoSalesOrdersDiagnostic(request);

  return Response.json({ error: "Unhandled action" }, { status: 500 });
}

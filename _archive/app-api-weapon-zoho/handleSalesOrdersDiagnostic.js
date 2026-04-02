import { requireUser } from "@/libs/council/auth/server";
import {
  createZohoDiagnostics,
  fetchZohoSalesOrders,
  summarizeZohoFailure,
  ZohoWeaponError,
  zohoErrorToJsonPayload,
} from "@/libs/weapon/zoho";

const LOG_FILE = "app/api/weapon/zoho/handleSalesOrdersDiagnostic.js";

/**
 * Dev / DevSteps step 10: full trace through libs/weapon/zoho → same code path as production fetch.
 */
export async function handleZohoSalesOrdersDiagnostic(request) {
  const diagnostics = createZohoDiagnostics();

  let user;
  try {
    user = await requireUser();
  } catch {
    diagnostics.push({
      file: LOG_FILE,
      fn: "handleZohoSalesOrdersDiagnostic",
      phase: "auth",
      level: "error",
      message: "requireUser() failed — no session (libs/council/auth/server.js → requireUser)",
    });
    return Response.json(
      {
        ok: false,
        error: "UNAUTHORIZED",
        code: "UNAUTHORIZED",
        log: diagnostics.entries,
        failureReport: summarizeZohoFailure(diagnostics, new Error("UNAUTHORIZED")),
      },
      { status: 401 }
    );
  }

  const limitParam = request.nextUrl.searchParams.get("limit");
  const parsed = limitParam ? parseInt(limitParam, 10) : 10;
  const limit = Number.isFinite(parsed) ? Math.min(50, Math.max(1, parsed)) : 10;

  diagnostics.push({
    file: LOG_FILE,
    fn: "handleZohoSalesOrdersDiagnostic",
    phase: "entry",
    level: "info",
    message: "GET /api/weapon/zoho?action=salesOrders — delegating to fetchZohoSalesOrders (libs/weapon/zoho/books.js)",
    detail: { limit, route: "app/api/weapon/zoho/route.js" },
  });

  const result = await fetchZohoSalesOrders(user.id, { limit, diagnostics });

  if (result.error) {
    const payload = zohoErrorToJsonPayload(result.error);
    const failureReport = summarizeZohoFailure(diagnostics, result.error);
    diagnostics.push({
      file: LOG_FILE,
      fn: "handleZohoSalesOrdersDiagnostic",
      phase: "exit",
      level: "error",
      message: "fetchZohoSalesOrders returned an error — inspect failureReport.suspectedSource and log level:error entries",
      detail: payload,
    });
    const status = result.error instanceof ZohoWeaponError ? 400 : 502;
    return Response.json(
      {
        ok: false,
        pass: false,
        count: 0,
        rows: [],
        ...payload,
        failureReport,
        log: diagnostics.entries,
      },
      { status }
    );
  }

  const rows = result.data;
  const pass = rows.length > 0;

  diagnostics.push({
    file: LOG_FILE,
    fn: "handleZohoSalesOrdersDiagnostic",
    phase: "exit",
    level: "info",
    message: pass
      ? `Success: ${rows.length} row(s) returned`
      : "HTTP and parsing succeeded but zero rows — check Zoho org for sales orders",
    detail: { count: rows.length },
  });

  return Response.json({
    ok: true,
    pass,
    count: rows.length,
    rows,
    log: diagnostics.entries,
    failureReport: pass
      ? null
      : {
          summary: "Zoho returned an empty salesorders list (not a transport error)",
          code: "ZOHO_EMPTY_SALES_ORDERS",
          suspectedSource:
            "libs/weapon/zoho/books.js → fetchZohoSalesOrders (Zoho org may have no orders, or API scope)",
          lastLogError: null,
        },
  });
}

import { NextResponse } from "next/server";
import { checkCredentials, listDatasets, getRecentEvents } from "@/libs/weapon/bigquery";

export async function POST(request) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === "checkCredentials") {
      return NextResponse.json(checkCredentials());
    }

    if (action === "listDatasets") {
      const datasets = await listDatasets();
      return NextResponse.json({ ok: true, datasets });
    }

    if (action === "getRecentEvents") {
      const { datasetId, tableId, limit } = body;
      const result = await getRecentEvents(datasetId, tableId, limit);
      return NextResponse.json({ ok: true, ...result });
    }

    return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

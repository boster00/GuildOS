import { NextResponse } from "next/server";
import { checkCredentials, searchDatasets, readRecentEvents } from "@/libs/weapon/bigquery";

export async function POST(request) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === "checkCredentials") {
      return NextResponse.json(checkCredentials());
    }

    if (action === "searchDatasets") {
      const datasets = await searchDatasets();
      return NextResponse.json({ ok: true, datasets });
    }

    if (action === "readRecentEvents") {
      const { datasetId, tableId, limit } = body;
      const result = await readRecentEvents(datasetId, tableId, limit);
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

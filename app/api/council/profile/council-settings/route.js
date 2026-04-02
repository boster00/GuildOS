import { requireUser } from "@/libs/council/auth/server";
import { database } from "@/libs/council/database";
import { publicTables } from "@/libs/council/publicTables";
import {
  applyDungeonMasterPatch,
  dungeonMasterForClient,
  normalizeCouncilSettings,
} from "@/libs/council/councilSettings";

function unauthorized() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

export async function GET() {
  try {
    const user = await requireUser();
    const db = await database.init("server");
    const { data, error } = await db
      .from(publicTables.profiles)
      .select("council_settings")
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({
      council_settings: {
        dungeon_master: dungeonMasterForClient(data?.council_settings),
      },
    });
  } catch (e) {
    if (e?.message === "UNAUTHORIZED") return unauthorized();
    return Response.json({ error: e?.message || String(e) }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const user = await requireUser();
    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const dm = body?.dungeon_master;
    if (!dm || typeof dm !== "object" || Array.isArray(dm)) {
      return Response.json({ error: "Provide `dungeon_master` object" }, { status: 400 });
    }

    const db = await database.init("server");
    const { data: row, error: readErr } = await db
      .from(publicTables.profiles)
      .select("council_settings")
      .eq("id", user.id)
      .maybeSingle();

    if (readErr) {
      return Response.json({ error: readErr.message }, { status: 500 });
    }

    const current = normalizeCouncilSettings(row?.council_settings);
    const { next, error: applyErr } = applyDungeonMasterPatch(current, {
      api_key: dm.api_key,
      base_url: dm.base_url,
      model_id: dm.model_id,
      clear_api_key: dm.clear_api_key === true,
    });

    if (applyErr) {
      return Response.json({ error: applyErr }, { status: 400 });
    }

    const { error: upErr } = await db
      .from(publicTables.profiles)
      .update({
        council_settings: next,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (upErr) {
      return Response.json({ error: upErr.message }, { status: 500 });
    }

    return Response.json({
      ok: true,
      council_settings: {
        dungeon_master: dungeonMasterForClient(next),
      },
    });
  } catch (e) {
    if (e?.message === "UNAUTHORIZED") return unauthorized();
    return Response.json({ error: e?.message || String(e) }, { status: 500 });
  }
}

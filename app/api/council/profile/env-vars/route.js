import { requireUser } from "@/libs/council/auth/server";
import { database } from "@/libs/council/database";
import { publicTables } from "@/libs/council/publicTables";
import {
  applyEnvVarsMutation,
  listEnvVarKeyNames,
} from "@/libs/council/profileEnvVars";

function unauthorized() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

export async function GET() {
  try {
    const user = await requireUser();
    const db = await database.init("server");
    const { data, error } = await db
      .from(publicTables.profiles)
      .select("env_vars")
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({
      keys: listEnvVarKeyNames(data?.env_vars),
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

    const set = body.set;
    const remove = body.remove;

    const hasSet = set && typeof set === "object" && !Array.isArray(set) && Object.keys(set).length > 0;
    const hasRemove = Array.isArray(remove) && remove.length > 0;

    if (!hasSet && !hasRemove) {
      return Response.json(
        { error: "Provide non-empty `set` (object) and/or `remove` (string[])" },
        { status: 400 }
      );
    }

    const db = await database.init("server");
    const { data: row, error: readErr } = await db
      .from(publicTables.profiles)
      .select("env_vars")
      .eq("id", user.id)
      .maybeSingle();

    if (readErr) {
      return Response.json({ error: readErr.message }, { status: 500 });
    }

    const current =
      row?.env_vars && typeof row.env_vars === "object" && !Array.isArray(row.env_vars) ? row.env_vars : {};

    const { next, error: applyErr } = applyEnvVarsMutation(current, {
      set: hasSet ? set : {},
      remove: hasRemove ? remove : [],
    });

    if (applyErr) {
      return Response.json({ error: applyErr }, { status: 400 });
    }

    const { error: upErr } = await db
      .from(publicTables.profiles)
      .update({
        env_vars: next,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (upErr) {
      return Response.json({ error: upErr.message }, { status: 500 });
    }

    return Response.json({
      ok: true,
      keys: listEnvVarKeyNames(next),
    });
  } catch (e) {
    if (e?.message === "UNAUTHORIZED") return unauthorized();
    return Response.json({ error: e?.message || String(e) }, { status: 500 });
  }
}

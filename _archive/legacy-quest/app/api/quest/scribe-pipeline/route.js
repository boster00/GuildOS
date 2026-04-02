import { requireUser } from "@/libs/council/auth/server";
import { createServerClient } from "@/libs/council/database";
import { runScribeQuestPipeline } from "@/libs/quest/scribeQuestPipeline.js";

function unauthorized() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

/**
 * POST JSON: `{ questId, mode?: "plan" | "execute" | "full" }` — scribe demo pipeline with structured steps log.
 */
export async function POST(request) {
  let user;
  try {
    user = await requireUser();
  } catch (e) {
    if (e?.message === "UNAUTHORIZED") return unauthorized();
    return Response.json({ error: e?.message || String(e) }, { status: 500 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const questId = typeof body?.questId === "string" ? body.questId.trim() : "";
  if (!questId) {
    return Response.json({ error: "questId is required" }, { status: 400 });
  }

  const mode = body?.mode === "execute" || body?.mode === "full" || body?.mode === "plan" ? body.mode : "full";

  const db = await createServerClient();
  const result = await runScribeQuestPipeline({ questId, userId: user.id, mode, client: db });
  return Response.json(result);
}

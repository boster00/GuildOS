import { requireUser } from "@/libs/council/auth/server";
import { database } from "@/libs/council/database";
import { runAuthenticatedCompletion } from "./runCompletion.js";

function unauthorized() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

/**
 * Generic AI chat completion (authenticated). Prefer the user’s Dungeon Master key; fall back to env `OPENAI_API_KEY`.
 *
 * POST body:
 * - `messages: [{ role, content }]` or `query: string` (single user turn).
 * - Optional: `model: string`.
 * - Optional: `json: true` or `responseFormat: "json_object"` — request JSON-only output from the model.
 * - Optional: `forceEnv: true` — skip Dungeon Master settings and use only `OPENAI_API_KEY` (legacy / debugging).
 */
export async function POST(request) {
  const db = await database.init("server");
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

  let messages = body?.messages;
  if (body?.query != null && typeof body.query === "string") {
    messages = [{ role: "user", content: body.query.trim() }];
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    return Response.json(
      { error: "Provide messages (array) or query (string)" },
      { status: 400 },
    );
  }

  const model = typeof body?.model === "string" ? body.model : undefined;
  const json =
    body?.json === true ||
    body?.responseFormat === "json_object" ||
    body?.response_format === "json_object";
  const forceEnv = body?.forceEnv === true;

  try {
    const out = await runAuthenticatedCompletion({
      userId: user.id,
      client: db,
      messages,
      model,
      json,
      forceEnv,
    });

    return Response.json({
      ok: true,
      text: out.text,
      model: out.model,
      usage: out.usage,
      userId: user.id,
      apiKeySource: out.apiKeySource,
    });
  } catch (err) {
    const msg = err?.message || String(err);
    return Response.json({ error: msg }, { status: 500 });
  }
}

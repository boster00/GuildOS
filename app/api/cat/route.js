import { requireUser } from "@/libs/council/auth/server";
import { database } from "@/libs/council/database";
import { runCommissionChat } from "@/libs/cat/commissionChat.js";

function unauthorized() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

/**
 * Thin transport for Cat (built-in assistant). Core logic lives in `libs/cat/*`.
 */
export async function POST(request) {
  const db = await database.init("server");
  const action = request.nextUrl.searchParams.get("action") || "commissionChat";

  if (action !== "commissionChat") {
    return Response.json(
      { error: "Invalid action", validActions: ["commissionChat"] },
      { status: 400 },
    );
  }

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

  const messages = body?.messages;
  if (!Array.isArray(messages)) {
    return Response.json({ error: "messages array is required" }, { status: 400 });
  }

  const { data, error } = await runCommissionChat({
    ownerId: user.id,
    messages,
    draft: body?.draft,
    client: db,
  });

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json(data);
}

/**
 * Pigeon Post — single route; triage via ?action=
 * GET pending: session cookie, or `X-Pigeon-Key` + server `PIGEON_POST_OWNER_ID`.
 * POST deliver: session or `X-Pigeon-Key` (see handler for owner checks).
 */
import { requireUser } from "@/libs/council/auth/server";
import { getPendingPigeonLetters, writePigeonLetter, searchReviewItems, writeReviewVerdict } from "@/libs/pigeon_post";
import { deliverPigeonResult } from "@/libs/weapon/pigeon";
import { getQuest } from "@/libs/quest";

const GET_ACTIONS = ["pending", "review"];
const POST_ACTIONS = ["deliver", "create", "review"];

const LOG = "[pigeon-post]";

/** Safe summary for logs (no full secrets; truncate values). */
function summarizeDeliverBody(body) {
  const items =
    body?.items && typeof body.items === "object" && !Array.isArray(body.items) ? body.items : {};
  const keys = Object.keys(items);
  const perKey = {};
  for (const k of keys) {
    const v = items[k];
    const s = v == null ? "" : typeof v === "string" ? v : JSON.stringify(v);
    perKey[k] = { length: s.length, preview: s.length > 120 ? `${s.slice(0, 120)}…` : s };
  }
  return {
    questId: body?.questId,
    letterId: body?.letterId,
    itemKeys: keys,
    perKey,
  };
}

function verifyPigeonApiKey(request) {
  const key = request.headers.get("x-pigeon-key");
  const expected = process.env.PIGEON_API_KEY;
  return Boolean(expected && key && key === expected);
}

export async function GET(request) {
  const action = request.nextUrl.searchParams.get("action");

  if (!action || !GET_ACTIONS.includes(action)) {
    return Response.json(
      { error: "Missing or invalid action", validActions: GET_ACTIONS },
      { status: 400 },
    );
  }

  const apiKeyOk = verifyPigeonApiKey(request);
  let userId = null;
  if (apiKeyOk) {
    const ownerId = process.env.PIGEON_POST_OWNER_ID;
    if (!ownerId || !String(ownerId).trim()) {
      return Response.json(
        {
          error:
            "PIGEON_POST_OWNER_ID must be set on the server when fetching pending letters with X-Pigeon-Key.",
        },
        { status: 503 },
      );
    }
    userId = String(ownerId).trim();
  } else {
    try {
      const user = await requireUser();
      userId = user.id;
    } catch {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  if (action === "pending") {
    const data = await getPendingPigeonLetters(userId);
    return Response.json(data);
  }

  if (action === "review") {
    const data = await searchReviewItems(userId);
    return Response.json(data);
  }

  return Response.json({ error: "Unhandled action" }, { status: 500 });
}

export async function POST(request) {
  const action = request.nextUrl.searchParams.get("action");

  if (!action || !POST_ACTIONS.includes(action)) {
    return Response.json(
      { error: "Missing or invalid action", validActions: POST_ACTIONS },
      { status: 400 },
    );
  }

  if (action === "deliver") {
    console.info(`${LOG} POST deliver: request received`, new Date().toISOString());

    let body;
    try {
      body = await request.json();
    } catch (e) {
      console.warn(`${LOG} POST deliver: invalid JSON`, e instanceof Error ? e.message : e);
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    console.info(`${LOG} POST deliver: body summary`, summarizeDeliverBody(body));

    const { questId, items, letterId } = body;
    if (!questId || typeof questId !== "string") {
      console.warn(`${LOG} POST deliver: rejected — missing questId`);
      return Response.json({ error: "questId is required" }, { status: 400 });
    }
    if (!items || typeof items !== "object" || Array.isArray(items) || Object.keys(items).length === 0) {
      console.warn(`${LOG} POST deliver: rejected — invalid items`, {
        type: items === null ? "null" : Array.isArray(items) ? "array" : typeof items,
        keys: items && typeof items === "object" && !Array.isArray(items) ? Object.keys(items) : [],
      });
      return Response.json({ error: "items must be a non-empty object" }, { status: 400 });
    }

    let userId = null;
    try {
      const user = await requireUser();
      userId = user.id;
    } catch {
      /* cookie auth optional if API key */
    }

    const apiKeyOk = verifyPigeonApiKey(request);
    console.info(`${LOG} POST deliver: auth`, {
      sessionUserId: userId ?? null,
      apiKeyHeaderPresent: Boolean(request.headers.get("x-pigeon-key")),
      apiKeyOk,
      pigeonKeyConfigured: Boolean(process.env.PIGEON_API_KEY),
    });

    if (!userId && !apiKeyOk) {
      console.warn(`${LOG} POST deliver: rejected — 401 no session and invalid/missing API key`);
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: quest, error: qErr } = await getQuest(questId);
    if (qErr || !quest) {
      console.warn(`${LOG} POST deliver: quest not found`, { questId, qErr: qErr?.message });
      return Response.json({ error: "Quest not found" }, { status: 404 });
    }

    console.info(`${LOG} POST deliver: quest loaded`, { questId, owner_id: quest.owner_id, stage: quest.stage });

    if (userId && quest.owner_id !== userId) {
      console.warn(`${LOG} POST deliver: rejected — 403 owner mismatch`, {
        questId,
        questOwner: quest.owner_id,
        sessionUserId: userId,
      });
      return Response.json({ error: "Not authorized for this quest" }, { status: 403 });
    }

    const lid = letterId != null && String(letterId).trim() ? String(letterId).trim() : undefined;
    console.info(`${LOG} POST deliver: calling deliverPigeonResult`, { questId, letterId: lid });
    const { data: delivered, error } = await deliverPigeonResult(questId, items, { letterId: lid });
    if (error) {
      console.error(`${LOG} POST deliver: deliverPigeonResult failed`, {
        questId,
        letterId: lid,
        message: error.message,
        detail: delivered,
      });
      return Response.json(
        { ok: false, error: error.message, detail: delivered },
        { status: 500 },
      );
    }
    console.info(`${LOG} POST deliver: success`, { questId, delivered });
    return Response.json({ ok: true, delivered });
  }

  if (action === "review") {
    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const { letterId, verdict, reason } = body;
    if (!letterId) return Response.json({ error: "letterId is required" }, { status: 400 });
    if (!["approved", "rejected"].includes(verdict)) {
      return Response.json({ error: "verdict must be 'approved' or 'rejected'" }, { status: 400 });
    }
    let user;
    try {
      user = await requireUser();
    } catch {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { data, error } = await writeReviewVerdict(letterId, user.id, { verdict, reason });
    if (error) return Response.json({ error: error.message }, { status: 400 });
    return Response.json({ ok: true, ...data });
  }

  if (action === "create") {
    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const { questId, channel, payload } = body;
    if (!questId || typeof questId !== "string") {
      return Response.json({ error: "questId is required" }, { status: 400 });
    }
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return Response.json({ error: "payload must be a JSON object" }, { status: 400 });
    }
    let user;
    try {
      user = await requireUser();
    } catch {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { data, error } = await writePigeonLetter(user.id, { questId, channel, payload });
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ ok: true, letter: data });
  }

  return Response.json({ error: "Unhandled action" }, { status: 500 });
}

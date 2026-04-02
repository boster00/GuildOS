import { requireUser } from "@/libs/council/auth/server";
import { database } from "@/libs/council/database";
import { publicTables } from "@/libs/council/publicTables";
import {
  uploadStorageObjectAsServiceRole,
  commissionAvatarPath,
  adventurerAvatarPath,
  generateAndStoreAvatarSheet,
} from "@/libs/proving_grounds/server.js";
import { logDatabaseError, mergeEnvelopeXIntoCapabilitiesColumn } from "@/libs/proving_grounds/ui.js";

function unauthorized() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

function extFromMime(mime) {
  if (!mime || typeof mime !== "string") return "png";
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("gif")) return "gif";
  if (mime.includes("png")) return "png";
  return "png";
}

async function assertOwnsAdventurer(client, ownerId, adventurerId) {
  const { data, error } = await client
    .from(publicTables.adventurers)
    .select("id")
    .eq("id", adventurerId)
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (error) {
    logDatabaseError("avatar.assertOwnsAdventurer.select", error, { ownerId, adventurerId });
    return { error };
  }
  if (!data) return { error: new Error("Adventurer not found.") };
  return { data: true };
}

/**
 * POST multipart: upload portrait for commission or existing adventurer.
 * Form fields: `file` (required), optional `adventurerId`.
 */
async function handleUpload(request, userId, client) {
  const form = await request.formData();
  const file = form.get("file");
  const adventurerIdRaw = form.get("adventurerId");
  const adventurerId =
    adventurerIdRaw != null && String(adventurerIdRaw).trim() ? String(adventurerIdRaw).trim() : null;

  if (!file || typeof file === "string") {
    return Response.json({ error: "file is required (multipart field 'file')" }, { status: 400 });
  }

  if (adventurerId) {
    const own = await assertOwnsAdventurer(client, userId, adventurerId);
    if (own.error) {
      return Response.json({ error: own.error.message }, { status: 400 });
    }
  }

  const mime = file.type || "application/octet-stream";
  const ext = extFromMime(mime);
  const bytes = Buffer.from(await file.arrayBuffer());

  const path = adventurerId
    ? adventurerAvatarPath(userId, adventurerId, ext)
    : commissionAvatarPath(userId, ext);

  const up = await uploadStorageObjectAsServiceRole({
    path,
    bytes,
    contentType: mime,
  });
  if (up.error) {
    logDatabaseError("avatar.handleUpload.storage.upload", up.error, { userId, path });
    return Response.json({ error: up.error.message }, { status: 400 });
  }

  if (adventurerId) {
    const { data: cur, error: selErr } = await client
      .from(publicTables.adventurers)
      .select("capabilities")
      .eq("id", adventurerId)
      .eq("owner_id", userId)
      .maybeSingle();
    if (selErr) {
      logDatabaseError("avatar.handleUpload.adventurers.select", selErr, { userId, adventurerId });
      return Response.json({ error: selErr.message }, { status: 400 });
    }
    const nextCapabilities = mergeEnvelopeXIntoCapabilitiesColumn(cur?.capabilities, {
      avatar_url: up.data.publicUrl,
    });
    const { error: updErr } = await client
      .from(publicTables.adventurers)
      .update({ capabilities: nextCapabilities })
      .eq("id", adventurerId)
      .eq("owner_id", userId);
    if (updErr) {
      logDatabaseError("avatar.handleUpload.adventurers.update", updErr, {
        table: publicTables.adventurers,
        userId,
        adventurerId,
        updatePayload: { capabilities: nextCapabilities },
      });
      return Response.json({ error: updErr.message }, { status: 400 });
    }
  }

  return Response.json({
    ok: true,
    url: up.data.publicUrl,
    path: up.data.path,
  });
}

/**
 * POST JSON: { referenceUrl, adventurerId? } — generate 4-pose sheet from reference portrait.
 */
async function handleGenerate(request, userId, client) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const referenceUrl = typeof body?.referenceUrl === "string" ? body.referenceUrl.trim() : "";
  if (!referenceUrl) {
    return Response.json({ error: "referenceUrl is required" }, { status: 400 });
  }

  const adventurerId =
    body?.adventurerId != null && String(body.adventurerId).trim()
      ? String(body.adventurerId).trim()
      : null;

  const customPrompt =
    typeof body?.customPrompt === "string" ? body.customPrompt : undefined;
  const rawPx = body?.pixelSize ?? body?.size;
  let pixelSize = 512;
  if (rawPx === 256 || rawPx === "256") pixelSize = 256;
  else if (rawPx === 512 || rawPx === "512") pixelSize = 512;
  else if (rawPx === 1024 || rawPx === "1024") pixelSize = 1024;

  if (adventurerId) {
    const own = await assertOwnsAdventurer(client, userId, adventurerId);
    if (own.error) {
      return Response.json({ error: own.error.message }, { status: 400 });
    }
  }

  const { data, error } = await generateAndStoreAvatarSheet({
    ownerId: userId,
    referenceUrl,
    adventurerId,
    client,
    customPrompt,
    pixelSize,
  });

  if (error) {
    logDatabaseError("avatar.handleGenerate.generateAndStoreAvatarSheet", error, {
      userId,
      adventurerId,
    });
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({
    ok: true,
    url: data.publicUrl,
    path: data.path,
  });
}

export async function POST(request) {
  let user;
  try {
    user = await requireUser();
  } catch (e) {
    if (e?.message === "UNAUTHORIZED") return unauthorized();
    return Response.json({ error: e?.message || String(e) }, { status: 500 });
  }

  const client = await database.init("server");
  const action = request.nextUrl.searchParams.get("action") || "uploadAvatar";
  const ct = request.headers.get("content-type") || "";

  if (action === "generateAvatarSheet") {
    return handleGenerate(request, user.id, client);
  }

  if (action === "uploadAvatar") {
    if (!ct.includes("multipart/form-data")) {
      return Response.json(
        { error: "Use multipart/form-data for uploadAvatar (field: file)" },
        { status: 400 },
      );
    }
    return handleUpload(request, user.id, client);
  }

  return Response.json(
    { error: "Invalid action", validActions: ["uploadAvatar", "generateAvatarSheet"] },
    { status: 400 },
  );
}

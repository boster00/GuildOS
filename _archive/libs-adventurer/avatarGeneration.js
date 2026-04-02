import OpenAI from "openai";
import sharp from "sharp";
import { toFile } from "openai/uploads";
import { resolveDungeonMasterRuntime } from "@/libs/council/councilSettings";
import { publicTables } from "@/libs/council/publicTables";
import { buildAvatarSheetPrompt } from "./avatarSpritePrompt.js";
import {
  uploadStorageObjectAsServiceRole,
  commissionAvatarSheetPath,
  adventurerAvatarSheetPath,
} from "./avatarStorage.js";
import { logDatabaseError } from "./logDatabaseError.js";
import { mergeEnvelopeXIntoCapabilitiesColumn } from "./capabilitiesJson.js";

/** @param {256 | 512 | 1024} px */
function sizeToOpenAI(px) {
  if (px <= 256) return "256x256";
  if (px <= 512) return "512x512";
  return "1024x1024";
}

/**
 * @param {{
 *   ownerId: string,
 *   referenceUrl: string,
 *   adventurerId?: string | null,
 *   client: import("@/libs/council/database/types.js").DatabaseClient,
 *   customPrompt?: string | null,
 *   pixelSize?: 256 | 512 | 1024,
 * }} opts — pixelSize: output edge length (smaller = smaller files). Default 512.
 */
export async function generateAndStoreAvatarSheet({
  ownerId,
  referenceUrl,
  adventurerId,
  client,
  customPrompt,
  pixelSize = 512,
}) {
  const rt = await resolveDungeonMasterRuntime(ownerId, { client });
  if (rt.error) return { error: rt.error };
  if (!rt.apiKey) {
    return {
      error: new Error(
        "No OpenAI API key: add one in Council Hall → Dungeon master's room, or set OPENAI_API_KEY in the environment.",
      ),
    };
  }

  const res = await fetch(referenceUrl);
  if (!res.ok) {
    return { error: new Error(`Could not fetch reference image (HTTP ${res.status}).`) };
  }

  const targetPx = pixelSize === 256 || pixelSize === 512 || pixelSize === 1024 ? pixelSize : 512;
  const buf = Buffer.from(await res.arrayBuffer());
  const squared = await sharp(buf)
    .resize(targetPx, targetPx, { fit: "cover" })
    .png()
    .toBuffer();

  const openai = new OpenAI({
    apiKey: rt.apiKey,
    ...(rt.baseUrl ? { baseURL: rt.baseUrl } : {}),
  });

  const imageFile = await toFile(squared, "ref.png", { type: "image/png" });

  const prompt = buildAvatarSheetPrompt(customPrompt);
  const oaiSize = sizeToOpenAI(targetPx);

  let imageResponse;
  try {
    imageResponse = await openai.images.edit({
      model: "dall-e-2",
      image: imageFile,
      prompt,
      n: 1,
      size: oaiSize,
    });
  } catch (e) {
    return { error: e instanceof Error ? e : new Error(String(e)) };
  }

  const item = imageResponse.data?.[0];
  if (!item) {
    return { error: new Error("Image generation returned no data.") };
  }

  let outBytes;
  if (item.b64_json) {
    outBytes = Buffer.from(item.b64_json, "base64");
  } else if (item.url) {
    const r2 = await fetch(item.url);
    if (!r2.ok) return { error: new Error("Could not download generated image.") };
    outBytes = Buffer.from(await r2.arrayBuffer());
  } else {
    return { error: new Error("No image bytes in generation response.") };
  }

  let finalBytes = outBytes;
  try {
    finalBytes = await sharp(outBytes)
      .resize(targetPx, targetPx, { fit: "inside" })
      .png({ compressionLevel: 9, effort: 10 })
      .toBuffer();
  } catch {
    finalBytes = outBytes;
  }

  const path = adventurerId
    ? adventurerAvatarSheetPath(ownerId, adventurerId)
    : commissionAvatarSheetPath(ownerId);

  const up = await uploadStorageObjectAsServiceRole({
    path,
    bytes: finalBytes,
    contentType: "image/png",
  });
  if (up.error) {
    logDatabaseError("generateAndStoreAvatarSheet.storage.upload", up.error, {
      ownerId,
      adventurerId,
      path,
    });
    return { error: up.error };
  }

  if (adventurerId) {
    const { data: cur, error: selErr } = await client
      .from(publicTables.adventurers)
      .select("capabilities")
      .eq("id", adventurerId)
      .eq("owner_id", ownerId)
      .maybeSingle();
    if (selErr) {
      logDatabaseError("generateAndStoreAvatarSheet.adventurers.select", selErr, { ownerId, adventurerId });
      return { error: selErr };
    }
    const nextCapabilities = mergeEnvelopeXIntoCapabilitiesColumn(cur?.capabilities, {
      avatar_sheet_url: up.data.publicUrl,
    });
    const { error: updErr } = await client
      .from(publicTables.adventurers)
      .update({ capabilities: nextCapabilities })
      .eq("id", adventurerId)
      .eq("owner_id", ownerId);
    if (updErr) {
      logDatabaseError("generateAndStoreAvatarSheet.adventurers.update", updErr, {
        table: publicTables.adventurers,
        ownerId,
        adventurerId,
        updatePayload: { capabilities: nextCapabilities },
      });
      return { error: updErr };
    }
  }

  return { data: { publicUrl: up.data.publicUrl, path: up.data.path } };
}

import { getStorageBucketName } from "@/libs/council/storageEnv";
import { createServiceClient } from "@/libs/council/database";

/**
 * @param {string} ownerId
 * @param {string} ext without dot, e.g. "png"
 */
export function commissionAvatarPath(ownerId, ext) {
  const safe = ext.replace(/^\./, "").toLowerCase() || "png";
  return `${ownerId}/commission/avatar.${safe}`;
}

/**
 * @param {string} ownerId
 * @param {string} adventurerId
 * @param {string} ext
 */
export function adventurerAvatarPath(ownerId, adventurerId, ext) {
  const safe = ext.replace(/^\./, "").toLowerCase() || "png";
  return `${ownerId}/adventurers/${adventurerId}/avatar.${safe}`;
}

/**
 * @param {string} ownerId
 * @param {string} adventurerId
 */
export function adventurerAvatarSheetPath(ownerId, adventurerId) {
  return `${ownerId}/adventurers/${adventurerId}/avatar-sheet.png`;
}

export function commissionAvatarSheetPath(ownerId) {
  return `${ownerId}/commission/avatar-sheet.png`;
}

/**
 * @param {{
 *   client: import("@/libs/council/database/types.js").DatabaseClient,
 *   path: string,
 *   bytes: Buffer | Uint8Array | ArrayBuffer,
 *   contentType: string,
 * }} opts
 */
export async function uploadStorageObject({ client, path, bytes, contentType }) {
  const bucket = getStorageBucketName();
  const body =
    bytes instanceof Buffer
      ? bytes
      : bytes instanceof Uint8Array
        ? Buffer.from(bytes)
        : Buffer.from(new Uint8Array(bytes));

  const { error } = await client.storage.from(bucket).upload(path, body, {
    contentType: contentType || "application/octet-stream",
    upsert: true,
  });
  if (error) {
    return { error };
  }
  const { data } = client.storage.from(bucket).getPublicUrl(path);
  return { data: { publicUrl: data.publicUrl, bucket, path } };
}

/**
 * Server-only: upload after auth (e.g. `requireUser`). Uses the service role so
 * `storage.objects` RLS does not block uploads from the service-role storage client.
 * Paths must remain scoped to the verified user id (e.g. `{userId}/commission/...`).
 */
export async function uploadStorageObjectAsServiceRole({ path, bytes, contentType }) {
  const svc = createServiceClient();
  return uploadStorageObject({ client: svc, path, bytes, contentType });
}

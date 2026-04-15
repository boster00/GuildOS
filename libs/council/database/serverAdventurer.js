import { publicTables } from "@/libs/council/publicTables";
import { resolveServerClient } from "./resolveServer.js";

/**
 * Slim schema columns only (see supabase/migrations/20260331160000_adventurers_slim_schema.sql).
 * Structured data is stored inside `capabilities` text as JSON envelope `{ d, x }` — no `extras` column required.
 * When `class_id` / `extras` exist (optional migration), PostgREST returns them if we list them — omit to avoid cache errors.
 */
const ADVENTURER_ROW_SELECT =
  "id, owner_id, name, system_prompt, skill_books, backstory, capabilities, session_id, worker_type, session_status, busy_since, avatar_url, created_at, updated_at";

async function resolve(injected) {
  return resolveServerClient(injected);
}

export async function insertAdventurerRow(insertRow, { client: injected } = {}) {
  const client = await resolve(injected);
  return client.from(publicTables.adventurers).insert(insertRow).select(ADVENTURER_ROW_SELECT).single();
}

export async function selectAdventurerForOwner(adventurerId, ownerId, { client: injected } = {}) {
  const client = await resolve(injected);
  return client.from(publicTables.adventurers).select(ADVENTURER_ROW_SELECT).eq("id", adventurerId).eq("owner_id", ownerId).maybeSingle();
}

export async function updateAdventurerRow(adventurerId, ownerId, updateRow, { client: injected } = {}) {
  const client = await resolve(injected);
  return client
    .from(publicTables.adventurers)
    .update(updateRow)
    .eq("id", adventurerId)
    .eq("owner_id", ownerId)
    .select(ADVENTURER_ROW_SELECT)
    .single();
}

export async function selectAdventurerById(adventurerId, { client: injected } = {}) {
  const client = await resolve(injected);
  return client.from(publicTables.adventurers).select(ADVENTURER_ROW_SELECT).eq("id", adventurerId).single();
}

/** First row matching name (no status column on slim schema). */
export async function selectAdventurerByName(name, { client: injected } = {}) {
  const client = await resolve(injected);
  return client.from(publicTables.adventurers).select(ADVENTURER_ROW_SELECT).eq("name", name).maybeSingle();
}

export async function listAdventurersForOwner(ownerId, { client: injected } = {}) {
  const client = await resolve(injected);
  return client
    .from(publicTables.adventurers)
    .select(ADVENTURER_ROW_SELECT)
    .eq("owner_id", ownerId)
    .order("name", { ascending: true });
}

export async function updateAdventurerSession(adventurerId, sessionFields, { client: injected } = {}) {
  const client = await resolve(injected);
  const allowed = ["session_id", "worker_type", "session_status", "busy_since"];
  const update = {};
  for (const k of allowed) if (sessionFields[k] !== undefined) update[k] = sessionFields[k];
  return client
    .from(publicTables.adventurers)
    .update(update)
    .eq("id", adventurerId)
    .select(ADVENTURER_ROW_SELECT)
    .single();
}

export async function deleteAdventurerForOwner(adventurerId, ownerId, { client: injected } = {}) {
  const client = await resolve(injected);
  return client.from(publicTables.adventurers).delete().eq("id", adventurerId).eq("owner_id", ownerId);
}

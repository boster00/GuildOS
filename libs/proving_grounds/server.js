/**
 * Server-only proving-grounds surface — roster CRUD, storage, runtime class.
 * Client-safe helpers: `./ui.js`. AsyncLocalStorage: `@/libs/adventurer/advance.js`.
 */
import {
  insertAdventurerRow,
  updateAdventurerRow,
  deleteAdventurerForOwner,
  selectAdventurerForOwner,
  listAdventurersForOwner,
} from "@/libs/council/database/serverAdventurer.js";
import { database } from "@/libs/council/database";
import { publicTables } from "@/libs/council/publicTables";
import { getStorageBucketName } from "@/libs/council/storageEnv.js";

export { selectAdventurerForOwner };
export const listAdventurers = listAdventurersForOwner;

export async function recruitAdventurer({ ownerId, draft, client }) {
  const { filterValidSkillBookNames } = await import("@/libs/skill_book");
  const sb = Array.isArray(draft.skill_books) ? filterValidSkillBookNames(draft.skill_books) : [];
  const insertRow = {
    owner_id: ownerId,
    name: String(draft.name ?? "").trim(),
    system_prompt: String(draft.system_prompt ?? draft.systemPrompt ?? "").trim(),
    skill_books: sb,
    backstory: draft.backstory != null ? String(draft.backstory).trim() || null : null,
    capabilities: draft.capabilities != null ? String(draft.capabilities) : null,
  };
  return insertAdventurerRow(insertRow, { client });
}

export async function updateAdventurer({ adventurerId, ownerId, draft, client }) {
  const { filterValidSkillBookNames } = await import("@/libs/skill_book");
  const updateRow = {
    name: String(draft.name ?? "").trim(),
    system_prompt: String(draft.system_prompt ?? draft.systemPrompt ?? "").trim(),
    skill_books: Array.isArray(draft.skill_books) ? filterValidSkillBookNames(draft.skill_books) : [],
    backstory: draft.backstory != null ? String(draft.backstory).trim() || null : null,
    capabilities: draft.capabilities != null ? String(draft.capabilities) : null,
  };
  return updateAdventurerRow(adventurerId, ownerId, updateRow, { client });
}

export async function decommissionAdventurer({ adventurerId, ownerId, client }) {
  return deleteAdventurerForOwner(adventurerId, ownerId, { client });
}

/**
 * Minimal quest advance hook (stage machine placeholder). Cron and proving grounds call this.
 * @param {object} quest
 * @param {{ client: import("@/libs/council/database/types.js").DatabaseClient }} opts
 */
export async function advanceQuest(quest, opts) {
  void opts;
  if (!quest || typeof quest !== "object") {
    return { ok: false, error: "Invalid quest" };
  }
  return {
    ok: true,
    advanced: false,
    stage: quest.stage,
    note: "advanceQuest stub — wire stage machine when ready",
  };
}

export function commissionAvatarPath(userId, ext) {
  const u = String(userId ?? "").trim();
  const e = String(ext ?? "png").replace(/^\./, "");
  return `commission/${u}/${Date.now()}.${e}`;
}

export function adventurerAvatarPath(userId, adventurerId, ext) {
  const u = String(userId ?? "").trim();
  const a = String(adventurerId ?? "").trim();
  const e = String(ext ?? "png").replace(/^\./, "");
  return `adventurers/${u}/${a}.${e}`;
}

export async function uploadStorageObjectAsServiceRole({ path, bytes, contentType }) {
  const db = await database.init("service");
  const bucket = getStorageBucketName();
  const { data, error } = await db.storage.from(bucket).upload(path, bytes, {
    contentType: contentType || "application/octet-stream",
    upsert: true,
  });
  if (error) {
    return { error };
  }
  const pub = db.storage.from(bucket).getPublicUrl(data.path);
  return { data: { path: data.path, publicUrl: pub.data.publicUrl } };
}

export async function generateAndStoreAvatarSheet(opts) {
  void opts;
  return { error: new Error("Avatar sheet generation is not implemented in this build.") };
}

class Adventurer {
  constructor() {
    this.profile = null;
    this.quest = null;
    this.db = database.init("server");
  }

  async loadProfile(adventurerId, tempAttributes = {}) {
    if (!adventurerId) {
      throw new Error("adventurer.loadProfile: adventurerId is required");
    }

    const { data, error } = await this.db
      .from(publicTables.adventurers)
      .select("*")
      .eq("id", adventurerId)
      .single();

    if (error) {
      throw new Error(error.message || "Failed to load adventurer");
    }
    if (!data || typeof data !== "object") {
      throw new Error("Adventurer not found");
    }

    this.profile = data;
    this.profile = { ...this.profile, ...tempAttributes };
    return this.profile;
  }

  async loadQuest(questId) {
    if (!questId) {
      throw new Error("adventurer.loadQuest: questId is required");
    }
    let data;
    if (typeof questId === "object" && questId !== null) {
      data = questId;
    } else {
      const res = await this.db.from(publicTables.quests).select("*").eq("id", questId).single();
      if (res.error) {
        throw new Error(res.error.message || "Failed to load quest");
      }
      data = res.data;
    }
    this.quest = data;
    return this.quest;
  }

  async manage() {
    const { extendAdventurerWithManage } = await import("@/libs/adventurer/manage.js");
    extendAdventurerWithManage(this);
    this.test();
  }
}

export const adventurer = {
  Adventurer,
};

export * from "./ui.js";

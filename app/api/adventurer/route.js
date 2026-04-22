import { requireUser } from "@/libs/council/auth/server";
import { database } from "@/libs/council/database";
import { recruitAdventurer, updateAdventurer, decommissionAdventurer } from "@/libs/proving_grounds/server.js";
import { isRecruitReady } from "@/libs/proving_grounds/ui.js";
import { updateAdventurerSession, selectAdventurerForOwner } from "@/libs/council/database/serverAdventurer.js";
import { writeFollowup, readConversation, readAgent } from "@/libs/weapon/cursor/index.js";
import { readFileSync } from "fs";
import { join } from "path";
import { SKILL_BOOKS } from "@/libs/skill_book/index.js";
function unauthorized() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

export async function POST(request) {
  const db = await database.init("server");
  const action = request.nextUrl.searchParams.get("action") || "recruit";

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

  if (action === "link_session") {
    const { adventurerId, sessionId, workerType } = body || {};
    if (!adventurerId || !sessionId) {
      return Response.json({ error: "adventurerId and sessionId are required" }, { status: 400 });
    }
    const { data: adv } = await selectAdventurerForOwner(adventurerId, user.id, { client: db });
    if (!adv) return Response.json({ error: "Adventurer not found" }, { status: 404 });
    const { data, error } = await updateAdventurerSession(adventurerId, {
      session_id: sessionId,
      worker_type: workerType || "cursor_cloud",
      session_status: "idle",
    }, { client: db });
    if (error) return Response.json({ error: error.message }, { status: 400 });

    // Auto-initiate: send global instructions + system_prompt + skill books
    try {
      const globalInstructions = readFileSync(join(process.cwd(), "docs/global-instructions.md"), "utf8");
      const skillBookSummaries = (adv.skill_books || [])
        .map((id) => {
          const sb = SKILL_BOOKS[id];
          if (!sb) return null;
          const actions = Object.entries(sb.toc || {}).map(([name, a]) => `- ${name}: ${a.description}`).join("\n");
          return `### ${sb.title}\n${actions}`;
        })
        .filter(Boolean)
        .join("\n\n");

      const initMessage = [
        `You are ${adv.name}. Your adventurer ID is ${adventurerId}.`,
        `\n## Global Instructions\n${globalInstructions}`,
        adv.system_prompt ? `\n## Your System Prompt\n${adv.system_prompt}` : "",
        skillBookSummaries ? `\n## Your Skill Books\n${skillBookSummaries}` : "",
        `\nYou are now initialized and ready to work. Use getActiveQuests (housekeeping skill book) to check for assigned quests.`,
      ].join("\n");

      await writeFollowup({ agentId: sessionId, message: initMessage });
    } catch { /* best-effort init — don't fail the link */ }

    return Response.json({ ok: true, data });
  }

  if (action === "message_assigned") {
    const { questId, message } = body || {};
    if (!questId || !message) {
      return Response.json({ error: "questId and message are required" }, { status: 400 });
    }
    const { getQuest } = await import("@/libs/quest/index.js");
    const { data: quest } = await getQuest(questId);
    if (!quest || quest.owner_id !== user.id) return Response.json({ error: "Quest not found" }, { status: 404 });
    if (!quest.assignee_id) return Response.json({ error: "Quest has no assigned adventurer" }, { status: 400 });
    const { data: adv } = await selectAdventurerForOwner(quest.assignee_id, user.id, { client: db });
    if (!adv?.session_id) return Response.json({ error: "Adventurer has no live session" }, { status: 400 });
    const result = await writeFollowup({ agentId: adv.session_id, message });
    return Response.json({ ok: true, data: result });
  }

  if (action === "message") {
    const { adventurerId, message } = body || {};
    if (!adventurerId || !message) {
      return Response.json({ error: "adventurerId and message are required" }, { status: 400 });
    }
    const { data: adv } = await selectAdventurerForOwner(adventurerId, user.id, { client: db });
    if (!adv) return Response.json({ error: "Adventurer not found" }, { status: 404 });
    if (!adv.session_id) return Response.json({ error: "No session linked" }, { status: 400 });
    const result = await writeFollowup({ agentId: adv.session_id, message });
    return Response.json({ ok: true, data: result });
  }

  if (action === "decommission") {
    const adventurerId = body?.adventurerId;
    if (adventurerId == null || String(adventurerId).trim() === "") {
      return Response.json({ error: "adventurerId is required" }, { status: 400 });
    }
    const { error } = await decommissionAdventurer({
      adventurerId: String(adventurerId).trim(),
      ownerId: user.id,
      client: db,
    });
    if (error) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    return Response.json({ ok: true });
  }

  const draft = body?.draft;
  if (!draft || typeof draft !== "object") {
    return Response.json({ error: "draft object is required" }, { status: 400 });
  }
  if (!isRecruitReady(draft)) {
    return Response.json(
      { error: "Draft is incomplete (name and system_prompt required)." },
      { status: 400 },
    );
  }

  if (action === "recruit") {
    // Auto-add housekeeping skill book to all new adventurers
    if (!draft.skill_books || !Array.isArray(draft.skill_books)) draft.skill_books = [];
    if (!draft.skill_books.includes("housekeeping")) draft.skill_books.push("housekeeping");
    const { data, error } = await recruitAdventurer({ ownerId: user.id, draft, client: db });
    if (error) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    return Response.json({ ok: true, data });
  }

  if (action === "update") {
    const adventurerId = body?.adventurerId;
    if (adventurerId == null || String(adventurerId).trim() === "") {
      return Response.json({ error: "adventurerId is required" }, { status: 400 });
    }
    const { data, error } = await updateAdventurer({
      adventurerId: String(adventurerId).trim(),
      ownerId: user.id,
      draft,
      client: db,
    });
    if (error) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    return Response.json({ ok: true, data });
  }

  return Response.json(
    { error: "Invalid action", validActions: ["recruit", "update", "decommission", "link_session", "message"] },
    { status: 400 },
  );
}

export async function GET(request) {
  const db = await database.init("server");
  const action = request.nextUrl.searchParams.get("action");
  const adventurerId = request.nextUrl.searchParams.get("adventurerId");

  let user;
  try {
    user = await requireUser();
  } catch (e) {
    if (e?.message === "UNAUTHORIZED") return unauthorized();
    return Response.json({ error: e?.message || String(e) }, { status: 500 });
  }

  if (action === "search") {
    const { listAdventurersForOwner } = await import("@/libs/council/database/serverAdventurer");
    const { data, error } = await listAdventurersForOwner(user.id, { client: db });
    if (error) return Response.json({ error: error.message }, { status: 500 });
    const adventurers = (data || []).map((a) => ({
      value: a.id,
      label: a.name,
      name: a.name,
      skill_books: Array.isArray(a.skill_books) ? a.skill_books : [],
      capabilities: typeof a.capabilities === "string" ? a.capabilities : "",
    }));
    return Response.json({ ok: true, adventurers });
  }

  if (!adventurerId) {
    return Response.json({ error: "adventurerId query param is required" }, { status: 400 });
  }

  const { data: adv } = await selectAdventurerForOwner(adventurerId, user.id, { client: db });
  if (!adv) return Response.json({ error: "Adventurer not found" }, { status: 404 });
  if (!adv.session_id) return Response.json({ error: "No session linked" }, { status: 400 });

  if (action === "conversation") {
    const result = await readConversation({ agentId: adv.session_id });
    return Response.json({ ok: true, data: result });
  }

  if (action === "session_status") {
    const result = await readAgent({ agentId: adv.session_id });
    return Response.json({ ok: true, data: result });
  }

  return Response.json(
    { error: "Invalid action", validActions: ["search", "conversation", "session_status"] },
    { status: 400 },
  );
}

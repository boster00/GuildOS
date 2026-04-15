import { requireUser } from "@/libs/council/auth/server";
import { database } from "@/libs/council/database";
import {
  deleteAllQuestCommentsForQuest,
  deleteQuestCommentById,
  insertQuestComment,
  selectQuestForOwner,
  updateQuestCommentSummaryById,
} from "@/libs/council/database/serverQuest.js";
import { selectAdventurerById } from "@/libs/council/database/serverAdventurer.js";
import { writeFollowup } from "@/libs/weapon/cursor/index.js";

export async function POST(request) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
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

  const summary = typeof body?.summary === "string" ? body.summary.trim() : "";
  if (!summary) {
    return Response.json({ error: "summary is required" }, { status: 400 });
  }

  const client = await database.init("server");
  const { data: quest, error: questErr } = await selectQuestForOwner(questId, user.id, { client });
  if (questErr) {
    return Response.json({ error: questErr.message || "Could not verify quest" }, { status: 500 });
  }
  if (!quest) {
    return Response.json({ error: "Quest not found" }, { status: 404 });
  }

  const actionRaw = typeof body?.action === "string" ? body.action.trim() : "";
  const action = actionRaw || "note";
  const source = typeof body?.source === "string" && body.source.trim() ? body.source.trim() : "user";
  const detail =
    body?.detail != null && typeof body.detail === "object" && !Array.isArray(body.detail) ? body.detail : {};

  const { data: row, error } = await insertQuestComment(
    { questId, source, action, summary, detail },
    { client },
  );
  if (error) {
    return Response.json({ error: error.message || "Could not add comment" }, { status: 500 });
  }

  // Ping the assigned adventurer's live session about new comments
  if (quest.assignee_id) {
    try {
      const { data: adv } = await selectAdventurerById(quest.assignee_id, { client });
      if (adv?.session_id && adv.session_status !== "inactive") {
        await writeFollowup({
          agentId: adv.session_id,
          message: `New feedback on quest "${quest.title}" (${questId}). Read the latest comments on this quest and act on the feedback.`,
        });
      }
    } catch { /* best-effort — don't fail the comment save */ }
  }

  return Response.json({ ok: true, comment: row });
}

export async function PATCH(request) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
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

  const commentId = typeof body?.commentId === "string" ? body.commentId.trim() : "";
  if (!commentId) {
    return Response.json({ error: "commentId is required" }, { status: 400 });
  }

  const summary = typeof body?.summary === "string" ? body.summary.trim() : "";
  if (!summary) {
    return Response.json({ error: "summary is required" }, { status: 400 });
  }

  const client = await database.init("server");
  const { data: quest, error: questErr } = await selectQuestForOwner(questId, user.id, { client });
  if (questErr) {
    return Response.json({ error: questErr.message || "Could not verify quest" }, { status: 500 });
  }
  if (!quest) {
    return Response.json({ error: "Quest not found" }, { status: 404 });
  }

  const { data: row, error } = await updateQuestCommentSummaryById(
    { questId, commentId, summary },
    { client },
  );
  if (error) {
    return Response.json({ error: error.message || "Could not update comment" }, { status: 500 });
  }
  if (!row) {
    return Response.json({ error: "Comment not found" }, { status: 404 });
  }
  return Response.json({ ok: true, comment: row });
}

export async function DELETE(request) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
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

  const client = await database.init("server");
  const { data: quest, error: questErr } = await selectQuestForOwner(questId, user.id, { client });
  if (questErr) {
    return Response.json({ error: questErr.message || "Could not verify quest" }, { status: 500 });
  }
  if (!quest) {
    return Response.json({ error: "Quest not found" }, { status: 404 });
  }

  const commentId = typeof body?.commentId === "string" ? body.commentId.trim() : "";

  if (commentId) {
    const { data: deleted, error } = await deleteQuestCommentById({ questId, commentId }, { client });
    if (error) {
      return Response.json({ error: error.message || "Delete failed" }, { status: 500 });
    }
    if (!deleted?.length) {
      return Response.json({ error: "Comment not found" }, { status: 404 });
    }
    return Response.json({ ok: true, deletedId: commentId });
  }

  const { error } = await deleteAllQuestCommentsForQuest(questId, { client });
  if (error) {
    return Response.json({ error: error.message || "Clear failed" }, { status: 500 });
  }
  return Response.json({ ok: true });
}

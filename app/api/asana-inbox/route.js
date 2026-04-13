/**
 * Asana Inbox — webhook receiver for Asana events.
 *
 * 1. Handles Asana webhook handshake (X-Hook-Secret echo).
 * 2. Receives task/story events, filters for actionable ones.
 * 3. Creates pigeon_letters rows (channel: "asana") for processing.
 *
 * POST (handshake): Asana sends X-Hook-Secret → echo it back.
 * POST (events):    Asana sends events array → filter → create pigeon letters.
 * POST ?action=poll: Manual poll — scan Asana for recent mentions, create letters.
 */
import { database } from "@/libs/council/database";
import { createHmac } from "crypto";

const LOG = "[asana-inbox]";
const CHANNEL = "asana";

// CJ Xia's Asana user GID — comments from this user are "ours"
const CJ_USER_GID = "339072238082588";

// Asana webhook secret (set after first handshake, stored in env)
function getWebhookSecret() {
  return process.env.ASANA_WEBHOOK_SECRET || "";
}

function getAsanaPAT() {
  return process.env.ASANA_ACCESS_TOKEN || "";
}

function getOwnerUserId() {
  return process.env.PIGEON_POST_OWNER_ID || "";
}

/** Verify Asana webhook signature */
function verifySignature(body, signature) {
  const secret = getWebhookSecret();
  if (!secret || !signature) return false;
  const hmac = createHmac("sha256", secret).update(body).digest("hex");
  return hmac === signature;
}

/** Fetch task details from Asana API */
async function asanaFetch(path) {
  const pat = getAsanaPAT();
  if (!pat) throw new Error("ASANA_ACCESS_TOKEN not configured");
  const res = await fetch(`https://app.asana.com/api/1.0${path}`, {
    headers: { Authorization: `Bearer ${pat}` },
  });
  if (!res.ok) throw new Error(`Asana ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()).data;
}

/** Check if a comment text is from Claude (our own posts) */
function isFromClaude(text) {
  return text?.includes("Claude Code") || text?.includes("Claude Code Report");
}

/** Check if a comment is actionable — something Claude can help with */
function isActionable(text) {
  if (!text || isFromClaude(text)) return false;
  // Skip pure system events, very short messages, or "done" notifications
  if (text.length < 20) return false;
  const lower = text.toLowerCase();
  // Skip "marked complete", assignment changes, etc.
  if (lower.includes("marked this task complete")) return false;
  if (lower.includes("changed the due date")) return false;
  if (lower.includes("added this task to")) return false;
  return true;
}

/**
 * Create a pigeon_letters row for an Asana event.
 * Uses a dedicated quest for Asana inbox processing, or creates one.
 */
async function createAsanaPigeonLetter(db, { taskGid, taskName, commentText, commentBy, commentGid, projectGid }) {
  const ownerId = getOwnerUserId();
  if (!ownerId) {
    console.error(`${LOG} PIGEON_POST_OWNER_ID not set, cannot create letter`);
    return null;
  }

  // Use or create a standing "Asana Inbox" quest
  let quest;
  const { data: existing } = await db
    .from("quests")
    .select("id")
    .eq("owner_id", ownerId)
    .eq("title", "Asana Inbox")
    .maybeSingle();

  if (existing) {
    quest = existing;
  } else {
    const { data: created, error } = await db
      .from("quests")
      .insert({ owner_id: ownerId, title: "Asana Inbox", stage: "execute" })
      .select("id")
      .single();
    if (error) {
      console.error(`${LOG} Failed to create Asana Inbox quest:`, error.message);
      return null;
    }
    quest = created;
  }

  // Deduplicate by comment GID
  const idempotencyKey = commentGid ? `asana_comment_${commentGid}` : null;
  if (idempotencyKey) {
    const { data: dup } = await db
      .from("pigeon_letters")
      .select("id")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();
    if (dup) {
      console.info(`${LOG} Duplicate comment ${commentGid}, skipping`);
      return null;
    }
  }

  const payload = {
    source: "asana_webhook",
    taskGid,
    taskName,
    commentText,
    commentBy,
    commentGid,
    projectGid,
    instruction: `Asana task "${taskName}" received a comment from ${commentBy}. Review and respond if you can meaningfully contribute. Comment: ${commentText}`,
  };

  const { data, error } = await db
    .from("pigeon_letters")
    .insert({
      quest_id: quest.id,
      owner_id: ownerId,
      channel: CHANNEL,
      status: "pending",
      payload,
      idempotency_key: idempotencyKey,
      metadata: { taskGid, commentBy, projectGid },
    })
    .select("id")
    .single();

  if (error) {
    console.error(`${LOG} Failed to create pigeon letter:`, error.message);
    return null;
  }

  console.info(`${LOG} Created pigeon letter ${data.id} for task ${taskGid}`);
  return data;
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------
export async function POST(request) {
  const action = request.nextUrl.searchParams.get("action");

  // ── Manual poll action ──
  if (action === "poll") {
    return handlePoll(request);
  }

  // ── Asana webhook handshake ──
  const hookSecret = request.headers.get("x-hook-secret");
  if (hookSecret) {
    console.info(`${LOG} Webhook handshake received`);
    return new Response(null, {
      status: 200,
      headers: { "X-Hook-Secret": hookSecret },
    });
  }

  // ── Asana webhook event delivery ──
  const rawBody = await request.text();
  const signature = request.headers.get("x-hook-signature");

  // Verify signature if webhook secret is configured
  const secret = getWebhookSecret();
  if (secret && signature && !verifySignature(rawBody, signature)) {
    console.warn(`${LOG} Invalid webhook signature`);
    return Response.json({ error: "Invalid signature" }, { status: 403 });
  }

  let body;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const events = body?.events;
  if (!Array.isArray(events) || events.length === 0) {
    return Response.json({ ok: true, processed: 0 });
  }

  console.info(`${LOG} Received ${events.length} events`);

  const db = await database.init("service");
  let processed = 0;

  for (const event of events) {
    // We care about story (comment) additions on tasks
    if (event.resource?.resource_type !== "story") continue;
    if (event.action !== "added") continue;
    if (event.parent?.resource_type !== "task") continue;

    const taskGid = event.parent.gid;
    const storyGid = event.resource.gid;

    try {
      // Fetch the story details
      const story = await asanaFetch(`/stories/${storyGid}?opt_fields=text,created_by.name,created_by.gid,type,resource_subtype`);
      if (story.type !== "comment") continue;
      if (story.created_by?.gid === CJ_USER_GID && isFromClaude(story.text)) continue;
      if (!isActionable(story.text)) continue;

      // Fetch task details
      const task = await asanaFetch(`/tasks/${taskGid}?opt_fields=name,memberships.project.gid`);
      const projectGid = task.memberships?.[0]?.project?.gid || "";

      await createAsanaPigeonLetter(db, {
        taskGid,
        taskName: task.name,
        commentText: story.text,
        commentBy: story.created_by?.name || "Unknown",
        commentGid: storyGid,
        projectGid,
      });
      processed++;
    } catch (err) {
      console.error(`${LOG} Error processing event for story ${storyGid}:`, err.message);
    }
  }

  console.info(`${LOG} Processed ${processed}/${events.length} events`);
  return Response.json({ ok: true, processed });
}

// ---------------------------------------------------------------------------
// Manual poll — scan Asana for recent comments and create pigeon letters
// ---------------------------------------------------------------------------
async function handlePoll(request) {
  // Auth: require pigeon key or session
  const apiKeyOk = request.headers.get("x-pigeon-key") === process.env.PIGEON_API_KEY;
  if (!apiKeyOk) {
    try {
      const { requireUser } = await import("@/libs/council/auth/server");
      await requireUser();
    } catch {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const since = request.nextUrl.searchParams.get("since") ||
    new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const pat = getAsanaPAT();
  if (!pat) return Response.json({ error: "ASANA_ACCESS_TOKEN not configured" }, { status: 503 });

  const PROJECTS = [
    "1205080218355354", // [CJ] backlogs
    "1203575090676593", // [A] Meeting Agendas
    "1203654500458701", // [A] SMART Task Board
    "1207128127338189", // Dev Work (Paul)
  ];

  const db = await database.init("service");
  let totalProcessed = 0;

  for (const projectGid of PROJECTS) {
    try {
      const tasks = await asanaFetch(
        `/tasks?project=${projectGid}&modified_since=${since}&opt_fields=name,modified_at,completed&limit=50`
      );

      for (const task of tasks) {
        if (task.completed) continue;

        const stories = await asanaFetch(
          `/tasks/${task.gid}/stories?opt_fields=text,created_by.name,created_by.gid,created_at,type`
        );

        for (const story of stories) {
          if (story.type !== "comment") continue;
          if (new Date(story.created_at) < new Date(since)) continue;
          if (isFromClaude(story.text)) continue;
          if (!isActionable(story.text)) continue;

          const result = await createAsanaPigeonLetter(db, {
            taskGid: task.gid,
            taskName: task.name,
            commentText: story.text,
            commentBy: story.created_by?.name || "Unknown",
            commentGid: story.gid,
            projectGid,
          });
          if (result) totalProcessed++;
        }
      }
    } catch (err) {
      console.error(`${LOG} Poll error for project ${projectGid}:`, err.message);
    }
  }

  return Response.json({ ok: true, processed: totalProcessed, since });
}

// ---------------------------------------------------------------------------
// GET — read pending asana pigeon letters (for processors)
// ---------------------------------------------------------------------------
export async function GET(request) {
  const action = request.nextUrl.searchParams.get("action");

  if (action === "pending") {
    const db = await database.init("service");
    const ownerId = getOwnerUserId();
    if (!ownerId) return Response.json({ error: "PIGEON_POST_OWNER_ID not set" }, { status: 503 });

    const { data, error } = await db
      .from("pigeon_letters")
      .select("id, quest_id, payload, metadata, created_at")
      .eq("owner_id", ownerId)
      .eq("channel", CHANNEL)
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ letters: data || [] });
  }

  return Response.json(
    { error: "Missing or invalid action", validActions: ["pending"] },
    { status: 400 },
  );
}

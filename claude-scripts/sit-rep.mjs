/**
 * Daily Sit Rep — standalone script, no npm dependencies.
 * Uses native fetch (Node 22).
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_DB_URL;
const SUPABASE_KEY = process.env.SUPABASE_SECRETE_KEY;
const ASANA_TOKEN = process.env.ASANA_ACCESS_TOKEN;
const GOOGLE_ID = process.env.GOOGLE_ID;
const GOOGLE_SECRET = process.env.GOOGLE_SECRET;
const GOOGLE_REFRESH_TOKEN = process.env.GOOGLE_GMAIL_REFRESH_TOKEN || process.env.GOOGLE_REFRESH_TOKEN;

// Yesterday 7am (ISO string for comparisons)
const now = new Date();
const yesterday7am = new Date(now);
yesterday7am.setDate(yesterday7am.getDate() - 1);
yesterday7am.setHours(7, 0, 0, 0);
const yesterday7amISO = yesterday7am.toISOString();

console.log(`Running sit rep. Cutoff: ${yesterday7amISO}`);

// ─── Gmail helpers ──────────────────────────────────────────────────────────

async function getGmailToken() {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_ID,
      client_secret: GOOGLE_SECRET,
      refresh_token: GOOGLE_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(`Gmail token error: ${JSON.stringify(data)}`);
  return data.access_token;
}

async function gmailGet(path, token) {
  const res = await fetch(`https://www.googleapis.com/gmail/v1${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Gmail ${res.status}: ${await res.text()}`);
  return res.json();
}

// ─── Asana helpers ───────────────────────────────────────────────────────────

async function asanaGet(path) {
  const res = await fetch(`https://app.asana.com/api/1.0${path}`, {
    headers: { Authorization: `Bearer ${ASANA_TOKEN}`, "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`Asana ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return json.data !== undefined ? json.data : json;
}

// ─── Supabase helpers ────────────────────────────────────────────────────────

async function supabaseGet(table, params = "") {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${params}`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  return res.json();
}

// ─── 1. Gmail: unread emails since yesterday 7am ─────────────────────────────

async function getGmailItems() {
  console.log("Fetching Gmail...");
  try {
    const token = await getGmailToken();
    // Search unread emails in inbox from yesterday onwards
    const dateStr = yesterday7am.toISOString().split("T")[0].replace(/-/g, "/");
    const query = `is:unread in:inbox after:${dateStr}`;
    const listRes = await gmailGet(
      `/users/me/messages?q=${encodeURIComponent(query)}&maxResults=20`,
      token
    );
    const messages = listRes.messages || [];
    if (messages.length === 0) return [];

    const details = await Promise.all(
      messages.slice(0, 15).map((m) =>
        gmailGet(
          `/users/me/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
          token
        )
      )
    );

    return details.map((msg) => {
      const headers = msg.payload?.headers || [];
      const h = (name) => headers.find((x) => x.name.toLowerCase() === name.toLowerCase())?.value || "";
      return {
        id: msg.id,
        from: h("From"),
        subject: h("Subject"),
        date: h("Date"),
        snippet: msg.snippet || "",
        labelIds: msg.labelIds || [],
      };
    });
  } catch (e) {
    console.error("Gmail error:", e.message);
    return [{ error: e.message }];
  }
}

// ─── 2. Asana: [CJ] backlogs tasks with recent comments ──────────────────────

async function getAsanaItems() {
  console.log("Fetching Asana...");
  try {
    // [CJ] backlogs lives in the "Boster" workspace (521601694181754), not bosterbio.com
    const ws = { gid: "521601694181754", name: "Boster" };
    console.log(`Workspace: ${ws.name} (${ws.gid})`);

    // Find [CJ] backlogs project
    const projects = await asanaGet(
      `/projects?workspace=${ws.gid}&opt_fields=name,archived&limit=100`
    );
    const project = projects.find((p) => p.name?.includes("[CJ]") && p.name?.toLowerCase().includes("backlog"));
    if (!project) {
      console.log("Available projects:", projects.map(p => p.name).join(", "));
      return [{ error: "No [CJ] backlogs project found" }];
    }
    console.log(`Project: ${project.name} (${project.gid})`);

    // Get incomplete tasks
    const tasks = await asanaGet(
      `/projects/${project.gid}/tasks?opt_fields=name,completed,assignee.name,modified_at&completed_since=now&limit=100`
    );
    console.log(`Got ${tasks.length} tasks, checking comments...`);

    const results = [];
    // Check comments on tasks modified recently (to avoid checking all 100)
    const recentTasks = tasks.filter((t) => {
      if (!t.modified_at) return false;
      return new Date(t.modified_at) > yesterday7am;
    });
    console.log(`${recentTasks.length} tasks modified since yesterday 7am`);

    for (const task of recentTasks.slice(0, 30)) {
      try {
        const stories = await asanaGet(
          `/tasks/${task.gid}/stories?opt_fields=created_by.name,text,created_at,resource_subtype&limit=20`
        );
        const comments = stories.filter(
          (s) =>
            s.resource_subtype === "comment_added" &&
            s.created_at &&
            new Date(s.created_at) > yesterday7am
        );
        for (const c of comments) {
          const author = c.created_by?.name || "unknown";
          const text = (c.text || "").trim();
          const isClaude = text.toLowerCase().includes("claude");
          // Skip if author looks like Sijie/CJ and no "claude" keyword
          const authorLower = author.toLowerCase();
          const isSijie = authorLower.includes("sijie") || authorLower.includes("cj") || authorLower.includes("boster");
          if (isSijie && !isClaude) continue;
          results.push({
            taskName: task.name,
            author,
            text: text.slice(0, 200),
            created_at: c.created_at,
          });
        }
      } catch (e) {
        // skip individual task errors
      }
    }
    return results;
  } catch (e) {
    console.error("Asana error:", e.message);
    return [{ error: e.message }];
  }
}

// ─── 3. GuildOS quests in review/purrview ────────────────────────────────────

async function getQuestItems() {
  console.log("Fetching GuildOS quests...");
  try {
    const quests = await supabaseGet(
      "quests",
      `?stage=in.(review,purrview)&select=id,title,description,stage,created_at,updated_at&order=updated_at.desc`
    );
    if (!quests.length) return [];

    // Get inventory and comments for each quest
    const enriched = await Promise.all(
      quests.map(async (q) => {
        try {
          const [inventory, comments] = await Promise.all([
            supabaseGet("quest_inventory", `?quest_id=eq.${q.id}&select=item_key,payload`).catch(() => []),
            supabaseGet("quest_comments", `?quest_id=eq.${q.id}&select=summary,detail,created_at&order=created_at.desc&limit=3`).catch(() => []),
          ]);
          return { ...q, inventory, comments };
        } catch {
          return q;
        }
      })
    );
    return enriched;
  } catch (e) {
    console.error("Supabase error:", e.message);
    return [{ error: e.message }];
  }
}

// ─── Send email via Gmail ─────────────────────────────────────────────────────

async function sendEmail(token, to, subject, body) {
  const email = [
    `To: ${to}`,
    `Subject: ${subject}`,
    `Content-Type: text/plain; charset=utf-8`,
    `MIME-Version: 1.0`,
    ``,
    body,
  ].join("\r\n");

  const encoded = Buffer.from(email)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const res = await fetch("https://www.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw: encoded }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gmail send failed (${res.status}): ${text}`);
  }
  return res.json();
}

// ─── Assemble sit rep ─────────────────────────────────────────────────────────

function isNewsletter(msg) {
  const from = (msg.from || "").toLowerCase();
  const subject = (msg.subject || "").toLowerCase();
  const snippet = (msg.snippet || "").toLowerCase();
  const newsletterPatterns = [
    "unsubscribe", "newsletter", "noreply", "no-reply", "notifications@",
    "digest", "weekly", "daily digest", "update@", "info@", "marketing@",
    "alerts@", "notify@", "automated", "do not reply",
  ];
  const text = from + " " + subject + " " + snippet;
  return newsletterPatterns.some((p) => text.includes(p));
}

function scoreMail(msg) {
  // Higher score = more urgent
  let score = 0;
  const subject = (msg.subject || "").toLowerCase();
  const from = (msg.from || "").toLowerCase();
  const snippet = (msg.snippet || "").toLowerCase();
  const text = subject + " " + snippet;

  if (text.includes("urgent") || text.includes("asap") || text.includes("immediately")) score += 10;
  if (text.includes("invoice") || text.includes("payment") || text.includes("overdue")) score += 8;
  if (text.includes("contract") || text.includes("agreement") || text.includes("sign")) score += 7;
  if (text.includes("meeting") || text.includes("call") || text.includes("tomorrow")) score += 5;
  if (text.includes("deadline") || text.includes("due")) score += 5;
  if (text.includes("reply") || text.includes("response") || text.includes("follow up")) score += 4;
  if (msg.labelIds?.includes("IMPORTANT")) score += 6;
  if (msg.labelIds?.includes("STARRED")) score += 8;

  return score;
}

async function main() {
  const [gmailMsgs, asanaTasks, quests] = await Promise.all([
    getGmailItems(),
    getAsanaItems(),
    getQuestItems(),
  ]);

  const todayStr = new Date().toISOString().split("T")[0];
  const lines = [`Sit Rep — ${todayStr}`, ""];

  // ── Gmail section ──
  const gmailErrors = gmailMsgs.filter((m) => m.error);
  const validMsgs = gmailMsgs.filter((m) => !m.error && !isNewsletter(m));
  const urgentMsgs = validMsgs
    .map((m) => ({ ...m, score: scoreMail(m) }))
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  if (gmailErrors.length) {
    lines.push(`[Gmail error: ${gmailErrors[0].error}]`);
    lines.push("");
  }

  if (urgentMsgs.length > 0) {
    lines.push("── Gmail (action required) ──");
    urgentMsgs.forEach((m, i) => {
      const from = m.from.replace(/<.*>/, "").trim() || m.from;
      lines.push(`${i + 1}. From: ${from}`);
      lines.push(`   Subject: ${m.subject}`);
      lines.push(`   Why: ${m.snippet.slice(0, 120)}`);
      lines.push("");
    });
  } else if (!gmailErrors.length) {
    lines.push("── Gmail ──");
    lines.push("No urgent emails requiring action.");
    lines.push("");
  }

  // ── Asana section ──
  const asanaErrors = asanaTasks.filter((t) => t.error);
  const validTasks = asanaTasks.filter((t) => !t.error);

  if (asanaErrors.length) {
    lines.push(`[Asana error: ${asanaErrors[0].error}]`);
    lines.push("");
  }

  if (validTasks.length > 0) {
    lines.push("── Asana Decision Items ──");
    validTasks.slice(0, 5).forEach((t, i) => {
      lines.push(`${i + 1}. Task: ${t.taskName}`);
      lines.push(`   From: ${t.author}: "${t.text.slice(0, 100)}"`);
      lines.push("");
    });
  } else if (!asanaErrors.length) {
    lines.push("── Asana Decision Items ──");
    lines.push("No new teammate comments since yesterday 7am.");
    lines.push("");
  }

  // ── GuildOS section ──
  const questErrors = quests.filter((q) => q.error);
  const validQuests = quests.filter((q) => !q.error);

  if (questErrors.length) {
    lines.push(`[GuildOS error: ${questErrors[0].error}]`);
    lines.push("");
  }

  if (validQuests.length > 0) {
    lines.push("── GuildOS Review Queue ──");
    validQuests.forEach((q, i) => {
      const stage = q.stage === "purrview" ? "purrview (agent believes done)" : "review (awaiting your approval)";
      const lastComment = q.comments?.[0]?.summary || "";
      const hasArtifacts = (q.inventory || []).some(
        (item) => item.payload?.url
      );
      const assessment = lastComment
        ? `${lastComment.slice(0, 100)}`
        : "No summary comment available.";
      const action =
        q.stage === "review"
          ? "Approve or reject on GM desk"
          : "Wait for Cat to promote to review";
      lines.push(`${i + 1}. [${stage.toUpperCase()}] ${q.title}`);
      lines.push(`   ${assessment}`);
      lines.push(`   Artifacts: ${hasArtifacts ? "Yes" : "None"} | Action: ${action}`);
      lines.push("");
    });
  } else if (!questErrors.length) {
    lines.push("── GuildOS Review Queue ──");
    lines.push("No quests in review or purrview.");
    lines.push("");
  }

  const body = lines.join("\n").trim();
  console.log("\n=== SIT REP BODY ===\n");
  console.log(body);
  console.log("\n===================\n");

  // Send email
  console.log("Sending email...");
  try {
    const token = await getGmailToken();
    const result = await sendEmail(token, "xsj706@gmail.com", `Sit Rep — ${todayStr}`, body);
    console.log("Email sent! Message ID:", result.id);
  } catch (e) {
    console.error("Failed to send email:", e.message);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});

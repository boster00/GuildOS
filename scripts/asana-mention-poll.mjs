/**
 * Asana mention poller — scans recent task activity for @CJ Xia mentions.
 * Designed to be called periodically from Claude Code sessions.
 *
 * Usage: node scripts/asana-mention-poll.mjs [--since=2026-04-11]
 */
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const ASANA_PAT = process.env.ASANA_ACCESS_TOKEN;
const WORKSPACE_GID = "521601694181754";
const CJ_USER_GID = "339072238082588";
const CLAUDE_API_USER_GID = CJ_USER_GID; // API acts as CJ

// All active project GIDs
const PROJECTS = [
  "1205080218355354", // [CJ] backlogs
  "1203575090676593", // [A] Meeting Agendas
  "1203654500458701", // [A] SMART Task Board
  "1207128127338189", // Dev Work (Paul)
  "1206414906612534", // SEO pipeline
  "1206490901321811", // Website Update
  "1206672736896201", // Kyinno
];

const ASANA_BASE = "https://app.asana.com/api/1.0";

async function asanaFetch(path) {
  const res = await fetch(`${ASANA_BASE}${path}`, {
    headers: { Authorization: `Bearer ${ASANA_PAT}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Asana ${res.status}: ${text.slice(0, 200)}`);
  }
  const json = await res.json();
  return json.data;
}

async function getRecentTasksForProject(projectGid, modifiedSince) {
  try {
    const tasks = await asanaFetch(
      `/tasks?project=${projectGid}&modified_since=${modifiedSince}&opt_fields=name,modified_at,completed&limit=50`
    );
    return tasks.filter((t) => !t.completed);
  } catch {
    return [];
  }
}

async function getTaskStories(taskGid) {
  try {
    return await asanaFetch(
      `/tasks/${taskGid}/stories?opt_fields=text,created_by.name,created_by.gid,created_at,type,resource_subtype`
    );
  } catch {
    return [];
  }
}

function isMentionOfCJ(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  return (
    lower.includes("@cj") ||
    lower.includes("cj xia") ||
    lower.includes("boster@bosterbio") ||
    // Asana rich text mention format
    text.includes(CJ_USER_GID)
  );
}

function isFromClaudeAPI(story) {
  // Stories created by the API user (CJ's account via PAT) with "Claude Code" in text
  return story.text?.includes("Claude Code");
}

async function main() {
  const sinceArg = process.argv.find((a) => a.startsWith("--since="));
  const since = sinceArg
    ? sinceArg.split("=")[1]
    : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(); // default: last 7 days

  console.log(`Scanning for @CJ Xia mentions since ${since}...\n`);

  const actionable = [];

  for (const projectGid of PROJECTS) {
    const tasks = await getRecentTasksForProject(projectGid, since);
    for (const task of tasks) {
      const stories = await getTaskStories(task.gid);
      const comments = stories.filter(
        (s) =>
          s.type === "comment" &&
          !isFromClaudeAPI(s) &&
          new Date(s.created_at) > new Date(since)
      );

      for (const comment of comments) {
        // Check if the comment mentions CJ or is a reply to a Claude comment
        const mentionsCJ = isMentionOfCJ(comment.text);
        const isReplyToUs = stories.some(
          (s) =>
            isFromClaudeAPI(s) &&
            new Date(s.created_at) < new Date(comment.created_at)
        );

        if (mentionsCJ || isReplyToUs) {
          actionable.push({
            taskGid: task.gid,
            taskName: task.name,
            commentBy: comment.created_by?.name || "Unknown",
            commentDate: comment.created_at,
            text: comment.text?.slice(0, 500),
            reason: mentionsCJ ? "@CJ mention" : "reply to Claude",
          });
        }
      }
    }
  }

  if (actionable.length === 0) {
    console.log("No actionable mentions found.");
  } else {
    console.log(`Found ${actionable.length} actionable mention(s):\n`);
    for (const item of actionable) {
      console.log(`--- Task: ${item.taskName} (${item.taskGid})`);
      console.log(`    By: ${item.commentBy} at ${item.commentDate}`);
      console.log(`    Reason: ${item.reason}`);
      console.log(`    Text: ${item.text}`);
      console.log();
    }
  }

  // Output as JSON for programmatic consumption
  console.log("\n__JSON__");
  console.log(JSON.stringify(actionable, null, 2));
}

main().catch((e) => {
  console.error("Error:", e.message);
  process.exit(1);
});

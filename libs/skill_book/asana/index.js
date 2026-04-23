/**
 * Asana skill book — read-only access to Asana projects and tasks.
 * Uses ASANA_ACCESS_TOKEN from environment.
 */
import { skillActionOk, skillActionErr } from "@/libs/skill_book/actionResult.js";

const ASANA_BASE = "https://app.asana.com/api/1.0";

function asanaHeaders() {
  const token = process.env.ASANA_ACCESS_TOKEN;
  if (!token) throw new Error("ASANA_ACCESS_TOKEN not set in environment.");
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

async function asanaGet(path, params = {}) {
  const url = new URL(`${ASANA_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v != null) url.searchParams.set(k, String(v));
  }
  const res = await fetch(url.toString(), { headers: asanaHeaders() });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: json.errors?.[0]?.message || res.statusText, data: null };
  return { ok: true, data: json.data, next_page: json.next_page };
}

export const skillBook = {
  id: "asana",
  title: "Asana",
  description: "Read tasks and projects from Asana workspaces.",
  steps: [],
  toc: {
    readProjectTasks: {
      description: "Read all incomplete tasks from an Asana project by name or ID. Returns task titles, notes, sections, assignees, and completion status.",
      input: {
        project_name: "string — project name to search for (e.g. '[CJ] backlogs'). Used if project_id is not provided.",
        project_id: "string — Asana project GID. If provided, project_name is ignored.",
        include_completed: "boolean — include completed tasks (default: false)",
        workspace_id: "string — workspace GID (default: searches all workspaces)",
      },
      output: {
        tasks: "array of { gid, name, notes, completed, assignee, section, tags }",
        project: "object with { gid, name } of the matched project",
      },
    },
    readTaskComments: {
      description: "Read recent comments/stories on an Asana task.",
      input: {
        task_id: "string — Asana task GID",
        limit: "number — max comments to return (default: 10)",
      },
      output: {
        comments: "array of { author, text, created_at, type }",
      },
    },
  },
};

/**
 * Find a project by name across workspaces.
 */
async function resolveProjectId(projectName, workspaceId) {
  if (workspaceId) {
    const { ok, data } = await asanaGet("/projects", {
      workspace: workspaceId,
      opt_fields: "name",
      limit: 100,
    });
    if (ok && data) {
      const match = data.find((p) => p.name.toLowerCase().includes(projectName.toLowerCase()));
      if (match) return { ok: true, project: match };
    }
  }

  // Search all workspaces
  const { ok: wOk, data: workspaces } = await asanaGet("/workspaces", { limit: 100 });
  if (!wOk || !workspaces) return { ok: false, error: "Failed to list workspaces" };

  for (const ws of workspaces) {
    const { ok, data } = await asanaGet("/projects", {
      workspace: ws.gid,
      opt_fields: "name",
      limit: 100,
    });
    if (ok && data) {
      const match = data.find((p) => p.name.toLowerCase().includes(projectName.toLowerCase()));
      if (match) return { ok: true, project: match };
    }
  }
  return { ok: false, error: `Project "${projectName}" not found in any workspace.` };
}

export async function readProjectTasks(_userId, input) {
  const inObj = typeof input === "object" && input ? input : {};
  let projectId = inObj.project_id || null;
  let projectInfo = null;
  const includeCompleted = inObj.include_completed === true || inObj.include_completed === "true";

  if (!projectId) {
    const name = String(inObj.project_name || "").trim();
    if (!name) return skillActionErr("Either project_name or project_id is required.");
    const resolved = await resolveProjectId(name, inObj.workspace_id);
    if (!resolved.ok) return skillActionErr(resolved.error);
    projectId = resolved.project.gid;
    projectInfo = resolved.project;
  }

  // Fetch tasks with pagination
  const allTasks = [];
  let offset = null;
  const optFields = "name,notes,completed,assignee.name,memberships.section.name,tags.name,created_at,modified_at";

  do {
    const params = { opt_fields: optFields, limit: 100 };
    if (!includeCompleted) params.completed_since = "now"; // only incomplete
    if (offset) params.offset = offset;

    const { ok, data, next_page, error } = await asanaGet(`/projects/${projectId}/tasks`, params);
    if (!ok) return skillActionErr(`Failed to fetch tasks: ${error}`);
    if (data) allTasks.push(...data);
    offset = next_page?.offset || null;
  } while (offset);

  // Normalize
  const tasks = allTasks.map((t) => ({
    gid: t.gid,
    name: t.name,
    notes: (t.notes || "").slice(0, 500),
    completed: t.completed,
    assignee: t.assignee?.name || null,
    section: t.memberships?.[0]?.section?.name || null,
    tags: (t.tags || []).map((tag) => tag.name),
    modified_at: t.modified_at,
  }));

  if (!projectInfo && projectId) {
    const { data } = await asanaGet(`/projects/${projectId}`, { opt_fields: "name" });
    projectInfo = data ? { gid: data.gid, name: data.name } : { gid: projectId, name: "unknown" };
  }

  return skillActionOk({
    items: {
      tasks: JSON.stringify(tasks),
      project: JSON.stringify(projectInfo),
    },
    msg: `Fetched ${tasks.length} tasks from ${projectInfo?.name || projectId}`,
  });
}

export async function readTaskComments(_userId, input) {
  const inObj = typeof input === "object" && input ? input : {};
  const taskId = String(inObj.task_id || "").trim();
  if (!taskId) return skillActionErr("task_id is required.");
  const limit = Math.min(Number(inObj.limit) || 10, 50);

  const { ok, data, error } = await asanaGet(`/tasks/${taskId}/stories`, {
    opt_fields: "created_by.name,text,created_at,type,resource_subtype",
    limit,
  });
  if (!ok) return skillActionErr(`Failed to fetch comments: ${error}`);

  const comments = (data || [])
    .filter((s) => s.resource_subtype === "comment_added")
    .map((s) => ({
      author: s.created_by?.name || "unknown",
      text: (s.text || "").slice(0, 500),
      created_at: s.created_at,
      type: s.resource_subtype,
    }));

  return skillActionOk({
    items: { comments: JSON.stringify(comments) },
    msg: `Fetched ${comments.length} comments for task ${taskId}`,
  });
}

export default { skillBook, readProjectTasks, readTaskComments };

/**
 * Asana weapon — unified Asana REST API connector.
 *
 * Auth: ASANA_ACCESS_TOKEN from profiles.env_vars or process.env.
 */
import { database } from "@/libs/council/database";

const API_BASE = "https://app.asana.com/api/1.0";

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

async function getToken(userId) {
  if (process.env.ASANA_ACCESS_TOKEN) return process.env.ASANA_ACCESS_TOKEN;
  if (!userId) return null;
  const db = await database.init("service");
  const { data } = await db
    .from("profiles")
    .select("env_vars")
    .eq("id", userId)
    .single();
  return data?.env_vars?.ASANA_ACCESS_TOKEN ?? null;
}

async function asanaFetch(path, opts = {}, userId) {
  const token = await getToken(userId);
  if (!token) throw new Error("Missing ASANA_ACCESS_TOKEN");
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...opts.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Asana API ${res.status}: ${body.slice(0, 500)}`);
  }
  const json = await res.json();
  return json.data !== undefined ? json : json;
}

// ---------------------------------------------------------------------------
// Workspaces
// ---------------------------------------------------------------------------

/**
 * List all workspaces the token has access to.
 * @param {object} [input]
 * @param {string} [userId]
 */
export async function searchWorkspaces(input = {}, userId) {
  const res = await asanaFetch("/workspaces?limit=100", {}, userId);
  return { workspaces: res.data || [] };
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

/**
 * Search projects by name or list all in a workspace.
 * @param {{ workspace_id?: string, query?: string, limit?: number }} input
 * @param {string} [userId]
 */
export async function searchProjects({ workspace_id, query, limit = 100 } = {}, userId) {
  if (workspace_id) {
    const res = await asanaFetch(
      `/projects?workspace=${workspace_id}&opt_fields=name,archived,color&limit=${limit}`,
      {},
      userId,
    );
    let projects = res.data || [];
    if (query) {
      const q = query.toLowerCase();
      projects = projects.filter((p) => p.name.toLowerCase().includes(q));
    }
    return { projects };
  }
  // Search all workspaces
  const { workspaces } = await searchWorkspaces({}, userId);
  const all = [];
  for (const ws of workspaces) {
    const res = await asanaFetch(
      `/projects?workspace=${ws.gid}&opt_fields=name,archived,color&limit=${limit}`,
      {},
      userId,
    );
    let projects = res.data || [];
    if (query) {
      const q = query.toLowerCase();
      projects = projects.filter((p) => p.name.toLowerCase().includes(q));
    }
    all.push(...projects);
  }
  return { projects: all };
}

/**
 * Read a single project by GID.
 * @param {{ project_id: string }} input
 * @param {string} [userId]
 */
export async function readProject({ project_id } = {}, userId) {
  if (!project_id) throw new Error("project_id is required");
  const res = await asanaFetch(
    `/projects/${project_id}?opt_fields=name,notes,archived,color,created_at,modified_at,owner.name,members.name`,
    {},
    userId,
  );
  return res.data || res;
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

/**
 * Search tasks in a project or by assignee.
 * @param {{ project_id?: string, assignee?: string, workspace_id?: string, completed?: boolean, limit?: number }} input
 * @param {string} [userId]
 */
export async function searchTasks({ project_id, assignee, workspace_id, completed, limit = 100 } = {}, userId) {
  const optFields = "name,notes,completed,assignee.name,memberships.section.name,tags.name,due_on,created_at,modified_at";

  if (project_id) {
    const params = new URLSearchParams({ opt_fields: optFields, limit: String(limit) });
    if (completed === false) params.set("completed_since", "now");
    const allTasks = [];
    let offset = null;
    do {
      if (offset) params.set("offset", offset);
      const res = await asanaFetch(`/projects/${project_id}/tasks?${params}`, {}, userId);
      if (res.data) allTasks.push(...res.data);
      offset = res.next_page?.offset || null;
    } while (offset && allTasks.length < limit);
    return { tasks: allTasks.slice(0, limit) };
  }

  if (assignee && workspace_id) {
    const params = new URLSearchParams({
      assignee,
      workspace: workspace_id,
      opt_fields: optFields,
      limit: String(limit),
    });
    if (completed === false) params.set("completed_since", "now");
    const res = await asanaFetch(`/tasks?${params}`, {}, userId);
    return { tasks: res.data || [] };
  }

  throw new Error("Either project_id or both assignee + workspace_id are required.");
}

/**
 * Read a single task by GID.
 * @param {{ task_id: string }} input
 * @param {string} [userId]
 */
export async function readTask({ task_id } = {}, userId) {
  if (!task_id) throw new Error("task_id is required");
  const res = await asanaFetch(
    `/tasks/${task_id}?opt_fields=name,notes,completed,assignee.name,memberships.section.name,tags.name,due_on,created_at,modified_at,parent.name,custom_fields`,
    {},
    userId,
  );
  return res.data || res;
}

/**
 * Create or update a task.
 * @param {{ task_id?: string, project_id?: string, name?: string, notes?: string, assignee?: string, due_on?: string, completed?: boolean }} input
 * @param {string} [userId]
 */
export async function writeTask({ task_id, project_id, name, notes, assignee, due_on, completed } = {}, userId) {
  const body = {};
  if (name != null) body.name = name;
  if (notes != null) body.notes = notes;
  if (assignee != null) body.assignee = assignee;
  if (due_on != null) body.due_on = due_on;
  if (completed != null) body.completed = completed;

  if (task_id) {
    // Update existing task
    const res = await asanaFetch(
      `/tasks/${task_id}`,
      { method: "PUT", body: JSON.stringify({ data: body }) },
      userId,
    );
    return res.data || res;
  }

  // Create new task
  if (!project_id && !body.projects) {
    throw new Error("project_id is required when creating a new task");
  }
  if (project_id) body.projects = [project_id];
  const res = await asanaFetch(
    "/tasks",
    { method: "POST", body: JSON.stringify({ data: body }) },
    userId,
  );
  return res.data || res;
}

/**
 * Delete a task.
 * @param {{ task_id: string }} input
 * @param {string} [userId]
 */
export async function deleteTask({ task_id } = {}, userId) {
  if (!task_id) throw new Error("task_id is required");
  await asanaFetch(`/tasks/${task_id}`, { method: "DELETE" }, userId);
  return { ok: true, deleted: task_id };
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

/**
 * Read sections in a project.
 * @param {{ project_id: string }} input
 * @param {string} [userId]
 */
export async function readSections({ project_id } = {}, userId) {
  if (!project_id) throw new Error("project_id is required");
  const res = await asanaFetch(`/projects/${project_id}/sections?opt_fields=name`, {}, userId);
  return { sections: res.data || [] };
}

// ---------------------------------------------------------------------------
// Comments / Stories
// ---------------------------------------------------------------------------

/**
 * Read comments on a task.
 * @param {{ task_id: string, limit?: number }} input
 * @param {string} [userId]
 */
export async function readComments({ task_id, limit = 20 } = {}, userId) {
  if (!task_id) throw new Error("task_id is required");
  const res = await asanaFetch(
    `/tasks/${task_id}/stories?opt_fields=created_by.name,text,created_at,resource_subtype&limit=${limit}`,
    {},
    userId,
  );
  const comments = (res.data || [])
    .filter((s) => s.resource_subtype === "comment_added")
    .map((s) => ({
      author: s.created_by?.name || "unknown",
      text: (s.text || "").slice(0, 1000),
      created_at: s.created_at,
    }));
  return { comments };
}

/**
 * Write a comment on a task.
 * @param {{ task_id: string, text: string }} input
 * @param {string} [userId]
 */
export async function writeComment({ task_id, text } = {}, userId) {
  if (!task_id) throw new Error("task_id is required");
  if (!text) throw new Error("text is required");
  const res = await asanaFetch(
    `/tasks/${task_id}/stories`,
    { method: "POST", body: JSON.stringify({ data: { text } }) },
    userId,
  );
  return res.data || res;
}

// ---------------------------------------------------------------------------
// Credential check
// ---------------------------------------------------------------------------

export async function checkCredentials(userId) {
  try {
    const token = await getToken(userId);
    if (token) {
      return { ok: true, msg: "ASANA_ACCESS_TOKEN is set" };
    }
    return {
      ok: false,
      msg: "Missing ASANA_ACCESS_TOKEN — add it to profile env_vars or process.env.",
    };
  } catch (e) {
    return { ok: false, msg: `Error: ${e.message}` };
  }
}

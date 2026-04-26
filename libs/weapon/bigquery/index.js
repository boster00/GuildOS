/**
 * BigQuery weapon — queries Google BigQuery via the REST API v2 (jobs.query).
 * Auth: GOOGLE_SERVICE_ACCOUNT in profiles.env_vars (service account JSON), falls back to process.env.
 */

export const toc = {
  searchDatasets: "Search BigQuery datasets available to the service account.",
  readRecentEvents: "Read the most recent rows from a BigQuery table.",
  insertRows: "Stream-insert rows into a BigQuery table via tabledata.insertAll.",
};
import { getGoogleCredentials } from "@/libs/council/profileEnvVars";

const BIGQUERY_API = "https://bigquery.googleapis.com/bigquery/v2";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

async function resolveUserId(explicit) {
  if (explicit) return explicit;
  try {
    const { getAdventurerExecutionUserId } = await import("@/libs/adventurer/advance.js");
    const ctxId = getAdventurerExecutionUserId();
    if (ctxId) return ctxId;
  } catch { /* not in adventurer context */ }
  const { requireUser } = await import("@/libs/council/auth/server");
  const user = await requireUser();
  return user.id;
}

async function getServiceAccountKey(userId) {
  const creds = await getGoogleCredentials(userId);
  const raw = creds.serviceAccountJson;
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT is not set in profiles.env_vars or process.env.");
  const key = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (!key.client_email || !key.private_key) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT missing client_email or private_key.");
  }
  return key;
}

/**
 * Build a signed JWT and exchange it for a BigQuery access token.
 * @param {string} userId
 * @returns {Promise<string>}
 */
async function getAccessToken(userId, scope = "https://www.googleapis.com/auth/bigquery.readonly") {
  const key = await getServiceAccountKey(userId);
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: key.client_email,
    scope,
    aud: key.token_uri || TOKEN_URL,
    iat: now,
    exp: now + 3600,
  };

  const enc = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");
  const unsigned = `${enc(header)}.${enc(payload)}`;

  const crypto = await import("node:crypto");
  const sign = crypto.createSign("RSA-SHA256");
  sign.update(unsigned);
  const signature = sign.sign(key.private_key, "base64url");
  const jwt = `${unsigned}.${signature}`;

  const res = await fetch(key.token_uri || TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed (${res.status}): ${text}`);
  }
  const data = await res.json();
  return data.access_token;
}

async function getProjectId(userId) {
  const key = await getServiceAccountKey(userId);
  return key.project_id || "";
}

/**
 * List datasets in the project.
 * @param {string} [userId]
 * @returns {Promise<Array<{ datasetId: string, location: string }>>}
 */
export async function searchDatasets(userId) {
  const uid = await resolveUserId(userId);
  const token = await getAccessToken(uid);
  const projectId = await getProjectId(uid);
  if (!projectId) throw new Error("project_id missing from service account key.");

  const res = await fetch(`${BIGQUERY_API}/projects/${projectId}/datasets`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`searchDatasets failed (${res.status}): ${text}`);
  }
  const body = await res.json();
  return (body.datasets || []).map((d) => ({
    datasetId: d.datasetReference?.datasetId || "",
    location: d.location || "",
  }));
}

/**
 * Query recent events from a table using jobs.query.
 * @param {string} datasetId
 * @param {string} tableId
 * @param {number} [limit=10]
 * @param {string} [userId]
 * @returns {Promise<{ rows: Array<Record<string, unknown>> }>}
 */
export async function readRecentEvents(datasetId, tableId, limit = 10, userId) {
  if (!datasetId || !tableId) throw new Error("datasetId and tableId are required.");
  const uid = await resolveUserId(userId);
  const token = await getAccessToken(uid);
  const projectId = await getProjectId(uid);
  if (!projectId) throw new Error("project_id missing from service account key.");

  const n = Math.max(1, Math.min(Number(limit) || 10, 1000));
  const query = `SELECT * FROM \`${projectId}.${datasetId}.${tableId}\` ORDER BY _PARTITIONTIME DESC LIMIT ${n}`;

  const res = await fetch(`${BIGQUERY_API}/projects/${projectId}/jobs`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ configuration: { query: { query, useLegacySql: false } } }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`BigQuery jobs.query failed (${res.status}): ${text}`);
  }
  const job = await res.json();
  const jobId = job.jobReference?.jobId;
  if (!jobId) throw new Error("No jobId returned from BigQuery.");

  let status = job.status?.state;
  while (status !== "DONE") {
    await new Promise((r) => setTimeout(r, 1000));
    const pollRes = await fetch(`${BIGQUERY_API}/projects/${projectId}/jobs/${jobId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!pollRes.ok) {
      const text = await pollRes.text();
      throw new Error(`BigQuery job poll failed (${pollRes.status}): ${text}`);
    }
    const pollData = await pollRes.json();
    status = pollData.status?.state;
    if (pollData.status?.errorResult) {
      throw new Error(`BigQuery job error: ${JSON.stringify(pollData.status.errorResult)}`);
    }
  }

  const resultsRes = await fetch(
    `${BIGQUERY_API}/projects/${projectId}/jobs/${jobId}/getQueryResults?maxResults=${n}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!resultsRes.ok) {
    const text = await resultsRes.text();
    throw new Error(`BigQuery getQueryResults failed (${resultsRes.status}): ${text}`);
  }
  const resultsData = await resultsRes.json();
  const fields = (resultsData.schema?.fields || []).map((f) => f.name);
  const rows = (resultsData.rows || []).map((row) => {
    const obj = {};
    (row.f || []).forEach((cell, i) => { obj[fields[i] || `col_${i}`] = cell.v; });
    return obj;
  });
  return { rows };
}

/**
 * Stream-insert rows into a BigQuery table.
 * @param {{ datasetId: string, tableId: string, rows: Array<{insertId?: string, json: Record<string, unknown>}>, userId?: string }} params
 * @returns {Promise<{ inserted: number, errors: Array<{index: number, errors: unknown}> }>}
 */
export async function insertRows({ datasetId, tableId, rows, userId }) {
  if (!datasetId || !tableId) throw new Error("datasetId and tableId are required.");
  if (!Array.isArray(rows) || rows.length === 0) return { inserted: 0, errors: [] };
  const uid = await resolveUserId(userId);
  const token = await getAccessToken(uid, "https://www.googleapis.com/auth/bigquery");
  const projectId = await getProjectId(uid);

  const res = await fetch(
    `${BIGQUERY_API}/projects/${projectId}/datasets/${datasetId}/tables/${tableId}/insertAll`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ rows, skipInvalidRows: false, ignoreUnknownValues: false }),
    },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`insertAll failed (${res.status}): ${text}`);
  }
  const body = await res.json();
  const errors = (body.insertErrors || []).map((e) => ({ index: e.index, errors: e.errors }));
  return { inserted: rows.length - errors.length, errors };
}

/**
 * Check whether Google service account credentials are available.
 * @param {string} [userId]
 */
export async function checkCredentials(userId) {
  try {
    const uid = await resolveUserId(userId);
    const creds = await getGoogleCredentials(uid);
    if (!creds.serviceAccountJson) return { ok: false, projectId: "" };
    const key = typeof creds.serviceAccountJson === "string"
      ? JSON.parse(creds.serviceAccountJson)
      : creds.serviceAccountJson;
    return { ok: true, projectId: key.project_id || "" };
  } catch {
    return { ok: false, projectId: "" };
  }
}

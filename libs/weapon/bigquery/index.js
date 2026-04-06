/**
 * BigQuery weapon — queries Google BigQuery via the REST API v2 (jobs.query).
 * Auth: GOOGLE_BIGQUERY_KEY_JSON env var (service account JSON).
 */

const BIGQUERY_API = "https://bigquery.googleapis.com/bigquery/v2";

/**
 * Build a signed JWT and exchange it for an access token.
 * @returns {Promise<string>}
 */
async function getAccessToken() {
  const raw = process.env.GOOGLE_BIGQUERY_KEY_JSON;
  if (!raw) throw new Error("GOOGLE_BIGQUERY_KEY_JSON is not set.");
  const key = JSON.parse(raw);
  const { client_email, private_key, token_uri } = key;
  if (!client_email || !private_key) {
    throw new Error("GOOGLE_BIGQUERY_KEY_JSON missing client_email or private_key.");
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: client_email,
    scope: "https://www.googleapis.com/auth/bigquery.readonly",
    aud: token_uri || "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const enc = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");
  const unsigned = `${enc(header)}.${enc(payload)}`;

  const crypto = await import("node:crypto");
  const sign = crypto.createSign("RSA-SHA256");
  sign.update(unsigned);
  const signature = sign.sign(private_key, "base64url");

  const jwt = `${unsigned}.${signature}`;

  const res = await fetch(token_uri || "https://oauth2.googleapis.com/token", {
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

/**
 * Extract projectId from the service-account key JSON.
 * @returns {string}
 */
function getProjectId() {
  const raw = process.env.GOOGLE_BIGQUERY_KEY_JSON;
  if (!raw) throw new Error("GOOGLE_BIGQUERY_KEY_JSON is not set.");
  const key = JSON.parse(raw);
  return key.project_id || "";
}

/**
 * List datasets in the project.
 * @returns {Promise<Array<{ datasetId: string, location: string }>>}
 */
export async function listDatasets() {
  const token = await getAccessToken();
  const projectId = getProjectId();
  if (!projectId) throw new Error("project_id missing from service account key.");

  const res = await fetch(`${BIGQUERY_API}/projects/${projectId}/datasets`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`listDatasets failed (${res.status}): ${text}`);
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
 * @returns {Promise<{ rows: Array<Record<string, unknown>> }>}
 */
export async function getRecentEvents(datasetId, tableId, limit = 10) {
  if (!datasetId || !tableId) throw new Error("datasetId and tableId are required.");
  const token = await getAccessToken();
  const projectId = getProjectId();
  if (!projectId) throw new Error("project_id missing from service account key.");

  const n = Math.max(1, Math.min(Number(limit) || 10, 1000));
  const query = `SELECT * FROM \`${projectId}.${datasetId}.${tableId}\` ORDER BY _PARTITIONTIME DESC LIMIT ${n}`;

  const res = await fetch(`${BIGQUERY_API}/projects/${projectId}/jobs`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      configuration: {
        query: {
          query,
          useLegacySql: false,
        },
      },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`BigQuery jobs.query failed (${res.status}): ${text}`);
  }
  const job = await res.json();

  // Poll for completion
  const jobId = job.jobReference?.jobId;
  if (!jobId) throw new Error("No jobId returned from BigQuery.");

  let status = job.status?.state;
  while (status !== "DONE") {
    await new Promise((r) => setTimeout(r, 1000));
    const pollRes = await fetch(
      `${BIGQUERY_API}/projects/${projectId}/jobs/${jobId}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
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

  // Fetch results
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
    (row.f || []).forEach((cell, i) => {
      obj[fields[i] || `col_${i}`] = cell.v;
    });
    return obj;
  });

  return { rows };
}

/**
 * Check whether the BigQuery credential env var is set.
 * @returns {{ ok: boolean, projectId: string }}
 */
export function checkCredentials() {
  const raw = process.env.GOOGLE_BIGQUERY_KEY_JSON;
  if (!raw) return { ok: false, projectId: "" };
  try {
    const key = JSON.parse(raw);
    return { ok: true, projectId: key.project_id || "" };
  } catch {
    return { ok: false, projectId: "" };
  }
}

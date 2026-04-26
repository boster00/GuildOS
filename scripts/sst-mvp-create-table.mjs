// Create the server-side tracking MVP landing table in BQ.
// Run from main repo: node --env-file=.env.local scripts/sst-mvp-create-table.mjs
import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

const USER_EMAIL = process.env.AUDIT_EMAIL || "xsj706@gmail.com";
const DATASET = process.env.SST_DATASET || "CDB";
const TABLE = process.env.SST_TABLE || "events_serverside_mvp";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRETE_KEY, { auth: { persistSession: false } });
const { data: users } = await sb.auth.admin.listUsers({ perPage: 200 });
const user = users.users.find((u) => u.email === USER_EMAIL);
const { data: prof } = await sb.from("profiles").select("env_vars").eq("id", user.id).maybeSingle();
const sa = JSON.parse(prof.env_vars.GOOGLE_SERVICE_ACCOUNT);
const PROJECT = sa.project_id;

const now = Math.floor(Date.now() / 1000);
const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
const payload = Buffer.from(JSON.stringify({
  iss: sa.client_email,
  scope: "https://www.googleapis.com/auth/bigquery",
  aud: sa.token_uri || "https://oauth2.googleapis.com/token",
  iat: now, exp: now + 3600,
})).toString("base64url");
const unsigned = `${header}.${payload}`;
const sig = crypto.createSign("RSA-SHA256").update(unsigned).sign(sa.private_key, "base64url");
const jwt = `${unsigned}.${sig}`;
const tokRes = await fetch(sa.token_uri || "https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
});
const TOKEN = (await tokRes.json()).access_token;

const schema = {
  fields: [
    { name: "ingestion_timestamp", type: "TIMESTAMP", mode: "REQUIRED" },
    { name: "event_timestamp", type: "TIMESTAMP", mode: "REQUIRED" },
    { name: "event_name", type: "STRING", mode: "REQUIRED" },
    { name: "event_id", type: "STRING", mode: "REQUIRED", description: "Idempotency key" },
    { name: "user_pseudo_id", type: "STRING" },
    { name: "user_id", type: "STRING" },
    { name: "session_id", type: "STRING" },
    { name: "session_number", type: "INT64" },
    { name: "page_location", type: "STRING" },
    { name: "page_referrer", type: "STRING" },
    { name: "page_title", type: "STRING" },
    { name: "page_path", type: "STRING" },
    { name: "source", type: "STRING" },
    { name: "medium", type: "STRING" },
    { name: "campaign", type: "STRING" },
    { name: "term", type: "STRING" },
    { name: "content", type: "STRING" },
    { name: "gclid", type: "STRING" },
    { name: "first_gclid", type: "STRING" },
    { name: "gad_source", type: "STRING" },
    { name: "gad_campaignid", type: "STRING" },
    { name: "srsltid", type: "STRING" },
    { name: "transaction_id", type: "STRING" },
    { name: "value", type: "FLOAT64" },
    { name: "currency", type: "STRING" },
    { name: "tax", type: "FLOAT64" },
    { name: "shipping", type: "FLOAT64" },
    { name: "coupon", type: "STRING" },
    { name: "items", type: "JSON" },
    { name: "form_id", type: "STRING" },
    { name: "form_destination", type: "STRING" },
    { name: "form_length", type: "INT64" },
    { name: "first_field_id", type: "STRING" },
    { name: "first_field_name", type: "STRING" },
    { name: "first_field_type", type: "STRING" },
    { name: "first_field_position", type: "INT64" },
    { name: "event_params", type: "JSON", description: "Catch-all for any extra params" },
    { name: "client_ip", type: "STRING" },
    { name: "user_agent", type: "STRING" },
    { name: "device_category", type: "STRING" },
    { name: "language", type: "STRING" },
    { name: "screen_resolution", type: "STRING" },
    { name: "raw_payload", type: "JSON", description: "Original POST body for debugging" },
  ],
};

// Check if table exists
const checkRes = await fetch(`https://bigquery.googleapis.com/bigquery/v2/projects/${PROJECT}/datasets/${DATASET}/tables/${TABLE}`, {
  headers: { Authorization: `Bearer ${TOKEN}` },
});
if (checkRes.ok) {
  console.log(`Table ${PROJECT}.${DATASET}.${TABLE} already exists. Updating schema (additive)...`);
  const existing = await checkRes.json();
  const existingNames = new Set((existing.schema?.fields || []).map((f) => f.name));
  const merged = [
    ...(existing.schema?.fields || []),
    ...schema.fields.filter((f) => !existingNames.has(f.name)),
  ];
  const patch = await fetch(`https://bigquery.googleapis.com/bigquery/v2/projects/${PROJECT}/datasets/${DATASET}/tables/${TABLE}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ schema: { fields: merged } }),
  });
  console.log("Schema update:", patch.status, (await patch.json()).schema?.fields?.length, "fields");
} else if (checkRes.status === 404) {
  console.log(`Creating ${PROJECT}.${DATASET}.${TABLE}...`);
  const createRes = await fetch(`https://bigquery.googleapis.com/bigquery/v2/projects/${PROJECT}/datasets/${DATASET}/tables`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      tableReference: { projectId: PROJECT, datasetId: DATASET, tableId: TABLE },
      schema,
      timePartitioning: { type: "DAY", field: "ingestion_timestamp" },
      clustering: { fields: ["event_name", "user_pseudo_id"] },
      description: "Server-side tracking MVP landing table — comparison vs analytics_362731773 GA4 export",
    }),
  });
  const body = await createRes.json();
  if (!createRes.ok) { console.error("Create failed:", body); process.exit(1); }
  console.log("Created. id:", body.id);
} else {
  console.error("Unexpected response:", checkRes.status, await checkRes.text());
  process.exit(1);
}

console.log(`Done: ${PROJECT}.${DATASET}.${TABLE}`);

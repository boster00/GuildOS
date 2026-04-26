/**
 * Server-side tracking MVP — receives client beacons, normalizes, writes to BQ.
 * Comparison target: GA4 export `boster-cbi.analytics_362731773.events_*`.
 * Landing table: `boster-cbi.CDB.events_serverside_mvp` (created by sst-mvp-create-table.mjs).
 */
import { insertRows } from "@/libs/weapon/bigquery";

export const SST_DATASET = "CDB";
export const SST_TABLE = "events_serverside_mvp";
export const SST_OWNER_USER_ID = process.env.SST_OWNER_USER_ID || ""; // resolved at request time if blank

// Tier-1 + Tier-2 event allowlist. Names match GA4 exactly so count diffs are direct.
export const ALLOWED_EVENTS = new Set([
  // Tier 1
  "page_view",
  "session_start",
  "purchase",
  "form_submit",
  "GAds Conversion",
  "P4. Add to cart",
  "P3.1 Add to cart",
  // Tier 2
  "P1. Search",
  "P2. Click product link",
  "P2 Click Product Link",
  "P2.2 View Datasheet",
  "P3.1.3 Begin Checkout",
  // Smoke-test sentinel
  "_sst_smoke",
]);

const STR = (v) => (v == null ? null : String(v).slice(0, 8192));
const NUM = (v) => {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const INT = (v) => {
  const n = NUM(v);
  return n == null ? null : Math.trunc(n);
};
const TIMESTAMP = (v) => {
  if (!v) return new Date().toISOString();
  if (typeof v === "number") return new Date(v < 1e12 ? v * 1000 : v).toISOString();
  return new Date(v).toISOString();
};

/**
 * Normalize one client payload into a BQ row matching the table schema.
 * Unknown fields are routed into `event_params` (JSON catch-all).
 * @param {Record<string, unknown>} body
 * @param {{ ip?: string, userAgent?: string, ingestionTime?: string }} ctx
 */
export function normalizePayload(body, ctx = {}) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: "Body must be an object." };
  }
  const eventName = STR(body.event_name);
  if (!eventName) return { error: "event_name is required." };
  if (!ALLOWED_EVENTS.has(eventName)) {
    return { error: `event_name "${eventName}" not in allowlist.` };
  }
  const eventId = STR(body.event_id) || cryptoRandomId();

  const KNOWN = new Set([
    "event_name", "event_id", "event_timestamp",
    "user_pseudo_id", "user_id", "session_id", "session_number",
    "page_location", "page_referrer", "page_title", "page_path",
    "source", "medium", "campaign", "term", "content",
    "gclid", "first_gclid", "gad_source", "gad_campaignid", "srsltid",
    "transaction_id", "value", "currency", "tax", "shipping", "coupon", "items",
    "form_id", "form_destination", "form_length",
    "first_field_id", "first_field_name", "first_field_type", "first_field_position",
    "device_category", "language", "screen_resolution",
  ]);
  const extra = {};
  for (const [k, v] of Object.entries(body)) {
    if (!KNOWN.has(k)) extra[k] = v;
  }

  const row = {
    ingestion_timestamp: ctx.ingestionTime || new Date().toISOString(),
    event_timestamp: TIMESTAMP(body.event_timestamp),
    event_name: eventName,
    event_id: eventId,
    user_pseudo_id: STR(body.user_pseudo_id),
    user_id: STR(body.user_id),
    session_id: STR(body.session_id),
    session_number: INT(body.session_number),
    page_location: STR(body.page_location),
    page_referrer: STR(body.page_referrer),
    page_title: STR(body.page_title),
    page_path: STR(body.page_path),
    source: STR(body.source),
    medium: STR(body.medium),
    campaign: STR(body.campaign),
    term: STR(body.term),
    content: STR(body.content),
    gclid: STR(body.gclid),
    first_gclid: STR(body.first_gclid),
    gad_source: STR(body.gad_source),
    gad_campaignid: STR(body.gad_campaignid),
    srsltid: STR(body.srsltid),
    transaction_id: STR(body.transaction_id),
    value: NUM(body.value),
    currency: STR(body.currency),
    tax: NUM(body.tax),
    shipping: NUM(body.shipping),
    coupon: STR(body.coupon),
    items: body.items != null ? JSON.stringify(body.items) : null,
    form_id: STR(body.form_id),
    form_destination: STR(body.form_destination),
    form_length: INT(body.form_length),
    first_field_id: STR(body.first_field_id),
    first_field_name: STR(body.first_field_name),
    first_field_type: STR(body.first_field_type),
    first_field_position: INT(body.first_field_position),
    event_params: Object.keys(extra).length ? JSON.stringify(extra) : null,
    client_ip: STR(ctx.ip),
    user_agent: STR(ctx.userAgent),
    device_category: STR(body.device_category),
    language: STR(body.language),
    screen_resolution: STR(body.screen_resolution),
    raw_payload: JSON.stringify(body),
  };
  return { row, eventId };
}

function cryptoRandomId() {
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * Ingest 1+ events. Returns inserted count + per-row errors.
 * @param {Array<Record<string, unknown>>} events
 * @param {{ ip?: string, userAgent?: string }} ctx
 */
export async function ingestEvents(events, ctx = {}) {
  const ingestionTime = new Date().toISOString();
  const rows = [];
  const rejected = [];
  for (let i = 0; i < events.length; i++) {
    const out = normalizePayload(events[i], { ...ctx, ingestionTime });
    if (out.error) {
      rejected.push({ index: i, error: out.error });
    } else {
      rows.push({ insertId: out.eventId, json: out.row });
    }
  }
  if (rows.length === 0) return { inserted: 0, rejected, errors: [] };
  const userId = SST_OWNER_USER_ID || undefined;
  const result = await insertRows({ datasetId: SST_DATASET, tableId: SST_TABLE, rows, userId });
  return { inserted: result.inserted, rejected, errors: result.errors };
}

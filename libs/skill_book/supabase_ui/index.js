import {
  readTable as wReadTable,
  readLogs as wReadLogs,
  readAPISettings as wReadAPISettings,
  readStorageBuckets as wReadStorageBuckets,
  checkCredentials as wCheckCredentials,
} from "@/libs/weapon/supabase_ui";
import { skillActionOk, skillActionErr } from "@/libs/skill_book/actionResult.js";

export const skillBook = {
  id: "supabase_ui",
  title: "Supabase UI",
  description:
    "Control the Supabase web dashboard at app.supabase.com via Browserclaw CDP. " +
    "Use this for UI-only operations: reading tables, browsing logs, inspecting settings. " +
    "For programmatic DB access use the database facade instead.",
  steps: [],
  toc: {
    readTable: {
      description: "Read rows from a database table via the Supabase REST API.",
      input: { table: "string — table name", limit: "int, default 50", filter: "string, optional PostgREST filter e.g. 'status=eq.active'" },
      output: { rows: "array of row objects", total: "int — total row count if available" },
    },
    readLogs: {
      description: "Read recent logs from the Supabase dashboard via CDP.",
      input: { service: "string — 'postgres' | 'auth' | 'realtime' | 'edge-functions' | 'postgrest', default 'postgres'", limit: "int, default 50" },
      output: { logs: "array of log entries", service: "string" },
    },
    readAPISettings: {
      description: "Read API URL, anon key, and service role key from the Supabase settings page via CDP.",
      input: {},
      output: { text: "string — extracted page text", apiKeys: "object — raw API keys response if captured" },
    },
    readStorageBuckets: {
      description: "List storage buckets visible in the Supabase dashboard via CDP.",
      input: {},
      output: { buckets: "array of bucket objects" },
    },
  },
};

export async function readTable(a, b) {
  const [userId, input] = typeof a === "string" ? [a, b ?? {}] : [undefined, a ?? {}];
  if (!input?.table) return skillActionErr("table required");
  try {
    const data = await wReadTable({ table: input.table, limit: input.limit, filter: input.filter }, userId);
    return skillActionOk(data);
  } catch (e) { return skillActionErr(e.message); }
}

export async function readLogs(a, b) {
  const [userId, input] = typeof a === "string" ? [a, b ?? {}] : [undefined, a ?? {}];
  try {
    const data = await wReadLogs({ service: input?.service, limit: input?.limit }, userId);
    return skillActionOk(data);
  } catch (e) { return skillActionErr(e.message); }
}

export async function readAPISettings(a, b) {
  const [userId, input] = typeof a === "string" ? [a, b ?? {}] : [undefined, a ?? {}];
  try {
    const data = await wReadAPISettings({}, userId);
    return skillActionOk(data);
  } catch (e) { return skillActionErr(e.message); }
}

export async function readStorageBuckets(a, b) {
  const [userId, input] = typeof a === "string" ? [a, b ?? {}] : [undefined, a ?? {}];
  try {
    const data = await wReadStorageBuckets({}, userId);
    return skillActionOk(data);
  } catch (e) { return skillActionErr(e.message); }
}

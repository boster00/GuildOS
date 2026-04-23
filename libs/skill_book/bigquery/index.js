/**
 * BigQuery skill book — query recent events from a BigQuery table.
 */
import { readRecentEvents as bqGetRecentEvents } from "@/libs/weapon/bigquery";
import { skillActionOk, skillActionErr } from "@/libs/skill_book/actionResult.js";

export const skillBook = {
  id: "bigquery",
  title: "BigQuery",
  description: "Query Google BigQuery tables for recent event data.",
  steps: [],
  toc: {
    readRecentEvents: {
      description: "Return the most recent rows from a BigQuery table, ordered by partition time.",
      input: {
        datasetId: "string, e.g. your_dataset",
        tableId: "string, e.g. your_table",
        limit: "int, e.g. 10",
      },
      output: {
        rows: "array of objects",
      },
    },
  },
};

/**
 * @param {unknown} [a] userId or payload
 * @param {unknown} [b] payload when a is userId
 * @returns {Promise<{ ok: boolean, msg: string, items: Record<string, unknown> }>}
 */
export async function readRecentEvents(a, b) {
  const input =
    b !== undefined && typeof b === "object" && b !== null && !Array.isArray(b)
      ? b
      : a !== undefined && typeof a === "object" && a !== null && !Array.isArray(a)
        ? a
        : {};
  const raw = /** @type {Record<string, unknown>} */ (input);
  const datasetId = String(raw.datasetId ?? "").trim();
  const tableId = String(raw.tableId ?? "").trim();
  const limit = Number(raw.limit ?? 10);

  if (!datasetId || !tableId) {
    return skillActionErr("datasetId and tableId are required.");
  }

  try {
    const result = await bqGetRecentEvents(datasetId, tableId, limit);
    return skillActionOk({ rows: result.rows });
  } catch (e) {
    return skillActionErr(e instanceof Error ? e.message : String(e));
  }
}

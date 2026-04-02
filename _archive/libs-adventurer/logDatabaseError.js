/**
 * Server-side debug logging for PostgREST / storage errors (RLS, constraints, etc.).
 * @param {string} context — short label, e.g. "createAdventurer.insert"
 * @param {unknown} err
 * @param {Record<string, unknown>} [extra] — metadata; use `insertPayload` / `updatePayload` for full row bodies (lifted to top level for visibility)
 */
export function logDatabaseError(context, err, extra) {
  const errorFields =
    err && typeof err === "object"
      ? {
          message: "message" in err ? err.message : undefined,
          name: "name" in err ? err.name : undefined,
          code: "code" in err ? err.code : undefined,
          details: "details" in err ? err.details : undefined,
          hint: "hint" in err ? err.hint : undefined,
          status: "status" in err ? err.status : undefined,
        }
      : { value: err };

  const {
    insertPayload,
    updatePayload,
    ...restExtra
  } = extra || {};

  const payload = {
    context,
    ...(insertPayload !== undefined ? { insertPayload } : {}),
    ...(updatePayload !== undefined ? { updatePayload } : {}),
    ...(Object.keys(restExtra).length ? { extra: restExtra } : {}),
    error: errorFields,
  };

  if (err instanceof Error && err.stack) {
    payload.stack = err.stack;
  }

  console.error(`[GuildOS] ${context}\n${JSON.stringify(payload, null, 2)}`);
}

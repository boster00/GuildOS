/**
 * `capabilities` column stores either:
 * - Plain text (legacy / simple), or
 * - JSON envelope: `{ "d": "plain text for Cat", "x": { ...structured: avatars, class_id, overrides } }`
 *
 * Optional DB columns `extras` (jsonb) / `class_id` (text) from migrations are still read when present;
 * writes use the envelope only so slim schema (no extras column) works.
 */

/**
 * @param {unknown} raw
 * @returns {Record<string, unknown>}
 */
export function parseCapabilitiesText(raw) {
  if (raw == null || raw === "") return {};
  if (typeof raw === "object" && !Array.isArray(raw)) {
    return /** @type {Record<string, unknown>} */ (raw);
  }
  try {
    const o = JSON.parse(String(raw));
    return o && typeof o === "object" && !Array.isArray(o) ? /** @type {Record<string, unknown>} */ (o) : {};
  } catch {
    return {};
  }
}

/**
 * Structured blob: `extras` jsonb column if present, else `x` inside capabilities envelope, else legacy JSON in capabilities.
 * @param {unknown} extrasRaw
 * @param {unknown} capabilitiesLegacy
 */
export function parseExtras(extrasRaw, capabilitiesLegacy) {
  if (extrasRaw != null && typeof extrasRaw === "object" && !Array.isArray(extrasRaw)) {
    return /** @type {Record<string, unknown>} */ (extrasRaw);
  }
  if (typeof extrasRaw === "string" && extrasRaw.trim().startsWith("{")) {
    const o = parseCapabilitiesText(extrasRaw);
    if (Object.keys(o).length) return o;
  }
  const cap = parseCapabilitiesText(capabilitiesLegacy);
  if (cap && typeof cap.x === "object" && cap.x !== null && !Array.isArray(cap.x)) {
    return /** @type {Record<string, unknown>} */ (cap.x);
  }
  if (Object.keys(cap).length) {
    if ("d" in cap || "x" in cap) {
      const { d: _d, x: _x, ...rest } = cap;
      return /** @type {Record<string, unknown>} */ (rest);
    }
    return cap;
  }
  return {};
}

/**
 * Plain-text description for Cat / UI (envelope field `d`, else legacy keys, else whole string).
 * @param {{ capabilities?: unknown }} row
 * @returns {string}
 */
export function capabilitiesPlainFromRow(row) {
  const raw = row?.capabilities;
  if (raw == null || raw === "") return "";
  const s = String(raw).trim();
  if (!s.startsWith("{")) return s;
  try {
    const o = JSON.parse(s);
    if (!o || typeof o !== "object" || Array.isArray(o)) return "";
    if (typeof o.d === "string") return o.d;
    if (typeof o.agent_description === "string") return o.agent_description;
    if (typeof o.description === "string") return o.description;
    return "";
  } catch {
    return s;
  }
}

/**
 * Persist plain description + structured `x` in one text column (no `extras` column required).
 * @param {string} plainDescription
 * @param {Record<string, unknown>} xObj
 */
export function serializeCapabilitiesEnvelope(plainDescription, xObj) {
  const d = plainDescription != null ? String(plainDescription) : "";
  const x = xObj && typeof xObj === "object" && !Array.isArray(xObj) ? xObj : {};
  return JSON.stringify({ d, x });
}

/**
 * Merge keys into envelope `x` and rewrite `capabilities` column value.
 * @param {unknown} capabilitiesRaw
 * @param {Record<string, unknown>} xPatch
 */
export function mergeEnvelopeXIntoCapabilitiesColumn(capabilitiesRaw, xPatch) {
  const d = capabilitiesPlainFromRow({ capabilities: capabilitiesRaw });
  const prevX = parseExtras(null, capabilitiesRaw);
  const nextX = { ...prevX, ...xPatch };
  return serializeCapabilitiesEnvelope(d, nextX);
}

/**
 * Merge patch into extras object for in-memory use.
 * @param {unknown} existingExtras
 * @param {Record<string, unknown>} patch
 */
export function mergeExtrasPatch(existingExtras, patch) {
  const base = parseExtras(existingExtras, null);
  return { ...base, ...patch };
}

/**
 * @param {unknown} existingRaw
 * @param {Record<string, unknown>} patch
 */
export function mergeCapabilitiesJson(existingRaw, patch) {
  const base = parseCapabilitiesText(existingRaw);
  return JSON.stringify({ ...base, ...patch });
}

/**
 * Built-in class presets (scribe, questmaster, …) are keyed by the adventurer's `name`.
 * Synthetic global assignees may set `presetKey` when the roster name differs from the preset (e.g. assignee "cat" → questmaster tools).
 * @param {Record<string, unknown> | null | undefined} row
 * @returns {string} Lowercase key for {@link import("./classes.js").resolveClassForRuntime}
 */
export function adventurerPresetKey(row) {
  if (!row || typeof row !== "object") return "";
  const r = /** @type {Record<string, unknown>} */ (row);
  const explicit = r.presetKey != null ? String(r.presetKey).trim() : "";
  if (explicit) return explicit.toLowerCase();
  const fromName = r.name != null ? String(r.name).trim() : "";
  if (fromName) return fromName.toLowerCase();
  const extras = parseExtras(r.extras, r.capabilities);
  const legacy = extras.class_id != null ? String(extras.class_id).trim() : "";
  return legacy ? legacy.toLowerCase() : "";
}

/**
 * Expand DB row for runtime (extras-derived fields, plain capabilities text).
 * @param {Record<string, unknown> | null | undefined} row
 */
export function normalizeAdventurerRow(row) {
  if (!row || typeof row !== "object") return row;

  const rowModel = /** @type {Record<string, unknown>} */ (row);
  const extras = parseExtras(rowModel.extras, rowModel.capabilities);
  const plainCapabilities = capabilitiesPlainFromRow(rowModel);

  const classFromCol = rowModel.class_id != null ? String(rowModel.class_id).trim() : "";
  const classFromX = extras.class_id != null ? String(extras.class_id).trim() : "";
  const resolvedClassId = classFromCol || classFromX || null;

  const config =
    extras.config && typeof extras.config === "object" && !Array.isArray(extras.config)
      ? /** @type {Record<string, unknown>} */ (extras.config)
      : {};
  const mind_override =
    extras.mind_override && typeof extras.mind_override === "object" && !Array.isArray(extras.mind_override)
      ? /** @type {Record<string, unknown>} */ (extras.mind_override)
      : {};
  const metadata =
    extras.metadata && typeof extras.metadata === "object" && !Array.isArray(extras.metadata)
      ? /** @type {Record<string, unknown>} */ (extras.metadata)
      : {};

  const fallbackMind =
    rowModel.mind_override && typeof rowModel.mind_override === "object" && !Array.isArray(rowModel.mind_override)
      ? /** @type {Record<string, unknown>} */ (rowModel.mind_override)
      : {};
  const fallbackCfg =
    rowModel.config && typeof rowModel.config === "object" && !Array.isArray(rowModel.config)
      ? /** @type {Record<string, unknown>} */ (rowModel.config)
      : {};

  return {
    ...rowModel,
    capabilities: plainCapabilities,
    class_id: resolvedClassId,
    display_name: extras.display_name != null ? String(extras.display_name) : null,
    title: extras.title != null ? String(extras.title) : null,
    notes: extras.notes != null ? String(extras.notes) : null,
    model_id:
      extras.model_id != null
        ? String(extras.model_id)
        : rowModel.model_id != null
          ? String(rowModel.model_id)
          : null,
    max_agent_turns:
      extras.max_agent_turns != null
        ? Number(extras.max_agent_turns)
        : rowModel.max_agent_turns != null
          ? Number(rowModel.max_agent_turns)
          : null,
    mind_override: Object.keys(mind_override).length ? mind_override : fallbackMind,
    config: Object.keys(config).length ? config : fallbackCfg,
    metadata: Object.keys(metadata).length ? metadata : {},
    status: typeof extras.status === "string" ? extras.status : "active",
    sort_order: extras.sort_order != null ? Number(extras.sort_order) : 0,
    avatar_url: extras.avatar_url != null ? String(extras.avatar_url) : null,
    avatar_sheet_url: extras.avatar_sheet_url != null ? String(extras.avatar_sheet_url) : null,
  };
}

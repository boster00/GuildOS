/** Message types for runtime / cross-tab communication (keep keys stable). */
globalThis.BROWSERCLAW_MSG = Object.freeze({
  PING_FROM_CONTENT: "browserclaw:ping_from_content",
  BROADCAST_TO_TABS: "browserclaw:broadcast_to_tabs",
  TAB_BROADCAST: "browserclaw:tab_broadcast",
  GET_ACTIVE_TAB_META: "browserclaw:get_active_tab_meta",
  OPEN_OPTIONS_PAGE: "browserclaw:open_options_page",
  PIGEON_FETCH_LETTERS: "browserclaw:pigeon_fetch_letters",
  PIGEON_EXECUTE_NEXT_STEP: "browserclaw:pigeon_execute_next_step",
  PIGEON_SEND_PIGEON_RESULT: "browserclaw:pigeon_send_pigeon_result",
  PIGEON_GET_EXECUTION: "browserclaw:pigeon_get_execution",
  PIGEON_EXECUTE_ACTION: "browserclaw:pigeon_execute_action",
  AUTO_PILOT_SET: "browserclaw:auto_pilot_set",
  AUTO_PILOT_GET: "browserclaw:auto_pilot_get",
});

/**
 * Options page + content script read/write `chrome.storage.local` (typical MV3 pattern).
 */
globalThis.BROWSERCLAW_SETTINGS = Object.freeze({
  STORAGE_KEY_BUNNY_FAB_BG: "browserclaw_bunnyFabBg",
  DEFAULT_BUNNY_FAB_BG: "#ffffff",
  STORAGE_KEY_EVENT_LOG_ENABLED: "browserclaw_eventLogEnabled",
  STORAGE_KEY_GUILDOS_BASE_URL: "browserclaw_guildosBaseUrl",
  DEFAULT_GUILDOS_BASE_URL: "http://localhost:3002",
  STORAGE_KEY_PIGEON_API_KEY: "browserclaw_pigeonApiKey",
  STORAGE_KEY_PIGEON_PENDING_LIST: "browserclaw_pigeonPendingList",
  STORAGE_KEY_PIGEON_EXECUTION: "browserclaw_pigeonExecution",
  STORAGE_KEY_AUTO_PILOT_ENABLED: "browserclaw_autoPilotEnabled",
  STORAGE_KEY_AUTO_PILOT_STATUS: "browserclaw_autoPilotStatus",
});

/**
 * @param {unknown} raw
 * @returns {string | null} Lowercase #rrggbb or null
 */
globalThis.browserclawNormalizeBunnyFabBg = function browserclawNormalizeBunnyFabBg(raw) {
  if (raw == null || typeof raw !== "string") return null;
  const s = raw.trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(s)) return s.toLowerCase();
  if (/^#[0-9A-Fa-f]{3}$/.test(s)) {
    return ("#" + s[1] + s[1] + s[2] + s[2] + s[3] + s[3]).toLowerCase();
  }
  return null;
};

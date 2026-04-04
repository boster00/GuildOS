importScripts(chrome.runtime.getURL("shared/constants.js"));

const { BROWSERCLAW_MSG: MSG } = globalThis;
const SETTINGS = globalThis.BROWSERCLAW_SETTINGS;

const K_PENDING = SETTINGS.STORAGE_KEY_PIGEON_PENDING_LIST;
const K_EXEC = SETTINGS.STORAGE_KEY_PIGEON_EXECUTION;
const K_AUTO_PILOT = SETTINGS.STORAGE_KEY_AUTO_PILOT_ENABLED;
const K_AUTO_PILOT_STATUS = SETTINGS.STORAGE_KEY_AUTO_PILOT_STATUS;
const ALARM_NAME = "bc_auto_pilot";

/** @type {boolean} */
let pigeonRunLock = false;
/** @type {boolean} */
let autoPilotRunning = false;

// ── WebSocket relay connection ─────────────────────────────────────
/** @type {WebSocket | null} */
let wsRelay = null;
let wsReconnectTimer = null;
let wsEnabled = false;

async function connectWsRelay() {
  if (wsRelay && (wsRelay.readyState === WebSocket.OPEN || wsRelay.readyState === WebSocket.CONNECTING)) return;
  const stored = await chrome.storage.local.get([SETTINGS.STORAGE_KEY_WS_URL, SETTINGS.STORAGE_KEY_WS_ENABLED]);
  wsEnabled = !!stored[SETTINGS.STORAGE_KEY_WS_ENABLED];
  if (!wsEnabled) return;
  const url = stored[SETTINGS.STORAGE_KEY_WS_URL] || SETTINGS.DEFAULT_WS_URL;
  try {
    wsRelay = new WebSocket(url);
  } catch (e) {
    console.error("[Browserclaw WS] Failed to create WebSocket:", e);
    scheduleWsReconnect();
    return;
  }
  wsRelay.onopen = () => {
    console.log("[Browserclaw WS] Connected to relay");
    wsRelay.send(JSON.stringify({ type: "identify", role: "extension" }));
  };
  wsRelay.onmessage = async (event) => {
    let msg;
    try { msg = JSON.parse(event.data); } catch { return; }
    if (msg.type === "command" && msg.id) {
      console.log("[Browserclaw WS] Received command", msg.id);
      const t0 = Date.now();
      const result = await executeDirectCommandSequence(msg.command?.steps || []);
      result.transportReceiveTs = t0;
      result.transportRespondTs = Date.now();
      wsRelay.send(JSON.stringify({ type: "result", id: msg.id, result }));
    }
  };
  wsRelay.onclose = () => {
    console.log("[Browserclaw WS] Disconnected");
    wsRelay = null;
    scheduleWsReconnect();
  };
  wsRelay.onerror = (err) => {
    console.error("[Browserclaw WS] Error:", err);
  };
}

function scheduleWsReconnect() {
  if (wsReconnectTimer) clearTimeout(wsReconnectTimer);
  if (!wsEnabled) return;
  wsReconnectTimer = setTimeout(() => connectWsRelay(), 5000);
}

function disconnectWsRelay() {
  wsEnabled = false;
  if (wsReconnectTimer) { clearTimeout(wsReconnectTimer); wsReconnectTimer = null; }
  if (wsRelay) { wsRelay.close(); wsRelay = null; }
}

// ── Native messaging connection ────────────────────────────────────
/** @type {chrome.runtime.Port | null} */
let nativePort = null;
let nativeEnabled = false;

async function connectNativeHost() {
  if (nativePort) return;
  const stored = await chrome.storage.local.get([SETTINGS.STORAGE_KEY_NATIVE_ENABLED]);
  nativeEnabled = !!stored[SETTINGS.STORAGE_KEY_NATIVE_ENABLED];
  if (!nativeEnabled) return;
  try {
    nativePort = chrome.runtime.connectNative(SETTINGS.NATIVE_HOST_NAME);
  } catch (e) {
    console.error("[Browserclaw Native] connectNative failed:", e);
    nativePort = null;
    return;
  }
  console.log("[Browserclaw Native] Connected to host");
  nativePort.onMessage.addListener(async (msg) => {
    console.log("[Browserclaw Native] Message from host:", JSON.stringify(msg).slice(0, 200));
    if (msg.type === "command" && msg.id) {
      const t0 = Date.now();
      const result = await executeDirectCommandSequence(msg.command?.steps || []);
      result.transportReceiveTs = t0;
      result.transportRespondTs = Date.now();
      nativePort.postMessage({ type: "result", id: msg.id, result });
    }
  });
  nativePort.onDisconnect.addListener(() => {
    const err = chrome.runtime.lastError;
    console.log("[Browserclaw Native] Disconnected", err?.message || "");
    nativePort = null;
  });
}

function disconnectNativeHost() {
  nativeEnabled = false;
  if (nativePort) { nativePort.disconnect(); nativePort = null; }
}

// ── Direct command sequence execution ──────────────────────────────
/**
 * Execute a sequence of steps on the active tab and return results with timing.
 * Steps: { action: "navigate"|"typeText"|"click"|"pressKey"|"wait"|"obtainText"|"getPageInfo", ... }
 */
async function executeDirectCommandSequence(steps) {
  if (!Array.isArray(steps) || steps.length === 0) {
    return { ok: false, error: "No steps provided" };
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const tabId = tab?.id;
  if (tabId == null) {
    return { ok: false, error: "No active tab" };
  }

  const stepResults = [];
  const overallStart = Date.now();

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const stepStart = Date.now();
    let result;

    try {
      if (step.action === "navigate") {
        await chrome.tabs.update(tabId, { url: step.url });
        await waitForTabComplete(tabId, 25000);
        await new Promise((r) => setTimeout(r, 500));
        result = { ok: true, value: step.url };
      } else if (step.action === "wait") {
        const sec = Math.min(30, Math.max(0, Number(step.seconds) || 1));
        await new Promise((r) => setTimeout(r, sec * 1000));
        result = { ok: true, value: `waited ${sec}s` };
      } else {
        // Content script action
        const ready = await pingContentReady(tabId, 8);
        if (!ready) {
          result = { ok: false, error: "Content script not ready" };
        } else {
          result = await chrome.tabs.sendMessage(tabId, {
            type: MSG.PIGEON_EXECUTE_ACTION,
            ...step,
          });
        }
      }
    } catch (e) {
      result = { ok: false, error: String(e?.message || e) };
    }

    const elapsed = Date.now() - stepStart;
    stepResults.push({
      index: i,
      action: step.action,
      elapsed,
      ok: result?.ok ?? false,
      value: result?.value ?? null,
      error: result?.error ?? null,
    });

    if (!result?.ok) break;
  }

  return {
    ok: stepResults.every((r) => r.ok),
    totalElapsed: Date.now() - overallStart,
    steps: stepResults,
  };
}

// WS relay and native messaging are not auto-started; they were removed from the settings UI.

function logTabEvent(label, details) {
  console.log(`[Browserclaw background] ${label}`, details);
}

chrome.tabs.onActivated.addListener(({ tabId, windowId }) => {
  logTabEvent("tabs.onActivated", { tabId, windowId });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" || changeInfo.title != null || changeInfo.url != null) {
    logTabEvent("tabs.onUpdated", {
      tabId,
      status: changeInfo.status,
      title: changeInfo.title,
      url: changeInfo.url != null ? "***" : undefined,
    });
  }
});

chrome.windows?.onFocusChanged?.addListener((windowId) => {
  logTabEvent("windows.onFocusChanged", { windowId });
});

async function broadcastToAllTabs(payload) {
  const tabs = await chrome.tabs.query({});
  const msg = { type: MSG.TAB_BROADCAST, payload };
  await Promise.all(
    tabs
      .filter((t) => t.id != null)
      .map((t) =>
        chrome.tabs.sendMessage(t.id, msg).catch(() => {
          /* tab has no content script (e.g. chrome://) */
        }),
      ),
  );
}

/**
 * @param {number} tabId
 * @param {number} timeoutMs
 */
function waitForTabComplete(tabId, timeoutMs) {
  return new Promise((resolve, reject) => {
    let done = false;
    const finish = (ok) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(onUpdated);
      if (ok) resolve();
      else reject(new Error("Navigation timeout"));
    };
    const timer = setTimeout(() => finish(false), timeoutMs);

    function onUpdated(id, changeInfo) {
      if (id === tabId && changeInfo.status === "complete") finish(true);
    }

    chrome.tabs.onUpdated.addListener(onUpdated);

    chrome.tabs.get(tabId).then((tab) => {
      if (tab?.status === "complete") finish(true);
    });
  });
}

/**
 * @param {number} tabId
 */
async function pingContentReady(tabId, retries = 12) {
  for (let i = 0; i < retries; i++) {
    try {
      const r = await chrome.tabs.sendMessage(tabId, { type: MSG.PING_FROM_CONTENT });
      if (r && r.ok) return true;
    } catch {
      /* content script not ready or restricted URL (chrome://, Web Store, etc.) */
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

/**
 * @param {unknown} letter
 * @returns {Array<Record<string, unknown>>}
 */
function normalizeLetterSteps(letter) {
  if (!letter || typeof letter !== "object" || Array.isArray(letter)) return [];
  const L = /** @type {Record<string, unknown>} */ (letter);
  if (Array.isArray(L.steps) && L.steps.length > 0) {
    const out = [];
    for (const s of L.steps) {
      const one = normalizeOneStep(s);
      if (one) out.push(one);
    }
    return out;
  }
  const one = normalizeOneStep(L);
  return one ? [one] : [];
}

/**
 * @param {unknown} step
 */
function normalizeOneStep(step) {
  if (!step || typeof step !== "object" || Array.isArray(step)) return null;
  const s = /** @type {Record<string, unknown>} */ (step);
  const action = String(s.action ?? "obtainText");
  const selector = String(s.selector ?? "");
  const item = String(s.item ?? "").trim();
  if (!item) return null;
  const urlRaw = s.url != null ? String(s.url).trim() : "";
  const o = /** @type {Record<string, unknown>} */ ({ ...s, action, selector, item });
  if (urlRaw) o.url = urlRaw;
  else delete o.url;
  delete o.type;
  return o;
}

/**
 * @param {unknown} groups
 * @returns {object[]}
 */
function flattenPendingLetterGroups(groups) {
  if (!Array.isArray(groups)) return [];
  const merged = [];
  const seen = new Set();
  for (const g of groups) {
    if (!g || typeof g !== "object") continue;
    const gQuestId = g.questId != null ? String(g.questId) : "";
    for (const letter of g.letters || []) {
      if (!letter || typeof letter !== "object") continue;
      const lid = letter.letterId != null ? String(letter.letterId) : "";
      const qid = letter.questId != null ? String(letter.questId) : gQuestId;
      const dedupeKey =
        lid && qid ? `${qid}:${lid}` : `${qid}-${merged.length}-${JSON.stringify(letter).slice(0, 80)}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      merged.push({
        ...letter,
        questId: letter.questId ?? g.questId,
        questTitle: g.questTitle,
        questStage: g.questStage,
      });
    }
  }
  return merged;
}

/**
 * @returns {Promise<object[]>}
 */
async function fetchPendingLettersFromApi() {
  const keys = [SETTINGS.STORAGE_KEY_GUILDOS_BASE_URL, SETTINGS.STORAGE_KEY_PIGEON_API_KEY];
  const stored = await chrome.storage.local.get(keys);
  const baseRaw = stored[SETTINGS.STORAGE_KEY_GUILDOS_BASE_URL];
  const base =
    typeof baseRaw === "string" && baseRaw.trim()
      ? baseRaw.trim().replace(/\/$/, "")
      : SETTINGS.DEFAULT_GUILDOS_BASE_URL;
  const apiKey = stored[SETTINGS.STORAGE_KEY_PIGEON_API_KEY];
  const pigeonKeyHeader = typeof apiKey === "string" && apiKey.trim() ? apiKey.trim() : "";

  const headers = { Accept: "application/json" };
  if (pigeonKeyHeader) headers["X-Pigeon-Key"] = pigeonKeyHeader;

  let res;
  try {
    res = await fetch(`${base}/api/pigeon-post?action=pending`, {
      method: "GET",
      headers,
      credentials: "include",
    });
  } catch (err) {
    console.error("[Browserclaw pigeon] pending fetch network error", err);
    return [];
  }

  if (res.status === 401) {
    console.warn("[Browserclaw pigeon] pending 401 — set Pigeon API key and server PIGEON_POST_OWNER_ID");
    return [];
  }
  if (!res.ok) {
    const text = await res.text();
    console.error("[Browserclaw pigeon] pending failed", res.status, text);
    return [];
  }

  let groups;
  try {
    groups = await res.json();
  } catch {
    return [];
  }
  return flattenPendingLetterGroups(groups);
}

async function persistExecution(patch) {
  const cur = await chrome.storage.local.get(K_EXEC);
  const prev = cur[K_EXEC] && typeof cur[K_EXEC] === "object" ? cur[K_EXEC] : {};
  const next = { ...prev, ...patch, updatedAt: Date.now() };
  await chrome.storage.local.set({ [K_EXEC]: next });
}

async function clearExecution() {
  await chrome.storage.local.remove(K_EXEC);
}

/**
 * @param {string} questId
 * @param {string} letterId
 * @param {Record<string, unknown>} items
 */
async function postDeliverToPigeonApi(questId, letterId, items) {
  const keys = [SETTINGS.STORAGE_KEY_GUILDOS_BASE_URL, SETTINGS.STORAGE_KEY_PIGEON_API_KEY];
  const stored = await chrome.storage.local.get(keys);
  const baseRaw = stored[SETTINGS.STORAGE_KEY_GUILDOS_BASE_URL];
  const base =
    typeof baseRaw === "string" && baseRaw.trim()
      ? baseRaw.trim().replace(/\/$/, "")
      : SETTINGS.DEFAULT_GUILDOS_BASE_URL;
  const apiKey = stored[SETTINGS.STORAGE_KEY_PIGEON_API_KEY];
  const pigeonKeyHeader = typeof apiKey === "string" && apiKey.trim() ? apiKey.trim() : "";

  const headers = { "Content-Type": "application/json" };
  if (pigeonKeyHeader) headers["X-Pigeon-Key"] = pigeonKeyHeader;

  const body = {
    questId,
    items,
    ...(letterId ? { letterId } : {}),
  };

  const res = await fetch(`${base}/api/pigeon-post?action=deliver`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Deliver failed (${res.status})`);
  }
  return res.json();
}

/**
 * @param {string} letterId
 */
async function removeLetterFromPendingStorage(letterId) {
  const lid = String(letterId);
  const cur = await chrome.storage.local.get(K_PENDING);
  const list = Array.isArray(cur[K_PENDING]) ? cur[K_PENDING] : [];
  const next = list.filter((l) => String(l?.letterId ?? "") !== lid);
  await chrome.storage.local.set({ [K_PENDING]: next });
}

async function savePendingAndPruneExecution(letters) {
  const list = Array.isArray(letters) ? letters : [];
  await chrome.storage.local.set({ [K_PENDING]: list });
  const ids = new Set(list.map((l) => String(l?.letterId ?? "")).filter(Boolean));
  const ex = await chrome.storage.local.get(K_EXEC);
  const e = ex[K_EXEC];
  if (e && typeof e === "object" && e.letterId != null && !ids.has(String(e.letterId))) {
    await chrome.storage.local.remove(K_EXEC);
  }
}

/**
 * Run the current step only; append to stepLog; advance stepIndex or set ready_to_send.
 * @returns {Promise<object>}
 */
async function executePigeonNextStep() {
  if (pigeonRunLock) {
    return { ok: false, error: "Another step is in progress." };
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const tabId = tab?.id;
  if (tabId == null) {
    return { ok: false, error: "No active tab — focus a page where Browserclaw can run." };
  }

  const pendingRaw = await chrome.storage.local.get(K_PENDING);
  const pending = Array.isArray(pendingRaw[K_PENDING]) ? pendingRaw[K_PENDING] : [];

  let exRaw = await chrome.storage.local.get(K_EXEC);
  let ex = exRaw[K_EXEC];

  if (ex?.phase === "running_step" && typeof ex.updatedAt === "number" && Date.now() - ex.updatedAt > 120000) {
    const stepLog = Array.isArray(ex.stepLog) ? [...ex.stepLog] : [];
    stepLog.push({
      at: Date.now(),
      stepIndex: ex.stepIndex,
      item: "(stale)",
      action: "",
      selector: "",
      ok: false,
      error: "Stale running_step cleared — click Execute again.",
    });
    await persistExecution({
      ...ex,
      phase: "error",
      stepLog,
      errorMessage: "Stale state cleared.",
    });
    ex = (await chrome.storage.local.get(K_EXEC))[K_EXEC];
  }

  if (ex && ex.phase === "ready_to_send") {
    return { ok: false, error: "All steps are done. Use Send result to POST to GuildOS." };
  }

  let questId;
  let letterId;
  /** @type {object[]} */
  let steps;
  let stepIndex;
  /** @type {Record<string, unknown>} */
  let items;
  /** @type {object[]} */
  let stepLog;

  const resumable =
    ex &&
    typeof ex === "object" &&
    ex.letterId &&
    Array.isArray(ex.steps) &&
    (ex.phase === "active" || ex.phase === "error" || ex.phase === "running_step");

  if (resumable) {
    const stillThere = pending.some((l) => String(l?.letterId ?? "") === String(ex.letterId));
    if (!stillThere) {
      await clearExecution();
      return { ok: false, error: "Current task is no longer in the queue — fetch pigeon letters again." };
    }
    questId = String(ex.questId);
    letterId = String(ex.letterId);
    steps = ex.steps;
    stepIndex = Number(ex.stepIndex) || 0;
    items =
      ex.items && typeof ex.items === "object" && !Array.isArray(ex.items) ? { ...ex.items } : {};
    stepLog = Array.isArray(ex.stepLog) ? [...ex.stepLog] : [];
  } else {
    if (pending.length === 0) {
      return { ok: false, error: "No tasks. Fetch pigeon letters first." };
    }
    await clearExecution();
    const letter = pending[0];
    steps = normalizeLetterSteps(letter);
    if (!steps.length) {
      return { ok: false, error: "First task has no executable steps." };
    }
    questId = String(letter.questId);
    letterId = String(letter.letterId);
    if (!questId || !letterId) {
      return { ok: false, error: "First task is missing questId or letterId." };
    }
    stepIndex = 0;
    items = {};
    stepLog = [];
  }

  if (stepIndex >= steps.length) {
    return { ok: false, error: "All steps already completed. Use Send result." };
  }

  const step = steps[stepIndex];
  pigeonRunLock = true;
  try {
    await persistExecution({
      phase: "running_step",
      questId,
      letterId,
      steps,
      stepIndex,
      items: { ...items },
      stepLog,
      errorMessage: undefined,
    });

    const url = step.url != null ? String(step.url).trim() : "";
    if (url) {
      await chrome.tabs.update(tabId, { url });
      await waitForTabComplete(tabId, 25000);
      await new Promise((r) => setTimeout(r, 250));
    }

    const stepAction = String(step.action ?? "obtainText");
    if (stepAction === "wait") {
      const sec = Math.min(120, Math.max(0, Number(step.seconds) || 0));
      await new Promise((r) => setTimeout(r, sec * 1000));
      const val = { waitedSeconds: sec };
      items[step.item] = val;
      const valueStr = JSON.stringify(val);
      const entry = {
        at: Date.now(),
        stepIndex,
        item: step.item,
        action: step.action,
        selector: step.selector,
        ok: true,
        value: valueStr,
      };
      stepLog.push(entry);
      const nextIndex = stepIndex + 1;
      const phase = nextIndex >= steps.length ? "ready_to_send" : "active";
      await persistExecution({
        phase,
        questId,
        letterId,
        steps,
        stepIndex: nextIndex,
        items: { ...items },
        stepLog,
        errorMessage: undefined,
      });
      return {
        ok: true,
        stepLogEntry: entry,
        readyToSend: phase === "ready_to_send",
        stepsCompleted: nextIndex,
        totalSteps: steps.length,
      };
    }

    const ready = await pingContentReady(tabId);
    if (!ready) {
      const errMsg =
        "Browserclaw content script not responding. Use a normal http(s) tab (not chrome://, PDF viewer, or Chrome Web Store), reload the page if needed, then Execute again.";
      const entry = {
        at: Date.now(),
        stepIndex,
        item: step.item,
        action: step.action,
        selector: step.selector,
        ok: false,
        error: errMsg,
      };
      stepLog.push(entry);
      await persistExecution({
        phase: "error",
        questId,
        letterId,
        steps,
        stepIndex,
        items: { ...items },
        stepLog,
        errorMessage: errMsg,
      });
      return { ok: false, error: errMsg, stepLogEntry: entry };
    }

    const tabPayload = { .../** @type {Record<string, unknown>} */ (step) };
    delete tabPayload.type;
    const execR = await chrome.tabs.sendMessage(tabId, {
      ...tabPayload,
      type: MSG.PIGEON_EXECUTE_ACTION,
    });

    if (!execR || execR.ok === false) {
      const errMsg = execR && execR.error ? String(execR.error) : "Step action failed.";
      const entry = {
        at: Date.now(),
        stepIndex,
        item: step.item,
        action: step.action,
        selector: step.selector,
        ok: false,
        error: errMsg,
      };
      stepLog.push(entry);
      await persistExecution({
        phase: "error",
        questId,
        letterId,
        steps,
        stepIndex,
        items: { ...items },
        stepLog,
        errorMessage: errMsg,
      });
      return { ok: false, error: errMsg, stepLogEntry: entry };
    }

    const val = execR.value ?? null;
    items[step.item] = val;
    const valueStr =
      typeof val === "string" ? val : val != null && typeof val === "object" ? JSON.stringify(val) : val != null ? String(val) : "";
    const entry = {
      at: Date.now(),
      stepIndex,
      item: step.item,
      action: step.action,
      selector: step.selector,
      ok: true,
      value: valueStr,
    };
    stepLog.push(entry);

    const nextIndex = stepIndex + 1;
    const phase = nextIndex >= steps.length ? "ready_to_send" : "active";
    await persistExecution({
      phase,
      questId,
      letterId,
      steps,
      stepIndex: nextIndex,
      items: { ...items },
      stepLog,
      errorMessage: undefined,
    });

    return {
      ok: true,
      stepLogEntry: entry,
      readyToSend: phase === "ready_to_send",
      stepsCompleted: nextIndex,
      totalSteps: steps.length,
    };
  } finally {
    pigeonRunLock = false;
  }
}

/**
 * POST /api/pigeon-post?action=deliver with accumulated items; clear local session.
 * @returns {Promise<object>}
 */
async function sendPigeonResultToApi() {
  const exRaw = await chrome.storage.local.get(K_EXEC);
  const ex = exRaw[K_EXEC];
  if (!ex || typeof ex !== "object" || ex.phase !== "ready_to_send") {
    return {
      ok: false,
      error: "Nothing to send — run Execute for each step until the queue shows ready.",
    };
  }

  const questId = String(ex.questId);
  const letterId = String(ex.letterId);
  const steps = Array.isArray(ex.steps) ? ex.steps : [];
  const items =
    ex.items && typeof ex.items === "object" && !Array.isArray(ex.items) ? ex.items : {};

  for (const st of steps) {
    const k = st && typeof st === "object" && st.item != null ? String(st.item) : "";
    if (!k || !(k in items)) {
      return { ok: false, error: `Missing captured value for item key "${k || "?"}"` };
    }
  }

  try {
    await postDeliverToPigeonApi(questId, letterId, items);
    await removeLetterFromPendingStorage(letterId);
    await clearExecution();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
}

// ── Auto-pilot ────────────────────────────────────────────────────

/**
 * Normalize steps from a pigeon letter for auto-pilot execution.
 * Unlike the manual flow, steps without an `item` key are still executed
 * (e.g. navigation-only steps).
 * @param {object} letter
 * @returns {Array<object>}
 */
function normalizeStepsForAutoPilot(letter) {
  const raw = Array.isArray(letter.steps) && letter.steps.length > 0 ? letter.steps : [letter];
  return raw
    .filter((s) => s && typeof s === "object" && !Array.isArray(s))
    .map((s) => ({
      action: String(s.action ?? "obtainText"),
      selector: s.selector != null ? String(s.selector) : "",
      item: s.item != null ? String(s.item).trim() : "",
      url: s.url != null ? String(s.url).trim() : "",
      seconds: s.seconds,
      text: s.text,
      key: s.key,
      targetString: s.targetString,
      targetRaw: s.targetRaw,
    }));
}

/**
 * Execute all steps of one pigeon letter in a background tab.
 * Opens a new (inactive) tab, runs every step there, then closes the tab.
 * @param {object} letter
 * @returns {Promise<{ok: boolean, items: object, stepLog: object[]}>}
 */
async function executeLetterInNewTab(letter) {
  const steps = normalizeStepsForAutoPilot(letter);
  if (!steps.length) return { ok: false, items: {}, stepLog: [], error: "No steps" };

  const tab = await chrome.tabs.create({ active: false, url: "about:blank" });
  const tabId = tab.id;
  const items = {};
  const stepLog = [];

  try {
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const stepStart = Date.now();

      // Navigate if the step has a url
      if (step.url) {
        await chrome.tabs.update(tabId, { url: step.url });
        await waitForTabComplete(tabId, 25000);
        await new Promise((r) => setTimeout(r, 400));
      }

      let result;
      if (step.action === "wait") {
        const sec = Math.min(120, Math.max(0, Number(step.seconds) || 1));
        await new Promise((r) => setTimeout(r, sec * 1000));
        result = { ok: true, value: { waitedSeconds: sec } };
      } else {
        const ready = await pingContentReady(tabId);
        if (!ready) {
          result = { ok: false, error: "Content script not ready in worker tab" };
        } else {
          const payload = { ...step };
          delete payload.type;
          result = await chrome.tabs.sendMessage(tabId, { ...payload, type: MSG.PIGEON_EXECUTE_ACTION });
        }
      }

      const ok = result?.ok ?? false;
      if (step.item) items[step.item] = result?.value ?? null;
      stepLog.push({
        stepIndex: i,
        item: step.item || null,
        action: step.action,
        elapsed: Date.now() - stepStart,
        ok,
        value: result?.value ?? null,
        error: result?.error ?? null,
      });

      if (!ok) break;
    }
  } finally {
    chrome.tabs.remove(tabId).catch(() => {});
  }

  return { ok: stepLog.every((s) => s.ok), items, stepLog };
}

/**
 * Start or stop the alarm based on the global enabled flag.
 * @param {boolean} enabled
 */
async function syncAutoPilotAlarm(enabled) {
  if (enabled) {
    await chrome.alarms.create(ALARM_NAME, { periodInMinutes: 1 });
  } else {
    await chrome.alarms.clear(ALARM_NAME);
  }
}

/**
 * One auto-pilot tick: fetch pending letters, execute each in a background tab, deliver results.
 */
async function autoPilotTick() {
  if (autoPilotRunning) return;

  const data = await chrome.storage.local.get(K_AUTO_PILOT);
  if (!data[K_AUTO_PILOT]) return;

  autoPilotRunning = true;
  const tickStart = Date.now();
  let processed = 0;
  let failed = 0;

  try {
    const letters = await fetchPendingLettersFromApi();
    console.log(`[BC auto-pilot] tick — ${letters.length} letter(s) pending`);

    for (const letter of letters) {
      const questId = String(letter.questId ?? "");
      const letterId = String(letter.letterId ?? "");
      if (!questId || !letterId) continue;

      try {
        const result = await executeLetterInNewTab(letter);
        if (result.ok) {
          await postDeliverToPigeonApi(questId, letterId, result.items);
          processed++;
          console.log(`[BC auto-pilot] ✓ delivered letter ${letterId}`);
        } else {
          failed++;
          const lastErr = result.stepLog.find((s) => !s.ok)?.error ?? "unknown";
          console.warn(`[BC auto-pilot] ✗ letter ${letterId} failed:`, lastErr);
        }
      } catch (e) {
        failed++;
        console.error(`[BC auto-pilot] exception on letter ${letterId}:`, e?.message ?? e);
      }
    }
  } finally {
    autoPilotRunning = false;
    await chrome.storage.local.set({
      [K_AUTO_PILOT_STATUS]: {
        lastTick: tickStart,
        elapsed: Date.now() - tickStart,
        processed,
        failed,
      },
    });
  }
}

// Alarm handler
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) autoPilotTick();
});

// Resume alarm on SW startup if auto-pilot was enabled before SW was killed
chrome.storage.local.get(K_AUTO_PILOT).then((data) => {
  if (data[K_AUTO_PILOT]) syncAutoPilotAlarm(true);
});

// ── Message listener ───────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message.type !== "string") return;

  if (message.type === MSG.PING_FROM_CONTENT) {
    logTabEvent("ping from content", {
      tabId: sender.tab?.id,
      url: sender.tab?.url ? "[redacted]" : undefined,
    });
    sendResponse({ ok: true });
    return true;
  }

  if (message.type === MSG.BROADCAST_TO_TABS) {
    broadcastToAllTabs(message.payload ?? { source: "popup", at: Date.now() }).then(
      () => sendResponse({ ok: true }),
      () => sendResponse({ ok: false }),
    );
    return true;
  }

  if (message.type === MSG.GET_ACTIVE_TAB_META) {
    chrome.tabs
      .query({ active: true, currentWindow: true })
      .then(([tab]) => {
        sendResponse({
          ok: true,
          tabId: tab?.id,
          title: tab?.title,
        });
      })
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (message.type === MSG.OPEN_OPTIONS_PAGE) {
    chrome.runtime.openOptionsPage(() => {
      if (chrome.runtime.lastError) {
        sendResponse({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }
      sendResponse({ ok: true });
    });
    return true;
  }

  if (message.type === MSG.PIGEON_FETCH_LETTERS) {
    fetchPendingLettersFromApi().then(async (letters) => {
      await savePendingAndPruneExecution(letters);
      sendResponse({
        ok: true,
        letters,
        letterCount: letters.length,
      });
    });
    return true;
  }

  if (message.type === MSG.PIGEON_GET_EXECUTION) {
    chrome.storage.local.get([K_PENDING, K_EXEC]).then((data) => {
      sendResponse({
        ok: true,
        pending: Array.isArray(data[K_PENDING]) ? data[K_PENDING] : [],
        execution: data[K_EXEC] ?? null,
      });
    });
    return true;
  }

  if (message.type === MSG.PIGEON_EXECUTE_NEXT_STEP) {
    executePigeonNextStep().then((r) => sendResponse(r));
    return true;
  }

  if (message.type === MSG.PIGEON_SEND_PIGEON_RESULT) {
    sendPigeonResultToApi().then((r) => sendResponse(r));
    return true;
  }

  if (message.type === MSG.DIRECT_EXECUTE) {
    executeDirectCommandSequence(message.steps || []).then((r) => sendResponse(r));
    return true;
  }

  if (message.type === MSG.AUTO_PILOT_SET) {
    const enabled = !!message.enabled;
    chrome.storage.local.set({ [K_AUTO_PILOT]: enabled }).then(async () => {
      await syncAutoPilotAlarm(enabled);
      if (enabled) autoPilotTick();
      sendResponse({ ok: true, enabled });
    });
    return true;
  }

  if (message.type === MSG.AUTO_PILOT_GET) {
    chrome.storage.local.get([K_AUTO_PILOT, K_AUTO_PILOT_STATUS]).then((data) => {
      sendResponse({
        ok: true,
        enabled: !!data[K_AUTO_PILOT],
        status: data[K_AUTO_PILOT_STATUS] ?? null,
      });
    });
    return true;
  }

  return undefined;
});

chrome.runtime.onInstalled.addListener((details) => {
  logTabEvent("runtime.onInstalled", { reason: details.reason });
  // Clear stale WS/native flags that auto-connected in previous versions
  chrome.storage.local.remove([
    SETTINGS.STORAGE_KEY_WS_ENABLED,
    SETTINGS.STORAGE_KEY_WS_URL,
    SETTINGS.STORAGE_KEY_NATIVE_ENABLED,
  ]);
});

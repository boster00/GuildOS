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
  const action = String(s.action ?? "get");
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
    if (step.item) items[step.item] = val;
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

  if (message.type === MSG.PIGEON_EXEC_STEP) {
    const { letter, stepIndex, tabId } = message;
    executeOneStep(letter, stepIndex, tabId ?? null).then((r) => sendResponse(r));
    return true;
  }

  if (message.type === MSG.PIGEON_DELIVER_LETTER) {
    const { questId, letterId, items } = message;
    postDeliverToPigeonApi(questId, letterId, items || {})
      .then(() => removeLetterFromPendingStorage(letterId))
      .then(() => sendResponse({ ok: true }))
      .catch((e) => sendResponse({ ok: false, error: String(e.message) }));
    return true;
  }

  if (message.type === MSG.PIGEON_CLOSE_TAB) {
    if (message.tabId != null) chrome.tabs.remove(message.tabId).catch(() => {});
    sendResponse({ ok: true });
    return true;
  }

  if (message.type === MSG.AUTO_PILOT_SET) {
    const enabled = Boolean(message.enabled);
    chrome.storage.local.set({ [K_AUTO_PILOT]: enabled }, () => {
      syncAutoPilotAlarm(enabled).then(() => {
        if (enabled) autoPilotTick();
        sendResponse({ ok: true });
      });
    });
    return true;
  }

  if (message.type === MSG.AUTO_PILOT_GET) {
    chrome.storage.local.get([K_AUTO_PILOT, K_AUTO_PILOT_STATUS], (data) => {
      sendResponse({
        ok: true,
        enabled: data[K_AUTO_PILOT] === true,
        status: data[K_AUTO_PILOT_STATUS] ?? "idle",
      });
    });
    return true;
  }

  return undefined;
});

// ── Auto-pilot ────────────────────────────────────────────────────────────────

/**
 * Like normalizeLetterSteps but does not require `item` key — allows
 * navigation-only steps.
 * @param {unknown} letter
 * @returns {Array<Record<string, unknown>>}
 */
function normalizeStepsForAutoPilot(letter) {
  if (!letter || typeof letter !== "object" || Array.isArray(letter)) return [];
  const L = /** @type {Record<string, unknown>} */ (letter);
  const src = Array.isArray(L.steps) && L.steps.length > 0 ? L.steps : [L];
  const out = [];
  for (const s of src) {
    if (!s || typeof s !== "object" || Array.isArray(s)) continue;
    const step = /** @type {Record<string, unknown>} */ (s);
    if (!step.action) continue;
    out.push({ ...step });
  }
  return out;
}

/**
 * Open a background tab, run all steps, collect items, close tab.
 * @param {object} letter
 * @returns {Promise<{ok: boolean, items: Record<string, unknown>, error?: string}>}
 */
async function executeLetterInNewTab(letter) {
  const steps = normalizeStepsForAutoPilot(letter);
  if (!steps.length) return { ok: false, items: {}, error: "No steps in letter." };

  let tab;
  try {
    tab = await chrome.tabs.create({ url: "about:blank", active: false });
  } catch (e) {
    return { ok: false, items: {}, error: `Could not open tab: ${e.message}` };
  }

  const tabId = tab.id;
  const items = {};

  try {
    for (const step of steps) {
      const url = step.url != null ? String(step.url).trim() : "";
      if (url) {
        await chrome.tabs.update(tabId, { url });
        await waitForTabComplete(tabId, 25000);
        await new Promise((r) => setTimeout(r, 400));
      }

      const action = String(step.action ?? "navigate");
      if (action === "navigate") continue;

      const ready = await pingContentReady(tabId);
      if (!ready) {
        return { ok: false, items, error: "Content script not ready in auto-pilot tab." };
      }

      const tabPayload = { ...step };
      delete tabPayload.type;
      let execR;
      try {
        execR = await chrome.tabs.sendMessage(tabId, { ...tabPayload, type: MSG.PIGEON_EXECUTE_ACTION });
      } catch (e) {
        return { ok: false, items, error: `sendMessage failed: ${e.message}` };
      }
      if (!execR || execR.ok === false) {
        return { ok: false, items, error: execR?.error || "Step action failed." };
      }
      if (step.item) items[String(step.item)] = execR.value ?? null;
    }
    return { ok: true, items };
  } finally {
    chrome.tabs.remove(tabId).catch(() => {});
  }
}

/**
 * @param {boolean} enabled
 */
async function syncAutoPilotAlarm(enabled) {
  if (enabled) {
    const existing = await chrome.alarms.get(ALARM_NAME);
    if (!existing) {
      chrome.alarms.create(ALARM_NAME, { delayInMinutes: 0.017, periodInMinutes: 1 });
    }
  } else {
    await chrome.alarms.clear(ALARM_NAME);
  }
}

async function autoPilotTick() {
  if (autoPilotRunning) return;
  autoPilotRunning = true;
  await chrome.storage.local.set({ [K_AUTO_PILOT_STATUS]: "running" });
  try {
    const letters = await fetchPendingLettersFromApi();
    await savePendingAndPruneExecution(letters);
    console.log(`[Browserclaw auto-pilot] tick — ${letters.length} pending letters`);

    for (const letter of letters) {
      const questId = String(letter.questId ?? "");
      const letterId = String(letter.letterId ?? "");
      if (!questId || !letterId) continue;
      console.log(`[Browserclaw auto-pilot] executing letter ${letterId}`);
      const result = await executeLetterInNewTab(letter);
      if (!result.ok) {
        console.warn(`[Browserclaw auto-pilot] letter ${letterId} failed:`, result.error);
        continue;
      }
      if (Object.keys(result.items).length > 0) {
        try {
          await postDeliverToPigeonApi(questId, letterId, result.items);
          await removeLetterFromPendingStorage(letterId);
          console.log(`[Browserclaw auto-pilot] letter ${letterId} delivered`);
        } catch (e) {
          console.error(`[Browserclaw auto-pilot] deliver failed for ${letterId}:`, e.message);
        }
      }
    }
    await chrome.storage.local.set({ [K_AUTO_PILOT_STATUS]: "idle" });
  } catch (e) {
    console.error("[Browserclaw auto-pilot] tick error", e);
    await chrome.storage.local.set({ [K_AUTO_PILOT_STATUS]: "error" });
  } finally {
    autoPilotRunning = false;
  }
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) autoPilotTick();
});

// Resume alarm if SW was killed while auto-pilot was enabled
chrome.storage.local.get(K_AUTO_PILOT, (data) => {
  if (data[K_AUTO_PILOT] === true) {
    syncAutoPilotAlarm(true);
    autoPilotTick();
  }
});


// ── Step-by-step execution (settings page manual / auto mode) ─────────────────

/**
 * Execute a single step in a tab (creating one if needed). Tab stays open.
 * @param {object} letter
 * @param {number} stepIndex
 * @param {number|null} existingTabId
 * @returns {Promise<{ok: boolean, value: unknown, tabId: number, error?: string}>}
 */
async function executeOneStep(letter, stepIndex, existingTabId) {
  const steps = normalizeStepsForAutoPilot(letter);
  const step = steps[stepIndex];
  if (!step) {
    return { ok: false, value: null, tabId: existingTabId ?? null, error: "Step index out of range" };
  }

  let tabId = existingTabId ?? null;
  if (tabId != null) {
    try { await chrome.tabs.get(tabId); } catch { tabId = null; }
  }
  if (tabId == null) {
    const tab = await chrome.tabs.create({ url: "about:blank", active: false });
    tabId = tab.id;
  }

  const url = step.url != null ? String(step.url).trim() : "";
  if (url) {
    await chrome.tabs.update(tabId, { url });
    await waitForTabComplete(tabId, 25000);
    await new Promise((r) => setTimeout(r, 400));
  }

  const action = String(step.action ?? "navigate");
  if (action === "navigate") return { ok: true, value: null, tabId };

  const ready = await pingContentReady(tabId);
  if (!ready) {
    return { ok: false, value: null, tabId, error: "Content script not responding in tab." };
  }

  const payload = { ...step };
  delete payload.type;
  try {
    const r = await chrome.tabs.sendMessage(tabId, { ...payload, type: MSG.PIGEON_EXECUTE_ACTION });
    if (!r || r.ok === false) {
      return { ok: false, value: null, tabId, error: r?.error || "Action failed." };
    }
    return { ok: true, value: r.value ?? null, tabId };
  } catch (e) {
    return { ok: false, value: null, tabId, error: String(e.message) };
  }
}

chrome.runtime.onInstalled.addListener((details) => {
  logTabEvent("runtime.onInstalled", { reason: details.reason });
  // Clean up stale keys from old WS/native host storage
  chrome.storage.local.remove(["bcWsEnabled", "bcNativeEnabled"]);
});

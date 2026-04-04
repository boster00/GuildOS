(function () {
  const MSG = globalThis.BROWSERCLAW_MSG;
  const STORAGE = globalThis.BROWSERCLAW_SETTINGS;
  const normalizeBg = globalThis.browserclawNormalizeBunnyFabBg;
  const DOM_TYPES = globalThis.BROWSERCLAW_DOM_CAPTURE_EVENT_TYPES;
  const DOM_PASSIVE = globalThis.BROWSERCLAW_DOM_CAPTURE_PASSIVE_TYPES;
  const LOG_MAX = globalThis.BROWSERCLAW_DOM_EVENT_LOG_MAX ?? 200;

  if (!MSG || !STORAGE || !normalizeBg) return;

  if (document.getElementById("browserclaw-root")) return;

  const eventLog = [];
  let eventSeq = 0;
  let eventLogPre = null;
  let logRefreshQueued = false;

  /** @type {Array<[string, function, AddEventListenerOptions]>} */
  const domCaptureRegistry = [];

  function targetHint(el) {
    if (!el || !el.nodeName) return "";
    let s = el.nodeName.toLowerCase();
    if (el.id) s += "#" + el.id;
    else if (el.className && typeof el.className === "string") {
      const c = el.className.trim().split(/\s+/)[0];
      if (c) s += "." + c;
    }
    return s.slice(0, 72);
  }

  function shouldRecordEvent(e) {
    const t = e.target;
    if (t && typeof t.closest === "function" && t.closest("#browserclaw-root")) return false;
    return true;
  }

  function renderEventLog() {
    if (!eventLogPre) return;
    const lines = eventLog
      .slice()
      .reverse()
      .map((entry) => {
        let line = `#${entry.seq} +${entry.ts}ms ${entry.type} trusted=${entry.isTrusted} ${entry.target}`;
        if (entry.key != null) line += ` key=${entry.key} code=${entry.code}`;
        return line;
      });
    eventLogPre.textContent = lines.join("\n");
  }

  function scheduleLogRefresh() {
    if (!eventLogPre || logRefreshQueued) return;
    logRefreshQueued = true;
    requestAnimationFrame(() => {
      logRefreshQueued = false;
      renderEventLog();
    });
  }

  function onDomCaptureEvent(e) {
    if (!shouldRecordEvent(e)) return;
    eventSeq += 1;
    const entry = {
      seq: eventSeq,
      ts: Math.round(performance.now()),
      type: e.type,
      isTrusted: e.isTrusted,
      target: targetHint(e.target),
    };
    if (e.type === "keydown" || e.type === "keyup") {
      entry.key = e.key;
      entry.code = e.code;
    }
    eventLog.push(entry);
    while (eventLog.length > LOG_MAX) eventLog.shift();
    scheduleLogRefresh();
  }

  function detachDomCaptureListeners() {
    for (const [et, fn, opts] of domCaptureRegistry) {
      try {
        window.removeEventListener(et, fn, opts);
      } catch {
        /* ignore */
      }
    }
    domCaptureRegistry.length = 0;
  }

  function attachDomCaptureListeners() {
    detachDomCaptureListeners();
    if (!Array.isArray(DOM_TYPES)) return;
    for (const et of DOM_TYPES) {
      const opts = DOM_PASSIVE?.has?.(et) ? { capture: true, passive: true } : { capture: true };
      try {
        window.addEventListener(et, onDomCaptureEvent, opts);
        domCaptureRegistry.push([et, onDomCaptureEvent, opts]);
      } catch {
        /* ignore invalid event name */
      }
    }
  }

  function applyEventLoggingPreference(enabled) {
    if (enabled) attachDomCaptureListeners();
    else detachDomCaptureListeners();
  }

  function readEventLogEnabledFromStorageThenApply() {
    const key = STORAGE.STORAGE_KEY_EVENT_LOG_ENABLED;
    try {
      chrome.storage.local.get(key, (data) => {
        if (chrome.runtime.lastError) return;
        applyEventLoggingPreference(data[key] === true);
      });
    } catch {
      applyEventLoggingPreference(false);
    }
  }

  readEventLogEnabledFromStorageThenApply();
  try {
    const evtKey = STORAGE.STORAGE_KEY_EVENT_LOG_ENABLED;
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local" || !changes[evtKey]) return;
      applyEventLoggingPreference(changes[evtKey].newValue === true);
    });
  } catch {
    /* ignore */
  }

  const root = document.createElement("div");
  root.id = "browserclaw-root";
  root.setAttribute("data-browserclaw", "1");

  const fab = document.createElement("button");
  fab.type = "button";
  fab.className = "browserclaw-fab";
  fab.title = "Browserclaw";
  fab.setAttribute("aria-label", "Open Browserclaw");

  const img = document.createElement("img");
  img.src = chrome.runtime.getURL("assets/bunny-fab.png");
  img.alt = "";
  fab.appendChild(img);

  function applyBunnyFabBackground(bunnyFabBg) {
    if (typeof bunnyFabBg === "string" && bunnyFabBg.startsWith("#")) {
      fab.style.background = bunnyFabBg;
    }
  }

  function applyFromStoredValue(raw) {
    const hex = normalizeBg(raw) ?? STORAGE.DEFAULT_BUNNY_FAB_BG;
    applyBunnyFabBackground(hex);
  }

  try {
    const key = STORAGE.STORAGE_KEY_BUNNY_FAB_BG;
    chrome.storage.local.get(key, (data) => {
      if (chrome.runtime.lastError) return;
      applyFromStoredValue(data[key]);
    });
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local" || !changes[key]) return;
      applyFromStoredValue(changes[key].newValue);
    });
  } catch {
    /* ignore */
  }

  let modalBackdrop = null;

  function onEscapeKey(e) {
    if (e.key === "Escape") {
      document.removeEventListener("keydown", onEscapeKey, true);
      closeModal();
    }
  }

  /** @type {((changes: object, area: string) => void) | null} */
  let pigeonStorageListener = null;

  function closeModal() {
    document.removeEventListener("keydown", onEscapeKey, true);
    eventLogPre = null;
    if (pigeonStorageListener) {
      try {
        chrome.storage.onChanged.removeListener(pigeonStorageListener);
      } catch {
        /* ignore */
      }
      pigeonStorageListener = null;
    }
    if (modalBackdrop) {
      modalBackdrop.remove();
      modalBackdrop = null;
    }
  }

  function openModal() {
    closeModal();
    modalBackdrop = document.createElement("div");
    modalBackdrop.className = "browserclaw-modal-backdrop";
    modalBackdrop.setAttribute("role", "presentation");
    modalBackdrop.addEventListener("click", (e) => {
      if (e.target === modalBackdrop) closeModal();
    });

    const modal = document.createElement("div");
    modal.className = "browserclaw-modal browserclaw-modal--wide";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", "browserclaw-modal-title");

    const header = document.createElement("div");
    header.className = "browserclaw-modal-header";

    const title = document.createElement("span");
    title.id = "browserclaw-modal-title";
    title.textContent = "Browserclaw";

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "browserclaw-modal-close";
    closeBtn.setAttribute("aria-label", "Close");
    closeBtn.textContent = "×";
    closeBtn.addEventListener("click", closeModal);

    header.appendChild(title);
    header.appendChild(closeBtn);

    const body = document.createElement("div");
    body.className = "browserclaw-modal-body browserclaw-modal-body--stacked";

    const K_PENDING = STORAGE.STORAGE_KEY_PIGEON_PENDING_LIST;
    const K_EXEC = STORAGE.STORAGE_KEY_PIGEON_EXECUTION;

    const pigeonPanel = document.createElement("div");
    pigeonPanel.className = "browserclaw-pigeon-panel";

    const pigeonHead = document.createElement("div");
    pigeonHead.className = "browserclaw-event-panel__head";
    const pigeonTitle = document.createElement("span");
    pigeonTitle.className = "browserclaw-event-panel__title";
    pigeonTitle.textContent = "Pigeon post";
    pigeonHead.appendChild(pigeonTitle);

    const pigeonHint = document.createElement("p");
    pigeonHint.className = "browserclaw-pigeon-hint";
    pigeonHint.textContent =
      "Fetch loads pending letters from the API. Execute runs one step on this tab. Send result POSTs when all steps succeeded. Step output is logged below.";

    const pigeonBtnRow = document.createElement("div");
    pigeonBtnRow.className = "browserclaw-pigeon-btn-row";

    const pigeonFetchBtn = document.createElement("button");
    pigeonFetchBtn.type = "button";
    pigeonFetchBtn.className = "browserclaw-pigeon-btn browserclaw-pigeon-btn--fetch";
    pigeonFetchBtn.textContent = "Fetch pigeon letters";

    const pigeonExecBtn = document.createElement("button");
    pigeonExecBtn.type = "button";
    pigeonExecBtn.className = "browserclaw-pigeon-btn browserclaw-pigeon-btn--execute";
    pigeonExecBtn.textContent = "Execute";
    pigeonExecBtn.disabled = true;

    const pigeonSendBtn = document.createElement("button");
    pigeonSendBtn.type = "button";
    pigeonSendBtn.className = "browserclaw-pigeon-btn browserclaw-pigeon-btn--send";
    pigeonSendBtn.textContent = "Send result";
    pigeonSendBtn.disabled = true;

    pigeonBtnRow.appendChild(pigeonFetchBtn);
    pigeonBtnRow.appendChild(pigeonExecBtn);
    pigeonBtnRow.appendChild(pigeonSendBtn);

    const pigeonProgress = document.createElement("p");
    pigeonProgress.className = "browserclaw-pigeon-progress";
    pigeonProgress.setAttribute("aria-live", "polite");

    const pigeonStatus = document.createElement("p");
    pigeonStatus.className = "browserclaw-pigeon-status";
    pigeonStatus.setAttribute("aria-live", "polite");

    const stepLogLabel = document.createElement("div");
    stepLogLabel.className = "browserclaw-pigeon-subhead";
    stepLogLabel.textContent = "Step results";

    const pigeonStepLog = document.createElement("pre");
    pigeonStepLog.className = "browserclaw-pigeon-steplog";
    pigeonStepLog.setAttribute("role", "log");
    pigeonStepLog.setAttribute("aria-live", "polite");

    const jsonLabel = document.createElement("div");
    jsonLabel.className = "browserclaw-pigeon-subhead";
    jsonLabel.textContent = "Queued tasks (JSON)";

    const pigeonJson = document.createElement("pre");
    pigeonJson.className = "browserclaw-pigeon-json";
    pigeonJson.setAttribute("aria-label", "Queued pigeon tasks JSON");

    function setPigeonStatus(text, kind) {
      pigeonStatus.textContent = text;
      pigeonStatus.classList.remove("browserclaw-pigeon-status--ok", "browserclaw-pigeon-status--err");
      if (kind === "ok") pigeonStatus.classList.add("browserclaw-pigeon-status--ok");
      if (kind === "err") pigeonStatus.classList.add("browserclaw-pigeon-status--err");
    }

    function renderPigeonStepLog(execution) {
      const log =
        execution && typeof execution === "object" && Array.isArray(execution.stepLog) ? execution.stepLog : [];
      if (log.length === 0) {
        pigeonStepLog.textContent = "No step results yet — Fetch, then Execute for each step.";
        return;
      }
      const lines = log.map((e) => {
        if (!e || typeof e !== "object") return "";
        const t = typeof e.at === "number" ? new Date(e.at).toISOString() : "?";
        const idx = e.stepIndex != null ? String(e.stepIndex) : "?";
        const act = e.action != null ? String(e.action) : "";
        const sel = e.selector != null ? String(e.selector) : "";
        const item = e.item != null ? String(e.item) : "";
        if (e.ok) {
          let v = e.value != null ? String(e.value) : "";
          const max = 600;
          if (v.length > max) v = `${v.slice(0, max)}…`;
          v = v.replace(/\r?\n/g, "\\n");
          return `[${t}] step ${idx}  ${act}  selector=${sel || "∅"}  → ${item}\n  OK  value: ${v}`;
        }
        const err = e.error != null ? String(e.error) : "failed";
        return `[${t}] step ${idx}  ${act}  selector=${sel || "∅"}  → ${item}\n  FAIL  ${err}`;
      });
      pigeonStepLog.textContent = lines.filter(Boolean).join("\n\n");
      pigeonStepLog.scrollTop = pigeonStepLog.scrollHeight;
    }

    function formatPigeonProgress(execution, pendingLen) {
      if (!execution || typeof execution !== "object") {
        return pendingLen ? `${pendingLen} task(s) in local queue.` : "No queue — fetch pigeon letters.";
      }
      const phase = String(execution.phase ?? "");
      const steps = Array.isArray(execution.steps) ? execution.steps.length : 0;
      const idx = Number(execution.stepIndex);
      const safeIdx = Number.isFinite(idx) ? idx : 0;
      if (phase === "ready_to_send") {
        return `All ${steps} step(s) captured — use Send result.`;
      }
      if (phase === "running_step") {
        return `Running step ${Math.min(safeIdx + 1, steps)} / ${steps}…`;
      }
      if (phase === "error") {
        return `Stopped: ${execution.errorMessage || "error"}. Execute again to retry.`;
      }
      if (phase === "active" && steps > 0) {
        return `Next: step ${safeIdx + 1} of ${steps} (Execute).`;
      }
      return pendingLen ? `${pendingLen} task(s) queued.` : "";
    }

    function updatePigeonButtons(pending, execution) {
      const list = Array.isArray(pending) ? pending : [];
      const ex = execution && typeof execution === "object" ? execution : null;
      const phase = ex ? String(ex.phase ?? "") : "";
      const ready = phase === "ready_to_send";
      const running = phase === "running_step";

      let canExecute = false;
      if (!ready && !running) {
        if (ex && ex.letterId && Array.isArray(ex.steps)) {
          const si = Number(ex.stepIndex) || 0;
          canExecute = si < ex.steps.length;
        } else if (list.length > 0) {
          canExecute = true;
        }
      }
      pigeonExecBtn.disabled = !canExecute;
      pigeonSendBtn.disabled = !ready;
    }

    function updatePigeonUi(pending, execution) {
      const list = Array.isArray(pending) ? pending : [];
      try {
        pigeonJson.textContent = list.length ? JSON.stringify(list, null, 2) : "[]";
      } catch {
        pigeonJson.textContent = String(list);
      }
      renderPigeonStepLog(execution);
      pigeonProgress.textContent = formatPigeonProgress(execution, list.length);
      updatePigeonButtons(list, execution);
    }

    function refreshPigeonUi() {
      chrome.runtime.sendMessage({ type: MSG.PIGEON_GET_EXECUTION }, (res) => {
        if (chrome.runtime.lastError || !res || !res.ok) return;
        updatePigeonUi(res.pending, res.execution);
      });
    }

    pigeonFetchBtn.addEventListener("click", () => {
      setPigeonStatus("");
      pigeonFetchBtn.disabled = true;
      pigeonJson.textContent = "Loading…";
      chrome.runtime.sendMessage({ type: MSG.PIGEON_FETCH_LETTERS }, (res) => {
        pigeonFetchBtn.disabled = false;
        if (chrome.runtime.lastError) {
          pigeonJson.textContent = chrome.runtime.lastError.message;
          setPigeonStatus(chrome.runtime.lastError.message, "err");
          return;
        }
        if (!res || !res.ok) {
          const err = res && res.error ? String(res.error) : "Fetch failed.";
          pigeonJson.textContent = err;
          setPigeonStatus(err, "err");
          return;
        }
        const letters = Array.isArray(res.letters) ? res.letters : [];
        try {
          pigeonJson.textContent = letters.length ? JSON.stringify(letters, null, 2) : "[]";
        } catch {
          pigeonJson.textContent = String(res.letters);
        }
        setPigeonStatus(
          letters.length ? `Fetched ${letters.length} pigeon letter(s).` : "No pending letters.",
          "ok",
        );
        refreshPigeonUi();
      });
    });

    pigeonExecBtn.addEventListener("click", () => {
      setPigeonStatus("");
      pigeonExecBtn.disabled = true;
      chrome.runtime.sendMessage({ type: MSG.PIGEON_EXECUTE_NEXT_STEP }, (res) => {
        refreshPigeonUi();
        if (chrome.runtime.lastError) {
          setPigeonStatus(chrome.runtime.lastError.message, "err");
          return;
        }
        if (!res || !res.ok) {
          setPigeonStatus(res && res.error ? String(res.error) : "Execute failed.", "err");
          return;
        }
        if (res.readyToSend) {
          setPigeonStatus("Last step OK — use Send result.", "ok");
        } else {
          const done = res.stepsCompleted != null ? Number(res.stepsCompleted) : 0;
          const tot = res.totalSteps != null ? Number(res.totalSteps) : 0;
          setPigeonStatus(`Step OK (${done}/${tot} done). Execute again for the next step.`, "ok");
        }
        refreshPigeonUi();
      });
    });

    pigeonSendBtn.addEventListener("click", () => {
      setPigeonStatus("");
      pigeonSendBtn.disabled = true;
      chrome.runtime.sendMessage({ type: MSG.PIGEON_SEND_PIGEON_RESULT }, (res) => {
        refreshPigeonUi();
        if (chrome.runtime.lastError) {
          setPigeonStatus(chrome.runtime.lastError.message, "err");
          return;
        }
        if (!res || !res.ok) {
          setPigeonStatus(res && res.error ? String(res.error) : "Send failed.", "err");
          return;
        }
        setPigeonStatus("Posted to pigeon API; session cleared.", "ok");
        refreshPigeonUi();
      });
    });

    pigeonPanel.appendChild(pigeonHead);
    pigeonPanel.appendChild(pigeonHint);
    pigeonPanel.appendChild(pigeonBtnRow);
    pigeonPanel.appendChild(pigeonProgress);
    pigeonPanel.appendChild(pigeonStatus);
    pigeonPanel.appendChild(stepLogLabel);
    pigeonPanel.appendChild(pigeonStepLog);
    pigeonPanel.appendChild(jsonLabel);
    pigeonPanel.appendChild(pigeonJson);

    pigeonStorageListener = (changes, area) => {
      if (area !== "local") return;
      if (!changes[K_EXEC] && !changes[K_PENDING]) return;
      refreshPigeonUi();
    };
    try {
      chrome.storage.onChanged.addListener(pigeonStorageListener);
    } catch {
      pigeonStorageListener = null;
    }
    refreshPigeonUi();

    const settingsLink = document.createElement("button");
    settingsLink.type = "button";
    settingsLink.className = "browserclaw-modal-settings";
    settingsLink.textContent = "Extension options";
    settingsLink.addEventListener("click", () => {
      chrome.runtime.sendMessage({ type: MSG.OPEN_OPTIONS_PAGE }, () => {
        void chrome.runtime.lastError;
      });
    });

    const panel = document.createElement("div");
    panel.className = "browserclaw-event-panel";

    const panelHead = document.createElement("div");
    panelHead.className = "browserclaw-event-panel__head";

    const panelTitle = document.createElement("span");
    panelTitle.className = "browserclaw-event-panel__title";
    panelTitle.textContent = `DOM events (last ${LOG_MAX}, capture on window, since load)`;

    const clearBtn = document.createElement("button");
    clearBtn.type = "button";
    clearBtn.className = "browserclaw-event-panel__clear";
    clearBtn.textContent = "Clear";
    clearBtn.addEventListener("click", () => {
      eventLog.length = 0;
      eventSeq = 0;
      renderEventLog();
    });

    panelHead.appendChild(panelTitle);
    panelHead.appendChild(clearBtn);

    const pre = document.createElement("pre");
    pre.className = "browserclaw-event-log";
    pre.setAttribute("role", "log");
    pre.setAttribute("aria-live", "polite");

    chrome.storage.local.get(STORAGE.STORAGE_KEY_EVENT_LOG_ENABLED, (data) => {
      const enabled = data[STORAGE.STORAGE_KEY_EVENT_LOG_ENABLED] === true;
      if (!enabled) {
        pre.textContent =
          "Event logging is off by default. Enable “DOM event logging” in Extension options to record events here.";
        panelTitle.textContent = "DOM events (disabled)";
        clearBtn.style.display = "none";
      } else {
        eventLogPre = pre;
        renderEventLog();
      }
    });

    panel.appendChild(panelHead);
    panel.appendChild(pre);

    body.appendChild(pigeonPanel);
    body.appendChild(settingsLink);
    body.appendChild(panel);

    modal.appendChild(header);
    modal.appendChild(body);
    modalBackdrop.appendChild(modal);
    root.appendChild(modalBackdrop);
    document.addEventListener("keydown", onEscapeKey, true);
  }

  fab.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    openModal();
  });

  root.appendChild(fab);
  (document.body || document.documentElement).appendChild(root);

  try {
    chrome.runtime.sendMessage({ type: MSG.PING_FROM_CONTENT }, () => {
      void chrome.runtime.lastError;
    });
  } catch {
    /* ignore */
  }

  /**
   * Poll until a selector matches and/or page text contains targetString (pigeon listenFor).
   */
  function runListenFor(message, sendResponse) {
    const selector = typeof message.selector === "string" ? message.selector.trim() : "";
    const targetRaw = message.targetString != null ? String(message.targetString) : "";
    const targetString = targetRaw.trim();
    if (!selector && !targetString) {
      sendResponse({ ok: false, error: "listenFor requires a non-empty selector and/or targetString" });
      return;
    }

    const intervalMs = Math.min(2000, Math.max(100, Number(message.intervalMs) || 250));
    const timeoutMs = Math.min(120000, Math.max(500, Number(message.timeoutMs) || 30000));
    const start = Date.now();

    function check() {
      let hit = false;
      if (selector) {
        const el = document.querySelector(selector);
        if (!el) {
          hit = false;
        } else if (targetString) {
          const t = el.innerText != null ? String(el.innerText) : String(el.textContent || "");
          hit = t.includes(targetString);
        } else {
          hit = true;
        }
      } else {
        const body = document.body;
        const hay = body
          ? body.innerText != null
            ? String(body.innerText)
            : String(body.textContent || "")
          : "";
        hit = hay.includes(targetString);
      }

      if (hit) {
        sendResponse({
          ok: true,
          value: {
            matched: true,
            ...(selector ? { selector } : {}),
            ...(targetString ? { targetString } : {}),
          },
        });
        return;
      }
      if (Date.now() - start >= timeoutMs) {
        sendResponse({
          ok: false,
          error: `listenFor timed out after ${timeoutMs}ms (selector="${selector}", targetString="${targetString}")`,
        });
        return;
      }
      setTimeout(check, intervalMs);
    }

    check();
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === MSG.PING_FROM_CONTENT) {
      sendResponse({ ok: true });
      return true;
    }

    if (message?.type === MSG.TAB_BROADCAST) {
      fab.classList.remove("browserclaw-fab--flash");
      void fab.offsetWidth;
      fab.classList.add("browserclaw-fab--flash");
      return;
    }

    if (message?.type === MSG.PIGEON_EXECUTE_ACTION) {
      const actionName = message.action != null ? String(message.action) : "obtainText";
      if (actionName === "listenFor") {
        runListenFor(message, sendResponse);
        return true;
      }
      if (actionName === "obtainText") {
        const el = document.querySelector(message.selector || "");
        let text = "";
        if (el) {
          text = el.innerText != null ? String(el.innerText) : String(el.textContent || "");
        }
        sendResponse({ ok: !!el, value: el ? text.trim() : null });
      } else if (actionName === "typeText") {
        const el = document.querySelector(message.selector || "");
        if (el) {
          el.focus();
          el.value = "";
          el.dispatchEvent(new Event("focus", { bubbles: true }));
          const text = String(message.text || "");
          for (const ch of text) {
            el.value += ch;
            el.dispatchEvent(new InputEvent("input", { bubbles: true, data: ch, inputType: "insertText" }));
          }
          el.dispatchEvent(new Event("change", { bubbles: true }));
          sendResponse({ ok: true, value: text });
        } else {
          sendResponse({ ok: false, error: "Element not found: " + (message.selector || "") });
        }
      } else if (actionName === "click") {
        const el = document.querySelector(message.selector || "");
        if (el) {
          el.click();
          sendResponse({ ok: true, value: "clicked" });
        } else {
          sendResponse({ ok: false, error: "Element not found: " + (message.selector || "") });
        }
      } else if (actionName === "pressKey") {
        const key = String(message.key || "Enter");
        const target = message.selector ? document.querySelector(message.selector) : document.activeElement;
        if (target) {
          target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
          target.dispatchEvent(new KeyboardEvent("keypress", { key, bubbles: true }));
          target.dispatchEvent(new KeyboardEvent("keyup", { key, bubbles: true }));
          if (key === "Enter" && target.form) target.form.submit();
          sendResponse({ ok: true, value: "pressed:" + key });
        } else {
          sendResponse({ ok: false, error: "No target for key press" });
        }
      } else if (actionName === "getPageInfo") {
        sendResponse({ ok: true, value: { title: document.title, url: location.href } });
      } else {
        sendResponse({ ok: false, error: `Unknown action: ${actionName}` });
      }
      return true;
    }

    return undefined;
  });
})();

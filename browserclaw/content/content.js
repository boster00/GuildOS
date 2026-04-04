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
    modal.className = "browserclaw-modal";
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
    body.className = "browserclaw-modal-body";

    const settingsBtn = document.createElement("button");
    settingsBtn.type = "button";
    settingsBtn.className = "browserclaw-modal-settings";
    settingsBtn.textContent = "Extension options";
    settingsBtn.addEventListener("click", () => {
      chrome.runtime.sendMessage({ type: MSG.OPEN_OPTIONS_PAGE }, () => {
        void chrome.runtime.lastError;
      });
      closeModal();
    });

    body.appendChild(settingsBtn);
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

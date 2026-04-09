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
    closeBtn.textContent = "\u00d7";
    closeBtn.addEventListener("click", closeModal);

    header.appendChild(title);
    header.appendChild(closeBtn);

    const body = document.createElement("div");
    body.className = "browserclaw-modal-body";

    const settingsBtn = document.createElement('button');
    settingsBtn.type = 'button';
    settingsBtn.className = 'browserclaw-modal-settings';
    settingsBtn.textContent = 'Extension options';
    settingsBtn.addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: MSG.OPEN_OPTIONS_PAGE }, () => {
        void chrome.runtime.lastError;
      });
      closeModal();
    });

    body.appendChild(settingsBtn);

    // Cookie export section
    const cookieSection = document.createElement('div');
    cookieSection.className = 'browserclaw-modal-section';

    const cookieBtn = document.createElement('button');
    cookieBtn.type = 'button';
    cookieBtn.className = 'browserclaw-modal-settings browserclaw-modal-cookie-btn';
    cookieBtn.textContent = 'Export Cookies (.google.com)';

    const cookieStatus = document.createElement('p');
    cookieStatus.className = 'browserclaw-modal-cookie-status';

    const cookieArea = document.createElement('textarea');
    cookieArea.className = 'browserclaw-modal-cookie-area';
    cookieArea.readOnly = true;
    cookieArea.rows = 5;
    cookieArea.placeholder = 'Cookies will appear here…';
    cookieArea.id = 'bc-modal-cookie-result';
    cookieArea.style.display = 'none';

    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'browserclaw-modal-settings browserclaw-modal-copy-btn';
    copyBtn.textContent = 'Copy to clipboard';
    copyBtn.style.display = 'none';

    cookieBtn.addEventListener('click', () => {
      cookieStatus.textContent = 'Fetching…';
      chrome.runtime.sendMessage({ type: 'GET_COOKIES', domain: '.google.com' }, (res) => {
        if (chrome.runtime.lastError || !res || !res.ok) {
          cookieStatus.textContent = '✗ ' + ((chrome.runtime.lastError && chrome.runtime.lastError.message) || (res && res.error) || 'Failed');
          return;
        }
        const data = JSON.stringify(res.cookies.map((c) => ({
          name: c.name, value: c.value, domain: c.domain,
          path: c.path, httpOnly: c.httpOnly, secure: c.secure
        })));
        cookieArea.value = data;
        cookieArea.setAttribute('data-ready', '1');
        cookieArea.style.display = 'block';
        copyBtn.style.display = 'block';
        cookieStatus.textContent = '✓ ' + res.cookies.length + ' cookies';
      });
    });

    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(cookieArea.value).then(() => {
        cookieStatus.textContent = 'Copied!';
      });
    });

    cookieSection.appendChild(cookieBtn);
    cookieSection.appendChild(cookieStatus);
    cookieSection.appendChild(cookieArea);
    cookieSection.appendChild(copyBtn);
    body.appendChild(cookieSection);

    modal.appendChild(header);
    modal.appendChild(body);
    modalBackdrop.appendChild(modal);
    root.appendChild(modalBackdrop);
    document.addEventListener('keydown', onEscapeKey, true);
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
   * Dispatch a realistic pointer + mouse + click sequence on an element.
   * @param {Element} el
   */
  function performClick(el) {
    const rect = el.getBoundingClientRect();
    const cx = Math.round(rect.left + rect.width / 2);
    const cy = Math.round(rect.top + rect.height / 2);
    const shared = { bubbles: true, cancelable: true, view: window, clientX: cx, clientY: cy };
    const ptr = { ...shared, pointerId: 1, isPrimary: true, pointerType: "mouse" };
    el.dispatchEvent(new PointerEvent("pointerover", ptr));
    el.dispatchEvent(new PointerEvent("pointerenter", { ...ptr, bubbles: false }));
    el.dispatchEvent(new MouseEvent("mouseover", shared));
    el.dispatchEvent(new MouseEvent("mouseenter", { ...shared, bubbles: false }));
    el.dispatchEvent(new PointerEvent("pointermove", ptr));
    el.dispatchEvent(new MouseEvent("mousemove", shared));
    el.dispatchEvent(new PointerEvent("pointerdown", { ...ptr, button: 0, buttons: 1 }));
    el.dispatchEvent(new MouseEvent("mousedown", { ...shared, button: 0, buttons: 1 }));
    if (typeof el.focus === "function") el.focus({ preventScroll: true });
    el.dispatchEvent(new PointerEvent("pointerup", { ...ptr, button: 0, buttons: 0 }));
    el.dispatchEvent(new MouseEvent("mouseup", { ...shared, button: 0, buttons: 0 }));
    el.dispatchEvent(new MouseEvent("click", { ...shared, button: 0, buttons: 0 }));
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
      const actionName = message.action != null ? String(message.action) : "get";

      // ── click ────────────────────────────────────────────────────────────────
      if (actionName === "click") {
        const el = document.querySelector(message.selector || "");
        if (!el) {
          sendResponse({ ok: false, error: `No element for selector: ${message.selector}` });
          return true;
        }
        performClick(el);
        sendResponse({ ok: true, value: { clicked: true } });
        return true;
      }

      // ── wait (seconds, then optional selector poll for up to 30s) ────────────
      if (actionName === "wait") {
        const seconds = Math.min(120, Math.max(0, Number(message.seconds) || 0));
        const selector = message.selector != null ? String(message.selector).trim() : "";
        setTimeout(() => {
          if (!selector) {
            sendResponse({ ok: true, value: { waited: seconds } });
            return;
          }
          const pollStart = Date.now();
          const poll = setInterval(() => {
            if (document.querySelector(selector)) {
              clearInterval(poll);
              sendResponse({ ok: true, value: { waited: seconds, found: selector } });
            } else if (Date.now() - pollStart >= 30000) {
              clearInterval(poll);
              sendResponse({ ok: false, error: `Selector "${selector}" not found within 30s` });
            }
          }, 1000);
        }, seconds * 1000);
        return true;
      }

      // ── get ──────────────────────────────────────────────────────────────────
      if (actionName === "get") {
        const selector = message.selector != null ? String(message.selector).trim() : "";
        const attr = message.attribute != null ? String(message.attribute) : "";
        const getAll = Boolean(message.getAll);

        function extractValue(el) {
          if (!attr) return el.innerText != null ? String(el.innerText).trim() : String(el.textContent || "").trim();
          if (attr === "innerHTML") return el.innerHTML;
          if (attr === "outerHTML") return el.outerHTML;
          if (attr === "value") return el.value != null ? String(el.value) : null;
          return el.getAttribute(attr);
        }

        if (getAll) {
          const els = selector ? Array.from(document.querySelectorAll(selector)) : [];
          sendResponse({ ok: true, value: els.map(extractValue) });
        } else {
          const el = selector ? document.querySelector(selector) : null;
          if (!el) {
            sendResponse({ ok: false, error: `No element for selector: ${selector}` });
          } else {
            sendResponse({ ok: true, value: extractValue(el) });
          }
        }
        return true;
      }

      // ── typeText ─────────────────────────────────────────────────────────────
      if (actionName === "typeText") {
        const el = document.querySelector(message.selector || "");
        if (!el) {
          sendResponse({ ok: false, error: `No element for selector: ${message.selector}` });
          return true;
        }
        const text = message.text != null ? String(message.text) : "";
        const clearContent = message.clearContent !== false;
        if (typeof el.focus === "function") el.focus({ preventScroll: true });
        if (clearContent) {
          if (el.value !== undefined) {
            el.value = "";
          } else if (el.isContentEditable) {
            el.textContent = "";
          }
          el.dispatchEvent(new Event("input", { bubbles: true }));
        }
        for (const char of text) {
          el.dispatchEvent(new KeyboardEvent("keydown", { key: char, bubbles: true, cancelable: true }));
          el.dispatchEvent(new KeyboardEvent("keypress", { key: char, bubbles: true, cancelable: true }));
          if (el.value !== undefined) {
            el.value += char;
          } else if (el.isContentEditable) {
            el.textContent += char;
          }
          el.dispatchEvent(new InputEvent("input", { data: char, bubbles: true, inputType: "insertText" }));
          el.dispatchEvent(new KeyboardEvent("keyup", { key: char, bubbles: true, cancelable: true }));
        }
        el.dispatchEvent(new Event("change", { bubbles: true }));
        sendResponse({ ok: true, value: { typed: text.length } });
        return true;
      }

      // ── pressKey ─────────────────────────────────────────────────────────────
      if (actionName === "pressKey") {
        const selector = message.selector != null ? String(message.selector).trim() : "";
        const key = message.key != null ? String(message.key) : "";
        const target = selector ? document.querySelector(selector) : (document.activeElement || document.body);
        if (!target) {
          sendResponse({ ok: false, error: "No target element for pressKey" });
          return true;
        }
        const opts = { key, bubbles: true, cancelable: true };
        target.dispatchEvent(new KeyboardEvent("keydown", opts));
        target.dispatchEvent(new KeyboardEvent("keypress", opts));
        target.dispatchEvent(new KeyboardEvent("keyup", opts));
        sendResponse({ ok: true, value: { key } });
        return true;
      }

      // ── getUrl ───────────────────────────────────────────────────────────────
      if (actionName === "getUrl") {
        sendResponse({ ok: true, value: window.location.href });
        return true;
      }

      sendResponse({ ok: false, error: `Unknown action: ${actionName}` });
      return true;
    }

    return undefined;
  });
})();

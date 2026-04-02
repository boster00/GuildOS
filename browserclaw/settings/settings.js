(function () {
  const SETTINGS_META = globalThis.BROWSERCLAW_SETTINGS;
  const normalize = globalThis.browserclawNormalizeBunnyFabBg;

  const form = document.getElementById("bc-settings-form");
  const colorInput = document.getElementById("bunny-bg-color");
  const hexInput = document.getElementById("bunny-bg-hex");
  const statusEl = document.getElementById("bc-settings-status");
  const eventLogChk = document.getElementById("bc-event-log-enabled");
  const guildosBaseInput = document.getElementById("bc-guildos-base-url");
  const pigeonKeyInput = document.getElementById("bc-pigeon-api-key");

  const storageKey = SETTINGS_META.STORAGE_KEY_BUNNY_FAB_BG;
  const eventLogKey = SETTINGS_META.STORAGE_KEY_EVENT_LOG_ENABLED;
  const guildosKey = SETTINGS_META.STORAGE_KEY_GUILDOS_BASE_URL;
  const pigeonKey = SETTINGS_META.STORAGE_KEY_PIGEON_API_KEY;

  function setStatus(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("bc-status--ok", "bc-status--err");
    if (kind === "ok") statusEl.classList.add("bc-status--ok");
    if (kind === "err") statusEl.classList.add("bc-status--err");
  }

  function applyToInputs(hex) {
    const n = normalize(hex) ?? SETTINGS_META.DEFAULT_BUNNY_FAB_BG;
    colorInput.value = n;
    hexInput.value = n;
  }

  colorInput?.addEventListener("input", () => {
    hexInput.value = colorInput.value.toLowerCase();
  });

  hexInput?.addEventListener("change", () => {
    const n = normalize(hexInput.value);
    if (n) colorInput.value = n;
  });

  const loadKeys = [storageKey, eventLogKey, guildosKey, pigeonKey];
  chrome.storage.local.get(loadKeys, (data) => {
    if (chrome.runtime.lastError) {
      setStatus(chrome.runtime.lastError.message, "err");
      applyToInputs(SETTINGS_META.DEFAULT_BUNNY_FAB_BG);
      return;
    }
    applyToInputs(data[storageKey] ?? SETTINGS_META.DEFAULT_BUNNY_FAB_BG);
    if (eventLogChk) eventLogChk.checked = data[eventLogKey] === true;
    if (guildosBaseInput) {
      guildosBaseInput.value =
        typeof data[guildosKey] === "string" && data[guildosKey].trim()
          ? data[guildosKey].trim()
          : SETTINGS_META.DEFAULT_GUILDOS_BASE_URL;
    }
    if (pigeonKeyInput && typeof data[pigeonKey] === "string") {
      pigeonKeyInput.value = data[pigeonKey];
    }
  });

  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    setStatus("");
    let hex = hexInput.value.trim() || colorInput.value;
    const n = normalize(hex);
    if (!n) {
      setStatus("Enter a valid hex color (#rgb or #rrggbb).", "err");
      return;
    }
    const payload = {
      [storageKey]: n,
      [eventLogKey]: Boolean(eventLogChk?.checked),
      [guildosKey]:
        guildosBaseInput && guildosBaseInput.value.trim()
          ? guildosBaseInput.value.trim().replace(/\/$/, "")
          : SETTINGS_META.DEFAULT_GUILDOS_BASE_URL,
      [pigeonKey]: pigeonKeyInput && pigeonKeyInput.value.trim() ? pigeonKeyInput.value.trim() : "",
    };
    chrome.storage.local.set(payload, () => {
      if (chrome.runtime.lastError) {
        setStatus(chrome.runtime.lastError.message, "err");
        return;
      }
      applyToInputs(n);
      setStatus("Saved. Open tabs pick up event + bunny settings via storage.", "ok");
    });
  });
})();

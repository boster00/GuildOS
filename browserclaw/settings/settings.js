(function () {
  const SETTINGS_META = globalThis.BROWSERCLAW_SETTINGS;
  const MSG = globalThis.BROWSERCLAW_MSG;

  const form = document.getElementById("bc-settings-form");
  const autoPilotChk = document.getElementById("bc-auto-pilot");
  const guildosBaseInput = document.getElementById("bc-guildos-base-url");
  const pigeonKeyInput = document.getElementById("bc-pigeon-api-key");
  const statusEl = document.getElementById("bc-settings-status");

  const autoPilotKey = SETTINGS_META.STORAGE_KEY_AUTO_PILOT_ENABLED;
  const guildosKey = SETTINGS_META.STORAGE_KEY_GUILDOS_BASE_URL;
  const pigeonKey = SETTINGS_META.STORAGE_KEY_PIGEON_API_KEY;

  function setStatus(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("bc-status--ok", "bc-status--err");
    if (kind === "ok") statusEl.classList.add("bc-status--ok");
    if (kind === "err") statusEl.classList.add("bc-status--err");
  }

  // Load saved values
  chrome.storage.local.get([autoPilotKey, guildosKey, pigeonKey], (data) => {
    if (chrome.runtime.lastError) { setStatus(chrome.runtime.lastError.message, "err"); return; }
    if (autoPilotChk) autoPilotChk.checked = data[autoPilotKey] === true;
    if (guildosBaseInput) {
      guildosBaseInput.value = typeof data[guildosKey] === "string" && data[guildosKey].trim()
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

    const enabled = Boolean(autoPilotChk?.checked);
    const payload = {
      [autoPilotKey]: enabled,
      [guildosKey]: guildosBaseInput?.value.trim().replace(/\/$/, "") || SETTINGS_META.DEFAULT_GUILDOS_BASE_URL,
      [pigeonKey]: pigeonKeyInput?.value.trim() || "",
    };

    chrome.storage.local.set(payload, () => {
      if (chrome.runtime.lastError) { setStatus(chrome.runtime.lastError.message, "err"); return; }
      // Notify background SW to start/stop alarm
      chrome.runtime.sendMessage({ type: MSG.AUTO_PILOT_SET, enabled }, () => {
        void chrome.runtime.lastError;
      });
      setStatus("Saved.", "ok");
    });
  });
})();

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
      chrome.runtime.sendMessage({ type: MSG.AUTO_PILOT_SET, enabled }, () => {
        void chrome.runtime.lastError;
      });
      setStatus("Saved.", "ok");
    });
  });

  // ── Pending letters panel ──────────────────────────────────────────

  const lettersSection = document.getElementById("bc-letters-section");
  const lettersList = document.getElementById("bc-letters-list");
  const lettersRefreshBtn = document.getElementById("bc-letters-refresh");

  function toggleLettersSection(visible) {
    if (lettersSection) lettersSection.style.display = visible ? "" : "none";
  }

  async function loadPendingLetters() {
    if (!lettersList) return;
    lettersList.innerHTML = '<span class="bc-spinner"></span>';
    try {
      const stored = await new Promise((res) => chrome.storage.local.get([guildosKey, pigeonKey], res));
      const base = (stored[guildosKey] || SETTINGS_META.DEFAULT_GUILDOS_BASE_URL).replace(/\/$/, "");
      const apiKey = stored[pigeonKey] || "";
      const headers = { Accept: "application/json" };
      if (apiKey) headers["X-Pigeon-Key"] = apiKey;
      const res = await fetch(`${base}/api/pigeon-post?action=pending`, { headers });
      if (!res.ok) { lettersList.textContent = `Error ${res.status}`; return; }
      const groups = await res.json();
      renderLetters(groups);
    } catch (e) {
      lettersList.textContent = e.message || "Fetch failed";
    }
  }

  function renderLetters(groups) {
    if (!lettersList) return;
    if (!Array.isArray(groups) || groups.length === 0) {
      lettersList.textContent = "No pending letters.";
      return;
    }
    lettersList.innerHTML = "";
    for (const g of groups) {
      for (const letter of (g.letters || [])) {
        const row = document.createElement("div");
        row.className = "bc-letter-row";
        const meta = document.createElement("div");
        meta.className = "bc-letter-meta";
        meta.textContent = `${g.questTitle || g.questId} \u00b7 ${letter.channel || ""} \u00b7 ${letter.letterId}`;
        const steps = letter.steps;
        const stepSummary = document.createElement("div");
        stepSummary.className = "bc-letter-steps";
        stepSummary.textContent = Array.isArray(steps)
          ? steps.map((s, i) => `${i + 1}. ${s.action}${s.url ? " -> " + s.url : ""}${s.selector ? " [" + s.selector + "]" : ""}`).join("  |  ")
          : "(no steps)";
        row.appendChild(meta);
        row.appendChild(stepSummary);
        lettersList.appendChild(row);
      }
    }
  }

  lettersRefreshBtn?.addEventListener("click", loadPendingLetters);

  // Toggle change: immediately show/hide panel + spinner
  autoPilotChk?.addEventListener("change", () => {
    if (autoPilotChk.checked) {
      toggleLettersSection(true);
      loadPendingLetters();
    } else {
      toggleLettersSection(false);
    }
  });

  // Show panel and load if already enabled on page open
  chrome.storage.local.get(autoPilotKey, (data) => {
    const on = data[autoPilotKey] === true;
    toggleLettersSection(on);
    if (on) loadPendingLetters();
  });
})();

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
      chrome.runtime.sendMessage({ type: MSG.AUTO_PILOT_SET, enabled }, () => { void chrome.runtime.lastError; });
      setStatus("Saved.", "ok");
    });
  });

  // ── Helpers ────────────────────────────────────────────────────────────────

  function sendMsg(msg) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(msg, (r) => {
        if (chrome.runtime.lastError) resolve({ ok: false, error: chrome.runtime.lastError.message });
        else resolve(r || { ok: false, error: "No response" });
      });
    });
  }

  function describeStep(step) {
    const a = String(step.action ?? "get");
    if (a === "navigate") return "navigate \u2192 " + (step.url || "");
    if (a === "get") {
      let s = "get " + (step.selector || "");
      if (step.attribute) s += " [" + step.attribute + "]";
      if (step.getAll) s += " (all)";
      if (step.item) s += " \u2192 " + step.item;
      return s;
    }
    if (a === "click") return "click " + (step.selector || "");
    if (a === "typeText") return "typeText " + (step.selector || "") + (step.text ? ' "' + String(step.text).slice(0, 20) + (String(step.text).length > 20 ? "\u2026" : "") + '"' : "");
    if (a === "wait") return "wait " + (step.seconds ?? 0) + "s" + (step.selector ? " \u00b7 " + step.selector : "");
    if (a === "pressKey") return 'pressKey "' + (step.key || "") + '"' + (step.selector ? " \u00b7 " + step.selector : "");
    if (a === "getUrl") return "getUrl" + (step.item ? " \u2192 " + step.item : "");
    return a;
  }

  function flattenGroups(groups) {
    const out = [];
    if (!Array.isArray(groups)) return out;
    for (const g of groups) {
      for (const letter of (g.letters || [])) {
        out.push({
          questId: g.questId,
          questTitle: g.questTitle,
          letterId: letter.letterId,
          channel: letter.channel,
          steps: Array.isArray(letter.steps) ? letter.steps : [],
        });
      }
    }
    return out;
  }

  // ── Pending letters panel ──────────────────────────────────────────────────

  const lettersSection = document.getElementById("bc-letters-section");
  const lettersList = document.getElementById("bc-letters-list");
  const lettersRefreshBtn = document.getElementById("bc-letters-refresh");
  const execControls = document.getElementById("bc-exec-controls");
  const doNextBtn = document.getElementById("bc-do-next");
  const autoExecChk = document.getElementById("bc-auto-exec");
  const execStatusEl = document.getElementById("bc-exec-status");

  // Execution state
  let allLetters = [];
  let exec = { letterIdx: 0, stepIdx: 0, tabId: null, items: {}, stepResults: [], running: false };
  let autoMode = false;
  let autoTimer = null;

  function toggleLettersSection(visible) {
    if (lettersSection) lettersSection.style.display = visible ? "" : "none";
  }

  function setExecStatus(text, kind) {
    if (!execStatusEl) return;
    execStatusEl.textContent = text;
    execStatusEl.className = "bc-exec-status" +
      (kind === "ok" ? " bc-exec-status--ok" : kind === "err" ? " bc-exec-status--err" : "");
  }

  function renderSteps() {
    if (!lettersList) return;

    if (allLetters.length === 0) {
      lettersList.textContent = "No pending letters.";
      if (execControls) execControls.style.display = "none";
      return;
    }

    lettersList.innerHTML = "";

    for (let li = 0; li < allLetters.length; li++) {
      const letter = allLetters[li];
      const group = document.createElement("div");
      group.className = "bc-step-group";

      const groupTitle = document.createElement("div");
      groupTitle.className = "bc-step-group-title";
      groupTitle.textContent =
        (letter.questTitle || letter.questId) + " \u00b7 " + (letter.channel || "") + " \u00b7 " + letter.letterId;
      group.appendChild(groupTitle);

      const steps = letter.steps;
      for (let si = 0; si < steps.length; si++) {
        const step = steps[si];

        let state = "pending";
        if (li < exec.letterIdx) {
          state = "done";
        } else if (li === exec.letterIdx) {
          if (si < exec.stepIdx) {
            const r = exec.stepResults[si];
            state = r && !r.ok ? "error" : "done";
          } else if (si === exec.stepIdx) {
            state = "current";
          }
        }

        const row = document.createElement("div");
        row.className = "bc-step-item bc-step-item--" + state;

        const icon = document.createElement("span");
        icon.className = "bc-step-icon";
        icon.textContent =
          state === "current" ? "\u25b6" :
          state === "done"    ? "\u2713" :
          state === "error"   ? "\u2717" : "\u00b7";

        const label = document.createElement("span");
        label.className = "bc-step-label";
        label.textContent = (si + 1) + ". " + describeStep(step);

        row.appendChild(icon);
        row.appendChild(label);

        if (li === exec.letterIdx && (state === "done" || state === "error")) {
          const r = exec.stepResults[si];
          if (r) {
            const resultEl = document.createElement("span");
            resultEl.className = "bc-step-result";
            if (r.ok && r.value != null) {
              const v = typeof r.value === "string" ? r.value : JSON.stringify(r.value);
              resultEl.textContent = " = " + (v.length > 50 ? v.slice(0, 50) + "\u2026" : v);
            } else if (!r.ok) {
              resultEl.textContent = " \u2717 " + (r.error || "failed");
            }
            row.appendChild(resultEl);
          }
        }

        group.appendChild(row);
      }

      lettersList.appendChild(group);
    }

    if (execControls) execControls.style.display = "";
    updateExecControls();
  }

  function updateExecControls() {
    if (!doNextBtn) return;
    const letter = allLetters[exec.letterIdx];
    const isDone = !letter;
    doNextBtn.disabled = exec.running || isDone;
    doNextBtn.textContent = exec.running ? "Running\u2026" : isDone ? "All done" : "\u25b6 Do next step";
    if (isDone) setExecStatus("All letters processed.", "ok");
    else if (!exec.running) setExecStatus("");
  }

  async function deliverCurrentLetter() {
    const letter = allLetters[exec.letterIdx];
    if (!letter) return;

    if (exec.tabId != null) {
      await sendMsg({ type: MSG.PIGEON_CLOSE_TAB, tabId: exec.tabId });
      exec.tabId = null;
    }

    if (Object.keys(exec.items).length > 0) {
      const r = await sendMsg({
        type: MSG.PIGEON_DELIVER_LETTER,
        questId: letter.questId,
        letterId: letter.letterId,
        items: exec.items,
      });
      if (!r.ok) setExecStatus("Deliver failed: " + (r.error || "unknown"), "err");
    }

    exec.letterIdx++;
    exec.stepIdx = 0;
    exec.items = {};
    exec.stepResults = [];
  }

  async function doNextStep() {
    if (exec.running) return;

    const letter = allLetters[exec.letterIdx];
    if (!letter) return;

    const steps = letter.steps;

    // All steps done for this letter — deliver
    if (exec.stepIdx >= steps.length) {
      exec.running = true;
      renderSteps();
      await deliverCurrentLetter();
      exec.running = false;
      renderSteps();
      if (autoMode && allLetters[exec.letterIdx]) scheduleAuto();
      return;
    }

    const step = steps[exec.stepIdx];
    exec.running = true;
    renderSteps();

    const res = await sendMsg({
      type: MSG.PIGEON_EXEC_STEP,
      letter,
      stepIndex: exec.stepIdx,
      tabId: exec.tabId,
    });

    if (res.tabId != null) exec.tabId = res.tabId;
    exec.stepResults[exec.stepIdx] = res;

    if (res.ok && step.item) exec.items[step.item] = res.value;

    if (!res.ok) {
      setExecStatus("Step " + (exec.stepIdx + 1) + " failed: " + (res.error || "error"), "err");
      exec.running = false;
      renderSteps();
      if (autoMode) stopAutoMode();
      return;
    }

    // Post-step wait (default 1s)
    const postWait = step.wait != null ? Math.max(0, Number(step.wait)) : 1;
    if (postWait > 0) {
      await new Promise((r) => setTimeout(r, postWait * 1000));
    }

    exec.stepIdx++;

    // Deliver if last step
    if (exec.stepIdx >= steps.length) {
      await deliverCurrentLetter();
    }

    exec.running = false;
    renderSteps();

    if (autoMode && allLetters[exec.letterIdx]) scheduleAuto();
  }

  function scheduleAuto() {
    clearTimeout(autoTimer);
    autoTimer = setTimeout(doNextStep, 1000);
  }

  function stopAutoMode() {
    autoMode = false;
    if (autoExecChk) autoExecChk.checked = false;
    clearTimeout(autoTimer);
    autoTimer = null;
    updateExecControls();
  }

  doNextBtn?.addEventListener("click", () => {
    if (!exec.running && !autoMode) doNextStep();
  });

  autoExecChk?.addEventListener("change", () => {
    autoMode = Boolean(autoExecChk.checked);
    if (autoMode && !exec.running && allLetters[exec.letterIdx]) {
      doNextStep();
    } else if (!autoMode) {
      clearTimeout(autoTimer);
      autoTimer = null;
      updateExecControls();
    }
  });

  async function loadPendingLetters() {
    if (!lettersList) return;
    lettersList.innerHTML = '<span class="bc-spinner"></span>';
    if (execControls) execControls.style.display = "none";
    try {
      const stored = await new Promise((res) => chrome.storage.local.get([guildosKey, pigeonKey], res));
      const base = (stored[guildosKey] || SETTINGS_META.DEFAULT_GUILDOS_BASE_URL).replace(/\/$/, "");
      const apiKey = stored[pigeonKey] || "";
      const headers = { Accept: "application/json" };
      if (apiKey) headers["X-Pigeon-Key"] = apiKey;
      const res = await fetch(`${base}/api/pigeon-post?action=pending`, { headers });
      if (!res.ok) { lettersList.textContent = "Error " + res.status; return; }
      const groups = await res.json();
      // Reset exec state on fresh load
      stopAutoMode();
      allLetters = flattenGroups(groups);
      exec = { letterIdx: 0, stepIdx: 0, tabId: null, items: {}, stepResults: [], running: false };
      renderSteps();
    } catch (e) {
      lettersList.textContent = e.message || "Fetch failed";
    }
  }

  lettersRefreshBtn?.addEventListener("click", loadPendingLetters);

  autoPilotChk?.addEventListener("change", () => {
    if (autoPilotChk.checked) {
      toggleLettersSection(true);
      loadPendingLetters();
    } else {
      toggleLettersSection(false);
    }
  });

  chrome.storage.local.get(autoPilotKey, (data) => {
    const on = data[autoPilotKey] === true;
    toggleLettersSection(on);
    if (on) loadPendingLetters();
  });
})();

(function () {
  const MSG = globalThis.BROWSERCLAW_MSG;
  const optionsBtn = document.getElementById("bc-open-options");
  const broadcastBtn = document.getElementById("bc-broadcast");
  const status = document.getElementById("bc-status");

  function setStatus(text, kind) {
    if (!status) return;
    status.textContent = text;
    status.classList.remove("bc-popup__status--ok", "bc-popup__status--err");
    if (kind === "ok") status.classList.add("bc-popup__status--ok");
    if (kind === "err") status.classList.add("bc-popup__status--err");
  }

  optionsBtn?.addEventListener("click", () => {
    setStatus("");
    chrome.runtime.sendMessage({ type: MSG.OPEN_OPTIONS_PAGE }, (res) => {
      if (chrome.runtime.lastError) {
        setStatus(chrome.runtime.lastError.message, "err");
        return;
      }
      setStatus(res?.ok ? "Options opened." : "Could not open options.", res?.ok ? "ok" : "err");
    });
  });

  broadcastBtn?.addEventListener("click", () => {
    setStatus("");
    chrome.runtime.sendMessage(
      {
        type: MSG.BROADCAST_TO_TABS,
        payload: { source: "popup", at: Date.now() },
      },
      (res) => {
        if (chrome.runtime.lastError) {
          setStatus(chrome.runtime.lastError.message, "err");
          return;
        }
        setStatus(res?.ok ? "Broadcast sent." : "Broadcast failed.", res?.ok ? "ok" : "err");
      },
    );
  });
})();

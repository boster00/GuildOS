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

  const exportBtn = document.getElementById("bc-export-cookies");
  const copyBtn = document.getElementById("bc-copy-cookies");
  const cookieResult = document.getElementById("bc-cookie-result");
  const cookieStatus = document.getElementById("bc-cookie-status");
  const domainInput = document.getElementById("bc-cookie-domain");

  function setCookieStatus(text, kind) {
    if (!cookieStatus) return;
    cookieStatus.textContent = text;
    cookieStatus.classList.remove("bc-popup__status--ok", "bc-popup__status--err");
    if (kind === "ok") cookieStatus.classList.add("bc-popup__status--ok");
    if (kind === "err") cookieStatus.classList.add("bc-popup__status--err");
  }

  exportBtn?.addEventListener("click", () => {
    const domain = domainInput?.value.trim() || ".google.com";
    setCookieStatus("Fetching cookies…", "");
    cookieResult.style.display = "none";
    copyBtn.style.display = "none";

    chrome.runtime.sendMessage({ type: "GET_COOKIES", domain }, (res) => {
      if (chrome.runtime.lastError) {
        setCookieStatus(chrome.runtime.lastError.message, "err");
        return;
      }
      if (!res?.ok) {
        setCookieStatus(res?.error || "Failed to fetch cookies.", "err");
        return;
      }
      const cookies = res.cookies || [];
      const output = JSON.stringify(
        cookies.map(c => ({ name: c.name, value: c.value, domain: c.domain, path: c.path, httpOnly: c.httpOnly, secure: c.secure })),
        null, 2
      );
      cookieResult.value = output;
      cookieResult.style.display = "block";
      copyBtn.style.display = "block";
      setCookieStatus(`✓ ${cookies.length} cookies for ${domain}`, "ok");
    });
  });

  copyBtn?.addEventListener("click", () => {
    navigator.clipboard.writeText(cookieResult.value).then(() => {
      setCookieStatus("Copied to clipboard!", "ok");
    });
  });
})();

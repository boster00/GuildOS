// Auto-runs on load. Sends GET_COOKIES to SW, renders JSON into DOM for automation scraping.
const domain = new URLSearchParams(location.search).get("domain") || ".google.com";

chrome.runtime.sendMessage({ type: "GET_COOKIES", domain }, (res) => {
  const el = document.getElementById("bc-cookie-result");
  if (chrome.runtime.lastError || !res?.ok) {
    el.textContent = JSON.stringify({ error: chrome.runtime.lastError?.message || res?.error });
    return;
  }
  el.textContent = JSON.stringify(
    res.cookies.map(c => ({ name: c.name, value: c.value, domain: c.domain, path: c.path, httpOnly: c.httpOnly, secure: c.secure, sameSite: c.sameSite }))
  );
  el.setAttribute("data-ready", "1");
});

// Claude Outpost — injected into the Claude extension popup DOM

// ── SMOKE TEST ────────────────────────────────────────────────────────────────
console.log("hello world — Claude Outpost injected ✓");
(function smokeTest() {
  const banner = document.createElement("div");
  banner.id = "__outpost_smoke__";
  banner.textContent = "🌍 hello world — Claude Outpost";
  banner.style.cssText =
    "background:#00ff88;color:#000;font-weight:bold;font-size:13px;" +
    "padding:6px 10px;text-align:center;width:100%;box-sizing:border-box;";
  document.body.insertBefore(banner, document.body.firstChild);
})();
// ─────────────────────────────────────────────────────────────────────────────

const BOX_ID = "__guildos_outpost__";

const TYPE_STYLES = {
  quest: { icon: "⚔️", color: "#00ff88" },
  reminder: { icon: "🔔", color: "#ffd700" },
  alert: { icon: "🚨", color: "#ff4444" },
  default: { icon: "📨", color: "#aaaaff" },
};

function renderMessages(messages) {
  let box = document.getElementById(BOX_ID);

  if (!box) {
    box = document.createElement("div");
    box.id = BOX_ID;
    box.style.cssText = `
      position: fixed; bottom: 0; left: 0; right: 0;
      background: #0d0d1a; color: #e0e0e0;
      font-family: monospace; font-size: 11px;
      padding: 6px 10px; z-index: 99999;
      border-top: 1px solid #333;
      max-height: 120px; overflow-y: auto;
    `;
    document.body.appendChild(box);
  }

  if (!messages || messages.length === 0) {
    box.style.display = "none";
    return;
  }

  box.style.display = "block";
  box.innerHTML = messages
    .map((m) => {
      const style = TYPE_STYLES[m.type] || TYPE_STYLES.default;
      const link = m.url
        ? `<a href="${m.url}" target="_blank" style="color:${style.color};text-decoration:underline;">${m.text}</a>`
        : `<span style="color:${style.color};">${m.text}</span>`;
      return `<div style="margin-bottom:2px;">${style.icon} ${link}</div>`;
    })
    .join("");
}

// Initial render from storage
chrome.storage.local.get("outpostMessages", ({ outpostMessages }) => {
  renderMessages(outpostMessages || []);
});

// Live updates while popup is open
chrome.storage.onChanged.addListener((changes) => {
  if (changes.outpostMessages) {
    renderMessages(changes.outpostMessages.newValue || []);
  }
});

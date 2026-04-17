// Claude Outpost — background service worker
// Polls GuildOS for messages and stores them for the injected popup script.
// Uses programmatic injection (webNavigation + scripting) because chrome-extension://
// scheme is not allowed in manifest content_scripts matches.

const CLAUDE_EXT_ID = "fcoeoabgfenejglbffodgkkbkcdhcgfn";
const POLL_URL = "http://localhost:3002/api/outpost/messages";
const POLL_INTERVAL_MS = 5000;

// Inject injected.js whenever the Claude popup navigates
chrome.webNavigation.onCompleted.addListener(
  (details) => {
    chrome.scripting.executeScript({
      target: { tabId: details.tabId },
      files: ["injected.js"],
    });
  },
  { url: [{ urlPrefix: `chrome-extension://${CLAUDE_EXT_ID}/` }] }
);

async function fetchMessages() {
  try {
    const res = await fetch(POLL_URL);
    if (!res.ok) return;
    const data = await res.json(); // expects { messages: [{ id, text, type, url? }] }
    await chrome.storage.local.set({ outpostMessages: data.messages, outpostUpdatedAt: Date.now() });
  } catch (e) {
    // Server offline or unreachable — clear stale messages after 30s
    const { outpostUpdatedAt } = await chrome.storage.local.get("outpostUpdatedAt");
    if (outpostUpdatedAt && Date.now() - outpostUpdatedAt > 30_000) {
      await chrome.storage.local.set({ outpostMessages: [] });
    }
  }
}

// Start polling
fetchMessages();
setInterval(fetchMessages, POLL_INTERVAL_MS);

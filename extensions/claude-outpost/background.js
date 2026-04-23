// Claude Outpost — background service worker
// Polls GuildOS for a pending prompt and stores it so content.js can inject it
// into the Claude.ai input when the user opens a conversation.

const PROMPT_URL = "http://localhost:3002/api/outpost/prompt";
const POLL_INTERVAL_MS = 3000;

async function pollPendingPrompt() {
  try {
    const res = await fetch(PROMPT_URL);
    if (!res.ok) return;
    const { prompt } = await res.json();
    if (prompt) {
      await chrome.storage.local.set({ pendingPrompt: prompt });
    }
  } catch {
    // GuildOS offline — no-op, content.js will just find nothing pending
  }
}

pollPendingPrompt();
setInterval(pollPendingPrompt, POLL_INTERVAL_MS);

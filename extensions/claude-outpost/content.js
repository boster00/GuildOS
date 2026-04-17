// Claude Outpost — content script running on https://claude.ai/*
// Waits for the chat input to appear, then injects any pending prompt from GuildOS.

const INPUT_SELECTOR = '[contenteditable="true"][data-placeholder]';
const SUBMIT_SELECTOR = 'button[aria-label="Send message"]';

function injectPrompt(inputEl, text) {
  // Focus the element first so Claude.ai registers the change
  inputEl.focus();

  // Use execCommand for contenteditable so React state stays in sync
  document.execCommand("selectAll", false, null);
  document.execCommand("insertText", false, text);

  // Fallback: also set innerText and fire input event if execCommand had no effect
  if (!inputEl.innerText.trim()) {
    inputEl.innerText = text;
    inputEl.dispatchEvent(new Event("input", { bubbles: true }));
  }
}

function waitForInput(callback) {
  const el = document.querySelector(INPUT_SELECTOR);
  if (el) return callback(el);

  const observer = new MutationObserver(() => {
    const el = document.querySelector(INPUT_SELECTOR);
    if (el) {
      observer.disconnect();
      callback(el);
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

chrome.storage.local.get("pendingPrompt", ({ pendingPrompt }) => {
  if (!pendingPrompt) return;

  waitForInput((inputEl) => {
    // Clear from storage before injecting so it isn't reused on next load
    chrome.storage.local.remove("pendingPrompt");
    injectPrompt(inputEl, pendingPrompt);
  });
});

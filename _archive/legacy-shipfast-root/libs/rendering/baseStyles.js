/**
 * Single source of truth for base styles used by the centralized shadow renderer.
 * Custom CSS + headMarkup are injected after base reset to override if needed.
 */

export const BASE_RESET_CSS = `
:host {
  display: block;
  contain: content;
}

/* Custom CSS + headMarkup are injected after base reset to override if needed. */
.editorContent {
  font-family: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  padding: 1.5rem;
  min-height: 6rem;
  line-height: 1.7;
  color: oklch(0.15 0 0);
  background: oklch(1 0 0);
  outline: none; /* Prevents browser focus outline oddities in contentEditable */
}

.editorContent :where(em), .editorContent :where(i) { font-style: italic; }
.editorContent :where(u) { text-decoration: underline; }
.editorContent :where(s), .editorContent :where(del) { text-decoration: line-through; }
.editorContent :where(a) { text-decoration: underline; cursor: pointer; }
.editorContent :where(ul), .editorContent :where(ol) { list-style-position: inside; }
.editorContent :where(ul) { list-style-type: disc; }
.editorContent :where(ol) { list-style-type: decimal; }
.editorContent :where(table) { border-collapse: collapse; width: 100%; }
.editorContent :where(table td), .editorContent :where(table th) { text-align: left; }

/* Interaction blockers */
.editorContent input[disabled],
.editorContent textarea[disabled],
.editorContent select[disabled],
.editorContent button[disabled] {
  pointer-events: none;
  opacity: 0.6;
  cursor: not-allowed;
}
`;

/**
 * Locked base for a single composite sprite sheet (four poses in one image).
 * Optional user notes are appended via `buildAvatarSheetPrompt` — do not paraphrase the base.
 */
export const AVATAR_SHEET_PROMPT_BASE = `Transform the provided character portrait into ONE square sprite sheet image showing exactly four poses of the same character in a clean 2x2 grid (top-left, top-right, bottom-left, bottom-right). Each quadrant equal size. The four poses must be: (1) regular full body neutral stance, (2) happy cheerful expression, (3) jumping or mid-air playful pose, (4) busy looking at a map or document. Keep the same art style, palette, and costume as the reference. No text, no watermark, no UI. Subtle separation between cells is ok. Simple, consistent background per cell (flat or softly graded), not busy.`;

/** @deprecated use buildAvatarSheetPrompt() */
export const AVATAR_SHEET_PROMPT = AVATAR_SHEET_PROMPT_BASE;

/**
 * @param {string} [customPrompt] User-facing description (style, outfit tweaks, mood) — additive only.
 */
export function buildAvatarSheetPrompt(customPrompt) {
  const t = customPrompt != null ? String(customPrompt).trim() : "";
  if (!t) return AVATAR_SHEET_PROMPT_BASE;
  return `${AVATAR_SHEET_PROMPT_BASE}\n\nAdditional direction from the user: ${t}`;
}

-- Add 5 dedicated per-tier review-comment columns to items.
-- Each column owned by its tier; UI renders them as a 5-row review panel per item.
--
-- self_check     — T0  worker self-claim at submit time
-- openai_check   — T1  contextless OpenAI judge verdict (gpt-4o)
-- purrview_check — T2  Cat (Cursor cloud) purrview review
-- claude_check   — T3.5 Local Claude / Guildmaster direct multimodal review
-- user_feedback  — T4  end-user comment on the GM-desk review pass
--
-- All columns are nullable text. NULL = "tier hasn't reviewed yet".
-- Lock-the-tier discipline lives in code (each weapon/skill book writes only its
-- designated column). DB doesn't enforce ownership — that's a follow-up.

ALTER TABLE items
  ADD COLUMN IF NOT EXISTS self_check     text,
  ADD COLUMN IF NOT EXISTS openai_check   text,
  ADD COLUMN IF NOT EXISTS purrview_check text,
  ADD COLUMN IF NOT EXISTS claude_check   text,
  ADD COLUMN IF NOT EXISTS user_feedback  text;

COMMENT ON COLUMN items.self_check     IS 'T0 — worker self-claim comment, written by the adventurer at submit time.';
COMMENT ON COLUMN items.openai_check   IS 'T1 — contextless OpenAI judge verdict + reasoning, written by openai_images.judge.';
COMMENT ON COLUMN items.purrview_check IS 'T2 — Cat (Cursor cloud) per-item purrview review note, written by questPurrview.approve/bounce.';
COMMENT ON COLUMN items.claude_check   IS 'T3.5 — Local Claude / Guildmaster direct multimodal review note, written by questReview.pass/bounce/flagInfeasibility.';
COMMENT ON COLUMN items.user_feedback  IS 'T4 — end-user comment from the GM-desk review pass.';

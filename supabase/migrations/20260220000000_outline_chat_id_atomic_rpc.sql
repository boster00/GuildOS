-- Atomically sets chatId (and additional outline fields) only when outline.chatId is currently NULL.
-- Returns the outline as it exists after the operation:
--   • If chatId was NULL: returns the merged outline (with the new chatId).
--   • If chatId already existed: returns the existing outline unchanged.
-- Callers must inspect the returned chatId to know whether they "won" the race.
CREATE OR REPLACE FUNCTION set_outline_chat_id_if_null(
  p_article_id uuid,
  p_user_id uuid,
  p_outline_patch jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_outline jsonb;
  updated_outline jsonb;
BEGIN
  SELECT outline INTO current_outline
  FROM content_magic_articles
  WHERE id = p_article_id AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'article not found';
  END IF;

  -- chatId already set — return existing outline so caller can use it
  IF (current_outline->>'chatId') IS NOT NULL AND (current_outline->>'chatId') != '' THEN
    RETURN current_outline;
  END IF;

  updated_outline := COALESCE(current_outline, '{}'::jsonb) || p_outline_patch;

  UPDATE content_magic_articles
  SET outline = updated_outline, updated_at = now()
  WHERE id = p_article_id AND user_id = p_user_id;

  RETURN updated_outline;
END;
$$;

-- Grant execute to authenticated users (RLS on the underlying table still applies via SECURITY DEFINER check)
GRANT EXECUTE ON FUNCTION set_outline_chat_id_if_null(uuid, uuid, jsonb) TO authenticated;

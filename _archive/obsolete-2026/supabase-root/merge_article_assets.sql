-- Create RPC function for atomic JSONB merge
-- This ensures concurrent patch operations don't lose updates
-- Uses PostgreSQL's JSONB merge operator (||) for atomic updates

CREATE OR REPLACE FUNCTION merge_article_assets(
  article_id uuid,
  patch_data jsonb
)
RETURNS TABLE(assets jsonb) AS $$
BEGIN
  RETURN QUERY
  UPDATE content_magic_articles
  SET assets = COALESCE(content_magic_articles.assets, '{}'::jsonb) || patch_data
  WHERE id = article_id
  RETURNING content_magic_articles.assets;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION merge_article_assets(uuid, jsonb) TO authenticated;

-- Items + item_comments tables for quest deliverables.
-- Replaces the `quests.inventory` JSONB column. The column itself is dropped in a follow-up migration
-- after data is copied over.

-- ---------------------------------------------------------------------------
-- items
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  quest_id uuid NOT NULL REFERENCES public.quests (id) ON DELETE CASCADE,

  item_key text NOT NULL CHECK (char_length(btrim(item_key)) > 0),

  url text,
  description text,
  source text,                 -- adventurer | questmaster | chaperon | guildmaster | pigeon_delivery | ...

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (quest_id, item_key)  -- enforces REPLACE-don't-pile-on at the DB level
);

COMMENT ON TABLE public.items IS
  'Quest deliverables (screenshots, artifacts, links). One row per deliverable; UNIQUE(quest_id, item_key) makes resubmissions an UPSERT, not a duplicate.';

COMMENT ON COLUMN public.items.url IS
  'Public URL (typically Supabase Storage). Must not be file:// or raw GitHub.';

CREATE INDEX IF NOT EXISTS items_quest_id_idx ON public.items (quest_id);

-- ---------------------------------------------------------------------------
-- item_comments
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.item_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  item_id uuid NOT NULL REFERENCES public.items (id) ON DELETE CASCADE,

  role text NOT NULL CHECK (role IN ('adventurer', 'questmaster', 'chaperon', 'guildmaster')),
  text text NOT NULL CHECK (char_length(btrim(text)) > 0),

  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.item_comments IS
  'Review comments attached to a specific item (e.g. Cat annotating a screenshot). Comments are additive; replacing an item cascade-deletes its comments.';

CREATE INDEX IF NOT EXISTS item_comments_item_id_idx ON public.item_comments (item_id);

-- ---------------------------------------------------------------------------
-- updated_at trigger on items
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.items_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS items_set_updated_at ON public.items;
CREATE TRIGGER items_set_updated_at
  BEFORE UPDATE ON public.items
  FOR EACH ROW
  EXECUTE PROCEDURE public.items_set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- Items and item_comments are owned transitively through quests.owner_id.
-- ---------------------------------------------------------------------------
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "items_select_own" ON public.items;
DROP POLICY IF EXISTS "items_insert_own" ON public.items;
DROP POLICY IF EXISTS "items_update_own" ON public.items;
DROP POLICY IF EXISTS "items_delete_own" ON public.items;

CREATE POLICY "items_select_own"
  ON public.items
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.quests q WHERE q.id = items.quest_id AND q.owner_id = auth.uid()
  ));

CREATE POLICY "items_insert_own"
  ON public.items
  FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.quests q WHERE q.id = items.quest_id AND q.owner_id = auth.uid()
  ));

CREATE POLICY "items_update_own"
  ON public.items
  FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.quests q WHERE q.id = items.quest_id AND q.owner_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.quests q WHERE q.id = items.quest_id AND q.owner_id = auth.uid()
  ));

CREATE POLICY "items_delete_own"
  ON public.items
  FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.quests q WHERE q.id = items.quest_id AND q.owner_id = auth.uid()
  ));

DROP POLICY IF EXISTS "item_comments_select_own" ON public.item_comments;
DROP POLICY IF EXISTS "item_comments_insert_own" ON public.item_comments;
DROP POLICY IF EXISTS "item_comments_update_own" ON public.item_comments;
DROP POLICY IF EXISTS "item_comments_delete_own" ON public.item_comments;

CREATE POLICY "item_comments_select_own"
  ON public.item_comments
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.items i
    JOIN public.quests q ON q.id = i.quest_id
    WHERE i.id = item_comments.item_id AND q.owner_id = auth.uid()
  ));

CREATE POLICY "item_comments_insert_own"
  ON public.item_comments
  FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.items i
    JOIN public.quests q ON q.id = i.quest_id
    WHERE i.id = item_comments.item_id AND q.owner_id = auth.uid()
  ));

CREATE POLICY "item_comments_update_own"
  ON public.item_comments
  FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.items i
    JOIN public.quests q ON q.id = i.quest_id
    WHERE i.id = item_comments.item_id AND q.owner_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.items i
    JOIN public.quests q ON q.id = i.quest_id
    WHERE i.id = item_comments.item_id AND q.owner_id = auth.uid()
  ));

CREATE POLICY "item_comments_delete_own"
  ON public.item_comments
  FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.items i
    JOIN public.quests q ON q.id = i.quest_id
    WHERE i.id = item_comments.item_id AND q.owner_id = auth.uid()
  ));

-- ---------------------------------------------------------------------------
-- Grants (Supabase: service_role bypasses RLS)
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.items TO authenticated;
GRANT ALL ON TABLE public.items TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.item_comments TO authenticated;
GRANT ALL ON TABLE public.item_comments TO service_role;

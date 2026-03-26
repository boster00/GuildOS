-- VT: unique keyword/prompt_text per project; drop prompt name
-- Prompts are add-only, identified by prompt_text; keywords unique per project.

CREATE UNIQUE INDEX IF NOT EXISTS idx_vt_keywords_project_keyword
  ON vt_keywords(project_id, keyword);

CREATE UNIQUE INDEX IF NOT EXISTS idx_vt_prompts_project_prompt_text
  ON vt_prompts(project_id, prompt_text);

ALTER TABLE vt_prompts
  DROP COLUMN IF EXISTS name;

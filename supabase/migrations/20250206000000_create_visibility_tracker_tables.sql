-- Visibility Tracker (vt_*) tables - AI+SEO visibility tracking
-- Module: visibility_tracker

-- Config tables
CREATE TABLE vt_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id TEXT,
  domain TEXT NOT NULL,
  brand_terms JSONB DEFAULT '[]'::jsonb,
  cadence TEXT DEFAULT 'weekly' CHECK (cadence IN ('weekly', 'daily', '2xdaily')),
  last_run_at TIMESTAMP WITH TIME ZONE,
  last_run_status TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE vt_keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES vt_projects(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  tags JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE vt_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES vt_projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  prompt_text TEXT NOT NULL,
  models JSONB DEFAULT '["chatgpt"]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Runs/Jobs tables
CREATE TABLE vt_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES vt_projects(id) ON DELETE CASCADE,
  run_type TEXT NOT NULL CHECK (run_type IN ('scheduled', 'manual')),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'success', 'partial', 'failed')),
  started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  finished_at TIMESTAMP WITH TIME ZONE,
  requested_by_user_id UUID REFERENCES auth.users(id),
  cost_units INTEGER DEFAULT 0,
  error_summary TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE vt_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES vt_runs(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL CHECK (job_type IN ('serp_keyword', 'ai_prompt')),
  entity_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'assigned', 'processing', 'completed', 'failed')),
  attempts INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  worker_id TEXT,
  locked_at TIMESTAMP WITH TIME ZONE,
  done_at TIMESTAMP WITH TIME ZONE,
  error TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Results tables
CREATE TABLE vt_serp_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES vt_runs(id) ON DELETE CASCADE,
  keyword_id UUID NOT NULL REFERENCES vt_keywords(id) ON DELETE CASCADE,
  engine TEXT DEFAULT 'google',
  location TEXT DEFAULT 'US',
  device TEXT DEFAULT 'desktop',
  rank INTEGER,
  best_url TEXT,
  serp_features JSONB DEFAULT '{}'::jsonb,
  raw JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE vt_ai_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES vt_runs(id) ON DELETE CASCADE,
  prompt_id UUID NOT NULL REFERENCES vt_prompts(id) ON DELETE CASCADE,
  model TEXT NOT NULL CHECK (model IN ('chatgpt', 'claude', 'perplexity')),
  response_text TEXT,
  response_json JSONB,
  mentions_brand BOOLEAN DEFAULT false,
  mentions_domain BOOLEAN DEFAULT false,
  citations JSONB DEFAULT '[]'::jsonb,
  response_hash TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Indexes
CREATE INDEX idx_vt_projects_user_id ON vt_projects(user_id);
CREATE INDEX idx_vt_keywords_project_id ON vt_keywords(project_id);
CREATE INDEX idx_vt_prompts_project_id ON vt_prompts(project_id);
CREATE INDEX idx_vt_runs_project_id ON vt_runs(project_id);
CREATE INDEX idx_vt_jobs_run_id ON vt_jobs(run_id);
CREATE INDEX idx_vt_jobs_status ON vt_jobs(status) WHERE status IN ('queued', 'assigned');
CREATE INDEX idx_vt_serp_results_run_id ON vt_serp_results(run_id);
CREATE INDEX idx_vt_serp_results_keyword_id ON vt_serp_results(keyword_id);
CREATE INDEX idx_vt_ai_results_run_id ON vt_ai_results(run_id);
CREATE INDEX idx_vt_ai_results_prompt_id ON vt_ai_results(prompt_id);

-- RLS
ALTER TABLE vt_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE vt_keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE vt_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE vt_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE vt_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE vt_serp_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE vt_ai_results ENABLE ROW LEVEL SECURITY;

-- Project policies
CREATE POLICY "Users can view their own projects" ON vt_projects FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own projects" ON vt_projects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own projects" ON vt_projects FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own projects" ON vt_projects FOR DELETE USING (auth.uid() = user_id);

-- Keywords policies
CREATE POLICY "Users can view keywords of their projects" ON vt_keywords FOR SELECT 
  USING (EXISTS (SELECT 1 FROM vt_projects WHERE vt_projects.id = vt_keywords.project_id AND vt_projects.user_id = auth.uid()));
CREATE POLICY "Users can insert keywords to their projects" ON vt_keywords FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM vt_projects WHERE vt_projects.id = vt_keywords.project_id AND vt_projects.user_id = auth.uid()));
CREATE POLICY "Users can update keywords of their projects" ON vt_keywords FOR UPDATE 
  USING (EXISTS (SELECT 1 FROM vt_projects WHERE vt_projects.id = vt_keywords.project_id AND vt_projects.user_id = auth.uid()));
CREATE POLICY "Users can delete keywords of their projects" ON vt_keywords FOR DELETE 
  USING (EXISTS (SELECT 1 FROM vt_projects WHERE vt_projects.id = vt_keywords.project_id AND vt_projects.user_id = auth.uid()));

-- Prompts policies
CREATE POLICY "Users can view prompts of their projects" ON vt_prompts FOR SELECT 
  USING (EXISTS (SELECT 1 FROM vt_projects WHERE vt_projects.id = vt_prompts.project_id AND vt_projects.user_id = auth.uid()));
CREATE POLICY "Users can insert prompts to their projects" ON vt_prompts FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM vt_projects WHERE vt_projects.id = vt_prompts.project_id AND vt_projects.user_id = auth.uid()));
CREATE POLICY "Users can update prompts of their projects" ON vt_prompts FOR UPDATE 
  USING (EXISTS (SELECT 1 FROM vt_projects WHERE vt_projects.id = vt_prompts.project_id AND vt_projects.user_id = auth.uid()));
CREATE POLICY "Users can delete prompts of their projects" ON vt_prompts FOR DELETE 
  USING (EXISTS (SELECT 1 FROM vt_projects WHERE vt_projects.id = vt_prompts.project_id AND vt_projects.user_id = auth.uid()));

-- Runs policies
CREATE POLICY "Users can view runs of their projects" ON vt_runs FOR SELECT 
  USING (EXISTS (SELECT 1 FROM vt_projects WHERE vt_projects.id = vt_runs.project_id AND vt_projects.user_id = auth.uid()));
CREATE POLICY "Users can insert runs to their projects" ON vt_runs FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM vt_projects WHERE vt_projects.id = vt_runs.project_id AND vt_projects.user_id = auth.uid()));
CREATE POLICY "Users can update runs of their projects" ON vt_runs FOR UPDATE 
  USING (EXISTS (SELECT 1 FROM vt_projects WHERE vt_projects.id = vt_runs.project_id AND vt_projects.user_id = auth.uid()));
CREATE POLICY "Service role can manage all runs" ON vt_runs FOR ALL 
  USING ((auth.jwt() ->> 'role') = 'service_role');

-- Jobs policies
CREATE POLICY "Users can view jobs of their runs" ON vt_jobs FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM vt_runs 
    JOIN vt_projects ON vt_projects.id = vt_runs.project_id 
    WHERE vt_runs.id = vt_jobs.run_id AND vt_projects.user_id = auth.uid()
  ));
CREATE POLICY "Service role can manage all jobs" ON vt_jobs FOR ALL 
  USING ((auth.jwt() ->> 'role') = 'service_role');

-- SERP results policies
CREATE POLICY "Users can view serp results of their runs" ON vt_serp_results FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM vt_runs 
    JOIN vt_projects ON vt_projects.id = vt_runs.project_id 
    WHERE vt_runs.id = vt_serp_results.run_id AND vt_projects.user_id = auth.uid()
  ));
CREATE POLICY "Service role can manage all serp results" ON vt_serp_results FOR ALL 
  USING ((auth.jwt() ->> 'role') = 'service_role');

-- AI results policies
CREATE POLICY "Users can view ai results of their runs" ON vt_ai_results FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM vt_runs 
    JOIN vt_projects ON vt_projects.id = vt_runs.project_id 
    WHERE vt_runs.id = vt_ai_results.run_id AND vt_projects.user_id = auth.uid()
  ));
CREATE POLICY "Service role can manage all ai results" ON vt_ai_results FOR ALL 
  USING ((auth.jwt() ->> 'role') = 'service_role');

-- RPC: claim jobs for worker (FOR UPDATE SKIP LOCKED)
CREATE OR REPLACE FUNCTION claim_vt_jobs(p_worker_id TEXT, p_batch_size INTEGER)
RETURNS SETOF vt_jobs AS $$
BEGIN
  RETURN QUERY
  UPDATE vt_jobs
  SET status = 'assigned',
      worker_id = p_worker_id,
      locked_at = now()
  WHERE id IN (
    SELECT id FROM vt_jobs
    WHERE status = 'queued'
    ORDER BY created_at ASC
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

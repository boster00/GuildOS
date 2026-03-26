-- Add "Service role can manage all" to vt_projects, vt_keywords, vt_prompts
-- Cron runs without a user session; service role must manage these tables.
-- vt_runs, vt_jobs, vt_serp_results, vt_ai_results already have this policy.

CREATE POLICY "Service role can manage all projects" ON vt_projects FOR ALL 
  USING ((auth.jwt() ->> 'role') = 'service_role');

CREATE POLICY "Service role can manage all keywords" ON vt_keywords FOR ALL 
  USING ((auth.jwt() ->> 'role') = 'service_role');

CREATE POLICY "Service role can manage all prompts" ON vt_prompts FOR ALL 
  USING ((auth.jwt() ->> 'role') = 'service_role');

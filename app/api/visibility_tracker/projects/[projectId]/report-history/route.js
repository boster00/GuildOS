import { NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";
import {
  getProjectById,
  getLastRunsForProject,
  getSerpResultSummaries,
  getAiResultSummaries,
} from "@/libs/visibility_tracker/db";

/**
 * GET /api/visibility_tracker/projects/[projectId]/report-history
 * Returns last 10 runs for the project with SEO and AI result summaries per run.
 * Auth: project must belong to current user.
 */
export async function GET(request, { params }) {
  try {
    const projectId = params?.projectId;
    if (!projectId) {
      return NextResponse.json({ error: "projectId required" }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: project } = await getProjectById(supabase, user.id, projectId);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const { data: runs } = await getLastRunsForProject(supabase, projectId, 10);
    const runsWithResults = await Promise.all(
      runs.map(async (run) => {
        const [seoRes, aiRes] = await Promise.all([
          getSerpResultSummaries(supabase, run.id),
          getAiResultSummaries(supabase, run.id),
        ]);

        const seo = (seoRes.data || []).map((r) => ({
          keyword_id: r.keyword_id,
          keyword: r.vt_keywords?.keyword ?? "",
          rank: r.rank,
          best_url: r.best_url,
          engine: r.engine ?? "google",
        }));

        const ai = (aiRes.data || []).map((r) => ({
          prompt_id: r.prompt_id,
          prompt_text: r.vt_prompts?.prompt_text ?? "",
          model: r.model,
          mentions_brand: r.mentions_brand,
          mentions_domain: r.mentions_domain,
          citations_count: Array.isArray(r.citations) ? r.citations.length : 0,
        }));

        return {
          id: run.id,
          started_at: run.started_at,
          finished_at: run.finished_at,
          status: run.status,
          error_summary: run.error_summary ?? null,
          seo,
          ai,
        };
      })
    );

    return NextResponse.json({
      success: true,
      project_id: projectId,
      runs: runsWithResults,
    });
  } catch (error) {

    return NextResponse.json(
      { error: "Internal server error", details: error?.message },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";
import { getProject, getProjectById } from "@/libs/visibility_tracker/db";

export async function GET(request) {

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");

    if (projectId) {
      const { data: project } = await getProjectById(supabase, user.id, projectId);
      if (!project) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }
      const { data: keywords } = await supabase
        .from("vt_keywords")
        .select("*")
        .eq("project_id", project.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      const { data: prompts } = await supabase
        .from("vt_prompts")
        .select("*")
        .eq("project_id", project.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      return NextResponse.json({
        success: true,
        project,
        keywords: keywords || [],
        prompts: prompts || [],
      });
    }

    const { data: project } = await getProject(supabase, user.id);
    if (!project) {
      return NextResponse.json(
        { error: "No project found", project: null },
        { status: 200 }
      );
    }

    const { data: keywords } = await supabase
      .from("vt_keywords")
      .select("*")
      .eq("project_id", project.id)
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    const { data: prompts } = await supabase
      .from("vt_prompts")
      .select("*")
      .eq("project_id", project.id)
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    return NextResponse.json({
      success: true,
      project,
      keywords: keywords || [],
      prompts: prompts || [],
    });
  } catch (error) {

    return NextResponse.json(
      { error: "Internal server error", details: error?.message },
      { status: 500 }
    );
  }
}

export async function POST(request) {

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const { domain, brand_terms, cadence, projectId } = body;
    const domainNorm = domain?.trim();
    if (!domainNorm) {
      return NextResponse.json(
        { error: "domain is required" },
        { status: 400 }
      );
    }

    const cadenceVal = ["weekly", "daily", "2xdaily"].includes(cadence) ? cadence : "weekly";

    if (projectId) {
      const { data: existing } = await getProjectById(supabase, user.id, projectId);
      if (!existing) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }
      const { data: conflict } = await supabase
        .from("vt_projects")
        .select("id")
        .eq("user_id", user.id)
        .eq("domain", domainNorm)
        .neq("id", projectId)
        .maybeSingle();
      if (conflict) {
        return NextResponse.json(
          { error: "Another project already uses this domain", code: "DUPLICATE_DOMAIN" },
          { status: 409 }
        );
      }
      const { data: updated, error } = await supabase
        .from("vt_projects")
        .update({
          domain: domainNorm,
          brand_terms: Array.isArray(brand_terms) ? brand_terms : existing.brand_terms || [],
          cadence: cadenceVal,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .select()
        .single();
      if (error) {
        if (error.code === "23505") {
          return NextResponse.json(
            { error: "Another project already uses this domain", code: "DUPLICATE_DOMAIN" },
            { status: 409 }
          );
        }

        return NextResponse.json(
          { error: "Failed to update project", details: error.message },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true, project: updated });
    }

    const { data: conflict } = await supabase
      .from("vt_projects")
      .select("id")
      .eq("user_id", user.id)
      .eq("domain", domainNorm)
      .maybeSingle();
    if (conflict) {
      return NextResponse.json(
        { error: "You already have a project with this domain", code: "DUPLICATE_DOMAIN" },
        { status: 409 }
      );
    }

    const { data: created, error } = await supabase
      .from("vt_projects")
      .insert({
        user_id: user.id,
        domain: domainNorm,
        brand_terms: Array.isArray(brand_terms) ? brand_terms : [],
        cadence: cadenceVal,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "You already have a project with this domain", code: "DUPLICATE_DOMAIN" },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { error: "Failed to create project", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, project: created });
  } catch (error) {

    return NextResponse.json(
      { error: "Internal server error", details: error?.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/visibility_tracker/project?projectId=...
 * Deletes the project and all related data (keywords, prompts, runs, etc.) via CASCADE.
 */
export async function DELETE(request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    if (!projectId) {
      return NextResponse.json(
        { error: "projectId is required" },
        { status: 400 }
      );
    }

    const { data: project } = await getProjectById(supabase, user.id, projectId);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const { error } = await supabase
      .from("vt_projects")
      .delete()
      .eq("id", projectId)
      .eq("user_id", user.id);

    if (error) {

      return NextResponse.json(
        { error: "Failed to delete project", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {

    return NextResponse.json(
      { error: "Internal server error", details: error?.message },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";
import { getProject, getProjectById } from "@/libs/visibility_tracker/db";

const MAX_KEYWORDS = 20;

function resolveProjectId(request, fallbackProjectId) {
  const url = request.url;
  if (!url) return fallbackProjectId;
  const projectId = new URL(url).searchParams.get("projectId");
  return projectId || fallbackProjectId;
}

export async function GET(request) {

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const projectId = resolveProjectId(request, null);
    const project = projectId
      ? (await getProjectById(supabase, user.id, projectId)).data
      : (await getProject(supabase, user.id)).data;
    if (!project) {
      return NextResponse.json(
        projectId ? { error: "Project not found" } : { error: "No project found" },
        { status: 404 }
      );
    }

    const { data: keywords } = await supabase
      .from("vt_keywords")
      .select("*")
      .eq("project_id", project.id)
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    return NextResponse.json({ success: true, keywords: keywords || [] });
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
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const keywords = body.keywords;
    const projectId = body.projectId;
    if (!Array.isArray(keywords)) {
      return NextResponse.json(
        { error: "keywords must be an array" },
        { status: 400 }
      );
    }

    if (keywords.length > MAX_KEYWORDS) {
      return NextResponse.json(
        {
          error: "Maximum 20 keywords allowed",
          limit: MAX_KEYWORDS,
          current: keywords.length,
        },
        { status: 400 }
      );
    }

    const project = projectId
      ? (await getProjectById(supabase, user.id, projectId)).data
      : (await getProject(supabase, user.id)).data;
    if (!project) {
      return NextResponse.json(
        projectId ? { error: "Project not found" } : { error: "No project found" },
        { status: 404 }
      );
    }

    await supabase
      .from("vt_keywords")
      .update({ is_active: false })
      .eq("project_id", project.id);

    if (keywords.length === 0) {
      return NextResponse.json({ success: true, keywords: [] });
    }

    const rawRows = keywords.map((kw) => ({
      project_id: project.id,
      keyword: typeof kw === "string" ? kw : (kw?.keyword || "").trim(),
      tags: typeof kw === "object" && kw?.tags ? kw.tags : {},
      is_active: true,
    })).filter((r) => r.keyword);
    // Dedupe: unique keyword per project (case-sensitive)
    const seen = new Set();
    const rows = rawRows.filter((r) => {
      const key = r.keyword;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const { data: inserted, error } = await supabase
      .from("vt_keywords")
      .insert(rows)
      .select();

    if (error) {

      if (error.code === "23505") {
        return NextResponse.json(
          { error: "Duplicate keyword in this project" },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: "Failed to save keywords", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, keywords: inserted || [] });
  } catch (error) {

    return NextResponse.json(
      { error: "Internal server error", details: error?.message },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";
import { getProject, getProjectById } from "@/libs/visibility_tracker/db";

const MAX_PROMPTS = 5;
const ALLOWED_MODELS = ["chatgpt", "claude", "perplexity"];

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

    const { data: prompts } = await supabase
      .from("vt_prompts")
      .select("*")
      .eq("project_id", project.id)
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    return NextResponse.json({ success: true, prompts: prompts || [] });
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

    const prompts = body.prompts;
    const projectId = body.projectId;
    if (!Array.isArray(prompts)) {
      return NextResponse.json(
        { error: "prompts must be an array" },
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

    const idsToKeep = new Set(
      prompts.filter((p) => p.id).map((p) => p.id)
    );
    const newItems = prompts.filter((p) => !p.id && (p.prompt_text || p.promptText));

    for (const p of newItems) {
      const models = Array.isArray(p.models) ? p.models : [p.model, "chatgpt"].filter(Boolean);
      const invalid = models.some((m) => !ALLOWED_MODELS.includes(m));
      if (invalid) {
        return NextResponse.json(
          {
            error: "Each prompt must have models from: chatgpt, claude, perplexity",
            allowed: ALLOWED_MODELS,
          },
          { status: 400 }
        );
      }
    }

    const { data: currentActive } = await supabase
      .from("vt_prompts")
      .select("id, prompt_text")
      .eq("project_id", project.id)
      .eq("is_active", true);
    const existingTexts = new Set((currentActive || []).map((r) => r.prompt_text?.trim()).filter(Boolean));

    await supabase
      .from("vt_prompts")
      .update({ is_active: false })
      .eq("project_id", project.id);

    if (idsToKeep.size > 0) {
      await supabase
        .from("vt_prompts")
        .update({ is_active: true })
        .eq("project_id", project.id)
        .in("id", [...idsToKeep]);
    }

    const rowsToInsert = [];
    const seenNew = new Set();
    for (const p of newItems) {
      const text = (p.prompt_text || p.promptText || "").trim();
      if (!text || seenNew.has(text) || existingTexts.has(text)) continue;
      seenNew.add(text);
      rowsToInsert.push({
        project_id: project.id,
        prompt_text: text,
        models: Array.isArray(p.models) ? p.models : ["chatgpt"],
        is_active: true,
      });
    }

    if (rowsToInsert.length + idsToKeep.size > MAX_PROMPTS) {
      return NextResponse.json(
        {
          error: `Maximum ${MAX_PROMPTS} prompts allowed`,
          limit: MAX_PROMPTS,
          current: rowsToInsert.length + idsToKeep.size,
        },
        { status: 400 }
      );
    }

    if (rowsToInsert.length > 0) {
      const { data: inserted, error } = await supabase
        .from("vt_prompts")
        .insert(rowsToInsert)
        .select();
      if (error) {
        if (error.code === "23505") {
          return NextResponse.json(
            { error: "Duplicate prompt text in this project", code: "DUPLICATE_PROMPT" },
            { status: 409 }
          );
        }

        return NextResponse.json(
          { error: "Failed to save prompts", details: error.message },
          { status: 500 }
        );
      }
    }

    const { data: allActive } = await supabase
      .from("vt_prompts")
      .select("*")
      .eq("project_id", project.id)
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    return NextResponse.json({ success: true, prompts: allActive || [] });
  } catch (error) {

    return NextResponse.json(
      { error: "Internal server error", details: error?.message },
      { status: 500 }
    );
  }
}

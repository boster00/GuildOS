import { NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";
import { createServiceRoleClient } from "@/libs/supabase/serviceRole";

function getAdminEmails() {
  return [
    ...(process.env.ADMIN_EMAIL ? [process.env.ADMIN_EMAIL.trim().toLowerCase()] : []),
    ...(process.env.ADMIN_EMAILS
      ? process.env.ADMIN_EMAILS.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean)
      : []),
  ];
}

const PAGE_SIZE = 100;

/**
 * GET /api/admin/users/[userId]/keywords?offset=0&limit=100
 * Returns paginated VT projects + keywords with the single latest SERP position per keyword.
 */
export async function GET(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const adminEmails = getAdminEmails();
    if (!adminEmails.includes((user.email || "").toLowerCase())) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { userId } = await params;
    const { searchParams } = new URL(request.url);
    const offset = Math.max(0, parseInt(searchParams.get("offset") ?? "0", 10));
    const limit = Math.min(PAGE_SIZE, Math.max(1, parseInt(searchParams.get("limit") ?? String(PAGE_SIZE), 10)));

    const svc = createServiceRoleClient();

    const { data: projects, error: projectsError, count } = await svc
      .from("vt_projects")
      .select("id, domain, cadence, vt_keywords(id, keyword)", { count: "exact" })
      .eq("user_id", userId)
      .range(offset, offset + limit - 1);

    if (projectsError) throw projectsError;

    const kwIds = (projects ?? []).flatMap((p) => (p.vt_keywords ?? []).map((k) => k.id));

    let latestByKeyword = {};
    if (kwIds.length > 0) {
      const { data: serpResults, error: serpError } = await svc
        .from("vt_serp_results")
        .select("keyword_id, position, created_at")
        .in("keyword_id", kwIds)
        .order("created_at", { ascending: false });

      if (serpError) throw serpError;

      // First-seen per keyword_id in desc-sorted results = latest result
      for (const r of serpResults ?? []) {
        if (!latestByKeyword[r.keyword_id]) latestByKeyword[r.keyword_id] = r;
      }
    }

    // Attach latest position to each keyword
    const enrichedProjects = (projects ?? []).map((p) => ({
      id: p.id,
      domain: p.domain,
      cadence: p.cadence,
      keywords: (p.vt_keywords ?? []).map((k) => ({
        id: k.id,
        keyword: k.keyword,
        latestPosition: latestByKeyword[k.id]?.position ?? null,
        latestCheckedAt: latestByKeyword[k.id]?.created_at ?? null,
      })),
    }));

    return NextResponse.json({ projects: enrichedProjects, total: count ?? 0, offset, limit });
  } catch (e) {
    return NextResponse.json({ error: e.message ?? "Failed" }, { status: 500 });
  }
}

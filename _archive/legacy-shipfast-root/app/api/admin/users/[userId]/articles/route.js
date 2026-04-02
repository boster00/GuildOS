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
 * GET /api/admin/users/[userId]/articles?offset=0&limit=100
 * Returns paginated article id, title, created_at for the user.
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

    const { data: articles, error, count } = await svc
      .from("content_magic_articles")
      .select("id, title, created_at, status", { count: "exact" })
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return NextResponse.json({
      articles: (articles ?? []).map((a) => ({
        id: a.id,
        title: a.title || "(Untitled)",
        createdAt: a.created_at,
        status: a.status,
      })),
      total: count ?? 0,
      offset,
      limit,
    });
  } catch (e) {
    return NextResponse.json({ error: e.message ?? "Failed" }, { status: 500 });
  }
}

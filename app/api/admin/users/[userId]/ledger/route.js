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

/**
 * GET /api/admin/users/[userId]/ledger?offset=0
 * Returns paginated credit ledger for a user, ordered newest-first by seq.
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
    const offset = parseInt(searchParams.get("offset") ?? "0", 10);
    const PAGE_SIZE = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "100", 10)));

    const svc = createServiceRoleClient();
    const { data, error, count } = await svc
      .from("credit_ledger")
      .select(
        "seq, action, cost, monthly_cost, payg_cost, monthly_balance, payg_balance, meta, created_at",
        { count: "exact" }
      )
      .eq("user_id", userId)
      .order("seq", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw error;

    return NextResponse.json({ entries: data ?? [], total: count ?? 0, offset, pageSize: PAGE_SIZE });
  } catch (e) {
    return NextResponse.json({ error: e.message ?? "Failed" }, { status: 500 });
  }
}

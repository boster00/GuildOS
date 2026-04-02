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
 * GET /api/admin/users/[userId]/payments?offset=0&limit=100
 * Returns paginated Stripe webhook events for a user, newest-first.
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

    const { data, error, count } = await svc
      .from("stripe_webhook_events")
      .select("event_id, event_type, stripe_created_at, stripe_invoice_id, livemode, event_data", { count: "exact" })
      .eq("user_id", userId)
      .order("stripe_created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return NextResponse.json({ events: data ?? [], total: count ?? 0, offset, limit });
  } catch (e) {
    return NextResponse.json({ error: e.message ?? "Failed" }, { status: 500 });
  }
}

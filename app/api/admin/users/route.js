import { NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";
import { createServiceRoleClient } from "@/libs/supabase/serviceRole";
import { getTierById } from "@/libs/monkey/registry/subscriptionTiers.js";

function getAdminEmails() {
  return [
    ...(process.env.ADMIN_EMAIL ? [process.env.ADMIN_EMAIL.trim().toLowerCase()] : []),
    ...(process.env.ADMIN_EMAILS
      ? process.env.ADMIN_EMAILS.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean)
      : []),
  ];
}

const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGE_SIZE = 100;

const VALID_PLANS = ["free", "starter", "pro"];

/**
 * GET /api/admin/users?limit=100&offset=0&search=&plan=
 * Returns paginated enriched list: plan, credit balances, article count.
 */
export async function GET(request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const adminEmails = getAdminEmails();
    if (!adminEmails.includes((user.email || "").toLowerCase())) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const offset = Math.max(0, parseInt(searchParams.get("offset") ?? "0", 10));
    const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(searchParams.get("limit") ?? String(DEFAULT_PAGE_SIZE), 10)));
    const search = (searchParams.get("search") ?? "").trim().toLowerCase();
    const planParam = (searchParams.get("plan") ?? "").trim().toLowerCase();
    const plan = VALID_PLANS.includes(planParam) ? planParam : null;

    const svc = createServiceRoleClient();

    let query = svc
      .from("profiles")
      .select("id, email, subscription_plan, credits_remaining, payg_wallet, credits_reset_at, stripe_customer_id, created_at", { count: "exact" })
      .order("created_at", { ascending: false });

    if (search) {
      query = query.ilike("email", `%${search}%`);
    }
    if (plan) {
      query = query.eq("subscription_plan", plan);
    }

    const { data: profiles, error: profilesError, count: total } = await query.range(offset, offset + limit - 1);

    if (profilesError) throw profilesError;

    const ids = (profiles ?? []).map((p) => p.id);
    let articleCountMap = {};
    if (ids.length > 0) {
      const { data: articleRows, error: articleError } = await svc
        .from("content_magic_articles")
        .select("user_id")
        .in("user_id", ids);
      if (articleError) throw articleError;
      for (const row of articleRows ?? []) {
        articleCountMap[row.user_id] = (articleCountMap[row.user_id] ?? 0) + 1;
      }
    }

    const users = (profiles ?? []).map((p) => {
      const tier = getTierById(p.subscription_plan || "free");
      return {
        id: p.id,
        email: p.email,
        plan: p.subscription_plan || "free",
        planName: tier?.name ?? "Free",
        creditsRemaining: parseFloat(p.credits_remaining) || 0,
        paygWallet: parseFloat(p.payg_wallet) || 0,
        creditsResetAt: p.credits_reset_at,
        renewalAt: p.credits_reset_at,
        stripeCustomerId: p.stripe_customer_id,
        lastActive: null,
        articleCount: articleCountMap[p.id] ?? 0,
        joinedAt: p.created_at,
      };
    });

    return NextResponse.json({ users, total: total ?? 0, offset, limit });
  } catch (e) {
    return NextResponse.json({ error: e.message ?? "Failed" }, { status: 500 });
  }
}

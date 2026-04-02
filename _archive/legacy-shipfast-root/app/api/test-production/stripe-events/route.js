import { NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/test-production/stripe-events
 * Returns the current user's last 30 stripe_webhook_events rows (most recent first),
 * including all thin index columns and event_data for deep inspection.
 * Auth required.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized", events: [] }, { status: 401 });
    }

    const { data: events, error } = await supabase
      .from("stripe_webhook_events")
      .select(
        "event_id, event_type, stripe_created_at, livemode, stripe_customer_id, stripe_subscription_id, stripe_invoice_id, processed_at, event_data"
      )
      .eq("user_id", user.id)
      .order("processed_at", { ascending: false })
      .limit(30);

    if (error) {
      if (error.code === "42703") {
        // Migration not yet applied — columns don't exist, fall back gracefully
        return NextResponse.json({
          events: [],
          _note: "stripe_webhook_events columns not yet migrated — run supabase db push",
        });
      }
      return NextResponse.json({ error: error.message, events: [] }, { status: 500 });
    }

    return NextResponse.json({ events: events ?? [] });
  } catch (err) {
    return NextResponse.json({ error: err.message, events: [] }, { status: 500 });
  }
}

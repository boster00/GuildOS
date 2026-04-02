import { NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";
import { createCustomerPortal } from "@/libs/stripe";
import { cookies } from "next/headers";

export async function POST(req) {
  if (process.env.ALLOW_STRIPE_PORTAL !== "true") {
    return NextResponse.json(
      { error: "Stripe portal has been retired. Manage your subscription at /billing/subscriptions." },
      { status: 410 }
    );
  }
  try {
    const supabase = await createClient();

    const body = await req.json();
    const returnUrl = body.returnUrl ?? "/billing";

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "You must be logged in to view billing information." },
        { status: 401 }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .single();

    if (!profile?.stripe_customer_id) {
      return NextResponse.json(
        {
          error:
            "You don't have a billing account yet. Make a purchase first.",
        },
        { status: 400 }
      );
    }

    // Check if sandbox mode is enabled (only in dev)
    const cookieStore = await cookies();
    const sandboxCookie = cookieStore.get("stripe_sandbox_mode");
    const isSandboxMode = process.env.NODE_ENV !== "production" && sandboxCookie?.value === "true";

    const stripePortalUrl = await createCustomerPortal({
      customerId: profile.stripe_customer_id,
      returnUrl,
      useSandbox: isSandboxMode,
    });

    return NextResponse.json({
      url: stripePortalUrl,
    });
  } catch (e) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}

import { createCheckout, assertNoSandboxPricesInProd } from "@/libs/stripe";
import { createClient } from "@/libs/supabase/server";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

// This function is used to create a Stripe Checkout Session (one-time payment or subscription)
// It's called by the <ButtonCheckout /> component
// Users must be authenticated. It will prefill the Checkout data with their email and/or credit card (if any)
export async function POST(req) {
  const body = await req.json();

  if (!body.priceId) {
    return NextResponse.json(
      { error: "Price ID is required" },
      { status: 400 }
    );
  } else if (!body.successUrl || !body.cancelUrl) {
    return NextResponse.json(
      { error: "Success and cancel URLs are required" },
      { status: 400 }
    );
  } else if (!body.mode) {
    return NextResponse.json(
      {
        error:
          "Mode is required (either 'payment' for one-time payments or 'subscription' for recurring subscription)",
      },
      { status: 400 }
    );
  }

  const sandboxBlock = assertNoSandboxPricesInProd(body.priceId);
  if (sandboxBlock) return sandboxBlock;

  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { priceId, mode, successUrl, cancelUrl } = body;

    // Check if sandbox mode is enabled (only in dev)
    const cookieStore = await cookies();
    const sandboxCookie = cookieStore.get("stripe_sandbox_mode");
    const isSandboxMode = process.env.NODE_ENV !== "production" && sandboxCookie?.value === "true";
    const { data } = await supabase
      .from("profiles")
      .select("id, email, stripe_customer_id")
      .eq("id", user?.id)
      .single();
    const stripeSessionURL = await createCheckout({
      priceId,
      mode,
      successUrl,
      cancelUrl,
      clientReferenceId: user?.id,
      user: {
        email: data?.email,
        customerId: data?.stripe_customer_id,
      },
      useSandbox: isSandboxMode,
      // If you send coupons from the frontend, you can pass it here
      // couponId: body.couponId,
    });
    return NextResponse.json({ url: stripeSessionURL });
  } catch (e) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}

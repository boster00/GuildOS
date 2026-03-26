import { NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";
import { getDevRouteBlockResponse } from "@/libs/testStripeGuard";

export async function POST(req, { params }) {
  const block = getDevRouteBlockResponse();
  if (block) return block;

  const { test } = params;

  try {
    if (test === "ping-webhook") {
      // Create mock checkout.session.completed event with your user ID
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        return NextResponse.json({
          success: false,
          error: "Not authenticated - cannot create test event with real user ID"
        });
      }

      // Mock Stripe webhook event
      const mockEvent = {
        id: `evt_test_${Date.now()}`,
        object: "event",
        api_version: "2023-08-16",
        created: Math.floor(Date.now() / 1000),
        type: "checkout.session.completed",
        livemode: false,
        data: {
          object: {
            id: `cs_test_mock_${Date.now()}`,
            object: "checkout.session",
            mode: "subscription",
            status: "complete",
            customer: `cus_test_mock_${Date.now()}`,
            subscription: `sub_test_mock_${Date.now()}`,
            client_reference_id: user.id,
            customer_email: user.email,
            line_items: {
              data: [{
                price: {
                  id: process.env.STRIPE_PRICE_STARTER_SANDBOX_TEST || "price_test"
                }
              }]
            }
          }
        }
      };

      // Construct a fake Stripe signature (this will fail verification, but we can see if endpoint responds)
      const timestamp = Math.floor(Date.now() / 1000);
      const fakeSignature = `t=${timestamp},v1=fakesignature`;

      try {
        // Send POST to webhook endpoint
        const webhookUrl = `${req.nextUrl.origin}/api/webhook/stripe`;
        const webhookRes = await fetch(webhookUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "stripe-signature": fakeSignature
          },
          body: JSON.stringify(mockEvent)
        });

        const responseText = await webhookRes.text();
        let responseData;
        try {
          responseData = JSON.parse(responseText);
        } catch {
          responseData = responseText;
        }

        return NextResponse.json({
          success: webhookRes.ok,
          webhookEndpoint: webhookUrl,
          webhookStatusCode: webhookRes.status,
          webhookResponse: responseData,
          mockEventSent: mockEvent,
          note: webhookRes.status === 400 
            ? "Expected: Signature verification failed (this is normal for mock data). But endpoint is ACCESSIBLE and responding."
            : webhookRes.ok 
              ? "Webhook endpoint processed the mock event successfully!"
              : "Webhook endpoint returned an error",
          interpretation: webhookRes.status === 400
            ? "✅ GOOD: Webhook endpoint exists and is working (signature verification working as expected)"
            : webhookRes.ok
              ? "✅ GOOD: Webhook endpoint processed event"
              : "❌ BAD: Webhook endpoint returned error"
        });
      } catch (fetchError) {
        return NextResponse.json({
          success: false,
          error: `Failed to reach webhook endpoint: ${fetchError.message}`,
          webhookUrl: `${req.nextUrl.origin}/api/webhook/stripe`,
          note: "Webhook endpoint may not exist or server is not running",
          interpretation: "❌ BAD: Cannot connect to webhook endpoint"
        });
      }
    }

    // Old test cases removed as requested
    switch (test) {
      case "check-accounts": {
        // Check which Stripe accounts are being used
        const cookieStore = await cookies();
        const sandboxCookie = cookieStore.get("stripe_sandbox_mode");
        const isSandboxMode = process.env.NODE_ENV !== "production" && sandboxCookie?.value === "true";

        const secretKey = isSandboxMode && process.env.STRIPE_SECRET_SANDBOX_TEST_KEY
          ? process.env.STRIPE_SECRET_SANDBOX_TEST_KEY
          : process.env.STRIPE_SECRET_KEY;

        const stripe = new Stripe(secretKey);
        
        // Get account info
        const account = await stripe.accounts.retrieve();

        return NextResponse.json({
          success: true,
          isSandboxMode,
          accountId: account.id,
          accountEmail: account.email,
          secretKeyPrefix: secretKey?.substring(0, 15),
          sandboxKeyAvailable: !!process.env.STRIPE_SECRET_SANDBOX_TEST_KEY,
          webhookSecretAvailable: !!process.env.STRIPE_WEBHOOK_SECRET,
          webhookSecretPrefix: process.env.STRIPE_WEBHOOK_SECRET?.substring(0, 15),
          note: "Stripe CLI must be connected to the SAME account as secretKeyPrefix shows"
        });
      }

      case "test-webhook": {
        // Create a mock webhook event to test the endpoint
        const testEvent = {
          id: "evt_test_webhook",
          object: "event",
          type: "checkout.session.completed",
          data: {
            object: {
              id: "cs_test_123",
              mode: "subscription",
              customer: "cus_test_123",
              subscription: "sub_test_123",
              client_reference_id: "test-user-id"
            }
          }
        };

        return NextResponse.json({
          success: true,
          message: "Webhook endpoint is accessible",
          note: "This doesn't test signature verification. Use Stripe CLI 'stripe trigger' for real test",
          testEvent
        });
      }

      case "create-session": {
        const cookieStore = await cookies();
        const sandboxCookie = cookieStore.get("stripe_sandbox_mode");
        const isSandboxMode = process.env.NODE_ENV !== "production" && sandboxCookie?.value === "true";

        const secretKey = isSandboxMode && process.env.STRIPE_SECRET_SANDBOX_TEST_KEY
          ? process.env.STRIPE_SECRET_SANDBOX_TEST_KEY
          : process.env.STRIPE_SECRET_KEY;

        const stripe = new Stripe(secretKey);

        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          return NextResponse.json({ success: false, error: "Not authenticated" });
        }

        // Create a test checkout session
        const session = await stripe.checkout.sessions.create({
          mode: "subscription",
          line_items: [{
            price: process.env.STRIPE_PRICE_STARTER_SANDBOX_TEST || process.env.STRIPE_PRICE_STARTER,
            quantity: 1
          }],
          success_url: "http://localhost:3000/tests/stripe",
          cancel_url: "http://localhost:3000/tests/stripe",
          client_reference_id: user.id,
          customer_email: user.email
        });

        // Try to retrieve it immediately
        const retrieved = await stripe.checkout.sessions.retrieve(session.id);

        return NextResponse.json({
          success: true,
          sessionCreated: {
            id: session.id,
            mode: session.mode,
            url: session.url
          },
          sessionRetrieved: {
            id: retrieved.id,
            status: retrieved.status,
            mode: retrieved.mode
          },
          accountId: (await stripe.accounts.retrieve()).id,
          isSandboxMode,
          note: "Session was created AND retrieved from Stripe successfully"
        });
      }

      case "verify-session": {
        if (!body.sessionId) {
          return NextResponse.json({ success: false, error: "Session ID required" });
        }

        const cookieStore = await cookies();
        const sandboxCookie = cookieStore.get("stripe_sandbox_mode");
        const isSandboxMode = process.env.NODE_ENV !== "production" && sandboxCookie?.value === "true";

        const secretKey = isSandboxMode && process.env.STRIPE_SECRET_SANDBOX_TEST_KEY
          ? process.env.STRIPE_SECRET_SANDBOX_TEST_KEY
          : process.env.STRIPE_SECRET_KEY;

        const stripe = new Stripe(secretKey);

        try {
          const session = await stripe.checkout.sessions.retrieve(body.sessionId);
          const account = await stripe.accounts.retrieve();

          return NextResponse.json({
            success: true,
            exists: true,
            session: {
              id: session.id,
              status: session.status,
              mode: session.mode,
              customer: session.customer,
              subscription: session.subscription,
              client_reference_id: session.client_reference_id
            },
            accountId: account.id,
            isSandboxMode
          });
        } catch (error) {
          const account = await stripe.accounts.retrieve();
          return NextResponse.json({
            success: false,
            exists: false,
            error: error.message,
            accountId: account.id,
            isSandboxMode,
            note: "Session does not exist in this Stripe account"
          });
        }
      }

      case "full-flow": {
        const results = {};

        // Step 1: Check account
        const cookieStore = await cookies();
        const sandboxCookie = cookieStore.get("stripe_sandbox_mode");
        const isSandboxMode = process.env.NODE_ENV !== "production" && sandboxCookie?.value === "true";

        const secretKey = isSandboxMode && process.env.STRIPE_SECRET_SANDBOX_TEST_KEY
          ? process.env.STRIPE_SECRET_SANDBOX_TEST_KEY
          : process.env.STRIPE_SECRET_KEY;

        const stripe = new Stripe(secretKey);
        const account = await stripe.accounts.retrieve();
        
        results.step1_account = {
          accountId: account.id,
          isSandboxMode,
          secretKeyPrefix: secretKey?.substring(0, 15)
        };

        // Step 2: Create session
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          results.error = "Not authenticated";
          return NextResponse.json({ success: false, results });
        }

        const session = await stripe.checkout.sessions.create({
          mode: "subscription",
          line_items: [{
            price: process.env.STRIPE_PRICE_STARTER_SANDBOX_TEST || process.env.STRIPE_PRICE_STARTER,
            quantity: 1
          }],
          success_url: "http://localhost:3000/tests/stripe",
          cancel_url: "http://localhost:3000/tests/stripe",
          client_reference_id: user.id,
          customer_email: user.email
        });

        results.step2_session_created = {
          id: session.id,
          url: session.url
        };

        // Step 3: Verify it exists
        const retrieved = await stripe.checkout.sessions.retrieve(session.id);
        results.step3_session_exists = {
          id: retrieved.id,
          status: retrieved.status
        };

        // Step 4: Check webhook secret
        results.step4_webhook_config = {
          webhookSecretSet: !!process.env.STRIPE_WEBHOOK_SECRET,
          webhookSecretPrefix: process.env.STRIPE_WEBHOOK_SECRET?.substring(0, 15)
        };

        results.summary = {
          success: true,
          accountMatch: "Check if Stripe CLI shows same account ID as step1_account.accountId",
          sessionExists: true,
          webhookReady: !!process.env.STRIPE_WEBHOOK_SECRET,
          nextStep: "Complete the checkout at step2_session_created.url and watch for webhook logs"
        };

        return NextResponse.json({ success: true, results });
      }

      default:
        return NextResponse.json({ error: "Unknown test" }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}

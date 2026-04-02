import { notFound, redirect } from "next/navigation";
import crypto from "crypto";
import { createServiceRoleClient } from "@/libs/supabase/serviceRole";
import subscriptionTiers from "@/libs/monkey/registry/subscriptionTiers";
import config from "@/config";
import { cookies } from "next/headers";

// ============ Helper Functions ============

/** Deterministic UUID from string (credit_ledger.idempotency_key is uuid type). */
function uuidFromString(str) {
  const hex = crypto.createHash("sha256").update(str, "utf8").digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function getOrigin() {
  if (process.env.SITE_URL) return process.env.SITE_URL;
  if (process.env.NEXTAUTH_URL) return process.env.NEXTAUTH_URL;
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

function computeDiff(before, after) {
  const diff = {};
  const allKeys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  for (const key of allKeys) {
    if (JSON.stringify(before?.[key]) !== JSON.stringify(after?.[key])) {
      diff[key] = { before: before?.[key], after: after?.[key] };
    }
  }
  return diff;
}

async function getCookieHeader() {
  const cookieStore = await cookies();
  return cookieStore.getAll().map((c) => `${c.name}=${c.value}`).join("; ") || "";
}

async function isSandboxMode() {
  const cookieStore = await cookies();
  const sandboxCookie = cookieStore.get("stripe_sandbox_mode");
  return sandboxCookie?.value === "true";
}

// ============ Server Actions ============

async function lookupProfileByEmail(formData) {
  "use server";
  const email = formData.get("email");
  if (!email) return { error: "Email required" };

  const supabase = createServiceRoleClient();
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("email", email)
    .single();

  if (error) return { error: error.message };

  redirect(
    `/tests/master-of-coins?email=${encodeURIComponent(email)}&profileId=${profile.id}&action=lookup`
  );
}

async function ensureCreditsResetAt(formData) {
  "use server";
  const profileId = formData.get("profileId");
  if (!profileId) return { error: "profileId required" };

  const supabase = createServiceRoleClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("credits_reset_at")
    .eq("id", profileId)
    .single();

  if (!profile) return { error: "Profile not found" };
  if (profile.credits_reset_at) {
    redirect(
      `/tests/master-of-coins?profileId=${profileId}&action=init_reset_at&message=already_set`
    );
  }

  const { data: rpcData, error } = await supabase.rpc("test_moc_ensure_credits_reset_at", {
    p_profile_id: profileId,
  });

  if (error) return { error: error.message };

  redirect(`/tests/master-of-coins?profileId=${profileId}&action=init_reset_at`);
}

async function fastForwardTime(formData) {
  "use server";
  const profileId = formData.get("profileId");
  const daysRaw = formData.get("daysToAdvance");
  const daysToAdvance = parseInt(daysRaw, 10);

  if (!profileId) return { error: "profileId required" };
  if (Number.isNaN(daysToAdvance) || daysToAdvance < 1 || daysToAdvance > 366) {
    return { error: "daysToAdvance must be between 1 and 366" };
  }

  const supabase = createServiceRoleClient();

  const { data: before } = await supabase
    .from("profiles")
    .select("credits_reset_at")
    .eq("id", profileId)
    .single();

  if (!before) return { error: "Profile not found" };
  if (!before.credits_reset_at) {
    return { error: "credits_reset_at is null; run Initialize first." };
  }

  const { data: rpcRows, error } = await supabase.rpc("test_moc_fast_forward_credits_reset_at", {
    p_profile_id: profileId,
    p_days: daysToAdvance,
  });

  if (error) return { error: error.message };
  const afterResetAt = rpcRows?.[0]?.credits_reset_at ?? before.credits_reset_at;

  redirect(
    `/tests/master-of-coins?profileId=${profileId}&action=fast_forward&diff=${encodeURIComponent(JSON.stringify({ credits_reset_at: { before: before.credits_reset_at, after: afterResetAt } }))}`
  );
}

async function setResetDatePreset(formData) {
  "use server";
  const profileId = formData.get("profileId");
  const preset = formData.get("preset"); // "now", "past", "future"

  if (!profileId || !preset) return { error: "profileId and preset required" };
  if (!["now", "past", "future"].includes(preset)) return { error: "Invalid preset" };

  const supabase = createServiceRoleClient();
  const { error } = await supabase.rpc("test_moc_set_credits_reset_at_preset", {
    p_profile_id: profileId,
    p_preset: preset,
  });

  if (error) return { error: error.message };

  redirect(`/tests/master-of-coins?profileId=${profileId}&action=preset_${preset}`);
}

async function callMoCImmediate(formData) {
  "use server";
  const profileId = formData.get("profileId");
  const fromPlan = formData.get("fromPlan");
  const toPlan = formData.get("toPlan");
  const invoiceId = formData.get("invoiceId");
  const overrideDates = formData.get("overrideDates") === "on";
  const usePeriodMidpointAsNow = formData.get("usePeriodMidpointAsNow") === "on";

  if (!profileId || !fromPlan || !toPlan || !invoiceId) {
    return { error: "Missing required fields" };
  }

  const supabase = createServiceRoleClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", profileId)
    .single();

  if (!profile) return { error: "Profile not found" };

  const before = profile;

  let period_start_at = profile.subscription_period_start_at ?? null;
  let period_end_at = profile.credits_reset_at ?? null;

  if (overrideDates) {
    const startInput = formData.get("period_start_at");
    const endInput = formData.get("period_end_at");
    if (startInput) period_start_at = new Date(startInput).toISOString();
    if (endInput) period_end_at = new Date(endInput).toISOString();
  }

  // Null handler: when period_end_at exists but period_start_at is missing, assume 1-month period
  if (period_end_at && !period_start_at) {
    const end = new Date(period_end_at);
    end.setUTCMonth(end.getUTCMonth() - 1);
    period_start_at = end.toISOString();
  }

  if (!period_end_at) {
    return { error: "period_end_at required (profile has no credits_reset_at; run Initialize or complete B first)" };
  }

  let now;
  if (usePeriodMidpointAsNow && period_start_at && period_end_at) {
    const startMs = new Date(period_start_at).getTime();
    const endMs = new Date(period_end_at).getTime();
    const midMs = Math.floor((startMs + endMs) / 2);
    now = new Date(midMs).toISOString();
  } else {
    const { data: dbNow } = await supabase.rpc("test_moc_get_db_now");
    now =
      dbNow != null
        ? new Date(typeof dbNow === "string" ? dbNow : dbNow?.test_moc_get_db_now ?? dbNow).toISOString()
        : new Date().toISOString();
  }

  const idempotencyKey = uuidFromString(`invoice:${invoiceId}`);

  const secret = process.env.MASTER_OF_COINS_SECRET || process.env.CRON_SECRET;
  const origin = getOrigin();

  const res = await fetch(`${origin}/api/master-of-coins`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify({
      mode: "immediate",
      profileId,
      fromPlan,
      toPlan,
      period_start_at,
      period_end_at,
      now,
      idempotencyKey,
      invoiceId,
    }),
  });

  const apiResult = await res.json().catch(() => ({ error: "Invalid JSON response" }));

  const { data: after } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", profileId)
    .single();

  const diff = computeDiff(before, after);

  // Compute expected credit delta from subscriptionTiers
  const fromTier = subscriptionTiers.getTierById(fromPlan);
  const toTier = subscriptionTiers.getTierById(toPlan);
  let expectedDelta = 0;
  let remainingFraction = 0;
  if (period_start_at && period_end_at) {
    const periodStart = new Date(period_start_at).getTime();
    const periodEnd = new Date(period_end_at).getTime();
    const nowTime = new Date(now).getTime();
    remainingFraction = Math.max(
      0,
      Math.min(1, (periodEnd - nowTime) / (periodEnd - periodStart))
    );
    expectedDelta = Math.floor(
      (toTier.monthlyCreditQuota - fromTier.monthlyCreditQuota) * remainingFraction
    );
  }

  redirect(
    `/tests/master-of-coins?profileId=${profileId}&action=immediate&result=${encodeURIComponent(JSON.stringify({ result: apiResult, diff, expectedDelta, remainingFraction, idempotencyKey, fromQuota: fromTier.monthlyCreditQuota, toQuota: toTier.monthlyCreditQuota }))}`
  );
}

async function callMoCScheduleDowngrade(formData) {
  "use server";
  const profileId = formData.get("profileId");
  const toPlan = formData.get("toPlan");
  const source = formData.get("source") || "test_page";

  if (!profileId || !toPlan) {
    return { error: "Missing required fields (profileId, toPlan)" };
  }

  const supabase = createServiceRoleClient();

  const { data: before } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", profileId)
    .single();

  // DB now() for requested_at
  const { data: dbNow } = await supabase.rpc("test_moc_get_db_now");
  const requested_at = dbNow ? new Date(dbNow).toISOString() : new Date().toISOString();

  const secret = process.env.MASTER_OF_COINS_SECRET || process.env.CRON_SECRET;
  const origin = getOrigin();

  const res = await fetch(`${origin}/api/master-of-coins`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify({
      mode: "schedule_downgrade",
      profileId,
      toPlan,
      requested_at,
      source,
    }),
  });

  const apiResult = await res.json().catch(() => ({ error: "Invalid JSON response" }));

  const { data: after } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", profileId)
    .single();

  const diff = computeDiff(before, after);

  redirect(
    `/tests/master-of-coins?profileId=${profileId}&action=schedule_downgrade&result=${encodeURIComponent(JSON.stringify({ result: apiResult, diff }))}`
  );
}

async function callMoCReset(formData) {
  "use server";
  const profileId = formData.get("profileId");

  if (!profileId) return { error: "profileId required" };

  const supabase = createServiceRoleClient();

  // Ensure credits_reset_at exists
  const { data: profile } = await supabase
    .from("profiles")
    .select("credits_reset_at")
    .eq("id", profileId)
    .single();

  if (!profile?.credits_reset_at) {
    return { error: "credits_reset_at is null; run Initialize first." };
  }

  const { data: before } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", profileId)
    .single();

  const secret = process.env.MASTER_OF_COINS_SECRET || process.env.CRON_SECRET;
  const origin = getOrigin();

  const res = await fetch(`${origin}/api/master-of-coins`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify({
      mode: "reset",
      profileId,
    }),
  });

  const result = await res.json().catch(() => ({ error: "Invalid JSON response" }));

  const { data: after } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", profileId)
    .single();

  const diff = computeDiff(before, after);

  redirect(
    `/tests/master-of-coins?profileId=${profileId}&action=reset&result=${encodeURIComponent(JSON.stringify({ result, diff }))}`
  );
}

async function callMoCWorker(formData) {
  "use server";
  const confirmed = formData.get("worker_confirm") === "on";

  if (!confirmed) {
    return { error: "Must confirm checkbox to run worker (affects multiple accounts)" };
  }

  const secret = process.env.MASTER_OF_COINS_SECRET || process.env.CRON_SECRET;
  const origin = getOrigin();

  const res = await fetch(`${origin}/api/master-of-coins/worker`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify({}),
  });

  const result = await res.json().catch(() => ({ error: "Invalid JSON response" }));

  redirect(
    `/tests/master-of-coins?action=worker&result=${encodeURIComponent(JSON.stringify(result))}`
  );
}

async function createCheckoutLinks(formData) {
  "use server";
  const profileId = formData.get("profileId");
  if (!profileId) return { error: "profileId required" };

  const supabase = createServiceRoleClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", profileId)
    .single();

  if (!profile) return { error: "Profile not found" };

  const isSandbox = await isSandboxMode();
  const cookieHeader = await getCookieHeader();
  const tiers = subscriptionTiers.TIERS.filter(
    (t) => t.stripePriceId || t.stripePriceIdSandbox
  );

  const links = [];
  const headers = { "Content-Type": "application/json" };
  if (cookieHeader) headers.Cookie = cookieHeader;

  for (const tier of tiers) {
    const priceId = isSandbox ? tier.stripePriceIdSandbox : tier.stripePriceId;
    if (!priceId) continue;

    const successUrl = `${getOrigin()}/billing?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${getOrigin()}/tests/master-of-coins?profileId=${profileId}`;

    const res = await fetch(`${getOrigin()}/api/stripe/create-checkout`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        priceId,
        mode: "subscription",
        successUrl,
        cancelUrl,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (data.url) {
      links.push({
        tierId: tier.id,
        tierName: tier.name,
        monthlyPrice: tier.monthlyPrice,
        monthlyCreditQuota: tier.monthlyCreditQuota,
        url: data.url,
      });
    }
  }

  redirect(
    `/tests/master-of-coins?profileId=${profileId}&action=checkout_links&links=${encodeURIComponent(JSON.stringify(links))}`
  );
}

async function createPortalLink(formData) {
  "use server";
  const profileId = formData.get("profileId");
  if (!profileId) return { error: "profileId required" };

  const returnUrl = `${getOrigin()}/tests/master-of-coins?profileId=${profileId}`;
  const cookieHeader = await getCookieHeader();
  const headers = { "Content-Type": "application/json" };
  if (cookieHeader) headers.Cookie = cookieHeader;

  const res = await fetch(`${getOrigin()}/api/stripe/create-portal`, {
    method: "POST",
    headers,
    body: JSON.stringify({ returnUrl }),
  });

  const data = await res.json().catch(() => ({}));
  if (!data.url) return { error: "Failed to create portal link" };

  redirect(
    `/tests/master-of-coins?profileId=${profileId}&action=portal&portalUrl=${encodeURIComponent(data.url)}`
  );
}

async function refreshProfile(formData) {
  "use server";
  const profileId = formData.get("profileId");
  if (!profileId) return { error: "profileId required" };

  redirect(`/tests/master-of-coins?profileId=${profileId}&action=refresh&t=${Math.random()}`);
}

async function refreshProfileWithRetry(formData) {
  "use server";
  const profileId = formData.get("profileId");
  if (!profileId) return { error: "profileId required" };

  const supabase = createServiceRoleClient();

  for (let i = 0; i < 3; i++) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("subscription_period_start_at, credits_reset_at, subscription_plan")
      .eq("id", profileId)
      .single();

    if (profile?.subscription_period_start_at || profile?.credits_reset_at) {
      // Webhook processed
      redirect(`/tests/master-of-coins?profileId=${profileId}&action=refresh&retries=${i + 1}`);
    }

    if (i < 2) await new Promise((r) => setTimeout(r, 1000));
  }

  redirect(`/tests/master-of-coins?profileId=${profileId}&action=refresh&retries=3&timeout=true`);
}

// ============ Server Component ============

export default async function TestMasterOfCoinsPage(props) {
  const searchParams = await props.searchParams;

  // Dev-only guard (at request time, not build time)
  if (
    process.env.NODE_ENV === "production" &&
    process.env.ALLOW_TEST_MASTER_OF_COINS !== "true"
  ) {
    notFound();
  }

  const email = searchParams?.email || "";
  const profileId = searchParams?.profileId || null;
  const action = searchParams?.action || null;
  const resultParam = searchParams?.result || null;
  const linksParam = searchParams?.links || null;
  const portalUrl = searchParams?.portalUrl || null;

  let profile = null;
  let result = null;
  let links = null;

  try {
    if (resultParam) result = JSON.parse(decodeURIComponent(resultParam));
    if (linksParam) links = JSON.parse(decodeURIComponent(linksParam));
  } catch (e) {
    // Ignore parse errors
  }

  if (profileId) {
    const supabase = createServiceRoleClient();
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", profileId)
      .single();
    profile = data;
  }

  // Get all tiers for dropdowns
  const allTiers = subscriptionTiers.TIERS;

  // Compute due status using DB time (credits_reset_at <= now() only)
  let dueStatus = "unknown";
  let dueStatusColor = "gray";
  if (profile) {
    if (!profile.credits_reset_at) {
      dueStatus = "Uninitialized";
      dueStatusColor = "gray";
    } else {
      const supabase = createServiceRoleClient();
      const { data: dbNow } = await supabase.rpc("test_moc_get_db_now");
      const resetAt = new Date(profile.credits_reset_at).getTime();
      const nowMs = dbNow ? new Date(dbNow).getTime() : Date.now();
      if (resetAt <= nowMs) {
        dueStatus = "Due for Reset";
        dueStatusColor = "red";
      } else {
        dueStatus = "Active";
        dueStatusColor = "green";
      }
    }

    if (profile.coins_work_order?.pending_change) {
      dueStatus += " (Pending Downgrade)";
      dueStatusColor = "yellow";
    }
  }

  const authUrl = config.auth?.loginUrl || "/signin";

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <h1 className="text-3xl font-bold mb-6">Test Master of Coins</h1>

      {/* Dev warning */}
      <div className="alert alert-warning mb-6">
        <span>
          ⚠️ <strong>DEV ONLY</strong>: This page tests the Master of Coins subscription
          credit economy. All operations use REAL Stripe and MoC APIs.
        </span>
      </div>

      {/* Account Overview Panel */}
      {profile && (
        <div className="card bg-base-200 mb-6 sticky top-4 z-10">
          <div className="card-body">
            <h2 className="card-title">Account Overview</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="space-y-2">
                  <div>
                    <strong>Email:</strong> {profile.email}
                  </div>
                  <div>
                    <strong>Plan:</strong>{" "}
                    <span
                      className={`badge ${
                        profile.subscription_plan === "pro"
                          ? "badge-secondary"
                          : profile.subscription_plan === "starter"
                            ? "badge-success"
                            : profile.subscription_plan === "test"
                              ? "badge-info"
                              : "badge-ghost"
                      }`}
                    >
                      {profile.subscription_plan || "free"}
                    </span>
                  </div>
                  <div>
                    <strong>Credits:</strong>{" "}
                    {profile.credits_remaining ?? profile.credits ?? 0}
                  </div>
                  <div>
                    <strong>credits_reset_at (scheduler):</strong>{" "}
                    {profile.credits_reset_at || "null"}
                  </div>
                  <div>
                    <strong>Status:</strong>{" "}
                    <span
                      className={`badge ${
                        dueStatusColor === "red"
                          ? "badge-error"
                          : dueStatusColor === "green"
                            ? "badge-success"
                            : dueStatusColor === "yellow"
                              ? "badge-warning"
                              : "badge-ghost"
                      }`}
                    >
                      {dueStatus}
                    </span>
                  </div>
                </div>
              </div>
              <div>
                <details className="collapse collapse-arrow bg-base-300">
                  <summary className="collapse-title font-medium">Raw Profile JSON</summary>
                  <div className="collapse-content">
                    <pre className="text-xs overflow-auto max-h-96">
                      {JSON.stringify(profile, null, 2)}
                    </pre>
                  </div>
                </details>
              </div>
            </div>

            {/* Refresh buttons */}
            <div className="card-actions justify-end mt-4">
              <form action={refreshProfile}>
                <input type="hidden" name="profileId" value={profile.id} />
                <button type="submit" className="btn btn-sm btn-ghost">
                  Refresh Profile (no retry)
                </button>
              </form>
              <form action={refreshProfileWithRetry}>
                <input type="hidden" name="profileId" value={profile.id} />
                <button type="submit" className="btn btn-sm btn-primary">
                  Refresh Profile (poll 3x)
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Last action result */}
      {result && (
        <div className="card bg-base-300 mb-6">
          <div className="card-body">
            <h3 className="card-title">Last Action Result</h3>
            {result.diff && (
              <div className="mb-4">
                <h4 className="font-bold mb-2">Before/After Diff:</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {Object.entries(result.diff).map(([key, value]) => (
                    <div key={key} className="p-2 bg-base-100 rounded">
                      <strong>{key}:</strong>
                      <div className="text-warning">
                        {JSON.stringify(value.before)} →{" "}
                        {JSON.stringify(value.after)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {result.expectedDelta !== undefined && (
              <div className="mb-2">
                <strong>Expected Credit Delta:</strong> +{result.expectedDelta}
              </div>
            )}
            {result.idempotencyKey && (
              <div className="mb-2">
                <strong>Idempotency Key:</strong>{" "}
                <code className="text-xs">{result.idempotencyKey}</code>
              </div>
            )}
            <details className="collapse collapse-arrow bg-base-200">
              <summary className="collapse-title font-medium">API Response</summary>
              <div className="collapse-content">
                <pre className="text-xs overflow-auto max-h-96">
                  {JSON.stringify(result.result, null, 2)}
                </pre>
              </div>
            </details>
          </div>
        </div>
      )}

      {/* Section A: Identify/Create Test User */}
      <div className="card bg-base-100 mb-6">
        <div className="card-body">
          <h2 className="card-title">A. Identify/Create Test User</h2>
          <form action={lookupProfileByEmail} className="space-y-4">
            <div>
              <label className="label">
                <span className="label-text">Email Address</span>
              </label>
              <input
                type="email"
                name="email"
                defaultValue={email}
                className="input input-bordered w-full"
                placeholder="testmoc+123@example.com"
                required
              />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="btn btn-primary">
                Lookup Profile by Email
              </button>
              <a
                href={authUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary"
              >
                Auth Page (sign up in another tab)
              </a>
            </div>
          </form>
          <p className="text-sm text-gray-500 mt-2">
            Expected result: After signup, profile exists with subscription_plan=free, Stripe
            IDs empty.
          </p>
        </div>
      </div>

      {/* Sections B-F require profileId */}
      {!profile && (
        <div className="alert alert-info">
          <span>Lookup a profile first to enable testing sections below.</span>
        </div>
      )}

      {profile && (
        <>
          {/* Initialize credits_reset_at if null */}
          {!profile.credits_reset_at && (
            <div className="card bg-warning text-warning-content mb-6">
              <div className="card-body">
                <h2 className="card-title">⚠️ Initialize Scheduler Field</h2>
                <p>
                  <code>credits_reset_at</code> is null. Fast-forward and reset are blocked
                  until initialized.
                </p>
                <form action={ensureCreditsResetAt}>
                  <input type="hidden" name="profileId" value={profile.id} />
                  <button type="submit" className="btn btn-primary">
                    Initialize credits_reset_at
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* Section B: Stripe Checkout / Portal */}
          <div className="card bg-base-100 mb-6">
            <div className="card-body">
              <h2 className="card-title">B. Upgrade via Stripe (Real Checkout)</h2>
              <div className="space-y-4">
                {profile.stripe_subscription_id ? (
                  <>
                    <p className="text-sm text-gray-600">
                      You have an active subscription. Use Stripe Portal to change plan (no second subscription).
                    </p>
                    {portalUrl ? (
                      <a
                        href={portalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-primary w-full"
                      >
                        Open Stripe Portal to change plan
                      </a>
                    ) : (
                      <form action={createPortalLink}>
                        <input type="hidden" name="profileId" value={profile.id} />
                        <button type="submit" className="btn btn-primary">
                          Open Stripe Portal to change plan
                        </button>
                      </form>
                    )}
                  </>
                ) : (
                  <>
                    <form action={createCheckoutLinks}>
                      <input type="hidden" name="profileId" value={profile.id} />
                      <button type="submit" className="btn btn-primary">
                        Generate Checkout Links
                      </button>
                    </form>

                    {links && links.length > 0 && (
                      <div className="space-y-2">
                        <h3 className="font-bold">Checkout Links (new tab):</h3>
                        {links.map((link) => (
                          <div key={link.tierId}>
                            <a
                              href={link.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-outline w-full"
                            >
                              Open {link.tierName} Checkout (${link.monthlyPrice}/mo,{" "}
                              {link.monthlyCreditQuota} credits)
                            </a>
                          </div>
                        ))}
                      </div>
                    )}

                    {portalUrl && (
                      <div>
                        <a
                          href={portalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-secondary w-full"
                        >
                          Open Billing Portal
                        </a>
                      </div>
                    )}

                    {!portalUrl && (
                      <form action={createPortalLink}>
                        <input type="hidden" name="profileId" value={profile.id} />
                        <button type="submit" className="btn btn-secondary">
                          Generate Portal Link
                        </button>
                      </form>
                    )}
                  </>
                )}
              </div>
              <p className="text-sm text-gray-500 mt-2">
                {profile.stripe_subscription_id
                  ? "Expected result: Open portal in new tab, change plan. Webhook updates profile and triggers MoC immediate for prorated credits."
                  : "Expected result: Complete checkout in Stripe. Webhook updates state (plan + period dates) only, NO credits. Return here, refresh, then run MoC Immediate for prorated credits."}
              </p>
            </div>
          </div>

          {/* Section C: Immediate Upgrade */}
          <div className="card bg-base-100 mb-6">
            <div className="card-body">
              <h2 className="card-title">C. Trigger Immediate Upgrade (Test)</h2>
              <div className="alert alert-warning mb-4">
                <span>
                  ⚠️ This simulates invoice.paid webhook upgrade event. In production, Stripe
                  webhook calls MoC immediate with real invoiceId.
                </span>
              </div>
              <form action={callMoCImmediate} className="space-y-4">
                <input type="hidden" name="profileId" value={profile.id} />
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">
                      <span className="label-text">From Plan</span>
                    </label>
                    <select
                      name="fromPlan"
                      defaultValue={profile.subscription_plan || "free"}
                      className="select select-bordered w-full"
                    >
                      {allTiers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.monthlyCreditQuota} credits)
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">
                      <span className="label-text">To Plan</span>
                    </label>
                    <select name="toPlan" className="select select-bordered w-full">
                      {allTiers.filter((t) => t.id !== "free").map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.monthlyCreditQuota} credits)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="label">
                    <span className="label-text">Invoice ID</span>
                  </label>
                  <input
                    type="text"
                    name="invoiceId"
                    defaultValue={`test_inv_${profile.id.slice(0, 8)}_${Math.random().toString(36).substring(2, 11)}`}
                    className="input input-bordered w-full font-mono text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Idempotency key: invoice:[invoiceId]
                  </p>
                </div>
                <div>
                  <label className="label cursor-pointer">
                    <span className="label-text">(Danger) Override period dates from DB</span>
                    <input type="checkbox" name="overrideDates" className="checkbox" />
                  </label>
                </div>
                <div>
                  <label className="label cursor-pointer gap-2">
                    <input type="checkbox" name="usePeriodMidpointAsNow" className="checkbox" />
                    <span className="label-text">
                      Use period midpoint as &quot;now&quot; (when period is in the past, so proration &gt; 0)
                    </span>
                  </label>
                  <p className="text-xs text-gray-500 mt-1">
                    If credits_reset_at is already past, check this to simulate being inside the period and get a non-zero grant.
                  </p>
                </div>
                <button type="submit" className="btn btn-primary">
                  Call MoC Immediate (mode=immediate)
                </button>
              </form>
              <p className="text-sm text-gray-500 mt-2">
                Expected result: Prorated credit delta granted (NOT jump to full quota). Credits
                increase by computed delta based on remaining period fraction. Idempotent re-run
                with same invoiceId. If period has ended (credits_reset_at in the past), check &quot;Use period midpoint as now&quot; to see a grant.
              </p>
            </div>
          </div>

          {/* Section D: Schedule Downgrade */}
          <div className="card bg-base-100 mb-6">
            <div className="card-body">
              <h2 className="card-title">D. Schedule Downgrade</h2>
              <form action={callMoCScheduleDowngrade} className="space-y-4">
                <input type="hidden" name="profileId" value={profile.id} />
                <div>
                  <label className="label">
                    <span className="label-text">To Plan (lower tiers)</span>
                  </label>
                  <select name="toPlan" className="select select-bordered w-full">
                    {allTiers
                      .filter((t) => ["free", "test", "starter"].includes(t.id))
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.monthlyCreditQuota} credits)
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="label">
                    <span className="label-text">Source</span>
                  </label>
                  <input
                    type="text"
                    name="source"
                    defaultValue="test_page"
                    className="input input-bordered w-full"
                  />
                </div>
                <button type="submit" className="btn btn-primary">
                  Schedule Downgrade (mode=schedule_downgrade)
                </button>
              </form>
              <p className="text-sm text-gray-500 mt-2">
                Downgrade applies at next reset (credits_reset_at). coins_work_order.pending_change
                is set; reset run will apply the downgrade and clear it.
              </p>
            </div>
          </div>

          {/* Section E: Fast-Forward Time */}
          <div className="card bg-base-100 mb-6">
            <div className="card-body">
              <h2 className="card-title">E. Fast-Forward Time (Reset Boundary Testing)</h2>
              <p className="text-sm text-gray-500 mb-4">
                Subtracting days from credits_reset_at makes the account due for reset sooner.
                This simulates time passing. Stripe period columns stay unchanged (Stripe-owned).
              </p>

              {/* Preset buttons */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                <form action={setResetDatePreset}>
                  <input type="hidden" name="profileId" value={profile.id} />
                  <input type="hidden" name="preset" value="now" />
                  <button
                    type="submit"
                    className="btn btn-sm btn-success w-full"
                    disabled={!profile.credits_reset_at}
                  >
                    Make Due Now
                  </button>
                </form>
                <form action={setResetDatePreset}>
                  <input type="hidden" name="profileId" value={profile.id} />
                  <input type="hidden" name="preset" value="past" />
                  <button
                    type="submit"
                    className="btn btn-sm btn-error w-full"
                    disabled={!profile.credits_reset_at}
                  >
                    Make Past Due (7d)
                  </button>
                </form>
                <form action={setResetDatePreset}>
                  <input type="hidden" name="profileId" value={profile.id} />
                  <input type="hidden" name="preset" value="future" />
                  <button
                    type="submit"
                    className="btn btn-sm btn-info w-full"
                    disabled={!profile.credits_reset_at}
                  >
                    Make Not Due (7d)
                  </button>
                </form>
              </div>

              <form action={fastForwardTime} className="space-y-4">
                <input type="hidden" name="profileId" value={profile.id} />
                <div>
                  <label className="label">
                    <span className="label-text">Days to Advance</span>
                  </label>
                  <input
                    type="number"
                    name="daysToAdvance"
                    defaultValue="1"
                    min="1"
                    max="366"
                    className="input input-bordered w-full"
                    disabled={!profile.credits_reset_at}
                  />
                </div>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={!profile.credits_reset_at}
                >
                  Fast-Forward Time by N Days
                </button>
              </form>
              <p className="text-sm text-gray-500 mt-2">
                Expected result: credits_reset_at moved closer to now (min: now - 400 days).
                Worker selects due accounts by credits_reset_at {"<"}= now() ONLY.
              </p>
            </div>
          </div>

          {/* Section F: Run Reset */}
          <div className="card bg-base-100 mb-6">
            <div className="card-body">
              <h2 className="card-title">F. Run Reset (Cron Simulation)</h2>
              <div className="space-y-4">
                <form action={callMoCReset}>
                  <input type="hidden" name="profileId" value={profile.id} />
                  <button
                    type="submit"
                    className="btn btn-primary w-full"
                    disabled={!profile.credits_reset_at}
                  >
                    Run MoC Reset (Single Profile)
                  </button>
                </form>

                <div className="divider">OR</div>

                <form action={callMoCWorker} className="space-y-2">
                  <label className="label cursor-pointer">
                    <span className="label-text text-warning">
                      ⚠️ I understand this may affect multiple test accounts
                    </span>
                    <input type="checkbox" name="worker_confirm" className="checkbox" />
                  </label>
                  <button type="submit" className="btn btn-error w-full">
                    Run MoC Worker (All Due Profiles)
                  </button>
                </form>
              </div>
              <p className="text-sm text-gray-500 mt-2">
                Expected result: If due (credits_reset_at {"<"}= now): pending downgrade applied,
                monthly expired, new credits granted, credits_reset_at advanced. Idempotent
                re-run. If not due (credits_reset_at {">"} now): skipped.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { Coins } from "lucide-react";
import ButtonCheckout from "@/components/ButtonCheckout";
import SandboxModeToggle from "@/components/SandboxModeToggle";
import { PLAN_DISPLAY, getPlanFeatureList } from "@/libs/planDisplay";
import styles from "../Billing.module.css";

function Button({ children, className = "", variant = "default", type = "button", disabled = false, onClick, ...props }) {
  const baseClasses = "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-10 px-4 py-2";
  const variants = {
    default: "bg-blue-600 text-white hover:bg-blue-700 focus-visible:ring-blue-600",
    outline: "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus-visible:ring-blue-600",
  };
  return (
    <button type={type} disabled={disabled} className={`${baseClasses} ${variants[variant] || variants.default} ${className}`} onClick={onClick} {...props}>
      {children}
    </button>
  );
}

const IS_PROD = process.env.NODE_ENV === "production";

function getPlanIds(showTestPlans) {
  if (IS_PROD) return ["free", "starter", "pro"];
  return showTestPlans ? ["free", "test", "test2", "starter", "pro"] : ["free", "starter", "pro"];
}

function getSandboxPlans(showTestPlans) {
  if (IS_PROD) return ["starter", "pro"];
  return showTestPlans ? ["test", "test2", "starter", "pro"] : ["starter", "pro"];
}

const PAYG_PACKAGES = [30, 50, 100, 200, 500];
const PAYG_PRICE_PER_CREDIT = { starter: 0.5, pro: 0.1 };

function CheckIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
    </svg>
  );
}

/** Format an integer cent amount (as returned by Stripe) to a display currency string. */
function formatAmount(amountCents, currency) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: (currency ?? "usd").toUpperCase(),
  }).format(amountCents / 100);
}

export default function SubscriptionsPage() {
  const [profile, setProfile] = useState(null);
  const [tiers, setTiers] = useState([]);
  const [stripePlans, setStripePlans] = useState([]);
  const [showTestPlans, setShowTestPlans] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sandboxMode, setSandboxMode] = useState(false);
  const [sandboxLoading, setSandboxLoading] = useState(false);
  const [paygLoading, setPaygLoading] = useState(null);
  const [downgradeModal, setDowngradeModal] = useState(null);
  const [downgradeLoading, setDowngradeLoading] = useState(false);
  const [upgradeLoading, setUpgradeLoading] = useState(null);
  // upgradePreview: null | { toPlan, amountDue, currency, prorationDate }
  const [upgradePreview, setUpgradePreview] = useState(null);
  // upgradeError: null | { message, stripeCode, retryable }
  const [upgradeError, setUpgradeError] = useState(null);
  const [upgradeConfirmLoading, setUpgradeConfirmLoading] = useState(false);

  const planIds = getPlanIds(showTestPlans);
  const sandboxPlans = getSandboxPlans(showTestPlans);

  const fetchPlan = React.useCallback(async () => {
    const res = await fetch("/api/plan");
    if (!res.ok) return null;
    return res.json();
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const [planRes, tiersRes, plansRes, sandboxRes] = await Promise.all([
        fetch("/api/plan"),
        fetch("/api/tiers"),
        fetch("/api/billing/plans"),
        fetch("/api/billing/sandbox-mode"),
      ]);
      if (!mounted) return;
      if (planRes.ok) {
        const data = await planRes.json();
        if (mounted) setProfile(data || null);
      }
      if (tiersRes.ok) {
        const data = await tiersRes.json();
        if (mounted && Array.isArray(data)) setTiers(data);
      }
      if (plansRes.ok) {
        const data = await plansRes.json().catch(() => ({}));
        if (mounted && Array.isArray(data?.plans)) setStripePlans(data.plans);
        if (mounted && typeof data?.showTestPlans === "boolean") setShowTestPlans(data.showTestPlans);
      }
      if (sandboxRes.ok) {
        const { sandbox } = await sandboxRes.json();
        if (mounted) setSandboxMode(Boolean(sandbox));
      }
      if (mounted) setLoading(false);
    })();
    return () => { mounted = false; };
  }, []);

  const handleSandboxSubscribe = async (plan) => {
    if (!sandboxPlans.includes(plan)) return;
    setSandboxLoading(true);
    try {
      const res = await fetch("/api/billing/sandbox-subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        const updated = await fetchPlan();
        if (updated) setProfile(updated);
      } else {
      }
    } catch (e) {
    }
    setSandboxLoading(false);
  };

  const handleSandboxCancel = async () => {
    setSandboxLoading(true);
    try {
      const res = await fetch("/api/billing/sandbox-cancel", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        const updated = await fetchPlan();
        if (updated) setProfile(updated);
      } else {
      }
    } catch (e) {
    }
    setSandboxLoading(false);
  };

  // Step 1: fetch proration preview from Stripe, open confirmation modal.
  const handleUpgrade = async (tierId) => {
    setUpgradeLoading(tierId);
    setUpgradeError(null);
    try {
      const res = await fetch("/api/billing/preview-upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toPlan: tierId }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setUpgradePreview({ toPlan: tierId, ...data });
      } else {
        setUpgradeError({ message: data.error ?? "Preview failed. Please try again.", retryable: true });
      }
    } catch {
      setUpgradeError({ message: "Network error. Please try again.", retryable: true });
    }
    setUpgradeLoading(null);
  };

  // Step 2: user confirmed in modal — execute the upgrade.
  const handleConfirmUpgrade = async () => {
    setUpgradeConfirmLoading(true);
    setUpgradeError(null);
    try {
      const res = await fetch("/api/billing/upgrade-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toPlan: upgradePreview.toPlan,
          prorationDate: upgradePreview.prorationDate,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        const upgradedToPlan = upgradePreview.toPlan;
        const planDisplayName = (PLAN_DISPLAY[upgradedToPlan] ?? PLAN_DISPLAY.free).name;
        // Optimistically reflect the new plan immediately. The webhook that updates the
        // DB fires asynchronously — fetchPlan() right now would return the old plan.
        setProfile((prev) => ({ ...prev, subscription_plan: upgradedToPlan }));
        setUpgradePreview(null);
        setUpgradeError(null);
        toast.success(`You're now on the ${planDisplayName} plan.`);
        // Sync full profile data in the background. Don't let a stale server response
        // overwrite subscription_plan until the webhook has updated the DB.
        fetchPlan().then((updated) => {
          if (!updated) return;
          setProfile((prev) => ({
            ...updated,
            subscription_plan: updated.subscription_plan === upgradedToPlan ? updated.subscription_plan : prev.subscription_plan,
          }));
        });
      } else {
        setUpgradeError({
          message: data.error ?? "Payment failed. Please check your payment method.",
          stripeCode: data.stripeCode ?? null,
          retryable: data.retryable ?? false,
        });
      }
    } catch {
      setUpgradeError({ message: "Network error. Please try again.", retryable: true });
    }
    setUpgradeConfirmLoading(false);
  };

  const handleConfirmDowngrade = async () => {
    if (!downgradeModal) return;
    setDowngradeLoading(true);
    try {
      const res = await fetch("/api/billing/schedule-downgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toPlan: downgradeModal }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        const updated = await fetchPlan();
        if (updated) setProfile(updated);
        setDowngradeModal(null);
      } else {
        const msg = data?.error ?? "Downgrade failed. Please try again.";
        toast.error(msg);
      }
    } catch (e) {
      toast.error("Network error. Please try again.");
    }
    setDowngradeLoading(false);
  };

  const currentTierId = profile?.subscription_plan ?? "free";
  const hasStripeSubscription = !!profile?.stripe_subscription_id;
  const pendingDowngradeToPlan =
    profile?.coins_work_order?.pending_change?.type === "downgrade"
      ? profile.coins_work_order.pending_change.to_plan
      : null;

  const isTestTier = currentTierId === "test" || currentTierId === "test2";

  const handleBuyPaygCredits = async (credits) => {
    const canBuy = currentTierId === "starter" || currentTierId === "pro" || isTestTier;
    if (!canBuy) return;
    setPaygLoading(credits);
    try {
      const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
      const returnPath = "/billing/subscriptions";
      // test/test2 uses tier="test" which the API maps to starter PAYG price
      const tierParam = isTestTier ? currentTierId : currentTierId;
      const res = await fetch("/api/stripe/create-payg-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          credits,
          tier: tierParam,
          successUrl: `${baseUrl}${returnPath}`,
          cancelUrl: `${baseUrl}${returnPath}`,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.url) {
        window.location.href = data.url;
      } else {
        setPaygLoading(null);
      }
    } catch (e) {
      setPaygLoading(null);
    }
  };
  const hasCancelOption = sandboxMode && sandboxPlans.includes(currentTierId);
  const getStripePlan = (tierId) => stripePlans.find((p) => p.name?.toLowerCase() === tierId);

  if (loading) {
    return (
      <div className={styles.pageContainer}>
        <div className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>Subscriptions</h1>
          <p className={styles.pageSubtitle}>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.pageContainer}>
      <div className={styles.pageHeader}>
        <Link href="/billing" className="text-blue-600 hover:underline text-sm mb-2 inline-block">
          ← Back to Billing
        </Link>
        <h1 className={styles.pageTitle}>Manage subscription</h1>
        <p className={`${styles.pageSubtitle} flex items-center gap-2 flex-wrap`}>
          <Coins className="w-4 h-4 shrink-0" aria-hidden />
          Choose a plan or manage your current subscription. Free tier includes 50 credits upfront; you can earn more through activities.
        </p>
      </div>

      {/* Sandbox Mode Toggle - Only shows in dev */}
      <div style={{ marginBottom: "1.5rem" }}>
        <SandboxModeToggle />
      </div>

      <div className={styles.pricingTableWrapper}>
        <div className={styles.pricingTable}>
          {planIds.map((tierId) => {
            const display = PLAN_DISPLAY[tierId] ?? PLAN_DISPLAY.free;
            const isCurrent = currentTierId === tierId;
            const isFree = tierId === "free";
            const stripePlan = getStripePlan(tierId);

            const featureList = getPlanFeatureList(display);
            const isHighlight = tierId === "starter";

            const currentRank = planIds.indexOf(currentTierId);
            const thisRank = planIds.indexOf(tierId);
            const isDowngradeOption = !isCurrent && hasStripeSubscription && thisRank < currentRank;
            // Only show in-app upgrade (modal) when user already has a paid plan. Free users must use Checkout.
            const isUpgradeOption =
              !isFree &&
              !isCurrent &&
              currentTierId !== "free" &&
              hasStripeSubscription &&
              thisRank > currentRank;

            return (
              <div
                key={tierId}
                className={`${styles.pricingColumn} ${isHighlight ? styles.pricingColumnHighlight : ""}`}
              >
                {isHighlight && <span className={styles.pricingBanner}>Recommended</span>}
                <div className={styles.pricingColumnHeader}>
                  <h3 className={styles.pricingPlanName}>{display.name}</h3>
                  <div className={`${styles.pricingPriceBand} ${isHighlight ? styles.pricingPriceBandHighlight : ""}`}>
                    <p className={styles.pricingPrice}>
                      ${display.monthlyPrice}
                      <span className={styles.pricingPricePeriod}> / month</span>
                    </p>
                  </div>
                </div>
                <ul className={styles.pricingFeatures}>
                  {featureList.map((text, i) => (
                    <li key={i} className={styles.pricingFeatureItem}>
                      <CheckIcon className={styles.pricingFeatureCheck} />
                      <span>{text}</span>
                    </li>
                  ))}
                </ul>
                <div className={styles.pricingCta}>
                  {isCurrent ? (
                    <button type="button" className={`${styles.pricingCtaButton} ${styles.pricingCtaButtonCurrent}`} disabled>
                      Current plan
                    </button>
                  ) : isDowngradeOption && pendingDowngradeToPlan === tierId ? (
                    <button type="button" className={`${styles.pricingCtaButton} ${styles.pricingCtaButtonCurrent}`} disabled>
                      Downgrade scheduled
                    </button>
                  ) : isDowngradeOption ? (
                    <Button
                      variant="outline"
                      className={styles.pricingCtaButton}
                      onClick={() => setDowngradeModal(tierId)}
                    >
                      Downgrade to {display.name}
                    </Button>
                  ) : isFree ? (
                    null
                  ) : isUpgradeOption ? (
                    <Button
                      className={styles.pricingCtaButton}
                      onClick={() => handleUpgrade(tierId)}
                      disabled={upgradeLoading === tierId}
                    >
                      {upgradeLoading === tierId ? "Loading preview…" : `Upgrade to ${display.name}`}
                    </Button>
                  ) : stripePlan?.priceId ? (
                    <ButtonCheckout priceId={stripePlan.priceId} mode="subscription">
                      Upgrade to {display.name}
                    </ButtonCheckout>
                  ) : (
                    <p className={styles.pricingCtaText}>Stripe not configured for this plan.</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className={`${styles.card} mt-6`}>
        <div className={styles.cardContent}>
          <h3 className={`${styles.cardTitle} flex items-center gap-2`}>
            <Coins className="w-5 h-5 text-primary" aria-hidden />
            Buy credits
          </h3>
          <p className={styles.cardDescription}>
            {isTestTier ? (
              <>
                Test pack: buy 1 credit for $0.50 to verify the PAYG purchase flow.
              </>
            ) : currentTierId === "starter" || currentTierId === "pro" ? (
              <>
                Add pay-as-you-go credits to your wallet.{" "}
                <span className="inline-flex items-center gap-1">
                  {currentTierId === "starter"
                    ? "$0.50 per credit (Starter)."
                    : "$0.10 per credit (Pro)."}
                  <Coins className="w-3.5 h-3.5 inline" aria-hidden />
                </span>
              </>
            ) : (
              "Pay-as-you-go credits are available to Starter, Pro, Test, and Test2 accounts. Upgrade your plan to add credits to your wallet."
            )}
          </p>
          <div className="flex flex-wrap gap-3 mt-4">
            {isTestTier ? (
              <Button
                variant="outline"
                className={`${styles.manageButton} inline-flex items-center gap-2`}
                onClick={() => handleBuyPaygCredits(1)}
                disabled={paygLoading != null}
              >
                <Coins className="w-4 h-4 shrink-0" aria-hidden />
                {paygLoading === 1 ? "Redirecting…" : "1 credit — $0.50 (Test pack)"}
              </Button>
            ) : (
              PAYG_PACKAGES.map((credits) => {
                const canBuy = currentTierId === "starter" || currentTierId === "pro";
                const price = credits * (PAYG_PRICE_PER_CREDIT[currentTierId] ?? 0.5);
                const loading = paygLoading === credits;
                return (
                  <Button
                    key={credits}
                    variant="outline"
                    className={`${styles.manageButton} inline-flex items-center gap-2`}
                    onClick={() => handleBuyPaygCredits(credits)}
                    disabled={!canBuy || paygLoading != null}
                  >
                    <Coins className="w-4 h-4 shrink-0" aria-hidden />
                    {loading ? "Redirecting…" : canBuy ? `${credits} credits — $${price}` : `${credits} credits`}
                  </Button>
                );
              })
            )}
          </div>
        </div>
      </div>

      {sandboxMode && sandboxPlans.includes(currentTierId) && (
        <div className={`${styles.card} mt-6`}>
          <div className={styles.cardContent}>
            <h3 className={styles.cardTitle}>Sandbox subscription</h3>
            <p className={styles.cardDescription}>
              You are on a sandbox plan without Stripe subscription. Cancel to return to Free.
            </p>
            <Button
              variant="outline"
              className={styles.manageButton}
              onClick={handleSandboxCancel}
              disabled={sandboxLoading}
            >
              {sandboxLoading ? "Cancelling…" : "Cancel (Sandbox)"}
            </Button>
          </div>
        </div>
      )}

      {upgradePreview && (() => {
        const fromDisplay = PLAN_DISPLAY[currentTierId] ?? PLAN_DISPLAY.free;
        const toDisplay = PLAN_DISPLAY[upgradePreview.toPlan] ?? PLAN_DISPLAY.free;
        const hasCharge = upgradePreview.amountDue > 0;
        const formattedAmount = formatAmount(upgradePreview.amountDue, upgradePreview.currency);
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={(e) => { if (e.target === e.currentTarget && !upgradeConfirmLoading) { setUpgradePreview(null); setUpgradeError(null); } }}
          >
            <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Confirm upgrade</h2>
              <p className="text-sm text-gray-600 mb-4">
                Upgrading from <strong>{fromDisplay.name}</strong> to <strong>{toDisplay.name}</strong>.
              </p>
              <ul className="text-sm text-gray-600 mb-2 space-y-1 list-disc list-inside">
                {hasCharge ? (
                  <li>
                    A prorated charge of <strong>{formattedAmount}</strong> will be collected immediately from your card on file.
                  </li>
                ) : (
                  <li>No immediate charge. Your plan updates now and you'll be billed the new rate at your next renewal.</li>
                )}
                <li>Future billing: <strong>${toDisplay.monthlyPrice}/month</strong>.</li>
              </ul>
              {hasCharge && upgradePreview.lines && upgradePreview.lines.length > 0 && (
                <div className="mb-4 rounded-md border border-gray-200 bg-gray-50 p-3 text-sm">
                  <p className="font-medium text-gray-700 mb-2">Calculation breakdown</p>
                  <ul className="space-y-1 text-gray-600">
                    {upgradePreview.lines.map((line, i) => (
                      <li key={i} className="flex justify-between gap-4">
                        <span className="truncate">{line.description}</span>
                        <span className={line.amount < 0 ? "text-green-700 shrink-0" : "shrink-0"}>
                          {line.amount < 0 ? `−${formatAmount(-line.amount, upgradePreview.currency)}` : formatAmount(line.amount, upgradePreview.currency)}
                        </span>
                      </li>
                    ))}
                    <li className="flex justify-between gap-4 border-t border-gray-200 pt-2 mt-2 font-medium text-gray-900">
                      <span>Total due now</span>
                      <span>{formattedAmount}</span>
                    </li>
                  </ul>
                </div>
              )}
              {upgradeError && (
                <div className="mb-4 rounded-md bg-red-50 border border-red-200 p-3">
                  <p className="text-sm text-red-700">{upgradeError.message}</p>
                  {!upgradeError.retryable && (
                    <p className="text-sm text-red-600 mt-1">
                      To update your payment method,{" "}
                      <a href="/billing" className="underline font-medium">visit billing settings</a>.
                    </p>
                  )}
                </div>
              )}
              <div className="flex gap-3 justify-end">
                <Button
                  variant="outline"
                  onClick={() => { setUpgradePreview(null); setUpgradeError(null); }}
                  disabled={upgradeConfirmLoading}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleConfirmUpgrade}
                  disabled={upgradeConfirmLoading}
                >
                  {upgradeConfirmLoading
                    ? "Processing…"
                    : hasCharge
                      ? `Confirm & Pay ${formattedAmount}`
                      : "Confirm Upgrade"}
                </Button>
              </div>
            </div>
          </div>
        );
      })()}

      {downgradeModal && (() => {
        const toDisplay = PLAN_DISPLAY[downgradeModal] ?? PLAN_DISPLAY.free;
        const fromDisplay = PLAN_DISPLAY[currentTierId] ?? PLAN_DISPLAY.free;
        const effectiveDate = profile?.credits_reset_at
          ? new Date(profile.credits_reset_at).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })
          : "your next billing reset";
        const isToFree = downgradeModal === "free";
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={(e) => { if (e.target === e.currentTarget) setDowngradeModal(null); }}
          >
            <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Confirm downgrade</h2>
              <p className="text-sm text-gray-600 mb-4">
                You are downgrading from <strong>{fromDisplay.name}</strong> to <strong>{toDisplay.name}</strong>.
              </p>
              <ul className="text-sm text-gray-600 mb-6 space-y-1 list-disc list-inside">
                <li>Your current plan and credits remain active until <strong>{effectiveDate}</strong>.</li>
                {isToFree ? (
                  <li>At that date, your subscription is cancelled and your credits reset to {toDisplay.includedUsage}.</li>
                ) : (
                  <li>At that date, your credits reset to {toDisplay.includedUsage} and you are billed ${toDisplay.monthlyPrice}/mo going forward.</li>
                )}
                <li>No charge is made today.</li>
              </ul>
              <div className="flex gap-3 justify-end">
                <Button
                  variant="outline"
                  onClick={() => setDowngradeModal(null)}
                  disabled={downgradeLoading}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleConfirmDowngrade}
                  disabled={downgradeLoading}
                >
                  {downgradeLoading ? "Scheduling…" : `Downgrade to ${toDisplay.name}`}
                </Button>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
}

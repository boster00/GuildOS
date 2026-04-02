"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Upload, Coins } from "lucide-react";
import { createClient } from "@/libs/supabase/client";
import SandboxModeToggle from "@/components/SandboxModeToggle";
import styles from "./Billing.module.css";

// Simple Button Component
function Button({ children, className = "", variant = "default", size = "default", type = "button", disabled = false, onClick, ...props }) {
  const baseClasses = "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";
  
  const variants = {
    default: "bg-blue-600 text-white hover:bg-blue-700 focus-visible:ring-blue-600",
    outline: "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus-visible:ring-blue-600",
    ghost: "text-gray-700 hover:bg-gray-100 focus-visible:ring-blue-600"
  };
  
  const sizes = {
    default: "h-10 px-4 py-2",
    sm: "h-8 px-3 py-1 text-sm"
  };

  return (
    <button
      type={type}
      disabled={disabled}
      className={`${baseClasses} ${variants[variant]} ${sizes[size]} ${className}`}
      onClick={onClick}
      {...props}
    >
      {children}
    </button>
  );
}

// Simple Input Component
function Input({ className = "", type = "text", ...props }) {
  return (
    <input
      type={type}
      className={`${styles.input} ${className}`}
      {...props}
    />
  );
}

// Simple Label Component
function Label({ children, htmlFor, className = "" }) {
  return (
    <label htmlFor={htmlFor} className={`${styles.label} ${className}`}>
      {children}
    </label>
  );
}

// Simple Badge Component
function Badge({ children, className = "", variant = "default" }) {
  const variants = {
    default: "bg-gray-100 text-gray-800",
    secondary: "bg-blue-50 text-blue-700",
    success: "bg-green-50 text-green-700",
    warning: "bg-orange-50 text-orange-700"
  };

  return (
    <span className={`${styles.badge} ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
}

// Simple Card Components
function Card({ children, className = "" }) {
  return <div className={`${styles.card} ${className}`}>{children}</div>;
}

function CardHeader({ children }) {
  return <div className={styles.cardHeader}>{children}</div>;
}

function CardTitle({ children, className = "" }) {
  return <h3 className={`${styles.cardTitle} ${className}`}>{children}</h3>;
}

function CardDescription({ children }) {
  return <p className={styles.cardDescription}>{children}</p>;
}

function CardContent({ children }) {
  return <div className={styles.cardContent}>{children}</div>;
}

// Simple Avatar Component
function Avatar({ children, className = "" }) {
  return <div className={`${styles.avatar} ${className}`}>{children}</div>;
}

function AvatarFallback({ children, className = "" }) {
  return <div className={`${styles.avatarFallback} ${className}`}>{children}</div>;
}

const CREDITS_POLL_MS = 30000;

export default function Billing() {
  const [user, setUser] = useState({
    full_name: "",
    email: "",
    plan: "free",
    planStatus: "active",
    creditsRemaining: 0,
    monthlyRemaining: 0,
    paygWallet: 0,
    creditsUsed: 0,
    creditsQuota: 100,
    creditsResetDate: null,
    avatar: null,
    stripe_customer_id: null,
  });
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [creditsRefreshing, setCreditsRefreshing] = useState(false);
  const [sandboxMode, setSandboxMode] = useState(false);

  const fetchCredits = React.useCallback(async () => {
    try {
      const res = await fetch("/api/credits");
      if (!res.ok) return null;
      return res.json();
    } catch {
      return null;
    }
  }, []);

  const refreshCredits = React.useCallback(() => {
    setCreditsRefreshing(true);
    fetchCredits().then((data) => {
      if (data && (typeof data.remaining === "number" || data.period_used != null)) {
        setUser((prev) => ({
          ...prev,
          creditsRemaining: data.remaining ?? prev.creditsRemaining,
          monthlyRemaining: typeof data.monthly_remaining === "number" ? data.monthly_remaining : prev.monthlyRemaining,
          paygWallet: typeof data.payg_wallet === "number" ? data.payg_wallet : prev.paygWallet,
          creditsUsed: typeof data.period_used === "number" ? data.period_used : prev.creditsUsed,
          creditsResetDate: data.reset_date ?? prev.creditsResetDate,
        }));
      }
      setCreditsRefreshing(false);
    });
  }, [fetchCredits]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const supabase = createClient();
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!mounted || !authUser) {
        setLoading(false);
        return;
      }
      let plan = null;
      try {
        const [planRes, sandboxRes] = await Promise.all([
          fetch("/api/plan"),
          fetch("/api/billing/sandbox-mode"),
        ]);
        if (planRes.ok) plan = await planRes.json();
        if (sandboxRes.ok) {
          const { sandbox } = await sandboxRes.json();
          if (mounted) setSandboxMode(Boolean(sandbox));
        }
      } catch (_) {}
      if (!mounted) return;

      const creditsData = await fetchCredits();
      const remaining = creditsData?.remaining ?? 0;
      const monthlyRemaining = typeof creditsData?.monthly_remaining === "number" ? creditsData.monthly_remaining : 0;
      const paygWallet = typeof creditsData?.payg_wallet === "number" ? creditsData.payg_wallet : 0;
      const periodUsed = typeof creditsData?.period_used === "number" ? creditsData.period_used : 0;
      const resetDate = creditsData?.reset_date ?? null;

      const tierId = plan?.subscription_plan || "free";
      const quota = plan?.limits?.monthlyCreditQuota ?? 50;

      if (!mounted) return;
      setUser({
        full_name: plan?.name ?? authUser.user_metadata?.full_name ?? "",
        email: plan?.email ?? authUser.email ?? "",
        plan: tierId,
        planStatus: plan?.subscription_status ?? "active",
        creditsRemaining: remaining,
        monthlyRemaining,
        paygWallet,
        creditsUsed: periodUsed,
        creditsQuota: quota === 0 ? "Unlimited" : quota,
        creditsResetDate: resetDate,
        avatar: null,
        stripe_customer_id: plan?.stripe_customer_id ?? null,
      });
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, [fetchCredits]);

  useEffect(() => {
    if (!user?.plan) return;
    const interval = setInterval(refreshCredits, CREDITS_POLL_MS);
    return () => clearInterval(interval);
  }, [user?.plan, refreshCredits]);

  useEffect(() => {
    const onFocus = () => refreshCredits();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refreshCredits]);

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const formData = new FormData(e.target);
      const supabase = createClient();
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;
      const full_name = formData.get("name");
      await supabase.from("profiles").update({ name: full_name }).eq("id", authUser.id);
      setUser((prev) => ({ ...prev, full_name: full_name || prev.full_name }));
    } catch (error) {
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      // Simulate file upload
      const fileUrl = URL.createObjectURL(file);
      setUser({ ...user, avatar: fileUrl });
    } catch (error) {
    }
  };

  const router = useRouter();

  const handleChoosePlan = () => {
    router.push("/billing/subscriptions");
  };

  const currentPlan = user?.plan || "free";
  const initials = user?.full_name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase() || (user?.email?.[0]?.toUpperCase() ?? "U");

  if (loading) {
    return (
      <div className={styles.pageContainer}>
        <div className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>Billing & Profile</h1>
          <p className={styles.pageSubtitle}>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.pageContainer}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Billing & Profile</h1>
        <p className={styles.pageSubtitle}>
          Manage your account and subscription
        </p>
      </div>

      <div className={styles.mainGrid}>
        {/* Sandbox Mode Toggle - Only shows in dev */}
        <div style={{ gridColumn: "1 / -1" }}>
          <SandboxModeToggle />
        </div>
        {/* Profile Card */}
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>Update your personal information</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleProfileUpdate} className={styles.form}>
              <div className={styles.avatarSection}>
                <div className={styles.avatarContainer}>
                  <Avatar className={styles.avatarLarge}>
                    {user?.avatar ? (
                      <img src={user.avatar} alt="Profile" className={styles.avatarImage} />
                    ) : (
                      <AvatarFallback className={styles.avatarFallbackLarge}>
                        {initials}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <label className={styles.uploadButton}>
                    <Upload className="w-4 h-4 text-white" />
                    <input
                      type="file"
                      accept="image/*"
                      className={styles.hiddenInput}
                      onChange={handleAvatarUpload}
                    />
                  </label>
                </div>
                <div className={styles.avatarInfo}>
                  <p className={styles.avatarTitle}>Profile Picture</p>
                  <p className={styles.avatarSubtitle}>PNG, JPG up to 5MB</p>
                </div>
              </div>

              <div className={styles.fieldGroup}>
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  name="name"
                  defaultValue={user?.full_name}
                />
              </div>

              <div className={styles.fieldGroup}>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={user?.email}
                  disabled
                  className={styles.disabledInput}
                />
                <p className={styles.fieldHint}>
                  Email cannot be changed
                </p>
              </div>

              <Button
                type="submit"
                disabled={isSaving}
                className={styles.saveButton}
              >
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Current Plan Card */}
        <Card>
          <CardHeader>
            <CardTitle>Current Plan</CardTitle>
            <CardDescription>
              You're on the <strong className={styles.planName}>{currentPlan}</strong> plan
              {sandboxMode && (
                <Badge variant="secondary" style={{ marginLeft: "0.5rem" }}>Sandbox</Badge>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className={styles.currentPlanContent}>
            <div className={styles.statusCard}>
              <div>
                <p className={styles.statusLabel}>Status</p>
                <p className={styles.statusValue}>
                  {user?.planStatus || "active"}
                </p>
              </div>
              <Badge variant="success" className={styles.statusBadge}>
                {user?.planStatus || "active"}
              </Badge>
            </div>

            <div className={styles.usageCard}>
              <div>
                <p className={`${styles.usageLabel} flex items-center gap-2`}>
                  <Coins className="w-4 h-4 shrink-0" aria-hidden />
                  Credits {creditsRefreshing ? "(updating…)" : ""}
                </p>
                <p className={styles.usageSubtext}>
                  Total: {user?.creditsRemaining ?? 0} (monthly + pay-as-you-go)
                </p>
              </div>
              <div className={styles.usageValue}>
                <p className={styles.usageRow}>
                  <span className={styles.usageRowLabel}>Monthly:</span>{" "}
                  <span title="Monthly remaining">{user?.monthlyRemaining ?? 0}</span>{" "}
                  <Coins className="inline w-3.5 h-3.5 ml-0.5" aria-hidden="true" />
                  <span className="sr-only"> credits remaining</span>
                  {" · "}
                  <span title="Used this period">{Number(user?.creditsUsed ?? 0).toFixed(0)}</span>
                  <span className={styles.usageQuota}>
                    /{user?.creditsQuota === "Unlimited" ? "∞" : user?.creditsQuota ?? 100} used
                  </span>
                  {user?.creditsResetDate && (
                    <span className={styles.usageSubtext}> · Resets {new Date(user.creditsResetDate).toLocaleDateString()}</span>
                  )}
                </p>
                <p className={styles.usageRow}>
                  <span className={styles.usageRowLabel}>Pay as you go:</span>{" "}
                  <span title="Pay-as-you-go wallet">{user?.paygWallet ?? 0}</span>{" "}
                  <Coins className="inline w-3.5 h-3.5 ml-0.5" aria-hidden="true" />
                  <span className="sr-only"> credits</span>
                </p>
              </div>
            </div>

            <div className={styles.buttonRow}>
              <Button
                variant="outline"
                className={styles.manageButton}
                onClick={handleChoosePlan}
              >
                Choose Plan
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
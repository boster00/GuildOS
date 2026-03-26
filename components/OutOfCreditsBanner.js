"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { X, AlertTriangle, Coins } from "lucide-react";

const OUT_OF_CREDITS_COOKIE = "outofcredits";
const CREDITS_POLL_MS = 60000; // 1 minute when banner is visible
const COOKIE_CHECK_MS = 30000; // 30 seconds to detect cookie set elsewhere

function getOutOfCreditsCookie() {
  if (typeof document === "undefined") return false;
  const match = document.cookie.match(new RegExp(`(?:^|; )${OUT_OF_CREDITS_COOKIE}=([^;]*)`));
  return match ? match[1] === "true" : false;
}

function clearOutOfCreditsCookie() {
  if (typeof document === "undefined") return;
  document.cookie = `${OUT_OF_CREDITS_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}

/**
 * Floating banner that appears when outofcredits cookie is set.
 * Automatically dismisses when credits are restored (remaining > 0).
 * Polls /api/credits every minute when visible. Cookie checked every 30s.
 */
export default function OutOfCreditsBanner() {
  const [showBanner, setShowBanner] = useState(false);
  const [remaining, setRemaining] = useState(null);
  const [resetDate, setResetDate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  // Check cookie and fetch credits
  const checkCredits = async () => {
    try {
      const response = await fetch("/api/credits");
      if (response.ok) {
        const data = await response.json();
        setRemaining(data.remaining ?? 0);
        setResetDate(data.reset_date);

        // If credits restored, clear cookie and hide banner
        if (data.remaining > 0 && getOutOfCreditsCookie()) {
          clearOutOfCreditsCookie();
          setShowBanner(false);
        }
      }
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setMounted(true);
    
    // Initial check
    const hasCookie = getOutOfCreditsCookie();
    setShowBanner(hasCookie);
    
    if (hasCookie) {
      checkCredits();
    } else {
      setLoading(false);
    }
  }, []);

  // React instantly when client or server triggers out-of-credits (cookie set elsewhere or triggerOutOfCreditsBanner())
  useEffect(() => {
    if (!mounted || typeof window === "undefined") return;
    const onOutOfCredits = () => {
      setShowBanner(true);
      checkCredits();
    };
    window.addEventListener("out-of-credits", onOutOfCredits);
    return () => window.removeEventListener("out-of-credits", onOutOfCredits);
  }, [mounted]);

  // Poll credits when banner is visible; only fetch if creditUpdated was set (e.g. after a spend)
  useEffect(() => {
    if (!showBanner || !mounted) return;

    checkCredits();
    const interval = setInterval(async () => {
      try {
        const r = await fetch("/api/credits/updated");
        if (r.ok) {
          const data = await r.json();
          if (data.updated) checkCredits();
        }
      } catch {
        // ignore
      }
    }, CREDITS_POLL_MS);

    return () => clearInterval(interval);
  }, [showBanner, mounted]);

  // Re-check cookie periodically (in case it's set externally)
  useEffect(() => {
    if (!mounted) return;

    const checkCookie = () => {
      const hasCookie = getOutOfCreditsCookie();
      if (hasCookie && !showBanner) {
        setShowBanner(true);
        checkCredits();
      }
    };

    const interval = setInterval(checkCookie, COOKIE_CHECK_MS);
    return () => clearInterval(interval);
  }, [mounted, showBanner]);

  const handleDismiss = () => {
    clearOutOfCreditsCookie();
    setShowBanner(false);
  };

  const formatResetDate = (dateString) => {
    if (!dateString) return null;
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return null;
    }
  };

  if (!mounted || !showBanner) return null;

  return (
    <div className="sticky top-0 left-0 right-0 z-40 bg-yellow-500 text-yellow-900 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <Coins className="w-5 h-5 flex-shrink-0 opacity-90" aria-hidden />
            <div className="flex-1">
              <p className="font-medium">
                {remaining !== null && remaining > 0
                  ? `Credits restored! You have ${remaining} credits remaining.`
                  : "You're out of credits. Top up to continue using features."}
              </p>
              {resetDate && (
                <p className="text-sm opacity-90 mt-0.5">
                  Credits reset on {formatResetDate(resetDate)}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {remaining === null || remaining === 0 ? (
              <Link
                href="/billing"
                className="px-4 py-1.5 bg-yellow-600 hover:bg-yellow-700 text-white font-medium rounded transition-colors whitespace-nowrap"
              >
                Top up
              </Link>
            ) : null}
            <button
              onClick={handleDismiss}
              className="p-1 hover:bg-yellow-600/20 rounded transition-colors"
              aria-label="Dismiss banner"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

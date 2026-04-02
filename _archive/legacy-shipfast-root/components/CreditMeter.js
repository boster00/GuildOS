"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { Coins } from "lucide-react";

const FOCUS_REFETCH_MIN_MS = 60000; // Refetch on focus at most once per minute

function fetchCredits() {
  return fetch("/api/credits").then((r) => (r.ok ? r.json() : null));
}

export default function CreditMeter() {
  const [credits, setCredits] = useState(null);
  const [loading, setLoading] = useState(true);
  const lastLoadRef = useRef(0);

  const load = useCallback(async () => {
    try {
      const data = await fetchCredits();
      if (data && typeof data.remaining === "number") {
        setCredits(data);
        lastLoadRef.current = Date.now();
      }
    } catch (e) {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onFocus = async () => {
      if (Date.now() - lastLoadRef.current < FOCUS_REFETCH_MIN_MS) return;
      try {
        const r = await fetch("/api/credits/updated");
        if (r.ok) {
          const data = await r.json();
          if (data.updated) load();
        }
      } catch {
        // ignore
      }
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  if (loading || credits == null) return null;

  // remaining is combined (monthly_remaining + payg_wallet) from API
  const remaining = credits.remaining ?? 0;
  const monthly = credits.monthly_remaining ?? 0;
  const payg = credits.payg_wallet ?? 0;
  let badgeClass = "badge-success";
  if (remaining <= 0) badgeClass = "badge-error";
  else if (remaining <= 10) badgeClass = "badge-warning";

  const display =
    remaining === 1 ? "1 credit" : `${remaining} credits`;
  const parts = [];
  if (credits.reset_date) {
    parts.push(`Monthly resets ${new Date(credits.reset_date).toLocaleDateString()}`);
  }
  if (monthly + payg > 0 && (monthly > 0 || payg > 0)) {
    parts.push(`${monthly} monthly + ${payg} wallet`);
  }
  const title = parts.length ? parts.join(". ") : "Credit balance (monthly + pay-as-you-go)";

  return (
    <Link
      href="/billing"
      className={`badge badge-sm gap-1 ${badgeClass} hover:opacity-90 inline-flex items-center`}
      title={title}
    >
      <Coins className="w-3.5 h-3.5" aria-hidden />
      <span>{display}</span>
    </Link>
  );
}

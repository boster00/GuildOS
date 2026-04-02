"use client";

import React, { useState, useEffect } from "react";

const METERING_COOKIE = "metering_enabled";

function getMeteringFromCookie() {
  if (typeof document === "undefined") return true;
  const match = document.cookie.match(new RegExp(`(?:^|; )${METERING_COOKIE}=([^;]*)`));
  const val = match ? match[1] : null;
  return val === "false" ? false : true;
}

function setMeteringCookie(enabled) {
  if (typeof document === "undefined") return;
  document.cookie = `${METERING_COOKIE}=${enabled}; path=/; max-age=31536000; SameSite=Lax`;
}

/**
 * Toggle next to the credits bar. Temporary: stores preference in cookie only (not DB).
 * Value is read in a single place in metering (shouldApplyMetering via adapter.getMeteringOverride).
 * Hidden in production so only dev/staging can turn metering off for testing.
 */
export default function MeteringToggle() {
  const [meteringEnabled, setMeteringEnabled] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMeteringEnabled(getMeteringFromCookie());
    setMounted(true);
  }, []);

  const handleChange = () => {
    const next = !meteringEnabled;
    setMeteringEnabled(next);
    setMeteringCookie(next);
  };

  // Do not show metering toggle in production
  if (process.env.NODE_ENV === "production") return null;
  if (!mounted) return null;

  return (
    <label className="flex items-center gap-2 cursor-pointer" title="Credit metering: when off, usage is not counted or deducted">
      <span className="text-sm text-base-content/70 whitespace-nowrap">Metering</span>
      <input
        type="checkbox"
        className="toggle toggle-sm toggle-primary"
        checked={meteringEnabled}
        onChange={handleChange}
      />
    </label>
  );
}

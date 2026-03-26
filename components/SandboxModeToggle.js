"use client";

import { useState, useEffect } from "react";

/**
 * Sandbox Mode Toggle Component
 * Only shows in development environment
 * Allows toggling between regular Stripe keys and sandbox test keys
 */
export default function SandboxModeToggle() {
  const [sandboxMode, setSandboxMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isDev, setIsDev] = useState(false);

  useEffect(() => {
    // Only show in development (NODE_ENV only; no localhost escape so production build never shows toggle)
    setIsDev(process.env.NODE_ENV !== "production");
    
    // Fetch current sandbox mode state
    const fetchSandboxMode = async () => {
      try {
        const res = await fetch("/api/billing/sandbox-mode");
        if (res.ok) {
          const { sandbox } = await res.json();
          setSandboxMode(Boolean(sandbox));
        }
      } catch (error) {
      } finally {
        setLoading(false);
      }
    };

    fetchSandboxMode();
  }, []);

  const handleToggle = async () => {
    const newValue = !sandboxMode;
    setLoading(true);
    
    try {
      const res = await fetch("/api/billing/sandbox-mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: newValue }),
      });
      
      if (res.ok) {
        const { sandbox } = await res.json();
        setSandboxMode(Boolean(sandbox));
        // Reload page to apply changes
        window.location.reload();
      } else {
        const error = await res.json();
        alert(`Failed to toggle sandbox mode: ${error.error || "Unknown error"}`);
      }
    } catch (error) {
      alert("Failed to toggle sandbox mode. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Don't render in production
  if (!isDev) {
    return null;
  }

  return (
    <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-md">
      <div className="flex items-center gap-2 flex-1">
        <span className="text-sm font-medium text-amber-900">Sandbox Mode</span>
        <span className="text-xs text-amber-700">
          (Uses test Stripe keys and prices)
        </span>
      </div>
      <label className="relative inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          checked={sandboxMode}
          onChange={handleToggle}
          disabled={loading}
          className="sr-only peer"
        />
        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-amber-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
        <span className="ml-3 text-sm font-medium text-amber-900">
          {sandboxMode ? "ON" : "OFF"}
        </span>
      </label>
    </div>
  );
}

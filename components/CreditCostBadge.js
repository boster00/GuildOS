"use client";

import React from "react";
import { Coins } from "lucide-react";
import { getCost, getCostByPath } from "@/libs/monkey/tools/metering_costs";

/**
 * Small badge showing the credit cost for an action.
 *
 * Props:
 * - path (string, optional): API path; looks up cost via getCostByPath(path). Preferred.
 * - action (string, optional): legacy action name; looks up cost via getCost(action).
 * - cost (number, optional): explicit cost; used when already known (e.g. test-metering).
 * - size ("sm" | "md"): controls text size. Default "sm".
 * - className (string): extra classes for outer container (e.g. margin tweaks).
 *
 * Precedence: cost > path > action.
 */
export default function CreditCostBadge({
  path,
  action,
  cost,
  size = "sm",
  className = "",
}) {
  const resolvedCost =
    typeof cost === "number"
      ? cost
      : typeof path === "string"
      ? getCostByPath(path)
      : typeof action === "string"
      ? getCost(action)
      : 0;

  const sizeClass = size === "md" ? "text-xs" : "text-[10px]";
  const containerClass = [
    "inline-flex items-center gap-1",
    sizeClass,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const title = `Cost: ${resolvedCost} credit${
    resolvedCost === 1 ? "" : "s"
  }`;

  return (
    <span className={containerClass} title={title}>
      <span>{resolvedCost}</span>
      <Coins className="w-4 h-4 text-amber-700 shrink-0" aria-hidden />
    </span>
  );
}


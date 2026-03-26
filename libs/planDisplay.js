/**
 * Single source of truth for plan copy and claims.
 * Used by /pricing and /billing/subscriptions so both show the same messaging.
 */

/** Display copy for plans. Extra usage = Pay As You Go spelled out. */
const PLAN_DISPLAY = {
  free: {
    name: "Free",
    monthlyPrice: 0,
    includedUsage: "50 credits",
    extraUsage: "Not available",
    projects: "1",
    concurrentJobs: "1",
    automatedRuns: "Manual only",
    dataHistory: "Standard",
    bestFor: "Trying the platform",
  },
  test: {
    name: "Test",
    monthlyPrice: 1,
    includedUsage: "500 credits",
    extraUsage: "$0.50 per credit",
    projects: "1",
    concurrentJobs: "1",
    automatedRuns: "Automatic keyword ranking scans and AI visibility scans, monthly",
    dataHistory: "Standard",
    bestFor: "Internal testing only",
  },
  test2: {
    name: "Test2",
    monthlyPrice: 2,
    includedUsage: "1000 credits",
    extraUsage: "$0.50 per credit",
    projects: "1",
    concurrentJobs: "1",
    automatedRuns: "Monthly (10-min reset cycle — test only)",
    dataHistory: "Standard",
    bestFor: "Production billing flow testing",
  },
  starter: {
    name: "Starter",
    monthlyPrice: 99,
    includedUsage: "500 credits",
    extraUsage: "$0.50 per credit",
    projects: "1",
    concurrentJobs: "1",
    automatedRuns: "Automatic keyword ranking scans and AI visibility scans, monthly",
    dataHistory: "Standard",
    bestFor: "Solo operators / small teams",
  },
  pro: {
    name: "Pro",
    monthlyPrice: 399,
    includedUsage: "4000 credits",
    extraUsage: "$0.10 per credit",
    projects: "Higher limits",
    concurrentJobs: "3",
    automatedRuns: "Automatic keyword ranking scans and AI visibility scans, daily or weekly",
    dataHistory: "Extended",
    bestFor: "Agencies / high-volume users",
  },
};

function getDisplay(tierId) {
  return PLAN_DISPLAY[tierId] ?? PLAN_DISPLAY.free;
}

/** Build feature list for checkmark display (one line per item). */
function getPlanFeatureList(display) {
  return [
    display.includedUsage + " included",
    "Pay As You Go: " + display.extraUsage,
    display.projects + " project(s)",
    display.concurrentJobs + " job(s) at once",
    display.automatedRuns,
    display.dataHistory + " data history",
    display.bestFor,
  ];
}

module.exports = {
  PLAN_DISPLAY,
  getDisplay,
  getPlanFeatureList,
};

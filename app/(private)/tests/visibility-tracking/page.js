import { notFound } from "next/navigation";
import TestVisibilityTrackingClient from "./TestVisibilityTrackingClient";

/**
 * Test Visibility Tracking page: step-by-step validation of VT features.
 * In production, page is reachable only when ALLOW_TEST_PRODUCTION is set.
 * Sidebar entry is devOnly so hidden in production by default.
 */
export default async function TestVisibilityTrackingPage() {
  const isProduction = process.env.NODE_ENV === "production";
  const allowTestProduction =
    process.env.ALLOW_TEST_PRODUCTION === "true" ||
    process.env.ALLOW_TEST_PRODUCTION === "1";

  if (isProduction && !allowTestProduction) {
    notFound();
  }

  return <TestVisibilityTrackingClient />;
}

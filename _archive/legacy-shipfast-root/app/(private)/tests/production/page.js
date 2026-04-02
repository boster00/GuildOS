import { notFound } from "next/navigation";
import TestProductionClient from "./TestProductionClient";

/**
 * Test Production page: production-hardening test matrix runner.
 * In production, page is reachable only when ALLOW_TEST_PRODUCTION is set (for operators).
 * Sidebar entry is devOnly so hidden in production by default.
 */
export default async function TestProductionPage() {
  const isProduction = process.env.NODE_ENV === "production";
  const allowTestProduction =
    process.env.ALLOW_TEST_PRODUCTION === "true" || process.env.ALLOW_TEST_PRODUCTION === "1";

  if (isProduction && !allowTestProduction) {
    notFound();
  }

  return <TestProductionClient />;
}

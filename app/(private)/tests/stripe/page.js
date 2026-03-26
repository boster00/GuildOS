import { notFound } from "next/navigation";
import TestStripeClient from "./TestStripeClient";

/**
 * Test Stripe page: dev-only. In production returns 404 unless ALLOW_TEST_STRIPE_PAGE is set.
 */
export default async function TestStripePage() {
  const isProduction = process.env.NODE_ENV === "production";
  const allowTestStripe =
    process.env.ALLOW_TEST_STRIPE_PAGE === "true" || process.env.ALLOW_TEST_STRIPE_PAGE === "1";

  if (isProduction && !allowTestStripe) {
    notFound();
  }

  return <TestStripeClient />;
}

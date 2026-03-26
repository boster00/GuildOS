// ARCHIVED: Original path was tests/production-hardening.test.js

import { describe, it, expect, vi, afterEach, beforeAll } from "vitest";
import { getDevRouteBlockResponse } from "@/libs/testStripeGuard";

/**
 * Production hardening tests: ensure dev-only routes are blocked in production
 * and sandbox price IDs are rejected in production.
 * See /tests/production page and plan for full matrix.
 */

vi.mock("@/libs/monkey/registry/subscriptionTiers.js", () => ({
  default: {
    isSandboxPriceId: (id) => id === "price_sandbox_test",
  },
}));

describe("production-hardening", () => {
  let assertNoSandboxPricesInProd;

  beforeAll(async () => {
    const stripe = await import("@/libs/stripe");
    assertNoSandboxPricesInProd = stripe.assertNoSandboxPricesInProd;
  });
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  describe("getDevRouteBlockResponse (sandbox-subscribe / test-stripe blocked in prod)", () => {
    it("returns 404 response when NODE_ENV is production", () => {
      process.env.NODE_ENV = "production";
      const response = getDevRouteBlockResponse();
      expect(response).not.toBeNull();
      expect(response.status).toBe(404);
    });

    it("returns null when NODE_ENV is not production", () => {
      process.env.NODE_ENV = "development";
      const response = getDevRouteBlockResponse();
      expect(response).toBeNull();
    });
  });

  describe("assertNoSandboxPricesInProd", () => {
    const sandboxPriceId = "price_sandbox_test";

    it("returns 400 response when NODE_ENV is production and priceId is sandbox", async () => {
      process.env.NODE_ENV = "production";
      const response = assertNoSandboxPricesInProd(sandboxPriceId);
      expect(response).not.toBeNull();
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toContain("Sandbox");
    });

    it("returns null when NODE_ENV is not production", () => {
      process.env.NODE_ENV = "development";
      const response = assertNoSandboxPricesInProd(sandboxPriceId);
      expect(response).toBeNull();
    });

    it("returns null when NODE_ENV is production but priceId is not sandbox", () => {
      process.env.NODE_ENV = "production";
      const response = assertNoSandboxPricesInProd("price_live_xxx");
      expect(response).toBeNull();
    });
  });
});

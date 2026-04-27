import { describe, it, expect, vi } from "vitest";

// Mock the DB-touching deps so the import resolves without a live Supabase
// client. We're testing the pure validators here, not the gate flow.
vi.mock("@/libs/council/database", () => ({
  database: { init: vi.fn() },
}));

vi.mock("@/libs/council/publicTables", () => ({
  publicTables: { quests: "quests", items: "items", itemComments: "item_comments", questComments: "quest_comments" },
}));

vi.mock("@/libs/weapon/questExecution", () => ({
  SUBMIT_LOCKPHRASE: "this quest now meets the criteria for purrview",
}));

vi.mock("@/libs/quest/items.js", () => ({
  writeReview: vi.fn().mockResolvedValue({ ok: true }),
}));

import { isValidJudgeOrigin, APPROVE_LOCKPHRASE, BOUNCE_LOCKPHRASE } from "./index.js";

describe("isValidJudgeOrigin — Cat per-item judge mandate", () => {
  it("accepts the canonical openai_images.judge tag", () => {
    expect(isValidJudgeOrigin("openai_images.judge")).toBe(true);
    expect(isValidJudgeOrigin("openai_images.judge:gpt-4o")).toBe(true);
  });

  it("accepts openai_images.judge:<any-model> for forward-compat", () => {
    expect(isValidJudgeOrigin("openai_images.judge:gpt-4o-2024-11-20")).toBe(true);
    expect(isValidJudgeOrigin("openai_images.judge:o4-mini")).toBe(true);
  });

  it("accepts the local-Claude direct multimodal Read origin (T3.5)", () => {
    expect(isValidJudgeOrigin("claude-multimodal-read")).toBe(true);
  });

  it("rejects empty / whitespace / non-string", () => {
    expect(isValidJudgeOrigin("")).toBe(false);
    expect(isValidJudgeOrigin("   ")).toBe(false);
    expect(isValidJudgeOrigin(null)).toBe(false);
    expect(isValidJudgeOrigin(undefined)).toBe(false);
    expect(isValidJudgeOrigin(42)).toBe(false);
  });

  it("rejects unrecognized origins (no laundering through made-up labels)", () => {
    expect(isValidJudgeOrigin("cat")).toBe(false);
    expect(isValidJudgeOrigin("composer")).toBe(false);
    expect(isValidJudgeOrigin("manual-review")).toBe(false);
    expect(isValidJudgeOrigin("eyeball")).toBe(false);
    // Even a near-miss prefix should fail unless it's the openai_images.judge family.
    expect(isValidJudgeOrigin("openai-judge")).toBe(false);
  });
});

describe("Lockphrase exports — must stay verbatim", () => {
  it("exports the approve lockphrase verbatim", () => {
    expect(APPROVE_LOCKPHRASE).toBe("this quest now meets the criteria for review");
  });

  it("exports the bounce lockphrase verbatim", () => {
    expect(BOUNCE_LOCKPHRASE).toBe("this quest has been bounced back to execute");
  });
});

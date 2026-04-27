import { describe, it, expect, vi, beforeEach } from "vitest";

const { initMock, fromMock, updateMock, eqMock } = vi.hoisted(() => ({
  initMock: vi.fn(),
  fromMock: vi.fn(),
  updateMock: vi.fn(),
  eqMock: vi.fn(),
}));

vi.mock("@/libs/council/database", () => ({
  database: { init: initMock },
}));

vi.mock("@/libs/council/publicTables", () => ({
  publicTables: { items: "items", quests: "quests" },
}));

import { writeReview, TIER_COLUMNS } from "./items.js";

describe("writeReview — tier ownership chokepoint", () => {
  beforeEach(() => {
    eqMock.mockReset().mockResolvedValue({ error: null });
    updateMock.mockReset().mockReturnValue({ eq: eqMock });
    fromMock.mockReset().mockReturnValue({ update: updateMock });
    initMock.mockReset().mockResolvedValue({ from: fromMock });
  });

  it("rejects an unknown tier name (typo guard)", async () => {
    const r = await writeReview({ tier: "Cat", itemId: "abc", value: "ok" });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("invalid_tier");
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("rejects empty itemId", async () => {
    const r = await writeReview({ tier: "worker", itemId: "", value: "ok" });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("invalid_itemId");
  });

  it("rejects non-string, non-null value", async () => {
    const r = await writeReview({ tier: "worker", itemId: "abc", value: 42 });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("invalid_value");
  });

  it.each([
    ["worker", "self_check"],
    ["openai", "openai_check"],
    ["cat", "purrview_check"],
    ["guildmaster", "claude_check"],
    ["user", "user_feedback"],
  ])("writes only the %s tier's column (%s)", async (tier, expectedColumn) => {
    const r = await writeReview({ tier, itemId: "item-1", value: "[PASS] looks good" });
    expect(r.ok).toBe(true);
    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(updateMock).toHaveBeenCalledWith({ [expectedColumn]: "[PASS] looks good" });
    expect(eqMock).toHaveBeenCalledWith("id", "item-1");
  });

  it("allows null to clear a tier's verdict", async () => {
    const r = await writeReview({ tier: "openai", itemId: "abc", value: null });
    expect(r.ok).toBe(true);
    expect(updateMock).toHaveBeenCalledWith({ openai_check: null });
  });

  it("propagates DB errors as ok:false", async () => {
    eqMock.mockResolvedValueOnce({ error: { message: "permission denied" } });
    const r = await writeReview({ tier: "openai", itemId: "abc", value: "ok" });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("db_error");
    expect(r.msg).toBe("permission denied");
  });
});

describe("TIER_COLUMNS — locked tier→column map", () => {
  it("maps exactly the 5 tiers to their owned columns and is frozen", () => {
    expect(TIER_COLUMNS).toEqual({
      worker: "self_check",
      openai: "openai_check",
      cat: "purrview_check",
      guildmaster: "claude_check",
      user: "user_feedback",
    });
    expect(Object.isFrozen(TIER_COLUMNS)).toBe(true);
  });
});

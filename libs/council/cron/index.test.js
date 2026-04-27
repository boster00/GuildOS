import { describe, it, expect, vi, beforeEach } from "vitest";

const { writeFollowupMock } = vi.hoisted(() => ({
  writeFollowupMock: vi.fn(),
}));

vi.mock("@/libs/weapon/cursor/index.js", () => ({
  readAgent: vi.fn(),
  writeFollowup: writeFollowupMock,
  readConversation: vi.fn().mockResolvedValue({ messages: [] }),
}));

vi.mock("@/libs/council/publicTables", () => ({
  publicTables: {
    quests: "quests",
    questComments: "quest_comments",
    adventurers: "adventurers",
  },
}));

vi.mock("@/libs/council/database", () => ({
  database: { init: vi.fn() },
}));

import { bounceReviewOnUserFeedback } from "./index.js";

/**
 * Minimal supabase-js shape for the bounce path. The function needs:
 *   - db.from(quests).select(...).eq("stage","review")  → list quests
 *   - db.from(quest_comments).select(...).eq("quest_id",X).order(...).limit(50)
 *   - db.from(quest_comments).insert(row)
 *   - db.from(quests).update({stage}).eq("id",X)
 *   - db.from(adventurers).select(...).eq("id",X).maybeSingle()
 */
function buildMockDb({ reviewQuests, commentsByQuestId, adventurersById }) {
  const calls = { inserted: [], updated: [] };

  const builder = (table) => {
    const ctx = { table, filters: {} };
    const obj = {
      select: () => obj,
      order: () => obj,
      limit: () => obj,
      eq(col, val) {
        ctx.filters[col] = val;
        return obj;
      },
      in() { return obj; },
      not() { return obj; },
      maybeSingle() {
        if (table === "adventurers") {
          return Promise.resolve({ data: adventurersById[ctx.filters.id] || null });
        }
        return Promise.resolve({ data: null });
      },
      single: () => Promise.resolve({ data: null }),
      insert(row) {
        calls.inserted.push({ table, row });
        return Promise.resolve({ error: null });
      },
      update(row) {
        return {
          eq(col, val) {
            calls.updated.push({ table, row, where: { [col]: val } });
            return Promise.resolve({ error: null });
          },
        };
      },
      then(resolve) {
        if (table === "quests" && ctx.filters.stage === "review") {
          return resolve({ data: reviewQuests });
        }
        if (table === "quest_comments" && ctx.filters.quest_id) {
          return resolve({ data: commentsByQuestId[ctx.filters.quest_id] || [] });
        }
        return resolve({ data: [] });
      },
    };
    return obj;
  };

  return { db: { from: builder }, calls };
}

describe("bounceReviewOnUserFeedback", () => {
  beforeEach(() => {
    writeFollowupMock.mockReset().mockResolvedValue({ ok: true });
  });

  it("does NOT bounce when the latest review marker is newer than the user feedback", async () => {
    const { db, calls } = buildMockDb({
      reviewQuests: [{ id: "q1", title: "old feedback already addressed", assignee_id: "a1" }],
      commentsByQuestId: {
        q1: [
          // most-recent first (function does .order(desc))
          { id: "c2", source: "system", action: "final_gate_pass", summary: "ok", created_at: "2026-04-27T12:00:00Z" },
          { id: "c1", source: "user",   action: "feedback",         summary: "fix this", created_at: "2026-04-27T10:00:00Z" },
        ],
      },
      adventurersById: { a1: { session_id: "bc-1", name: "Worker" } },
    });

    await bounceReviewOnUserFeedback(db);
    expect(calls.updated.find((u) => u.table === "quests")).toBeUndefined();
    expect(calls.inserted.find((i) => i.table === "quest_comments" && i.row.action === "review_bounce_user_feedback")).toBeUndefined();
    expect(writeFollowupMock).not.toHaveBeenCalled();
  });

  it("bounces, audits, and notifies when user feedback is newer than the last review marker", async () => {
    const { db, calls } = buildMockDb({
      reviewQuests: [{ id: "q2", title: "fresh feedback", assignee_id: "a2" }],
      commentsByQuestId: {
        q2: [
          { id: "c1", source: "user",   action: "feedback",         summary: "this layout is wrong", created_at: "2026-04-27T15:00:00Z" },
          { id: "c0", source: "system", action: "final_gate_pass",  summary: "ok",                  created_at: "2026-04-27T12:00:00Z" },
        ],
      },
      adventurersById: { a2: { session_id: "bc-2", name: "Worker" } },
    });

    await bounceReviewOnUserFeedback(db);

    const audit = calls.inserted.find((i) => i.table === "quest_comments" && i.row.action === "review_bounce_user_feedback");
    expect(audit).toBeTruthy();
    expect(audit.row.detail.user_feedback_text).toBe("this layout is wrong");
    expect(audit.row.detail.user_feedback_id).toBe("c1");

    const stageFlip = calls.updated.find((u) => u.table === "quests" && u.row.stage === "execute");
    expect(stageFlip).toBeTruthy();
    expect(stageFlip.where.id).toBe("q2");

    expect(writeFollowupMock).toHaveBeenCalledTimes(1);
    const msg = writeFollowupMock.mock.calls[0][0].message;
    expect(msg).toContain("[USER FEEDBACK]");
    expect(msg).toContain("this layout is wrong");
    expect(msg).toContain('"fresh feedback"');
  });

  it("skips quests that have no user-feedback comment at all", async () => {
    const { db, calls } = buildMockDb({
      reviewQuests: [{ id: "q3", title: "no user feedback yet", assignee_id: "a3" }],
      commentsByQuestId: {
        q3: [{ id: "c1", source: "system", action: "approve", summary: "ok", created_at: "2026-04-27T10:00:00Z" }],
      },
      adventurersById: { a3: { session_id: "bc-3", name: "Worker" } },
    });

    await bounceReviewOnUserFeedback(db);
    expect(calls.updated).toHaveLength(0);
    expect(calls.inserted).toHaveLength(0);
    expect(writeFollowupMock).not.toHaveBeenCalled();
  });

  it("bounces when there's no review marker at all (defensive)", async () => {
    const { db, calls } = buildMockDb({
      reviewQuests: [{ id: "q4", title: "review with feedback, no marker", assignee_id: "a4" }],
      commentsByQuestId: {
        q4: [{ id: "c1", source: "user", action: "feedback", summary: "wrong", created_at: "2026-04-27T10:00:00Z" }],
      },
      adventurersById: { a4: { session_id: "bc-4", name: "Worker" } },
    });

    await bounceReviewOnUserFeedback(db);
    expect(calls.updated.find((u) => u.table === "quests" && u.row.stage === "execute")).toBeTruthy();
    expect(writeFollowupMock).toHaveBeenCalledTimes(1);
  });

  it("bounces silently (no followup) when the assignee has no session_id", async () => {
    const { db, calls } = buildMockDb({
      reviewQuests: [{ id: "q5", title: "orphan assignee", assignee_id: "a5" }],
      commentsByQuestId: {
        q5: [
          { id: "c1", source: "user", action: "feedback", summary: "needs work", created_at: "2026-04-27T15:00:00Z" },
          { id: "c0", source: "system", action: "approve", summary: "ok",        created_at: "2026-04-27T10:00:00Z" },
        ],
      },
      adventurersById: { a5: { session_id: null, name: "ZombieAgent" } },
    });

    await bounceReviewOnUserFeedback(db);
    expect(calls.updated.find((u) => u.table === "quests" && u.row.stage === "execute")).toBeTruthy();
    expect(writeFollowupMock).not.toHaveBeenCalled();
  });
});

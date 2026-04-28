import { describe, it, expect, vi, beforeEach } from "vitest";

const { writeFollowupMock, syncSessionStatusMock, respawnAdventurerMock } = vi.hoisted(() => ({
  writeFollowupMock: vi.fn(),
  syncSessionStatusMock: vi.fn(),
  respawnAdventurerMock: vi.fn(),
}));

vi.mock("@/libs/weapon/cursor/index.js", () => ({
  readAgent: vi.fn(),
  writeFollowup: writeFollowupMock,
  readConversation: vi.fn().mockResolvedValue({ messages: [] }),
  syncSessionStatus: syncSessionStatusMock,
}));

vi.mock("@/libs/skill_book/guildmaster/index.js", () => ({
  respawnAdventurer: respawnAdventurerMock,
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

import { bounceReviewOnUserFeedback, reconcileSessionLifecycle } from "./index.js";

beforeEach(() => {
  // Default: every adventurer is dispatch_safe (RUNNING). Tests override per case.
  syncSessionStatusMock.mockReset();
  syncSessionStatusMock.mockResolvedValue({
    upstream_status: "RUNNING",
    alive: true,
    dispatch_safe: true,
    was_drift: false,
    adventurer: { session_status: "idle" },
  });
});

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

// ---------------------------------------------------------------------------
// reconcileSessionLifecycle — surfaces dead cursor sessions before the nudge
// loop tries to followup against them, and warns when a non-dispatchable
// adventurer still has assigned active quests.
// ---------------------------------------------------------------------------

function buildLifecycleMockDb({ adventurers, questsByAssigneeId, backstoryById = {}, unassignedPurrviewCount = 0 }) {
  const builder = (table) => {
    const ctx = { table, filters: {}, in: {}, isNullCols: new Set() };
    const obj = {
      select: () => obj,
      eq(col, val) { ctx.filters[col] = val; return obj; },
      in(col, vals) { ctx.in[col] = vals; return obj; },
      is(col, val) { if (val === null) ctx.isNullCols.add(col); return obj; },
      not() { return obj; },
      order: () => obj,
      limit: () => obj,
      single() {
        // adventurers.single() — used by getLastAutoRespawnAt to read backstory
        if (table === "adventurers" && ctx.filters.id) {
          return Promise.resolve({ data: { backstory: backstoryById[ctx.filters.id] || "" } });
        }
        return Promise.resolve({ data: null });
      },
      then(resolve) {
        if (table === "adventurers") return resolve({ data: adventurers });
        if (table === "quests") {
          let data = [];
          if (ctx.filters.assignee_id) {
            data = questsByAssigneeId[ctx.filters.assignee_id] || [];
            if (ctx.in.stage) data = data.filter((q) => ctx.in.stage.includes(q.stage));
          } else if (ctx.filters.stage === "purrview" && ctx.isNullCols.has("assignee_id")) {
            // unassigned-purrview probe path used by reconcileSessionLifecycle
            // when adv.name === 'Cat'.
            data = Array.from({ length: unassignedPurrviewCount }, (_, i) => ({ id: `up-${i}` }));
          }
          return resolve({ data });
        }
        return resolve({ data: [] });
      },
    };
    return obj;
  };
  return { db: { from: builder } };
}

describe("reconcileSessionLifecycle", () => {
  it("warns about dead sessions with active quests", async () => {
    syncSessionStatusMock.mockReset();
    syncSessionStatusMock.mockImplementation(({ adventurerId }) => {
      if (adventurerId === "alive-1") {
        return Promise.resolve({
          upstream_status: "RUNNING",
          alive: true,
          dispatch_safe: true,
          was_drift: false,
          adventurer: { session_status: "idle" },
        });
      }
      return Promise.resolve({
        upstream_status: "EXPIRED",
        alive: true,
        dispatch_safe: false,
        was_drift: true,
        adventurer: { session_status: "expired" },
      });
    });

    const { db } = buildLifecycleMockDb({
      adventurers: [
        { id: "alive-1", name: "Alive", session_id: "bc-a", session_status: "idle" },
        { id: "dead-1", name: "Zombie", session_id: "bc-z", session_status: "idle" },
      ],
      questsByAssigneeId: {
        "dead-1": [{ id: "q1", title: "stranded quest", stage: "execute" }],
      },
    });

    const r = await reconcileSessionLifecycle(db);
    expect(r.reconciled).toBe(1);
    expect(r.needsRespawn).toHaveLength(1);
    expect(r.needsRespawn[0].adventurer).toBe("Zombie");
    expect(r.needsRespawn[0].upstream_status).toBe("EXPIRED");
    expect(r.needsRespawn[0].quest_count).toBe(1);
  });

  it("does NOT flag dead sessions when their only active quests are post-agent (review/closing)", async () => {
    syncSessionStatusMock.mockReset();
    syncSessionStatusMock.mockResolvedValue({
      upstream_status: "EXPIRED",
      alive: true,
      dispatch_safe: false,
      was_drift: true,
      adventurer: { session_status: "expired" },
    });

    const { db } = buildLifecycleMockDb({
      adventurers: [{ id: "post-agent-1", name: "DoneZombie", session_id: "bc-d", session_status: "idle" }],
      // 5 quests all in review (Guildmaster's job, not the agent's). Should NOT trigger respawn.
      questsByAssigneeId: {
        "post-agent-1": [
          { id: "q1", title: "Slice 1 (review)", stage: "review" },
          { id: "q2", title: "Slice 2 (review)", stage: "review" },
        ],
      },
    });

    const r = await reconcileSessionLifecycle(db);
    expect(r.reconciled).toBe(1);
    expect(r.needsRespawn).toHaveLength(0);
  });

  it("does NOT flag dead sessions when they have no active quests", async () => {
    syncSessionStatusMock.mockReset();
    syncSessionStatusMock.mockResolvedValue({
      upstream_status: "EXPIRED",
      alive: true,
      dispatch_safe: false,
      was_drift: true,
      adventurer: { session_status: "expired" },
    });

    const { db } = buildLifecycleMockDb({
      adventurers: [{ id: "dead-2", name: "QuietZombie", session_id: "bc-q", session_status: "idle" }],
      questsByAssigneeId: {}, // no quests
    });

    const r = await reconcileSessionLifecycle(db);
    expect(r.reconciled).toBe(1);
    expect(r.needsRespawn).toHaveLength(0);
  });

  it("does NOT flag dispatchable sessions even with active quests", async () => {
    syncSessionStatusMock.mockReset();
    syncSessionStatusMock.mockResolvedValue({
      upstream_status: "FINISHED",
      alive: true,
      dispatch_safe: true, // FINISHED is still dispatch_safe per cursor's model
      was_drift: false,
      adventurer: { session_status: "idle" },
    });

    const { db } = buildLifecycleMockDb({
      adventurers: [{ id: "fine-1", name: "Worker", session_id: "bc-w", session_status: "idle" }],
      questsByAssigneeId: { "fine-1": [{ id: "q1", title: "in-flight", stage: "execute" }] },
    });

    const r = await reconcileSessionLifecycle(db);
    expect(r.needsRespawn).toHaveLength(0);
  });

  it("returns zeros when no adventurers have session_id", async () => {
    const { db } = buildLifecycleMockDb({ adventurers: [], questsByAssigneeId: {} });
    const r = await reconcileSessionLifecycle(db);
    expect(r.reconciled).toBe(0);
    expect(r.needsRespawn).toEqual([]);
  });

  it("auto-respawns Cat when EXPIRED with pending purrview quests", async () => {
    syncSessionStatusMock.mockReset();
    syncSessionStatusMock.mockResolvedValue({
      upstream_status: "EXPIRED",
      alive: true,
      dispatch_safe: false,
      was_drift: true,
      adventurer: { session_status: "expired" },
    });
    respawnAdventurerMock.mockReset();
    respawnAdventurerMock.mockResolvedValue({
      adventurer_id: "cat-id",
      name: "Cat",
      prior_session_id: "bc-old",
      new_session_id: "bc-new",
      url: "https://cursor.com/agents/bc-new",
      upstream_status: "CREATING",
    });

    const { db } = buildLifecycleMockDb({
      adventurers: [{ id: "cat-id", name: "Cat", session_id: "bc-old", session_status: "idle" }],
      // Cat-specific path: quests assigned to Cat in purrview stage (or unassigned-purrview).
      questsByAssigneeId: { "cat-id": [{ id: "q1", title: "to-review", stage: "purrview" }] },
      backstoryById: { "cat-id": "" }, // no prior auto-respawn — cooldown empty
    });

    const r = await reconcileSessionLifecycle(db);
    expect(respawnAdventurerMock).toHaveBeenCalledTimes(1);
    expect(respawnAdventurerMock.mock.calls[0][0].name).toBe("Cat");
    expect(r.needsRespawn).toHaveLength(1);
    expect(r.needsRespawn[0].adventurer).toBe("Cat");
  });

  it("does NOT auto-respawn Cat if cooldown is active", async () => {
    syncSessionStatusMock.mockReset();
    syncSessionStatusMock.mockResolvedValue({
      upstream_status: "EXPIRED",
      alive: true,
      dispatch_safe: false,
      was_drift: true,
      adventurer: { session_status: "expired" },
    });
    respawnAdventurerMock.mockReset();
    const todayISO = new Date().toISOString().slice(0, 10);
    const { db } = buildLifecycleMockDb({
      adventurers: [{ id: "cat-id", name: "Cat", session_id: "bc-old", session_status: "idle" }],
      questsByAssigneeId: { "cat-id": [{ id: "q1", title: "to-review", stage: "purrview" }] },
      // Recent auto-respawn note → cooldown blocks a second respawn this tick.
      backstoryById: {
        "cat-id": `Sharp-eyed and decisive.\n\n[${todayISO} archived prior Cat session bc-old — auto-respawn: upstream session EXPIRED. New session: bc-mid.]`,
      },
    });

    const r = await reconcileSessionLifecycle(db);
    expect(respawnAdventurerMock).not.toHaveBeenCalled();
    expect(r.needsRespawn).toHaveLength(1);
  });

  it("does NOT auto-respawn non-whitelisted adventurers (e.g. workers)", async () => {
    syncSessionStatusMock.mockReset();
    syncSessionStatusMock.mockResolvedValue({
      upstream_status: "EXPIRED",
      alive: true,
      dispatch_safe: false,
      was_drift: true,
      adventurer: { session_status: "expired" },
    });
    respawnAdventurerMock.mockReset();
    const { db } = buildLifecycleMockDb({
      adventurers: [{ id: "worker-1", name: "CJGEO Dev", session_id: "bc-old", session_status: "idle" }],
      questsByAssigneeId: { "worker-1": [{ id: "q1", title: "task", stage: "execute" }] },
      backstoryById: { "worker-1": "" },
    });

    const r = await reconcileSessionLifecycle(db);
    expect(respawnAdventurerMock).not.toHaveBeenCalled();
    expect(r.needsRespawn).toHaveLength(1);
    expect(r.needsRespawn[0].adventurer).toBe("CJGEO Dev");
  });
});

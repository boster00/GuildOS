"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Flame, Trophy, Coins } from "lucide-react";
import {
  mockQuests as initialMockQuests,
  mockUserSummary,
  getTopEarningQuests,
} from "./data/mockQuests";
import QuestHeader from "./components/QuestHeader";
import QuestTabs from "./components/QuestTabs";
import QuestFilters from "./components/QuestFilters";
import QuestList from "./components/QuestList";
import QuestDetailsDrawer from "./components/QuestDetailsDrawer";
import RewardsPanel from "./components/RewardsPanel";
import LeaderboardPanel from "./components/LeaderboardPanel";
import RulesCard from "./components/RulesCard";

const TAB_VALUES = [
  "recommended",
  "Growth",
  "Activation",
  "SocialProof",
  "Streaks",
  "completed",
];

function filterByTab(quests, tab) {
  if (tab === "completed") {
    return quests.filter((q) => q.status === "completed");
  }
  if (tab === "recommended") {
    return quests.filter((q) => q.status !== "completed");
  }
  return quests.filter((q) => q.category === tab);
}

function filterBySearch(quests, search) {
  if (!search.trim()) return quests;
  const s = search.trim().toLowerCase();
  return quests.filter(
    (q) =>
      q.title.toLowerCase().includes(s) ||
      (q.description && q.description.toLowerCase().includes(s))
  );
}

function filterByDifficulty(quests, difficulty) {
  if (!difficulty) return quests;
  return quests.filter((q) => q.difficulty === difficulty);
}

function filterByStatus(quests, status) {
  if (!status) return quests;
  return quests.filter((q) => q.status === status);
}

function filterByRewardRange(quests, rewardRange) {
  if (!rewardRange) return quests;
  if (rewardRange === "0-50")
    return quests.filter((q) => q.rewardCredits <= 50);
  if (rewardRange === "51-200")
    return quests.filter(
      (q) => q.rewardCredits >= 51 && q.rewardCredits <= 200
    );
  if (rewardRange === "200+")
    return quests.filter((q) => q.rewardCredits >= 200);
  return quests;
}

function filterByChips(quests, highRoi, noVerification, teamFriendly) {
  let out = quests;
  if (highRoi) out = out.filter((q) => q.flags?.highRoi);
  if (noVerification) out = out.filter((q) => q.flags?.noVerification);
  if (teamFriendly) out = out.filter((q) => q.flags?.teamFriendly);
  return out;
}

function sortQuests(quests, sortBy) {
  if (!sortBy || sortBy === "recommended") return [...quests];
  const copy = [...quests];
  if (sortBy === "highest_reward") {
    return copy.sort((a, b) => (b.rewardCredits || 0) - (a.rewardCredits || 0));
  }
  if (sortBy === "easiest") {
    const order = { Easy: 0, Medium: 1, Hard: 2 };
    return copy.sort(
      (a, b) => (order[a.difficulty] ?? 1) - (order[b.difficulty] ?? 1)
    );
  }
  if (sortBy === "closest") {
    return copy.sort((a, b) => {
      const progA = a.progress
        ? a.progress.total - a.progress.current
        : Infinity;
      const progB = b.progress
        ? b.progress.total - b.progress.current
        : Infinity;
      return progA - progB;
    });
  }
  return copy;
}

function getTabCounts(quests) {
  const counts = {};
  TAB_VALUES.forEach((tab) => {
    counts[tab] = filterByTab(quests, tab).length;
  });
  return counts;
}

export default function QuestsPage() {
  const [quests, setQuests] = useState(initialMockQuests);
  const [activeTab, setActiveTab] = useState("recommended");
  const [search, setSearch] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [status, setStatus] = useState("");
  const [rewardRange, setRewardRange] = useState("");
  const [chipHighRoi, setChipHighRoi] = useState(false);
  const [chipNoVerification, setChipNoVerification] = useState(false);
  const [chipTeamFriendly, setChipTeamFriendly] = useState(false);
  const [sortBy, setSortBy] = useState("recommended");
  const [selectedQuestId, setSelectedQuestId] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(typeof window !== "undefined" && window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const tabCounts = useMemo(() => getTabCounts(quests), [quests]);

  const filteredQuests = useMemo(() => {
    let result = filterByTab(quests, activeTab);
    result = filterBySearch(result, search);
    result = filterByDifficulty(result, difficulty);
    result = filterByStatus(result, status);
    result = filterByRewardRange(result, rewardRange);
    result = filterByChips(
      result,
      chipHighRoi,
      chipNoVerification,
      chipTeamFriendly
    );
    return sortQuests(result, sortBy);
  }, [
    quests,
    activeTab,
    search,
    difficulty,
    status,
    rewardRange,
    chipHighRoi,
    chipNoVerification,
    chipTeamFriendly,
    sortBy,
  ]);

  const hasActiveFilters =
    !!search ||
    !!difficulty ||
    !!status ||
    !!rewardRange ||
    chipHighRoi ||
    chipNoVerification ||
    chipTeamFriendly;

  const clearFilters = useCallback(() => {
    setSearch("");
    setDifficulty("");
    setStatus("");
    setRewardRange("");
    setChipHighRoi(false);
    setChipNoVerification(false);
    setChipTeamFriendly(false);
  }, []);

  const openDrawer = useCallback((questId) => {
    setSelectedQuestId(questId);
    setIsDrawerOpen(true);
  }, []);

  const closeDrawer = useCallback(() => {
    setIsDrawerOpen(false);
    setSelectedQuestId(null);
  }, []);

  const selectedQuest = useMemo(
    () => quests.find((q) => q.id === selectedQuestId) || null,
    [quests, selectedQuestId]
  );

  const handlePrimaryAction = useCallback((questId) => {
    setQuests((prev) => {
      const q = prev.find((x) => x.id === questId);
      if (!q) return prev;
      if (q.status === "available") {
        const hasProgress = q.progress && q.progress.total > 1;
        return prev.map((x) =>
          x.id === questId
            ? {
                ...x,
                status: "in_progress",
                progress: hasProgress
                  ? { ...x.progress, current: 1 }
                  : x.progress,
              }
            : x
        );
      }
      if (q.status === "in_progress" && q.progress && q.progress.total >= 1) {
        const nextCurrent = (q.progress.current || 0) + 1;
        const reachedTotal = nextCurrent >= q.progress.total;
        const nextStatus = reachedTotal
          ? q.requiresVerification
            ? "needs_verification"
            : "completed"
          : "in_progress";
        return prev.map((x) =>
          x.id === questId
            ? {
                ...x,
                status: nextStatus,
                progress: reachedTotal
                  ? x.progress
                  : { ...x.progress, current: nextCurrent },
              }
            : x
        );
      }
      if (q.status === "needs_verification") {
        return prev.map((x) =>
          x.id === questId ? { ...x, status: "completed" } : x
        );
      }
      return prev;
    });
  }, []);

  const topEarningQuests = useMemo(
    () => getTopEarningQuests(quests, 5),
    [quests]
  );

  return (
    <main className="min-h-screen pb-8">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Main column ~2/3 */}
          <div className="lg:col-span-2 space-y-4">
            <QuestHeader creditBalance={mockUserSummary.creditBalance} />

            {/* Progress summary strip */}
            <div className="flex flex-wrap gap-4 rounded-lg bg-base-200/50 p-4">
              <div className="flex items-center gap-2">
                <Flame className="h-5 w-5 text-warning" aria-hidden />
                <span className="text-sm font-medium text-base-content">
                  Weekly streak
                </span>
                <span className="badge badge-ghost">
                  {mockUserSummary.streakDays} days
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-primary" aria-hidden />
                <span className="text-sm font-medium text-base-content">
                  Quests completed
                </span>
                <span className="badge badge-ghost">
                  {mockUserSummary.completedCount}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Coins className="h-5 w-5 text-primary" aria-hidden />
                <span className="text-sm font-medium text-base-content">
                  Credits from quests
                </span>
                <span className="badge badge-ghost">
                  {mockUserSummary.questCreditsTotal}
                </span>
              </div>
            </div>

            <QuestTabs
              activeTab={activeTab}
              onTabChange={setActiveTab}
              tabCounts={tabCounts}
            />

            <QuestFilters
              search={search}
              onSearchChange={setSearch}
              difficulty={difficulty}
              onDifficultyChange={setDifficulty}
              status={status}
              onStatusChange={setStatus}
              rewardRange={rewardRange}
              onRewardRangeChange={setRewardRange}
              chipHighRoi={chipHighRoi}
              onChipHighRoiChange={setChipHighRoi}
              chipNoVerification={chipNoVerification}
              onChipNoVerificationChange={setChipNoVerification}
              chipTeamFriendly={chipTeamFriendly}
              onChipTeamFriendlyChange={setChipTeamFriendly}
              onClearFilters={clearFilters}
            />

            {/* Sort (optional) */}
            <div className="flex justify-end">
              <select
                className="select select-bordered select-sm w-auto"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                aria-label="Sort by"
              >
                <option value="recommended">Recommended</option>
                <option value="highest_reward">Highest reward</option>
                <option value="easiest">Easiest</option>
                <option value="closest">Closest to complete</option>
              </select>
            </div>

            <QuestList
              quests={filteredQuests}
              onOpenDrawer={openDrawer}
              onPrimaryAction={handlePrimaryAction}
              onClearFilters={clearFilters}
              hasActiveFilters={hasActiveFilters}
            />
          </div>

          {/* Side column ~1/3 */}
          <div className="space-y-4">
            <RewardsPanel
              creditBalance={mockUserSummary.creditBalance}
              earnedThisMonth={mockUserSummary.earnedThisMonth}
              nextMilestone={mockUserSummary.nextMilestone}
              topQuests={topEarningQuests}
              onViewQuest={openDrawer}
            />
            <LeaderboardPanel />
            <RulesCard onOpenRulesModal={() => setShowRulesModal(true)} />
          </div>
        </div>
      </div>

      <QuestDetailsDrawer
        quest={selectedQuest}
        isOpen={isDrawerOpen}
        onClose={closeDrawer}
        onPrimaryAction={handlePrimaryAction}
        isMobile={isMobile}
      />

      {/* Rules modal (optional) */}
      {showRulesModal && (
        <div
          className="modal modal-open"
          role="dialog"
          aria-modal="true"
          aria-labelledby="rules-modal-title"
        >
          <div className="modal-box">
            <h2 id="rules-modal-title" className="text-lg font-bold">
              Quest economy rules
            </h2>
            <div className="py-4 text-sm text-base-content/80 space-y-2">
              <p>
                Credits earned from quests are added to your balance and can be
                used like subscription credits. All quest rewards are subject to
                anti-abuse checks.
              </p>
              <p>
                Verification quests (e.g. reviews, case studies, social posts)
                may require manual review. We may request additional proof or
                reject submissions that don’t meet guidelines.
              </p>
              <p>
                Fraud, fake referrals, or misuse can result in revoked rewards
                and account action. One reward per person per quest unless
                otherwise stated.
              </p>
            </div>
            <div className="modal-action">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setShowRulesModal(false)}
              >
                Got it
              </button>
            </div>
          </div>
          <div
            className="modal-backdrop bg-black/50"
            onClick={() => setShowRulesModal(false)}
            aria-hidden
          />
        </div>
      )}
    </main>
  );
}

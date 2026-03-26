"use client";

import React from "react";
import { Coins, TrendingUp } from "lucide-react";

export default function RewardsPanel({
  creditBalance = 0,
  earnedThisMonth = 0,
  nextMilestone,
  topQuests = [],
  onViewQuest,
}) {
  const milestone = nextMilestone || {
    targetCredits: 500,
    label: "Earn 500 credits to unlock Builder badge",
    current: 0,
  };
  const milestoneProgress =
    milestone.targetCredits > 0
      ? Math.min(100, (milestone.current / milestone.targetCredits) * 100)
      : 0;

  return (
    <div className="card bg-base-100 border border-base-300 shadow-sm">
      <div className="card-body">
        <h2 className="card-title text-base flex items-center gap-2">
          <Coins className="h-5 w-5 text-primary" aria-hidden />
          Your credits
        </h2>
        <div className="space-y-4">
          <div>
            <p className="text-2xl font-bold text-primary">
              {creditBalance.toLocaleString()}
            </p>
            <p className="text-xs text-base-content/60">current balance</p>
          </div>
          <div>
            <p className="text-lg font-semibold text-base-content">
              {earnedThisMonth.toLocaleString()}
            </p>
            <p className="text-xs text-base-content/60">earned this month</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-base-content/80">
              Next reward milestone
            </h3>
            <p className="text-xs text-base-content/70 mt-0.5">{milestone.label}</p>
            <progress
              className="progress progress-primary h-2 w-full mt-1"
              value={milestoneProgress}
              max={100}
              aria-label={`Milestone progress ${Math.round(milestoneProgress)}%`}
            />
          </div>
          <div>
            <h3 className="text-sm font-medium text-base-content/80 flex items-center gap-1">
              <TrendingUp className="h-4 w-4" aria-hidden />
              Top earning quests right now
            </h3>
            <ul className="mt-2 space-y-1.5">
              {topQuests.slice(0, 3).map((q) => (
                <li
                  key={q.id}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <span className="truncate text-base-content/80">{q.title}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-primary font-medium">
                      +{q.rewardCredits}
                    </span>
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs"
                      onClick={() => onViewQuest(q.id)}
                      aria-label={`View ${q.title}`}
                    >
                      View
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

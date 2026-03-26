"use client";

import React from "react";
import { getQuestIcon } from "./questIcons";

function getCtaLabel(quest) {
  switch (quest.status) {
    case "available":
      return "Start";
    case "in_progress":
      return "Continue";
    case "needs_verification":
      return "Submit for review";
    case "completed":
      return "Completed";
    case "locked":
      return "Locked";
    default:
      return "Start";
  }
}

function categoryLabel(category) {
  const map = {
    Growth: "Growth",
    SocialProof: "Social Proof",
    Activation: "Activation",
    Streaks: "Streaks",
    Community: "Community",
    Revenue: "Revenue",
  };
  return map[category] || category;
}

export default function QuestCard({ quest, onOpenDrawer, onPrimaryAction }) {
  const Icon = getQuestIcon(quest.iconName);
  const ctaLabel = getCtaLabel(quest);
  const isLocked = quest.status === "locked";
  const isCompleted = quest.status === "completed";
  const progress = quest.progress;
  const showProgress = progress && progress.total > 1;

  const handleCardClick = (e) => {
    if (e.target.closest("button")) return;
    onOpenDrawer(quest.id);
  };

  const handlePrimaryClick = (e) => {
    e.stopPropagation();
    if (isLocked || isCompleted) return;
    onPrimaryAction(quest.id);
  };

  return (
    <article
      className="card bg-base-100 border border-base-300 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
      onClick={handleCardClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleCardClick(e);
        }
      }}
      aria-label={`Open ${quest.title}`}
    >
      <div className="card-body flex-row gap-4 p-4">
        <div className="flex shrink-0 items-start">
          <div className="rounded-lg bg-primary/10 p-2">
            <Icon className="h-5 w-5 text-primary" aria-hidden />
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="card-title text-base font-semibold">{quest.title}</h2>
          <p className="text-sm text-base-content/70 line-clamp-2 mt-0.5">
            {quest.description}
          </p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            <span className="badge badge-outline badge-sm">
              {categoryLabel(quest.category)}
            </span>
            <span className="badge badge-ghost badge-sm">{quest.difficulty}</span>
            {quest.requiresVerification && (
              <span className="badge badge-warning badge-sm">Verification</span>
            )}
          </div>
          {showProgress && (
            <div className="mt-2">
              <div className="flex justify-between text-xs text-base-content/60 mb-0.5">
                <span>Progress</span>
                <span>
                  {progress.current}/{progress.total}
                </span>
              </div>
              <progress
                className="progress progress-primary h-1.5 w-full"
                value={progress.current}
                max={progress.total}
                aria-label={`Progress ${progress.current} of ${progress.total}`}
              />
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end justify-between gap-2">
          <div className="text-right">
            <span className="font-semibold text-primary">
              +{quest.rewardCredits}
            </span>
            <span className="text-xs text-base-content/60"> credits</span>
          </div>
          {isLocked ? (
            <div className="tooltip tooltip-left" data-tip="Upgrade to unlock">
              <button
                type="button"
                className="btn btn-disabled btn-sm"
                disabled
                aria-label="Locked; upgrade to unlock"
              >
                {ctaLabel}
              </button>
            </div>
          ) : (
            <button
              type="button"
              className={`btn btn-sm ${isCompleted ? "btn-ghost btn-disabled" : "btn-primary"}`}
              disabled={isCompleted}
              onClick={handlePrimaryClick}
              aria-label={isCompleted ? "Completed" : ctaLabel}
            >
              {ctaLabel}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

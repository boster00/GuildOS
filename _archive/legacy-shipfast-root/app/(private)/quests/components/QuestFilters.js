"use client";

import React from "react";
import { Search } from "lucide-react";

export default function QuestFilters({
  search,
  onSearchChange,
  difficulty,
  onDifficultyChange,
  status,
  onStatusChange,
  rewardRange,
  onRewardRangeChange,
  chipHighRoi,
  onChipHighRoiChange,
  chipNoVerification,
  onChipNoVerificationChange,
  chipTeamFriendly,
  onChipTeamFriendlyChange,
  onClearFilters,
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="input input-bordered flex items-center gap-2 flex-1 min-w-[200px] input-sm">
          <Search className="h-4 w-4 opacity-50" aria-hidden />
          <input
            type="search"
            placeholder="Search quests..."
            className="grow"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            aria-label="Search quests"
          />
        </label>
        <select
          className="select select-bordered select-sm w-auto"
          value={difficulty}
          onChange={(e) => onDifficultyChange(e.target.value)}
          aria-label="Filter by difficulty"
        >
          <option value="">All difficulty</option>
          <option value="Easy">Easy</option>
          <option value="Medium">Medium</option>
          <option value="Hard">Hard</option>
        </select>
        <select
          className="select select-bordered select-sm w-auto"
          value={status}
          onChange={(e) => onStatusChange(e.target.value)}
          aria-label="Filter by status"
        >
          <option value="">All status</option>
          <option value="available">Available</option>
          <option value="in_progress">In progress</option>
          <option value="needs_verification">Requires verification</option>
          <option value="completed">Completed</option>
        </select>
        <select
          className="select select-bordered select-sm w-auto"
          value={rewardRange}
          onChange={(e) => onRewardRangeChange(e.target.value)}
          aria-label="Filter by reward range"
        >
          <option value="">All rewards</option>
          <option value="0-50">0–50</option>
          <option value="51-200">51–200</option>
          <option value="200+">200+</option>
        </select>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-base-content/60">Quick filters:</span>
        <button
          type="button"
          className={`btn btn-xs ${chipHighRoi ? "btn-primary" : "btn-ghost"}`}
          onClick={() => onChipHighRoiChange(!chipHighRoi)}
          aria-pressed={chipHighRoi}
        >
          High ROI
        </button>
        <button
          type="button"
          className={`btn btn-xs ${chipNoVerification ? "btn-primary" : "btn-ghost"}`}
          onClick={() => onChipNoVerificationChange(!chipNoVerification)}
          aria-pressed={chipNoVerification}
        >
          No verification
        </button>
        <button
          type="button"
          className={`btn btn-xs ${chipTeamFriendly ? "btn-primary" : "btn-ghost"}`}
          onClick={() => onChipTeamFriendlyChange(!chipTeamFriendly)}
          aria-pressed={chipTeamFriendly}
        >
          Team-friendly
        </button>
        {(search || difficulty || status || rewardRange || chipHighRoi || chipNoVerification || chipTeamFriendly) && (
          <button
            type="button"
            className="btn btn-ghost btn-xs"
            onClick={onClearFilters}
          >
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}

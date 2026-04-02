"use client";

import React from "react";
import { SearchX, Target } from "lucide-react";

export default function QuestEmptyState({
  onClearFilters,
  hasActiveFilters,
}) {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-xl border border-dashed border-base-300 bg-base-200/30 py-12 px-6 text-center"
      role="status"
      aria-label="No quests match your filters"
    >
      {hasActiveFilters ? (
        <SearchX className="h-12 w-12 text-base-content/40 mb-4" aria-hidden />
      ) : (
        <Target className="h-12 w-12 text-base-content/40 mb-4" aria-hidden />
      )}
      <h3 className="text-lg font-semibold text-base-content">
        {hasActiveFilters ? "No quests match" : "No quests here"}
      </h3>
      <p className="mt-1 text-sm text-base-content/70 max-w-sm">
        {hasActiveFilters
          ? "Try clearing some filters or choose a different tab to see more quests."
          : "Complete quests in other categories to see completed items here, or switch to another tab."}
      </p>
      {hasActiveFilters && onClearFilters && (
        <button
          type="button"
          className="btn btn-primary btn-sm mt-4"
          onClick={onClearFilters}
        >
          Clear filters
        </button>
      )}
    </div>
  );
}

"use client";

import React from "react";
import QuestCard from "./QuestCard";
import QuestEmptyState from "./QuestEmptyState";

export default function QuestList({
  quests,
  onOpenDrawer,
  onPrimaryAction,
  onClearFilters,
  hasActiveFilters,
}) {
  if (!quests || quests.length === 0) {
    return (
      <QuestEmptyState
        onClearFilters={onClearFilters}
        hasActiveFilters={hasActiveFilters}
      />
    );
  }

  return (
    <ul className="space-y-3" role="list" aria-label="Quest list">
      {quests.map((quest) => (
        <li key={quest.id}>
          <QuestCard
            quest={quest}
            onOpenDrawer={onOpenDrawer}
            onPrimaryAction={onPrimaryAction}
          />
        </li>
      ))}
    </ul>
  );
}

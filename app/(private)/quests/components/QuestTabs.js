"use client";

import React from "react";

const TABS = [
  { value: "recommended", label: "Recommended" },
  { value: "Growth", label: "Growth" },
  { value: "Activation", label: "Activation" },
  { value: "SocialProof", label: "Social Proof" },
  { value: "Streaks", label: "Streaks" },
  { value: "completed", label: "Completed" },
];

export default function QuestTabs({ activeTab, onTabChange, tabCounts = {} }) {
  return (
    <div
      role="tablist"
      className="tabs tabs-boxed bg-base-200/50 p-1 rounded-lg overflow-x-auto flex-nowrap gap-1 min-h-12"
      aria-label="Quest categories"
    >
      {TABS.map((tab) => {
        const count = tabCounts[tab.value] ?? 0;
        const isActive = activeTab === tab.value;
        return (
          <button
            key={tab.value}
            role="tab"
            aria-selected={isActive}
            aria-controls={`panel-${tab.value}`}
            id={`tab-${tab.value}`}
            className={`tab tab-sm sm:tab-md shrink-0 ${isActive ? "tab-active" : ""}`}
            onClick={() => onTabChange(tab.value)}
          >
            {tab.label}
            {count !== undefined && (
              <span className="ml-1.5 badge badge-ghost badge-sm">{count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

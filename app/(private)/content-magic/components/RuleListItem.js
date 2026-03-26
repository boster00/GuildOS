"use client";
import React from "react";
import { Lock } from "lucide-react";
import { useWritingGuide } from "@/libs/content-magic/context/WritingGuideContext";

export default function RuleListItem({ rule, isInactive }) {
  const { article, rules, openRuleModal } = useWritingGuide();

  const handleRuleClick = () => {
    openRuleModal(rule.key);
  };

  const ListingUI = rule.components.ListingUI;
  const ruleState = rules[rule.key];

  // If no rule state exists, skip rendering
  if (!ruleState) {
    return null;
  }

  // Render inactive rule state (pageType doesn't match)
  if (isInactive || !ruleState.active) {
    return (
      <div
        onClick={handleRuleClick}
        className="w-full flex items-center justify-between p-2 bg-gray-50 rounded border border-gray-200 hover:border-gray-300 transition-colors opacity-60 cursor-pointer"
        title="Rule is not active for this content type"
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Lock className="w-3 h-3 text-gray-400 flex-shrink-0" />
          <span className="text-xs font-medium text-gray-600 truncate">{rule.meta.label}</span>
        </div>
      </div>
    );
  }

  // Render active rule with its ListingUI component
  // Pass the click handler to ListingUI via onExecute prop
  return (
    <div
      onClick={handleRuleClick}
      className="cursor-pointer"
      title={rule.meta.description}
    >
      <ListingUI
        rule={rule}
        context={article}
        onExecute={handleRuleClick}
      />
    </div>
  );
}
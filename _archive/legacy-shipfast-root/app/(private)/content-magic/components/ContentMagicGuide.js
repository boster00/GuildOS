"use client";
import React, { useState, useEffect, useMemo } from "react";
import { useWritingGuide } from "@/libs/content-magic/context/WritingGuideContext";
import { ChevronDown, ChevronRight, Eye, EyeOff } from "lucide-react";
import RuleListItem from "./RuleListItem";
import RuleDetailPanel from "./RuleDetailPanel";
import ContentMagicGuideAssets from "./ContentMagicGuideAssets";
import { getRulesByCategory, getAllRules } from "@/libs/content-magic/rules/index";

const CATEGORIES = {
  research_plan: { label: "Research and Plan", color: "blue", defaultExpanded: true },
  write_optimize: { label: "Write & Optimize", color: "purple", defaultExpanded: true },
  launch: { label: "Launch/Ship", color: "green", defaultExpanded: true },
};

const CATEGORY_ORDER = ['research_plan', 'write_optimize', 'launch'];

export default function ContentMagicGuide() {
  const { article, selectedRuleKey, closeRuleModal, rules } = useWritingGuide();
  const [expandedCategories, setExpandedCategories] = useState({
    research_plan: true,
    write_optimize: true,
    launch: true,
  });
  const [showInactiveRules, setShowInactiveRules] = useState({
    research_plan: false,
    write_optimize: false,
    launch: false,
  });

  const isRuleActive = (rule) => {
    if (!rule.pageType) return true;
    // Use article.type (database column) instead of article.pageType (removed from context)
    const articleType = article?.type || article?.pageType;
    return rule.pageType.includes("all") || (articleType && rule.pageType.includes(articleType));
  };

  // Check if all active rules in a category are completed
  const areAllRulesCompleted = useMemo(() => {
    const categoryCompletion = {};
    
    CATEGORY_ORDER.forEach(categoryKey => {
      const categoryRules = getRulesByCategory(categoryKey);
      const activeRules = categoryRules.filter(r => isRuleActive(r));
      
      if (activeRules.length === 0) {
        categoryCompletion[categoryKey] = true; // No active rules means "completed"
      } else {
        // Check if all active rules are executed
        const allCompleted = activeRules.every(rule => {
          const ruleState = rules[rule.key];
          return ruleState?.executed === true;
        });
        categoryCompletion[categoryKey] = allCompleted;
      }
    });
    
    return categoryCompletion;
  }, [rules, article?.type, article?.pageType]);

  // Calculate initial expanded state based on previous stage completion
  useEffect(() => {
    setExpandedCategories(prev => {
      const newExpandedState = { ...prev };
      let hasChanged = false;
      
      CATEGORY_ORDER.forEach((categoryKey, index) => {
        const categoryMeta = CATEGORIES[categoryKey];
        const shouldBeExpandedByDefault = categoryMeta.defaultExpanded;
        
        if (index === 0) {
          // First category is always expanded by default
          if (newExpandedState[categoryKey] !== true) {
            newExpandedState[categoryKey] = true;
            hasChanged = true;
          }
        } else {
          // Check if previous category is fully completed
          const previousCategoryKey = CATEGORY_ORDER[index - 1];
          const previousCompleted = areAllRulesCompleted[previousCategoryKey];
          
          // Expand if previous stage is completed, otherwise keep current state
          if (previousCompleted && newExpandedState[categoryKey] !== true) {
            newExpandedState[categoryKey] = true;
            hasChanged = true;
          } else if (!previousCompleted && !shouldBeExpandedByDefault && newExpandedState[categoryKey] !== false) {
            // Only auto-collapse if it's not set to be expanded by default
            // Categories with defaultExpanded: true should stay expanded
            newExpandedState[categoryKey] = false;
            hasChanged = true;
          } else if (shouldBeExpandedByDefault && newExpandedState[categoryKey] !== true) {
            // If category should be expanded by default, ensure it's expanded
            newExpandedState[categoryKey] = true;
            hasChanged = true;
          }
        }
      });
      
      return hasChanged ? newExpandedState : prev;
    });
  }, [areAllRulesCompleted]); // Only depend on completion status

  const selectedRule = selectedRuleKey ? 
    getAllRules().find(r => r.key === selectedRuleKey) : null;

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Writing Guide</h2>
      </div>

      {/* Categories & Rules */}
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-2 p-4">

          {/* Divider */}
          <div className="border-t border-gray-200 my-2"></div>

          {Object.entries(CATEGORIES).map(([categoryKey, categoryMeta]) => {
            const rules = getRulesByCategory(categoryKey);
            const activeRules = rules.filter(r => isRuleActive(r));
            const inactiveRules = rules.filter(r => !isRuleActive(r));

            return (
              <div key={categoryKey} className="space-y-1">
                {/* Category Header */}
                <button
                  onClick={() => setExpandedCategories(prev => ({
                    ...prev,
                    [categoryKey]: !prev[categoryKey],
                  }))}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${
                    expandedCategories[categoryKey]
                      ? `bg-${categoryMeta.color}-50 border border-${categoryMeta.color}-200`
                      : "hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-center gap-2 flex-1">
                    {expandedCategories[categoryKey] ? (
                      <ChevronDown className="w-4 h-4 text-gray-600" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-600" />
                    )}
                    <span className="text-sm font-semibold text-gray-700">{categoryMeta.label}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full bg-${categoryMeta.color}-100 text-${categoryMeta.color}-700`}>
                      {activeRules.length}
                    </span>
                  </div>
                </button>

                {/* Rules List */}
                {expandedCategories[categoryKey] && (
                  <div className="space-y-1 ml-2">
                    {/* Active Rules */}
                    {activeRules.map(rule => (
                      <RuleListItem 
                        key={rule.key} 
                        rule={rule}
                        isInactive={false}
                      />
                    ))}

                    {/* Show Inactive Rules Toggle */}
                    {inactiveRules.length > 0 && (
                      <button
                        onClick={() => setShowInactiveRules(prev => ({
                          ...prev,
                          [categoryKey]: !prev[categoryKey],
                        }))}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded transition-colors"
                      >
                        {showInactiveRules[categoryKey] ? (
                          <>
                            <EyeOff className="w-3 h-3" />
                            Hide inactive ({inactiveRules.length})
                          </>
                        ) : (
                          <>
                            <Eye className="w-3 h-3" />
                            Show inactive ({inactiveRules.length})
                          </>
                        )}
                      </button>
                    )}

                    {/* Inactive Rules List */}
                    {showInactiveRules[categoryKey] && inactiveRules.map(rule => (
                      <RuleListItem 
                        key={rule.key} 
                        rule={rule}
                        isInactive={true}
                      />
                    ))}
                  </div>
                )}
                
              </div>
            );
          })}
        </div>
      </div>
      
        {/* Assets Card */}
        <ContentMagicGuideAssets />

      {/* Rule Detail Modal */}
      {selectedRule && (
        <RuleDetailPanel 
          rule={selectedRule}
          onClose={closeRuleModal}
        />
      )}
    </div>
  );
}
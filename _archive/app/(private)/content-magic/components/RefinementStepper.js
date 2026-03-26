// ARCHIVED: Original path was app/(private)/content-magic/components/RefinementStepper.js

"use client";
import React from "react";
import { CheckCircle, HelpCircle } from "lucide-react";
import { getTutorialLink } from "@/libs/content-magic/references/tutorialRegistry";

// MVP: Only show research_plan steps
const STEPS = {
  research_plan: [
    // capture_your_insights de-indexed for MVP
    { key: "add_offer_and_icp", label: "Add Offer and ICP", number: 1 },
    { key: "research_keywords", label: "Research Keywords (SEO)", number: 2 },
    { key: "research_prompts", label: "Research Prompts (GEO)", number: 3 },
    { key: "benchmark_competitors", label: "Benchmark Competitors", number: 4 },
    // plan_outline de-indexed for MVP
    { key: "research_internal_links", label: "Research Internal Links", number: 5 },
  ],
  // MVP: write_optimize and launch categories hidden
  // write_optimize: [
  //   { key: "implement_changes", label: "Implement Changes", number: 7 },
  //   { key: "add_eeat_credibility", label: "Add EEAT/Credibility", number: 8, optional: true },
  //   { key: "enrich_optimize_ux", label: "Enrich & Optimize UX", number: 9 },
  // ],
  // launch: [
  //   { key: "publish_as_webpage", label: "Publish as Webpage", number: 10 },
  //   { key: "repurpose_for_every_channel", label: "Repurpose for Every Channel", number: 11 },
  //   { key: "add_calendar_reminder", label: "Add Calendar Reminder", number: 12 },
  // ],
};

export default function RefinementStepper({ currentStepKey, article, onStepClick }) {
  const completedSteps = article?.assets?.completed_steps || [];
  
  const isStepComplete = (stepKey) => {
    // Research & Plan steps check for assets
    // capture_your_insights de-indexed for MVP - completion check removed
    if (stepKey === "add_offer_and_icp") {
      // Check if both offer_id and icp_id are set
      const hasOffer = !!(article?.offer_id || article?.context?.offerId);
      const hasIcp = !!(article?.icp_id || article?.context?.icpId);
      return hasOffer && hasIcp;
    }
    if (stepKey === "research_keywords") {
      return !!(article?.assets?.keywordStrategy?.selectedSecondaryKeywords?.length > 0);
    }
    if (stepKey === "research_prompts") {
      return !!(article?.assets?.qaTargets?.questions?.length > 0);
    }
    if (stepKey === "benchmark_competitors") {
      return !!(article?.assets?.competitorIdeas?.ideas?.length > 0);
    }
    // plan_outline de-indexed for MVP - removed completion check
    if (stepKey === "research_internal_links") {
      return !!(article?.assets?.internalLinksPlan);
    }
    // Other steps check completed_steps array
    return completedSteps.includes(stepKey);
  };

  const isCategoryReached = (category) => {
    if (category === "research_plan") return true;
    if (category === "write_optimize") {
      // Reached if all research_plan steps are complete
      return STEPS.research_plan.every(step => isStepComplete(step.key));
    }
    if (category === "launch") {
      // Reached if all previous steps are complete
      return STEPS.research_plan.every(step => isStepComplete(step.key)) &&
             STEPS.write_optimize.every(step => isStepComplete(step.key));
    }
    return false;
  };

  return (
    <div className="w-64 bg-gray-50 border-r border-gray-200 p-4 overflow-y-auto">
      <div className="space-y-6">
        {Object.entries(STEPS).map(([categoryKey, steps]) => {
          const categoryReached = isCategoryReached(categoryKey);
          const categoryLabels = {
            research_plan: "Research & Plan",
            write_optimize: "Write & Optimize",
            launch: "Launch/Ship",
          };

          return (
            <div key={categoryKey}>
              <h3 className={`text-xs font-semibold uppercase mb-2 ${
                categoryReached ? "text-gray-900" : "text-gray-400"
              }`}>
                {categoryLabels[categoryKey]}
              </h3>
              <div className="space-y-1">
                {steps.map((step) => {
                  // MVP: Conditionally hide "add_offer_and_icp" if already complete
                  if (step.key === "add_offer_and_icp" && isStepComplete(step.key)) {
                    return null;
                  }
                  
                  const isComplete = isStepComplete(step.key);
                  const isActive = currentStepKey === step.key;
                  const isDisabled = !categoryReached && !isActive;

                  const tutorialLink = getTutorialLink(step.key);
                  
                  return (
                    <div key={step.key} className="relative group">
                      <button
                        onClick={() => !isDisabled && onStepClick?.(step.key)}
                        disabled={isDisabled}
                        className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                          isActive
                            ? "bg-blue-100 text-blue-900 font-medium"
                            : isDisabled
                            ? "text-gray-400 cursor-not-allowed"
                            : "text-gray-700 hover:bg-gray-100"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {isComplete ? (
                            <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                          ) : (
                            <span className="w-4 h-4 flex-shrink-0 text-gray-400">
                              {step.number}.
                            </span>
                          )}
                          <span className="flex-1">{step.label}</span>
                          {step.optional && (
                            <span className="text-xs text-gray-500">(Optional)</span>
                          )}
                        </div>
                      </button>
                      
                      {tutorialLink && (
                        <a
                          href={tutorialLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-blue-50 rounded"
                          title="Watch tutorial"
                        >
                          <HelpCircle className="w-4 h-4 text-blue-600" />
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}


"use client";
import React from "react";
import { UserCheck } from "lucide-react";
import { useWritingGuide } from "@/libs/content-magic/context/WritingGuideContext";

const addEeatCredibility = {
  key: "add_eeat_credibility",
  pageType: ["all"],
  meta: {
    label: "Add EEAT/Credibility",
    category: "write_optimize",
    description: "Write a brief author credibility block to enhance EEAT (Experience, Expertise, Authoritativeness, Trustworthiness).",
    defaultActive: true,
  },
  DetailsUIDisplayMode: "rightside",

  is_complete: (context) => {
    // Optional step: complete if authorCredibility exists OR if marked as complete
    const completedSteps = context.assets?.completed_steps || [];
    return !!(context.assets?.eeat?.authorCredibility) || completedSteps.includes("add_eeat_credibility");
  },

  components: {
    ListingUI: ({ rule, context, onExecute }) => {
      const isComplete = rule.is_complete && rule.is_complete(context);

      return (
        <div className="flex items-center justify-between p-2 bg-white rounded border border-purple-200 hover:border-purple-400 transition-colors group cursor-pointer">
          <div className="flex-1">
            <span className="text-xs font-medium text-gray-700">
              {isComplete && (
                <span className="text-xs text-green-600 pr-1">✓ </span>
              )}
              {rule.meta.label}
              <span className="text-xs text-gray-500 ml-1">(Optional)</span>
            </span>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onExecute();
            }}
            className="p-1 text-purple-600 hover:bg-purple-50 rounded transition-colors opacity-0 group-hover:opacity-100"
            title="Add EEAT/Credibility"
          >
            <UserCheck className="w-4 h-4" />
          </button>
        </div>
      );
    },

    DetailedUI: ({ rule, context, onUpdate }) => {
      const { updateArticle } = useWritingGuide();

      const handleMarkComplete = async () => {
        const currentAssets = context.assets || {};
        const currentCompletedSteps = currentAssets.completed_steps || [];
        if (!currentCompletedSteps.includes("add_eeat_credibility")) {
          updateArticle({
            assets: {
              ...currentAssets,
              completed_steps: [...currentCompletedSteps, "add_eeat_credibility"],
            },
          });
        }
      };

      const handleSkip = async () => {
        const currentAssets = context.assets || {};
        const currentCompletedSteps = currentAssets.completed_steps || [];
        if (!currentCompletedSteps.includes("add_eeat_credibility")) {
          updateArticle({
            assets: {
              ...currentAssets,
              completed_steps: [...currentCompletedSteps, "add_eeat_credibility"],
            },
          });
        }
      };

      return (
        <div className="space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <h4 className="text-sm font-semibold text-blue-900 mb-2">What is EEAT?</h4>
            <p className="text-xs text-blue-800 mb-2">
              EEAT stands for <strong>Experience</strong>, <strong>Expertise</strong>, <strong>Authoritativeness</strong>, and <strong>Trustworthiness</strong>. 
              Adding an author credibility block helps Google understand why readers should trust your content.
            </p>
            <p className="text-xs text-blue-800">
              <strong>Tip:</strong> Include your relevant experience, credentials, or unique perspective that makes you qualified to write about this topic.
            </p>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-gray-900 mb-2">What to Include:</h4>
            <ul className="text-xs text-gray-700 space-y-1 list-disc list-inside">
              <li>Your relevant experience or years in the field</li>
              <li>Professional credentials, certifications, or education</li>
              <li>Notable achievements, publications, or recognition</li>
              <li>Unique perspective or expertise that adds value</li>
            </ul>
          </div>

          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-purple-900 mb-2">Instructions:</h4>
            <p className="text-xs text-purple-800 mb-2">
              Please add an author credibility block to your article. This should be a brief 2-4 sentence block that establishes your expertise and trustworthiness on the topic.
            </p>
            <p className="text-xs text-purple-800 mb-3">
              You can add this block anywhere in your article, typically near the beginning or end. Once you've added it, mark this step as completed.
            </p>
            <div className="bg-white border border-purple-300 rounded p-3 mt-3">
              <p className="text-xs font-semibold text-purple-900 mb-2">Example:</p>
              <p className="text-xs text-gray-700 italic leading-relaxed">
                "About the Author: [Your Name] is a [your role/title] with [X] years of experience in [relevant field]. 
                [He/She/They] holds a [degree/certification] and has [notable achievement, e.g., 'published over 50 articles' or 'helped 1000+ clients']. 
                [Your unique perspective or why readers should trust your expertise on this topic]."
              </p>
              <p className="text-xs text-gray-600 mt-2">
                <strong>Example for a plumbing article:</strong> "About the Author: John Smith is a licensed master plumber with 15 years of experience in residential and commercial plumbing. He holds certifications from the National Association of Plumbing Professionals and has completed over 2,000 successful installations and repairs. John specializes in emergency plumbing services and has helped thousands of homeowners resolve urgent plumbing issues."
              </p>
            </div>
          </div>

          <div className="flex justify-between items-center gap-3">
            <button
              onClick={handleSkip}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm flex-1"
            >
              Skip
            </button>
            <button
              onClick={handleMarkComplete}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm flex-1"
            >
              Mark as Completed
            </button>
          </div>
        </div>
      );
    },
  },
};

export default addEeatCredibility;


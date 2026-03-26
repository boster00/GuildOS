"use client";
import React from "react";
import { Calendar } from "lucide-react";
import { useWritingGuide } from "@/libs/content-magic/context/WritingGuideContext";

const addCalendarReminder = {
  key: "add_calendar_reminder",
  pageType: ["all"],
  meta: {
    label: "Add Calendar Reminder",
    category: "launch",
    description: "Set a reminder to review article performance and learn from results.",
    defaultActive: true,
  },
  DetailsUIDisplayMode: "rightside",

  is_complete: (context) => {
    const completedSteps = context.assets?.completed_steps || [];
    return completedSteps.includes("add_calendar_reminder");
  },

  components: {
    ListingUI: ({ rule, context, onExecute }) => {
      const isComplete = rule.is_complete && rule.is_complete(context);

      return (
        <div className="flex items-center justify-between p-2 bg-white rounded border border-green-200 hover:border-green-400 transition-colors group cursor-pointer">
          <div className="flex-1">
            <span className="text-xs font-medium text-gray-700">
              {isComplete && (
                <span className="text-xs text-green-600 pr-1">✓ </span>
              )}
              {rule.meta.label}
            </span>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onExecute();
            }}
            className="p-1 text-green-600 hover:bg-green-50 rounded transition-colors opacity-0 group-hover:opacity-100"
            title="Add Calendar Reminder"
          >
            <Calendar className="w-4 h-4" />
          </button>
        </div>
      );
    },

    DetailedUI: ({ rule, context, onUpdate }) => {
      const { updateArticle } = useWritingGuide();

      const completedSteps = context.assets?.completed_steps || [];
      const isComplete = completedSteps.includes("add_calendar_reminder");

      return (
        <div className="space-y-6">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
            <h4 className="text-sm font-semibold text-green-900 mb-2">Why Review Performance?</h4>
            <p className="text-xs text-green-800">
              Setting a reminder to review your article's performance helps you learn what works, 
              identify improvement opportunities, and refine your content strategy based on real data.
            </p>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Instructions:</h4>
              <p className="text-sm text-gray-700 mb-4">
                Please add a calendar reminder in your calendar application (Google Calendar, Outlook, etc.) 
                to review this article's performance. We recommend setting it for 30 days after publication.
              </p>
              
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
                <h5 className="text-xs font-semibold text-gray-900 mb-2">What to Review:</h5>
                <ul className="text-xs text-gray-700 space-y-1 list-disc list-inside">
                  <li>Page views and traffic sources</li>
                  <li>Engagement metrics (time on page, bounce rate)</li>
                  <li>Search rankings for target keywords</li>
                  <li>Backlinks and social shares</li>
                  <li>Conversion rates (if applicable)</li>
                  <li>User feedback and comments</li>
                </ul>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs text-blue-800">
                  <strong>Article:</strong> {context.title || "Untitled"}
                </p>
              </div>
            </div>
          </div>

          {isComplete ? (
            <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg text-center">
              ✓ This step is marked as complete
            </div>
          ) : (
            <button
              onClick={async () => {
                const currentAssets = context.assets || {};
                const currentCompletedSteps = currentAssets.completed_steps || [];
                if (!currentCompletedSteps.includes("add_calendar_reminder")) {
                  updateArticle({
                    assets: {
                      ...currentAssets,
                      completed_steps: [...currentCompletedSteps, "add_calendar_reminder"],
                    },
                  });
                }
              }}
              className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center justify-center gap-2"
            >
              <Calendar className="w-4 h-4" />
              Mark as Complete
            </button>
          )}
        </div>
      );
    },
  },
};

export default addCalendarReminder;


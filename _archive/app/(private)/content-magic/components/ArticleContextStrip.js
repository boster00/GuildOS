// ARCHIVED: Original path was app/(private)/content-magic/components/ArticleContextStrip.js

"use client";
import React from "react";

export default function ArticleContextStrip({ article, campaign }) {
  return (
    <div className="bg-gray-50 border-b border-gray-200 px-6 py-3">
      <div className="flex items-center gap-4 text-sm">
        <div>
          <span className="text-gray-500">Article:</span>
          <span className="ml-2 font-medium text-gray-900">{article?.title || "Untitled"}</span>
        </div>
        {campaign?.name && (
          <div>
            <span className="text-gray-500">Campaign:</span>
            <span className="ml-2 text-gray-700">{campaign.name}</span>
          </div>
        )}
        {article?.phase && (
          <div>
            <span className="text-gray-500">Phase:</span>
            <span className="ml-2 text-gray-700">{article.phase}</span>
          </div>
        )}
        {article?.assets?.keywordStrategy?.primaryKeyword && (
          <div>
            <span className="text-gray-500">Primary Keyword:</span>
            <span className="ml-2 text-gray-700 font-medium">
              {article.assets.keywordStrategy.primaryKeyword}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}


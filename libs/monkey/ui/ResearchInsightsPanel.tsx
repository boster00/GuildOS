"use client";

import { useState, useEffect } from "react";

interface ResearchData {
  competitorUrls?: string[];
  commonSections?: string[];
  contentPatterns?: Record<string, string[]>;
  contentSections?: Record<string, {
    examples?: any[];
    commonApproach?: string;
  }>;
  insights?: string[];
  uniqueValueProps?: string[];
  qualitySignals?: string[];
}

interface Idea {
  text: string;
  rationale: string;
  competitorCount: number;
  type: string;
  examples?: any[];
}

interface ResearchInsightsPanelProps {
  research?: ResearchData | null;
  onAddIdea?: (category: string, ideaText: string, sources: string[]) => Promise<void>;
  showAddButton?: boolean;
  className?: string;
  // New props for filtering ideas against article content
  articleHtml?: string;
  icp?: { name?: string; description?: string };
  offer?: { name?: string; description?: string };
}

export default function ResearchInsightsPanel({ 
  research, 
  onAddIdea,
  showAddButton = true,
  className = "",
  articleHtml,
  icp,
  offer,
}: ResearchInsightsPanelProps) {
  const [loadingIdea, setLoadingIdea] = useState<string | null>(null);
  const [hoveredIdea, setHoveredIdea] = useState<number | null>(null);
  const [filteredResearch, setFilteredResearch] = useState<ResearchData | null>(research || null);
  const [isFiltering, setIsFiltering] = useState(false);
  const [isBulkAdding, setIsBulkAdding] = useState(false);
  const [bulkAddProgress, setBulkAddProgress] = useState(0);

  // Filter ideas against article content when research, articleHtml, icp, or offer changes
  useEffect(() => {
    if (research && articleHtml && Object.keys(research).length > 0) {
      setIsFiltering(true);
      filterIdeasAgainstArticle(research, articleHtml, icp, offer)
        .then(filtered => {
          setFilteredResearch(filtered);
          setIsFiltering(false);
        })
        .catch(err => {
          // Fallback to original research if filtering fails
          setFilteredResearch(research);
          setIsFiltering(false);
        });
    } else {
      setFilteredResearch(research || null);
    }
  }, [research, articleHtml, icp, offer]);

  // Filter ideas against article content using review-research API
  const filterIdeasAgainstArticle = async (
    researchData: ResearchData,
    html: string,
    icpData?: { name?: string; description?: string },
    offerData?: { name?: string; description?: string }
  ): Promise<ResearchData> => {
    try {
      const { initMonkey } = await import("@/libs/monkey");
      const monkey = await initMonkey();
      const text = await monkey.apiCall("/api/monkey/landing-page/review-research", {
        researchData,
        articleHtml: html,
        icp: icpData || {},
        offer: offerData || {},
      });
      const result = JSON.parse(text);
      
      if (result.success && result.filteredResearch) {
        return result.filteredResearch;
      } else {
        // Fallback to original research
        return researchData;
      }
    } catch (error) {
      // Fallback to original research
      return researchData;
    }
  };

  const handleAddIdea = async (idea: Idea, sources: string[]) => {
    if (!onAddIdea) return;
    
    setLoadingIdea(idea.text);
    try {
      await onAddIdea("Content Idea", idea.text, sources);
    } finally {
      setLoadingIdea(null);
    }
  };

  const handleAddAllIdeas = async () => {
    if (!onAddIdea || isBulkAdding) return;
    
    setIsBulkAdding(true);
    setBulkAddProgress(0);
    
    try {
      const ideasToAdd = allIdeas;
      
      for (let i = 0; i < ideasToAdd.length; i++) {
        const idea = ideasToAdd[i];
        try {
          await onAddIdea("Content Idea", idea.text, competitorUrls);
          setBulkAddProgress(((i + 1) / ideasToAdd.length) * 100);
        } catch (error) {
          // Continue with next idea even if one fails
        }
      }
    } finally {
      setIsBulkAdding(false);
      setBulkAddProgress(0);
    }
  };

  // Use filtered research if available, otherwise use original research
  const researchToUse = filteredResearch || research;

  if (!researchToUse || Object.keys(researchToUse).length === 0) {
    return (
      <div className={`card bg-base-200 shadow-xl ${className}`}>
        <div className="card-body">
          <h3 className="card-title text-sm">💡 Research Insights</h3>
          <p className="text-sm text-base-content/60">
            No research data available. Run with Deep Research or Open Agent mode to see competitor insights.
          </p>
        </div>
      </div>
    );
  }

  const { 
    competitorUrls = [], 
    commonSections = [], 
    contentPatterns = {}, 
    contentSections = {}, 
    insights = [], 
    uniqueValueProps = [], 
    qualitySignals = [] 
  } = researchToUse;

  // Flatten all ideas into a single list with context
  const allIdeas: Idea[] = [];

  // Add common sections
  commonSections.forEach(section => {
    allIdeas.push({
      text: section,
      rationale: "Common section found across competitor pages",
      competitorCount: competitorUrls.length,
      type: "section"
    });
  });

  // Add content sections (new format with full examples)
  Object.entries(contentSections).forEach(([sectionName, sectionData]) => {
    if (sectionData?.examples && sectionData.examples.length > 0) {
      // Use the section name as the idea, with examples in rationale
      const exampleCount = sectionData.examples.length;
      allIdeas.push({
        text: sectionName,
        rationale: `Full section content found in ${exampleCount} competitor${exampleCount > 1 ? 's' : ''}. ${sectionData.commonApproach || ''}`,
        competitorCount: exampleCount,
        type: "content_section",
        examples: sectionData.examples
      });
    }
  });

  // Add content patterns (backward compatibility with old format)
  Object.entries(contentPatterns).forEach(([category, patterns]) => {
    // Only add if not already in contentSections
    if (!contentSections[category]) {
      patterns.forEach(pattern => {
        allIdeas.push({
          text: pattern,
          rationale: `Content approach used in "${category}" sections`,
          competitorCount: competitorUrls.length,
          type: "pattern"
        });
      });
    }
  });

  // Add insights
  insights.forEach(insight => {
    // Extract percentage if present
    const percentMatch = insight.match(/(\d+)%/);
    const count = percentMatch ? Math.round((parseInt(percentMatch[1]) / 100) * competitorUrls.length) : competitorUrls.length;
    
    allIdeas.push({
      text: insight,
      rationale: "Key insight from competitive analysis",
      competitorCount: count,
      type: "insight"
    });
  });

  // Add unique value props
  uniqueValueProps.forEach(prop => {
    allIdeas.push({
      text: prop,
      rationale: "Unique value proposition to differentiate your offer",
      competitorCount: competitorUrls.length,
      type: "value_prop"
    });
  });

  // Add quality signals
  qualitySignals.forEach(signal => {
    allIdeas.push({
      text: signal,
      rationale: "Quality signal that builds trust",
      competitorCount: competitorUrls.length,
      type: "quality"
    });
  });

  return (
    <>
      <div className={`card bg-base-100 shadow-xl sticky top-4 ${className}`}>
        <div className="card-body p-4 max-h-[calc(100vh-8rem)] overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h3 className="card-title text-base">💡 Research Insights</h3>
            <div className="flex items-center gap-2">
              {isFiltering && (
                <span className="loading loading-spinner loading-xs"></span>
              )}
              <span className="badge badge-sm badge-primary">{allIdeas.length} ideas</span>
            </div>
          </div>

          {/* Add All Ideas Button */}
          {showAddButton && onAddIdea && allIdeas.length > 0 && (
            <div className="mb-4">
              <button
                onClick={handleAddAllIdeas}
                disabled={isBulkAdding || isFiltering}
                className="btn btn-sm btn-outline btn-primary w-full"
              >
                {isBulkAdding ? (
                  <>
                    <span className="loading loading-spinner loading-xs"></span>
                    Adding... {Math.round(bulkAddProgress)}%
                  </>
                ) : (
                  `Add All Ideas (${allIdeas.length})`
                )}
              </button>
            </div>
          )}

        {/* Competitor Sources Summary */}
        {competitorUrls.length > 0 && (
          <div className="mb-4 p-3 bg-base-200 rounded-lg">
            <p className="text-xs font-semibold mb-2">📚 Analyzed {competitorUrls.length} competitor{competitorUrls.length > 1 ? 's' : ''}:</p>
            <div className="space-y-1">
              {competitorUrls.map((url, idx) => {
                try {
                  const hostname = new URL(url).hostname;
                  return (
                    <a 
                      key={idx} 
                      href={url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline block truncate"
                      title={url}
                    >
                      {hostname}
                    </a>
                  );
                } catch {
                  return (
                    <span key={idx} className="text-xs text-base-content/60 block truncate" title={url}>
                      {url}
                    </span>
                  );
                }
              })}
            </div>
          </div>
        )}

        {/* Flat list of all ideas */}
        <div className="space-y-3">
          {allIdeas.map((idea, idx) => (
            <div 
              key={idx} 
              className="border border-base-300 rounded-lg p-3 hover:border-primary transition-colors relative"
              onMouseEnter={() => setHoveredIdea(idx)}
              onMouseLeave={() => setHoveredIdea(null)}
            >
              {/* Competitor count badge */}
              <div className="absolute top-2 right-2">
                <div 
                  className="badge badge-sm badge-ghost cursor-help"
                  title={`Found in ${idea.competitorCount} of ${competitorUrls.length} competitors:\n${competitorUrls.slice(0, idea.competitorCount).map(url => {
                    try {
                      return new URL(url).hostname;
                    } catch {
                      return url;
                    }
                  }).join('\n')}`}
                >
                  {idea.competitorCount}/{competitorUrls.length || 1}
                </div>
              </div>

              {/* Idea text */}
              <p className="text-sm font-medium mb-2 pr-16">{idea.text}</p>
              
              {/* Rationale */}
              <p className="text-xs text-base-content/60 mb-3">{idea.rationale}</p>

              {/* Add button - only show if enabled and handler provided */}
              {showAddButton && onAddIdea && (
                <button
                  onClick={() => handleAddIdea(idea, competitorUrls)}
                  className="btn btn-xs btn-primary w-full"
                  disabled={loadingIdea === idea.text}
                >
                  {loadingIdea === idea.text ? (
                    <span className="loading loading-spinner loading-xs"></span>
                  ) : (
                    "Add to content ideas"
                  )}
                </button>
              )}

              {/* Competitor list on hover */}
              {hoveredIdea === idx && competitorUrls.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-2 p-3 bg-base-100 border border-primary rounded-lg shadow-lg z-10 text-xs">
                  <p className="font-semibold mb-1">Found in:</p>
                  <ul className="space-y-1">
                    {competitorUrls.slice(0, idea.competitorCount).map((url, urlIdx) => {
                      try {
                        const hostname = new URL(url).hostname;
                        return (
                          <li key={urlIdx}>
                            <a 
                              href={url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-primary hover:underline"
                            >
                              {hostname}
                            </a>
                          </li>
                        );
                      } catch {
                        return (
                          <li key={urlIdx}>
                            <span className="text-primary">{url}</span>
                          </li>
                        );
                      }
                    })}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>

        {allIdeas.length === 0 && (
          <div className="text-center py-8 text-base-content/60">
            <p className="text-sm">No content ideas found in research.</p>
          </div>
        )}
        </div>
      </div>
    </>
  );
}

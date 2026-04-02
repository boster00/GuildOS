"use client";

import React, { useState, useMemo } from "react";
import { X, Sparkles, Lightbulb } from "lucide-react";
import { useContentIdeasLab } from "../context/ContentIdeasLabContext";

const STRATEGIES = [
  { id: "deep_dive", label: "Deep Dive on Key Concepts", description: "Explore key concepts from your main page in detail" },
  { id: "troubleshooting", label: "Troubleshooting / Problems", description: "Address common problems and pain points" },
  { id: "comparisons", label: "Comparisons & Alternatives", description: "Compare options, alternatives, or approaches" },
  { id: "use_cases", label: "Use Cases & Case Stories", description: "Show real-world applications and scenarios" },
  { id: "checklists", label: "Checklists & Readiness", description: "Provide actionable checklists and readiness guides" },
  { id: "faq", label: "FAQ & Objections", description: "Answer common questions and address objections" },
];

// Prompt templates for each strategy
const STRATEGY_PROMPT_TEMPLATES = {
  deep_dive: `
Generate satellite ideas that go much deeper on important concepts, steps, or methods mentioned in the main page. 
Focus on topics where a serious reader would want a detailed explanation, framework, or walkthrough, and that naturally
link back to the sections where those concepts are first introduced.
`,

  troubleshooting: `
Generate satellite ideas that focus on common problems, failure modes, and “why isn’t this working?” situations related to the main outcome. 
Think like a practitioner whose experiment, campaign, or process is going wrong and wants help diagnosing and fixing it, then link naturally
back to the main page where your approach or service addresses those issues.
`,

  comparisons: `
Generate satellite ideas that help readers choose between realistic options, approaches, or vendors in this space. 
Focus on the actual tradeoffs your ICP would weigh (cost, risk, speed, internal effort, expertise) and make sure each idea
sets up a clear comparison that can point back to the main page as one of the recommended paths.
`,

  use_cases: `
Generate satellite ideas that show concrete use cases and real-world scenarios where this solution is applied. 
Think in terms of specific ICP types, targets, or situations, and frame each idea so readers can easily see “this looks like us” 
and click through to the main page to learn how to do something similar.
`,

  checklists: `
Generate satellite ideas that take the form of checklists, readiness guides, or "before you start" planning articles. 
Focus on the practical decisions, resources, and conditions someone should have in place before committing to the main solution,
and make each idea a natural pre-step that can send readers back to the main page when they're ready.

IMPORTANT: For checklist strategy ideas, titles MUST be in checklist/listicle format:
- Include words like "List", "Guide", "Checklist", "Steps", "Tips", or similar in the title, OR
- Use listicle format like "10 [Things] for [Audience]", "5 [Items] to [Action]", "7 [Elements] of [Topic]", etc.
Examples: "10 Essential Checklist Items for [Topic]", "5-Step Guide to [Action]", "7 Things to Consider Before [Decision]"
`,

  faq: `
Generate satellite ideas that cluster important questions, doubts, and objections your ICP has about this outcome or solution type. 
Think of what comes up repeatedly in sales calls or internal discussions, and group related questions into article ideas that 
reassure readers and give them a reason to move from information to the main page and take action.
`
};

// Main prompt template that wraps user input with context and response format
const MAIN_PROMPT_TEMPLATE = `Campaign Context:
- ICP: {{icpName}}
- Offer: {{offerName}}
- Outcome: {{outcome}}
- Promise: {{peaceOfMind}}

Main Page (the article these satellites should support):
- Location: {{mainPageLabel}}
- Title: {{mainPageTitle}}

Main Page Full Content (read this carefully to understand what the article covers):
{{mainPageContent}}

Selected Strategy: {{strategyLabel}}

BEGIN USER PROMPT
{{userPrompt}}
END USER PROMPT

Your task:
Brainstorm 8–12 satellite article IDEAS (not full articles) that would naturally support this main page and help the campaign draw qualified search traffic.

CRITICAL LINKING REQUIREMENTS:
- Each satellite idea MUST be linkable to and from the main article above.
- The target keyword for each idea should either:
  1. Already be mentioned in the main article content (preferred), OR
  2. Be a natural extension of a concept/topic that exists in the main article and can be inserted into an existing section
- When proposing keywords, identify WHERE in the main article they could be linked from (e.g., "Section 3 on X topic" or "the paragraph discussing Y").
- The satellite articles should expand on concepts, terms, or topics that are introduced but not fully explored in the main article.

Rules for titles and keywords:
- Each idea must have ONE primary target keyword in plain language, like a real Google search.
- Keywords should be short phrases or questions (about 2–6 words), not keyword stuffing.
- Titles should be clear, specific, and human-readable (roughly 6–12 words), not vague slogans or clickbait.
- Do NOT write article copy or outlines. Only propose ideas.

OUTPUT FORMAT (STRICT):
Return your response as a JSON array of objects. Each object must have:
- title: string (working title for the article)
- keyword: string (primary target keyword phrase a human would search)
- strategy: string (the strategy type: "deep_dive", "troubleshooting", "comparisons", "use_cases", "checklists", or "faq")
- whyItMatters: string (one sentence explaining why this topic matters for the ICP)
- linkableFrom: string (brief description of where in the main article this keyword/topic appears or could be naturally inserted, e.g., "Section discussing X mentions Y" or "The paragraph about Z could link to this")

Example:
[
  {
    "title": "Example Working Title for the Article",
    "keyword": "example keyword phrase",
    "strategy": "comparisons",
    "whyItMatters": "Helps customers evaluate options before committing",
    "linkableFrom": "Section 3 on evaluation criteria mentions this concept"
  },
  ...
]
`;

export default function CampaignContentIdeasLab({ 
  campaign,
  onUseTitle,
  onClose,
  onArticleCreated
}) {
  const [selectedMainPage, setSelectedMainPage] = useState(null);
  const [promptTemplate, setPromptTemplate] = useState("");
  const [selectedStrategy, setSelectedStrategy] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedIdeaId, setSelectedIdeaId] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  
  // Use shared state from context
  const {
    generatedIdeas,
    setGeneratedIdeas,
  } = useContentIdeasLab();

  // Get available main pages from campaign
  const mainPages = useMemo(() => {
    const pages = [];
    const metadata = campaign?.articleMetadata || [];
    
    const phase1 = metadata.find(a => a.campaign_phase === 1);
    if (phase1) {
      pages.push({ phase: 1, title: phase1.title, label: "Phase 1 – Landing page", key: "phase1" });
    }
    
    const phase2 = metadata.find(a => a.campaign_phase === 2);
    if (phase2) {
      pages.push({ phase: 2, title: phase2.title, label: "Phase 2 – Decision guide", key: "phase2" });
    }
    
    const phase3 = metadata.find(a => a.campaign_phase === 3);
    if (phase3) {
      pages.push({ phase: 3, title: phase3.title, label: "Phase 3 – Pillar page", key: "phase3" });
    }
    
    return pages;
  }, [campaign]);

  // Initialize selected main page
  React.useEffect(() => {
    if (mainPages.length > 0 && !selectedMainPage) {
      const firstPage = mainPages[0].key;
      setSelectedMainPage(firstPage);
    }
  }, [mainPages, selectedMainPage]);

  const handleMainPageChange = (value) => {
    setSelectedMainPage(value);
    // Main page selection doesn't affect prompt template anymore
    // Only strategy selection updates the prompt template
  };

  const handleStrategyChange = (strategyId) => {
    setSelectedStrategy(strategyId);
    if (strategyId === "custom") {
      // Clear prompt template for custom input
      setPromptTemplate("");
    } else if (strategyId && STRATEGY_PROMPT_TEMPLATES[strategyId]) {
      // Set prompt template from strategy
      setPromptTemplate(STRATEGY_PROMPT_TEMPLATES[strategyId]);
    } else if (!strategyId) {
      // If strategy is cleared, clear the prompt template
      setPromptTemplate("");
    }
  };

  const handleGenerateIdeas = async () => {
    if (!promptTemplate.trim()) {
      alert("Please provide a prompt template");
      return;
    }

    setIsGenerating(true);
    try {
      // Get selected main page info
      const mainPage = mainPages.find(p => p.key === selectedMainPage);
      const mainPageLabel = mainPage?.label || 'Not selected';
      const mainPageTitle = mainPage?.title ? `Title: ${mainPage.title}` : '';
      
      // Get main page content from article metadata
      const mainPageArticle = campaign?.articleMetadata?.find(a => {
        if (selectedMainPage === 'phase1') return a.campaign_phase === 1;
        if (selectedMainPage === 'phase2') return a.campaign_phase === 2;
        if (selectedMainPage === 'phase3') return a.campaign_phase === 3;
        return false;
      });
      // Extract full text content (remove HTML tags, but keep all text)
      const mainPageContent = mainPageArticle?.content_html 
        ? mainPageArticle.content_html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() // Extract full text, normalize whitespace
        : 'Not available';
      
      // Get selected strategy info
      const strategy = STRATEGIES.find(s => s.id === selectedStrategy);
      const strategyLabel = strategy?.label || 'Not selected';
      const strategyIds = STRATEGIES.map(s => s.id).join(', ');

      // Build full prompt using template
      const fullPrompt = MAIN_PROMPT_TEMPLATE
        .replace('{{icpName}}', campaign?.icp?.name || 'Not set')
        .replace('{{offerName}}', campaign?.offer?.name || 'Not set')
        .replace('{{outcome}}', campaign?.outcome || 'Not set')
        .replace('{{peaceOfMind}}', campaign?.peace_of_mind || 'Not set')
        .replace('{{mainPageLabel}}', mainPageLabel)
        .replace('{{mainPageTitle}}', mainPageTitle)
        .replace('{{mainPageContent}}', mainPageContent)
        .replace('{{strategyLabel}}', strategyLabel)
        .replace('{{userPrompt}}', promptTemplate)
        .replace('{{strategyIds}}', strategyIds);

      // Log the full prompt for debugging

      

      

      // Call API to generate ideas
      const { initMonkey } = await import('@/libs/monkey');
      const monkey = await initMonkey();
      const text = await monkey.apiCall('/api/campaigns/content-ideas/generate', { fullPrompt });
      const data = JSON.parse(text);
      if (data.error) throw new Error(data.error || 'Failed to generate ideas');
      const ideas = data.ideas || [];

      // Enrich ideas with creative briefs if not provided by AI
      const enrichedIdeas = ideas.map(idea => {
        // If AI didn't provide creative brief, create one
        if (!idea.creativeBrief) {
          const strategyObj = STRATEGIES.find(s => s.id === idea.strategy || s.id === selectedStrategy);
          const linkableFrom = idea.linkableFrom || `Main article: ${mainPages.find(p => p.key === selectedMainPage)?.title || ''}`;
          idea.creativeBrief = {
            targetReader: `${campaign?.icp?.name || 'Target audience'} looking for ${idea.keyword}`,
            searchIntent: "Informational - seeking solutions",
            strategyType: strategyObj?.label || idea.strategy || 'Not specified',
            internalLinks: {
              linkFrom: `${mainPages.find(p => p.key === selectedMainPage)?.label || 'Main page'}: ${mainPages.find(p => p.key === selectedMainPage)?.title || ''} - ${linkableFrom}`,
              linkTo: "Phase 1 landing page"
            }
          };
        } else {
          // Update existing creative brief with linkableFrom if available
          if (idea.linkableFrom && idea.creativeBrief?.internalLinks) {
            idea.creativeBrief.internalLinks.linkFrom = `${mainPages.find(p => p.key === selectedMainPage)?.label || 'Main page'}: ${mainPages.find(p => p.key === selectedMainPage)?.title || ''} - ${idea.linkableFrom}`;
          }
        }
        return idea;
      });

      setGeneratedIdeas(enrichedIdeas);
      setIsGenerating(false);
    } catch (error) {

      alert(`Failed to generate ideas: ${error.message || 'Unknown error'}`);
      setIsGenerating(false);
    }
  };

  const handleIdeaSelect = (ideaId) => {
    setSelectedIdeaId(ideaId);
  };

  const handleCreateArticleDraft = async () => {
    if (!selectedIdeaId) {
      alert("Please select an idea first");
      return;
    }

    const selectedIdea = generatedIdeas.find(idea => idea.id === selectedIdeaId);
    if (!selectedIdea) {
      alert("Selected idea not found");
      return;
    }

    if (!campaign?.id) {
      alert("Campaign ID is missing");
      return;
    }

    setIsCreating(true);
    try {
      const { initMonkey } = await import('@/libs/monkey');
      const monkey = await initMonkey();
      const text = await monkey.apiCall('/api/campaigns/content-ideas/create-article', {
        campaignId: campaign.id,
        idea: selectedIdea,
      });
      const data = JSON.parse(text);
      if (data.error) throw new Error(data.error || 'Failed to create article');
      
      // Open new window to content magic editing URL
      const articleUrl = `/content-magic/${data.articleId}`;
      window.open(articleUrl, '_blank');
      
      // Refresh article listing if callback provided
      if (onArticleCreated) {
        onArticleCreated();
      }
      
      // Note: Content Ideas Lab stays open - do not call onClose()
    } catch (error) {

      alert(`Failed to create article: ${error.message || 'Unknown error'}`);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-gray-900">Content Ideas Lab</h3>
          <p className="text-xs text-gray-600">Brainstorm satellite article ideas</p>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-100 rounded transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Step 1: Main Page Selection */}
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            For which page?
          </label>
          <select
            value={selectedMainPage || ""}
            onChange={(e) => handleMainPageChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            {mainPages.map(page => (
              <option key={page.key} value={page.key}>
                {page.label}: {page.title}
              </option>
            ))}
          </select>
        </div>

        {/* Strategy Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Pick a strategy
          </label>
          <select
            value={selectedStrategy || ""}
            onChange={(e) => handleStrategyChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="">Select a strategy...</option>
            {STRATEGIES.map(strategy => (
              <option key={strategy.id} value={strategy.id}>
                {strategy.label}
              </option>
            ))}
            <option value="custom">Use my own prompt</option>
          </select>
        </div>

        {/* Prompt Template */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Prompt for content idea
          </label>
          <textarea
            value={promptTemplate}
            onChange={(e) => setPromptTemplate(e.target.value)}
            placeholder="Enter your prompt template here..."
            className="w-full h-32 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono"
          />
          <button
            onClick={handleGenerateIdeas}
            disabled={isGenerating || !promptTemplate.trim()}
            className="mt-2 w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
          >
            {isGenerating ? (
              <>
                <Sparkles className="w-4 h-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Lightbulb className="w-4 h-4" />
                Generate Ideas
              </>
            )}
          </button>
        </div>
      </div>

      {/* Step 2: Generated Ideas */}
      {generatedIdeas.length > 0 && !isGenerating && (
        <div className="space-y-3 border-t pt-4">
          <div className="text-sm font-medium text-gray-900">Select an Idea to Create Article</div>
          <div className="max-h-64 overflow-y-auto space-y-2 border rounded-lg p-2">
            {generatedIdeas.map(idea => (
              <label
                key={idea.id}
                className={`flex items-start gap-2 p-2 border rounded cursor-pointer hover:bg-gray-50 text-xs ${
                  selectedIdeaId === idea.id ? 'bg-purple-50 border-purple-300' : ''
                }`}
              >
                <input
                  type="radio"
                  name="idea-selection"
                  checked={selectedIdeaId === idea.id}
                  onChange={() => handleIdeaSelect(idea.id)}
                  className="mt-1"
                />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900">{idea.title}</div>
                  <div className="text-gray-600 mt-1">
                    <span className="font-medium">Keyword:</span> {idea.keyword}
                  </div>
                  {idea.linkableFrom && (
                    <div className="text-blue-600 mt-1 text-xs">
                      <span className="font-medium">Linkable from:</span> {idea.linkableFrom}
                    </div>
                  )}
                  <div className="text-gray-500 mt-1">{idea.whyItMatters}</div>
                </div>
              </label>
            ))}
          </div>
          {selectedIdeaId && (
            <button
              onClick={handleCreateArticleDraft}
              disabled={isCreating}
              className="w-full px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isCreating ? (
                <>
                  <Sparkles className="w-4 h-4 animate-spin" />
                  Creating Article...
                </>
              ) : (
                <>
                  <Lightbulb className="w-4 h-4" />
                  Create Article Draft
                </>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

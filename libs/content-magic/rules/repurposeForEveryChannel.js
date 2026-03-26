"use client";
import React, { useState } from "react";
import { FileDown, Loader, Download, Copy, ChevronDown, ChevronUp, X } from "lucide-react";
import { useWritingGuide } from "@/libs/content-magic/context/WritingGuideContext";
import CreditCostBadge from "@/components/CreditCostBadge";

const repurposeForEveryChannel = {
  key: "repurpose_for_every_channel",
  pageType: ["all"],
  meta: {
    label: "Repurpose for Distribution",
    category: "launch",
    description: "Transform your article into distributable formats for social media, email, ads, and more.",
    defaultActive: true,
    tutorialTitle: "CJGEO Tutorial 9: Maximizing Content Distribution with Repurpose Tools 🚀",
    tutorialURL: "https://www.loom.com/share/1a0aad30480e42bf94b49047ad8e299b",
  },
  DetailsUIDisplayMode: "fullscreen",

  is_complete: (context) => {
    const completedSteps = context.assets?.completed_steps || [];
    return completedSteps.includes("repurpose_for_every_channel");
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
            title="Repurpose for channels"
          >
            <FileDown className="w-4 h-4" />
          </button>
        </div>
      );
    },

    DetailedUI: ({ rule, context, onUpdate }) => {
      const { updateArticle, getEditorHtml } = useWritingGuide();
      
      // Main state
      const [selectedFormatId, setSelectedFormatId] = useState(null);
      const [loading, setLoading] = useState(false);
      const [error, setError] = useState(null);
      
      // Shared context controls
      const [sharedContext, setSharedContext] = useState({
        audience: "B2B – technical & business decision makers",
        tone: "Neutral",
        goal: "Awareness",
      });
      
      // Format-specific options
      const [formatOptions, setFormatOptions] = useState({});
      
      // Outputs: map of formatId -> { generatedAt, content, rawText }
      const [outputs, setOutputs] = useState(
        context.assets?.launch?.repurposeOutputs || {}
      );
      
      // Feedback per format
      const [feedback, setFeedback] = useState(
        context.assets?.launch?.repurposeFeedback || {}
      );
      
      // Best practices expanded state
      const [expandedBestPractices, setExpandedBestPractices] = useState({});

      // Media formats configuration - MVP: Keep only 3 channels
      const MEDIA_FORMATS = [
        { 
          id: "social_posts", 
          label: "Social Media Posts", 
          icon: "📱", 
          description: "LinkedIn, X, Facebook posts",
          experimental: false,
        },
        { 
          id: "cold_email", 
          label: "Cold Email / Newsletter", 
          icon: "📧", 
          description: "Cold email or newsletter template",
          experimental: false,
        },
        { 
          id: "search_ads", 
          label: "Search Ads Copy", 
          icon: "🔍", 
          description: "Google Ads, Bing Ads copy",
          experimental: false,
        },
      ];

      // Initialize format options with defaults
      const getDefaultFormatOptions = (formatId) => {
        if (formatOptions[formatId]) return formatOptions[formatId];
        
        const defaults = {
          social_posts: {
            platforms: ["LinkedIn", "X", "Facebook"],
            numVariations: 1,
            emphasizeKeyInsight: true,
            emphasizeProblemSolution: false,
            emphasizeStory: false,
            customCTA: "",
          },
          cold_email: {
            mode: "cold",
            audienceSegment: "",
            painPoint: "Data reliability / reproducibility",
            ctaType: "Ask a diagnostic question",
            emailStyle: "Problem-led",
            generateABSubjects: true,
          },
          search_ads: {
            keywordTheme: "",
            intent: "Informational",
            numAds: 3,
          },
        };
        
        return defaults[formatId] || {};
      };

      // Best practices content for each format
      const getBestPractices = (formatId) => {
        const practices = {
          social_posts: {
            title: "Social Media Posts",
            tagline: "Amplify your article across multiple social channels",
            whenToUse: "Use social posts to drive top-of-funnel traffic and test different messaging angles.",
            bestPractices: [
              "Start with a strong hook in the first line to stop scrolling",
              "Use short paragraphs, line breaks, and bullet-like formatting for scannability",
              "Focus each post on one core idea or benefit from the article",
              "Include 1 clear CTA, not multiple competing asks",
              "Use relevant but minimal hashtags (2–5 on LinkedIn/X, fewer on Facebook)",
              "For LinkedIn: slightly longer, expert tone, and sometimes ask a question to spark comments",
              "For X: shorter, punchier variants; consider a version focused mostly on the hook + CTA",
            ],
            whyItMatters: [
              "Quickly amplifies your main article across multiple social channels",
              "Drives top-of-funnel traffic and brand impressions",
              "Helps you test different angles (problem vs. outcome vs. story) to see what resonates",
            ],
          },
          cold_email: {
            title: "Cold Email / Newsletter",
            tagline: "High-reply cold email optimized for response rate",
            whenToUse: "Use when you need replies, not impressions. Optimize for specific operational pain, not brand awareness.",
            bestPractices: [
              "Hard cap: 120 words maximum — every word must justify itself",
              "Open with a specific, recognizable friction they've experienced (not generic pain)",
              "Use insider language that proves you understand their workflow",
              "One core idea only — multi-threading kills reply rates",
              "CTA must be low-friction: ask a question, offer a checklist, or seek permission to share info",
              "Never default to 'schedule a call' — that's the final step, not the first ask",
              "Ban marketing adjectives: 'cutting-edge', 'world-class', 'innovative', 'industry-leading'",
              "No feature lists or credential dumps — focus on removing a specific friction",
              "For newsletters: Lead with operational impact, not inspiration",
              "For newsletters: Use problem → insight → next step structure (skip the fluff)",
            ],
            whyItMatters: [
              "Cold emails succeed because of structural discipline, not writing quality",
              "Reply probability peaks at 75-125 words with a single, clear focus",
              "Specific pain + low-ask CTA outperforms generic value propositions by 3-5x",
              "Insider language signals credibility faster than credentials or case studies",
            ],
            implementationTip: "Structure: (1) Name a concrete friction in 1-2 lines, (2) One sentence on how it's typically handled poorly, (3) One sentence on how you remove that friction (no adjectives), (4) Low-friction CTA matched to their buying stage.",
          },
          search_ads: {
            title: "Search Ads Copy",
            tagline: "Convert content into high-intent paid traffic",
            whenToUse: "Use search ads to turn your content into paid traffic assets for users already searching for your topic.",
            bestPractices: [
              "Headlines should be clear, benefit-driven, and ≤ ~30 characters where possible",
              "Descriptions should be concise, with a strong CTA, around up to ~90 characters per line",
              "Include keywords naturally in at least one headline and description",
              "Use path fields to reinforce relevance (e.g., '/antibody-validation/zebrafish')",
              "Consider multiple angles: problem-focused, benefit-focused, proof-focused",
            ],
            whyItMatters: [
              "Easy way to turn content into high-intent paid traffic assets",
              "Helps align search queries, landing pages, and article content",
            ],
          },
        };
        
        return practices[formatId] || {};
      };

      // Handle format selection
      const handleFormatSelect = (formatId) => {
        setSelectedFormatId(formatId);
        setError(null);
        // Initialize options if not set
        if (!formatOptions[formatId]) {
          setFormatOptions(prev => ({
            ...prev,
            [formatId]: getDefaultFormatOptions(formatId),
          }));
        }
      };

      // Handle generation
      const handleGenerate = async (formatId) => {
        setLoading(true);
        setError(null);

        try {
          const articleContent = getEditorHtml() || context.content_html || "";
          const articleTitle = context.title || "";

          const options = formatOptions[formatId] || getDefaultFormatOptions(formatId);

          const { initMonkey } = await import("@/libs/monkey");
          const monkey = await initMonkey();
          const text = await monkey.apiCall("/api/content-magic/repurpose-content/generate", {
            articleId: context.id,
            format: formatId,
            articleTitle,
            articleContent,
            context: sharedContext,
            options,
          });
          const data = JSON.parse(text);
          if (data.error) throw new Error(data.error || "Failed to generate content");
          const { content } = data;
          
          // Save output
          const newOutputs = {
            ...outputs,
            [formatId]: {
              generatedAt: new Date().toISOString(),
              content,
            },
          };
          setOutputs(newOutputs);
          
          // Persist to article assets
          const currentAssets = context.assets || {};
          updateArticle({
            assets: {
              ...currentAssets,
              launch: {
                ...(currentAssets.launch || {}),
                repurposeOutputs: newOutputs,
              },
            },
          });
        } catch (err) {
          setError(err.message);
        } finally {
          setLoading(false);
        }
      };

      // Handle regeneration with feedback
      const handleRegenerateWithFeedback = async (formatId) => {
        if (!feedback[formatId] || !feedback[formatId].trim()) {
          setError("Please provide feedback before regenerating");
          return;
        }

        setLoading(true);
        setError(null);

        try {
          const articleContent = getEditorHtml() || context.content_html || "";
          const articleTitle = context.title || "";
          const options = formatOptions[formatId] || getDefaultFormatOptions(formatId);
          const previousOutput = outputs[formatId];

          const { initMonkey } = await import("@/libs/monkey");
          const monkey = await initMonkey();
          const text = await monkey.apiCall("/api/content-magic/repurpose-content/generate", {
            articleId: context.id,
            format: formatId,
            articleTitle,
            articleContent,
            context: sharedContext,
            options,
            feedback: feedback[formatId],
            previousOutput: previousOutput?.content,
          });
          const data = JSON.parse(text);
          if (data.error) throw new Error(data.error || "Failed to regenerate content");

          const { content } = data;

          const newOutputs = {
            ...outputs,
            [formatId]: {
              generatedAt: new Date().toISOString(),
              content,
            },
          };
          setOutputs(newOutputs);
          
          const currentAssets = context.assets || {};
          updateArticle({
            assets: {
              ...currentAssets,
              launch: {
                ...(currentAssets.launch || {}),
                repurposeOutputs: newOutputs,
              },
            },
          });
        } catch (err) {
          setError(err.message);
        } finally {
          setLoading(false);
        }
      };

      // Handle clear output
      const handleClearOutput = (formatId) => {
        const newOutputs = { ...outputs };
        delete newOutputs[formatId];
        setOutputs(newOutputs);
        
        const newFeedback = { ...feedback };
        delete newFeedback[formatId];
        setFeedback(newFeedback);
        
        const currentAssets = context.assets || {};
        updateArticle({
          assets: {
            ...currentAssets,
            launch: {
              ...(currentAssets.launch || {}),
              repurposeOutputs: newOutputs,
              repurposeFeedback: newFeedback,
            },
          },
        });
      };

      // Handle copy
      const handleCopy = (text) => {
        navigator.clipboard.writeText(text);
      };

      // Feedback Section Component
      const FeedbackSection = ({ formatId }) => {
        const currentFeedback = feedback[formatId] || "";
        
        const handleKeyDown = (e) => {
          // Prevent form submission on Enter, but allow Shift+Enter for new lines
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            // Optionally trigger the regenerate action on Enter
            // Uncomment the line below if you want Enter to submit
            // if (currentFeedback.trim() && !loading) {
            //   handleRegenerateWithFeedback(formatId);
            // }
          }
        };
        
        return (
          <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Give Feedback to Improve This
            </label>
            <textarea
              value={currentFeedback}
              onChange={(e) => {
                setFeedback(prev => ({
                  ...prev,
                  [formatId]: e.target.value,
                }));
              }}
              onKeyDown={handleKeyDown}
              placeholder="Describe what to change (tone, length, focus, examples, etc.), and we'll regenerate."
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              rows={3}
            />
            <button
              onClick={() => handleRegenerateWithFeedback(formatId)}
              disabled={loading || !currentFeedback.trim()}
              type="button"
              className="mt-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm inline-flex items-center gap-2"
            >
              Apply Feedback & Regenerate
              <CreditCostBadge path="/api/content-magic/repurpose-content/generate" size="sm" />
            </button>
          </div>
        );
      };

      // Render format-specific configuration UI
      const renderFormatConfig = (formatId) => {
        const options = formatOptions[formatId] || getDefaultFormatOptions(formatId);
        const setOption = (key, value) => {
          setFormatOptions(prev => ({
            ...prev,
            [formatId]: {
              ...(prev[formatId] || getDefaultFormatOptions(formatId)),
              [key]: value,
            },
          }));
        };

        switch (formatId) {
          case "social_posts":
      return (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Platforms
                  </label>
                  <div className="space-y-2">
                    {["LinkedIn", "X", "Facebook"].map(platform => (
                      <label key={platform} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={options.platforms?.includes(platform) || false}
                          onChange={(e) => {
                            const platforms = options.platforms || [];
                            if (e.target.checked) {
                              setOption("platforms", [...platforms, platform]);
                            } else {
                              setOption("platforms", platforms.filter(p => p !== platform));
                            }
                          }}
                          className="mr-2"
                        />
                        <span className="text-sm">{platform}</span>
                      </label>
                    ))}
            </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Number of Variations per Platform
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={options.numVariations || 1}
                    onChange={(e) => setOption("numVariations", parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-1">Each selected platform will get this many variations</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Emphasis
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={options.emphasizeKeyInsight || false}
                        onChange={(e) => setOption("emphasizeKeyInsight", e.target.checked)}
                        className="mr-2"
                      />
                      <span className="text-sm">Emphasize key insight / takeaway</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={options.emphasizeProblemSolution || false}
                        onChange={(e) => setOption("emphasizeProblemSolution", e.target.checked)}
                        className="mr-2"
                      />
                      <span className="text-sm">Emphasize problem–solution</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={options.emphasizeStory || false}
                        onChange={(e) => setOption("emphasizeStory", e.target.checked)}
                        className="mr-2"
                      />
                      <span className="text-sm">Emphasize story / case study</span>
                    </label>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Specific CTA (optional)
                  </label>
                  <input
                    type="text"
                    value={options.customCTA || ""}
                    onChange={(e) => setOption("customCTA", e.target.value)}
                    placeholder="e.g., 'Book a demo', 'Read the full article'"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>
              </div>
            );

          case "cold_email":
            return (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Mode
                  </label>
                  <select
                    value={options.mode || "cold"}
                    onChange={(e) => setOption("mode", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  >
                    <option value="cold">Cold outbound email</option>
                    <option value="newsletter">Newsletter to warm list</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Audience Segment Description
                  </label>
                  <input
                    type="text"
                    value={options.audienceSegment || ""}
                    onChange={(e) => setOption("audienceSegment", e.target.value)}
                    placeholder="e.g., 'Heads of preclinical at mid-size biotechs'"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Primary Pain Point
                  </label>
                  <select
                    value={options.painPoint || "Data reliability / reproducibility"}
                    onChange={(e) => setOption("painPoint", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  >
                    <option value="Data reliability / reproducibility">Data reliability / reproducibility</option>
                    <option value="Assay setup & scope clarity">Assay setup & scope clarity</option>
                    <option value="Turnaround time pressure">Turnaround time pressure</option>
                    <option value="Vendor back-and-forth / rework">Vendor back-and-forth / rework</option>
                    <option value="Verification of CRO expertise">Verification of CRO expertise</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    CTA Type
                  </label>
                  <select
                    value={options.ctaType || "Ask a diagnostic question"}
                    onChange={(e) => setOption("ctaType", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  >
                    <option value="Ask a diagnostic question">Ask a diagnostic question</option>
                    <option value="Offer a checklist / reference">Offer a checklist / reference</option>
                    <option value="Offer to explain a process">Offer to explain a process</option>
                    <option value="Ask permission to share info">Ask permission to share info</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Style
                  </label>
                  <select
                    value={options.emailStyle || "Problem-led"}
                    onChange={(e) => setOption("emailStyle", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  >
                    <option value="Ultra-minimal">Ultra-minimal</option>
                    <option value="Problem-led">Problem-led</option>
                    <option value="Verification / risk-avoidance">Verification / risk-avoidance</option>
                  </select>
                </div>
                <div>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={options.generateABSubjects || false}
                      onChange={(e) => setOption("generateABSubjects", e.target.checked)}
                      className="mr-2"
                    />
                    <span className="text-sm">Generate A/B subject lines</span>
                  </label>
                </div>
              </div>
            );

          case "search_ads":
            return (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Main Keyword Theme
                  </label>
                  <input
                    type="text"
                    value={options.keywordTheme || ""}
                    onChange={(e) => setOption("keywordTheme", e.target.value)}
                    placeholder="e.g., 'antibody validation'"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Intent
                  </label>
                  <select
                    value={options.intent || "Informational"}
                    onChange={(e) => setOption("intent", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  >
                    <option value="Informational">Informational</option>
                    <option value="Commercial investigation">Commercial investigation</option>
                    <option value="Transactional">Transactional</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Number of Ads to Generate
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={options.numAds || 3}
                    onChange={(e) => setOption("numAds", parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>
              </div>
            );

          default:
            return null;
        }
      };

      // Render format-specific output
      const renderFormatOutput = (formatId, output) => {
        if (!output || !output.content) {
          return (
            <div className="text-center py-8 text-gray-500">
              No {MEDIA_FORMATS.find(f => f.id === formatId)?.label || formatId} yet. Click 'Convert from Article' to generate.
            </div>
          );
        }

        const content = output.content;

        switch (formatId) {
          case "social_posts":
            if (!Array.isArray(content.posts)) return null;
            return (
              <div className="space-y-4">
                {content.posts.map((post, idx) => (
                  <div key={idx} className="p-4 bg-white border border-gray-200 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-gray-600">{post.platform}</span>
                        {post.variantNumber && (
                          <span className="text-xs text-gray-500">Variant {post.variantNumber}</span>
                        )}
                      </div>
              <button
                        onClick={() => handleCopy(post.text)}
                        className="p-1 text-gray-600 hover:text-gray-900"
                        title="Copy"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                </div>
                    <div className="text-sm text-gray-800 whitespace-pre-wrap mb-2">
                      {post.text}
                    </div>
                    {post.suggestedHashtags && post.suggestedHashtags.length > 0 && (
                      <div className="mt-2 text-xs text-gray-600">
                        {post.suggestedHashtags.map(tag => `#${tag}`).join(" ")}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            );

          case "cold_email":
            return (
              <div className="space-y-4">
                {content.subjectLines && content.subjectLines.length > 0 && (
                  <div className="p-4 bg-white border border-gray-200 rounded-lg">
                    <div className="text-xs font-medium text-gray-600 mb-2">Subject Lines:</div>
                    <div className="space-y-2">
                      {content.subjectLines.map((subject, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <span className="text-sm text-gray-800">{subject}</span>
                  <button
                            onClick={() => handleCopy(subject)}
                            className="p-1 text-gray-600 hover:text-gray-900"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {content.emails && content.emails.map((email, idx) => (
                  <div key={idx} className="p-4 bg-white border border-gray-200 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-gray-600">
                        Variant {email.variantNumber || idx + 1}
                      </span>
                  <button
                        onClick={() => handleCopy(email.body)}
                        className="p-1 text-gray-600 hover:text-gray-900"
                  >
                        <Copy className="w-4 h-4" />
                  </button>
                </div>
                    <div className="text-sm text-gray-800 whitespace-pre-wrap">
                      {email.body}
              </div>
                  </div>
                ))}
              </div>
            );

          case "search_ads":
            return (
              <div className="space-y-4">
                {content.ads && content.ads.map((ad, idx) => (
                  <div key={idx} className="p-4 bg-white border border-gray-200 rounded-lg">
                    <div className="text-xs font-medium text-gray-600 mb-2">
                      Ad {ad.adNumber || idx + 1}
                    </div>
                    {ad.headlines && ad.headlines.length > 0 && (
                      <div className="mb-3">
                        <div className="text-xs font-medium text-gray-600 mb-1">Headlines:</div>
                        <div className="space-y-1">
                          {ad.headlines.map((headline, hIdx) => (
                            <div key={hIdx} className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
                              <span className="text-gray-800">{headline}</span>
                              <button
                                onClick={() => handleCopy(headline)}
                                className="p-1 text-gray-600 hover:text-gray-900"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {ad.descriptions && ad.descriptions.length > 0 && (
            <div>
                        <div className="text-xs font-medium text-gray-600 mb-1">Descriptions:</div>
                        <div className="space-y-1">
                          {ad.descriptions.map((desc, dIdx) => (
                            <div key={dIdx} className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
                              <span className="text-gray-800">{desc}</span>
                              <button
                                onClick={() => handleCopy(desc)}
                                className="p-1 text-gray-600 hover:text-gray-900"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {ad.suggestedPath && (
                      <div className="mt-2 text-xs text-gray-600">
                        Suggested Path: {ad.suggestedPath}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            );

          default:
            return (
              <div className="p-4 bg-white border border-gray-200 rounded-lg">
                <pre className="text-sm whitespace-pre-wrap text-gray-800">
                  {JSON.stringify(content, null, 2)}
                </pre>
              </div>
            );
        }
      };

      // Render detail panel for selected format
      const renderDetailPanel = () => {
        if (!selectedFormatId) return null;

        const format = MEDIA_FORMATS.find(f => f.id === selectedFormatId);
                  if (!format) return null;

        const practices = getBestPractices(selectedFormatId);
        const output = outputs[selectedFormatId];
        const isExpanded = expandedBestPractices[selectedFormatId] !== false;

                  return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Panel - Settings */}
            <div className="space-y-6">
              {/* Format Header */}
              <div>
                <h3 className="text-xl font-bold text-gray-900">{practices.title}</h3>
                <p className="text-sm text-gray-600 mt-1">{practices.tagline}</p>
                <p className="text-xs text-gray-500 mt-2">{practices.whenToUse}</p>
              </div>

              {/* Convert Button - Above the fold */}
              <div className="flex gap-2">
                <button
                  onClick={() => handleGenerate(selectedFormatId)}
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <span className="flex items-center justify-center">
                      <Loader className="w-4 h-4 animate-spin mr-2" />
                      Converting...
                    </span>
                  ) : (
                    <>
                      Convert from Article
                      <CreditCostBadge path="/api/content-magic/repurpose-content/generate" size="sm" />
                    </>
                  )}
                </button>
                {output && (
                  <button
                    onClick={() => handleClearOutput(selectedFormatId)}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                  >
                    Clear Output
                  </button>
                )}
              </div>

              {/* Configuration Section */}
              <div className="p-4 bg-white border border-gray-200 rounded-lg">
                <h4 className="text-sm font-semibold text-gray-900 mb-4">Configuration</h4>
                
                {/* Shared Context Controls - Inside Config Panel */}
                <div className="mb-4 pb-4 border-b border-gray-200">
                  <div className="text-xs font-medium text-gray-700 mb-3">Context Settings</div>
                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Audience</label>
                      <select
                        value={sharedContext.audience}
                        onChange={(e) => setSharedContext(prev => ({ ...prev, audience: e.target.value }))}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                      >
                        <option>B2B – technical & business decision makers</option>
                        <option>B2B – marketing & growth teams</option>
                        <option>B2C – general consumers</option>
                        <option>B2C – tech-savvy early adopters</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Tone</label>
                      <select
                        value={sharedContext.tone}
                        onChange={(e) => setSharedContext(prev => ({ ...prev, tone: e.target.value }))}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                      >
                        <option>Neutral</option>
                        <option>Educational</option>
                        <option>Bold</option>
                        <option>Conversational</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Goal</label>
                      <select
                        value={sharedContext.goal}
                        onChange={(e) => setSharedContext(prev => ({ ...prev, goal: e.target.value }))}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                      >
                        <option>Awareness</option>
                        <option>Lead Generation</option>
                        <option>Nurture / Authority</option>
                        <option>Direct Conversion</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Format-Specific Config */}
                {renderFormatConfig(selectedFormatId)}
              </div>

            </div>

            {/* Right Panel - Output */}
            <div className="space-y-6">
              {/* Generated Output */}
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <h4 className="text-sm font-semibold text-gray-900 mb-4">Generated Output</h4>
                {renderFormatOutput(selectedFormatId, output)}
              </div>

              {/* Feedback Section */}
              {output && <FeedbackSection formatId={selectedFormatId} />}

              {/* Resources Section - For formats that need AI tools */}
              {(() => {
                const resourcesByFormat = {
                };

                const resources = resourcesByFormat[selectedFormatId];
                if (!resources) return null;

                return (
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <h4 className="text-sm font-semibold text-gray-900 mb-2">Resources</h4>
                    <p className="text-xs text-gray-700">
                      Recommended AI tools:{" "}
                      {resources.map((resource, idx) => (
                        <span key={idx}>
                          <a
                            href={resource.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-block px-2 py-1 mx-1 mb-1 bg-white border border-gray-300 rounded hover:border-green-400 hover:bg-green-100 transition-colors text-xs font-medium text-gray-900"
                          >
                            {resource.name}
                            {resource.isFree && (
                              <span className="ml-1 text-green-600" title="Free tier available">🆓</span>
                            )}
                          </a>
                          {idx < resources.length - 1 && " "}
                        </span>
                      ))}
                    </p>
                  </div>
                );
              })()}

              {/* Our Recommendations - Combined Best Practices & Tips */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="text-sm font-semibold text-gray-900 mb-3">Our Recommendations</h4>
                <div className="space-y-4">
                  {practices.bestPractices && practices.bestPractices.length > 0 && (
                    <div>
                      <div className="text-xs font-medium text-gray-700 mb-2">Best Practices:</div>
                      <ul className="list-disc list-inside text-xs text-gray-700 space-y-1">
                        {practices.bestPractices.map((practice, idx) => (
                          <li key={idx}>{practice}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {practices.whyItMatters && practices.whyItMatters.length > 0 && (
                    <div>
                      <div className="text-xs font-medium text-gray-700 mb-2">Why It Matters:</div>
                      <ul className="list-disc list-inside text-xs text-gray-700 space-y-1">
                        {practices.whyItMatters.map((reason, idx) => (
                          <li key={idx}>{reason}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {practices.implementationTip && (
                    <div>
                      <div className="text-xs font-medium text-gray-700 mb-2">Implementation:</div>
                      <p className="text-xs text-gray-700">{practices.implementationTip}</p>
                    </div>
                  )}
                  {selectedFormatId === "image_prompts" && (
                    <div>
                      <div className="text-xs font-medium text-gray-700 mb-2">How to Use These Prompts:</div>
                      <ul className="list-disc list-inside text-xs text-gray-700 space-y-1">
                        <li>Copy the chosen prompt(s) into AI image generation tools like <strong>DALL·E</strong> or <strong>Midjourney</strong>, or use design tools like <strong>Canva</strong>.</li>
                        <li>Use <strong>inline images</strong> to break up text in your article and illustrate key concepts.</li>
                        <li>Use <strong>memes</strong> for social media posts to build community and increase shareability.</li>
                        <li>For <strong>infographic</strong> concepts, paste the structure into design tools and build a single, clear graphic around it.</li>
                        <li>For <strong>flyers</strong>, use the prompts to create print-ready designs for events, promotions, or physical distribution.</li>
                        <li>Test different versions (e.g., Meme vs no meme, Inline Image A vs B) and watch metrics like clicks, shares, and time on page.</li>
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
                    </div>
                  );
      };

      return (
        <div className="space-y-6">
          {/* Error Display */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Format Selection: Grid or Icon Row */}
          {!selectedFormatId ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {MEDIA_FORMATS.map((format) => (
                <button
                  key={format.id}
                  onClick={() => handleFormatSelect(format.id)}
                  className={`p-4 border-2 rounded-lg text-left transition-all ${
                    "border-gray-200 hover:border-green-300 hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="text-2xl">{format.icon}</div>
                    {format.experimental && (
                      <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">
                        Experimental
                      </span>
                    )}
                  </div>
                  <div className="font-medium text-sm text-gray-900 mb-1">
                    {format.label}
                  </div>
                  <div className="text-xs text-gray-500">{format.description}</div>
                  {outputs[format.id] && (
                    <div className="mt-2 text-xs text-green-600">✓ Converted</div>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <>
              {/* Icon Row */}
              <div className="flex gap-2 overflow-x-auto pb-2">
                {MEDIA_FORMATS.map((format) => (
                  <button
                    key={format.id}
                    onClick={() => handleFormatSelect(format.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition-all whitespace-nowrap ${
                      selectedFormatId === format.id
                        ? "border-green-500 bg-green-50"
                        : "border-gray-200 hover:border-green-300"
                    }`}
                  >
                    <span className="text-lg">{format.icon}</span>
                    <span className="text-sm font-medium text-gray-900">{format.label}</span>
                    {outputs[format.id] && (
                      <span className="text-xs text-green-600">✓</span>
                    )}
                  </button>
                ))}
              </div>


              {/* Detail Panel */}
              {renderDetailPanel()}
            </>
          )}

          {/* Mark as Complete */}
          {(() => {
            const completedSteps = context.assets?.completed_steps || [];
            const isComplete = completedSteps.includes("repurpose_for_every_channel");
            
            if (isComplete) {
              return (
                <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg text-center">
                  ✓ This step is marked as complete
                </div>
              );
            }
            
            return (
              <button
                onClick={async () => {
                  const currentAssets = context.assets || {};
                  const currentCompletedSteps = currentAssets.completed_steps || [];
                  if (!currentCompletedSteps.includes("repurpose_for_every_channel")) {
                    updateArticle({
                      assets: {
                        ...currentAssets,
                        completed_steps: [...currentCompletedSteps, "repurpose_for_every_channel"],
                      },
                    });
                  }
                }}
                className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Mark as Complete
              </button>
            );
          })()}
        </div>
      );
    },
  },
};

export default repurposeForEveryChannel;

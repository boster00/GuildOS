// ARCHIVED: Original path was app/(private)/agent-playground/page.js

"use client";
// TODO: remove — agent-playground page is obsolete

import { useState } from "react";
import { Loader, ChevronDown, ChevronUp, FileText, Eye, Workflow } from "lucide-react";
import { QuestionnaireForm, ResearchInsightsPanel } from "@/libs/monkey/index";
import LandingPagePipeline from "./components/LandingPagePipeline";
import SectionPreview from "./components/SectionPreview";
import ArticleDisplay from "./components/ArticleDisplay";
import { initMonkey } from "@/libs/monkey";

const DEFAULT_PROMPT = "Create a landing page for IHC/IF service targeting biotech preclinical R&D teams. The service offers fast turnaround (5-10 days) and has 3000+ validated antibodies.";

export default function AgentPlaygroundPage() {
  const [initialPrompt, setInitialPrompt] = useState(DEFAULT_PROMPT);
  const [step, setStep] = useState("initial"); // "initial" | "questions" | "writing" | "complete"
  const [questionnaireData, setQuestionnaireData] = useState(null);
  const [questionnaireAnswers, setQuestionnaireAnswers] = useState(null);
  const [articleResult, setArticleResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showQuestionsDetail, setShowQuestionsDetail] = useState(false);
  const [showLogModal, setShowLogModal] = useState(false);
  const [executionLog, setExecutionLog] = useState([]);
  const [activeTab, setActiveTab] = useState("article"); // "article" | "pipeline"
  const [theme, setTheme] = useState("minimalist"); // "default" | "minimalist"
  const [agentMode, setAgentMode] = useState("deep_research"); // "structured" | "deep_research" | "open"
  const [previewSection, setPreviewSection] = useState(null); // Section being previewed
  const [articleHtml, setArticleHtml] = useState(""); // Editable article HTML
  const [clarificationMode, setClarificationMode] = useState(false); // Whether to ask clarification questions
  const [filteredResearch, setFilteredResearch] = useState(null); // Filtered research data after review
  const [reviewSummary, setReviewSummary] = useState(null); // Review summary stats

  // Mock Step 1 output derived from prompt
  const getStep1Output = () => ({
    icp: {
      name: "Biotech R&D Teams",
      description: initialPrompt.includes("biotech") ? "Biotech preclinical R&D teams" : "Target audience",
      roles: ["Research Scientists", "Lab Managers"],
      top_pains: ["Slow turnaround times", "Limited antibody selection"],
    },
    offer: {
      name: initialPrompt.match(/landing page for (.+?)(?: targeting|$)/i)?.[1] || "Service",
      description: initialPrompt,
    },
    offerTypeAnalysis: {
      offerType: "transactional",
    },
    talkPoints: {
      uniqueSellingPoints: [
        { point: "3000+ validated antibodies", category: "capability" },
        { point: "Fast 5-10 day turnaround", category: "speed" },
      ],
      transactionalFacts: [
        { point: "5-10 days turnaround", source: "offer" },
        { point: "3000+ validated antibodies", source: "offer" },
      ],
    },
    hookPoints: {},
  });

  const addToLog = (stepName, type, data) => {
    setExecutionLog(prev => [...prev, {
      stepName,
      type, // "request" | "response"
      data,
      timestamp: new Date().toISOString(),
    }]);
  };

  const handleStart = async () => {
    setLoading(true);
    setError(null);
    setExecutionLog([]);
    
    const step1Output = getStep1Output();
    addToLog("Step 1: Initial Context", "request", { prompt: initialPrompt, step1Output });

    try {
      // Skip clarification questions if mode is disabled
      if (!clarificationMode) {
        setStep("writing");
        handleWriteArticle(step1Output, {});
        return;
      }

      // Get clarification questions (Agent Mode)
      const requestPayload = {
        prompt: initialPrompt,
      };
      
      addToLog("Step 2: Clarification Questions", "request", requestPayload);
      
      const monkey = await initMonkey();
      const text = await monkey.apiCall("/api/agents-compare/agent-mode", requestPayload);
      const data = JSON.parse(text);
      addToLog("Step 2: Clarification Questions", "response", data);

      if (data.ok && data.output?.questions && data.output.questions.length > 0) {
        setQuestionnaireData({
          questions: data.output.questions,
          digestedInfo: data.output.digestedInfo || {},
          contextSummary: data.output.contextSummary || "",
        });
        setStep("questions");
      } else {
        // No questions needed, proceed directly to writing
        setStep("writing");
        handleWriteArticle(step1Output, {});
      }
    } catch (err) {
      setError(err.message);
      addToLog("Error", "response", { error: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitQuestionnaire = async (answers) => {
    setQuestionnaireAnswers(answers);
    setStep("writing");
    setShowQuestionsDetail(false);
    
    const step1Output = getStep1Output();
    handleWriteArticle(step1Output, answers);
  };

  const handleWriteArticle = async (step1Output, clarificationAnswers) => {
    setLoading(true);
    setError(null);

    try {
      const requestPayload = {
        model: "agent",
        step1Output,
        clarificationAnswers,
        pageType: "BASE_UNIVERSAL",
        useAgentMode: true, // Always use agent mode
        theme, // Pass theme to API
        agentMode, // Pass agent mode to API
      };
      
      addToLog("Step 3: Write Article", "request", requestPayload);

      const monkey = await initMonkey();
      const text = await monkey.apiCall("/api/monkey/landing-page/write-article", requestPayload);
      const data = JSON.parse(text);
      
      // Add summary response
      addToLog("Step 3: Write Article", "response", {
        success: data.success,
        mode: data.mode,
        sectionsCount: data.article?.metadata?.sectionsCount,
        htmlLength: data.article?.html?.length,
        review: data.article?.review,
      });
      
      // Add detailed section logs if available
      if (data.sectionLogs && data.sectionLogs.length > 0) {
        data.sectionLogs.forEach(sectionLog => {
          addToLog(
            `Section: ${sectionLog.sectionType} - ${sectionLog.step}`,
            "response",
            sectionLog.data
          );
        });
      }

      if (data.success) {
        setArticleResult(data);
        setArticleHtml(data.article?.html || "");
        setStep("complete");
        
        // Review research data if available
        if (data.research) {
          reviewResearchData(data.research, data.article?.html || "");
        }
      } else {
        throw new Error(data.error || "Failed to write article");
      }
    } catch (err) {
      setError(err.message);
      addToLog("Error", "response", { error: err.message });
    } finally {
      setLoading(false);
    }
  };

  const reviewResearchData = async (researchData, currentArticleHtml) => {
    try {
      const step1Output = getStep1Output();
      
      const monkey = await initMonkey();
      const text = await monkey.apiCall("/api/monkey/landing-page/review-research", {
        researchData,
        articleHtml: currentArticleHtml,
        icp: step1Output.icp,
        offer: step1Output.offer,
      });
      const data = JSON.parse(text);
      
      if (data.success) {
        setFilteredResearch(data.filteredResearch);
        setReviewSummary(data.reviewSummary);
        console.log(`[Research Review] ${data.reviewSummary.kept} kept, ${data.reviewSummary.expanded} expanded, ${data.reviewSummary.removed} removed`);
      } else {
        // Fallback: use original research if review fails
        setFilteredResearch(researchData);
        console.log(`[Research Review] Failed, using original data`);
      }
    } catch (error) {
      console.error("Error reviewing research:", error);
      // Fallback: use original research
      setFilteredResearch(researchData);
    }
  };

  const handleReset = () => {
    setStep("initial");
    setQuestionnaireData(null);
    setQuestionnaireAnswers(null);
    setArticleResult(null);
    setError(null);
    setShowQuestionsDetail(false);
    setExecutionLog([]);
    setPreviewSection(null);
    setArticleHtml("");
    setFilteredResearch(null);
    setReviewSummary(null);
  };

  const handleAddIdea = async (category, idea, sources) => {
    try {
      const step1Output = getStep1Output();
      
      // Step 1: Generate prompt first (include research data if available)
      const monkey = await initMonkey();
      const promptText = await monkey.apiCall("/api/monkey/landing-page/generate-prompt", {
        category,
        idea,
        sources,
        icp: step1Output.icp,
        offer: step1Output.offer,
        researchData: articleResult?.research, // Pass full research data for examples
      });
      const promptData = JSON.parse(promptText);
      
      if (!promptData.success) {
        throw new Error(promptData.error || "Failed to generate prompt");
      }

      // Step 2: Show preview modal immediately with prompt (no format selected yet)
      setPreviewSection({
        category,
        idea,
        sources,
        prompt: promptData.prompt,
        format: "paragraph", // default
        html: null, // no content generated yet
      });
    } catch (error) {
      console.error("Error generating prompt:", error);
      setError(error.message);
    }
  };

  const handleFormatChange = async (newFormat, editedPrompt = null) => {
    if (!previewSection) return;
    
    try {
      const step1Output = getStep1Output();
      const promptToUse = editedPrompt || previewSection.prompt?.contentPrompt;
      
      if (!promptToUse) {
        throw new Error("No prompt available");
      }

      // Generate content with the prompt and format
      const monkey = await initMonkey();
      const text = await monkey.apiCall("/api/monkey/landing-page/convert-idea", {
        category: previewSection.category,
        idea: previewSection.idea,
        sources: previewSection.sources,
        icp: step1Output.icp,
        offer: step1Output.offer,
        theme,
        format: newFormat,
        prompt: promptToUse, // Use the edited prompt
        researchData: articleResult?.research, // Pass research data for examples
      });
      const data = JSON.parse(text);
      
      if (data.success) {
        // Update preview section with generated content
        setPreviewSection({
          ...previewSection,
          format: newFormat,
          html: data.section.html,
          heading: data.section.heading,
          content: data.section.content,
        });
      } else {
        throw new Error(data.error || "Failed to generate content");
      }
    } catch (error) {
      console.error("Error generating content:", error);
      setError(error.message);
    }
  };

  const handlePromptEdit = (newPrompt) => {
    if (!previewSection) return;
    setPreviewSection({
      ...previewSection,
      prompt: {
        ...previewSection.prompt,
        contentPrompt: newPrompt,
      },
    });
  };

  const handleInsertSection = () => {
    if (!previewSection || !previewSection.html) {
        return;
      }

    try {
      // Parse the current HTML (should be full HTML document)
      const parser = new DOMParser();
      const doc = parser.parseFromString(articleHtml, "text/html");
      
      // Parse the new section HTML (should be a single section element)
      const newSectionDoc = parser.parseFromString(previewSection.html, "text/html");
      const newSection = newSectionDoc.body.firstChild;
      
      if (!newSection) {
        // If parsing failed, try to extract the section from the HTML string
        const sectionMatch = previewSection.html.match(/<section[^>]*>[\s\S]*?<\/section>/);
        if (sectionMatch) {
          const tempDoc = parser.parseFromString(sectionMatch[0], "text/html");
          const tempSection = tempDoc.body.firstChild;
          if (tempSection && doc.body) {
            doc.body.appendChild(tempSection);
          }
        } else {
          throw new Error("Failed to parse new section HTML");
        }
      } else if (doc.body) {
        // Append the new section to the end of the body
        doc.body.appendChild(newSection);
      } else {
        // Fallback: append directly to HTML string before </body>
        const bodyCloseIndex = articleHtml.lastIndexOf('</body>');
        if (bodyCloseIndex > 0) {
          const updatedHtml = articleHtml.slice(0, bodyCloseIndex) + previewSection.html + '\n  </body>';
          setArticleHtml(updatedHtml);
      } else {
          // No body tag, append at the end
          setArticleHtml(articleHtml + previewSection.html);
        }
        setPreviewSection(null);
        return;
      }
      
      // Get the full HTML document
      const htmlDoc = doc.documentElement.outerHTML;
      const fullHtml = '<!DOCTYPE html>\n' + htmlDoc;
      
      // Update the HTML state
      setArticleHtml(fullHtml);
      
      // Update the article result to reflect the change
      if (articleResult) {
        const updatedResult = {
          ...articleResult,
          article: {
            ...articleResult.article,
            html: fullHtml,
          },
        };
        setArticleResult(updatedResult);
        
        // Re-review research data with updated article (use original research, not filtered)
        const originalResearch = articleResult.research || filteredResearch;
        if (originalResearch) {
          reviewResearchData(originalResearch, fullHtml);
        }
      }
      
      // Close the preview modal
      setPreviewSection(null);
    } catch (error) {
      console.error("Error inserting section:", error);
      setError(`Failed to insert section: ${error.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-base-200 py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="card bg-base-100 shadow-xl mb-6">
          <div className="card-body">
            <h1 className="card-title text-3xl">Agent Playground</h1>
            <p className="text-base-content/60">
              Test the landing page generation pipeline with agent mode
          </p>
        </div>
        </div>

        {/* Tabs */}
        <div className="tabs tabs-boxed mb-6">
          <button
            className={`tab ${activeTab === "article" ? "tab-active" : ""}`}
            onClick={() => setActiveTab("article")}
          >
            <FileText className="w-4 h-4 mr-2" />
            Article Writing
          </button>
          <button
            className={`tab ${activeTab === "pipeline" ? "tab-active" : ""}`}
            onClick={() => setActiveTab("pipeline")}
          >
            <Workflow className="w-4 h-4 mr-2" />
            Landing Page Pipeline
          </button>
        </div>

        {/* Content based on active tab */}
        {activeTab === "pipeline" && (
          <LandingPagePipeline />
        )}

        {activeTab === "article" && (
          <>
            {/* View Log Button (always visible) */}
            {executionLog.length > 0 && (
              <div className="mb-6 flex justify-end">
                <button
                  onClick={() => setShowLogModal(true)}
                  className="btn btn-outline btn-sm gap-2"
                >
                  <Eye className="w-4 h-4" />
                  View Execution Log ({executionLog.length} entries)
                </button>
              </div>
            )}

        {/* Error Display */}
        {error && (
          <div className="alert alert-error mb-6">
            <span>Error: {error}</span>
            <button onClick={() => setError(null)} className="btn btn-sm btn-ghost">
              Dismiss
            </button>
          </div>
        )}

        {/* Step: Initial Prompt */}
        {step === "initial" && (
          <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
              <h2 className="card-title">
                <FileText className="w-6 h-6" />
                Initial Prompt
              </h2>
              
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold">
                    What landing page do you want to create?
                  </span>
                </label>
                <textarea
                  className="textarea textarea-bordered h-32"
                  value={initialPrompt}
                  onChange={(e) => setInitialPrompt(e.target.value)}
                  placeholder="Describe the landing page you want to create..."
                />
              </div>

              {/* Theme Selector */}
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold">Design Theme</span>
                </label>
                <select
                  className="select select-bordered"
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                >
                  <option value="default">Default (Colorful)</option>
                  <option value="minimalist">Minimalist (Clean & Professional)</option>
                </select>
              </div>

              {/* Agent Mode Selector */}
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold">Agent Mode</span>
                </label>
                <select
                  className="select select-bordered"
                  value={agentMode}
                  onChange={(e) => setAgentMode(e.target.value)}
                >
                  <option value="structured">Structured (Template-based)</option>
                  <option value="deep_research">Deep Research (Triage + Research + Specialized)</option>
                  <option value="open">Open Agent (Flexible + Research)</option>
                </select>
                <label className="label">
                  <span className="label-text-alt text-base-content/60">
                    {agentMode === "structured" 
                      ? "Structured: Uses predefined templates, fastest, most predictable"
                      : agentMode === "deep_research"
                      ? "Deep Research: Analyzes competitors, uses specialized agents, best quality"
                      : "Open Agent: Maximum flexibility, agent decides everything, experimental"}
                  </span>
                </label>
            </div>

              {/* Clarification Mode Toggle */}
              <div className="form-control">
                <label className="label cursor-pointer justify-start gap-4">
                  <input 
                    type="checkbox" 
                    className="toggle toggle-primary" 
                    checked={clarificationMode}
                    onChange={(e) => setClarificationMode(e.target.checked)}
                  />
                  <div>
                    <span className="label-text font-semibold">Clarification Questions</span>
                    <p className="label-text-alt text-base-content/60 mt-1">
                      {clarificationMode 
                        ? "Ask clarifying questions before generating content" 
                        : "Skip questions and generate directly from prompt"}
                    </p>
                              </div>
                </label>
              </div>

              <div className="card-actions justify-end mt-4">
              <button
                  onClick={handleStart}
                  disabled={loading || !initialPrompt.trim()}
                  className="btn btn-primary gap-2"
              >
                {loading ? (
                  <>
                      <Loader className="w-5 h-5 animate-spin" />
                      Starting...
                  </>
                ) : (
                    "Start Agent Pipeline"
                )}
              </button>
            </div>
          </div>
        </div>
        )}

        {/* Step: Questions (Active) */}
        {step === "questions" && questionnaireData && (
          <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
              <QuestionnaireForm
                questions={questionnaireData.questions}
                digestedInfo={questionnaireData.digestedInfo}
                contextSummary={questionnaireData.contextSummary}
                onSubmit={handleSubmitQuestionnaire}
                onCancel={handleReset}
                isLoading={loading}
              />
            </div>
          </div>
        )}

        {/* Step: Questions (Collapsed - after answering) */}
        {(step === "writing" || step === "complete") && questionnaireData && (
          <div className="card bg-base-100 shadow-xl mb-6">
            <div className="card-body">
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => setShowQuestionsDetail(!showQuestionsDetail)}
              >
                <h3 className="card-title text-lg">
                  Clarification Questions
                  <span className="badge badge-success">Answered</span>
                </h3>
                {showQuestionsDetail ? (
                  <ChevronUp className="w-5 h-5" />
                ) : (
                  <ChevronDown className="w-5 h-5" />
                )}
        </div>

              {showQuestionsDetail && (
                <div className="mt-4 space-y-4">
                  {questionnaireData.questions.map((q, idx) => (
                    <div key={idx} className="border-l-4 border-primary pl-4">
                      <p className="font-semibold">{q.question}</p>
                      <p className="text-sm text-base-content/60 mt-1">
                        Answer: {questionnaireAnswers?.[q.field] || "N/A"}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step: Writing */}
        {step === "writing" && (
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body text-center py-12">
              <Loader className="w-16 h-16 text-primary mx-auto mb-4 animate-spin" />
              <h2 className="text-2xl font-bold">Writing Article...</h2>
              <p className="text-base-content/60">
                Agent is orchestrating section writing, rendering HTML, and reviewing quality...
              </p>
            </div>
          </div>
        )}

        {/* Step: Complete */}
        {step === "complete" && articleResult && (
          <div className="space-y-6">
            {/* Success Banner */}
            <div className="alert alert-success">
              <span className="font-semibold">Article Complete!</span>
              <span>
                {articleResult.article?.metadata?.sectionsCount || 0} sections generated
                {articleResult.article?.metadata?.competitorsAnalyzed > 0 && (
                  <span className="ml-2">
                    | {articleResult.article.metadata.competitorsAnalyzed} competitors analyzed
                  </span>
                )}
              </span>
        </div>

            {/* Main Content Grid: Article + Research Sidebar */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left: Article Content (2/3 width) */}
              <div className="lg:col-span-2 space-y-6">

                {/* Sections Review (Duplicates, Empty, Goals) */}
                {articleResult.article?.sectionsReview && (
              <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
                  <h3 className="card-title">Sections Review</h3>
                  
                  <div className={`alert ${articleResult.article.sectionsReview.goalsAchieved ? 'alert-success' : 'alert-warning'}`}>
                    <div>
                      <div className="font-semibold">
                        Goals Achieved: {articleResult.article.sectionsReview.goalsAchieved ? "✅ YES" : "⚠️ NO"}
                      </div>
                      <div className="text-sm mt-2">{articleResult.article.sectionsReview.goalsAnalysis}</div>
                    </div>
                  </div>

                  {articleResult.article.sectionsReview.issues && articleResult.article.sectionsReview.issues.length > 0 && (
              <div className="mt-4">
                      <h4 className="font-semibold mb-2">Issues Found ({articleResult.article.sectionsReview.issues.length})</h4>
                      <div className="space-y-2">
                        {articleResult.article.sectionsReview.issues.map((issue, idx) => (
                          <div
                            key={idx}
                            className={`border-l-4 p-3 rounded ${
                              issue.severity === 'critical' ? 'border-error bg-error/10' :
                              issue.severity === 'high' ? 'border-warning bg-warning/10' :
                              'border-info bg-info/10'
                            }`}
                          >
                            <div className="flex gap-2 mb-2">
                              <span className={`badge badge-sm ${
                                issue.severity === 'critical' ? 'badge-error' :
                                issue.severity === 'high' ? 'badge-warning' :
                                'badge-info'
                              }`}>
                                {issue.severity}
                              </span>
                              <span className="badge badge-sm badge-outline">{issue.issueType}</span>
                              <span className="text-xs">Section {issue.sectionIndex}: {issue.sectionType}</span>
                            </div>
                            <p className="text-sm font-medium">{issue.description}</p>
                            {issue.duplicateWith !== undefined && (
                              <p className="text-xs text-base-content/60 mt-1">
                                Duplicates section {issue.duplicateWith}
                              </p>
                            )}
                            <p className="text-xs mt-2 italic">💡 {issue.suggestion}</p>
                    </div>
                  ))}
                </div>
              </div>
                  )}

                  {articleResult.article.sectionsReview.recommendations && articleResult.article.sectionsReview.recommendations.length > 0 && (
                    <div className="mt-4">
                      <h4 className="font-semibold mb-2">Recommendations</h4>
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        {articleResult.article.sectionsReview.recommendations.map((rec, idx) => (
                          <li key={idx} className="text-info">{rec}</li>
                        ))}
                      </ul>
                    </div>
                  )}
            </div>
          </div>
        )}

                {/* Quality Review */}
                {articleResult.article?.qualityReview && (
              <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
                  <h3 className="card-title">Quality Review</h3>
                  
                  <div className={`alert ${
                    articleResult.article.qualityReview.overallQuality === 'excellent' ? 'alert-success' :
                    articleResult.article.qualityReview.overallQuality === 'good' ? 'alert-info' :
                    articleResult.article.qualityReview.overallQuality === 'needs_improvement' ? 'alert-warning' :
                    'alert-error'
                  }`}>
                    <span className="font-semibold">
                      Overall Quality: {articleResult.article.qualityReview.overallQuality.toUpperCase()}
                    </span>
                  </div>

                  {articleResult.article.qualityReview.issues && articleResult.article.qualityReview.issues.length > 0 && (
                    <div className="mt-4">
                      <h4 className="font-semibold mb-2">
                        Issues Found ({articleResult.article.qualityReview.issues.length})
                      </h4>
                      <div className="space-y-2">
                        {articleResult.article.qualityReview.issues.map((issue, idx) => (
                          <div
                            key={idx}
                            className={`border-l-4 p-3 rounded ${
                              issue.severity === 'critical' ? 'border-error bg-error/10' :
                              issue.severity === 'major' ? 'border-warning bg-warning/10' :
                              'border-info bg-info/10'
                            }`}
                          >
                            <div className="flex gap-2 mb-2">
                              <span className={`badge badge-sm ${
                                issue.severity === 'critical' ? 'badge-error' :
                                issue.severity === 'major' ? 'badge-warning' :
                                'badge-info'
                              }`}>
                                {issue.severity}
                              </span>
                              <span className="badge badge-sm badge-outline">{issue.category}</span>
                            </div>
                            <p className="text-sm font-medium">{issue.description}</p>
                            <p className="text-xs text-base-content/60 mt-1">
                              Affected: {issue.affectedSections.join(", ")}
                            </p>
                            <p className="text-xs mt-2 italic">💡 {issue.suggestion}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {articleResult.article.qualityReview.strengths && articleResult.article.qualityReview.strengths.length > 0 && (
                    <div className="mt-4">
                      <h4 className="font-semibold mb-2">Strengths</h4>
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        {articleResult.article.qualityReview.strengths.map((strength, idx) => (
                          <li key={idx} className="text-success">{strength}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                    </div>
                  </div>
                )}

                {/* HTML Preview */}
                <div className="card bg-base-100 shadow-xl">
                  <div className="card-body">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="card-title">Article Preview</h3>
                      <button
                        onClick={() => {
                          const blob = new Blob([articleHtml], { type: "text/html" });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = `landing-page-${Date.now()}.html`;
                          a.click();
                          URL.revokeObjectURL(url);
                        }}
                        className="btn btn-primary btn-sm"
                      >
                        Download HTML
                      </button>
                    </div>
                    <div className="border border-base-300 rounded-lg overflow-hidden bg-white">
                      <ArticleDisplay 
                        html={articleHtml}
                        />
                      </div>
                    </div>
                  </div>

                {/* Actions */}
                <div className="flex gap-4">
                  <button onClick={handleReset} className="btn btn-outline flex-1">
                    Start Over
                  </button>
                </div>
                </div>

              {/* Right: Research Sidebar (1/3 width) */}
              <div className="lg:col-span-1">
                {reviewSummary && (
                  <div className="card bg-base-100 shadow-xl mb-4">
                    <div className="card-body p-4">
                      <h4 className="font-semibold text-sm mb-2">📊 Research Review</h4>
                      <div className="text-xs space-y-1">
                        <p>✅ Kept: {reviewSummary.kept}</p>
                        <p>📝 Expanded: {reviewSummary.expanded}</p>
                        <p>❌ Removed: {reviewSummary.removed}</p>
                        <p className="text-base-content/60 mt-2">
                          Duplicates and small points filtered out
                  </p>
                </div>
                    </div>
                  </div>
                )}
                <ResearchInsightsPanel 
                  research={filteredResearch || articleResult?.research || {}} 
                  onAddIdea={handleAddIdea}
                  showAddButton={true}
                />
              </div>
            </div>
          </div>
        )}

        {/* Section Preview Modal */}
        {previewSection && (
          <SectionPreview
            section={previewSection}
            onClose={() => setPreviewSection(null)}
            onInsert={handleInsertSection}
            onFormatChange={handleFormatChange}
            onPromptEdit={handlePromptEdit}
          />
        )}

        {/* Log Modal */}
        {showLogModal && (
          <div className="modal modal-open">
            <div className="modal-box max-w-4xl max-h-[80vh]">
              <h3 className="font-bold text-lg mb-4">Execution Log</h3>
              
              <div className="space-y-4 overflow-y-auto max-h-[60vh]">
                {executionLog.map((entry, idx) => (
                  <div key={idx} className="border border-base-300 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold">{entry.stepName}</h4>
                      <div className="flex items-center gap-2">
                        <span className={`badge badge-sm ${
                          entry.type === 'request' ? 'badge-info' : 'badge-success'
                        }`}>
                          {entry.type}
                        </span>
                        <span className="text-xs text-base-content/60">
                          {new Date(entry.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                    
                    <div className="bg-base-200 rounded p-3 overflow-x-auto">
                      <pre className="text-xs">
                        {JSON.stringify(entry.data, null, 2)}
                </pre>
                    </div>
                  </div>
                ))}
              </div>

              <div className="modal-action">
                <button onClick={() => setShowLogModal(false)} className="btn">
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
          </>
        )}
      </div>
    </div>
  );
}

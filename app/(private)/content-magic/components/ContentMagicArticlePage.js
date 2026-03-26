/**
 * ContentMagicArticlePage Component
 * 
 * MVP Scope: SEO Content Writer - Article Editor & Manager
 * 
 * This page provides a full content writing and editing interface for SEO-optimized articles.
 * The "article" concept here represents a complete article that can be researched, outlined,
 * written, and refined.
 * 
 * Primary functions:
 * - View ranked keyword/prompt research results
 * - Review competitor analysis and coverage gaps
 * - See AI evaluation scores and explainable rationale
 * - Generate and review outlines
 * - Write and edit content section by section
 * - Refine content with AI assistance
 * 
 * @component
 */
"use client"
import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { X, Save, ArrowLeft, ExternalLink, RotateCcw, AlertTriangle, Loader, Link, Check, Sparkles, Upload, Copy, Palette } from "lucide-react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import ContentMagicEditor from "./ContentMagicEditor";
import ContentMagicContextCard from "./ContentMagicContextCard";
import ContentMagicGuide from "./ContentMagicGuide";
// Removed: ContentMagicAIAssistant - replaced by template system
import ContentMagicQuickActions from "./ContentMagicQuickActions";
import ContentMagicOptimizationScores from "./ContentMagicOptimizationScores";
import ContentMagicImportModal from "./ContentMagicImportModal";
import CustomCssModeModal from "./CustomCssModeModal";
import { WritingGuideProvider, useWritingGuide } from "@/libs/content-magic/context/WritingGuideContext";
import { cleanImageUrlsForSave } from "@/libs/content-magic/utils/cleanImageUrlsForSave";
import { initMonkey } from "@/libs/monkey";
// import titleLength from "@/libs/content-magic/rules/titleLength";

// Build rule registry from imported rules
const ruleRegistry = {
  // [titleLength.key]: titleLength,
};

// Status badge colors
const statusColors = {
  pass: "bg-green-100 text-green-800",
  warn: "bg-yellow-100 text-yellow-800",
  fail: "bg-red-100 text-red-800",
  manual_needed: "bg-gray-100 text-gray-800",
  skipped: "bg-gray-100 text-gray-800",
};

// Custom CSS mode: cookie as source of truth; no cookie = off
const CUSTOM_CSS_MODE_COOKIE = "cjgeo_custom_css_mode";
const CUSTOM_CSS_MODE_MAX_AGE = 365 * 24 * 60 * 60; // 1 year

function getCustomCssModeFromCookie() {
  if (typeof document === "undefined") {
    
    return false;
  }
  const value = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${CUSTOM_CSS_MODE_COOKIE}=`))
    ?.split("=")[1];
  const enabled = value === "1" || value === "true";
  return enabled;
}

function setCustomCssModeCookie(enabled) {
  if (typeof document === "undefined") return;
  const value = enabled ? "1" : "0";
  document.cookie = `${CUSTOM_CSS_MODE_COOKIE}=${value}; path=/; max-age=${CUSTOM_CSS_MODE_MAX_AGE}; SameSite=Lax`;
}

function ArticlePageContent({ article, ruleResults: initialRuleResults, customCssEnabled, setCustomCssEnabled }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { article: articleState, updateArticle, setEditorRef, getEditorHtml, selectedElements, editorContainerRef, setEditorContainerRef } = useWritingGuide();

  useEffect(() => {
  }, [article?.id, pathname]);
  const [liveLinkEditing, setLiveLinkEditing] = useState(false);
  const [liveLinkTemp, setLiveLinkTemp] = useState(articleState.sourceUrl || "");
  const [editorContent, setEditorContent] = useState(articleState.content || "");
  const [ruleResults, setRuleResults] = useState(initialRuleResults || []);
  const [selectedRule, setSelectedRule] = useState(null);
  const [ignoredRules, setIgnoredRules] = useState([]);
  const [saving, setSaving] = useState(false);
  const [lastSavedTitle, setLastSavedTitle] = useState(articleState.title || "");
  const [keystrokeCount, setKeystrokeCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [showRefreshConfirm, setShowRefreshConfirm] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [customCssConfigured, setCustomCssConfigured] = useState(null);
  const [showCustomCssModal, setShowCustomCssModal] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // After mount: if cookie says custom CSS on, perform the actual "turn on" so custom styles are injected into the existing shadow root (no server-render mimic).
  useEffect(() => {
    if (!setCustomCssEnabled) {
      return;
    }
    const fromCookie = getCustomCssModeFromCookie();
    if (!fromCookie) {
      setCustomCssEnabled(false);
      
      return;
    }
    // Editor loads with custom CSS off first; give it time to mount and populate light DOM, then turn on via same path as toolbar.
    const t = setTimeout(() => {
      const editor = editorRef.current;
      if (editor?.prepareAndEnableCustomCss) {
        editor.prepareAndEnableCustomCss();
        
      } else {
        setCustomCssEnabled(true);
        
      }
    }, 150);
    return () => clearTimeout(t);
  }, [setCustomCssEnabled]);

  const editorRef = useRef(null);
  const saveTimeoutRef = useRef(null);
  const editorContainerRefLocal = useRef(null);

  // Initialize active rules (all rules in registry that aren't ignored)
  const allRules = Object.values(ruleRegistry);
  const activeRules = allRules.filter(rule => !ignoredRules.includes(rule.key));

  const handleIgnoreRule = (ruleKey) => {
    setIgnoredRules(prev => [...prev, ruleKey]);
    setRuleResults(prev => prev.filter(r => r.ruleKey !== ruleKey));
    if (selectedRule?.ruleKey === ruleKey) {
      setSelectedRule(null);
    }
  };

  const handleUnignoreRule = (ruleKey) => {
    setIgnoredRules(prev => prev.filter(r => r !== ruleKey));
  };

  // Save function - saves title, content, and source URL
  const performSave = useCallback(async (titleToSave, contentToSave, linkToSave) => {
    setSaving(true);
    setKeystrokeCount(0);
    try {
      // Get current HTML from editor (content-only: in custom CSS mode excludes shadow-injected link/style/base; in light mode is contenteditable innerHTML)
      let contentHtml = contentToSave;
      if (editorRef.current?.getHtml) {
        const editorHtml = editorRef.current.getHtml();
        if (editorHtml) {
          contentHtml = editorHtml;
        }
      }

      // Fallback to original content if no content provided
      if (!contentHtml || contentHtml.trim().length === 0) {
        contentHtml = article.content_html || "";
      }
      try {
        const monkey = await initMonkey();
        await monkey.saveArticle({
          articleId: article.id,
          title: titleToSave,
          contentHtml: contentHtml,
          sourceUrl: linkToSave || null,
        });
      } catch (err) {
        alert(`Failed to save: ${err.message || "Unknown error"}`);
        return false;
      }
      setLastSavedTitle(titleToSave);
      // Update context article state
      updateArticle({
        title: titleToSave,
        content_html: contentHtml,
        sourceUrl: linkToSave,
      });
      return true;
    } catch (err) {
      alert(`Error saving article: ${err.message}`);
      return false;
    } finally {
      setSaving(false);
      
    }
  }, [article.id, article.content_html, updateArticle]);

  // Handle title change
  const handleTitleChange = (e) => {
    const newTitle = e.target.value;
    updateArticle({ title: newTitle });
    setKeystrokeCount(prev => prev + 1);

    // Auto-save after 20 keystrokes
    if (keystrokeCount >= 19) {
      const contentHtml = editorRef.current?.getHtml 
        ? editorRef.current.getHtml() 
        : article.content_html || "";
      performSave(newTitle, contentHtml, articleState.sourceUrl);
    }
  };

  // Handle live link edit toggle
  const toggleLiveLinkEdit = () => {
    if (liveLinkEditing) {
      // Close without saving
      setLiveLinkTemp(articleState.sourceUrl);
      setLiveLinkEditing(false);
    } else {
      // Open for editing
      setLiveLinkTemp(articleState.sourceUrl);
      setLiveLinkEditing(true);
    }
  };

  // Handle live link save
  const handleLiveLinkSave = async () => {
    const contentHtml = editorRef.current?.getHtml() || "";
    updateArticle({ sourceUrl: liveLinkTemp });
    setLiveLinkEditing(false);
    await performSave(articleState.title, contentHtml, liveLinkTemp);
  };

  // Clean HTML from AI response (remove markdown code block wrappers)
  const cleanAiHtml = (html) => {
    return html
      .replace(/^```html\n?/i, "") // Remove opening ```html
      .replace(/^```\n?/i, "") // Remove opening ```
      .replace(/\n?```$/i, "") // Remove closing ```
      .trim();
  };

  // Handle refresh crawl
  const handleRefreshCrawl = async () => {
    if (!liveLinkTemp || liveLinkTemp.trim().length === 0) {
      alert("Please enter a URL before refreshing.");
      return;
    }

    setRefreshing(true);

    try {
      const monkey = await initMonkey();
      const text = await monkey.apiCall("/api/content-magic/crawl", {
        url: liveLinkTemp,
        crawlDepth: 0,
      });
      const data = JSON.parse(text);
      if (data.error) {
        throw new Error(data.error || "Failed to refresh from URL");
      }

      if (data.content && data.content.length > 0) {
        let newContent = data.content[0]?.html || "";
        
        if (!newContent || newContent.trim().length === 0) {
          throw new Error("No content found at URL");
        }

        // Clean AI response (remove markdown code blocks)
        newContent = cleanAiHtml(newContent);

        // Update editor directly via ref
        if (editorRef.current?.setHtml) {
          editorRef.current.setHtml(newContent);
        }

        // Save the refreshed content
        await performSave(articleState.title, newContent, liveLinkTemp);

        // Close confirmation modal
        setShowRefreshConfirm(false);

        // Show success message
        alert("Article refreshed successfully from URL");
      } else {
        throw new Error("No content found at URL");
      }
    } catch (error) {
      alert(`Failed to refresh: ${error.message}`);
    } finally {
      setRefreshing(false);
    }
  };

  // MVP: Editor is read-only, no change tracking needed
  const handleEditorChange = (event) => {
    // MVP: Editor is read-only, changes are not saved
    // This handler is kept for compatibility but does nothing
  };

  // Manual save - saves title, content, and source URL
  const copyHtml = async () => {
    const showCopied = () => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    };
    try {
      // Get current content from editor
      const contentHtml = editorRef.current?.getHtml 
        ? editorRef.current.getHtml() 
        : article.content_html || "";
      
      // Copy to clipboard
      await navigator.clipboard.writeText(contentHtml);
      showCopied();
    } catch (error) {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = editorRef.current?.getHtml() || article.content_html || "";
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand("copy");
        showCopied();
      } catch (err) {
      }
      document.body.removeChild(textArea);
    }
  };

  const saveArticle = async () => {
    // Get current content from editor
    const contentHtml = editorRef.current?.getHtml 
      ? editorRef.current.getHtml() 
      : article.content_html || "";
    await performSave(articleState.title, contentHtml, articleState.sourceUrl);
  };

  // Mock runAudit function
  const runAudit = () => {
    setTimeout(() => {
      setRuleResults([
        {
          ruleKey: "title_length",
          label: "Title is 30–65 characters",
          category: "seo_technical",
          status: articleState.title.length > 30 && articleState.title.length < 65 ? "pass" : "fail",
          evidence: articleState.title.length > 30 && articleState.title.length < 65 ? "Title length is good." : "Title length is out of range.",
          suggestedFix: "Adjust the title length.",
          impact: "medium",
          data: { title: articleState.title, length: articleState.title.length },
          highlights: [],
        },
      ]);
    }, 500);
  };

  // Register editor container ref with context when it's set
  useEffect(() => {
    const el = editorContainerRefLocal.current;
    if (el) {
      setEditorContainerRef(el);
    }
  }, [setEditorContainerRef, article?.id]);

  const handleEditorReady = useCallback((ref) => {
    editorRef.current = ref;
    setEditorRef(ref);
  }, [setEditorRef]);

  // Handle content import
  const handleImportContent = useCallback((htmlContent) => {
    if (editorRef.current) {
      // Set the HTML in the editor
      editorRef.current.setHtml(htmlContent);
      // Update article state with new content
      updateArticle({ content_html: htmlContent });
      // Save to database
      performSave(articleState.title || article.title, htmlContent, articleState.sourceUrl || article.source_url);
    }
  }, [editorRef, updateArticle, articleState.title, article.title, articleState.sourceUrl, article.source_url, performSave]);

  return (
    <>
      {/* Google Fonts for Geist */}
      <link href="https://fonts.googleapis.com/css2?family=Geist:wght@100;200;300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
      <div className="flex h-screen bg-white">
        {/* Main research artifact viewer panel */}
        <main className="flex-1 p-6 flex flex-col">
        {/* Top Bar - Back, Title, Live Link, Save (Research Artifact Viewer) */}
        <div className="mb-4 flex items-center gap-3">
          <button
            onClick={() => router.push("/content-magic")}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors flex-shrink-0"
            title="Back to listing"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <input
            className="flex-1 border border-gray-300 px-3 py-2 text-lg font-semibold rounded focus:outline-none focus:border-blue-500"
            value={articleState.title}
            onChange={handleTitleChange}
            placeholder="Article title"
          />

          {/* Import Button */}
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors flex-shrink-0 font-medium"
            title="Import content from URL or paste HTML"
          >
            <Upload className="w-5 h-5" />
            Import
          </button>

          {/* Copy HTML Button */}
          <span className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors font-medium"
              onClick={copyHtml}
              title="Copy HTML to clipboard"
            >
              <Copy className="w-4 h-4" />
              Copy HTML
            </button>
            {copySuccess && (
              <span className="text-green-600 text-sm font-medium animate-pulse" role="status">
                Copied to clipboard
              </span>
            )}
          </span>

          <button
            type="button"
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 font-medium disabled:bg-green-400 flex-shrink-0"
            onClick={saveArticle}
            disabled={saving}
            title="Save article (title, content, URL)"
          >
            <Save className="w-4 h-4" />
            {saving ? "Saving..." : "Save"}
          </button>
        </div>

        {/* Research Content Viewer (Read-Only) */}
        <div 
          ref={editorContainerRefLocal}
          className="flex-1 overflow-y-auto flex flex-col relative"
        >
          <ContentMagicEditor
            ref={handleEditorReady}
            onChange={handleEditorChange}
            customCssEnabled={customCssEnabled}
            onCustomCssChange={setCustomCssEnabled}
          />

          {/* Quick Actions Button - positioned outside editor content */}
          {selectedElements && selectedElements.length > 0 && (
            <ContentMagicQuickActions
              selectedElements={selectedElements}
              customCssEnabled={customCssEnabled}
            />
          )}
        </div>
      </main>

      {/* Right Sidebar with Research Guide */}
      <aside className="w-80 bg-gray-50 border-l border-gray-200 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-3">
          <ContentMagicContextCard article={article} />
          <ContentMagicOptimizationScores article={article} />
          <ContentMagicGuide />
          {/* AI Assistant for content editing */}
          {/* AI Assistant removed - replaced by template system with Quick Actions */}
        </div>
      </aside>

      {/* Refresh Confirmation Modal */}
      {showRefreshConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-sm w-full p-6">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Re-analyze from URL?</h3>
                <p className="text-sm text-gray-600 mt-1">
                  This will re-analyze the content from this URL for research purposes. The research results will be updated based on the latest content.
                </p>
              </div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded p-3 mb-6">
              <p className="text-xs text-amber-800">
                <span className="font-semibold">URL:</span> {liveLinkTemp}
              </p>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowRefreshConfirm(false)}
                disabled={refreshing}
                className="px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRefreshCrawl}
                disabled={refreshing}
                className="px-4 py-2 bg-amber-600 text-white rounded hover:bg-amber-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {refreshing ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    Refreshing...
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-4 h-4" />
                    Re-analyze Content
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      <ContentMagicImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImport={handleImportContent}
      />

      {/* Custom CSS not configured modal */}
      {showCustomCssModal && (
        <CustomCssModeModal onClose={() => setShowCustomCssModal(false)} />
      )}
    </div>
    </>
  );
}

export default function ContentMagicArticlePage({ article }) {
  // Extract rule results from article.assets if available
  // Assets structure: { rules: [{ ruleKey, label, category, status, ... }] }
  const initialRuleResults = article?.assets?.rules || [];

  const [customCssEnabled, setCustomCssEnabledState] = useState(false);
  const setCustomCssEnabled = useCallback((next) => {
    setCustomCssEnabledState((prev) => {
      const value = typeof next === "function" ? next(prev) : next;
      setCustomCssModeCookie(!!value);
      return value;
    });
  }, []);

  // Log what the page received from server (for load/fetch debugging)
  useEffect(() => {
    const contentLen = article?.content_html != null ? String(article.content_html).length : 0;
    if (article?.id && contentLen === 0) {
      
    }
  }, [article?.id, article?.content_html]);

  return (
    <WritingGuideProvider article={article} customCssEnabled={customCssEnabled}>
      <ArticlePageContent
        article={article}
        ruleResults={initialRuleResults}
        customCssEnabled={customCssEnabled}
        setCustomCssEnabled={setCustomCssEnabled}
      />
    </WritingGuideProvider>
  );
}
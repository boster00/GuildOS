"use client";
import React, { useState } from "react";
import { Globe, Loader, Download, Copy, Search, Save } from "lucide-react";
import { toast } from "react-hot-toast";
import { useWritingGuide } from "@/libs/content-magic/context/WritingGuideContext";
import { initMonkey } from "@/libs/monkey";

const publishAsWebpage = {
  key: "publish_as_webpage",
  pageType: ["all"],
  meta: {
    label: "Publish as Webpage",
    category: "launch",
    description: "Generate SEO metadata and convert your article to publishable code formats.",
    defaultActive: true,
  },
  DetailsUIDisplayMode: "fullscreen",

  is_complete: (context) => {
    const completedSteps = context.assets?.completed_steps || [];
    return completedSteps.includes("publish_as_webpage");
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
            title="Publish as webpage"
          >
            <Globe className="w-4 h-4" />
          </button>
        </div>
      );
    },

    DetailedUI: ({ rule, context, onUpdate }) => {
      const { updateArticle, getEditorHtml } = useWritingGuide();
      const [activeStep, setActiveStep] = useState(1); // 1 = SEO, 2 = Convert
      const [selectedFormat, setSelectedFormat] = useState(null);
      const [loading, setLoading] = useState(false);
      const [seoLoading, setSeoLoading] = useState(false);
      const [error, setError] = useState(null);
      const [convertedContent, setConvertedContent] = useState(null);
      const [fitTemplateLoading, setFitTemplateLoading] = useState(false);
      const [seoData, setSeoData] = useState(
        context.assets?.launch?.seoMetadata || {
          title: context.title || "",
          metaDescription: "",
          urlSlug: "",
        }
      );
      const [websiteFormats, setWebsiteFormats] = useState(
        context.assets?.launch?.websiteFormats || {}
      );
      // Template fitting state
      const [templateCode, setTemplateCode] = useState({
        raw_html: "",
        elementor: "",
      });
      const [contentCode, setContentCode] = useState({
        raw_html: "",
        elementor: "",
      });
      const [transformedOutput, setTransformedOutput] = useState({
        raw_html: null,
        elementor: null,
      });

      const formats = [
        { 
          id: "raw_html", 
          label: "Raw HTML", 
          icon: "📄", 
          description: "Clean HTML ready for any CMS",
          fileExtension: "html"
        },
        { 
          id: "elementor", 
          label: "Elementor Import", 
          icon: "🎨", 
          description: "Elementor-compatible JSON format",
          fileExtension: "json"
        },
      ];

      const handleGenerateSEO = async () => {
        setSeoLoading(true);
        setError(null);

        try {
          const { initMonkey } = await import("@/libs/monkey");
          const monkey = await initMonkey();
          const text = await monkey.apiCall("/api/content-magic/article-refinement/generate-seo", {
            articleId: context.id,
            articleTitle: context.title,
            articleContent: context.content_html || "",
            primaryKeyword: context.assets?.main_keyword || context.assets?.mainKeyword || context.title,
          });
          const data = JSON.parse(text);
          if (data.error) throw new Error(data.error || "Failed to generate SEO metadata");
          const { seoMetadata } = data;
          setSeoData(seoMetadata);
          
          // Save to assets
          const currentAssets = context.assets || {};
          updateArticle({
            assets: {
              ...currentAssets,
              launch: {
                ...(currentAssets.launch || {}),
                seoMetadata,
              },
            },
          });
        } catch (err) {
          setError(err.message);
        } finally {
          setSeoLoading(false);
        }
      };

      const handleSaveSEO = () => {
        const currentAssets = context.assets || {};
        updateArticle({
          assets: {
            ...currentAssets,
            launch: {
              ...(currentAssets.launch || {}),
              seoMetadata: seoData,
            },
          },
        });
      };

      const handleConvert = async (formatId) => {
        setLoading(true);
        setError(null);
        setSelectedFormat(formatId);
        setConvertedContent(null);

        try {
          const articleContent = getEditorHtml() || context.content_html || "";
          const articleTitle = context.title || "";

          const monkey = await initMonkey();
          const text = await monkey.apiCall("/api/content-magic/article-refinement/convert-website", {
            articleId: context.id,
            format: formatId,
            articleTitle,
            articleContent,
          });
          const data = JSON.parse(text);
          if (data.error) throw new Error(data.error || "Failed to convert format");

          const { convertedContent: content } = data;
          setConvertedContent(content);
          
          // Pre-fill content pane with generated content
          setContentCode(prev => ({
            ...prev,
            [formatId]: content,
          }));
          
          // Save to assets
          const newFormats = {
            ...websiteFormats,
            [formatId]: {
              content,
              convertedAt: new Date().toISOString(),
            },
          };
          setWebsiteFormats(newFormats);
          
          const currentAssets = context.assets || {};
          updateArticle({
            assets: {
              ...currentAssets,
              launch: {
                ...(currentAssets.launch || {}),
                websiteFormats: newFormats,
              },
            },
          });
        } catch (err) {
          setError(err.message);
        } finally {
          setLoading(false);
        }
      };

      const handleFitToTemplate = async () => {
        if (!selectedFormat) return;
        
        const template = templateCode[selectedFormat]?.trim();
        const content = contentCode[selectedFormat]?.trim();
        
        if (!template) {
          setError("Please provide a template in the left pane");
          return;
        }
        
        if (!content) {
          setError("Please provide content in the right pane");
          return;
        }

        setFitTemplateLoading(true);
        setError(null);

        try {
          const { initMonkey } = await import("@/libs/monkey");
          const monkey = await initMonkey();
          const text = await monkey.apiCall("/api/content-magic/article-refinement/fit-template", {
            mode: selectedFormat,
            templateCode: template,
            contentCode: content,
            articleTitle: context.title || "",
          });
          const data = JSON.parse(text);
          if (data.error) throw new Error(data.error || "Failed to fit content to template");

          const { outputCode } = data;
          setTransformedOutput(prev => ({
            ...prev,
            [selectedFormat]: outputCode,
          }));

          // Scroll to output area
          setTimeout(() => {
            const outputElement = document.getElementById(`output-${selectedFormat}`);
            if (outputElement) {
              outputElement.scrollIntoView({ behavior: "smooth", block: "start" });
            }
          }, 100);
        } catch (err) {
          setError(err.message);
        } finally {
          setFitTemplateLoading(false);
        }
      };

      const handleCopy = async (text) => {
        if (!text) {
          toast.error("Nothing to copy");
          return;
        }
        try {
          await navigator.clipboard.writeText(text);
          toast.success("Copied to clipboard!");
          setError(null);
        } catch (err) {

          toast.error("Failed to copy. Please select the text and copy manually (Ctrl+C or Cmd+C).");
        }
      };

      const handleDownload = (content, filename) => {
        const format = formats.find(f => f.id === selectedFormat);
        const mimeType = format?.id === "html" ? "text/html" : "application/json";
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      };

      const generateSlug = (title) => {
        return title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '');
      };

      return (
        <div className="space-y-6">
          {/* Step Navigation */}
          <div className="flex gap-2 border-b border-gray-200">
            <button
              onClick={() => setActiveStep(1)}
              className={`px-4 py-2 font-medium text-sm transition-colors ${
                activeStep === 1
                  ? "text-green-600 border-b-2 border-green-600"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Step 1: SEO Title, Meta & URL
            </button>
            <button
              onClick={() => setActiveStep(2)}
              className={`px-4 py-2 font-medium text-sm transition-colors ${
                activeStep === 2
                  ? "text-green-600 border-b-2 border-green-600"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Step 2: Convert to Publishable Code
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Step 1: SEO Metadata */}
          {activeStep === 1 && (
            <div className="space-y-6">
              <button
                onClick={handleGenerateSEO}
                disabled={seoLoading}
                className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {seoLoading ? (
                  <>
                    <Loader className="w-5 h-5 animate-spin" />
                    Generating SEO Metadata...
                  </>
                ) : (
                  <>
                    <Search className="w-5 h-5" />
                    Generate SEO Title, Meta & URL
                  </>
                )}
              </button>

              {/* SEO Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  SEO Title (50-60 characters recommended)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={seoData.title}
                    onChange={(e) => setSeoData({ ...seoData, title: e.target.value })}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="Enter SEO title"
                    maxLength={60}
                  />
                  <button
                    onClick={() => handleCopy(seoData.title)}
                    className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg"
                    title="Copy title"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  {seoData.title.length}/60 characters
                </div>
              </div>

              {/* Meta Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Meta Description (150-160 characters recommended)
                </label>
                <div className="flex gap-2">
                  <textarea
                    value={seoData.metaDescription}
                    onChange={(e) => setSeoData({ ...seoData, metaDescription: e.target.value })}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent h-24"
                    placeholder="Enter meta description"
                    maxLength={160}
                  />
                  <button
                    onClick={() => handleCopy(seoData.metaDescription)}
                    className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg self-start"
                    title="Copy description"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  {seoData.metaDescription.length}/160 characters
                </div>
              </div>

              {/* URL Slug */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  URL Slug
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={seoData.urlSlug}
                    onChange={(e) => setSeoData({ ...seoData, urlSlug: e.target.value })}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent font-mono text-sm"
                    placeholder="article-url-slug"
                    onBlur={(e) => {
                      if (!e.target.value && seoData.title) {
                        setSeoData({ ...seoData, urlSlug: generateSlug(seoData.title) });
                      }
                    }}
                  />
                  <button
                    onClick={() => {
                      if (seoData.title) {
                        setSeoData({ ...seoData, urlSlug: generateSlug(seoData.title) });
                      }
                    }}
                    className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm"
                    title="Generate from title"
                  >
                    Auto
                  </button>
                  <button
                    onClick={() => handleCopy(seoData.urlSlug)}
                    className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg"
                    title="Copy slug"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  URL: /{seoData.urlSlug || 'article-slug'}
                </div>
              </div>

              <div className="flex justify-between">
                <div></div>
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveSEO}
                    className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    Save SEO Metadata
                  </button>
                  <button
                    onClick={() => setActiveStep(2)}
                    className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                  >
                    Next: Convert Code →
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Convert to Publishable Code */}
          {activeStep === 2 && (
            <div className="space-y-6">
              <div>
                <h4 className="text-base font-semibold mb-2">Convert to Publishable Code Format</h4>
                <p className="text-sm text-gray-600 mb-4">
                  Fit your article content into a template layout. Select a format, provide a template, and let AI merge your content.
                </p>
              </div>

              {/* Format Selection */}
              <div className="grid grid-cols-2 gap-4">
                {formats.map((format) => (
                  <button
                    key={format.id}
                    onClick={async () => {
                      setSelectedFormat(format.id);
                      // If content hasn't been generated yet, generate it
                      if (!contentCode[format.id] && !websiteFormats[format.id]) {
                        await handleConvert(format.id);
                      } else if (websiteFormats[format.id]) {
                        // Load existing content
                        setContentCode(prev => ({
                          ...prev,
                          [format.id]: websiteFormats[format.id].content,
                        }));
                      }
                    }}
                    disabled={loading}
                    className={`p-6 border-2 rounded-lg text-left transition-all ${
                      selectedFormat === format.id
                        ? "border-green-500 bg-green-50"
                        : "border-gray-200 hover:border-green-300 hover:bg-gray-50"
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <div className="text-3xl mb-3">{format.icon}</div>
                    <div className="font-semibold text-base text-gray-900 mb-2">
                      {format.label}
                    </div>
                    <div className="text-sm text-gray-600">{format.description}</div>
                    {websiteFormats[format.id] && (
                      <div className="mt-3 text-sm text-green-600 font-medium">✓ Ready</div>
                    )}
                  </button>
                ))}
              </div>

              {/* Loading State for Initial Conversion */}
              {loading && (
                <div className="flex items-center justify-center p-8">
                  <Loader className="w-6 h-6 animate-spin text-green-600" />
                  <span className="ml-2 text-gray-600">Generating base content...</span>
                </div>
              )}

              {/* Dual Input Panes for Selected Format */}
              {selectedFormat && !loading && (
                <div className="space-y-4">
                  {/* Instruction Text */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    {selectedFormat === "raw_html" ? (
                      <p className="text-sm text-blue-900">
                        Use a real page as a layout template. Paste its HTML on the left, keep or edit your article HTML on the right, then let the AI fit your content into the template's structure.
                      </p>
                    ) : (
                      <p className="text-sm text-blue-900">
                        Use an exported Elementor page as a layout template. Paste the Elementor JSON on the left, keep or edit your article JSON on the right, then let the AI fit your content into the Elementor template.
                      </p>
                    )}
                  </div>

                  {/* Dual Input Panes */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Left Pane: Template */}
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        {selectedFormat === "raw_html" 
                          ? "Template HTML (example page layout)"
                          : "Template Elementor JSON (exported page)"}
                      </label>
                      <p className="text-xs text-gray-500">
                        {selectedFormat === "raw_html"
                          ? "Paste the HTML of a page whose layout you like (e.g., from your site). The AI will keep the structure and styling patterns from this template and replace the content with the article's content."
                          : "Export an existing page from Elementor and paste the JSON here. The AI will use this as a layout template and inject your article's content into it."}
                      </p>
                      <textarea
                        value={templateCode[selectedFormat] || ""}
                        onChange={(e) => setTemplateCode(prev => ({
                          ...prev,
                          [selectedFormat]: e.target.value,
                        }))}
                        placeholder={selectedFormat === "raw_html"
                          ? "Paste your template HTML here..."
                          : "Paste your Elementor JSON template here..."}
                        className="w-full h-64 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent font-mono text-xs"
                      />
                    </div>

                    {/* Right Pane: Content */}
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Page Content (source HTML/JSON)
                      </label>
                      <p className="text-xs text-gray-500">
                        This is the current generated output for your article. You can edit it before asking the AI to fit it into the template.
                      </p>
                      <textarea
                        value={contentCode[selectedFormat] || ""}
                        onChange={(e) => setContentCode(prev => ({
                          ...prev,
                          [selectedFormat]: e.target.value,
                        }))}
                        placeholder="Article content will appear here after generation..."
                        className="w-full h-64 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent font-mono text-xs"
                      />
                    </div>
                  </div>

                  {/* Fit to Template Button */}
                  <button
                    onClick={handleFitToTemplate}
                    disabled={fitTemplateLoading || !templateCode[selectedFormat]?.trim() || !contentCode[selectedFormat]?.trim()}
                    className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {fitTemplateLoading ? (
                      <>
                        <Loader className="w-5 h-5 animate-spin" />
                        Asking AI to merge content with template...
                      </>
                    ) : (
                      <>
                        <Globe className="w-5 h-5" />
                        Fit Content to Template
                      </>
                    )}
                  </button>

                  {/* Transformed Output */}
                  <div id={`output-${selectedFormat}`} className="space-y-2">
                    <h4 className="font-semibold text-gray-900">Transformed Output</h4>
                    {transformedOutput[selectedFormat] ? (
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm text-gray-600">
                            {selectedFormat === "raw_html" ? "Merged HTML" : "Merged Elementor JSON"}
                          </span>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleCopy(transformedOutput[selectedFormat])}
                              className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50 flex items-center gap-1"
                            >
                              <Copy className="w-4 h-4" />
                              Copy
                            </button>
                            <button
                              onClick={() => {
                                const format = formats.find(f => f.id === selectedFormat);
                                const filename = `${(context.title || 'article').replace(/[^a-z0-9]/gi, '-').toLowerCase()}-merged.${format?.fileExtension || 'txt'}`;
                                handleDownload(transformedOutput[selectedFormat], filename);
                              }}
                              className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 flex items-center gap-1"
                            >
                              <Download className="w-4 h-4" />
                              Download
                            </button>
                          </div>
                        </div>
                        <div className="bg-white rounded border border-gray-200 p-4 max-h-96 overflow-y-auto">
                          <pre className="text-xs whitespace-pre-wrap text-gray-800 font-mono">
                            {transformedOutput[selectedFormat]}
                          </pre>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-500 text-center">
                        Run "Fit Content to Template" to see the transformed output here.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Navigation */}
              <div className="flex justify-between pt-4 border-t border-gray-200">
                <button
                  onClick={() => setActiveStep(1)}
                  className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                >
                  ← Back to SEO
                </button>
                {(() => {
                  const completedSteps = context.assets?.completed_steps || [];
                  const isComplete = completedSteps.includes("publish_as_webpage");
                  
                  if (isComplete) {
                    return (
                      <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-2 rounded-lg flex items-center">
                        ✓ Marked as complete
                      </div>
                    );
                  }
                  
                  return (
                    <button
                      onClick={async () => {
                        const currentAssets = context.assets || {};
                        const currentCompletedSteps = currentAssets.completed_steps || [];
                        if (!currentCompletedSteps.includes("publish_as_webpage")) {
                          updateArticle({
                            assets: {
                              ...currentAssets,
                              completed_steps: [...currentCompletedSteps, "publish_as_webpage"],
                            },
                          });
                        }
                      }}
                      className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      Mark as Complete
                    </button>
                  );
                })()}
              </div>
            </div>
          )}
        </div>
      );
    },
  },
};

export default publishAsWebpage;

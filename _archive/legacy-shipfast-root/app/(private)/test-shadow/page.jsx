"use client";

import React, { useState, useEffect } from "react";
import { WritingGuideProvider } from "@/libs/content-magic/context/WritingGuideContext";
import ShadowEditorRoot from "./components/ShadowEditorRoot";
import DefaultTemplateBoundary from "./components/DefaultTemplateBoundary";
import ContentMagicEditor from "@/app/(private)/content-magic/components/ContentMagicEditor";
import ContentMagicQuickActions from "@/app/(private)/content-magic/components/ContentMagicQuickActions";
import { useWritingGuide } from "@/libs/content-magic/context/WritingGuideContext";
import { initMonkey } from "@/libs/monkey";

const MINIMAL_ARTICLE = {
  id: "test-shadow-article",
  title: "Test Shadow",
  content: "",
  content_html: "",
  sourceUrl: "",
  context: {},
};

const SAMPLE_SECTIONS = [
  {
    id: "custom-1",
    type: "custom",
    html: `<section class="custom-template">
      <h1>Custom Template (User CSS Applies)</h1>
      <ul class="col-12 col-lg-4">
        <li class="mb-2"><a href="#">Primary Antibodies</a></li>
        <li class="mb-2"><a href="#">Secondary Antibodies</a></li>
        <li class="mb-2"><a href="#">Conjugates</a></li>
      </ul>
    </section>`,
  },
  {
    id: "default-1",
    type: "default",
    html: `<section class="default-template">
      <h1>Default Template (Protected)</h1>
      <p>This content is protected from user CSS when nested shadow is enabled.</p>
    </section>`,
  },
  {
    id: "custom-2",
    type: "custom",
    html: `<section class="custom-template">
      <h2>Another Custom Block</h2>
      <p>User CSS applies here too.</p>
    </section>`,
  },
];

const DEFAULT_TEMPLATE_CSS = `
.default-template-host { display: block; }
.default-template h1 { font-size: 1.5rem; color: #111; margin-bottom: 0.5rem; }
.default-template p { margin: 0.25rem 0; line-height: 1.5; }
`;

function TestShadowContent() {
  const {
    selectedElements,
    setEditorContainerRef,
    setEditorRef,
  } = useWritingGuide();

  const [enableCustomCSS, setEnableCustomCSS] = useState(true);
  const [enableNestedShadow, setEnableNestedShadow] = useState(true);
  const [aggressiveCSS, setAggressiveCSS] = useState(false);
  const [selectedContent, setSelectedContent] = useState("sample1");
  const [shadowRootRef, setShadowRootRef] = useState(null);

  // User customizations from profiles.json.customizations (loaded when "Enable user CSS links" is used)
  const [profileCustomizations, setProfileCustomizations] = useState(null);
  const [profileCssLoading, setProfileCssLoading] = useState(false);
  const [profileCssError, setProfileCssError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function loadProfileCustomizations() {
      try {
        setProfileCssLoading(true);
        setProfileCssError(null);
        const monkey = await initMonkey(true);
        await monkey.initUser();
        if (!monkey.user?.id) {
          setProfileCustomizations(null);
          return;
        }
        const profile = await monkey.read("profiles", [
          { operator: "eq", args: ["id", monkey.user.id] },
        ]);
        if (cancelled) return;
        if (profile && profile[0]?.json?.customizations) {
          const c = profile[0].json.customizations;
          setProfileCustomizations({
            css: c.css || "",
            external_css_links: Array.isArray(c.external_css_links)
              ? c.external_css_links.filter((l) => l && String(l).trim())
              : [],
          });
        } else {
          setProfileCustomizations({ css: "", external_css_links: [] });
        }
      } catch (err) {
        if (!cancelled) {
          setProfileCssError(err.message || "Failed to load profile CSS");
          setProfileCustomizations(null);
        }
      } finally {
        if (!cancelled) setProfileCssLoading(false);
      }
    }
    loadProfileCustomizations();
    return () => { cancelled = true; };
  }, []);

  // Base editor CSS always loaded; user external_css_links and inline CSS only when "Enable user CSS links" is on
  const cssLinks = [
    "/editor-css/editor-base.css",
    "/editor-css/editor-toolbar.css",
    ...(enableCustomCSS && profileCustomizations?.external_css_links?.length
      ? profileCustomizations.external_css_links
      : []),
  ];

  const baseInlineCss = `
  :host, #shadow-app-root {
    font-family: system-ui, -apple-system, sans-serif;
    color: #000;
    line-height: 1.5;
    display: block;
  }
  .debug-banner { margin-bottom: 8px; font-size: 12px; }
`;
  const aggressiveSnippet = aggressiveCSS
    ? `
  * { font-size: 40px !important; }
  .debug-banner { background: red; color: white; padding: 10px; }
`
    : "";
  const userCss =
    enableCustomCSS && profileCustomizations?.css
      ? profileCustomizations.css
      : "";
  const inlineCss = [aggressiveSnippet, baseInlineCss, userCss]
    .filter(Boolean)
    .join("\n");

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Left: Controls */}
      <aside className="w-64 bg-white border-r border-gray-200 p-4 flex flex-col gap-4 overflow-y-auto">
        <h2 className="text-lg font-semibold text-gray-800">
          test-shadow controls
        </h2>

        {profileCssLoading && (
          <p className="text-xs text-amber-600">Loading profile CSS…</p>
        )}
        {profileCssError && (
          <p className="text-xs text-red-600" title={profileCssError}>
            Profile CSS: {profileCssError}
          </p>
        )}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={enableCustomCSS}
            onChange={(e) => setEnableCustomCSS(e.target.checked)}
          />
          <span className="text-sm">Enable user CSS links</span>
        </label>
        {enableCustomCSS && profileCustomizations && (
          <p className="text-xs text-gray-500">
            {profileCustomizations.external_css_links?.length || 0} link(s),{" "}
            {profileCustomizations.css?.length ? "inline CSS" : "no inline"}
          </p>
        )}

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={enableNestedShadow}
            onChange={(e) => setEnableNestedShadow(e.target.checked)}
          />
          <span className="text-sm">Nested shadow for default-template</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={aggressiveCSS}
            onChange={(e) => setAggressiveCSS(e.target.checked)}
          />
          <span className="text-sm">Inject aggressive user CSS</span>
        </label>

        <div>
          <span className="text-sm font-medium text-gray-700 block mb-1">
            Sample content
          </span>
          <select
            value={selectedContent}
            onChange={(e) => setSelectedContent(e.target.value)}
            className="w-full text-sm border border-gray-300 rounded px-2 py-1"
          >
            <option value="sample1">Sample 1 (editor + sections)</option>
            <option value="sample2">Sample 2 (sections only)</option>
          </select>
        </div>
      </aside>

      {/* Right: Editor area */}
      <main className="flex-1 flex flex-col min-w-0">
        <div
          ref={setEditorContainerRef}
          className="flex-1 overflow-y-auto flex flex-col relative bg-white"
        >
          <ShadowEditorRoot
            cssLinks={cssLinks}
            inlineCss={inlineCss}
            onShadowRootReady={setShadowRootRef}
          >
            {selectedContent === "sample1" ? (
              <>
                <div className="p-2 debug-banner">
                  Editor inside Shadow DOM — user CSS applies here.
                </div>
                <ContentMagicEditor
                  ref={(r) => setEditorRef(r)}
                  rootNode={shadowRootRef}
                />
              </>
            ) : (
              <div className="p-4 editorContent">
                <div className="debug-banner mb-4">
                  Sample sections only (no full editor).
                </div>
                {SAMPLE_SECTIONS.map((section) => {
                  if (
                    section.type === "default" &&
                    enableNestedShadow
                  ) {
                    return (
                      <DefaultTemplateBoundary
                        key={section.id}
                        cssText={DEFAULT_TEMPLATE_CSS}
                      >
                        <div
                          className="default-template"
                          dangerouslySetInnerHTML={{ __html: section.html }}
                        />
                      </DefaultTemplateBoundary>
                    );
                  }
                  return (
                    <div
                      key={section.id}
                      dangerouslySetInnerHTML={{ __html: section.html }}
                    />
                  );
                })}
              </div>
            )}
          </ShadowEditorRoot>

          {selectedElements?.length > 0 && (
            <ContentMagicQuickActions
              selectedElements={selectedElements}
              shadowRoot={shadowRootRef}
            />
          )}
        </div>
      </main>
    </div>
  );
}

export default function TestShadowPage() {
  return (
    <WritingGuideProvider article={MINIMAL_ARTICLE}>
      <TestShadowContent />
    </WritingGuideProvider>
  );
}

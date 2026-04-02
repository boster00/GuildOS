'use client';

import { useEffect, useRef, useState } from 'react';

const FA_CSS_URL = 'https://use.fontawesome.com/releases/v6.1.1/css/all.css';
const FA_WEBFONTS_BASE = 'https://use.fontawesome.com/releases/v6.1.1/webfonts/';
const FA_PRELOAD_SOLID = 'https://use.fontawesome.com/releases/v6.1.1/webfonts/fa-solid-900.woff2';
const FA_PRELOAD_REGULAR = 'https://use.fontawesome.com/releases/v6.1.1/webfonts/fa-regular-400.woff2';
const FA_PRELOAD_BRANDS = 'https://use.fontawesome.com/releases/v6.1.1/webfonts/fa-brands-400.woff2';
const FA_PRELOAD_URLS = [FA_PRELOAD_SOLID, FA_PRELOAD_REGULAR, FA_PRELOAD_BRANDS];
// Same-origin proxy so fetch() works (Font Awesome does not send Access-Control-Allow-Origin).
const FA_CSS_PROXY_URL = '/api/test-shadow-dom-styling/proxy-fontawesome';
const FA_FONT_FAMILY = 'Font Awesome 6 Free';

/**
 * Add font preload links to document.head so webfonts are cached for shadow DOM.
 * Does NOT inject the FA stylesheet — main DOM is never affected by FA CSS.
 */
function ensureGlobalFAPreload() {
  const preloads = [
    { href: FA_PRELOAD_SOLID, as: 'font', type: 'font/woff2' },
    { href: FA_PRELOAD_REGULAR, as: 'font', type: 'font/woff2' },
  ];
  preloads.forEach(({ href, as, type }) => {
    if (document.querySelector(`link[rel="preload"][href="${href}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = as;
    link.type = type;
    link.crossOrigin = 'anonymous';
    link.href = href;
    document.head.appendChild(link);
  });
  return Promise.resolve();
}

/** Remove FA font preload links from document.head. */
function removeGlobalFAPreloads() {
  document.querySelectorAll('link[rel="preload"][as="font"][href*="fontawesome.com"]').forEach((el) => el.remove());
}

/** Shared inner HTML for shadow roots / iframe body (identical content). */
function getSharedInnerHTML(title) {
  return `
    <div class="shadow-content" style="padding: 1rem; font-family: system-ui, sans-serif;">
      <h3 style="margin: 0 0 1rem 0; font-size: 1rem;">${title}</h3>
      <div style="display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;">
        <i class="fa-solid fa-user" data-diagnostics-icon="true" style="font-size: 3rem;"></i>
        <i class="fa-solid fa-users" style="font-size: 3rem;"></i>
        <span style="font-size: 0.95rem;">Icons and text to compare font rendering.</span>
      </div>
    </div>
  `;
}

/** Full document HTML for iframe (same style + content). */
function getIframeDocHtml() {
  const bodyContent = getSharedInnerHTML('Iframe C: link in document').trim();
  return `<!DOCTYPE html><html><head><link rel="stylesheet" href="${FA_CSS_URL}"></head><body>${bodyContent}</body></html>`;
}

export default function TestShadowDomStylingPage() {
  const leftHostRef = useRef(null);
  const rightHostRef = useRef(null);
  const iframeRef = useRef(null);
  const test4HostRef = useRef(null);
  const test5HostRef = useRef(null);
  const runTest4DiagnosticsRef = useRef(null);
  const runTest5DiagnosticsRef = useRef(null);
  const [leftDiag, setLeftDiag] = useState(null);
  const [rightDiag, setRightDiag] = useState(null);
  const [iframeDiag, setIframeDiag] = useState(null);
  const [test4Diag, setTest4Diag] = useState(null);
  const [test5Diag, setTest5Diag] = useState(null);
  const [fontLinkHrefs, setFontLinkHrefs] = useState(null);

  const checkFontLinks = () => {
    if (typeof document === 'undefined' || !document.head) return;
    const links = document.head.querySelectorAll('link[data-custom-css-font-link]');
    setFontLinkHrefs(Array.from(links).map((el) => el.href));
  };

  useEffect(() => {
    checkFontLinks();
  }, []);

  useEffect(() => {
    const leftHost = leftHostRef.current;
    const rightHost = rightHostRef.current;
    const iframe = iframeRef.current;
    const test4Host = test4HostRef.current;
    if (!leftHost || !rightHost || !iframe || !test4Host) return;

    // --- IFRAME: same content via srcdoc with <link> in document head ---
    const runDiagnosticsIframe = () => {
      const doc = iframe.contentDocument;
      if (!doc) return;
      const iframeData = {};
      const link = doc.querySelector('head link[rel="stylesheet"]');
      if (link) {
        iframeData.hasSheet = link.sheet != null;
        try {
          iframeData.cssRulesLength = link.sheet?.cssRules?.length ?? 'N/A';
        } catch (e) {
          iframeData.cssRulesLength = `CSSRules inaccessible: ${e.message}`;
        }
      } else {
        iframeData.hasSheet = false;
        iframeData.cssRulesLength = 'N/A (link not found)';
      }
      const icon = doc.querySelector('[data-diagnostics-icon]');
      if (icon) {
        try {
          const before = getComputedStyle(icon, '::before');
          iframeData.iconBefore = {
            content: before.content || 'N/A',
            fontFamily: before.fontFamily || 'N/A',
            fontWeight: before.fontWeight || 'N/A',
          };
        } catch (e) {
          iframeData.iconBefore = { content: `Error: ${e.message}`, fontFamily: 'N/A', fontWeight: 'N/A' };
        }
      } else {
        iframeData.iconBefore = { content: 'N/A', fontFamily: 'N/A', fontWeight: 'N/A' };
      }
      const content = (iframeData.iconBefore?.content || '').toLowerCase();
      const family = (iframeData.iconBefore?.fontFamily || '').toLowerCase();
      iframeData.pass = content !== 'none' && content !== 'normal' && family.includes('font awesome');
      setIframeDiag(iframeData);
    };
    iframe.onload = runDiagnosticsIframe;
    iframe.srcdoc = getIframeDocHtml();

    // --- LEFT: "current approach" — <head> with <link> inside shadow root ---
    const leftShadow = leftHost.attachShadow({ mode: 'open' });
    const head = document.createElement('head');
    head.setAttribute('data-custom-css-head', 'true');
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = FA_CSS_URL;
    head.appendChild(link);
    leftShadow.appendChild(head);
    const leftBody = document.createElement('div');
    leftBody.innerHTML = getSharedInnerHTML('Shadow DOM A: link tags');
    leftShadow.appendChild(leftBody);

    // --- RIGHT: "recommended approach" — fetch CSS, constructable stylesheet, URL rewrite ---
    // We use adoptedStyleSheets so we don't duplicate style nodes and so the same sheet can be
    // shared across roots if needed. Font Awesome's CSS uses url(../webfonts/...) which is
    // relative to the stylesheet URL; when we inline the CSS text into a constructable sheet,
    // the browser no longer has a base URL, so we rewrite those to absolute URLs.
    const rightShadow = rightHost.attachShadow({ mode: 'open' });
    (async () => {
      let fetchError = null;
      try {
        const res = await fetch(FA_CSS_PROXY_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        let cssText = await res.text();
        // Rewrite relative webfont URLs to absolute so they resolve when CSS is inlined.
        cssText = cssText.replace(/url\s*\(\s*['"]?\.\.\/webfonts\/([^'")\s]+)['"]?\s*\)/g, (_, path) =>
          `url("${FA_WEBFONTS_BASE}${path}")`
        );
        const sheet = new CSSStyleSheet();
        await sheet.replace(cssText);
        rightShadow.adoptedStyleSheets = [...rightShadow.adoptedStyleSheets, sheet];
      } catch (e) {
        fetchError = e instanceof Error ? e.message : String(e);
      }
      // Append body content either way so the right column always has the same DOM.
      const rightBody = document.createElement('div');
      rightBody.innerHTML = getSharedInnerHTML('Shadow DOM B: adoptedStyleSheets');
      rightShadow.appendChild(rightBody);

      // Run diagnostics after both sides are ready; delay so <link> on left has time to load.
      const runDiagnostics = () => {
        const left = {};
        const right = fetchError
          ? { fetchError: `Fetch failed: ${fetchError}. CORS or network may block fetch().` }
          : {};

        // LEFT: link.sheet and cssRules
        const leftLink = leftShadow.querySelector('head link[rel="stylesheet"]');
        if (leftLink) {
          left.hasSheet = leftLink.sheet != null;
          try {
            left.cssRulesLength = leftLink.sheet?.cssRules?.length ?? 'N/A';
          } catch (e) {
            left.cssRulesLength = `CSSRules inaccessible: ${e.message}`;
          }
        } else {
          left.hasSheet = false;
          left.cssRulesLength = 'N/A (link not found)';
        }

        if (!fetchError) {
          // RIGHT: adoptedStyleSheets
          right.adoptedCount = rightShadow.adoptedStyleSheets?.length ?? 0;
          const faSheet = rightShadow.adoptedStyleSheets?.[0];
          right.hasFASheet = !!faSheet;
          try {
            right.cssRulesLength = faSheet?.cssRules?.length ?? 'N/A';
          } catch (e) {
            right.cssRulesLength = `Error: ${e.message}`;
          }
        }

        // Icon ::before computed style (same for both)
        const readIconStyle = (shadow) => {
          const icon = shadow?.querySelector?.('[data-diagnostics-icon]');
          if (!icon) return { content: 'N/A', fontFamily: 'N/A', fontWeight: 'N/A' };
          try {
            const before = getComputedStyle(icon, '::before');
            return {
              content: before.content || 'N/A',
              fontFamily: before.fontFamily || 'N/A',
              fontWeight: before.fontWeight || 'N/A',
            };
          } catch (e) {
            return { content: `Error: ${e.message}`, fontFamily: 'N/A', fontWeight: 'N/A' };
          }
        };

        left.iconBefore = readIconStyle(leftShadow);
        right.iconBefore = readIconStyle(rightShadow);

        const pass = (iconBefore) => {
          const content = (iconBefore.content || '').toLowerCase();
          const family = (iconBefore.fontFamily || '').toLowerCase();
          if (content === 'none' || content === 'normal') return false;
          return family.includes('font awesome');
        };

        left.pass = pass(left.iconBefore);
        right.pass = fetchError ? false : pass(right.iconBefore);

        setLeftDiag(left);
        setRightDiag(right);
      };

      setTimeout(runDiagnostics, 600);
    })();

    // --- Test 4: adoptedStyleSheets in shadow; FA in main DOM is manual (Load / Remove buttons) ---
    (async () => {
      const test4Shadow = test4Host.attachShadow({ mode: 'open' });
      try {
        const res = await fetch(FA_CSS_PROXY_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        let cssText = await res.text();
        cssText = cssText.replace(/url\s*\(\s*['"]?\.\.\/webfonts\/([^'")\s]+)['"]?\s*\)/g, (_, path) =>
          `url("${FA_WEBFONTS_BASE}${path}")`
        );
        const sheet = new CSSStyleSheet();
        await sheet.replace(cssText);
        test4Shadow.adoptedStyleSheets = [...test4Shadow.adoptedStyleSheets, sheet];
      } catch (e) {
        // continue without sheet
      }
      const test4Body = document.createElement('div');
      test4Body.innerHTML = getSharedInnerHTML('Test 4: global cache + adoptedStyleSheets');
      test4Shadow.appendChild(test4Body);

      const runTest4Diagnostics = () => {
        const shadow = test4HostRef.current?.shadowRoot;
        if (!shadow) return;
        const data = {};
        const preloadNodes = document.querySelectorAll(
          'link[rel="preload"][as="font"][href*="fontawesome.com"]'
        );
        data.preloadHrefs = Array.from(preloadNodes).map((n) => n.href);
        data.preloadLinksPresent = data.preloadHrefs.length > 0;

        const icon = shadow.querySelector('[data-diagnostics-icon]');
        if (icon) {
          try {
            const before = getComputedStyle(icon, '::before');
            data.iconBefore = {
              content: before.content || 'N/A',
              fontFamily: before.fontFamily || 'N/A',
              fontWeight: before.fontWeight || 'N/A',
            };
          } catch (e) {
            data.iconBefore = { content: `Error: ${e.message}`, fontFamily: 'N/A', fontWeight: 'N/A' };
          }
        } else {
          data.iconBefore = { content: 'N/A', fontFamily: 'N/A', fontWeight: 'N/A' };
        }

        try {
          data.fontsCheck = document.fonts.check(`900 16px "${FA_FONT_FAMILY}"`);
        } catch (e) {
          data.fontsCheck = `Error: ${e.message}`;
        }

        const content = (data.iconBefore?.content || '').toLowerCase();
        const family = (data.iconBefore?.fontFamily || '').toLowerCase();
        data.pass = content !== 'none' && content !== 'normal' && family.includes('font awesome');

        setTest4Diag(data);
      };

      runTest4DiagnosticsRef.current = runTest4Diagnostics;
      setTimeout(runTest4Diagnostics, 400);
    })();
  }, []);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Shadow DOM &amp; iframe styling comparison</h1>
      <p className="text-base-content/80 mb-6">
        A: Shadow DOM + &lt;link&gt; in head. B: Shadow DOM + adoptedStyleSheets. C: iframe + &lt;link&gt; in
        document. D: Test 4 — Load FA in main DOM (cache) then adoptedStyleSheets in shadow; manual buttons.
      </p>
      <div className="alert alert-info mb-6 text-sm">
        <span>
          <strong>Why &quot;blocked by CORS policy&quot;?</strong> The Font Awesome server does not
          send <code>Access-Control-Allow-Origin</code>, so <code>fetch(url)</code> from your origin
          (e.g. localhost:3000) is blocked. <code>&lt;link rel=&quot;stylesheet&quot;&gt;</code> still
          loads the CSS for rendering. The right column uses a same-origin proxy so <code>fetch()</code> +
          constructable stylesheet can be tested.
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* LEFT column */}
        <div className="card bg-base-200 shadow-md overflow-hidden">
          <div className="card-body p-4">
            <h2 className="card-title text-sm">Shadow DOM A: link tags</h2>
            <div
              ref={leftHostRef}
              className="min-h-[120px] rounded-lg bg-base-100 border border-base-300"
              aria-label="Left shadow host"
            />
          </div>
          {leftDiag && (
            <div className="px-4 pb-4">
              <DiagnosticsPanel data={leftDiag} side="Left" />
            </div>
          )}
        </div>

        {/* RIGHT column */}
        <div className="card bg-base-200 shadow-md overflow-hidden">
          <div className="card-body p-4">
            <h2 className="card-title text-sm">Shadow DOM B: adoptedStyleSheets</h2>
            <div
              ref={rightHostRef}
              className="min-h-[120px] rounded-lg bg-base-100 border border-base-300"
              aria-label="Right shadow host"
            />
          </div>
          {rightDiag && (
            <div className="px-4 pb-4">
              <DiagnosticsPanel data={rightDiag} side="Right" />
            </div>
          )}
        </div>

        {/* IFRAME column */}
        <div className="card bg-base-200 shadow-md overflow-hidden">
          <div className="card-body p-4">
            <h2 className="card-title text-sm">Iframe C: link in document</h2>
            <div className="min-h-[120px] rounded-lg bg-base-100 border border-base-300 overflow-hidden">
              <iframe
                ref={iframeRef}
                title="Iframe test: same style and content"
                className="w-full min-h-[120px] border-0 block"
                sandbox="allow-same-origin"
              />
            </div>
          </div>
          {iframeDiag && (
            <div className="px-4 pb-4">
              <DiagnosticsPanel data={iframeDiag} side="Iframe" />
            </div>
          )}
        </div>

        {/* Test 4: manual Load FA / Remove FA link + adoptedStyleSheets in shadow */}
        <div className="card bg-base-200 shadow-md overflow-hidden">
          <div className="card-body p-4">
            <h2 className="card-title text-sm">Test 4: global cache + adoptedStyleSheets</h2>
            <div className="flex flex-wrap gap-2 mb-2">
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={async () => {
                  await ensureGlobalFAPreload();
                  runTest4DiagnosticsRef.current?.();
                  runTest5DiagnosticsRef.current?.();
                  checkFontLinks();
                }}
              >
                Load FA in main DOM (preload fonts only)
              </button>
              <button
                type="button"
                className="btn btn-sm btn-outline"
                onClick={() => {
                  removeGlobalFAPreloads();
                  runTest4DiagnosticsRef.current?.();
                  runTest5DiagnosticsRef.current?.();
                  checkFontLinks();
                }}
              >
                Remove FA preloads
              </button>
            </div>
            <div
              ref={test4HostRef}
              className="min-h-[120px] rounded-lg bg-base-100 border border-base-300"
              aria-label="Test 4 shadow host"
            />
          </div>
          {test4Diag && (
            <div className="px-4 pb-4">
              <DiagnosticsPanelTest4 data={test4Diag} />
            </div>
          )}
        </div>

        <div className="card bg-base-200 shadow-md overflow-hidden">
          <div className="card-body p-4">
            <h2 className="card-title text-sm">Font link injection (document.head)</h2>
            {fontLinkHrefs ? (
              fontLinkHrefs.length === 0 ? (
                <span className="text-base-content/70">none</span>
              ) : (
                <ul className="text-sm font-mono space-y-1 break-all">
                  {fontLinkHrefs.map((href) => (
                    <li key={href}>{href}</li>
                  ))}
                </ul>
              )
            ) : (
              <span className="text-base-content/70">—</span>
            )}
          </div>
        </div>
      </div>

      {(!leftDiag || !rightDiag || !iframeDiag || !test4Diag) && (
        <p className="text-base-content/70 mt-4">Loading shadow roots, iframe, Test 4, and diagnostics…</p>
      )}
    </div>
  );
}

function DiagnosticsPanel({ data, side }) {
  return (
    <div className="rounded-lg bg-base-300/50 p-3 text-sm font-mono space-y-1">
      <div className="font-semibold text-base-content">{side} diagnostics</div>
      {'hasSheet' in data && (
        <>
          <div>link.sheet != null: {String(data.hasSheet)}</div>
          <div>link.sheet.cssRules length: {String(data.cssRulesLength)}</div>
        </>
      )}
      {data.fetchError && <div className="text-error">{data.fetchError}</div>}
      {'adoptedCount' in data && !data.fetchError && (
        <>
          <div>adoptedStyleSheets length: {data.adoptedCount}</div>
          <div>has FA sheet: {String(data.hasFASheet)}</div>
          <div>sheet.cssRules length: {String(data.cssRulesLength)}</div>
        </>
      )}
      {data.iconBefore && (
        <>
          <div>::before content: {data.iconBefore.content}</div>
          <div>::before fontFamily: {data.iconBefore.fontFamily}</div>
          <div>::before fontWeight: {data.iconBefore.fontWeight}</div>
        </>
      )}
      <div className="pt-1">
        <span className={data.pass ? 'text-success font-bold' : 'text-error font-bold'}>
          {data.pass ? 'PASS' : 'FAIL'}
        </span>
        <span className="text-base-content/70 ml-1">
          (PASS if ::before content ≠ none/normal and fontFamily includes &quot;Font Awesome&quot;)
        </span>
      </div>
    </div>
  );
}

function DiagnosticsPanelTest4({ data }) {
  return (
    <div className="rounded-lg bg-base-300/50 p-3 text-sm font-mono space-y-1">
      <div className="font-semibold text-base-content">Test 4 diagnostics</div>
      <div>Preload links present: {String(data.preloadLinksPresent)}</div>
      <div>Preload hrefs: {data.preloadHrefs?.length ? data.preloadHrefs.join(', ') : 'none'}</div>
      {data.iconBefore && (
        <>
          <div>::before content: {data.iconBefore.content}</div>
          <div>::before fontFamily: {data.iconBefore.fontFamily}</div>
          <div>::before fontWeight: {data.iconBefore.fontWeight}</div>
        </>
      )}
      <div>document.fonts.check(900 16px &quot;{FA_FONT_FAMILY}&quot;): {String(data.fontsCheck)}</div>
      <div className="pt-1">
        <span className={data.pass ? 'text-success font-bold' : 'text-error font-bold'}>
          {data.pass ? 'PASS' : 'FAIL'}
        </span>
        <span className="text-base-content/70 ml-1">
          (PASS if ::before content ≠ none/normal and fontFamily includes &quot;Font Awesome&quot;)
        </span>
      </div>
    </div>
  );
}

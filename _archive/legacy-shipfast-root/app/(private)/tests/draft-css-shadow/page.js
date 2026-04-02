'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { renderShadowDOM } from '@/libs/content-magic/utils/renderShadowDOM';
import { DRAFT_HTML } from './draftHtml';

// ── CSS / JS helpers ─────────────────────────────────────────────────────────

/** Extract all <style> text from a full HTML document's <head>. */
function extractStyleText(html) {
  if (typeof DOMParser === 'undefined') return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  let css = '';
  doc.querySelectorAll('style').forEach((s) => { css += s.textContent + '\n'; });
  return css;
}

/** Extract <body> innerHTML from a full HTML document. */
function extractBodyHtml(html) {
  if (typeof DOMParser === 'undefined') return html;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body?.innerHTML ?? html;
}

/** Extract non-empty <script> text nodes from <body>. */
function extractScripts(html) {
  if (typeof DOMParser === 'undefined') return [];
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const out = [];
  doc.body?.querySelectorAll('script').forEach((s) => {
    if (s.textContent.trim()) out.push(s.textContent);
  });
  return out;
}

/**
 * Rewrite draft CSS for shadow DOM (only used when a fix strategy is active).
 * - :root → :host (design tokens apply to shadow host)
 * - html { … } → :host { … }
 * - body { … } → :host > .editorContent { … }
 */
function rewriteBodyHtmlSelectors(css) {
  return css
    .replace(/:root\b/g, ':host')
    .replace(/(?<![a-zA-Z0-9_-])html(\s*\{)/g, ':host$1')
    .replace(/(?<![a-zA-Z0-9_-])body(\s*\{)/g, ':host > .editorContent$1');
}

/**
 * Patch script text so DOM queries target shadowRoot instead of document.
 * The patched function is called with `shadowRoot` as the first argument.
 */
function patchScriptForShadowScope(scriptText) {
  return scriptText
    .replace(/document\.getElementById\(/g, 'shadowRoot.getElementById(')
    .replace(/document\.querySelectorAll\(/g, 'shadowRoot.querySelectorAll(')
    .replace(/document\.querySelector\(/g, 'shadowRoot.querySelector(');
}

/** Run patched scripts with the shadow root in scope. */
function runPatchedScripts(scripts, shadowRoot) {
  const errors = [];
  scripts.forEach((text, i) => {
    const patched = patchScriptForShadowScope(text);
    try {
      // eslint-disable-next-line no-new-func
      new Function('shadowRoot', patched)(shadowRoot);
    } catch (e) {
      errors.push({ index: i, message: e?.message || String(e) });
      console.warn('[draft-css-shadow] patched script error:', e);
    }
  });
  return errors;
}

// ── diagnostics ───────────────────────────────────────────────────────────────

const LOG_PREFIX = '[draft-css-shadow]';

/**
 * Run diagnostics on the right panel's shadow DOM and return a structured report.
 * Also logs the same info to console for DevTools.
 */
function runDiagnostics(hostElement, strategyId) {
  const report = {
    strategyId,
    timestamp: new Date().toISOString(),
    hasShadowRoot: false,
    shadowChildSummary: [],
    styleNodes: { count: 0, totalCssLength: 0, inWrapper: false, sampleSelectors: [] },
    cssVariables: {},
    computedStyles: {},
    scriptErrors: [],
    errors: [],
  };

  if (!hostElement || !hostElement.shadowRoot) {
    report.errors.push('No host or shadowRoot on host element');
    console.warn(LOG_PREFIX, 'Diagnostics: no shadow root', report);
    return report;
  }

  const shadow = hostElement.shadowRoot;
  report.hasShadowRoot = true;

  // Shadow structure
  const childNodes = Array.from(shadow.childNodes).filter((n) => n.nodeType === Node.ELEMENT_NODE);
  report.shadowChildSummary = childNodes.map((n) => {
    const el = /** @type {Element} */ (n);
    const tag = el.tagName?.toLowerCase() || '?';
    const attrs = [];
    if (el.getAttribute?.('data-extracted-styles-wrapper')) attrs.push('data-extracted-styles-wrapper');
    if (el.className && typeof el.className === 'string') attrs.push(`class="${el.className}"`);
    return `${tag}${attrs.length ? ` [${attrs.join(', ')}]` : ''}`;
  });

  // Style nodes: count and where they live
  const allStyles = shadow.querySelectorAll('style');
  report.styleNodes.count = allStyles.length;
  report.styleNodes.totalCssLength = Array.from(allStyles).reduce((sum, s) => sum + (s.textContent?.length ?? 0), 0);
  const wrapper = shadow.querySelector('[data-extracted-styles-wrapper]');
  report.styleNodes.inWrapper = !!wrapper;
  if (wrapper) {
    report.styleNodes.wrapperStyleCount = wrapper.querySelectorAll('style').length;
  }
  // Sample: do we have :root, body, .hero in the injected CSS?
  const fullCss = Array.from(allStyles).map((s) => s.textContent ?? '').join('\n');
  report.styleNodes.sampleSelectors = [
    fullCss.includes(':root') ? ':root present' : ':root MISSING',
    fullCss.includes('body ') || fullCss.includes('body{') ? 'body present' : 'body MISSING',
    fullCss.includes('.hero ') || fullCss.includes('.hero{') ? '.hero present' : '.hero MISSING',
    fullCss.includes(':host') ? ':host present' : ':host absent',
  ];

  // CSS custom properties: read from host (shadow host) and from first element inside shadow
  const host = hostElement;
  const firstInner = shadow.querySelector('.editorContent') || shadow.firstElementChild;
  try {
    const hostStyle = getComputedStyle(host);
    report.cssVariables.host = {
      '--color-navy': hostStyle.getPropertyValue('--color-navy').trim() || '(not set)',
      '--color-gold': hostStyle.getPropertyValue('--color-gold').trim() || '(not set)',
    };
  } catch (e) {
    report.cssVariables.host = { error: e?.message };
  }
  if (firstInner) {
    try {
      const innerStyle = getComputedStyle(firstInner);
      report.cssVariables.editorContent = {
        '--color-navy': innerStyle.getPropertyValue('--color-navy').trim() || '(not set)',
        '--color-gold': innerStyle.getPropertyValue('--color-gold').trim() || '(not set)',
      };
    } catch (e) {
      report.cssVariables.editorContent = { error: e?.message };
    }
  }

  // Computed styles on key elements (hero should be navy, h1 white, btn gold)
  const editorContent = shadow.querySelector('.editorContent');
  if (editorContent) {
    const hero = editorContent.querySelector('.hero');
    const heroH1 = editorContent.querySelector('.hero h1');
    const btnPrimary = editorContent.querySelector('.btn-primary');
    const tryStyle = (el, label) => {
      if (!el) return { element: label, found: false };
      try {
        const s = getComputedStyle(el);
        return {
          element: label,
          found: true,
          backgroundColor: s.backgroundColor,
          color: s.color,
          fontFamily: s.fontFamily?.slice(0, 40),
        };
      } catch (e) {
        return { element: label, found: true, error: e?.message };
      }
    };
    report.computedStyles.hero = tryStyle(hero, '.hero');
    report.computedStyles.heroH1 = tryStyle(heroH1, '.hero h1');
    report.computedStyles.btnPrimary = tryStyle(btnPrimary, '.btn-primary');
    report.computedStyles.editorContent = tryStyle(editorContent, '.editorContent');
  } else {
    report.errors.push('.editorContent not found in shadow');
  }

  // Log to console for copy-paste / breakpoints
  console.group(LOG_PREFIX, 'Diagnostics', strategyId);
  console.log('Shadow children:', report.shadowChildSummary);
  console.log('Style nodes:', report.styleNodes);
  console.log('CSS variables:', report.cssVariables);
  console.log('Computed styles:', report.computedStyles);
  if (report.errors.length) console.warn('Errors:', report.errors);
  console.groupEnd();

  return report;
}

// ── strategy definitions ──────────────────────────────────────────────────────

const STRATEGIES = [
  {
    id: 'reset',
    label: 'Reset (baseline)',
    description:
      'Calls renderShadowDOM() as-is — the same path used by the content magic editor. ' +
      'Shows the unmodified shadow DOM rendering so you can see the discrepancy.',
  },
  {
    id: 'fix1',
    label: 'Fix 1: body/html → :host rewrite',
    description:
      'Rewrites CSS selectors before injection: body{} → :host>.editorContent{} and html{} → :host{}. ' +
      'Fixes base font, color, background, and line-height that body{} would normally set.',
  },
  {
    id: 'fix2',
    label: 'Fix 2: Inject :host base shim',
    description:
      'Keeps renderShadowDOM() CSS injection intact and prepends an extra <style> that explicitly ' +
      'mirrors what body{} would set onto :host>.editorContent. A targeted override rather than a full rewrite.',
  },
  {
    id: 'fix3',
    label: 'Fix 3: Patch JS scope',
    description:
      'No CSS change — same broken styling as baseline. Rewrites document.getElementById → ' +
      'shadowRoot.getElementById so the tab switcher and mobile nav actually work inside the shadow tree.',
  },
  {
    id: 'fix4',
    label: 'Fix 4: CSS rewrite + JS patch',
    description:
      'Combines Fix 1 (CSS selector rewrite) and Fix 3 (scoped JS). ' +
      'Should produce the closest match to the main-DOM iframe reference.',
  },
];

// ── strategy builders ─────────────────────────────────────────────────────────

async function buildReset() {
  return renderShadowDOM(DRAFT_HTML);
}

function buildFix1() {
  const host = document.createElement('div');
  host.className = 'w-full h-full';
  const shadow = host.attachShadow({ mode: 'open' });

  const styleEl = document.createElement('style');
  styleEl.textContent = rewriteBodyHtmlSelectors(extractStyleText(DRAFT_HTML));
  shadow.appendChild(styleEl);

  const editorEl = document.createElement('div');
  editorEl.className = 'editorContent';
  editorEl.style.wordBreak = 'break-word';
  editorEl.style.overflowWrap = 'break-word';
  editorEl.innerHTML = extractBodyHtml(DRAFT_HTML);
  shadow.appendChild(editorEl);

  return host;
}

async function buildFix2() {
  const host = await renderShadowDOM(DRAFT_HTML);
  const shadow = host.shadowRoot;
  if (shadow) {
    const shim = document.createElement('style');
    shim.setAttribute('data-host-shim', 'true');
    shim.textContent = `
      :host > .editorContent {
        font-family: 'Helvetica Neue', 'Arial', sans-serif;
        color: #1a2e4a;
        background: #ffffff;
        line-height: 1.6;
        font-size: 16px;
        -webkit-font-smoothing: antialiased;
      }
      :host > .editorContent a { color: inherit; text-decoration: none; }
      :host > .editorContent ul { list-style: none; }
      :host > .editorContent img { max-width: 100%; display: block; }
    `;
    shadow.insertBefore(shim, shadow.firstChild);
  }
  return host;
}

function buildFix3() {
  const host = document.createElement('div');
  host.className = 'w-full h-full';
  const shadow = host.attachShadow({ mode: 'open' });

  // Mirror renderShadowDOM style injection (no rewrite)
  const stylesWrapper = document.createElement('div');
  stylesWrapper.setAttribute('data-extracted-styles-wrapper', 'true');
  const styleEl = document.createElement('style');
  styleEl.textContent = extractStyleText(DRAFT_HTML);
  stylesWrapper.appendChild(styleEl);
  shadow.appendChild(stylesWrapper);

  // Body content — strip <script> tags (we re-run them patched below)
  const editorEl = document.createElement('div');
  editorEl.className = 'editorContent';
  editorEl.style.wordBreak = 'break-word';
  editorEl.style.overflowWrap = 'break-word';
  editorEl.innerHTML = extractBodyHtml(DRAFT_HTML).replace(/<script[\s\S]*?<\/script>/gi, '');
  shadow.appendChild(editorEl);

  runPatchedScripts(extractScripts(DRAFT_HTML), shadow);

  return host;
}

function buildFix4() {
  const host = document.createElement('div');
  host.className = 'w-full h-full';
  const shadow = host.attachShadow({ mode: 'open' });

  const styleEl = document.createElement('style');
  styleEl.textContent = rewriteBodyHtmlSelectors(extractStyleText(DRAFT_HTML));
  shadow.appendChild(styleEl);

  const editorEl = document.createElement('div');
  editorEl.className = 'editorContent';
  editorEl.style.wordBreak = 'break-word';
  editorEl.style.overflowWrap = 'break-word';
  editorEl.innerHTML = extractBodyHtml(DRAFT_HTML).replace(/<script[\s\S]*?<\/script>/gi, '');
  shadow.appendChild(editorEl);

  runPatchedScripts(extractScripts(DRAFT_HTML), shadow);

  return host;
}

// ── page component ────────────────────────────────────────────────────────────

export default function TestDraftCssShadowPage() {
  const rightContainerRef = useRef(null);
  const [activeId, setActiveId] = useState('reset');
  const [loading, setLoading] = useState(false);
  const [diagnostics, setDiagnostics] = useState(null);

  const applyStrategy = useCallback(async (id) => {
    const container = rightContainerRef.current;
    if (!container) return;
    setLoading(true);
    setDiagnostics(null);
    container.innerHTML = '';

    let host;
    switch (id) {
      case 'reset': host = await buildReset();  break;
      case 'fix1':  host = buildFix1();         break;
      case 'fix2':  host = await buildFix2();   break;
      case 'fix3':  host = buildFix3();         break;
      case 'fix4':  host = buildFix4();         break;
      default:      host = await buildReset();
    }

    container.appendChild(host);

    // Run diagnostics on the host we just appended (first child of container)
    const appendedHost = container.firstElementChild;
    if (appendedHost) {
      const report = runDiagnostics(appendedHost, id);
      setDiagnostics(report);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    applyStrategy('reset');
  }, [applyStrategy]);

  const active = STRATEGIES.find((s) => s.id === activeId);

  return (
    <div className="p-4 max-w-[1600px] mx-auto">
      <h1 className="text-2xl font-bold mb-1">Draft CSS: Main DOM vs Shadow DOM</h1>
      <p className="text-base-content/70 text-sm mb-4">
        Left: <code className="font-mono text-xs">iframe srcdoc</code> — true browser rendering (reference).
        Right: <code className="font-mono text-xs">renderShadowDOM()</code> — same path as the content magic editor.
        Click a fix strategy to rebuild the right panel.
      </p>

      {/* Fix buttons */}
      <div className="flex flex-wrap items-center gap-2 mb-1">
        {STRATEGIES.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            disabled={loading}
            className={`btn btn-sm ${activeId === id ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => {
              setActiveId(id);
              applyStrategy(id);
            }}
          >
            {label}
          </button>
        ))}
        {loading && <span className="loading loading-spinner loading-sm ml-1" />}
      </div>

      {active && (
        <p className="text-xs text-base-content/60 mb-4 pl-1 max-w-3xl">{active.description}</p>
      )}

      {/* Split panels */}
      <div className="grid grid-cols-2 gap-3">

        {/* LEFT — main DOM reference */}
        <div className="flex flex-col gap-1">
          <div className="text-xs font-semibold uppercase tracking-wider text-base-content/50">
            Main DOM — iframe (reference)
          </div>
          <div
            className="border border-base-300 rounded-lg overflow-hidden"
            style={{ height: 700 }}
          >
            <iframe
              title="Main DOM reference"
              srcDoc={DRAFT_HTML}
              className="w-full h-full border-0 block"
              sandbox="allow-scripts allow-same-origin"
            />
          </div>
        </div>

        {/* RIGHT — shadow DOM */}
        <div className="flex flex-col gap-1">
          <div className="text-xs font-semibold uppercase tracking-wider text-base-content/50">
            Shadow DOM via{' '}
            <code className="font-mono lowercase text-xs">renderShadowDOM</code>
            {active && (
              <span className="text-primary normal-case ml-1">[{active.label}]</span>
            )}
          </div>
          <div
            className="border border-base-300 rounded-lg overflow-auto"
            style={{ height: 700 }}
          >
            <div ref={rightContainerRef} className="w-full h-full" />
          </div>
        </div>

      </div>

      {/* Diagnostics panel */}
      {diagnostics && (
        <div className="mt-6 border border-base-300 rounded-lg bg-base-200 overflow-hidden">
          <div className="px-4 py-2 bg-base-300 font-semibold text-sm">
            Shadow DOM diagnostics — strategy: {diagnostics.strategyId}
          </div>
          <div className="p-4 font-mono text-xs overflow-x-auto space-y-3">
            {diagnostics.errors?.length > 0 && (
              <div className="text-error">
                <strong>Errors:</strong> {diagnostics.errors.join('; ')}
              </div>
            )}
            <div>
              <strong>Shadow structure:</strong>{' '}
              {diagnostics.shadowChildSummary?.length ? diagnostics.shadowChildSummary.join(', ') : '—'}
            </div>
            <div>
              <strong>Style nodes:</strong> count={diagnostics.styleNodes?.count ?? '—'}, totalCssLength=
              {diagnostics.styleNodes?.totalCssLength ?? '—'}
              {diagnostics.styleNodes?.inWrapper != null && (
                <>, inWrapper={String(diagnostics.styleNodes.inWrapper)}</>
              )}
              {diagnostics.styleNodes?.wrapperStyleCount != null && (
                <>, wrapperStyleCount={diagnostics.styleNodes.wrapperStyleCount}</>
              )}
              {diagnostics.styleNodes?.sampleSelectors?.length > 0 && (
                <div className="mt-1 text-base-content/80">
                  {diagnostics.styleNodes.sampleSelectors.join(' | ')}
                </div>
              )}
            </div>
            <div>
              <strong>CSS variables (--color-navy, --color-gold):</strong>
              <pre className="mt-1 whitespace-pre-wrap break-all">
                host: {JSON.stringify(diagnostics.cssVariables?.host)}
                editorContent: {JSON.stringify(diagnostics.cssVariables?.editorContent)}
              </pre>
            </div>
            <div>
              <strong>Computed styles (expected: .hero bg navy, .hero h1 white, .btn-primary gold):</strong>
              <pre className="mt-1 whitespace-pre-wrap break-all">
                {JSON.stringify(diagnostics.computedStyles, null, 2)}
              </pre>
            </div>
            <p className="text-base-content/60 pt-1">
              Same data is logged to the browser console under &quot;{LOG_PREFIX} Diagnostics&quot; for copy-paste or breakpoints.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

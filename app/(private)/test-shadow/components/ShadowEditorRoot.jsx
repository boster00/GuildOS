"use client";

import React, { useRef, useEffect, useState } from "react";
import { createPortal } from "react-dom";

const BASE_RESET_CSS = `
:host, #shadow-app-root {
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  color: #000;
  line-height: 1.5;
  display: block;
  box-sizing: border-box;
}
#shadow-app-root *,
#shadow-app-root *::before,
#shadow-app-root *::after {
  box-sizing: border-box;
}
`;

/**
 * Wraps children in a single ShadowRoot. Injects external stylesheet links
 * and inline CSS. Portals the React subtree into the shadow root.
 *
 * @param {string[]} cssLinks - URLs to CSS files (same-origin recommended)
 * @param {string} inlineCss - Small overrides / debug styles
 * @param {React.ReactNode} children - Editor components to render inside shadow
 * @param {function(ShadowRoot|null): void} onShadowRootReady - Called with shadow root when ready (or null on unmount)
 */
export default function ShadowEditorRoot({
  cssLinks = [],
  inlineCss = "",
  children,
  onShadowRootReady,
}) {
  const hostRef = useRef(null);
  const [shadowAppRoot, setShadowAppRoot] = useState(null);

  // Mount: create shadow root and portal target once
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const shadowRoot = host.attachShadow({ mode: "open" });

    // Style container (head-like)
    const styleContainer = document.createElement("div");
    styleContainer.setAttribute("data-shadow-styles", "true");

    // 1. Base reset (always present)
    const resetStyle = document.createElement("style");
    resetStyle.textContent = BASE_RESET_CSS;
    styleContainer.appendChild(resetStyle);

    shadowRoot.appendChild(styleContainer);

    // 2. App root for portal target
    const appRoot = document.createElement("div");
    appRoot.id = "shadow-app-root";
    shadowRoot.appendChild(appRoot);

    setShadowAppRoot(appRoot);
    if (onShadowRootReady) onShadowRootReady(shadowRoot);

    return () => {
      if (onShadowRootReady) onShadowRootReady(null);
      setShadowAppRoot(null);
    };
  }, [onShadowRootReady]);

  // Update styles when cssLinks or inlineCss change (don't destroy portal)
  useEffect(() => {
    const host = hostRef.current;
    const root = host?.shadowRoot;
    if (!root) return;

    const styleContainer = root.querySelector("[data-shadow-styles]");
    if (!styleContainer) return;

    // Keep only the first child (base reset)
    while (styleContainer.children.length > 1) {
      styleContainer.removeChild(styleContainer.lastChild);
    }

    // 2. External links (stable order; later overrides earlier)
    (cssLinks || []).forEach((href) => {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      styleContainer.appendChild(link);
    });

    // 3. Inline CSS
    if (inlineCss && inlineCss.trim()) {
      const inlineStyle = document.createElement("style");
      inlineStyle.textContent = inlineCss;
      styleContainer.appendChild(inlineStyle);
    }
  }, [cssLinks, inlineCss]);

  return (
    <div ref={hostRef} className="ShadowEditorHost" style={{ display: "block", height: "100%", minHeight: 0 }}>
      {shadowAppRoot && createPortal(children, shadowAppRoot)}
    </div>
  );
}

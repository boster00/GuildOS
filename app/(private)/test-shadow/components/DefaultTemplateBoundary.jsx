"use client";

import React, { useRef, useEffect, useState } from "react";
import { createPortal } from "react-dom";

const NESTED_RESET_CSS = `
:host, .default-template-inner {
  font-family: system-ui, -apple-system, sans-serif;
  color: #111;
  line-height: 1.5;
  display: block;
  box-sizing: border-box;
}
.default-template-inner *,
.default-template-inner *::before,
.default-template-inner *::after {
  box-sizing: border-box;
}
`;

/**
 * Wraps default-template content in a nested ShadowRoot so user CSS
 * in the parent shadow cannot affect it.
 *
 * @param {string} cssText - Controlled default template stylesheet content
 * @param {React.ReactNode} children - Template content to render inside nested shadow
 */
export default function DefaultTemplateBoundary({ cssText = "", children }) {
  const hostRef = useRef(null);
  const [innerRoot, setInnerRoot] = useState(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const shadowRoot = host.attachShadow({ mode: "open" });

    // 1. Minimal reset
    const resetStyle = document.createElement("style");
    resetStyle.textContent = NESTED_RESET_CSS;
    shadowRoot.appendChild(resetStyle);

    // 2. Controlled default template CSS
    if (cssText && cssText.trim()) {
      const style = document.createElement("style");
      style.textContent = cssText;
      shadowRoot.appendChild(style);
    }

    // 3. Inner container for portaled content
    const inner = document.createElement("div");
    inner.className = "default-template-inner";
    shadowRoot.appendChild(inner);

    setInnerRoot(inner);

    return () => setInnerRoot(null);
  }, [cssText]);

  return (
    <div ref={hostRef} className="default-template-host" style={{ display: "block" }}>
      {innerRoot && createPortal(children, innerRoot)}
    </div>
  );
}

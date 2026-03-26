// ARCHIVED: Original path was app/(private)/content-magic/components/RefinementFullscreenLayout.js

"use client";
import React from "react";

export default function RefinementFullscreenLayout({ children }) {
  return (
    <div className="fixed inset-0 bg-white z-50 overflow-y-auto">
      {children}
    </div>
  );
}


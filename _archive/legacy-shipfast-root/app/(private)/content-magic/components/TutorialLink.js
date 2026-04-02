"use client";
import React, { useState } from "react";
import { Video } from "lucide-react";
import TutorialPopup from "./TutorialPopup";

export default function TutorialLink({ tutorialURL, tutorialTitle, size = "md" }) {
  const [isPopupOpen, setIsPopupOpen] = useState(false);

  if (!tutorialURL) return null;

  const isSmall = size === "sm";
  const baseClass = "inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-800 cursor-pointer";
  const sizeClass = isSmall ? "text-xs gap-1" : "text-sm gap-1.5";
  const iconSize = isSmall ? "w-3.5 h-3.5" : "w-4 h-4";

  return (
    <>
      <button
        type="button"
        onClick={() => setIsPopupOpen(true)}
        className={`${baseClass} ${sizeClass}`}
        title={tutorialTitle || "Watch tutorial for this step"}
      >
        <Video className={`${iconSize} flex-shrink-0`} />
        <span>Watch tutorial for this step</span>
      </button>
      <TutorialPopup
        isOpen={isPopupOpen}
        onClose={() => setIsPopupOpen(false)}
        shareUrl={tutorialURL}
        title={tutorialTitle}
      />
    </>
  );
}

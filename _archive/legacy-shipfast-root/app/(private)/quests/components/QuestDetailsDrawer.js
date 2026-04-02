"use client";

import React, { useEffect, useRef, useState } from "react";
import { X, Copy, Link2 } from "lucide-react";
import { getQuestIcon } from "./questIcons";

function categoryLabel(category) {
  const map = {
    Growth: "Growth",
    SocialProof: "Social Proof",
    Activation: "Activation",
    Streaks: "Streaks",
    Community: "Community",
    Revenue: "Revenue",
  };
  return map[category] || category;
}

function getCtaLabel(quest) {
  switch (quest.status) {
    case "available":
      return "Start";
    case "in_progress":
      return "Continue";
    case "needs_verification":
      return "Submit for review";
    case "completed":
      return "Completed";
    case "locked":
      return "Locked";
    default:
      return "Start";
  }
}

export default function QuestDetailsDrawer({
  quest,
  isOpen,
  onClose,
  onPrimaryAction,
  onCopyReferralLink,
  isMobile,
}) {
  const [stepChecked, setStepChecked] = useState({});
  const [verificationLink, setVerificationLink] = useState("");
  const [verificationPlatform, setVerificationPlatform] = useState("");
  const [copyToast, setCopyToast] = useState(false);
  const overlayRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) {
      setStepChecked({});
      setVerificationLink("");
      setVerificationPlatform("");
    }
  }, [isOpen, quest?.id]);

  if (!quest) return null;

  const Icon = getQuestIcon(quest.iconName);
  const ctaLabel = getCtaLabel(quest);
  const isLocked = quest.status === "locked";
  const isCompleted = quest.status === "completed";
  const progress = quest.progress;
  const showProgress = progress && progress.total > 1;

  const handleCopy = () => {
    if (onCopyReferralLink) onCopyReferralLink();
    else {
      navigator.clipboard?.writeText("https://app.example.com/ref/mock").then(() => {
        setCopyToast(true);
        setTimeout(() => setCopyToast(false), 2000);
      });
    }
  };

  const handlePrimary = () => {
    if (isLocked || isCompleted) return;
    onPrimaryAction(quest.id);
  };

  const steps = [
    quest.progress?.total ? `Complete step 1 of ${quest.progress.total}` : "Complete the required actions",
    quest.requiresVerification ? "Submit for verification" : null,
  ].filter(Boolean);

  const panelContent = (
    <div className="flex h-full flex-col bg-base-100 shadow-xl">
      <div className="flex items-center justify-between border-b border-base-300 p-4">
        <h2 id="drawer-title" className="text-lg font-bold text-base-content">
          Quest details
        </h2>
        <button
          type="button"
          className="btn btn-ghost btn-square btn-sm"
          onClick={onClose}
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-primary/10 p-2 shrink-0">
            <Icon className="h-6 w-6 text-primary" aria-hidden />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-base-content">{quest.title}</h3>
            <div className="flex flex-wrap gap-1.5 mt-1">
              <span className="badge badge-outline badge-sm">
                {categoryLabel(quest.category)}
              </span>
              <span className="badge badge-ghost badge-sm">{quest.difficulty}</span>
              {quest.requiresVerification && (
                <span className="badge badge-warning badge-sm">Verification</span>
              )}
            </div>
            <p className="mt-2 text-primary font-medium">
              +{quest.rewardCredits} credits
            </p>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-medium text-base-content/80 mb-1">Description</h4>
          <p className="text-sm text-base-content/70 whitespace-pre-wrap">
            {quest.longDescription}
          </p>
        </div>

        {steps.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-base-content/80 mb-2">Steps</h4>
            <ul className="space-y-2">
              {steps.map((step, i) => (
                <li key={i} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-sm"
                    checked={stepChecked[i]}
                    onChange={(e) =>
                      setStepChecked((prev) => ({ ...prev, [i]: e.target.checked }))
                    }
                    aria-label={step}
                  />
                  <span className="text-sm text-base-content/70">{step}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {showProgress && (
          <div>
            <div className="flex justify-between text-xs text-base-content/60 mb-0.5">
              <span>Progress</span>
              <span>
                {progress.current}/{progress.total}
              </span>
            </div>
            <progress
              className="progress progress-primary h-2 w-full"
              value={progress.current}
              max={progress.total}
            />
          </div>
        )}

        {quest.requiresVerification && (
          <div className="space-y-3 border border-base-300 rounded-lg p-3">
            <h4 className="text-sm font-medium text-base-content/80">
              Verification
            </h4>
            {quest.verificationType === "review" && (
              <>
                <select
                  className="select select-bordered select-sm w-full"
                  value={verificationPlatform}
                  onChange={(e) => setVerificationPlatform(e.target.value)}
                  aria-label="Platform"
                >
                  <option value="">Platform</option>
                  <option value="g2">G2</option>
                  <option value="capterra">Capterra</option>
                </select>
                <input
                  type="url"
                  className="input input-bordered input-sm w-full"
                  placeholder="Paste your review link"
                  value={verificationLink}
                  onChange={(e) => setVerificationLink(e.target.value)}
                  aria-label="Review link"
                />
              </>
            )}
            {(quest.verificationType === "social_post" || !quest.verificationType) && (
              <>
                <textarea
                  className="textarea textarea-bordered textarea-sm w-full"
                  placeholder="Paste link to your post or submission"
                  rows={2}
                  value={verificationLink}
                  onChange={(e) => setVerificationLink(e.target.value)}
                  aria-label="Verification link"
                />
                <div className="text-sm text-base-content/60">
                  Upload screenshot (UI only — not functional)
                </div>
                <button type="button" className="btn btn-ghost btn-sm" disabled>
                  Upload screenshot
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-base-300 p-4 space-y-2">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={`btn btn-primary flex-1 min-w-[120px] ${isCompleted || isLocked ? "btn-disabled" : ""}`}
            disabled={isCompleted || isLocked}
            onClick={handlePrimary}
          >
            {ctaLabel}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm gap-1"
            onClick={handleCopy}
            aria-label="Copy referral link"
          >
            <Copy className="h-4 w-4" />
            Copy referral link
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onClose}
          >
            Dismiss
          </button>
        </div>
        {copyToast && (
          <p className="text-sm text-success flex items-center gap-1">
            <Link2 className="h-4 w-4" /> Copied!
          </p>
        )}
      </div>
    </div>
  );

  if (!isOpen) return null;

  if (isMobile) {
    return (
      <div
        className="fixed inset-0 z-50 flex flex-col justify-end"
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
        ref={overlayRef}
      >
        <div
          className="absolute inset-0 bg-black/50"
          onClick={onClose}
          aria-hidden
        />
        <div
          className="relative max-h-[85vh] overflow-hidden rounded-t-2xl transition-transform"
          style={{ transform: "translateY(0)" }}
        >
          {panelContent}
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-title"
    >
      <div
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative w-full max-w-md bg-base-100 h-full">
        {panelContent}
      </div>
    </div>
  );
}

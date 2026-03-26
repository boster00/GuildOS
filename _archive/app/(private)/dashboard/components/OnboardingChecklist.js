// ARCHIVED: Original path was app/(private)/dashboard/components/OnboardingChecklist.js

"use client";
import React from "react";
import Link from "next/link";
import { CheckCircle2, Circle } from "lucide-react";
import styles from "./OnboardingChecklist.module.css";

export default function OnboardingChecklist({ hasIcp = false, hasPrompt = false }) {
  const steps = [
    {
      title: "Create your first ICP",
      description: "Define your ideal customer profile",
      completed: hasIcp,
      link: "/icps",
      linkText: "Create ICP",
    },
    {
      title: "Add project / prompts",
      description: "Create a visibility tracking project and add prompts",
      completed: hasPrompt,
      link: "/geo-seo-visibility-tracking",
      linkText: "Add project / prompts",
    },
    {
      title: "Run your first scan",
      description: "Start tracking visibility metrics",
      completed: false,
      linkText: "Run Scan (Coming Soon)",
      disabled: true,
    },
  ];

  const completedCount = steps.filter((s) => s.completed).length;
  const progress = (completedCount / steps.length) * 100;

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <div className={styles.headerContent}>
          <h3 className={styles.cardTitle}>Getting Started</h3>
          <span className={styles.progressText}>
            {completedCount}/{steps.length} Complete
          </span>
        </div>
        <div className={styles.progressBarContainer}>
          <div
            className={styles.progressBar}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
      
      <div className={styles.cardContent}>
        {steps.map((step, index) => (
          <div key={index} className={styles.stepItem}>
            <div className={styles.iconContainer}>
              {step.completed ? (
                <CheckCircle2 className={styles.completedIcon} />
              ) : (
                <Circle className={styles.incompleteIcon} />
              )}
            </div>
            <div className={styles.stepContent}>
              <h4 className={styles.stepTitle}>{step.title}</h4>
              <p className={styles.stepDescription}>{step.description}</p>
              {!step.completed && (
                <div className={styles.actionContainer}>
                  {step.link && !step.disabled ? (
                    <Link href={step.link} className={styles.actionButton}>
                      {step.linkText}
                    </Link>
                  ) : (
                    <button 
                      className={`${styles.actionButton} ${step.disabled ? styles.disabledButton : ''}`}
                      disabled={step.disabled}
                    >
                      {step.linkText}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
"use client";

import React from "react";
import { FileText } from "lucide-react";

export default function RulesCard({ onOpenRulesModal }) {
  return (
    <div className="card bg-base-100 border border-base-300 shadow-sm">
      <div className="card-body">
        <h2 className="card-title text-base flex items-center gap-2">
          <FileText className="h-5 w-5 text-base-content/70" aria-hidden />
          Rules
        </h2>
        <p className="text-xs text-base-content/70">
          Credits from quests are subject to anti-abuse checks. Verification quests
          may require manual review. Fraud or misuse can result in revoked rewards.
        </p>
        {onOpenRulesModal && (
          <button
            type="button"
            className="btn btn-ghost btn-sm mt-1"
            onClick={onOpenRulesModal}
            aria-label="Open quest economy rules"
          >
            Quest economy rules
          </button>
        )}
      </div>
    </div>
  );
}

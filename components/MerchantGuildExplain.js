"use client";

import { useState } from "react";

export const MERCHANT_GUILD_EXPLAIN_TOOLTIP =
  "Explain to me again, this time in the Merchant Guild's language";

/**
 * Default: guild / fantasy copy. Click Explain → merchant (plain) copy; click Story → fantasy again.
 * Hover: Merchant Guild tooltip (title + DaisyUI data-tip).
 */
export function MerchantGuildExplain({ fantasy, merchant, className = "" }) {
  const [merchantMode, setMerchantMode] = useState(false);

  return (
    <div className={className}>
      <div className="flex flex-wrap items-start gap-2 sm:gap-3">
        <div className="min-w-0 flex-1 text-sm leading-relaxed text-base-content/80">
          {merchantMode ? merchant : fantasy}
        </div>
        <span
          className="tooltip tooltip-left z-10 shrink-0 before:max-w-[min(18rem,92vw)] before:whitespace-normal before:text-left before:content-[attr(data-tip)]"
          data-tip={MERCHANT_GUILD_EXPLAIN_TOOLTIP}
        >
          <button
            type="button"
            className="btn btn-ghost btn-xs h-auto min-h-8 gap-1 border border-base-300/70 px-2 py-1 font-normal normal-case text-base-content/70 hover:bg-base-200"
            title={MERCHANT_GUILD_EXPLAIN_TOOLTIP}
            aria-pressed={merchantMode}
            aria-label={
              merchantMode
                ? "Show guild (fantasy) wording again"
                : MERCHANT_GUILD_EXPLAIN_TOOLTIP
            }
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setMerchantMode((v) => !v);
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-4 w-4 shrink-0 opacity-80"
              aria-hidden
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0ZM8.94 6.94a.75.75 0 1 1-1.061-1.061 3 3 0 1 1 2.871 5.026v.345a.75.75 0 0 1-1.5 0v-.5c0-.72.57-1.172 1.081-1.287A1.5 1.5 0 1 0 8.94 6.94ZM10 15a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
                clipRule="evenodd"
              />
            </svg>
            <span>{merchantMode ? "Story" : "Explain"}</span>
          </button>
        </span>
      </div>
    </div>
  );
}

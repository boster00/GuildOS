"use client";

import React from "react";
import { Target, Coins } from "lucide-react";

export default function QuestHeader({ creditBalance = 0 }) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-base-content sm:text-3xl">
          <Target className="h-8 w-8 text-primary" aria-hidden />
          Quests
        </h1>
        <p className="mt-1 text-sm text-base-content/70 sm:text-base">
          Complete quests to earn credits and unlock rewards. Grow your impact and help others discover the product.
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="badge badge-lg gap-1.5 bg-primary/10 text-primary border border-primary/20 px-3 py-2">
          <Coins className="h-4 w-4" aria-hidden />
          <span>{creditBalance.toLocaleString()} credits</span>
        </span>
      </div>
    </header>
  );
}

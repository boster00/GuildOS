"use client";

import React from "react";
import { Trophy } from "lucide-react";

const MOCK_LEADERBOARD = [
  { rank: 1, name: "Alex M.", points: 2840 },
  { rank: 2, name: "Sam K.", points: 2520 },
  { rank: 3, name: "Jordan L.", points: 2190 },
  { rank: 4, name: "Riley P.", points: 1950 },
  { rank: 5, name: "Casey T.", points: 1680 },
];

const MOCK_USER_RANK = 12;
const MOCK_USER_POINTS = 420;

export default function LeaderboardPanel() {
  return (
    <div className="card bg-base-100 border border-base-300 shadow-sm">
      <div className="card-body">
        <h2 className="card-title text-base flex items-center gap-2">
          <Trophy className="h-5 w-5 text-warning" aria-hidden />
          Top Champions this week
        </h2>
        <ul className="space-y-1.5" role="list" aria-label="Leaderboard">
          {MOCK_LEADERBOARD.map((entry) => (
            <li
              key={entry.rank}
              className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-base-200/50"
            >
              <span className="font-medium text-base-content/70">
                #{entry.rank}
              </span>
              <span className="text-sm text-base-content">{entry.name}</span>
              <span className="text-sm font-medium text-primary">
                {entry.points.toLocaleString()} pts
              </span>
            </li>
          ))}
        </ul>
        <div className="border-t border-base-300 pt-2 mt-2">
          <div className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-primary/10 border border-primary/20">
            <span className="font-medium text-base-content/70">You</span>
            <span className="text-sm font-medium text-primary">
              #{MOCK_USER_RANK} · {MOCK_USER_POINTS.toLocaleString()} pts
            </span>
          </div>
        </div>
        <p className="text-xs text-base-content/60 mt-2">
          Weekly resets every Monday.
        </p>
      </div>
    </div>
  );
}

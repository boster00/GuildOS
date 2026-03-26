"use client";

import Link from "next/link";

/**
 * @param {{ locations: Array<{ slug: string, name: string, description?: string | null, route_path: string, map_x?: number | null, map_y?: number | null, icon_key?: string | null }> }} props
 */
export default function TownMapCanvas({ locations }) {
  return (
    <div className="relative min-h-[min(420px,55vh)] w-full overflow-hidden rounded-2xl border-2 border-amber-800/30 bg-gradient-to-b from-emerald-900/25 via-amber-100/40 to-emerald-800/20 shadow-inner">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 30h60M30 0v60' stroke='%2378350f' stroke-opacity='.12' fill='none'/%3E%3C/svg%3E")`,
        }}
      />
      <div className="absolute left-4 top-3 rounded-lg bg-amber-950/80 px-3 py-1.5 text-xs font-medium text-amber-100 shadow">
        Fantasy Town — click a building to travel
      </div>
      {locations.map((loc) => {
        const x = typeof loc.map_x === "number" ? loc.map_x : 50;
        const y = typeof loc.map_y === "number" ? loc.map_y : 50;
        return (
          <Link
            key={loc.slug}
            href={loc.route_path}
            className="group absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
            style={{ left: `${x}%`, top: `${y}%` }}
          >
            <span className="relative flex h-16 w-20 items-end justify-center rounded-lg border-2 border-amber-900/40 bg-gradient-to-b from-amber-100 to-amber-200/90 shadow-md transition group-hover:scale-105 group-hover:border-amber-700 group-hover:shadow-lg">
              <BuildingIcon kind={loc.icon_key} />
              <span className="absolute -bottom-1 h-3 w-14 rounded-full bg-black/20 blur-sm" />
            </span>
            <span className="max-w-[7rem] text-center text-xs font-bold text-amber-950 drop-shadow-sm group-hover:underline">
              {loc.name}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

function BuildingIcon({ kind }) {
  const common = "h-10 w-12 text-amber-900/85";
  switch (kind) {
    case "inn":
      return (
        <svg className={common} viewBox="0 0 48 40" aria-hidden>
          <path
            fill="currentColor"
            d="M4 18 L24 4 L44 18 V36 H4 Z M16 36 V26 H32 V36"
          />
        </svg>
      );
    case "square":
      return (
        <svg className={common} viewBox="0 0 48 40" aria-hidden>
          <rect x="6" y="14" width="36" height="22" rx="2" fill="currentColor" />
          <path d="M8 14 L24 6 L40 14" fill="currentColor" opacity="0.85" />
        </svg>
      );
    case "globe":
      return (
        <svg className={common} viewBox="0 0 48 40" aria-hidden>
          <circle cx="24" cy="20" r="14" fill="none" stroke="currentColor" strokeWidth="3" />
          <path
            d="M10 20h28 M24 6c4 8 4 16 0 24 M24 6c-4 8-4 16 0 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            opacity="0.8"
          />
        </svg>
      );
    default:
      return (
        <svg className={common} viewBox="0 0 48 40" aria-hidden>
          <rect x="10" y="12" width="28" height="24" rx="2" fill="currentColor" />
        </svg>
      );
  }
}

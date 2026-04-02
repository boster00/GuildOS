import Link from "next/link";
import { TOWN_MAP_ELSEWHERE, TOWN_MAP_MAJOR } from "@/libs/council/townNav";

export default function TownMapPage() {
  return (
    <main className="guild-bg-town-map min-h-dvh p-8">
      <div className="mx-auto max-w-5xl rounded-3xl border border-base-300 bg-base-100/85 p-6 shadow-xl backdrop-blur">
        <h1 className="text-3xl font-bold">Town Map</h1>
        <p className="text-base-content/70">
          Three great districts anchor the town—the Inn, the Square, and the Council Hall. The Guildmaster still keeps a
          chamber for day-to-day operations.
        </p>

        <h2 className="mt-8 text-lg font-semibold text-base-content/80">Major locations</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TOWN_MAP_MAJOR.map((place) => (
            <Link
              key={place.href}
              href={place.href}
              className="rounded-2xl border border-base-300 bg-base-200/80 p-4 shadow transition hover:-translate-y-0.5"
            >
              <img src={place.icon} alt="" className="h-16 w-16 rounded-xl border border-base-300 bg-base-100/80 p-1" />
              <h3 className="mt-3 text-xl font-semibold">{place.title}</h3>
              <p className="text-sm text-base-content/70">{place.text}</p>
            </Link>
          ))}
        </div>

        <h2 className="mt-10 text-lg font-semibold text-base-content/80">Elsewhere</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          {TOWN_MAP_ELSEWHERE.map((place) => (
            <Link
              key={place.href}
              href={place.href}
              className="rounded-2xl border border-base-300 bg-base-200/60 p-4 shadow transition hover:-translate-y-0.5"
            >
              <img src={place.icon} alt="" className="h-14 w-14 rounded-xl border border-base-300" />
              <h3 className="mt-3 text-lg font-semibold">{place.title}</h3>
              <p className="text-sm text-base-content/70">{place.text}</p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}

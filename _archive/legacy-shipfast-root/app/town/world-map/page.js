import Link from "next/link";
import { Map } from "lucide-react";

export const metadata = {
  title: "World Map — GuildOS",
};

export default function WorldMapPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 text-center">
      <div className="flex justify-center">
        <div className="rounded-full border-2 border-amber-800/30 bg-base-100 p-6 shadow-inner">
          <Map className="h-16 w-16 text-amber-800/70" aria-hidden />
        </div>
      </div>
      <div>
        <h1 className="guildos-title text-3xl font-bold text-amber-950">
          World Map
        </h1>
        <p className="mt-3 text-base text-base-content/70">
          Uncharted territory. Future modules, partner integrations, or regional
          deployments can appear here as new <code>guildos.locations</code> and{" "}
          <code>location_routes</code> edges.
        </p>
      </div>
      <div className="rounded-xl border border-dashed border-amber-800/30 bg-base-100/80 p-6 text-left text-sm text-base-content/65">
        <p className="font-semibold text-amber-950">Placeholder roadmap</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Region nodes (e.g. “Data Peaks”, “API Isles”)</li>
          <li>Cross-town travel animations</li>
          <li>Unlockable buildings tied to plan tier</li>
        </ul>
      </div>
      <Link href="/town" className="btn btn-outline btn-sm">
        ← Back to Town Map
      </Link>
    </div>
  );
}

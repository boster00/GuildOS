import { getTownLocations } from "@/libs/guildos/queries/server";
import TownMapCanvas from "@/components/guildos/TownMapCanvas";

export const metadata = {
  title: "Town Map — GuildOS",
};

export default async function TownMapPage() {
  const locations = await getTownLocations();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="guildos-title text-3xl font-bold text-amber-950">
          Town Map
        </h1>
        <p className="mt-1 text-sm text-base-content/65">
          Choose where to go next. Each place is its own route for deep-linking
          and future state.
        </p>
      </div>
      <TownMapCanvas locations={locations} />
      <section className="rounded-xl border border-dashed border-amber-800/25 bg-base-100/60 p-4 text-sm text-base-content/70">
        <p className="font-semibold text-amber-950">Architecture note</p>
        <p className="mt-1">
          Location rows live in <code>guildos.locations</code>; edges for future
          paths belong in <code>guildos.location_routes</code>. Expose the{" "}
          <code>guildos</code> schema in your hosted API settings after migrating.
        </p>
      </section>
    </div>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@libs-db/server";
import { getOpeningCharacters } from "@/libs/guildos/queries/server";
import "@/app/guildos-theme.css";

export const metadata = {
  title: "GuildOS — Welcome",
  description: "Your fantasy adventure control panel",
};

export default async function OpeningPage() {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();

  if (!user) {
    redirect("/signin?next=/opening");
  }

  const characters = await getOpeningCharacters();

  return (
    <main className="guildos-parchment flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-3xl text-center">
        <h1 className="guildos-title text-5xl font-bold text-amber-950 md:text-6xl">
          GuildOS
        </h1>
        <p className="mt-3 text-lg text-amber-950/75">
          A whimsical town console for your agent guild — maps, quests, and
          modules yet to awaken.
        </p>

        <div className="mt-10 flex flex-wrap items-end justify-center gap-6 md:gap-10">
          {characters.map((c) => (
            <figure
              key={c.slug}
              className="flex flex-col items-center gap-2"
            >
              <div className="rounded-2xl border-2 border-amber-800/35 bg-base-100 p-2 shadow-lg ring-2 ring-amber-200/50">
                <img
                  src={c.portraitUrl}
                  alt={c.portraitAlt || c.name}
                  width={112}
                  height={130}
                  className="h-[130px] w-[112px] object-contain"
                  fetchPriority="high"
                />
              </div>
              <figcaption className="text-sm font-semibold text-amber-950">
                {c.name}
                {c.title ? (
                  <span className="block text-xs font-normal text-amber-900/60">
                    {c.title}
                  </span>
                ) : null}
              </figcaption>
            </figure>
          ))}
        </div>

        <div className="mt-12">
          <Link href="/town" className="btn btn-primary btn-lg px-10 shadow-lg">
            Enter Town Map
          </Link>
        </div>

        <p className="mt-8 max-w-xl mx-auto text-left text-xs text-amber-900/55">
          {/* TODO: replace placeholder SVG chibis when final PNG/WebP assets are added */}
          Portraits use bundled SVG chibis (ember, sage, bolt, mirth). Point{" "}
          <code className="text-[10px]">guildos.character_assets.public_url</code> at
          your art when ready.
        </p>
      </div>
    </main>
  );
}

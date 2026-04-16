import Link from "next/link";
import { getCurrentUser } from "@/libs/council/auth/server";
import { MerchantGuildExplain } from "@/components/MerchantGuildExplain";

export const metadata = {
  title: "Council Hall · GuildOS",
};

export default async function CouncilHallPage() {
  const user = await getCurrentUser();

  return (
    <main className="guild-bg-council min-h-dvh p-4 md:p-8">
      <section className="mx-auto max-w-3xl rounded-3xl border border-base-300 bg-base-100/88 p-6 shadow-xl backdrop-blur">
        <nav className="text-sm text-base-content/60">
          <Link href="/town" className="link link-hover">
            Town map
          </Link>
          <span className="mx-2">/</span>
          <span className="text-base-content">Council Hall</span>
        </nav>

        <div className="mt-4 flex flex-wrap items-start gap-4">
          <img
            src="/images/guildos/chibis/sage.svg"
            alt=""
            className="h-16 w-16 rounded-xl border border-base-300 bg-base-200/50 p-2"
          />
          <div className="min-w-0 flex-1">
            <h1 className="text-3xl font-bold">Council Hall</h1>
            <MerchantGuildExplain
              className="mt-1"
              fantasy={
                <p className="text-sm text-base-content/70">
                  Where the charter is kept: credentials, formulae, and governance—not the guildmaster&apos;s daily
                  operations floor.
                </p>
              }
              merchant={
                <p className="text-sm text-base-content/70">
                  Council-managed configuration: integration formulas (env-style keys), billing-related account wiring, and
                  other durable settings. The Guildmaster&apos;s chamber is for human-in-the-loop work; formulas live here.
                </p>
              }
            />
          </div>
        </div>

        {!user ? (
          <div className="mt-8 rounded-2xl border border-base-300 bg-base-200/50 p-6 text-center">
            <p className="text-base-content/80">Sign in to open Council chambers.</p>
            <Link href="/signin?next=/town/council-hall" className="btn btn-primary mt-4">
              Sign in
            </Link>
          </div>
        ) : (
          <ul className="mt-8 space-y-3">
            <li>
              <Link
                href="/town/council-hall/formulary"
                className="block rounded-2xl border border-base-300 bg-base-200/60 p-4 transition hover:border-primary/40 hover:bg-base-200"
              >
                <h2 className="text-lg font-semibold">The Formulary</h2>
                <p className="mt-1 text-sm text-base-content/70">
                  Immutable formulas and stable credentials (OAuth client id/secret, etc.)—not rotating tokens; those are
                  potions in the Apothecary.
                </p>
              </Link>
            </li>
            <li>
              <Link
                href="/town/council-hall/dungeon-master"
                className="block rounded-2xl border border-base-300 bg-base-200/60 p-4 transition hover:border-primary/40 hover:bg-base-200"
              >
                <h2 className="text-lg font-semibold">Dungeon master&apos;s room</h2>
                <p className="mt-1 text-sm text-base-content/70">
                  Optional LLM API key, base URL, and default model—otherwise the server uses{" "}
                  <code className="text-xs">OPENAI_API_KEY</code> from the environment.
                </p>
              </Link>
            </li>
          </ul>
        )}
      </section>
    </main>
  );
}

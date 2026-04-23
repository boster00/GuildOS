import Link from "next/link";
import { getCurrentUser } from "@/libs/council/auth/server";
import { readActivationSummaries, WEAPONS } from "@/libs/weapon/registry";

function statusBadge(summaries, weaponId) {
  if (weaponId !== "zoho") return null;
  const s = summaries.zoho;
  if (!s) return null;
  const active = s.potionsReadOk && s.hasAccessToken;
  return (
    <span className={`badge ${active ? "badge-success" : "badge-warning"} badge-sm`}>
      {active ? "Forged" : "Blueprint only"}
    </span>
  );
}

export default async function ForgePage() {
  const user = await getCurrentUser();
  const summaries = user ? await readActivationSummaries(user.id) : {};

  return (
    <main className="guild-bg-forge min-h-dvh p-4 md:p-8">
      <section className="mx-auto max-w-4xl rounded-3xl border border-base-300 bg-base-100/88 p-6 shadow-xl backdrop-blur">
        <nav className="text-sm text-base-content/60">
          <Link href="/town/town-square" className="link link-hover">
            Town square
          </Link>
          <span className="mx-2">/</span>
          <span className="text-base-content">Forge</span>
        </nav>

        <div className="mt-4 flex flex-wrap items-start gap-4">
          <img
            src="/images/guildos/chibis/bolt.svg"
            alt=""
            className="h-16 w-16 rounded-xl border border-base-300 bg-base-200/50 p-2"
          />
          <div className="min-w-0 flex-1">
            <h1 className="text-3xl font-bold">The Forge</h1>
            <p className="text-sm text-base-content/70">
              Unactivated arms are <strong>weapon blueprints</strong> only—designs on paper. <strong>Forging</strong> is
              the act of activation: you supply formulas, run OAuth, and turn a blueprint into a working weapon your
              adventurers can wield through skill books.
            </p>
          </div>
        </div>

        {!user ? (
          <div className="mt-8 rounded-2xl border border-base-300 bg-base-200/50 p-8 text-center">
            <p className="text-base-content/80">Sign in to see which blueprints are forged and open a forging guide.</p>
            <Link href="/signin?next=/town/town-square/forge" className="btn btn-primary mt-4">
              Sign in
            </Link>
          </div>
        ) : (
          <ul className="mt-8 grid gap-4">
            {WEAPONS.map((w) => (
              <li key={w.id}>
                <Link
                  href={`/town/town-square/forge/${w.id}`}
                  className="flex flex-wrap items-center gap-4 rounded-2xl border border-base-300 bg-base-200/70 p-4 shadow transition hover:-translate-y-0.5 hover:border-primary/40"
                >
                  <img src={w.icon} alt="" className="h-14 w-14 shrink-0 rounded-xl border border-base-300 bg-base-100/80 p-2" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-semibold">{w.title}</h2>
                      {w.requiresActivation ? (
                        <span className="badge badge-outline badge-sm" title="Forging uses OAuth">
                          Forge via OAuth
                        </span>
                      ) : null}
                      {statusBadge(summaries, w.id)}
                    </div>
                    <p className="mt-1 text-sm text-base-content/70">{w.tagline}</p>
                  </div>
                  <span className="btn btn-ghost btn-sm pointer-events-none">Forging guide</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

import Link from "next/link";
import { getCurrentUser } from "@/libs/council/auth/server";
import { getPotionSummariesForOwner } from "@/libs/council/potionsSummaries.js";

export default async function ApothecaryPage() {
  const user = await getCurrentUser();
  const { rows, error } = user ? await getPotionSummariesForOwner(user.id) : { rows: [], error: null };

  return (
    <main className="guild-bg-town-square min-h-dvh p-4 md:p-8">
      <section className="mx-auto max-w-4xl rounded-3xl border border-base-300 bg-base-100/88 p-6 shadow-xl backdrop-blur">
        <nav className="text-sm text-base-content/60">
          <Link href="/town-square" className="link link-hover">
            Town square
          </Link>
          <span className="mx-2">/</span>
          <span className="text-base-content">Apothecary</span>
        </nav>

        <div className="mt-4 flex flex-wrap items-start gap-4">
          <img
            src="/images/guildos/chibis/mirth.svg"
            alt=""
            className="h-16 w-16 rounded-xl border border-base-300 bg-base-200/50 p-2"
          />
          <div className="min-w-0 flex-1">
            <h1 className="text-3xl font-bold">The Apothecary</h1>
            <p className="text-sm text-base-content/70">
              Potions—per-user brews that hold <strong>temporary</strong> secrets: OAuth access tokens, refresh tokens,
              and similar runtime material. They are not the Formulary: immutable app credentials and stable identifiers
              belong in the Council Hall{" "}
              <Link href="/council-hall/formulary" className="link link-primary">
                Formulary
              </Link>{" "}
              (formulas), not here.
            </p>
          </div>
        </div>

        {!user ? (
          <div className="mt-8 rounded-2xl border border-base-300 bg-base-200/50 p-8 text-center">
            <p className="text-base-content/80">Sign in to see which potions are on your shelf.</p>
            <Link href="/signin?next=/town-square/apothecary" className="btn btn-primary mt-4">
              Sign in
            </Link>
          </div>
        ) : error ? (
          <div className="alert alert-warning mt-8">
            <span>Could not load potions: {error}</span>
          </div>
        ) : rows.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-base-300 bg-base-200/40 p-8 text-center">
            <p className="text-sm text-base-content/80">
              No potions yet. When you activate a weapon (for example Zoho in the{" "}
              <Link href="/town-square/forge" className="link link-primary">
                Forge
              </Link>
              ), successful OAuth stores tokens here—never the raw values on this page.
            </p>
          </div>
        ) : (
          <div className="mt-8 overflow-x-auto">
            <table className="table table-zebra table-sm">
              <thead>
                <tr>
                  <th>Kind</th>
                  <th>Updated</th>
                  <th>Expires</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <span className="font-medium">{row.label}</span>
                      <span className="ml-2 font-mono text-xs text-base-content/50">({row.kind})</span>
                    </td>
                    <td className="whitespace-nowrap text-sm">{row.updated_at ? new Date(row.updated_at).toLocaleString() : "—"}</td>
                    <td className="whitespace-nowrap text-sm">{row.expires_at ? new Date(row.expires_at).toLocaleString() : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-4 text-xs text-base-content/50">
              Secret values are stored in the database but never listed in the UI. Zoho client id and secret belong in the
              Council Formulary, not in potions.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}

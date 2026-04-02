import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/libs/council/auth/server";
import { getWeaponById } from "@/libs/weapon/registry";
import { getZohoWeaponStatus } from "@/libs/weapon/zoho";
import { ZohoForgeWeaponPanel } from "@/components/ZohoForgeWeaponPanel";

function callbackBanner(zohoParam) {
  if (!zohoParam) return null;
  const map = {
    connected: {
      className: "alert-success",
      text: "Forging complete: Zoho Books is live. Tokens were saved for your account.",
    },
    missing_code: {
      className: "alert-warning",
      text: "Authorization did not return a code. Close the tab and try Connect again.",
    },
    missing_app_credentials: {
      className: "alert-error",
      text: "Cannot forge yet: missing Zoho app credentials. Save ZOHO_BOOKS_CLIENT_ID and ZOHO_BOOKS_CLIENT_SECRET in the forge flow or in Council Hall → Formulary, then try again.",
    },
    oauth_failed: {
      className: "alert-error",
      text: "Zoho rejected the token exchange. Check client id/secret, redirect URI in Zoho console, and region.",
    },
    save_failed: {
      className: "alert-error",
      text: "Tokens were received but could not be saved. Check server logs and database access.",
    },
  };
  const row = map[zohoParam];
  if (!row) return null;
  return (
    <div className={`alert ${row.className} mt-6`}>
      <span>{row.text}</span>
    </div>
  );
}

export default async function ForgeWeaponDetailPage({ params, searchParams }) {
  const { weaponId } = await params;
  const sp = await searchParams;
  const weapon = getWeaponById(weaponId);
  if (!weapon) notFound();

  const user = await getCurrentUser();
  const zohoParam = typeof sp?.zoho === "string" ? sp.zoho : null;

  let zohoStatus = null;
  if (user && weaponId === "zoho") {
    zohoStatus = await getZohoWeaponStatus(user.id);
  }

  const isZohoForged =
    weaponId === "zoho" && zohoStatus ? zohoStatus.potionsReadOk && zohoStatus.hasAccessToken : false;

  const weaponSummary = weapon.summary ?? weapon.tagline;

  return (
    <main className="guild-bg-town-square min-h-dvh p-4 md:p-8">
      <section className="mx-auto max-w-5xl rounded-3xl border border-base-300 bg-base-100/88 p-6 shadow-xl backdrop-blur">
        <nav className="text-sm text-base-content/60">
          <Link href="/town/town-square" className="link link-hover">
            Town square
          </Link>
          <span className="mx-2">/</span>
          <Link href="/town/town-square/forge" className="link link-hover">
            Forge
          </Link>
          <span className="mx-2">/</span>
          <span className="text-base-content">{weapon.title}</span>
        </nav>

        <div className="mt-4 flex flex-wrap items-start gap-4">
          <img src={weapon.icon} alt="" className="h-16 w-16 rounded-xl border border-base-300 bg-base-200/50 p-2" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-base-content/50">Weapon blueprint</p>
            <h1 className="text-3xl font-bold">{weapon.title}</h1>
            <p className="text-sm text-base-content/70">{weapon.tagline}</p>
          </div>
        </div>

        {weaponId !== "zoho" ? (
          <div className="mt-6 space-y-3">
            {weapon.description.map((para, i) => (
              <p key={i} className="text-sm leading-relaxed text-base-content/85">
                {para}
              </p>
            ))}
          </div>
        ) : null}

        {callbackBanner(zohoParam)}

        {!user ? (
          <div className="mt-8 space-y-4">
            {weaponId === "zoho" ? (
              <div className="rounded-2xl border border-base-300 bg-base-200/50 p-4 text-sm text-base-content/80">
                <p className="mb-3 text-base-content/90">{weaponSummary}</p>
                Sign in to save formulas, finish OAuth, and see forge status. Keys also appear in{" "}
                <Link href="/town/council-hall/formulary" className="link link-primary">
                  Council Hall → Formulary
                </Link>
                .
              </div>
            ) : null}
            <div className="rounded-2xl border border-base-300 bg-base-200/50 p-6 text-center">
              <p className="text-base-content/80">Sign in to forge this weapon and see forge status.</p>
              <Link href={`/signin?next=/town/town-square/forge/${weaponId}`} className="btn btn-primary mt-4">
                Sign in
              </Link>
            </div>
          </div>
        ) : weaponId === "zoho" ? (
          <ZohoForgeWeaponPanel weaponSummary={weaponSummary} isForged={isZohoForged} zohoStatus={zohoStatus} />
        ) : null}
      </section>
    </main>
  );
}

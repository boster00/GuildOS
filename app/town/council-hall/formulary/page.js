import Link from "next/link";
import { getCurrentUser } from "@/libs/council/auth/server";
import PotionFormularsSettings from "@/components/PotionFormularsSettings";
import { MerchantGuildExplain } from "@/components/MerchantGuildExplain";

export const metadata = {
  title: "The Formulary · Council Hall",
};

export default async function CouncilFormularyPage() {
  const user = await getCurrentUser();

  return (
    <main className="guild-bg-council min-h-dvh p-4 md:p-8">
      <section className="mx-auto max-w-3xl rounded-3xl border border-base-300 bg-base-100/88 p-6 shadow-xl backdrop-blur">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Link href="/town/council-hall" className="link link-hover">
            Council Hall
          </Link>
          <span className="text-base-content/40" aria-hidden>
            ·
          </span>
          <span className="text-base-content/70">The Formulary</span>
        </div>

        <h1 className="mt-4 text-2xl font-bold">The Formulary</h1>
        <MerchantGuildExplain
          className="mt-1"
          fantasy={
            <p className="text-sm text-base-content/70">
              Each <strong>formula</strong> is a fixed inscription—client IDs and other durable marks. Brewed potions
              (temporary OAuth tokens) are not stored in the Formulary; they are poured into the guild vault and appear
              in the Apothecary&apos;s shelf.
            </p>
          }
          merchant={
            <p className="text-sm text-base-content/70">
              Named settings for your account (similar to environment variables). Only variable names are listed; values
              are never displayed after they are saved. Rotating tokens from Zoho and similar vendors live in{" "}
              <code className="text-xs">potions</code>—see Town square → Apothecary.
            </p>
          }
        />

        {!user ? (
          <div className="mt-8 rounded-2xl border border-base-300 bg-base-200/50 p-6 text-center">
            <p className="text-base-content/80">The formulary is locked until you bear a guild seal.</p>
            <Link href="/signin" className="btn btn-primary mt-4">
              Sign in
            </Link>
          </div>
        ) : (
          <div className="mt-8">
            <PotionFormularsSettings />
          </div>
        )}
      </section>
    </main>
  );
}

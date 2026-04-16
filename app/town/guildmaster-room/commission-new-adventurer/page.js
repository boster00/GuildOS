import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/libs/council/auth/server";
import CommissionNewAdventurerClient from "./CommissionNewAdventurerClient";

export const metadata = {
  title: "Commission a new adventurer · Guildmaster",
};

export default async function CommissionNewAdventurerPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/signin?next=/town/guildmaster-room/commission-new-adventurer");
  }

  return (
    <main className="guild-bg-guildmaster-room min-h-dvh p-4 md:p-8">
      <section className="mx-auto max-w-6xl rounded-3xl border border-base-300 bg-base-100/88 p-6 shadow-xl backdrop-blur">
        <nav className="text-sm text-base-content/60">
          <Link href="/town" className="link link-hover">
            Town
          </Link>
          <span className="mx-2">/</span>
          <Link href="/town/guildmaster-room" className="link link-hover">
            Guildmaster
          </Link>
          <span className="mx-2">/</span>
          <span className="text-base-content">Commission</span>
        </nav>

        <div className="mt-4 flex flex-wrap items-start gap-4">
          <img
            src="/images/guildos/chibis/ember.svg"
            alt=""
            className="h-14 w-14 rounded-xl border border-base-300 bg-base-200/50 p-2"
          />
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold md:text-3xl">Commission a new adventurer</h1>
            <p className="text-sm text-base-content/70">
              Parley with the cat on the left; shape the roster entry on the right. Confirm when the checklist is
              satisfied.
            </p>
          </div>
        </div>

        <div className="mt-8">
          <CommissionNewAdventurerClient />
        </div>
      </section>
    </main>
  );
}

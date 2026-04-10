import Link from "next/link";
import { getCurrentUser } from "@/libs/council/auth/server";
import ProvingGroundsClient from "./ProvingGroundsClient.js";
import ProvinGroundsNav from "../ProvinGroundsNav.js";

export const metadata = {
  title: "Quest Workflow · Proving grounds · GuildOS",
};

export default async function QuestWorkflowPage() {
  const user = await getCurrentUser();

  return (
    <main className="guild-bg-town-square min-h-dvh p-4 md:p-8">
      <section className="mx-auto max-w-6xl rounded-3xl border border-base-300 bg-base-100/88 p-6 shadow-xl backdrop-blur">
        <nav className="text-sm text-base-content/60">
          <Link href="/town" className="link link-hover">Town map</Link>
          <span className="mx-2">/</span>
          <Link href="/town/proving-grounds" className="link link-hover">Proving grounds</Link>
          <span className="mx-2">/</span>
          <span className="text-base-content">Quest Workflow</span>
        </nav>

        <div className="mt-4 flex flex-wrap items-start gap-4">
          <img
            src="/images/guildos/chibis/sage.svg"
            alt=""
            className="h-16 w-16 rounded-xl border border-base-300 bg-base-200/50 p-2"
          />
          <div className="min-w-0 flex-1">
            <h1 className="text-3xl font-bold">Proving grounds</h1>
            <p className="mt-1 text-sm text-base-content/70">
              Build path for new weapons and skill books, then run a single roster action with a dry payload before you wire a full quest.
            </p>
          </div>
        </div>

        <ProvinGroundsNav active="quest-workflow" />

        {!user ? (
          <div className="mt-8 rounded-2xl border border-base-300 bg-base-200/50 p-8 text-center">
            <p className="text-base-content/80">Sign in to load adventurers and invoke actions.</p>
            <Link href="/signin?next=/town/proving-grounds/quest-workflow" className="btn btn-primary mt-4">
              Sign in
            </Link>
          </div>
        ) : (
          <div className="mt-8">
            <ProvingGroundsClient />
          </div>
        )}
      </section>
    </main>
  );
}

import Link from "next/link";
import { getCurrentUser } from "@/libs/council/auth/server";
import { getQuestsForOwner } from "@/libs/quest";
import PigeonLetterTestClient from "./PigeonLetterTestClient";

export const metadata = { title: "Pigeon Letter Test · Proving Grounds · GuildOS" };

export default async function BrowserclawTestPage() {
  const user = await getCurrentUser();
  const quests = user ? (await getQuestsForOwner(user.id)) ?? [] : [];

  return (
    <main className="guild-bg-town-square min-h-dvh p-4 md:p-8">
      <section className="mx-auto max-w-3xl rounded-3xl border border-base-300 bg-base-100/88 p-6 shadow-xl backdrop-blur">
        <nav className="text-sm text-base-content/60">
          <Link href="/town" className="link link-hover">Town map</Link>
          <span className="mx-2">/</span>
          <Link href="/town/proving-grounds" className="link link-hover">Proving grounds</Link>
          <span className="mx-2">/</span>
          <span className="text-base-content">Browserclaw test</span>
        </nav>

        <h1 className="mt-4 text-2xl font-bold">Send Pigeon Letter</h1>
        <p className="mt-1 text-sm text-base-content/60">
          Inserts a row into <code>pigeon_letters</code> with status <code>pending</code>.
          The <code>payload</code> JSON is picked up by Browserclaw on the next auto-pilot tick.
        </p>

        <PigeonLetterTestClient quests={quests} />
      </section>
    </main>
  );
}

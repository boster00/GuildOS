import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/libs/council/auth/server";
import { getAdventurerForOwner, adventurerRowToDraft } from "@/libs/proving_grounds";
import AdventurerEditClient from "./AdventurerEditClient.js";

export async function generateMetadata({ params }) {
  const { adventurerId: id } = await params;
  const user = await getCurrentUser();
  if (!user || !id) {
    return { title: "Adventurer · Inn" };
  }
  const { data } = await getAdventurerForOwner(id, user.id);
  const name = data?.name && typeof data.name === "string" ? data.name : "Adventurer";
  return { title: `${name} · Inn upstairs` };
}

export default async function InnUpstairsAdventurerPage({ params }) {
  const { adventurerId } = await params;
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/signin?next=/town/inn/upstairs/${adventurerId}`);
  }

  if (!adventurerId || typeof adventurerId !== "string") {
    notFound();
  }

  const { data, error } = await getAdventurerForOwner(adventurerId, user.id);
  if (error || !data) {
    notFound();
  }

  const initialDraft = adventurerRowToDraft(data);

  return (
    <main className="guild-bg-inn min-h-dvh p-4 md:p-8">
      <section className="mx-auto max-w-3xl rounded-3xl border border-base-300 bg-base-100/88 p-6 shadow-xl backdrop-blur">
        <nav className="text-sm text-base-content/60">
          <Link href="/town/inn" className="link link-hover">
            The Inn
          </Link>
          <span className="mx-2">/</span>
          <Link href="/town/inn/upstairs" className="link link-hover">
            Upstairs
          </Link>
          <span className="mx-2">/</span>
          <span className="text-base-content">{data.name}</span>
        </nav>

        <div className="mt-4 flex flex-wrap items-start gap-4">
          <img
            src="/images/guildos/chibis/ember.svg"
            alt=""
            className="h-14 w-14 rounded-xl border border-base-300 bg-base-200/50 p-2"
          />
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold md:text-3xl">{data.name}</h1>
            <p className="text-sm text-base-content/70">Edit roster fields and save.</p>
            <p className="mt-1 font-mono text-xs text-base-content/45">id: {data.id}</p>
          </div>
        </div>

        <div className="mt-8">
          <AdventurerEditClient adventurerId={adventurerId} initialDraft={initialDraft} />
        </div>
      </section>
    </main>
  );
}

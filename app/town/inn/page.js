import Link from "next/link";
import { getCurrentUser } from "@/libs/council/auth/server";
import { getQuestsForOwner } from "@/libs/quest";
import { InnKanban, InnKanbanFooter } from "./InnKanban";

const INN_PLACES = [
  {
    id: "main-hall",
    title: "Main hall",
    text: "Kanban on this pageâ€”drag of fate by stage. For a full list, use the quest board.",
    href: null,
    anchor: "#inn-quest-board",
  },
  {
    id: "quest-board",
    title: "Quest board",
    text: "Dedicated ledger: open any quest by id, stages, assignees, and detail.",
    href: "/town/quest-board",
  },
  {
    id: "upstairs",
    title: "Upstairs",
    text: "Adventurers' roomsâ€”the roster lives above the noise of the hall.",
    href: "/town/inn/upstairs",
  },
  {
    id: "request-desk",
    title: "Request desk",
    text: "New commissions and intake.",
    href: "/town/inn/request-desk",
  },
];

export default async function InnPage() {
  const user = await getCurrentUser();

  let quests = [];
  let loadError = null;

  if (user) {
    const { data, error } = await getQuestsForOwner(user.id);
    if (error) {
      loadError = error.message || "Could not load quests";
    } else {
      quests = data;
    }
  }

  return (
    <main className="guild-bg-inn min-h-dvh p-4 md:p-8">
      <section className="mx-auto max-w-[110rem] rounded-3xl border border-base-300 bg-base-100/88 p-4 shadow-xl backdrop-blur md:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <img
            src="/images/guildos/cat.png"
            alt="Quest Master cat"
            className="h-14 w-14 rounded-xl border border-base-300"
          />
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold md:text-3xl">The Inn</h1>
            <p className="text-sm text-base-content/70">
              Quest operations on the ground floor; rooms upstairs for your adventurers. For human-in-the-loop oversight,
              see the Guildmaster&apos;s chamber.
            </p>
          </div>
          <Link href="/town/guildmaster-room" className="btn btn-ghost btn-sm">
            Guildmaster&apos;s chamber
          </Link>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {INN_PLACES.map((place) => {
            const inner = (
              <>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-base-content/60">{place.title}</h2>
                <p className="mt-1 text-sm text-base-content/75">{place.text}</p>
                {place.href ? (
                  <span className="btn btn-ghost btn-sm mt-3 w-fit pointer-events-none">Go</span>
                ) : (
                  <span className="btn btn-ghost btn-sm mt-3 w-fit pointer-events-none">Below</span>
                )}
              </>
            );
            if (place.href) {
              return (
                <Link
                  key={place.id}
                  href={place.href}
                  className="rounded-2xl border border-base-300 bg-base-200/60 p-4 transition hover:border-primary/40 hover:bg-base-200"
                >
                  {inner}
                </Link>
              );
            }
            return (
              <a
                key={place.id}
                href={place.anchor}
                className="rounded-2xl border border-base-300 bg-base-200/50 p-4 scroll-mt-24"
              >
                {inner}
              </a>
            );
          })}
        </div>

        <div id="inn-quest-board" className="mt-8 scroll-mt-24">
          {!user ? (
            <div className="rounded-2xl border border-base-300 bg-base-200/50 p-8 text-center">
              <p className="text-base-content/80">Sign in to load your quest board from the guild ledger.</p>
              <Link href="/signin" className="btn btn-primary mt-4">
                Sign in
              </Link>
            </div>
          ) : loadError ? (
            <div className="alert alert-warning">
              <span>{loadError}</span>
            </div>
          ) : (
            <>
              <h2 className="mb-3 text-lg font-semibold">Main hall â€” quest board</h2>
              <InnKanban quests={quests} />
              <InnKanbanFooter />
            </>
          )}
        </div>
      </section>
    </main>
  );
}

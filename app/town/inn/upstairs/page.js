import Link from "next/link";
import { getCurrentUser } from "@/libs/council/auth/server";
import { listAdventurers } from "@/libs/proving_grounds/server.js";
import { database } from "@/libs/council/database";
import AdventurerRoomCard from "./AdventurerRoomCard.js";

async function loadQuestCountsByAdventurer(userId) {
  const db = await database.init("server");
  const { data: quests } = await db
    .from("quests")
    .select("assignee_id, stage")
    .eq("owner_id", userId)
    .not("assignee_id", "is", null)
    .in("stage", ["execute", "escalated", "review", "closing"]);

  const counts = {};
  for (const q of quests || []) {
    if (!counts[q.assignee_id]) counts[q.assignee_id] = {};
    counts[q.assignee_id][q.stage] = (counts[q.assignee_id][q.stage] || 0) + 1;
  }
  return counts;
}

export default async function InnUpstairsPage() {
  const user = await getCurrentUser();
  let adventurers = [];
  let loadError = null;
  let questCounts = {};

  if (user) {
    const { data, error } = await listAdventurers(user.id);
    if (error) loadError = error.message || "Could not load adventurers";
    else adventurers = data || [];
    questCounts = await loadQuestCountsByAdventurer(user.id);
  }

  return (
    <main className="guild-bg-inn min-h-dvh p-4 md:p-8">
      <section className="mx-auto max-w-7xl rounded-3xl border border-base-300 bg-base-100/88 p-6 shadow-xl backdrop-blur">
        <nav className="text-sm text-base-content/60">
          <Link href="/town/inn" className="link link-hover">
            The Inn
          </Link>
          <span className="mx-2">/</span>
          <span className="text-base-content">Upstairs</span>
        </nav>

        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-wrap items-start gap-4">
            <img
              src="/images/guildos/chibis/ember.svg"
              alt=""
              className="h-16 w-16 rounded-xl border border-base-300 bg-base-200/50 p-2"
            />
            <div className="min-w-0 flex-1">
              <h1 className="text-3xl font-bold">Upstairs — Adventurers&apos; rooms</h1>
              <p className="text-sm text-base-content/70">
                Your roster lives above the main hall—each adventurer boards in a room until a quest calls them down.
              </p>
            </div>
          </div>
          <Link
            href="/town/guildmaster-room/commission-new-adventurer"
            className="btn btn-primary btn-sm shrink-0"
          >
            Commission new adventurer
          </Link>
        </div>

        {!user ? (
          <div className="mt-8 rounded-2xl border border-base-300 bg-base-200/50 p-8 text-center">
            <p className="text-base-content/80">Sign in to see who is staying upstairs.</p>
            <Link href="/signin?next=/town/inn/upstairs" className="btn btn-primary mt-4">
              Sign in
            </Link>
          </div>
        ) : loadError ? (
          <div className="alert alert-warning mt-8">
            <span>{loadError}</span>
          </div>
        ) : adventurers.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-base-300 bg-base-200/40 p-8 text-center">
            <p className="text-sm text-base-content/80">
              No adventurers on file yet.{" "}
              <Link href="/town/guildmaster-room/commission-new-adventurer" className="link link-primary font-medium">
                Commission one from the Guildmaster&apos;s chamber
              </Link>
              , or seed a starter roster from dev docs.
            </p>
          </div>
        ) : (
          <ul className="mt-8 space-y-4">
            {adventurers.map((a) => (
              <li key={a.id}>
                <AdventurerRoomCard adventurer={a} questCounts={questCounts[a.id] || {}} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

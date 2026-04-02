import Link from "next/link";
import { getCurrentUser } from "@/libs/council/auth/server";
import { getQuestsForOwner } from "@/libs/quest";
import { MerchantGuildExplain } from "@/components/MerchantGuildExplain";

export const metadata = {
  title: "The Guildmaster's desk · Guildmaster's chamber",
};

function needsGuildmasterAttention(quest) {
  return quest.stage === "review";
}

function stageLabel(stage) {
  const map = {
    idea: "Idea",
    plan: "Plan",
    assign: "Assign",
    execute: "Execute",
    review: "Review",
    closing: "Closing",
    completed: "Completed",
  };
  return map[stage] || stage;
}

export default async function GuildmasterDeskPage() {
  const user = await getCurrentUser();

  let quests = [];
  let loadError = null;

  if (user) {
    const { data, error } = await getQuestsForOwner(user.id);
    if (error) {
      loadError = error.message || "Could not load quests";
    } else {
      quests = (data || []).filter(needsGuildmasterAttention);
    }
  }

  return (
    <main className="guild-bg-town-map min-h-dvh p-4 md:p-8">
      <section className="mx-auto max-w-3xl rounded-3xl border border-base-300 bg-base-100/88 p-6 shadow-xl backdrop-blur">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Link href="/town/guildmaster-room" className="link link-hover">
            Guildmaster&apos;s chamber
          </Link>
          <span className="text-base-content/40" aria-hidden>
            ·
          </span>
          <span className="text-base-content/70">The desk</span>
        </div>

        <h1 className="mt-4 text-2xl font-bold">The Guildmaster&apos;s desk</h1>
        <MerchantGuildExplain
          className="mt-1"
          fantasy={
            <p className="text-sm text-base-content/70">
              Letters, field reports, and curled scrolls—matters adventurers could not settle alone. When a quest begs for
              judgment, clarification, or approval, it lands here for your eye.
            </p>
          }
          merchant={
            <p className="text-sm text-base-content/70">
              Quests that need human input (flagged by your agents) and items in <strong>review</strong> awaiting your
              decision. The Inn&apos;s quest board holds the full pipeline; this desk is your inbox for intervention.
            </p>
          }
        />

        {!user ? (
          <div className="mt-8 rounded-2xl border border-base-300 bg-base-200/50 p-6 text-center">
            <p className="text-base-content/80">Sign in to open the correspondence on your desk.</p>
            <Link href="/signin" className="btn btn-primary mt-4">
              Sign in
            </Link>
          </div>
        ) : loadError ? (
          <div className="alert alert-warning mt-8">
            <span>{loadError}</span>
          </div>
        ) : quests.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-base-300 bg-base-200/30 p-8 text-center">
            <p className="text-base-content/75">
              Your desk is clear—no letters or reports need your seal right now.
            </p>
            <Link href="/town/inn" className="btn btn-ghost btn-sm mt-4">
              Visit the Inn (full quest board)
            </Link>
          </div>
        ) : (
          <div className="mt-8 space-y-3">
            <p className="text-sm text-base-content/65">
              {quests.length} matter{quests.length === 1 ? "" : "s"} awaiting you.
            </p>
            <ul className="space-y-3">
              {quests.map((q) => (
                <li
                  key={q.id}
                  className="rounded-2xl border border-amber-900/15 bg-gradient-to-br from-base-200/80 to-base-200/40 p-4 shadow-sm dark:border-amber-100/10"
                >
                  <div className="border-l-4 border-warning/50 pl-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h2 className="text-base font-semibold leading-snug">{q.title || "Untitled quest"}</h2>
                      <div className="flex flex-wrap gap-1">
                        <span className="badge badge-ghost badge-sm">{stageLabel(q.stage)}</span>
                      </div>
                    </div>
                    {q.description ? (
                      <p className="mt-2 line-clamp-4 text-sm text-base-content/70">{q.description}</p>
                    ) : null}
                    {q.assigned_to ? (
                      <p className="mt-2 text-xs text-base-content/50">Adventurer: {q.assigned_to}</p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
            <div className="pt-2">
              <Link href="/town/inn#inn-quest-board" className="btn btn-outline btn-sm">
                Open the Inn — main hall quest board
              </Link>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

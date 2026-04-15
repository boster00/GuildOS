import Link from "next/link";
import { getCurrentUser } from "@/libs/council/auth/server";
import { getQuestsForOwner } from "@/libs/quest";

function stageBadgeClass(stage) {
  if (stage === "completed" || stage === "complete") return "badge-success";
  if (stage === "idea" || stage === "plan") return "badge-ghost";
  if (stage === "review" || stage === "closing") return "badge-warning";
  if (stage === "escalated") return "badge-error";
  return "badge-primary";
}

export default async function QuestBoardPage() {
  const user = await getCurrentUser();
  let quests = [];
  let loadError = null;

  if (user) {
    const { data, error } = await getQuestsForOwner(user.id);
    if (error) loadError = error.message || "Could not load quests";
    else quests = data || [];
  }

  return (
    <main className="guild-bg-inn min-h-dvh p-4 md:p-8">
      <section className="mx-auto max-w-4xl rounded-3xl border border-base-300 bg-base-100/88 p-6 shadow-xl backdrop-blur">
        <nav className="text-sm text-base-content/60">
          <Link href="/town/inn" className="link link-hover">
            The Inn
          </Link>
          <span className="mx-2">/</span>
          <span className="text-base-content">Quest board</span>
        </nav>

        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Quest board</h1>
            <p className="mt-1 text-sm text-base-content/70">
              Open a quest to see full detail. Stages follow your guild ledger.
            </p>
          </div>
          <Link href="/town/inn/request-desk" className="btn btn-primary btn-sm">
            New request
          </Link>
        </div>

        {!user ? (
          <div className="mt-8 rounded-2xl border border-base-300 bg-base-200/50 p-8 text-center">
            <p className="text-base-content/80">Sign in to see your quests.</p>
            <Link href="/signin?next=/town/inn/quest-board" className="btn btn-primary mt-4">
              Sign in
            </Link>
          </div>
        ) : loadError ? (
          <div className="alert alert-warning mt-8">
            <span>{loadError}</span>
          </div>
        ) : quests.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-base-300 bg-base-200/40 p-8 text-center text-sm text-base-content/75">
            No quests yet.{" "}
            <Link href="/town/inn/request-desk" className="link link-primary font-medium">
              Submit one at the request desk
            </Link>
            .
          </div>
        ) : (
          <ul className="mt-8 divide-y divide-base-300 rounded-2xl border border-base-300 bg-base-200/50">
            {quests.map((q) => (
              <li key={q.id}>
                <Link
                  href={`/town/inn/quest-board/${q.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 transition hover:bg-base-200"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold leading-snug">{q.title || "Untitled quest"}</p>
                    {q.description ? (
                      <p className="mt-0.5 line-clamp-2 text-sm text-base-content/65">{q.description}</p>
                    ) : null}
                    <p className="mt-1 font-mono text-[10px] text-base-content/45">{q.id}</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <span className={`badge ${stageBadgeClass(q.stage)} badge-sm`}>{q.stage}</span>
                    {q.assigned_to ? (
                      <span className="badge badge-outline badge-sm">{q.assigned_to}</span>
                    ) : (
                      <span className="badge badge-ghost badge-sm">Unassigned</span>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

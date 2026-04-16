import Link from "next/link";
import { getCurrentUser } from "@/libs/council/auth/server";
import { database } from "@/libs/council/database";

const COLUMNS = [
  { id: "execute", label: "Executing", color: "badge-info" },
  { id: "escalated", label: "Escalated", color: "badge-warning" },
  { id: "purrview", label: "Purrview", color: "badge-secondary" },
  { id: "review", label: "In Review", color: "badge-accent" },
  { id: "closing", label: "Closing", color: "badge-ghost" },
  { id: "complete", label: "Complete", color: "badge-success" },
];

function QuestCard({ quest }) {
  return (
    <Link
      href={`/town/quest-board/${quest.id}`}
      className="block rounded-lg border border-base-300 bg-base-100/95 p-3 shadow-sm transition hover:border-primary/40"
    >
      <h3 className="text-sm font-semibold leading-snug">{quest.title || "Untitled"}</h3>
      {quest.description && (
        <p className="mt-1 line-clamp-2 text-xs text-base-content/65">{quest.description}</p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-base-content/50">
        {quest.assigned_to && <span>Assignee: {quest.assigned_to}</span>}
        {quest.priority && <span className={`badge badge-xs ${quest.priority === "high" ? "badge-error" : quest.priority === "low" ? "badge-ghost" : "badge-info"}`}>{quest.priority}</span>}
      </div>
    </Link>
  );
}

export default async function QuestBoardPage() {
  const user = await getCurrentUser();
  let quests = [];

  if (user) {
    const db = await database.init("server");
    const { data } = await db
      .from("quests")
      .select("id, title, description, stage, assigned_to, priority, updated_at")
      .eq("owner_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(100);
    quests = data || [];
  }

  const columns = COLUMNS.map((col) => ({
    ...col,
    quests: quests.filter((q) => q.stage === col.id),
  }));

  return (
    <main className="guild-bg-quest-board min-h-dvh p-4 md:p-8">
      <section className="mx-auto max-w-[1800px] rounded-3xl border border-base-300 bg-base-100/88 p-6 shadow-xl backdrop-blur">
        <h1 className="text-2xl font-bold">Quest Board</h1>
        <p className="mt-1 text-sm text-base-content/70">All quests by stage.</p>

        {!user ? (
          <div className="mt-8 text-center">
            <Link href="/signin" className="btn btn-primary">Sign in</Link>
          </div>
        ) : (
          <div className="mt-6 flex gap-3 overflow-x-auto pb-4">
            {columns.map((col) => (
              <section key={col.id} className="flex w-[min(100%,17.5rem)] shrink-0 flex-col rounded-2xl border border-base-300 bg-base-200/40">
                <header className="border-b border-base-300/80 px-3 py-2.5">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold">{col.label}</h2>
                    <span className={`badge badge-sm ${col.color}`}>{col.quests.length}</span>
                  </div>
                </header>
                <div className="flex max-h-[min(70vh,36rem)] flex-col gap-2 overflow-y-auto p-2">
                  {col.quests.length === 0 ? (
                    <p className="px-1 py-6 text-center text-xs italic text-base-content/45">None</p>
                  ) : (
                    col.quests.map((q) => <QuestCard key={q.id} quest={q} />)
                  )}
                </div>
              </section>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/libs/council/auth/server";
import { database } from "@/libs/council/database";
import { selectQuestCommentsForQuest } from "@/libs/council/database/serverQuest.js";
import { GLOBAL_QUEST_ASSIGNEES } from "@/libs/adventurer_runtime/ui.js";
import { listAdventurers } from "@/libs/adventurer_runtime/server.js";
import { getQuestForOwner, QUEST_PATCH_RELATIVE_URL, QUEST_STAGES, searchItems } from "@/libs/quest";
import QuestActivityCommentsPanel from "./QuestActivityCommentsPanel.js";
import QuestDetailFieldEditClient from "./QuestDetailFieldEditClient.js";
// QuestAdvanceButtons removed — agent-driven model, no manual stage advance

/** Stage changes use PATCH /api/quest → updateQuest (cookies). Inline script drives optimistic UI + saving + tick. */
import QuestStageMenuClient from "./QuestStageMenuClient.js";

function QuestStageMenu({ questId, currentStage }) {
  return <QuestStageMenuClient questId={questId} initialStage={currentStage} />;
}


export default async function QuestDetailPage({ params }) {
  const { questId } = await params;
  const user = await getCurrentUser();

  if (!user) {
    return (
      <main className="guild-bg-quest-board min-h-dvh p-4 md:p-8">
        <section className="mx-auto max-w-3xl rounded-3xl border border-base-300 bg-base-100/88 p-6 shadow-xl backdrop-blur">
          <p className="text-base-content/80">Sign in to view this quest.</p>
          <Link href={`/signin?next=/quest-board/${questId}`} className="btn btn-primary mt-4">
            Sign in
          </Link>
        </section>
      </main>
    );
  }

  const db = await database.init("server");
  const { data: quest, error } = await getQuestForOwner(questId, user.id, { client: db });
  if (error || !quest) {
    notFound();
  }

  // Hydrate items + per-item comments via searchItems (libs/quest). Ownership
  // was just verified via getQuestForOwner, so use service role to sidestep
  // item-RLS evaluation quirks on the user-scoped server client.
  const svc = await database.init("service");
  const items = await searchItems(quest.id, { client: svc });
  quest.items = items;
  // Legacy alias — some downstream renderers still read quest.inventory.
  quest.inventory = items;

  const { data: roster } = await listAdventurers(user.id, { client: db });
  const assigneeOptions = [
    { value: "", label: "Unassigned" },
    ...Object.keys(GLOBAL_QUEST_ASSIGNEES).map((name) => ({
      value: name,
      label: `${name} (assistant)`,
    })),
    ...(roster || []).map((a) => ({
      value: a.name,
      label: a.name,
    })),
  ];

  const { data: commentsRows } = await selectQuestCommentsForQuest(quest.id, { client: db, limit: 100 });
  const questComments = commentsRows ?? [];

  return (
    <main className="guild-bg-quest-board min-h-dvh p-4 md:p-8">
      <section className="mx-auto max-w-3xl rounded-3xl border border-base-300 bg-base-100/88 p-6 shadow-xl backdrop-blur">
        <nav className="text-sm text-base-content/60">
          <Link href="/quest-board" className="link link-hover">
            The Inn
          </Link>
          <span className="mx-2">/</span>
          <Link href="/quest-board" className="link link-hover">
            Quest board
          </Link>
          <span className="mx-2">/</span>
          <span className="text-base-content">Quest</span>
        </nav>

        <QuestDetailFieldEditClient
          questId={quest.id}
          initialTitle={quest.title}
          initialDescription={quest.description}
          initialInventory={quest.inventory}
          initialItems={Array.isArray(quest.items) ? quest.items : []}
          initialAssignedTo={quest.assigned_to}
          initialAssigneeId={quest.assignee_id}
          initialDueDate={quest.due_date}
          assigneeOptions={assigneeOptions}
          stageControls={<QuestStageMenu questId={quest.id} currentStage={quest.stage} />}
        />

        <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium text-base-content/55">Created</dt>
            <dd className="mt-0.5">{quest.created_at ? new Date(quest.created_at).toLocaleString() : "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-base-content/55">Updated</dt>
            <dd className="mt-0.5">{quest.updated_at ? new Date(quest.updated_at).toLocaleString() : "—"}</dd>
          </div>
        </dl>

        <QuestActivityCommentsPanel questId={quest.id} initialComments={questComments} />
      </section>
    </main>
  );
}

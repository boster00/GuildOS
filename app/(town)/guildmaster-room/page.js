import Link from "next/link";
import { getCurrentUser } from "@/libs/council/auth/server";
import { database } from "@/libs/council/database";
import { inventoryRawToMap } from "@/libs/quest";
import DeskReviewClient from "./desk/DeskReviewClient";

export const metadata = {
  title: "Guildmaster's Room",
};

async function loadReviewQuests(userId) {
  const db = await database.init("server");

  const { data: quests, error } = await db
    .from("quests")
    .select("id, title, description, stage, assigned_to, assignee_id, created_at, updated_at")
    .eq("owner_id", userId)
    // Closing/complete are not user-actionable on this surface — Cat
    // archives closing to Asana via cron, and complete is terminal. The
    // GM-desk shows only what the user can act on right now.
    .in("stage", ["purrview", "review", "escalated"])
    .order("updated_at", { ascending: false });

  if (error) return { quests: [], error: error.message };
  if (!quests || quests.length === 0) return { quests: [], error: null };

  const questIds = quests.map((q) => q.id);
  const [{ data: allComments }, { data: allItems }] = await Promise.all([
    db.from("quest_comments")
      .select("id, quest_id, source, action, summary, detail, created_at")
      .in("quest_id", questIds)
      .order("created_at", { ascending: false })
      .limit(500),
    db.from("items")
      .select("id, quest_id, item_key, expectation, url, caption, self_check, openai_check, purrview_check, claude_check, user_feedback, created_at, updated_at")
      .in("quest_id", questIds)
      .order("created_at", { ascending: true }),
  ]);

  const commentsByQuest = {};
  for (const c of allComments || []) {
    if (!commentsByQuest[c.quest_id]) commentsByQuest[c.quest_id] = [];
    commentsByQuest[c.quest_id].push(c);
  }
  const itemsByQuest = {};
  for (const i of allItems || []) {
    if (!itemsByQuest[i.quest_id]) itemsByQuest[i.quest_id] = [];
    itemsByQuest[i.quest_id].push(i);
  }

  const enriched = quests.map((q) => ({
    ...q,
    items: itemsByQuest[q.id] || [],
    inventory: inventoryRawToMap(itemsByQuest[q.id] || []),
    _comments: commentsByQuest[q.id] || [],
  }));

  return { quests: enriched, error: null };
}

export default async function GuildmasterRoomPage() {
  const user = await getCurrentUser();

  let quests = [];
  let loadError = null;

  if (user) {
    const result = await loadReviewQuests(user.id);
    quests = result.quests;
    loadError = result.error;
  }

  return (
    <main className="guild-bg-guildmaster-room min-h-dvh p-4 md:p-8">
      <section className="mx-auto w-full max-w-[1800px] rounded-3xl border border-base-300 bg-base-100/88 p-6 shadow-xl backdrop-blur">
        <div className="flex flex-wrap items-start gap-4">
          <img
            src="/images/guildos/monkey.png"
            alt="Guildmaster"
            className="h-16 w-16 rounded-xl border border-base-300"
          />
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold">Guildmaster&apos;s Room</h1>
            <p className="mt-1 text-sm text-base-content/70">
              Quests awaiting your review, escalated issues, and items being archived.
            </p>
          </div>
        </div>

        {!user ? (
          <div className="mt-8 rounded-2xl border border-base-300 bg-base-200/50 p-6 text-center">
            <p className="text-base-content/80">Sign in to open the Guildmaster&apos;s room.</p>
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
              No quests need your attention right now.
            </p>
            <Link href="/tavern" className="btn btn-ghost btn-sm mt-4">
              Visit the Tavern
            </Link>
          </div>
        ) : (
          <DeskReviewClient quests={quests} />
        )}
      </section>
    </main>
  );
}

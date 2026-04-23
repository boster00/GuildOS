import Link from "next/link";
import { getCurrentUser } from "@/libs/council/auth/server";
import { MerchantGuildExplain } from "@/components/MerchantGuildExplain";
import { database } from "@/libs/council/database";
import { inventoryRawToMap } from "@/libs/quest";
import DeskReviewClient from "./DeskReviewClient";

export const metadata = {
  title: "The Guildmaster's desk · Guildmaster's chamber",
};

async function loadReviewQuests(userId) {
  const db = await database.init("server");

  // Fetch review-stage AND escalated-stage quests
  const { data: quests, error } = await db
    .from("quests")
    .select("id, title, description, stage, assigned_to, assignee_id, created_at, updated_at")
    .eq("owner_id", userId)
    .in("stage", ["review", "escalated", "closing"])
    .order("updated_at", { ascending: false });

  if (error) return { quests: [], error: error.message };
  if (!quests || quests.length === 0) return { quests: [], error: null };

  const questIds = quests.map((q) => q.id);

  // Fetch comments and items in parallel
  const [{ data: allComments }, { data: allItems }] = await Promise.all([
    db.from("quest_comments")
      .select("id, quest_id, source, action, summary, detail, created_at")
      .in("quest_id", questIds)
      .order("created_at", { ascending: false })
      .limit(500),
    db.from("items")
      .select("id, quest_id, item_key, url, description, source, created_at, updated_at")
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
    inventory: inventoryRawToMap(itemsByQuest[q.id] || []),
    _comments: commentsByQuest[q.id] || [],
  }));

  return { quests: enriched, error: null };
}

export default async function GuildmasterDeskPage() {
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
              Quests in <strong>review</strong> stage awaiting your decision. Each card shows the work summary on the left
              and attached screenshots on the right. Mark done or send feedback to keep things moving.
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
            <Link href="/town/tavern" className="btn btn-ghost btn-sm mt-4">
              Visit the Inn (full quest board)
            </Link>
          </div>
        ) : (
          <DeskReviewClient quests={quests} />
        )}
      </section>
    </main>
  );
}
